from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.core.agent_factory import build_agent_from_member
from backend.core.context_manager import context_manager
from backend.core.history_store import history_store
from backend.core.token_meter import estimate_payload_tokens
from backend.schemas import (
    AgentConfig,
    AgentInstance,
    AgentMember,
    AgentRole,
    AgentStatus,
    ChatRoom,
    HostDecision,
    Directive,
    MessageState,
    RoomCreateRequest,
    RoomMessage,
    RoomMode,
    WorkMode,
    SenderType,
    VisibleTo,
)


def make_agent_id(name: str) -> str:
    return name.lower().replace(" ", "-").replace("#", "").replace(":", "-")


def member_from_instance(instance: AgentInstance) -> AgentMember:
    return AgentMember(
        agent_id=instance.agent_id,
        name=instance.display_name,
        display_name=instance.display_name,
        provider=instance.provider,
        model=instance.model,
        credential_id=instance.credential_id,
        profile_id=instance.profile_id,
        role=instance.role,
        position_id=instance.position_id,
        position_name=instance.position_name,
        persona=instance.persona,
        system_prompt=instance.system_prompt,
        status=instance.status,
        joined_at=instance.joined_at,
        context_limit_tokens=instance.context_limit_tokens,
        estimated_used_tokens=instance.estimated_used_tokens,
        context_usage_percent=instance.context_usage_percent,
        round_order=instance.round_order,
        can_receive_user_feedback=instance.can_receive_user_feedback,
        can_assign_tasks=instance.can_assign_tasks,
        can_finalize=instance.can_finalize,
        reads_full_round_outputs=instance.reads_full_round_outputs,
        receives_task_from_coordinator=instance.receives_task_from_coordinator,
    )


class ChatRoomStore:
    def __init__(self) -> None:
        self._rooms: dict[str, ChatRoom] = {}

    def create_default_room(self, request: RoomCreateRequest) -> ChatRoom:
        now = datetime.now(timezone.utc)
        host_id = make_agent_id(request.host_agent.name)
        room = ChatRoom(
            room_id=str(uuid4()),
            title=request.title,
            owner_user=request.owner_user,
            host_agent_id=host_id,
            chief_agent_id=host_id,
            active_mode=WorkMode.DEFAULT,
            members=[
                AgentMember(
                    agent_id=host_id,
                    name=request.host_agent.name,
                    display_name=request.host_agent.name,
                    provider=request.host_agent.provider,
                    model="mock-gpt" if request.host_agent.provider == "mock" else None,
                    credential_id="mock_default" if request.host_agent.provider == "mock" else None,
                    role=AgentRole.HOST,
                    position_id="coordinator",
                    position_name="Coordinator",
                    persona="Host agent coordinating this room.",
                    system_prompt="You are the coordinator and you speak last each round.",
                    joined_at=now,
                    round_order=99,
                    can_receive_user_feedback=True,
                    can_assign_tasks=True,
                    can_finalize=True,
                    reads_full_round_outputs=True,
                    receives_task_from_coordinator=False,
                )
            ],
            messages=[],
            mode=RoomMode.GROUP,
            active_agent_id=host_id,
            created_at=now,
            updated_at=now,
        )
        self._rooms[room.room_id] = room
        context_manager.refresh_room(room)
        return room

    def get(self, room_id: str) -> ChatRoom:
        room = self._rooms.get(room_id)
        if room is None:
            raise KeyError(f"Unknown room_id: {room_id}")
        return room

    def save(self, room: ChatRoom) -> ChatRoom:
        room.updated_at = datetime.now(timezone.utc)
        self._rooms[room.room_id] = room
        history_store.save_room(room)
        return room

    def find_by_project_path(self, project_path: str) -> ChatRoom | None:
        for room in self._rooms.values():
            if room.attached_project_path == project_path:
                return room
        return None


def build_room_message(
    room_id: str,
    sender_type: SenderType,
    sender_id: str,
    content: str,
    mode: str,
    visible_to: VisibleTo = VisibleTo.ALL,
    target_agent_id: str | None = None,
    status: MessageState = MessageState.PUBLISHED,
    metadata: dict | None = None,
) -> RoomMessage:
    return RoomMessage(
        message_id=str(uuid4()),
        room_id=room_id,
        sender_type=sender_type,
        sender_id=sender_id,
        content=content,
        visible_to=visible_to,
        target_agent_id=target_agent_id,
        mode=mode,
        status=status,
        token_estimate=estimate_payload_tokens(content),
        created_at=datetime.now(timezone.utc),
        metadata=metadata or {},
    )


def get_member(room: ChatRoom, agent_id: str) -> AgentMember:
    for member in room.members:
        if member.agent_id == agent_id:
            return member
    raise KeyError(f"Unknown agent_id: {agent_id}")


def add_agent_member(room: ChatRoom, config: AgentConfig, context_limit_tokens: int = 8000) -> AgentMember:
    agent_id = make_agent_id(config.name)
    existing = next((member for member in room.members if member.agent_id == agent_id), None)
    if existing:
        existing.status = AgentStatus.ACTIVE
        existing.role = AgentRole(config.role)
        existing.context_limit_tokens = context_limit_tokens
        room.updated_at = datetime.now(timezone.utc)
        return existing

    member = AgentMember(
        agent_id=agent_id,
        name=config.name,
        display_name=config.name,
        provider=config.provider,
        model=f"{config.provider}-default",
        credential_id="mock_default" if config.provider == "mock" else None,
        role=AgentRole(config.role),
        joined_at=datetime.now(timezone.utc),
        context_limit_tokens=context_limit_tokens,
        position_id="domain_expert",
        position_name="Domain Expert",
    )
    room.members.append(member)
    room.updated_at = datetime.now(timezone.utc)
    return member


def add_agent_instance_to_room(room: ChatRoom, instance: AgentInstance) -> AgentMember:
    existing = next((member for member in room.members if member.agent_id == instance.agent_id), None)
    if existing:
        existing.status = AgentStatus.ACTIVE
        existing.display_name = instance.display_name
        existing.provider = instance.provider
        existing.model = instance.model
        existing.credential_id = instance.credential_id
        existing.profile_id = instance.profile_id
        existing.position_id = instance.position_id
        existing.position_name = instance.position_name
        existing.persona = instance.persona
        existing.system_prompt = instance.system_prompt
        existing.context_limit_tokens = instance.context_limit_tokens
        existing.round_order = instance.round_order
        existing.can_receive_user_feedback = instance.can_receive_user_feedback
        existing.can_assign_tasks = instance.can_assign_tasks
        existing.can_finalize = instance.can_finalize
        existing.reads_full_round_outputs = instance.reads_full_round_outputs
        existing.receives_task_from_coordinator = instance.receives_task_from_coordinator
        room.updated_at = datetime.now(timezone.utc)
        return existing

    member = member_from_instance(instance)
    room.members.append(member)
    room.updated_at = datetime.now(timezone.utc)
    return member


def remove_agent_member(room: ChatRoom, agent_id: str) -> AgentMember:
    member = get_member(room, agent_id)
    if member.role == AgentRole.HOST:
        raise ValueError("Host agent cannot be removed from the room.")
    member.status = AgentStatus.REMOVED
    if room.active_agent_id == agent_id:
        room.active_agent_id = room.host_agent_id
        room.mode = RoomMode.GROUP
    room.updated_at = datetime.now(timezone.utc)
    return member


def set_room_mode(room: ChatRoom, mode: RoomMode) -> ChatRoom:
    room.mode = mode
    if mode == RoomMode.GROUP:
        room.active_agent_id = room.host_agent_id
    room.updated_at = datetime.now(timezone.utc)
    return room


def set_work_mode(room: ChatRoom, mode: WorkMode) -> ChatRoom:
    room.active_mode = mode
    room.updated_at = datetime.now(timezone.utc)
    return room


def set_chief_agent(room: ChatRoom, agent_id: str) -> ChatRoom:
    member = get_member(room, agent_id)
    if member.status != AgentStatus.ACTIVE:
        raise ValueError("Selected chief agent is not active.")
    room.chief_agent_id = member.agent_id
    room.host_agent_id = member.agent_id
    member.role = AgentRole.HOST
    if member.position_id is None or member.position_id == "domain_expert":
        member.position_id = "coordinator"
        member.position_name = "Coordinator"
    room.updated_at = datetime.now(timezone.utc)
    return room


def set_active_agent(room: ChatRoom, agent_id: str | None) -> ChatRoom:
    if agent_id is None:
        room.mode = RoomMode.GROUP
        room.active_agent_id = room.host_agent_id
        room.updated_at = datetime.now(timezone.utc)
        return room

    member = get_member(room, agent_id)
    if member.status != AgentStatus.ACTIVE:
        raise ValueError("Selected agent is not active.")
    room.active_agent_id = agent_id
    room.mode = RoomMode.PRIVATE if agent_id != room.host_agent_id else RoomMode.GROUP
    room.updated_at = datetime.now(timezone.utc)
    return room


def build_visible_messages(room: ChatRoom, agent_id: str) -> list[str]:
    payload = context_manager.build_context_payload(room, agent_id)
    recent_messages = payload["recent_messages"]
    lines = []
    if payload.get("compacted_summary"):
        lines.append(f"Compacted Summary: {payload['compacted_summary']}")
    lines.extend(f"{item['sender_type']}:{item['sender_id']} -> {item['content']}" for item in recent_messages)
    return lines


def build_runtime_directives(room: ChatRoom) -> str:
    mode_prompts = {
        WorkMode.DEFAULT.value: "当前模式：默认对话。请正常回答用户问题。",
        WorkMode.CONTINUE_ROUND.value: "当前模式：继续下一轮。请基于上一轮观点推进，不要重复。",
        WorkMode.FINAL_SUMMARY.value: "当前模式：最终总结。请整合观点并输出行动项与风险。",
        WorkMode.AUTO_DEBATE.value: "当前模式：自动辩论。请提出立场、反驳和裁决建议。",
    }
    parts = [mode_prompts.get(room.active_mode.value if isinstance(room.active_mode, WorkMode) else str(room.active_mode), mode_prompts[WorkMode.DEFAULT.value])]
    for item in room.guiding_directives:
        if item.enabled:
            parts.append(f"【准奏】后续必须沿此方向推进：{item.content}")
    for item in room.forbidden_directives:
        if item.enabled:
            parts.append(f"【驳回】后续禁止沿此方向继续：{item.content}")
    return "\n".join(parts)


def apply_imperial_review(room: ChatRoom, message_id: str, review_type: str, instruction: str = "") -> RoomMessage:
    target = next((m for m in room.messages if m.message_id == message_id), None)
    if target is None:
        raise KeyError(f"Unknown message_id: {message_id}")
    if target.sender_type != SenderType.AGENT:
        raise ValueError("Imperial review can only be applied to agent messages.")
    content = instruction.strip() or target.content[:180]
    directive = Directive(
        id=str(uuid4()),
        source_message_id=target.message_id,
        source_agent_id=target.sender_id,
        type="approve" if review_type == "approve" else "reject",
        content=content,
        enabled=True,
        permanent=True,
        created_at=datetime.now(timezone.utc),
    )
    if review_type == "approve":
        room.guiding_directives.append(directive)
    else:
        room.forbidden_directives.append(directive)
    label = "准奏" if review_type == "approve" else "驳回"
    target.imperial_review = {
        "type": review_type,
        "label": label,
        "instruction": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    target.metadata["imperial_review"] = target.imperial_review
    room.updated_at = datetime.now(timezone.utc)
    return target


def post_user_message(room: ChatRoom, content: str) -> tuple[RoomMessage, RoomMessage, HostDecision | None]:
    private_target = room.active_agent_id if room.mode == RoomMode.PRIVATE else None
    mode = "private" if room.mode == RoomMode.PRIVATE else "group"
    visible_to = VisibleTo.SPECIFIC_AGENT if private_target else VisibleTo.ALL

    user_message = build_room_message(
        room_id=room.room_id,
        sender_type=SenderType.USER,
        sender_id=room.owner_user,
        content=content,
        mode=mode,
        visible_to=visible_to,
        target_agent_id=private_target,
    )
    room.messages.append(user_message)

    active_agent_id = private_target or room.host_agent_id
    active_member = get_member(room, active_agent_id)
    agent = build_agent_from_member(active_member)
    context_lines = build_visible_messages(room, active_agent_id)
    runtime_rules = build_runtime_directives(room)
    host_decision: HostDecision | None = None

    if active_member.role == AgentRole.HOST and hasattr(agent, "answer_user_message"):
        host_decision = agent.answer_user_message(
            content,
            {
                "context_summary": " | ".join(context_lines[-4:]),
                "runtime_rules": runtime_rules,
                "chief_agent_id": room.chief_agent_id or room.host_agent_id,
            },
        )
        response_content = host_decision.answer
        metadata = {"host_decision": host_decision.model_dump(mode="json")}
    else:
        raw = agent.call_model(
            content,
            {
                "context_summary": " | ".join(context_lines[-4:]),
                "runtime_rules": runtime_rules,
                "chief_agent_id": room.chief_agent_id or room.host_agent_id,
            },
        )
        response_content = raw["claim"]
        metadata = {"agent_response": raw}

    agent_message = build_room_message(
        room_id=room.room_id,
        sender_type=SenderType.AGENT,
        sender_id=active_member.agent_id,
        content=response_content,
        mode=mode,
        visible_to=visible_to,
        target_agent_id=private_target,
        metadata=metadata,
    )
    room.messages.append(agent_message)
    room.updated_at = datetime.now(timezone.utc)
    context_manager.refresh_room(room)
    return user_message, agent_message, host_decision


def create_system_message(room: ChatRoom, content: str, metadata: dict | None = None) -> RoomMessage:
    message = build_room_message(
        room_id=room.room_id,
        sender_type=SenderType.SYSTEM,
        sender_id="system",
        content=content,
        mode="group",
        metadata=metadata,
    )
    room.messages.append(message)
    room.updated_at = datetime.now(timezone.utc)
    return message


room_store = ChatRoomStore()
