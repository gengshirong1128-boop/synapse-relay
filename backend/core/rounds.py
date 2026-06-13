from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.core.agent_factory import build_agent_from_member
from backend.core.chatroom import build_runtime_directives
from backend.core.coordinator import (
    assignment_as_completed,
    build_coordinator_output,
    build_default_assignment_instruction,
    infer_decision_state,
    infer_execution_readiness,
)
from backend.core.round_state import transition_round
from backend.core.shared_brief import build_structured_shared_brief
from backend.core.token_meter import estimate_payload_tokens
from backend.schemas import (
    ChatRoom,
    RoundInput,
    RoundRecord,
    RoundStatus,
    SharedBrief,
    SpecialistRoundOutput,
    TaskAssignment,
)


def _active_members(room: ChatRoom):
    return [member for member in room.members if member.status.value == "active"]


def _find_coordinator(room: ChatRoom):
    active = _active_members(room)
    coordinator = next((member for member in active if (member.position_id or "") == "coordinator"), None)
    if coordinator:
        return coordinator
    return next((member for member in active if member.agent_id == room.host_agent_id), active[0])


def _participant_ids(room: ChatRoom, requested: list[str]) -> list[str]:
    active_ids = [member.agent_id for member in _active_members(room)]
    if requested:
        return [agent_id for agent_id in requested if agent_id in active_ids]
    return active_ids


def _build_round_input(
    room: ChatRoom,
    mode: str,
    current_goal: str,
    constraints: list[str],
) -> RoundInput:
    previous_round = room.rounds[-1] if room.rounds else None
    previous_shared_brief = ""
    previous_outputs_summary: list[str] = []
    open_questions: list[str] = []
    if previous_round and previous_round.shared_brief:
        previous_shared_brief = previous_round.shared_brief.compact_summary_for_next_round
        previous_outputs_summary = [
            f"{item.display_name}: {item.claim[:120]}" for item in previous_round.specialist_outputs
        ]
        open_questions = previous_round.shared_brief.unresolved_questions

    project_context_summary = ""
    selected_project_files: list[str] = []
    if room.attached_project_context:
        relevant = room.attached_project_context.get("relevant_files", [])
        selected_project_files = [item.get("relative_path", "") for item in relevant if item.get("relative_path")]
        project_context_summary = (
            f"project={room.attached_project_name or ''}; "
            f"path={room.attached_project_path or ''}; "
            f"files={', '.join(selected_project_files[:8])}"
        )

    return RoundInput(
        original_task=room.title,
        current_goal=current_goal or room.title,
        previous_shared_brief=previous_shared_brief,
        previous_agent_outputs_summary=previous_outputs_summary,
        user_feedback_since_last_round=room.pending_user_feedback,
        updated_constraints=constraints,
        open_questions=open_questions,
        this_round_objective=current_goal or f"{mode} round objective based on latest brief.",
        local_project_context=project_context_summary,
        selected_project_files=selected_project_files,
    )


def _create_assignments(round_record: RoundRecord, room: ChatRoom) -> list[TaskAssignment]:
    coordinator_id = round_record.coordinator_agent_id
    assignments: list[TaskAssignment] = []
    participants = {member.agent_id: member for member in _active_members(room) if member.agent_id in round_record.participant_agent_ids}
    runtime_rules = build_runtime_directives(room)
    for member in sorted(participants.values(), key=lambda item: item.round_order):
        if member.agent_id == coordinator_id:
            continue
        instruction = build_default_assignment_instruction(member.position_id or "domain_expert", round_record.round_input)
        instruction = (
            f"{instruction}\n\nRoom Runtime Rules:\n{runtime_rules}\n"
            f"Chief Agent: {room.chief_agent_id or room.host_agent_id}"
        )
        assignment = TaskAssignment(
            assignment_id=str(uuid4()),
            round_id=round_record.round_id,
            from_agent_id=coordinator_id,
            to_agent_id=member.agent_id,
            position_id=member.position_id or "domain_expert",
            task_type="round_task",
            instruction=instruction,
            required_output_format=[
                "claim",
                "analysis",
                "findings",
                "objections",
                "suggested_action",
                "confidence",
            ],
            context_packet=round_record.round_input.model_dump_json(),
            priority=5,
            created_at=datetime.now(timezone.utc),
        )
        assignments.append(assignment)
    return assignments


def _run_specialists(round_record: RoundRecord, room: ChatRoom) -> list[SpecialistRoundOutput]:
    outputs: list[SpecialistRoundOutput] = []
    assignments = round_record.task_assignments
    runtime_rules = build_runtime_directives(room)
    for assignment in assignments:
        member = next(member for member in room.members if member.agent_id == assignment.to_agent_id)
        agent = build_agent_from_member(member)
        # Same input context for all specialists; no same-round cross-read.
        raw = agent.call_model(
            prompt=assignment.instruction,
            context={
                "round_input": round_record.round_input.model_dump(),
                "assigned_task": assignment.instruction,
                "runtime_rules": runtime_rules,
                "chief_agent_id": room.chief_agent_id or room.host_agent_id,
            },
        )
        output = SpecialistRoundOutput(
            agent_id=member.agent_id,
            display_name=member.display_name or member.name,
            position_id=member.position_id or "domain_expert",
            assigned_task=assignment.instruction,
            claim=raw["claim"],
            analysis=raw["reasoning"],
            findings=raw.get("risks", []),
            objections=raw.get("objections", []),
            suggested_action=raw.get("suggested_next_step", "Continue with current direction."),
            confidence=float(raw.get("confidence", 0.65)),
            needs_coordinator_attention=bool(raw.get("objections")),
            token_estimate=estimate_payload_tokens(raw),
        )
        outputs.append(output)
        assignment_as_completed(assignment)
    return outputs


def _build_shared_brief(round_record: RoundRecord) -> SharedBrief:
    coordinator_output = round_record.coordinator_output
    specialist_outputs = round_record.specialist_outputs
    decision_state = infer_decision_state(coordinator_output)
    execution_readiness = infer_execution_readiness(coordinator_output)
    return build_structured_shared_brief(
        round_number=round_record.round_number,
        specialist_outputs=specialist_outputs,
        coordinator_output=coordinator_output,
        decision_state=decision_state,
        execution_readiness=execution_readiness,
    )


def _finish_round(round_record: RoundRecord, room: ChatRoom, mode: str) -> RoundRecord:
    round_record.completed_at = datetime.now(timezone.utc)
    if mode == "panel":
        transition_round(round_record, RoundStatus.WAITING_USER)
    else:
        transition_round(round_record, RoundStatus.COMPLETED)
    room.shared_briefs.append(round_record.shared_brief)
    room.latest_round_id = round_record.round_id
    room.pending_user_feedback = ""
    room.rounds.append(round_record)
    return round_record


def run_round(
    room: ChatRoom,
    mode: str,
    participant_agent_ids: list[str],
    current_goal: str,
    constraints: list[str],
) -> RoundRecord:
    participants = _participant_ids(room, participant_agent_ids)
    coordinator = _find_coordinator(room)
    if coordinator.agent_id not in participants:
        participants.append(coordinator.agent_id)

    round_record = RoundRecord(
        round_id=str(uuid4()),
        room_id=room.room_id,
        mode=mode,
        round_number=len(room.rounds) + 1,
        participant_agent_ids=participants,
        coordinator_agent_id=coordinator.agent_id,
        round_input=_build_round_input(room, mode, current_goal=current_goal, constraints=constraints),
        created_at=datetime.now(timezone.utc),
        status=RoundStatus.PENDING,
    )

    transition_round(round_record, RoundStatus.ASSIGNING)
    round_record.task_assignments = _create_assignments(round_record, room)

    transition_round(round_record, RoundStatus.SPECIALISTS_THINKING)
    round_record.specialist_outputs = _run_specialists(round_record, room)

    transition_round(round_record, RoundStatus.SPECIALISTS_PUBLISHED)
    transition_round(round_record, RoundStatus.COORDINATOR_THINKING)
    previous_summary = room.shared_briefs[-1].compact_summary_for_next_round if room.shared_briefs else ""
    round_record.coordinator_output = build_coordinator_output(
        round_number=round_record.round_number,
        outputs=round_record.specialist_outputs,
        previous_summary=previous_summary,
        user_feedback=round_record.round_input.user_feedback_since_last_round,
    )
    transition_round(round_record, RoundStatus.COORDINATOR_PUBLISHED)
    round_record.shared_brief = _build_shared_brief(round_record)
    transition_round(round_record, RoundStatus.BRIEFED)
    return _finish_round(round_record, room, mode=mode)


def evaluate_debate_stop(room: ChatRoom, latest_round: RoundRecord) -> tuple[bool, str]:
    if latest_round.round_number >= room.max_rounds:
        return True, "Reached maximum rounds."
    if latest_round.shared_brief and latest_round.shared_brief.decision_state.value == "ready_to_execute":
        return True, "Coordinator marked plan ready to execute."
    if not latest_round.shared_brief:
        return False, "Continue debate."
    if not latest_round.shared_brief.conflicts:
        return True, "No remaining conflict."
    return False, "Continue debate."
