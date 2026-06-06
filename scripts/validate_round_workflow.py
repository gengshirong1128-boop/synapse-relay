from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    client = TestClient(app)

    # 1) Create room
    room_resp = client.post(
        "/room/create",
        json={
            "title": "Round Sync Validation",
            "owner_user": "User",
            "host_agent": {"name": "Mock GPT", "provider": "mock", "role": "host"},
        },
    )
    assert_true(room_resp.status_code == 200, "room create failed")
    room_id = room_resp.json()["room"]["room_id"]

    # 2) Create two DeepSeek mock instances
    instance_payloads = [
        {
            "agent_id": "deepseek_impl_1",
            "display_name": "DeepSeek 1号",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "credential_id": "deepseek_key_1",
            "role": "expert",
            "position_id": "code_implementer",
            "position_name": "代码实现官",
            "persona": "Implementation expert",
            "context_limit_tokens": 64000,
        },
        {
            "agent_id": "deepseek_reviewer_2",
            "display_name": "DeepSeek 2号",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "credential_id": "deepseek_key_2",
            "role": "expert",
            "position_id": "skeptic_reviewer",
            "position_name": "反对审查官",
            "persona": "Skeptic reviewer",
            "context_limit_tokens": 64000,
        },
    ]
    for payload in instance_payloads:
        resp = client.post("/agents/instances/create", json=payload)
        assert_true(resp.status_code == 200, f"instance create failed for {payload['agent_id']}")

    # 3) Add both instances to room
    for agent_id in ["deepseek_impl_1", "deepseek_reviewer_2"]:
        resp = client.post(f"/room/{room_id}/agents/add-instance", json={"agent_id": agent_id})
        assert_true(resp.status_code == 200, f"add instance failed for {agent_id}")

    room_state = client.get(f"/room/{room_id}").json()["room"]
    active_member_ids = [m["agent_id"] for m in room_state["members"] if m["status"] == "active"]
    assert_true("deepseek_impl_1" in active_member_ids, "deepseek_impl_1 not in room")
    assert_true("deepseek_reviewer_2" in active_member_ids, "deepseek_reviewer_2 not in room")

    # 4) Start panel round, verify coordinator last
    panel_round = client.post(
        f"/room/{room_id}/panel/round/start",
        json={
            "participant_agent_ids": ["deepseek_impl_1", "deepseek_reviewer_2"],
            "current_goal": "Find minimal implementation path",
            "constraints": ["MVP only"],
        },
    )
    assert_true(panel_round.status_code == 200, "panel round start failed")
    latest_round = panel_round.json()["latest_round"]
    assert_true(latest_round["status"] == "waiting_user", "panel round must wait user")
    assert_true(latest_round["coordinator_output"] is not None, "coordinator output missing")
    assert_true(len(latest_round["specialist_outputs"]) == 2, "specialist outputs count mismatch")
    specialist_ids = [item["agent_id"] for item in latest_round["specialist_outputs"]]
    assert_true("deepseek_impl_1" in specialist_ids and "deepseek_reviewer_2" in specialist_ids, "specialist ids mismatch")

    # 5) Feedback only to coordinator + continue next round
    feedback_resp = client.post(
        f"/room/{room_id}/panel/round/feedback",
        json={"content": "Please reduce complexity and keep implementation minimal."},
    )
    assert_true(feedback_resp.status_code == 200, "feedback to coordinator failed")

    continue_resp = client.post(
        f"/room/{room_id}/panel/round/continue",
        json={
            "participant_agent_ids": ["deepseek_impl_1", "deepseek_reviewer_2"],
            "current_goal": "Revise with user feedback",
            "constraints": ["No full rewrite"],
        },
    )
    assert_true(continue_resp.status_code == 200, "panel round continue failed")
    round2 = continue_resp.json()["latest_round"]
    assert_true(
        "reduce complexity" in round2["round_input"]["user_feedback_since_last_round"].lower(),
        "round2 input missing user feedback",
    )

    # 6) Debate round start
    debate_resp = client.post(
        f"/room/{room_id}/debate/round/start",
        json={
            "participant_agent_ids": ["deepseek_impl_1", "deepseek_reviewer_2"],
            "current_goal": "Auto converge",
            "constraints": ["Token efficient"],
            "max_rounds": 3,
            "token_budget": 6000,
            "cost_budget": 5,
            "consensus_threshold": 0.66,
        },
    )
    assert_true(debate_resp.status_code == 200, "debate round start failed")

    # 7) Private chat with deepseek_reviewer_2 should only call that agent
    private_resp = client.post(
        "/chat/private/deepseek_reviewer_2",
        json={"room_id": room_id, "content": "private check for reviewer only"},
    )
    assert_true(private_resp.status_code == 200, "private chat failed")
    private_msgs = private_resp.json()["messages"]
    assert_true(private_msgs[1]["sender_id"] == "deepseek_reviewer_2", "private response from wrong agent")

    # 8) Sync private result to coordinator
    sync_resp = client.post(
        "/chat/private/deepseek_reviewer_2/sync-to-room",
        json={"room_id": room_id, "summary": "Reviewer found hidden edge cases"},
    )
    assert_true(sync_resp.status_code == 200, "private sync failed")

    # 9) Remove one instance and ensure the other remains
    remove_resp = client.post(f"/room/{room_id}/agents/remove-instance", json={"agent_id": "deepseek_impl_1"})
    assert_true(remove_resp.status_code == 200, "remove instance failed")
    room_after_remove = client.get(f"/room/{room_id}").json()["room"]
    statuses = {m["agent_id"]: m["status"] for m in room_after_remove["members"]}
    assert_true(statuses["deepseek_impl_1"] == "removed", "deepseek_impl_1 should be removed")
    assert_true(statuses["deepseek_reviewer_2"] == "active", "deepseek_reviewer_2 should remain active")

    # 10) Context usage is per agent_id
    usage_resp = client.get(f"/context/{room_id}/usage")
    assert_true(usage_resp.status_code == 200, "context usage failed")
    usage_agents = usage_resp.json()["agents"]
    usage_ids = [item["agent_id"] for item in usage_agents]
    assert_true("deepseek_reviewer_2" in usage_ids, "usage missing deepseek_reviewer_2")

    print("Validation passed: round workflow and multi-instance behavior are working.")


if __name__ == "__main__":
    main()
