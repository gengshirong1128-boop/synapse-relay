from __future__ import annotations

from backend.core.shared_brief import build_shared_brief, build_structured_shared_brief
from backend.core.coordinator import (
    build_coordinator_output,
    infer_decision_state,
    infer_execution_readiness,
)
from backend.schemas import (
    AgentResponse,
    CoordinatorRoundOutput,
    DecisionState,
    ExecutionReadiness,
    MessageState,
    SharedBrief,
    SpecialistRoundOutput,
)


def _make_response(name: str, claim: str, **overrides) -> AgentResponse:
    defaults = {
        "agent_name": name,
        "provider": "mock",
        "role": "expert",
        "round_number": 1,
        "claim": claim,
        "reasoning": f"{name} thinks this is best.",
        "risks": ["Risk A"],
        "objections": ["Objection B"],
        "confidence": 0.75,
        "suggested_next_step": "Proceed with implementation.",
        "state": MessageState.PUBLISHED,
    }
    defaults.update(overrides)
    return AgentResponse(**defaults)


class TestBuildSharedBrief:
    def test_basic_brief(self):
        responses = [
            _make_response("A", "Use PostgreSQL"),
            _make_response("B", "Use PostgreSQL for data"),
        ]
        brief = build_shared_brief(1, responses)
        assert brief.round_number == 1
        assert len(brief.each_agent_position) == 2
        assert len(brief.common_ground) > 0
        assert brief.suggested_next_step != ""

    def test_conflicts_from_objections(self):
        responses = [
            _make_response("A", "Go with React", objections=["Vue is better"]),
            _make_response("B", "Go with Vue", objections=["React has more ecosystem"]),
        ]
        brief = build_shared_brief(1, responses)
        assert len(brief.conflicts) > 0

    def test_no_objections_fallback(self):
        responses = [
            _make_response("A", "Plan A", objections=[]),
        ]
        brief = build_shared_brief(1, responses)
        assert "No explicit conflict" in brief.conflicts[0]

    def test_open_questions_from_risks(self):
        responses = [
            _make_response("A", "Plan", risks=["Memory usage concern"]),
        ]
        brief = build_shared_brief(1, responses)
        assert len(brief.open_questions) > 0

    def test_suggested_next_step_most_common(self):
        responses = [
            _make_response("A", "X", suggested_next_step="Write tests"),
            _make_response("B", "Y", suggested_next_step="Write tests"),
            _make_response("C", "Z", suggested_next_step="Refactor first"),
        ]
        brief = build_shared_brief(1, responses)
        assert "Write tests" in brief.suggested_next_step


class TestStructuredSharedBrief:
    def _make_specialist(self, agent_id: str, claim: str) -> SpecialistRoundOutput:
        return SpecialistRoundOutput(
            agent_id=agent_id,
            display_name=agent_id,
            position_id="domain_expert",
            assigned_task="Analyze.",
            claim=claim,
            analysis="Analysis",
            findings=["F1"],
            objections=["O1"],
            suggested_action="Continue.",
            confidence=0.8,
        )

    def _make_coordinator(self, outputs: list[SpecialistRoundOutput]) -> CoordinatorRoundOutput:
        return build_coordinator_output(
            round_number=1,
            outputs=outputs,
            previous_summary="",
            user_feedback="",
        )

    def test_structured_brief_fields(self):
        specialists = [
            self._make_specialist("a1", "Use Rust"),
            self._make_specialist("a2", "Use Go"),
        ]
        coordinator = self._make_coordinator(specialists)
        decision = infer_decision_state(coordinator)
        readiness = infer_execution_readiness(coordinator)

        brief = build_structured_shared_brief(
            round_number=1,
            specialist_outputs=specialists,
            coordinator_output=coordinator,
            decision_state=decision,
            execution_readiness=readiness,
        )
        assert brief.round_number == 1
        assert brief.decision_state == decision
        assert brief.execution_readiness == readiness
        assert brief.coordinator_summary != ""
        assert len(brief.agent_positions) == 2
        assert brief.compact_summary_for_next_round != ""

    def test_structured_brief_single_specialist(self):
        specialists = [self._make_specialist("a1", "One approach")]
        coordinator = self._make_coordinator(specialists)
        decision = infer_decision_state(coordinator)
        readiness = infer_execution_readiness(coordinator)

        brief = build_structured_shared_brief(1, specialists, coordinator, decision, readiness)
        assert len(brief.agent_positions) == 1
        assert brief.strongest_plan != ""
