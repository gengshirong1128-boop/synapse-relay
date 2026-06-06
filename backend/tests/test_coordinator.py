from __future__ import annotations

from backend.core.coordinator import (
    build_coordinator_output,
    build_default_assignment_instruction,
    infer_decision_state,
    infer_execution_readiness,
    summarize_specialist_outputs,
)
from backend.schemas import (
    DecisionState,
    ExecutionReadiness,
    RoundInput,
    SpecialistRoundOutput,
)


def _make_output(agent_id: str, claim: str, position_id: str = "domain_expert") -> SpecialistRoundOutput:
    return SpecialistRoundOutput(
        agent_id=agent_id,
        display_name=agent_id,
        position_id=position_id,
        assigned_task="Analyze the situation.",
        claim=claim,
        analysis="Analysis text.",
        findings=["Finding 1"],
        objections=["Objection 1"],
        suggested_action="Continue.",
        confidence=0.8,
    )


def _make_round_input(goal: str = "Test goal") -> RoundInput:
    return RoundInput(
        original_task="Original task",
        current_goal=goal,
    )


class TestDefaultInstructions:
    def test_creative_strategist_instruction(self):
        inst = build_default_assignment_instruction("creative_strategist", _make_round_input())
        assert "alternative approaches" in inst.lower()

    def test_code_implementer_instruction(self):
        inst = build_default_assignment_instruction("code_implementer", _make_round_input("Build login"))
        assert "Build login" in inst

    def test_skeptic_reviewer_instruction(self):
        inst = build_default_assignment_instruction("skeptic_reviewer", _make_round_input())
        assert "failure" in inst.lower()

    def test_context_curator_instruction(self):
        inst = build_default_assignment_instruction("context_curator", _make_round_input())
        assert "token" in inst.lower()

    def test_executor_liaison_instruction(self):
        inst = build_default_assignment_instruction("executor_liaison", _make_round_input())
        assert "execution" in inst.lower() or "Codex" in inst

    def test_unknown_position_fallback(self):
        inst = build_default_assignment_instruction("unknown_role", _make_round_input("Do X"))
        assert "Do X" in inst


class TestSummarizeOutputs:
    def test_summarizes_outputs(self):
        outputs = [
            _make_output("a1", "Use Redis for caching"),
            _make_output("a2", "Use Memcached instead"),
        ]
        result = summarize_specialist_outputs(outputs)
        assert len(result) == 2
        assert result[0]["agent_id"] == "a1"
        assert len(result[0]["claim"]) <= 180


class TestCoordinatorOutput:
    def test_builds_coordinator_output(self):
        outputs = [
            _make_output("a1", "Build with React"),
            _make_output("a2", "Build with Vue"),
        ]
        coord = build_coordinator_output(
            round_number=1,
            outputs=outputs,
            previous_summary="",
            user_feedback="",
        )
        assert coord.round_number == 1
        assert len(coord.what_each_agent_found) == 2
        assert len(coord.common_ground) > 0
        assert coord.coordinator_decision != ""
        assert coord.confidence > 0

    def test_user_feedback_with_execute_triggers_codex(self):
        outputs = [_make_output("a1", "Plan A")]
        coord = build_coordinator_output(
            round_number=1,
            outputs=outputs,
            previous_summary="",
            user_feedback="please execute this plan",
        )
        assert coord.recommended_next_action == "export_to_codex"

    def test_confidence_is_average(self):
        outputs = [
            _make_output("a1", "X"),
            _make_output("a2", "Y"),
        ]
        # confidence is 0.8 each, average = 0.8
        coord = build_coordinator_output(1, outputs, "", "")
        assert coord.confidence == 0.8


class TestDecisionState:
    def test_final_triggers_ready(self):
        outputs = [_make_output("a1", "X")]
        coord = build_coordinator_output(1, outputs, "", "")
        coord.coordinator_decision = "Final answer: use Plan A"
        assert infer_decision_state(coord) == DecisionState.READY_TO_EXECUTE

    def test_conflicts_trigger_conflicting(self):
        outputs = [_make_output("a1", "X")]
        coord = build_coordinator_output(1, outputs, "", "")
        coord.conflicts = ["Major disagreement"]
        assert infer_decision_state(coord) == DecisionState.CONFLICTING

    def test_no_conflicts_triggers_converging(self):
        outputs = [_make_output("a1", "X")]
        coord = build_coordinator_output(1, outputs, "", "")
        coord.conflicts = []
        assert infer_decision_state(coord) == DecisionState.CONVERGING


class TestExecutionReadiness:
    def test_export_to_codex(self):
        outputs = [_make_output("a1", "X")]
        coord = build_coordinator_output(1, outputs, "", "execute")
        assert infer_execution_readiness(coord) == ExecutionReadiness.CODEX_READY

    def test_continue_panel_is_draft_ready(self):
        outputs = [_make_output("a1", "X")]
        coord = build_coordinator_output(1, outputs, "", "")
        assert infer_execution_readiness(coord) == ExecutionReadiness.DRAFT_READY
