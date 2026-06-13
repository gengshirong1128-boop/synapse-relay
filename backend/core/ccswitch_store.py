from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tomllib
from pathlib import Path
from typing import Any

from backend.core.credentials import credential_store
from backend.core.council_models import Minister
from backend.core.providers.provider_registry import provider_registry
from backend.core.provider_profiles import provider_profile_store
from backend.schemas import ProviderProfileCreateRequest, ProviderProfilePatchRequest


def _database_path() -> Path:
    configured = os.getenv("CCSWITCH_DB_PATH", "").strip()
    return Path(configured).expanduser() if configured else Path.home() / ".cc-switch" / "cc-switch.db"


def _profile_id(provider_id: str, app_type: str) -> str:
    digest = hashlib.sha256(f"{app_type}:{provider_id}".encode("utf-8")).hexdigest()[:16]
    return f"ccswitch_import_{digest}"


def _credential_id(provider_id: str, app_type: str) -> str:
    digest = hashlib.sha256(f"{app_type}:{provider_id}".encode("utf-8")).hexdigest()[:16]
    return f"ccswitch_import_key_{digest}"


def _env_name(provider_id: str, app_type: str) -> str:
    digest = hashlib.sha256(f"{app_type}:{provider_id}".encode("utf-8")).hexdigest()[:16].upper()
    return f"CCSWITCH_IMPORTED_{digest}"


def _parse_provider(row: sqlite3.Row) -> dict[str, Any] | None:
    try:
        settings = json.loads(row["settings_config"] or "{}")
    except json.JSONDecodeError:
        return None

    app_type = str(row["app_type"] or "")
    base_url = ""
    model = ""
    api_key = ""
    provider = "ccswitch"
    api_format = "openai_compatible"

    if app_type in {"claude", "claude-desktop"}:
        env = settings.get("env") if isinstance(settings.get("env"), dict) else {}
        base_url = str(env.get("ANTHROPIC_BASE_URL") or "").rstrip("/")
        model = str(
            env.get("ANTHROPIC_MODEL")
            or env.get("ANTHROPIC_DEFAULT_SONNET_MODEL")
            or env.get("ANTHROPIC_DEFAULT_OPUS_MODEL")
            or "claude-sonnet-4-20250514"
        )
        api_key = str(env.get("ANTHROPIC_AUTH_TOKEN") or env.get("ANTHROPIC_API_KEY") or "")
        provider = "anthropic"
        api_format = "anthropic"
    elif app_type == "codex":
        auth = settings.get("auth") if isinstance(settings.get("auth"), dict) else {}
        config_text = str(settings.get("config") or "")
        try:
            config = tomllib.loads(config_text) if config_text.strip() else {}
        except tomllib.TOMLDecodeError:
            config = {}
        provider_id = str(config.get("model_provider") or "")
        provider_configs = config.get("model_providers") if isinstance(config.get("model_providers"), dict) else {}
        selected = provider_configs.get(provider_id) if isinstance(provider_configs.get(provider_id), dict) else {}
        base_url = str(selected.get("base_url") or "").rstrip("/")
        model = str(config.get("model") or "gpt-5-codex")
        api_key = str(auth.get("OPENAI_API_KEY") or "")
    else:
        return None

    if not base_url or not api_key:
        return None

    profile_id = _profile_id(str(row["id"]), app_type)
    credential_id = _credential_id(str(row["id"]), app_type)
    env_name = _env_name(str(row["id"]), app_type)
    return {
        "id": str(row["id"]),
        "name": str(row["name"] or row["id"]),
        "appType": app_type,
        "providerType": str(row["provider_type"] or ""),
        "isCurrent": bool(row["is_current"]),
        "baseUrl": base_url,
        "model": model,
        "profileId": profile_id,
        "credentialId": credential_id,
        "envName": env_name,
        "apiKey": api_key,
        "provider": provider,
        "apiFormat": api_format,
    }


def sync_ccswitch_providers() -> list[dict[str, Any]]:
    path = _database_path()
    if not path.is_file():
        return []

    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            select id, app_type, name, provider_type, is_current, settings_config
            from providers
            order by app_type, is_current desc, sort_index, name
            """
        ).fetchall()

    public_items: list[dict[str, Any]] = []
    for row in rows:
        item = _parse_provider(row)
        if item is None:
            continue
        credential_store.upsert_runtime(
            credential_id=item["credentialId"],
            provider=item["provider"],
            name=f"CC Switch: {item['name']}",
            env_name=item["envName"],
            api_key=item["apiKey"],
            default_model=item["model"],
            base_url=item["baseUrl"],
        )
        patch = ProviderProfilePatchRequest(
            name=f"CC Switch: {item['name']}",
            api_format=item["apiFormat"],
            base_url=item["baseUrl"],
            default_model=item["model"],
            models=[item["model"]],
            credential_id=item["credentialId"],
            enabled=True,
            target_apps=["synapse", item["appType"]],
            auth_env_name=item["envName"],
            notes=f"Imported at runtime from CC Switch provider {item['id']}.",
        )
        try:
            provider_profile_store.patch(item["profileId"], patch)
        except KeyError:
            provider_profile_store.create(
                ProviderProfileCreateRequest(
                    profile_id=item["profileId"],
                    name=patch.name or item["name"],
                    provider=item["provider"],
                    api_format=item["apiFormat"],
                    base_url=item["baseUrl"],
                    default_model=item["model"],
                    models=[item["model"]],
                    credential_id=item["credentialId"],
                    enabled=True,
                    target_apps=["synapse", item["appType"]],
                    auth_env_name=item["envName"],
                    notes=patch.notes or "",
                )
            )
        public_items.append(
            {
                "id": item["id"],
                "name": item["name"],
                "appType": item["appType"],
                "providerType": item["providerType"],
                "isCurrent": item["isCurrent"],
                "baseUrl": item["baseUrl"],
                "model": item["model"],
                "profileId": item["profileId"],
                "keyAvailable": True,
            }
        )
    return public_items


def test_ccswitch_provider(profile_id: str) -> dict[str, Any]:
    providers = sync_ccswitch_providers()
    item = next((provider for provider in providers if provider["profileId"] == profile_id), None)
    if item is None:
        raise KeyError(f"Unknown CC Switch profile: {profile_id}")
    profile = provider_profile_store.get(profile_id)
    provider = provider_registry.get(profile.provider)
    minister = Minister(
        id="ccswitch_test",
        title="CC Switch Test",
        displayName="CC Switch Test",
        office="test",
        duty="test",
        capabilityTags=[],
        provider=profile.provider,
        model=item["model"],
        apiProfileId=profile_id,
        systemPrompt="Reply briefly.",
        enabled=True,
        isChief=True,
        order=0,
    )
    try:
        config = provider._resolve_config(minister)
        if profile.api_format == "anthropic":
            preview = provider._request(
                system="You are a connectivity tester.",
                user="Reply only: OK",
                config=config,
                max_tokens=8,
            )
        else:
            preview = provider._request(
                messages=[
                    {"role": "system", "content": "You are a connectivity tester."},
                    {"role": "user", "content": "Reply only: OK"},
                ],
                config=config,
                max_tokens=8,
            )
        return {"ok": True, "success": True, "profileId": profile_id, "model": item["model"], "preview": preview[:120]}
    except Exception as exc:  # noqa: BLE001
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        error = f"HTTP {status_code}" if status_code else type(exc).__name__
        return {"ok": True, "success": False, "profileId": profile_id, "model": item["model"], "error": error}
