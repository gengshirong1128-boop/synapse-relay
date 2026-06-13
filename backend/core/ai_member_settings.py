from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

from backend.config import ROOT_DIR


RoleId = Literal["chief", "code", "review", "summary", "translation"]
CallStrategy = Literal["auto", "prefer_subscription", "prefer_api", "local_only", "manual"]
DATA_DIR = Path(os.getenv("NEIGE_DATA_DIR", ROOT_DIR / ".synapse" / "runtime"))


@dataclass
class AIMemberSettings:
    callStrategy: CallStrategy = "auto"
    roleAssignments: dict[str, str] = field(default_factory=lambda: {
        "chief": "mock_default_profile",
        "code": "mock_default_profile",
        "review": "mock_default_profile",
        "summary": "mock_default_profile",
        "translation": "mock_default_profile",
    })
    chiefLocalToolId: str = ""
    preferredWebsiteIds: list[str] = field(default_factory=list)
    websiteLogins: dict[str, dict[str, str]] = field(default_factory=dict)
    customMembers: list[dict] = field(default_factory=list)
    memberOverrides: dict[str, dict] = field(default_factory=dict)


class AIMemberSettingsStore:
    def __init__(self) -> None:
        self._settings = AIMemberSettings()
        self._load()

    @property
    def _path(self) -> Path:
        return DATA_DIR / "ai_member_settings.json"

    def _load(self) -> None:
        path = self._path
        if not path.exists():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(raw, dict):
            return
        try:
            self.patch(raw, save=False)
        except ValueError:
            self._settings = AIMemberSettings()

    def _save(self) -> None:
        path = self._path
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(self.get(), ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def get(self) -> dict:
        return asdict(self._settings)

    def patch(self, payload: dict, save: bool = True) -> dict:
        strategy = payload.get("callStrategy")
        if strategy:
            if strategy not in {"auto", "prefer_subscription", "prefer_api", "local_only", "manual"}:
                raise ValueError("invalid_call_strategy")
            self._settings.callStrategy = strategy

        assignments = payload.get("roleAssignments")
        if isinstance(assignments, dict):
            allowed = {"chief", "code", "review", "summary", "translation"}
            for key, value in assignments.items():
                if key not in allowed:
                    raise ValueError(f"invalid_role: {key}")
                self._settings.roleAssignments[key] = str(value)

        if "chiefLocalToolId" in payload:
            self._settings.chiefLocalToolId = str(payload.get("chiefLocalToolId") or "")

        if "preferredWebsiteIds" in payload:
            raw_ids = payload.get("preferredWebsiteIds") or []
            if not isinstance(raw_ids, list):
                raise ValueError("preferredWebsiteIds must be a list")
            self._settings.preferredWebsiteIds = [str(item) for item in raw_ids]

        website_logins = payload.get("websiteLogins")
        if isinstance(website_logins, dict):
            for site_id, login in website_logins.items():
                if not isinstance(login, dict):
                    raise ValueError(f"invalid_login_config: {site_id}")
                self._settings.websiteLogins[str(site_id)] = {
                    "username": str(login.get("username") or ""),
                    "passwordEnvName": str(login.get("passwordEnvName") or ""),
                    "loginStatus": str(login.get("loginStatus") or "not_checked"),
                }

        custom_members = payload.get("customMembers")
        if isinstance(custom_members, list):
            sanitized = []
            for m in custom_members:
                if not isinstance(m, dict):
                    continue
                sanitized.append({
                    "id": str(m.get("id", "")),
                    "name": str(m.get("name", "")),
                    "nickname": str(m.get("nickname", "")),
                    "avatar": str(m.get("avatar", "")),
                    "badge": str(m.get("badge", "")),
                    "type": str(m.get("type", "custom")),
                    "role": str(m.get("role", "none")),
                    "ministry": str(m.get("ministry", "none")),
                    "skillId": str(m.get("skillId", "")),
                    "providerId": str(m.get("providerId", "")),
                    "apiProfileId": str(m.get("apiProfileId", "")),
                    "localToolId": str(m.get("localToolId", "")),
                    "modelId": str(m.get("modelId", "")),
                    "enabled": bool(m.get("enabled", True)),
                    "selected": bool(m.get("selected", True)),
                })
            self._settings.customMembers = sanitized

        member_overrides = payload.get("memberOverrides")
        if isinstance(member_overrides, dict):
            sanitized_overrides: dict[str, dict] = {}
            for member_id, override in member_overrides.items():
                if not isinstance(override, dict):
                    continue
                sanitized_overrides[str(member_id)] = {
                    "name": str(override.get("name", "")),
                    "nickname": str(override.get("nickname", "")),
                    "avatar": str(override.get("avatar", "")),
                    "role": str(override.get("role", "")),
                    "ministry": str(override.get("ministry", "")),
                    "skillId": str(override.get("skillId", "")),
                    "providerId": str(override.get("providerId", "")),
                    "apiProfileId": str(override.get("apiProfileId", "")),
                    "localToolId": str(override.get("localToolId", "")),
                }
            self._settings.memberOverrides = sanitized_overrides

        if save:
            self._save()
        return self.get()


ai_member_settings_store = AIMemberSettingsStore()
