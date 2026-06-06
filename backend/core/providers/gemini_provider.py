from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class GeminiProvider(OpenAICompatibleCouncilProvider):
    provider_name = "gemini"
    default_base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
    default_model = "gemini-1.5-flash"
    default_env_name = "GEMINI_API_KEY"
