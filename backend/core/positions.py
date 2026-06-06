from __future__ import annotations

from backend.schemas import PositionCustomCreateRequest, PositionTemplate


class PositionStore:
    def __init__(self) -> None:
        self._positions: dict[str, PositionTemplate] = {}
        self._seed_defaults()

    def _seed_defaults(self) -> None:
        defaults = [
            PositionTemplate(
                position_id="coordinator",
                display_name="Coordinator",
                description="Summarizes every round and assigns specialist tasks.",
                default_responsibilities=[
                    "Read all specialist outputs after they are published.",
                    "Summarize common ground and conflicts.",
                    "Assign next-round tasks and decide stop/continue.",
                ],
                default_system_prompt="You are the coordinator. You always speak last in each round.",
                default_round_order=99,
                output_schema={"type": "CoordinatorRoundOutput"},
                recommended_models=["claude-3.5-sonnet", "gpt-4.1", "deepseek-reasoner"],
                can_be_multiple=False,
            ),
            PositionTemplate(
                position_id="creative_strategist",
                display_name="Creative Strategist",
                description="Proposes diverse solution paths and highlights innovation.",
                default_responsibilities=["Generate multiple approaches.", "Highlight product differentiation."],
                default_system_prompt="Provide multiple ideas before locking a solution.",
                default_round_order=20,
                output_schema={"type": "SpecialistRoundOutput", "focus": "ideas"},
            ),
            PositionTemplate(
                position_id="code_implementer",
                display_name="Code Implementer",
                description="Turns strategy into concrete file-level changes and test steps.",
                default_responsibilities=["List files to edit.", "Give minimal implementation steps."],
                default_system_prompt="Focus on minimal viable implementation with test plan.",
                default_round_order=30,
                output_schema={"type": "SpecialistRoundOutput", "focus": "implementation"},
            ),
            PositionTemplate(
                position_id="skeptic_reviewer",
                display_name="Skeptic Reviewer",
                description="Challenges assumptions and identifies hidden risks.",
                default_responsibilities=["Find failure modes.", "Challenge weak assumptions."],
                default_system_prompt="Act as the strict reviewer. Prioritize risk discovery.",
                default_round_order=40,
                output_schema={"type": "SpecialistRoundOutput", "focus": "risk"},
            ),
            PositionTemplate(
                position_id="context_curator",
                display_name="Context Curator",
                description="Keeps only necessary context and controls token overhead.",
                default_responsibilities=["Propose compression points.", "Keep crucial continuity only."],
                default_system_prompt="Keep context compact while preserving continuity.",
                default_round_order=50,
                output_schema={"type": "SpecialistRoundOutput", "focus": "context"},
            ),
            PositionTemplate(
                position_id="executor_liaison",
                display_name="Executor Liaison",
                description="Converts the final plan into executable handoff prompts.",
                default_responsibilities=["Draft Codex/Claude Code prompt.", "List verification commands."],
                default_system_prompt="Produce execution-ready instructions for coding agents.",
                default_round_order=60,
                output_schema={"type": "SpecialistRoundOutput", "focus": "execution"},
            ),
            PositionTemplate(
                position_id="domain_expert",
                display_name="Domain Expert",
                description="User-defined expert role for specific knowledge domains.",
                default_responsibilities=["Provide domain-specific judgement."],
                default_system_prompt="Focus on domain expertise and practical recommendations.",
                default_round_order=35,
                output_schema={"type": "SpecialistRoundOutput", "focus": "domain"},
            ),
        ]
        self._positions = {item.position_id: item for item in defaults}

    def list(self) -> list[PositionTemplate]:
        return list(self._positions.values())

    def get(self, position_id: str) -> PositionTemplate:
        position = self._positions.get(position_id)
        if position is None:
            raise KeyError(f"Unknown position_id: {position_id}")
        return position

    def add_custom(self, request: PositionCustomCreateRequest) -> PositionTemplate:
        position = PositionTemplate(**request.model_dump())
        self._positions[position.position_id] = position
        return position


position_store = PositionStore()
