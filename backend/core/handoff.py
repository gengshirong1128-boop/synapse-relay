from __future__ import annotations

from backend.core.chatroom import get_member
from backend.schemas import ChatRoom, HandoffPacket, SessionRecord


def build_handoff_packet(session: SessionRecord, blocker: str, need: str, constraints: list[str]) -> HandoffPacket:
    context_lines = []
    attempts = []

    for message in session.messages[-6:]:
        speaker = message.get("agent_name", "user")
        content = message.get("content", "")
        context_lines.append(f"{speaker}: {content[:140]}")
        if message.get("type") == "agent":
            attempts.append(content[:140])

    return HandoffPacket(
        task=session.user_goal,
        context="\n".join(context_lines) or "No context captured yet.",
        attempts=attempts or ["No attempts recorded yet."],
        blocker=blocker,
        need=need,
        constraints=constraints,
    )


def build_room_handoff_packet(
    room: ChatRoom,
    new_agent_id: str,
    blocker: str,
    need: str,
    constraints: list[str],
    local_project_context: str | None = None,
) -> HandoffPacket:
    target_member = get_member(room, new_agent_id)
    host_member = get_member(room, room.host_agent_id)

    conversation_lines = []
    host_attempts = []
    for message in room.messages[-8:]:
        conversation_lines.append(f"{message.sender_id}: {message.content[:140]}")
        if message.sender_id == host_member.agent_id:
            host_attempts.append(message.content[:140])

    room_state = (
        f"mode={room.mode.value}; active_agent={room.active_agent_id or room.host_agent_id}; "
        f"members={', '.join((member.display_name or member.name) for member in room.members if member.status.value == 'active')}"
    )
    latest_brief = room.shared_briefs[-1] if room.shared_briefs else None
    conversation_summary = (
        " | ".join(latest_brief.common_ground + latest_brief.conflicts)[:320]
        if latest_brief
        else "No shared brief yet. Host has been working solo or in direct chat."
    )

    attached_context = room.attached_project_context or {}
    relevant_files = attached_context.get("relevant_files", [])
    warnings = attached_context.get("warnings", [])
    file_tree = attached_context.get("file_tree", [])
    selected_snippets = []
    files_sent = []
    for file_item in relevant_files[:10]:
        rel = file_item.get("relative_path", "")
        reason = file_item.get("reason", "")
        files_sent.append(rel)
        snippets = file_item.get("snippets", [])
        for snippet in snippets[:2]:
            selected_snippets.append(
                f"{rel}:{snippet.get('start_line')}-{snippet.get('end_line')} => {str(snippet.get('content', ''))[:180]}"
            )

    local_project_context_value = local_project_context or "No local project context attached."
    if attached_context:
        local_project_context_value = (
            f"project_name={attached_context.get('project_name', room.attached_project_name or '')}\n"
            f"project_path={attached_context.get('project_path', room.attached_project_path or '')}\n"
            f"simplified_file_tree={file_tree[:60]}\n"
            f"relevant_files={files_sent}\n"
            f"selected_snippets={selected_snippets[:20]}\n"
            f"dependency_files={attached_context.get('dependency_files', [])}\n"
            f"warnings={warnings}\n"
        )

    excluded_files = []
    env_notice = None
    for warning in warnings:
        if ".env exists" in warning:
            env_notice = warning
    if env_notice:
        excluded_files.append(".env (exists but excluded)")

    return HandoffPacket(
        task=room.title,
        context="\n".join(conversation_lines) or "No conversation yet.",
        attempts=host_attempts or ["Host has not published an attempt yet."],
        blocker=blocker,
        need=need,
        constraints=constraints,
        room_state=room_state,
        user_intent=room.messages[0].content if room.messages else room.title,
        local_project_context=local_project_context_value,
        conversation_summary=conversation_summary,
        main_agent_attempt=host_attempts[-1] if host_attempts else "No host attempt yet.",
        need_from_new_agent=f"{(target_member.display_name or target_member.name)} should help with: {need}",
        output_format=["claim", "reasoning", "risks", "objections", "suggested_fix", "confidence"],
        project_files_sent=files_sent,
        project_files_excluded=excluded_files,
        env_notice=env_notice,
    )
