from __future__ import annotations

from backend.core.providers.anthropic_provider import AnthropicProvider
from backend.core.providers.custom_provider import CustomProvider
from backend.core.providers.deepseek_provider import DeepSeekProvider
from backend.core.providers.gemini_provider import GeminiProvider
from backend.core.providers.local_provider import LocalProvider
from backend.core.providers.mock_provider import MockProvider
from backend.core.providers.newapi_provider import NewAPIProvider
from backend.core.providers.openai_provider import OpenAIProvider
from backend.core.providers.openrouter_provider import OpenRouterProvider
from backend.core.providers.qwen_provider import QwenProvider
from backend.core.providers.web_ai_provider import WebAIProvider
from backend.core.providers.ccswitch_provider import CCSwitchProvider


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers = {
            "mock": MockProvider(),
            "openai": OpenAIProvider(),
            "anthropic": AnthropicProvider(),
            "claude": AnthropicProvider(),
            "deepseek": DeepSeekProvider(),
            "gemini": GeminiProvider(),
            "openrouter": OpenRouterProvider(),
            "newapi": NewAPIProvider(),
            "qwen": QwenProvider(),
            "local": LocalProvider(),
            "custom": CustomProvider(),
            "ccswitch": CCSwitchProvider(),
            "webai": WebAIProvider(),
            "web_ai": WebAIProvider(),
        }

    def get(self, provider: str):
        return self._providers.get((provider or "mock").lower(), self._providers["mock"])


provider_registry = ProviderRegistry()
