from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class NewAPIProvider(OpenAICompatibleCouncilProvider):
    provider_name = "newapi"
    default_base_url = "https://api.newapi.ai/v1"
    default_model = "gpt-4o-mini"
    default_env_name = "NEWAPI_API_KEY"
