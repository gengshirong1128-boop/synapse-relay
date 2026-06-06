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

    # 1) credentials should not return real key value
    cred_resp = client.get("/credentials")
    assert_true(cred_resp.status_code == 200, "credentials endpoint failed")
    creds = cred_resp.json().get("credentials", [])
    assert_true(len(creds) > 0, "no credentials returned")
    forbidden_fields = {"api_key", "key", "secret", "value"}
    for item in creds:
        assert_true(all(field not in item for field in forbidden_fields), "credential leaked secret fields")

    # 2) create provider profile
    profile_resp = client.post(
        "/provider-profiles/create",
        json={
            "profile_id": "deepseek_profile_test",
            "name": "DeepSeek Test Profile",
            "provider": "deepseek",
            "api_format": "openai_compatible",
            "base_url": "https://api.deepseek.com/v1",
            "default_model": "deepseek-chat",
            "credential_id": "deepseek_key_1",
            "enabled": True,
            "notes": "validation profile",
        },
    )
    assert_true(profile_resp.status_code in {200, 400}, "profile create failed unexpectedly")

    # 3) provider profile test should fallback to mock if no key
    test_resp = client.post("/provider-profiles/deepseek_profile_test/test", json={"test_prompt": "ping"})
    assert_true(test_resp.status_code == 200, "profile test failed")
    test_json = test_resp.json()
    if not any(item.get("credential_id") == "deepseek_key_1" and item.get("key_available") for item in creds):
        assert_true(test_json.get("fallback_to_mock") is True, "missing key should fallback to mock")

    # 4) create two deepseek instances with different credentials
    instance_payloads = [
        {
            "agent_id": "deepseek_runner_1",
            "display_name": "DeepSeek Runner 1",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "credential_id": "deepseek_key_1",
            "profile_id": "deepseek_profile_test",
            "role": "expert",
            "position_id": "code_implementer",
            "position_name": "Code Implementer",
            "persona": "Implementation profile 1",
            "context_limit_tokens": 64000,
        },
        {
            "agent_id": "deepseek_runner_2",
            "display_name": "DeepSeek Runner 2",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "credential_id": "deepseek_key_2",
            "profile_id": "deepseek_profile_test",
            "role": "expert",
            "position_id": "skeptic_reviewer",
            "position_name": "Skeptic Reviewer",
            "persona": "Review profile 2",
            "context_limit_tokens": 64000,
        },
    ]
    for payload in instance_payloads:
        resp = client.post("/agents/instances/create", json=payload)
        assert_true(resp.status_code in {200, 400}, f"instance create failed for {payload['agent_id']}")

    # Prepare room + attach project for runner
    room_resp = client.post(
        "/room/create",
        json={
            "title": "Runner Validation Room",
            "owner_user": "User",
            "host_agent": {"name": "Mock GPT", "provider": "mock", "role": "host"},
        },
    )
    assert_true(room_resp.status_code == 200, "room create failed")
    room_id = room_resp.json()["room"]["room_id"]

    scan_resp = client.post("/project/scan", json={"project_path": str(ROOT), "max_file_size_bytes": 1048576})
    assert_true(scan_resp.status_code == 200, "project scan failed")
    project_id = scan_resp.json()["project_id"]

    context_resp = client.post(
        f"/project/{project_id}/context-build",
        json={"question": "runner validation", "selected_paths": []},
    )
    assert_true(context_resp.status_code == 200, "context build failed")

    attach_resp = client.post(
        f"/room/{room_id}/project/attach",
        json={"project_id": project_id, "question": "runner validation", "selected_paths": []},
    )
    assert_true(attach_resp.status_code == 200, "room attach failed")
    room_data = client.get(f"/room/{room_id}").json()["room"]
    project_path = room_data["attached_project_path"]

    # 5) runner checks should not crash when missing binaries
    codex_check = client.post("/executor/check/codex", json={})
    claude_check = client.post("/executor/check/claude-code", json={})
    assert_true(codex_check.status_code == 200, "codex check failed")
    assert_true(claude_check.status_code == 200, "claude check failed")

    # 6) dry-run should not execute, only preview
    prompt_text = "Please modify minimal files and run tests."
    codex_run = client.post(
        "/executor/run/codex",
        json={
            "executor_type": "codex",
            "project_path": project_path,
            "prompt": prompt_text,
            "dry_run": True,
            "timeout_seconds": 600,
            "allow_write": False,
            "extra_args": [],
        },
    )
    assert_true(codex_run.status_code == 200, "codex dry run failed")
    codex_result = codex_run.json()
    assert_true(codex_result["dry_run"] is True, "codex dry run flag wrong")
    assert_true(codex_result["started"] is False, "codex dry run should not start process")
    assert_true(len(codex_result["command_preview"]) > 0, "codex command preview missing")

    claude_run = client.post(
        "/executor/run/claude-code",
        json={
            "executor_type": "claude_code",
            "project_path": project_path,
            "prompt": prompt_text,
            "dry_run": True,
            "timeout_seconds": 600,
            "allow_write": False,
            "extra_args": [],
        },
    )
    assert_true(claude_run.status_code == 200, "claude dry run failed")
    claude_result = claude_run.json()
    assert_true(claude_result["dry_run"] is True, "claude dry run flag wrong")
    assert_true(claude_result["started"] is False, "claude dry run should not start process")
    assert_true(len(claude_result["command_preview"]) > 0, "claude command preview missing")

    print("Validation passed: provider/profile/runner workflow is working.")


if __name__ == "__main__":
    main()
