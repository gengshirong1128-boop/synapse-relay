from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class OpenRouterProvider(OpenAICompatibleCouncilProvider):
    provider_name = "openrouter"
    default_base_url = "https://openrouter.ai/api/v1"
    default_model = "openrouter/auto"
    default_env_name = "OPENROUTER_API_KEY"
