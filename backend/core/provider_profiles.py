from __future__ import annotations

import json
import os
from pathlib import Path

from backend.config import ROOT_DIR
from backend.schemas import ProviderProfile, ProviderProfileCreateRequest, ProviderProfilePatchRequest


DATA_DIR = Path(os.getenv("NEIGE_DATA_DIR", ROOT_DIR / ".synapse" / "runtime"))


class ProviderProfileStore:
    def __init__(self) -> None:
        self._profiles: dict[str, ProviderProfile] = {}
        self._seed_defaults()
        self._load()

    @property
    def _path(self) -> Path:
        return DATA_DIR / "provider_profiles.json"

    def _load(self) -> None:
        path = self._path
        if not path.exists():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(raw, list):
            return
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                profile = ProviderProfile(**item)
            except Exception:  # noqa: BLE001
                continue
            self._profiles[profile.profile_id] = profile

    def _save(self) -> None:
        path = self._path
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = [item.model_dump(mode="json") for item in self.list()]
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def _seed_defaults(self) -> None:
        defaults = [
            ProviderProfile(
                profile_id="mock_default_profile",
                name="Mock Default",
                provider="mock",
                api_format="mock",
                base_url=None,
                default_model="mock-gpt",
                models=["mock-gpt", "mock-claude", "mock-deepseek", "mock-codex"],
                credential_id="mock_default",
                enabled=True,
                target_apps=["synapse", "generic_cli"],
                stream_supported=False,
                tool_call_supported=False,
                notes="Local mock profile.",
            ),
            ProviderProfile(
                profile_id="openai_default_profile",
                name="OpenAI Default",
                provider="openai",
                api_format="openai_compatible",
                base_url="https://api.openai.com/v1",
                default_model="gpt-4.1",
                models=["gpt-4.1", "gpt-4o-mini"],
                credential_id="openai_key_1",
                enabled=True,
                target_apps=["synapse", "codex", "generic_cli"],
                stream_supported=True,
                tool_call_supported=True,
                notes="OpenAI-compatible endpoint.",
            ),
            ProviderProfile(
                profile_id="deepseek_default_profile",
                name="DeepSeek Main",
                provider="deepseek",
                api_format="openai_compatible",
                base_url="https://api.deepseek.com/v1",
                default_model="deepseek-chat",
                models=["deepseek-chat", "deepseek-reasoner"],
                credential_id="deepseek_key_1",
                enabled=True,
                target_apps=["synapse", "codex", "generic_cli"],
                stream_supported=True,
                tool_call_supported=False,
                notes="DeepSeek OpenAI-compatible endpoint.",
            ),
            ProviderProfile(
                profile_id="claude_default_profile",
                name="Claude Main",
                provider="claude",
                api_format="anthropic",
                base_url="https://api.anthropic.com",
                default_model="claude-3.5-sonnet",
                models=["claude-3.5-sonnet", "claude-3-7-sonnet-latest"],
                credential_id="claude_key_1",
                enabled=True,
                target_apps=["synapse", "claude_code", "generic_cli"],
                stream_supported=True,
                tool_call_supported=True,
                auth_env_name="ANTHROPIC_API_KEY",
                notes="Anthropic endpoint.",
            ),
            ProviderProfile(
                profile_id="openrouter_default_profile",
                name="OpenRouter Main",
                provider="openrouter",
                api_format="openrouter",
                base_url="https://openrouter.ai/api/v1",
                default_model="openrouter/auto",
                models=["openrouter/auto", "openai/gpt-4.1"],
                credential_id="openrouter_key_1",
                enabled=True,
                target_apps=["synapse", "codex", "generic_cli"],
                stream_supported=True,
                tool_call_supported=True,
                notes="OpenRouter OpenAI-compatible endpoint.",
            ),
            ProviderProfile(
                profile_id="newapi_default_profile",
                name="NewAPI Main",
                provider="newapi",
                api_format="newapi",
                base_url="https://api.newapi.ai/v1",
                default_model="gpt-4.1",
                models=["gpt-4.1", "gpt-4o-mini"],
                credential_id="newapi_key_1",
                enabled=True,
                target_apps=["synapse", "codex", "generic_cli"],
                stream_supported=True,
                tool_call_supported=True,
                notes="Custom OpenAI-compatible bridge endpoint.",
            ),
            ProviderProfile(
                profile_id="ccswitch_default_profile",
                name="CC Switch Local Routing",
                provider="ccswitch",
                api_format="openai_compatible",
                base_url="http://127.0.0.1:15721/v1",
                default_model="gpt-5.5",
                models=["gpt-5.5", "gpt-5", "gpt-4o", "claude-sonnet-4", "deepseek-chat"],
                credential_id="ccswitch_key_1",
                enabled=True,
                target_apps=["synapse", "codex", "claude_code", "generic_cli"],
                stream_supported=True,
                tool_call_supported=True,
                auth_env_name="CCSWITCH_API_KEY_1",
                notes="CC Switch local routing proxy. Start CC Switch proxy and enable Codex routing.",
            ),
            ProviderProfile(
                profile_id="gemini_default_profile",
                name="Gemini Main",
                provider="gemini",
                api_format="gemini",
                base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                default_model="gemini-1.5-pro",
                models=["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
                credential_id="gemini_key_1",
                enabled=True,
                target_apps=["synapse", "generic_cli"],
                stream_supported=True,
                tool_call_supported=False,
                notes="Google Gemini OpenAI-compatible endpoint.",
            ),
            ProviderProfile(
                profile_id="qwen_default_profile",
                name="Qwen Main",
                provider="qwen",
                api_format="qwen",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                default_model="qwen-plus",
                models=["qwen-plus", "qwen-max", "qwen-turbo"],
                credential_id="qwen_key_1",
                enabled=True,
                target_apps=["synapse", "generic_cli"],
                stream_supported=True,
                tool_call_supported=False,
                notes="Alibaba Qwen (DashScope) OpenAI-compatible endpoint.",
            ),
        ]
        self._profiles = {item.profile_id: item for item in defaults}

    def list(self) -> list[ProviderProfile]:
        return list(self._profiles.values())

    def get(self, profile_id: str) -> ProviderProfile:
        profile = self._profiles.get(profile_id)
        if profile is None:
            raise KeyError(f"Unknown profile_id: {profile_id}")
        return profile

    def create(self, request: ProviderProfileCreateRequest) -> ProviderProfile:
        if request.profile_id in self._profiles:
            raise ValueError(f"profile_id already exists: {request.profile_id}")
        profile = ProviderProfile(**request.model_dump())
        self._profiles[profile.profile_id] = profile
        self._save()
        return profile

    def patch(self, profile_id: str, request: ProviderProfilePatchRequest) -> ProviderProfile:
        profile = self.get(profile_id)
        payload = request.model_dump(exclude_none=True)
        for key, value in payload.items():
            setattr(profile, key, value)
        self._save()
        return profile

    def delete(self, profile_id: str) -> None:
        if profile_id in self._profiles:
            del self._profiles[profile_id]
            self._save()


provider_profile_store = ProviderProfileStore()
