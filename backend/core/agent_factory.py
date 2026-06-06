from __future__ import annotations

from backend.agents.claude_agent import ClaudeAgent
from backend.agents.host_agent import HostAgent
from backend.agents.mock_agent import MockAgent
from backend.agents.openai_compatible_agent import OpenAICompatibleAgent
from backend.core.credentials import credential_store
from backend.core.provider_profiles import provider_profile_store
from backend.schemas import AgentConfig, AgentInstance, AgentMember, AgentRole


BASE_ROOM_RULES = (
    "You are collaborating in Synapse Relay. Keep outputs structured, concise, and task-focused. "
    "Do not reveal secrets. Respect minimal-change constraints."
)

ROUND_RULES = (
    "Round rules: specialists must reason independently on shared round input. "
    "Coordinator reads specialist outputs only after they are published and summarizes last."
)


def _compose_system_prompt(position_name: str, persona: str, output_schema: str) -> str:
    sections = [
        BASE_ROOM_RULES,
        f"Position prompt: {position_name}",
        f"Persona: {persona or 'No extra persona.'}",
        f"Output schema guidance: {output_schema}",
        ROUND_RULES,
    ]
    return "\n".join(sections)


def _default_profile_for_provider(provider: str):
    profiles = provider_profile_store.list()
    for profile in profiles:
        if profile.provider == provider and profile.enabled:
            return profile
    return None


def _build_runtime_agent(
    name: str,
    provider: str,
    role: str,
    model: str,
    credential_id: str,
    profile_id: str | None,
    system_prompt: str,
):
    profile = provider_profile_store.get(profile_id) if profile_id else _default_profile_for_provider(provider)
    if profile is None:
        if role == AgentRole.HOST.value:
            return HostAgent(name=name, provider="mock", role=role)
        return MockAgent(name=name, provider="mock", role=role, system_prompt=system_prompt)

    credential = credential_store.get(profile.credential_id if profile and not credential_id else credential_id)
    mapped_input_model = profile.model_mapping.get(model, model) if model else model
    model_name = mapped_input_model or profile.default_model or "mock-gpt"
    if profile.system_prompt_template:
        system_prompt = f"{profile.system_prompt_template}\n{system_prompt}".strip()

    if provider == "mock" or profile.api_format == "mock":
        if role == AgentRole.HOST.value:
            return HostAgent(name=name, provider="mock", role=role)
        return MockAgent(name=name, provider="mock", role=role, system_prompt=system_prompt)

    if profile.api_format == "anthropic" or provider == "claude":
        return ClaudeAgent(
            name=name,
            provider=provider,
            role=role,
            model=model_name,
            api_key_env_name=credential.api_key_env_name,
            base_url=profile.base_url or "https://api.anthropic.com",
            system_prompt=system_prompt,
            headers=profile.headers,
            extra_body=profile.extra_body,
            model_mapping=profile.model_mapping,
            timeout_seconds=profile.timeout_seconds,
            max_retries=profile.max_retries,
        )

    if profile.api_format in {"openai_compatible", "openrouter", "newapi", "qwen", "gemini"} or provider in {
        "openai",
        "deepseek",
        "openrouter",
        "newapi",
        "qwen",
        "gemini",
    }:
        return OpenAICompatibleAgent(
            name=name,
            provider=provider,
            role=role,
            model=model_name,
            base_url=profile.base_url or "https://api.openai.com/v1",
            api_key_env_name=credential.api_key_env_name,
            system_prompt=system_prompt,
            headers=profile.headers,
            extra_body=profile.extra_body,
            model_mapping=profile.model_mapping,
            timeout_seconds=profile.timeout_seconds,
            max_retries=profile.max_retries,
        )

    if role == AgentRole.HOST.value:
        return HostAgent(name=name, provider="mock", role=role)
    return MockAgent(name=name, provider="mock", role=role, system_prompt=system_prompt)


def build_agent_from_config(config: AgentConfig):
    if config.role == AgentRole.HOST.value:
        return HostAgent(name=config.name, provider=config.provider, role=config.role)
    profile = _default_profile_for_provider(config.provider)
    if profile is None:
        return MockAgent(name=config.name, provider=config.provider, role=config.role)
    return _build_runtime_agent(
        name=config.name,
        provider=config.provider,
        role=config.role,
        model=profile.default_model or "",
        credential_id="",
        profile_id=profile.profile_id,
        system_prompt="",
    )


def build_agent_from_member(member: AgentMember):
    system_prompt = _compose_system_prompt(
        position_name=member.position_name or member.position_id or "Domain Expert",
        persona=member.persona or "",
        output_schema="claim/reasoning/risks/objections/suggested_next_step/confidence",
    )
    return _build_runtime_agent(
        name=member.display_name or member.name,
        provider=member.provider,
        role=member.role.value,
        model=member.model or "",
        credential_id=member.credential_id or "mock_default",
        profile_id=member.profile_id,
        system_prompt=system_prompt,
    )


def build_agent_from_instance(instance: AgentInstance):
    system_prompt = _compose_system_prompt(
        position_name=instance.position_name,
        persona=instance.persona,
        output_schema="claim/reasoning/risks/objections/suggested_next_step/confidence",
    )
    return _build_runtime_agent(
        name=instance.display_name,
        provider=instance.provider,
        role=instance.role.value,
        model=instance.model,
        credential_id=instance.credential_id,
        profile_id=instance.profile_id,
        system_prompt=system_prompt,
    )
