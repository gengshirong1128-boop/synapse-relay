from __future__ import annotations

from backend.core.agent_factory import (
    build_agent_from_config,
    build_agent_from_member,
    _compose_system_prompt,
)
from backend.agents.base import BaseAgent
from backend.agents.host_agent import HostAgent
from backend.agents.mock_agent import MockAgent
from backend.schemas import AgentConfig, AgentMember, AgentRole, AgentStatus


class TestComposeSystemPrompt:
    def test_includes_position_and_persona(self):
        result = _compose_system_prompt("Architect", "Focus on system design.", "claim/reasoning")
        assert "Architect" in result
        assert "system design" in result
        assert "claim/reasoning" in result
        assert "Synapse Relay" in result

    def test_empty_persona(self):
        result = _compose_system_prompt("Coder", "", "json")
        assert "No extra persona" in result


class TestBuildAgentFromConfig:
    def test_host_role_returns_host_agent(self):
        config = AgentConfig(name="Host", provider="mock", role="host")
        agent = build_agent_from_config(config)
        assert isinstance(agent, HostAgent)

    def test_expert_role_returns_mock_without_profile(self):
        config = AgentConfig(name="Expert", provider="mock", role="expert")
        agent = build_agent_from_config(config)
        assert isinstance(agent, MockAgent)

    def test_agent_has_correct_attributes(self):
        config = AgentConfig(name="TestAgent", provider="mock", role="expert")
        agent = build_agent_from_config(config)
        assert agent.name == "TestAgent"
        assert agent.provider == "mock"
        assert agent.role == "expert"


class TestBuildAgentFromMember:
    def _make_member(self, **overrides) -> AgentMember:
        from datetime import datetime

        defaults = {
            "agent_id": "test_agent_1",
            "name": "Test Agent",
            "display_name": "Test Agent",
            "provider": "mock",
            "model": "mock-gpt",
            "credential_id": "mock_default",
            "role": AgentRole.EXPERT,
            "position_id": "domain_expert",
            "position_name": "Domain Expert",
            "persona": "A test agent.",
            "joined_at": datetime(2025, 1, 1),
        }
        defaults.update(overrides)
        return AgentMember(**defaults)

    def test_mock_provider_returns_mock_agent(self):
        member = self._make_member(provider="mock")
        agent = build_agent_from_member(member)
        assert isinstance(agent, (MockAgent, HostAgent))

    def test_agent_inherits_member_name(self):
        member = self._make_member(display_name="Custom Name")
        agent = build_agent_from_member(member)
        assert agent.name == "Custom Name"

    def test_host_role_returns_host_agent(self):
        member = self._make_member(role=AgentRole.HOST)
        agent = build_agent_from_member(member)
        assert isinstance(agent, HostAgent)

    def test_agent_has_base_methods(self):
        member = self._make_member()
        agent = build_agent_from_member(member)
        assert isinstance(agent, BaseAgent)
        result = agent.call_model("Hello")
        assert "claim" in result
        assert "reasoning" in result
        assert "confidence" in result
