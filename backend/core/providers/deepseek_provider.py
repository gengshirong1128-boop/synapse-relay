from __future__ import annotations

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class DeepSeekProvider(OpenAICompatibleCouncilProvider):
    provider_name = "deepseek"
    default_base_url = "https://api.deepseek.com"
    default_model = "deepseek-chat"
    default_env_name = "DEEPSEEK_API_KEY"
