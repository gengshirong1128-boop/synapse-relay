from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class CustomProvider(OpenAICompatibleCouncilProvider):
    provider_name = "custom"
    default_base_url = "http://127.0.0.1:11434/v1"
    default_model = "local-model"
    default_env_name = "CUSTOM_API_KEY"
