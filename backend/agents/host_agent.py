from __future__ import annotations

from typing import Any

from backend.agents.mock_agent import MockAgent
from backend.schemas import HostDecision


class HostAgent(MockAgent):
    """Host agent acts as room admin and suggests when to invite specialists."""

    def answer_user_message(self, prompt: str, context: dict[str, Any] | None = None) -> HostDecision:
        context = context or {}
        summary = context.get("context_summary", "No prior room summary.")
        prompt_lower = prompt.lower()

        expert_map = {
            "review": ["Mock Claude", "Mock DeepSeek"],
            "bug": ["Mock Claude"],
            "debug": ["Mock Claude", "Mock DeepSeek"],
            "security": ["Mock Claude"],
            "implement": ["Mock DeepSeek"],
            "architecture": ["Mock Claude", "Mock DeepSeek"],
            "performance": ["Mock DeepSeek"],
        }

        suggested_experts: list[str] = []
        for keyword, experts in expert_map.items():
            if keyword in prompt_lower:
                suggested_experts.extend(experts)
        suggested_experts = list(dict.fromkeys(suggested_experts))
        need_expert = bool(suggested_experts)

        reason = (
            "当前问题涉及多视角评估，建议邀请外援，但系统不会自动调用。"
            if need_expert
            else "当前问题可先由 Host 独立推进，更节省 token。"
        )
        next_actions = (
            [f"Ask {name}" for name in suggested_experts] + ["Continue alone"]
            if need_expert
            else ["Continue alone", "Ask Another AI", "Compact Context"]
        )
        answer = f"{self.name} 先继续处理当前任务：{prompt[:160]}。当前上下文摘要：{summary[:180]}"
        return HostDecision(
            answer=answer,
            need_expert_suggestion=need_expert,
            suggested_experts=suggested_experts,
            reason=reason,
            next_actions=next_actions,
        )
