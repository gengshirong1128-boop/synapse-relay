from __future__ import annotations

from collections import Counter

from backend.schemas import (
    AssignmentStatus,
    CoordinatorRoundOutput,
    DecisionState,
    ExecutionReadiness,
    RoundInput,
    SpecialistRoundOutput,
    TaskAssignment,
)


def build_default_assignment_instruction(position_id: str, round_input: RoundInput) -> str:
    if position_id == "creative_strategist":
        return f"Propose 2-3 alternative approaches for: {round_input.this_round_objective or round_input.current_goal}"
    if position_id == "code_implementer":
        return f"Provide minimal file-level implementation steps for: {round_input.this_round_objective or round_input.current_goal}"
    if position_id == "skeptic_reviewer":
        return "Find failure modes, edge cases, and hidden assumptions in current proposals."
    if position_id == "context_curator":
        return "Recommend what context to keep/drop and how to reduce token cost."
    if position_id == "executor_liaison":
        return "Prepare execution-ready prompt snippets for Codex/Claude Code handoff."
    return f"Provide domain-specific judgement for: {round_input.this_round_objective or round_input.current_goal}"


def summarize_specialist_outputs(outputs: list[SpecialistRoundOutput]) -> list[dict[str, str]]:
    return [
        {
            "agent_id": output.agent_id,
            "display_name": output.display_name,
            "position_id": output.position_id,
            "claim": output.claim[:180],
            "suggested_action": output.suggested_action[:180],
        }
        for output in outputs
    ]


def build_coordinator_output(
    round_number: int,
    outputs: list[SpecialistRoundOutput],
    previous_summary: str,
    user_feedback: str,
) -> CoordinatorRoundOutput:
    claims = [output.claim for output in outputs]
    findings = [item for output in outputs for item in output.findings]
    objections = [item for output in outputs for item in output.objections]
    common = []
    if claims:
        common.append("All specialists produced actionable recommendations.")
    if findings:
        common.append(findings[0][:160])

    conflicts = objections[:3] or ["No major conflict surfaced this round."]
    claim_counter = Counter(claims)
    strongest = claim_counter.most_common(1)[0][0] if claim_counter else "No specialist claim."
    decision = f"Coordinator prefers: {strongest[:180]}"
    next_action = "continue_panel_round" if conflicts and conflicts[0] != "No major conflict surfaced this round." else "ask_user"
    if "execute" in (user_feedback or "").lower():
        next_action = "export_to_codex"

    assignment_preview = [
        {"to_agent_id": output.agent_id, "task": f"Refine based on: {output.suggested_action[:80]}"}
        for output in outputs
    ]
    confidence = round(sum(output.confidence for output in outputs) / max(len(outputs), 1), 2)
    return CoordinatorRoundOutput(
        round_number=round_number,
        summary_for_user=(
            f"Round {round_number} summary: {decision}. "
            f"User feedback received: {user_feedback[:160] if user_feedback else 'none'}; "
            f"Previous summary anchor: {previous_summary[:120] if previous_summary else 'none'}"
        ),
        what_each_agent_found=summarize_specialist_outputs(outputs),
        common_ground=common,
        conflicts=conflicts,
        coordinator_decision=decision,
        risks_remaining=conflicts,
        user_decision_needed="Choose continue, narrow to one specialist, or finalize.",
        next_round_task_assignments=assignment_preview,
        recommended_next_action=next_action,
        final_answer_candidate=strongest,
        execution_prompt_candidate=f"Implement this plan next: {strongest[:220]}",
        confidence=confidence,
    )


def assignment_as_completed(assignment: TaskAssignment) -> TaskAssignment:
    assignment.status = AssignmentStatus.COMPLETED
    return assignment


def infer_decision_state(coordinator_output: CoordinatorRoundOutput) -> DecisionState:
    if "final" in coordinator_output.coordinator_decision.lower():
        return DecisionState.READY_TO_EXECUTE
    if coordinator_output.conflicts:
        return DecisionState.CONFLICTING
    return DecisionState.CONVERGING


def infer_execution_readiness(coordinator_output: CoordinatorRoundOutput) -> ExecutionReadiness:
    action = coordinator_output.recommended_next_action
    if action == "export_to_codex":
        return ExecutionReadiness.CODEX_READY
    if action == "export_to_claude_code":
        return ExecutionReadiness.CLAUDE_CODE_READY
    if action in {"continue_panel_round", "continue_debate"}:
        return ExecutionReadiness.DRAFT_READY
    return ExecutionReadiness.NOT_READY
