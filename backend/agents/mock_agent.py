from __future__ import annotations

from typing import Any

from backend.agents.base import BaseAgent


class MockAgent(BaseAgent):
    """Simple deterministic agent used to validate the orchestration flow."""

    def __init__(self, name: str, provider: str, role: str, system_prompt: str = "") -> None:
        super().__init__(name=name, provider=provider, role=role)
        self.system_prompt = system_prompt

    ROLE_STYLES = {
        "planner": "focuses on structure and decomposition",
        "critic": "focuses on risks and edge cases",
        "builder": "focuses on implementation feasibility",
        "researcher": "focuses on alternatives and tradeoffs",
    }

    def _style(self) -> str:
        return self.ROLE_STYLES.get(self.role, "focuses on balanced reasoning")

    def call_model(self, prompt: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        task = prompt.strip()
        context = context or {}
        previous = context.get("shared_brief_summary") or context.get("context_summary") or "No prior summary."
        claim = f"{self.name} recommends a pragmatic next step for: {task[:120]}"
        reasoning = (
            f"As a mock {self.provider} agent, {self.name} {self._style()}. "
            f"It uses prior context: {previous[:160]}"
        )
        if self.system_prompt:
            reasoning = f"{reasoning} | Prompt profile: {self.system_prompt[:120]}"
        risks = [
            "Mock output may oversimplify hidden implementation details.",
            "Real provider behavior can diverge once live APIs are connected.",
        ]
        objections = [
            "The plan should be validated against real constraints before production use."
        ]
        return {
            "claim": claim,
            "reasoning": reasoning,
            "risks": risks,
            "objections": objections,
            "confidence": 0.72,
            "suggested_next_step": "Turn the strongest claim into a concrete implementation task.",
        }

    def summarize_context(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        last_messages = messages[-3:]
        summary = " | ".join(
            f"{item.get('agent_name', 'user')}: {item.get('content', '')[:80]}" for item in last_messages
        )
        return {
            "summary": summary or "No context available yet.",
            "attempts": [item.get("content", "")[:80] for item in last_messages if item.get("type") != "user"],
        }

    def critique(self, shared_brief: dict[str, Any]) -> dict[str, Any]:
        open_questions = shared_brief.get("open_questions", [])
        conflicts = shared_brief.get("conflicts", [])
        claim = f"{self.name} refines the current direction with emphasis on {self.role}."
        reasoning = (
            f"Reads shared brief, sees {len(conflicts)} conflicts and {len(open_questions)} open questions. "
            f"Suggests reducing ambiguity before the next implementation step."
        )
        return {
            "claim": claim,
            "reasoning": reasoning,
            "risks": ["The group may converge too early without testing assumptions."],
            "objections": conflicts[:2] or ["No major objection in this round."],
            "confidence": 0.68,
            "suggested_next_step": shared_brief.get(
                "suggested_next_step",
                "Clarify the highest-impact disagreement and continue the debate.",
            ),
        }

    def vote(self, final_options: list[str]) -> dict[str, Any]:
        winner = final_options[0] if final_options else "No option provided."
        return {
            "selected_option": winner,
            "reason": f"{self.name} prefers the option with the clearest execution path.",
            "confidence": 0.7,
        }
