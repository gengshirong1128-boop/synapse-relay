from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class OpenAIProvider(OpenAICompatibleCouncilProvider):
    provider_name = "openai"
    default_base_url = "https://api.openai.com/v1"
    default_model = "gpt-4o-mini"
    default_env_name = "OPENAI_API_KEY"
