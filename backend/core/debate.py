from __future__ import annotations

from collections import Counter

from backend.core.agent_factory import build_agent_from_config, build_agent_from_member
from backend.core.chatroom import create_system_message, get_member
from backend.core.context_manager import context_manager
from backend.core.shared_brief import build_shared_brief
from backend.schemas import AgentConfig, AgentResponse, ChatRoom, MessageState, RoomMode, SessionRecord


def run_debate_round(session: SessionRecord, use_shared_brief: bool) -> tuple[list[AgentResponse], object]:
    session.round_number += 1
    brief_context = session.shared_briefs[-1].model_dump() if use_shared_brief and session.shared_briefs else None
    responses: list[AgentResponse] = []

    for config in session.agents:
        agent = build_agent_from_config(config)
        raw = (
            agent.critique(brief_context)
            if brief_context
            else agent.call_model(session.user_goal, {"context_summary": "Initial debate round."})
        )
        response = AgentResponse(
            agent_name=config.name,
            provider=config.provider,
            role=config.role,
            round_number=session.round_number,
            **raw,
            state=MessageState.PUBLISHED,
        )
        responses.append(response)
        session.messages.append({"type": "agent", "agent_name": response.agent_name, "content": response.claim})

    shared_brief = build_shared_brief(session.round_number, responses)
    for response in responses:
        response.state = MessageState.BRIEFED
    session.shared_briefs.append(shared_brief)
    session.status = "waiting"
    return responses, shared_brief


def evaluate_stop_condition(session: SessionRecord, responses: list[AgentResponse]) -> tuple[bool, str]:
    if session.round_number >= session.max_rounds:
        return True, "Reached maximum debate rounds."

    claim_counter = Counter(response.claim for response in responses)
    if claim_counter and claim_counter.most_common(1)[0][1] >= max(2, len(responses) // 2 + 1):
        return True, "Majority of agents converged on the same claim."

    latest_brief = session.shared_briefs[-1]
    if latest_brief.conflicts == ["No explicit conflict surfaced in this round."]:
        return True, "No new critical objections were raised."

    return False, "Continue debate."


def build_final_answer(session: SessionRecord) -> str:
    if not session.shared_briefs:
        return "No debate brief available yet."

    latest_brief = session.shared_briefs[-1]
    top_claim = latest_brief.each_agent_position[0].claim if latest_brief.each_agent_position else "No claim available."
    session.final_answer = (
        f"Final Answer for '{session.user_goal}':\n"
        f"- Recommended direction: {top_claim}\n"
        f"- Common ground: {'; '.join(latest_brief.common_ground)}\n"
        f"- Open questions: {'; '.join(latest_brief.open_questions)}\n"
        f"- Next step: {latest_brief.suggested_next_step}"
    )
    session.status = "completed"
    return session.final_answer


def run_room_debate_round(room: ChatRoom, selected_agent_ids: list[str], use_shared_brief: bool) -> tuple[list[AgentResponse], object]:
    room.mode = RoomMode.DEBATE
    round_number = len(room.shared_briefs) + 1
    target_ids = selected_agent_ids or [
        member.agent_id
        for member in room.members
        if member.status.value == "active" and member.role.value in {"host", "expert"}
    ]
    brief_context = room.shared_briefs[-1].model_dump() if use_shared_brief and room.shared_briefs else None
    responses: list[AgentResponse] = []

    for agent_id in target_ids:
        member = get_member(room, agent_id)
        agent = build_agent_from_member(member)
        raw = (
            agent.critique(brief_context)
            if brief_context
            else agent.call_model(room.title, {"context_summary": member.compacted_summary or "Initial debate round."})
        )
        response = AgentResponse(
            agent_name=member.name,
            provider=member.provider,
            role=member.role.value,
            round_number=round_number,
            **raw,
            state=MessageState.PUBLISHED,
            suggested_fix=raw.get("suggested_next_step"),
            context_usage_percent=member.context_usage_percent,
        )
        responses.append(response)

    shared_brief = build_shared_brief(round_number, responses)
    room.shared_briefs.append(shared_brief)
    create_system_message(
        room,
        f"Round {round_number} Shared Brief ready.",
        metadata={"shared_brief": shared_brief.model_dump(mode='json')},
    )
    context_manager.refresh_room(room)
    return responses, shared_brief


def evaluate_room_stop_condition(room: ChatRoom, responses: list[AgentResponse]) -> tuple[bool, str]:
    round_number = len(room.shared_briefs)
    if round_number >= room.max_rounds:
        return True, "Reached maximum debate rounds."

    claim_counter = Counter(response.claim for response in responses)
    if claim_counter:
        top_count = claim_counter.most_common(1)[0][1]
        if top_count / max(len(responses), 1) >= room.consensus_threshold:
            return True, "Consensus threshold reached."

    latest_brief = room.shared_briefs[-1]
    if latest_brief.conflicts == ["No explicit conflict surfaced in this round."]:
        return True, "No new critical objections were raised."

    total_tokens = sum(member.estimated_used_tokens for member in room.members if member.status.value == "active")
    if total_tokens >= room.token_budget:
        return True, "Token budget reached."

    return False, "Continue debate."


def build_room_final_plan(room: ChatRoom) -> str:
    latest_brief = room.shared_briefs[-1] if room.shared_briefs else None
    latest_host_message = next(
        (message.content for message in reversed(room.messages) if message.sender_id == room.host_agent_id),
        "Host has not posted a final explanation yet.",
    )
    room.final_plan = (
        f"Final Plan for room '{room.title}':\n"
        f"- Host Summary: {latest_host_message}\n"
        f"- Common Ground: {'; '.join(latest_brief.common_ground) if latest_brief else 'No shared brief yet.'}\n"
        f"- Conflicts: {'; '.join(latest_brief.conflicts) if latest_brief else 'No conflicts logged.'}\n"
        f"- Next Step: {latest_brief.suggested_next_step if latest_brief else 'Continue with the host plan.'}"
    )
    room.stop_reason = room.stop_reason or "Finalized by user."
    return room.final_plan
