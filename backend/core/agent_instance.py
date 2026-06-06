from __future__ import annotations

from datetime import datetime

from backend.core.provider_profiles import provider_profile_store
from backend.core.positions import position_store
from backend.schemas import (
    AgentInstance,
    AgentInstanceCreateRequest,
    AgentInstancePatchRequest,
    AgentRole,
    AgentStatus,
    AgentTemplate,
)


class AgentInstanceStore:
    def __init__(self) -> None:
        self._instances: dict[str, AgentInstance] = {}
        self._templates: list[AgentTemplate] = [
            AgentTemplate(
                template_id="mock_gpt",
                display_name="Mock GPT",
                provider="mock",
                model="mock-gpt",
                default_role=AgentRole.HOST,
                default_position_id="coordinator",
                description="Default host/coordinator mock model.",
            ),
            AgentTemplate(
                template_id="mock_claude",
                display_name="Mock Claude",
                provider="mock",
                model="mock-claude",
                default_role=AgentRole.EXPERT,
                default_position_id="skeptic_reviewer",
                description="Mock reviewer agent.",
            ),
            AgentTemplate(
                template_id="mock_deepseek",
                display_name="Mock DeepSeek",
                provider="mock",
                model="mock-deepseek",
                default_role=AgentRole.EXPERT,
                default_position_id="code_implementer",
                description="Mock implementation agent.",
            ),
            AgentTemplate(
                template_id="deepseek_chat",
                display_name="DeepSeek Chat",
                provider="deepseek",
                model="deepseek-chat",
                default_role=AgentRole.EXPERT,
                default_position_id="code_implementer",
                description="DeepSeek chat model template.",
            ),
            AgentTemplate(
                template_id="claude_sonnet",
                display_name="Claude Sonnet",
                provider="claude",
                model="claude-3.5-sonnet",
                default_role=AgentRole.EXPERT,
                default_position_id="coordinator",
                description="Anthropic Claude model template.",
            ),
            AgentTemplate(
                template_id="gpt_4_1",
                display_name="GPT-4.1",
                provider="openai",
                model="gpt-4.1",
                default_role=AgentRole.EXPERT,
                default_position_id="creative_strategist",
                description="OpenAI GPT-4.1 template.",
            ),
        ]

    def list_templates(self) -> list[AgentTemplate]:
        return self._templates

    def create(self, request: AgentInstanceCreateRequest) -> AgentInstance:
        now = datetime.utcnow()
        if request.agent_id in self._instances:
            raise ValueError(f"agent_id already exists: {request.agent_id}")

        position = position_store.get(request.position_id)
        role = request.role
        profile_id = request.profile_id
        if not profile_id:
            default_profile = next(
                (item.profile_id for item in provider_profile_store.list() if item.provider == request.provider and item.enabled),
                None,
            )
            profile_id = default_profile
        instance = AgentInstance(
            agent_id=request.agent_id,
            display_name=request.display_name,
            provider=request.provider,
            model=request.model,
            credential_id=request.credential_id,
            profile_id=profile_id,
            role=role,
            position_id=position.position_id,
            position_name=request.position_name or position.display_name,
            responsibilities=position.default_responsibilities,
            persona=request.persona,
            system_prompt=request.system_prompt or position.default_system_prompt,
            status=AgentStatus.ACTIVE,
            context_limit_tokens=request.context_limit_tokens,
            joined_at=now,
            last_active_at=now,
            round_order=position.default_round_order,
            can_receive_user_feedback=position.position_id == "coordinator",
            can_assign_tasks=position.position_id == "coordinator",
            can_finalize=position.position_id == "coordinator",
            reads_full_round_outputs=position.position_id == "coordinator",
            receives_task_from_coordinator=position.position_id != "coordinator",
        )
        self._instances[instance.agent_id] = instance
        return instance

    def list_instances(self) -> list[AgentInstance]:
        return list(self._instances.values())

    def get(self, agent_id: str) -> AgentInstance:
        instance = self._instances.get(agent_id)
        if instance is None:
            raise KeyError(f"Unknown agent_id: {agent_id}")
        return instance

    def patch(self, agent_id: str, request: AgentInstancePatchRequest) -> AgentInstance:
        instance = self.get(agent_id)
        payload = request.model_dump(exclude_none=True)
        for key, value in payload.items():
            setattr(instance, key, value)

        if request.position_id:
            position = position_store.get(request.position_id)
            instance.position_name = request.position_name or position.display_name
            instance.round_order = position.default_round_order
            instance.can_receive_user_feedback = position.position_id == "coordinator"
            instance.can_assign_tasks = position.position_id == "coordinator"
            instance.can_finalize = position.position_id == "coordinator"
            instance.reads_full_round_outputs = position.position_id == "coordinator"
            instance.receives_task_from_coordinator = position.position_id != "coordinator"
        if request.profile_id is not None:
            instance.profile_id = request.profile_id
        instance.last_active_at = datetime.utcnow()
        return instance


agent_instance_store = AgentInstanceStore()
