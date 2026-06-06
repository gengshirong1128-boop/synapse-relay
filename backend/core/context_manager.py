from __future__ import annotations

from datetime import datetime

from backend.core.token_meter import estimate_payload_tokens
from backend.schemas import (
    ChatRoom,
    ContextAgentUsage,
    ContextStatus,
    ContextUsageResponse,
    RoomMessage,
    VisibleTo,
)


class ContextManager:
    """Tracks per-agent context usage and compacts before the context window explodes."""

    def get_visible_messages(self, room: ChatRoom, agent_id: str) -> list[RoomMessage]:
        visible: list[RoomMessage] = []
        for message in room.messages:
            if message.visible_to == VisibleTo.ALL:
                visible.append(message)
            elif message.target_agent_id == agent_id:
                visible.append(message)
            elif message.sender_id == agent_id:
                visible.append(message)
            elif message.sender_type.value == "user":
                visible.append(message)
        return visible

    def build_context_payload(self, room: ChatRoom, agent_id: str) -> dict:
        member = next(member for member in room.members if member.agent_id == agent_id)
        visible_messages = self.get_visible_messages(room, agent_id)
        recent_limit = 2 if member.compacted_summary else 6
        recent_messages = visible_messages[-recent_limit:]
        return {
            "goal": room.title,
            "room_mode": room.mode.value,
            "compacted_summary": member.compacted_summary,
            "recent_messages": [message.model_dump(mode="json") for message in recent_messages],
        }

    def refresh_room(self, room: ChatRoom) -> ContextUsageResponse:
        usages: list[ContextAgentUsage] = []
        for member in room.members:
            if member.status.value == "removed":
                continue

            payload = self.build_context_payload(room, member.agent_id)
            used_tokens = estimate_payload_tokens(payload)
            usage_percent = round((used_tokens / max(member.context_limit_tokens, 1)) * 100, 2)
            status = ContextStatus.OK
            if usage_percent >= 95:
                self.compact_agent_context(room, member.agent_id)
                payload = self.build_context_payload(room, member.agent_id)
                used_tokens = estimate_payload_tokens(payload)
                usage_percent = round((used_tokens / max(member.context_limit_tokens, 1)) * 100, 2)
                status = ContextStatus.COMPACTED
            elif usage_percent >= 80:
                status = ContextStatus.WARNING

            member.estimated_used_tokens = used_tokens
            member.context_usage_percent = usage_percent
            usages.append(
                ContextAgentUsage(
                    agent_id=member.agent_id,
                    display_name=member.display_name or member.name,
                    provider=member.provider,
                    model=member.model or f"{member.provider}-default",
                    credential_id=member.credential_id,
                    used_tokens=used_tokens,
                    limit_tokens=member.context_limit_tokens,
                    usage_percent=usage_percent,
                    status=status,
                    compacted_summary=member.compacted_summary,
                )
            )
        room.updated_at = datetime.utcnow()
        return ContextUsageResponse(room_id=room.room_id, agents=usages)

    def compact_agent_context(self, room: ChatRoom, agent_id: str) -> str:
        member = next(member for member in room.members if member.agent_id == agent_id)
        visible_messages = self.get_visible_messages(room, agent_id)
        recent = visible_messages[-4:]
        user_messages = [message.content for message in visible_messages if message.sender_type.value == "user"]
        agent_messages = [message.content for message in visible_messages if message.sender_type.value == "agent"]
        latest_brief = room.shared_briefs[-1] if room.shared_briefs else None

        summary = "\n".join(
            [
                f"User Goal: {user_messages[0][:100] if user_messages else room.title[:100]}",
                f"Current Task State: room_mode={room.mode.value}, active_agent={room.active_agent_id or room.host_agent_id}",
                f"Attempts: {' | '.join(agent_messages[-2:])[:160] if agent_messages else 'No prior agent attempt.'}",
                "Key Code/Files: No local project context attached yet.",
                f"Current Disagreements: {' | '.join(latest_brief.conflicts)[:120] if latest_brief else 'No major conflict.'}",
                f"Confirmed Conclusions: {' | '.join(latest_brief.common_ground)[:120] if latest_brief else 'No fixed conclusion yet.'}",
                (
                    f"Next Step Suggestion: {latest_brief.suggested_next_step[:120]}"
                    if latest_brief
                    else "Next Step Suggestion: Continue from the latest visible user request."
                ),
                "Recent Messages: " + " | ".join(message.content[:60] for message in recent),
            ]
        )

        member.compacted_summary = summary
        member.last_compacted_at = datetime.utcnow()
        return summary

    def compact_room_context(self, room: ChatRoom) -> ContextUsageResponse:
        compacted_agents = []
        for member in room.members:
            if member.status.value == "removed":
                continue
            compacted_agents.append(
                {
                    "agent_id": member.agent_id,
                    "display_name": member.display_name or member.name,
                    "summary": self.compact_agent_context(room, member.agent_id),
                }
            )
        usage = self.refresh_room(room)
        usage.agents.sort(key=lambda item: item.usage_percent, reverse=True)
        return usage


context_manager = ContextManager()
