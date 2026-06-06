from __future__ import annotations

import json
from typing import Any

import httpx

from backend.core.providers.openai_compatible_provider import OpenAICompatibleCouncilProvider


class CCSwitchProvider(OpenAICompatibleCouncilProvider):
    provider_name = "ccswitch"
    default_base_url = "http://127.0.0.1:15721/v1"
    default_model = "gpt-5.5"
    default_env_name = "CCSWITCH_API_KEY_1"

    @staticmethod
    def _output_text(data: dict[str, Any]) -> str:
        if data.get("output_text"):
            return str(data["output_text"]).strip()
        parts = []
        for output in data.get("output", []):
            for content in output.get("content", []):
                text = content.get("text") or content.get("content")
                if text:
                    parts.append(str(text))
        return "".join(parts).strip()

    @classmethod
    def _sse_output_text(cls, text: str) -> str:
        deltas: list[str] = []
        completed: dict[str, Any] | None = None
        for line in text.splitlines():
            if not line.startswith("data:"):
                continue
            raw = line[5:].strip()
            if not raw or raw == "[DONE]":
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            event_type = event.get("type")
            if event_type == "response.output_text.delta" and event.get("delta"):
                deltas.append(str(event["delta"]))
            elif event_type == "response.completed" and isinstance(event.get("response"), dict):
                completed = event["response"]
        return cls._output_text(completed or {}) or "".join(deltas).strip()

    def _request(self, *, messages: list[dict[str, str]], config: dict[str, Any], max_tokens: int) -> str:
        api_key = self._api_key(config["env_name"]) or "cc-switch-local-routing"
        input_items = [
            {
                "role": "developer" if item.get("role") == "system" else item.get("role", "user"),
                "content": [{"type": "input_text", "text": item.get("content", "")}],
            }
            for item in messages
        ]
        body = {
            "model": config["model"],
            "input": input_items,
            "max_output_tokens": max_tokens,
        }
        body.update(config.get("extra_body") or {})
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "codex-cli",
            **(config.get("headers") or {}),
        }
        with httpx.Client(timeout=max(config["timeout_seconds"], 5)) as client:
            response = client.post(f"{config['base_url']}/responses", headers=headers, json=body)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "text/event-stream" in content_type or response.text.lstrip().startswith("event:"):
                return self._sse_output_text(response.text)
            return self._output_text(response.json())
