from __future__ import annotations

from backend.core.agent_factory import build_agent_from_config, build_agent_from_member
from backend.core.chatroom import create_system_message, get_member
from backend.core.context_manager import context_manager
from backend.core.handoff import build_handoff_packet, build_room_handoff_packet
from backend.core.shared_brief import build_shared_brief
from backend.schemas import (
    AgentConfig,
    AgentResponse,
    ChatRoom,
    HandoffPacket,
    MessageState,
    RoomMode,
    SessionRecord,
)


def run_primary_panel_turn(session: SessionRecord, primary_agent_config: AgentConfig) -> AgentResponse:
    agent = build_agent_from_config(primary_agent_config)
    raw = agent.call_model(session.user_goal, {"context_summary": "Initial user task."})
    session.round_number = 1
    response = AgentResponse(
        agent_name=primary_agent_config.name,
        provider=primary_agent_config.provider,
        role=primary_agent_config.role,
        round_number=1,
        **raw,
        state=MessageState.PUBLISHED,
    )
    session.messages.append({"type": "user", "content": session.user_goal})
    session.messages.append({"type": "agent", "agent_name": response.agent_name, "content": response.claim})
    session.status = "waiting"
    return response


def run_panel_handoff(
    session: SessionRecord,
    support_agents: list[AgentConfig],
    blocker: str,
    need: str,
    constraints: list[str],
) -> tuple[list[AgentResponse], HandoffPacket, object]:
    handoff_packet = build_handoff_packet(session, blocker=blocker, need=need, constraints=constraints)
    session.handoff_packet = handoff_packet

    responses: list[AgentResponse] = []
    for config in support_agents:
        agent = build_agent_from_config(config)
        raw = agent.call_model(
            handoff_packet.task,
            {
                "context_summary": handoff_packet.context,
                "shared_brief_summary": need,
            },
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
    return responses, handoff_packet, shared_brief


def run_room_panel(
    room: ChatRoom,
    selected_agent_ids: list[str],
    blocker: str,
    need: str,
    constraints: list[str],
) -> tuple[list[AgentResponse], list[HandoffPacket], object]:
    room.mode = RoomMode.PANEL
    responses: list[AgentResponse] = []
    packets: list[HandoffPacket] = []

    target_ids = selected_agent_ids or [
        member.agent_id for member in room.members if member.role.value == "expert" and member.status.value == "active"
    ]
    for agent_id in target_ids:
        member = get_member(room, agent_id)
        packet = build_room_handoff_packet(room, agent_id, blocker=blocker, need=need, constraints=constraints)
        packets.append(packet)
        room.pending_handoff_packet = packet
        create_system_message(
            room,
            f"Handoff Packet prepared for {member.name}.",
            metadata={"handoff_packet": packet.model_dump(mode='json')},
        )

        agent = build_agent_from_member(member)
        raw = agent.call_model(
            packet.task,
            {
                "context_summary": packet.conversation_summary,
                "shared_brief_summary": packet.need_from_new_agent,
            },
        )
        response = AgentResponse(
            agent_name=member.name,
            provider=member.provider,
            role=member.role.value,
            round_number=len(room.shared_briefs) + 1,
            **raw,
            state=MessageState.PUBLISHED,
            suggested_fix=raw.get("suggested_next_step"),
            context_usage_percent=member.context_usage_percent,
        )
        responses.append(response)

    shared_brief = build_shared_brief(len(room.shared_briefs) + 1, responses)
    room.shared_briefs.append(shared_brief)
    room.pending_handoff_packet = packets[-1] if packets else None

    for response in responses:
        create_system_message(
            room,
            f"{response.agent_name} panel opinion: {response.claim}",
            metadata={"agent_response": response.model_dump(mode='json')},
        )
    create_system_message(
        room,
        "Shared Brief generated for panel round.",
        metadata={"shared_brief": shared_brief.model_dump(mode='json')},
    )
    context_manager.refresh_room(room)
    return responses, packets, shared_brief


def preview_room_handoffs(
    room: ChatRoom,
    selected_agent_ids: list[str],
    blocker: str,
    need: str,
    constraints: list[str],
) -> list[HandoffPacket]:
    target_ids = selected_agent_ids or [
        member.agent_id for member in room.members if member.role.value == "expert" and member.status.value == "active"
    ]
    packets = [
        build_room_handoff_packet(room, agent_id, blocker=blocker, need=need, constraints=constraints)
        for agent_id in target_ids
    ]
    if packets:
        room.pending_handoff_packet = packets[-1]
    return packets
