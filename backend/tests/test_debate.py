from __future__ import annotations

from backend.core.debate import (
    build_final_answer,
    evaluate_stop_condition,
    run_debate_round,
)
from backend.core.session import session_store
from backend.schemas import AgentConfig, AgentResponse, MessageState, Mode, SharedBrief


def _make_config(name: str, role: str = "expert") -> AgentConfig:
    return AgentConfig(name=name, provider="mock", role=role)


def _make_response(name: str, claim: str, round_number: int = 1) -> AgentResponse:
    return AgentResponse(
        agent_name=name,
        provider="mock",
        role="expert",
        round_number=round_number,
        claim=claim,
        reasoning=f"{name} reasoning",
        risks=[],
        objections=[],
        confidence=0.7,
        suggested_next_step="Continue.",
        state=MessageState.PUBLISHED,
    )


class TestDebateRound:
    def test_single_round_produces_responses(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="Find best approach",
            agents=[_make_config("Agent A"), _make_config("Agent B")],
            max_rounds=3,
            budget_tokens=6000,
        )
        responses, brief = run_debate_round(session, use_shared_brief=False)
        assert len(responses) == 2
        assert session.round_number == 1
        assert isinstance(brief, SharedBrief)
        assert len(session.shared_briefs) == 1

    def test_responses_published_then_briefed(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="Test",
            agents=[_make_config("A")],
            max_rounds=1,
            budget_tokens=1000,
        )
        responses, _ = run_debate_round(session, use_shared_brief=False)
        assert responses[0].state == MessageState.BRIEFED

    def test_subsequent_round_uses_shared_brief(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="Test",
            agents=[_make_config("A")],
            max_rounds=3,
            budget_tokens=1000,
        )
        run_debate_round(session, use_shared_brief=False)
        responses, _ = run_debate_round(session, use_shared_brief=True)
        assert session.round_number == 2
        assert len(responses) == 1


class TestStopCondition:
    def test_stops_at_max_rounds(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="X",
            agents=[_make_config("A")],
            max_rounds=1,
            budget_tokens=100,
        )
        session.round_number = 3
        responses = [_make_response("A", "claim")]
        stop, reason = evaluate_stop_condition(session, responses)
        assert stop
        assert "maximum" in reason.lower()

    def test_stops_on_consensus(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="X",
            agents=[_make_config("A"), _make_config("B")],
            max_rounds=3,
            budget_tokens=100,
        )
        responses = [
            _make_response("A", "same claim"),
            _make_response("B", "same claim"),
        ]
        stop, reason = evaluate_stop_condition(session, responses)
        assert stop
        assert "majority" in reason.lower()

    def test_continues_on_disagreement(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="X",
            agents=[_make_config("A"), _make_config("B")],
            max_rounds=5,
            budget_tokens=100,
        )
        responses = [
            _make_response("A", "option one", round_number=2),
            _make_response("B", "option two", round_number=2),
        ]
        session.round_number = 2
        # Need a shared brief with conflicts for the "no conflict" check
        brief = SharedBrief(
            round_number=1,
            each_agent_position=responses,
            conflicts=["Disagreement on approach"],
            open_questions=["What to do?"],
            suggested_next_step="Debate more.",
        )
        session.shared_briefs.append(brief)
        stop, reason = evaluate_stop_condition(session, responses)
        assert not stop


class TestFinalAnswer:
    def test_builds_final_answer(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="Build a REST API",
            agents=[_make_config("A")],
            max_rounds=3,
            budget_tokens=100,
        )
        resp = _make_response("A", "Use FastAPI")
        brief = SharedBrief(
            round_number=1,
            each_agent_position=[resp],
            common_ground=["Python is the right choice"],
            conflicts=[],
            open_questions=["Which framework?"],
            suggested_next_step="Start implementation.",
        )
        session.shared_briefs.append(brief)
        answer = build_final_answer(session)
        assert "FastAPI" in answer
        assert session.status == "completed"
        assert session.final_answer is not None

    def test_empty_briefs_returns_placeholder(self):
        session = session_store.create(
            mode=Mode.DEBATE,
            user_goal="X",
            agents=[_make_config("A")],
            max_rounds=1,
            budget_tokens=100,
        )
        answer = build_final_answer(session)
        assert "No debate brief" in answer
