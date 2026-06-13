from __future__ import annotations

import os

from backend.schemas import Credential


class CredentialStore:
    def __init__(self) -> None:
        self._credentials: dict[str, Credential] = {}
        self._seed_defaults()

    def _seed_defaults(self) -> None:
        defaults = [
            Credential(
                credential_id="mock_default",
                provider="mock",
                name="mock-default",
                api_key_env_name="MOCK_API_KEY",
                default_model="mock-gpt",
                enabled=True,
                key_available=True,
            ),
            Credential(
                credential_id="openai_key_1",
                provider="openai",
                name="openai-main",
                api_key_env_name="OPENAI_API_KEY_1",
                default_model="gpt-4.1",
                enabled=True,
            ),
            Credential(
                credential_id="claude_key_1",
                provider="claude",
                name="claude-main",
                api_key_env_name="CLAUDE_API_KEY_1",
                default_model="claude-3.5-sonnet",
                enabled=True,
            ),
            Credential(
                credential_id="deepseek_key_1",
                provider="deepseek",
                name="deepseek-main",
                api_key_env_name="DEEPSEEK_API_KEY_1",
                default_model="deepseek-chat",
                enabled=True,
            ),
            Credential(
                credential_id="deepseek_key_2",
                provider="deepseek",
                name="deepseek-backup",
                api_key_env_name="DEEPSEEK_API_KEY_2",
                default_model="deepseek-chat",
                enabled=True,
            ),
            Credential(
                credential_id="gemini_key_1",
                provider="gemini",
                name="gemini-main",
                api_key_env_name="GEMINI_API_KEY_1",
                default_model="gemini-1.5-pro",
                enabled=True,
            ),
            Credential(
                credential_id="qwen_key_1",
                provider="qwen",
                name="qwen-main",
                api_key_env_name="QWEN_API_KEY_1",
                default_model="qwen-plus",
                enabled=True,
            ),
            Credential(
                credential_id="openrouter_key_1",
                provider="openrouter",
                name="openrouter-main",
                api_key_env_name="OPENROUTER_API_KEY_1",
                default_model="openrouter/auto",
                enabled=True,
            ),
            Credential(
                credential_id="newapi_key_1",
                provider="newapi",
                name="newapi-main",
                api_key_env_name="NEWAPI_API_KEY_1",
                default_model="gpt-4.1",
                enabled=True,
            ),
            Credential(
                credential_id="ccswitch_key_1",
                provider="ccswitch",
                name="ccswitch-main",
                api_key_env_name="CCSWITCH_API_KEY_1",
                default_model="gpt-5.5",
                enabled=True,
            ),
        ]
        self._credentials = {item.credential_id: item for item in defaults}
        self.reload()

    def list(self) -> list[Credential]:
        return list(self._credentials.values())

    def get(self, credential_id: str) -> Credential:
        credential = self._credentials.get(credential_id)
        if credential is None:
            raise KeyError(f"Unknown credential_id: {credential_id}")
        return credential

    def set_runtime_key(self, credential_id: str, api_key: str, env_name: str | None = None) -> Credential:
        credential = self.get(credential_id)
        target_env = (env_name or credential.api_key_env_name).strip()
        if not target_env or not target_env.replace("_", "").isalnum():
            raise ValueError("invalid_env_name")
        credential.api_key_env_name = target_env
        if api_key.strip():
            os.environ[target_env] = api_key.strip()
            credential.key_available = True
        else:
            os.environ.pop(target_env, None)
            credential.key_available = False
        return credential

    def upsert_runtime(
        self,
        *,
        credential_id: str,
        provider: str,
        name: str,
        env_name: str,
        api_key: str,
        default_model: str = "",
        base_url: str = "",
    ) -> Credential:
        credential = self._credentials.get(credential_id)
        if credential is None:
            credential = Credential(
                credential_id=credential_id,
                provider=provider,
                name=name,
                api_key_env_name=env_name,
                base_url=base_url or None,
                default_model=default_model or None,
                enabled=True,
            )
            self._credentials[credential_id] = credential
        else:
            credential.provider = provider
            credential.name = name
            credential.base_url = base_url or None
            credential.default_model = default_model or None
            credential.enabled = True
        return self.set_runtime_key(credential_id, api_key, env_name)

    def reload(self) -> list[Credential]:
        for credential in self._credentials.values():
            if credential.provider == "mock":
                credential.key_available = True
            else:
                value = os.getenv(credential.api_key_env_name, "")
                credential.key_available = bool(value.strip())
        return self.list()


credential_store = CredentialStore()
