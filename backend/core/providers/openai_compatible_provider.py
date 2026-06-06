from __future__ import annotations

import time
from typing import Any

import httpx

from backend.core.council_models import Conversation, Message, Minister, MinisterOpinion, Verdict, now_iso
from backend.core.credentials import credential_store
from backend.core.provider_profiles import provider_profile_store


class OpenAICompatibleCouncilProvider:
    provider_name = "openai"
    default_base_url = "https://api.openai.com/v1"
    default_model = "gpt-4o-mini"
    default_env_name = "OPENAI_API_KEY"

    def _resolve_config(self, minister: Minister | None = None, model: str | None = None) -> dict[str, Any]:
        profile = None
        credential = None
        profile_id = getattr(minister, "apiProfileId", "") if minister else ""
        if profile_id:
            try:
                profile = provider_profile_store.get(profile_id)
                credential = credential_store.get(profile.credential_id)
            except KeyError:
                profile = None
                credential = None

        credential_store.reload()
        env_name = (
            profile.auth_env_name
            if profile and profile.auth_env_name
            else credential.api_key_env_name if credential else self.default_env_name
        )
        profile_model = profile.default_model if profile and profile.default_model else ""
        minister_model = getattr(minister, "model", "") if minister else ""
        if minister_model.startswith("mock-"):
            minister_model = ""
        resolved_model = model or profile_model or minister_model or self.default_model
        return {
            "base_url": (profile.base_url if profile and profile.base_url else self.default_base_url).rstrip("/"),
            "model": resolved_model,
            "env_name": env_name,
            "timeout_seconds": int(profile.timeout_seconds if profile else 35),
            "headers": profile.headers if profile else {},
            "extra_body": profile.extra_body if profile else {},
        }

    def _api_key(self, env_name: str) -> str:
        import os

        return os.getenv(env_name, "").strip()

    def _request(self, *, messages: list[dict[str, str]], config: dict[str, Any], max_tokens: int) -> str:
        api_key = self._api_key(config["env_name"])
        if not api_key:
            raise RuntimeError("missing_api_key")

        body = {
            "model": config["model"],
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": max_tokens,
        }
        body.update(config.get("extra_body") or {})
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            **(config.get("headers") or {}),
        }
        with httpx.Client(timeout=max(config["timeout_seconds"], 5)) as client:
            response = client.post(f"{config['base_url']}/chat/completions", headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
        return str(data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()

    def _error_text(self, error: Exception) -> str:
        message = str(error)
        if "missing_api_key" in message:
            return "missing_api_key"
        if isinstance(error, httpx.HTTPStatusError):
            status_code = error.response.status_code
            if status_code in {401, 403}:
                return "invalid_api_key"
            return f"provider_http_{status_code}"
        if isinstance(error, httpx.TimeoutException):
            return "provider_timeout"
        if isinstance(error, httpx.NetworkError):
            return "provider_network_error"
        return message[:160] or "provider_call_failed"

    def test_connection(self, prompt: str = "Respond with: provider test ok", model: str | None = None) -> dict[str, Any]:
        config = self._resolve_config(model=model)
        started = time.perf_counter()
        try:
            content = self._request(
                messages=[
                    {"role": "system", "content": "You are a provider connectivity tester. Reply briefly."},
                    {"role": "user", "content": prompt},
                ],
                config=config,
                max_tokens=80,
            )
            return {
                "success": bool(content),
                "fallback_to_mock": False,
                "latency_ms": int((time.perf_counter() - started) * 1000),
                "model": config["model"],
                "message": content[:300],
            }
        except Exception as exc:  # noqa: BLE001
            error = self._error_text(exc)
            return {
                "success": False,
                "fallback_to_mock": error == "missing_api_key",
                "latency_ms": int((time.perf_counter() - started) * 1000),
                "model": config["model"],
                "error": error,
            }

    def generate_opinion(
        self,
        *,
        minister: Minister,
        memorial: Message,
        conversation: Conversation,
        context: dict,
    ) -> MinisterOpinion:
        config = self._resolve_config(minister)
        messages = [
            {
                "role": "system",
                "content": minister.systemPrompt or f"你是{minister.title}，请基于职务职责给出简明会审意见。",
            },
            {
                "role": "user",
                "content": f"奏折：{memorial.content}\n请输出你的会审意见。",
            },
        ]
        try:
            content = self._request(messages=messages, config=config, max_tokens=900)
            if not content:
                raise RuntimeError("empty_content")
            status = "done"
        except Exception as exc:  # noqa: BLE001
            content = f"{minister.title}调用失败：{self._error_text(exc)}"
            status = "error"
        return MinisterOpinion(
            id=f"op_{minister.id}_{now_iso()}",
            conversationId=conversation.id,
            messageId=memorial.id,
            ministerId=minister.id,
            content=content,
            status=status,  # type: ignore[arg-type]
            createdAt=now_iso(),
        )

    def generate_verdict(
        self,
        *,
        chief_minister: Minister,
        memorial: Message,
        opinions: list[MinisterOpinion],
        conversation: Conversation,
    ) -> Verdict:
        config = self._resolve_config(chief_minister)
        opinion_text = "\n".join(f"- {item.content}" for item in opinions)
        messages = [
            {
                "role": "system",
                "content": chief_minister.systemPrompt or "你是首辅，请综合诸臣意见给出朱批结论。",
            },
            {
                "role": "user",
                "content": f"奏折：{memorial.content}\n诸臣奏议：\n{opinion_text}\n请给出朱批结论。",
            },
        ]
        try:
            content = self._request(messages=messages, config=config, max_tokens=700)
            if not content:
                raise RuntimeError("empty_content")
            decision = "approved"
        except Exception as exc:  # noqa: BLE001
            content = f"朱批生成失败：{self._error_text(exc)}"
            decision = "reconsider"
        return Verdict(
            id=f"verdict_{conversation.id}_{len(conversation.messages)}",
            conversationId=conversation.id,
            messageId=memorial.id,
            content=content,
            decision=decision,  # type: ignore[arg-type]
            createdAt=now_iso(),
        )
