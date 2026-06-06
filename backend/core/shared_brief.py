from __future__ import annotations

from collections import Counter

from backend.schemas import (
    AgentResponse,
    CoordinatorRoundOutput,
    DecisionState,
    ExecutionReadiness,
    SharedBrief,
    SpecialistRoundOutput,
)


def build_shared_brief(round_number: int, responses: list[AgentResponse]) -> SharedBrief:
    claims = [response.claim for response in responses]
    reasoning_topics = [response.reasoning.split(".")[0] for response in responses if response.reasoning]
    risk_items = [risk for response in responses for risk in response.risks]
    objection_items = [objection for response in responses for objection in response.objections]

    common_ground = []
    if claims:
        common_ground.append("All agents attempted to move the task toward a concrete next step.")
    if reasoning_topics:
        common_ground.append(reasoning_topics[0])

    conflicts = objection_items[:3] or ["No explicit conflict surfaced in this round."]
    open_questions = risk_items[:3] or ["What should be validated first in the next step?"]

    suggestion_counter = Counter(response.suggested_next_step for response in responses if response.suggested_next_step)
    suggested_next_step = suggestion_counter.most_common(1)[0][0] if suggestion_counter else "Review the brief and choose the next action."

    return SharedBrief(
        round_number=round_number,
        each_agent_position=responses,
        common_ground=common_ground,
        conflicts=conflicts,
        open_questions=open_questions,
        suggested_next_step=suggested_next_step,
    )


def build_structured_shared_brief(
    round_number: int,
    specialist_outputs: list[SpecialistRoundOutput],
    coordinator_output: CoordinatorRoundOutput,
    decision_state: DecisionState,
    execution_readiness: ExecutionReadiness,
) -> SharedBrief:
    positions = [
        {
            "agent_id": output.agent_id,
            "short_claim": output.claim[:120],
            "confidence": output.confidence,
        }
        for output in specialist_outputs
    ]
    unresolved = coordinator_output.conflicts[:]
    compact = (
        f"Round {round_number} decision: {coordinator_output.coordinator_decision[:180]}. "
        f"Focus: {coordinator_output.recommended_next_action}."
    )
    return SharedBrief(
        round_number=round_number,
        each_agent_position=[],
        common_ground=coordinator_output.common_ground,
        conflicts=coordinator_output.conflicts,
        open_questions=coordinator_output.risks_remaining,
        suggested_next_step=coordinator_output.coordinator_decision,
        agent_positions=positions,
        coordinator_summary=coordinator_output.summary_for_user,
        specialist_outputs_summary=[item.model_dump() for item in specialist_outputs],
        resolved_conflicts=[],
        unresolved_questions=unresolved,
        strongest_plan=coordinator_output.final_answer_candidate,
        minority_opinions=coordinator_output.conflicts[:2],
        user_decision_needed=coordinator_output.user_decision_needed,
        suggested_next_round_focus=coordinator_output.recommended_next_action,
        compact_summary_for_next_round=compact,
        decision_state=decision_state,
        execution_readiness=execution_readiness,
        recommended_next_action=coordinator_output.recommended_next_action,
    )
