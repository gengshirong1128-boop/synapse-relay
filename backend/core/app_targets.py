from __future__ import annotations

import shutil
from pathlib import Path

from backend.core.credentials import credential_store
from backend.core.provider_profiles import provider_profile_store
from backend.schemas import AppTargetConfig, AppTargetExportRequest, AppTargetPreviewRequest


class AppTargetStore:
    def __init__(self) -> None:
        self._targets: dict[str, AppTargetConfig] = {
            "claude_code": AppTargetConfig(
                target_app="claude_code",
                export_mode="env",
                settings_path="~/.claude/settings.json",
                command_template="claude -p \"{prompt}\"",
                enabled=True,
            ),
            "codex": AppTargetConfig(
                target_app="codex",
                export_mode="env",
                settings_path="~/.codex/profile.json",
                command_template="codex exec \"{prompt}\"",
                enabled=True,
            ),
            "gemini_cli": AppTargetConfig(
                target_app="gemini_cli",
                export_mode="prompt_only",
                command_template="gemini \"{prompt}\"",
                enabled=True,
            ),
            "opencode": AppTargetConfig(
                target_app="opencode",
                export_mode="prompt_only",
                command_template="opencode run --prompt \"{prompt}\"",
                enabled=True,
            ),
            "generic_cli": AppTargetConfig(
                target_app="generic_cli",
                export_mode="prompt_only",
                command_template="<your-cli> \"{prompt}\"",
                enabled=True,
            ),
        }

    def list(self) -> list[AppTargetConfig]:
        return list(self._targets.values())

    def get(self, target_app: str) -> AppTargetConfig:
        target = self._targets.get(target_app)
        if target is None:
            raise KeyError(f"Unknown target app: {target_app}")
        return target


app_target_store = AppTargetStore()


def _profile_credential(profile_id: str, override_credential_id: str | None):
    profile = provider_profile_store.get(profile_id)
    credential_id = override_credential_id or profile.credential_id
    credential = credential_store.get(credential_id)
    credential_store.reload()
    return profile, credential


def _model_for_profile(profile, request_model: str | None) -> str:
    model = request_model or profile.default_model or ""
    if not model and profile.models:
        model = profile.models[0]
    if model:
        model = profile.model_mapping.get(model, model)
    return model


def _build_claude_env(profile, credential, model: str) -> dict[str, str]:
    auth_env_name = profile.auth_env_name or "ANTHROPIC_API_KEY"
    env_vars = {
        "ANTHROPIC_BASE_URL": profile.base_url or "https://api.anthropic.com",
        auth_env_name: f"${credential.api_key_env_name}",
    }
    if model:
        env_vars["ANTHROPIC_MODEL"] = model
    return env_vars


def _build_codex_env(profile, credential, model: str) -> dict[str, str]:
    return {
        "OPENAI_BASE_URL": profile.base_url or "https://api.openai.com/v1",
        "OPENAI_API_KEY": f"${credential.api_key_env_name}",
        "OPENAI_MODEL": model,
    }


def preview_app_target(request: AppTargetPreviewRequest) -> dict:
    profile, credential = _profile_credential(request.profile_id, request.credential_id)
    target = app_target_store.get(request.target_app)
    model = _model_for_profile(profile, request.model)

    warnings: list[str] = []
    if not credential.key_available:
        warnings.append("Credential key is not available in environment. Preview only.")
    if request.target_app not in profile.target_apps:
        warnings.append(f"Profile target_apps does not include {request.target_app}.")

    env_vars: dict[str, str] = {}
    settings_json: dict = {}
    command_preview = ""

    if request.target_app == "claude_code":
        env_vars = _build_claude_env(profile, credential, model)
        settings_json = {
            "provider": {
                "baseUrl": profile.base_url,
                "model": model,
                "authEnvName": profile.auth_env_name or "ANTHROPIC_API_KEY",
                "headers": profile.headers,
                "extraBody": profile.extra_body,
            }
        }
        command_preview = target.command_template.format(prompt="<prompt>")
    elif request.target_app == "codex":
        env_vars = _build_codex_env(profile, credential, model)
        settings_json = {
            "provider": profile.provider,
            "base_url": profile.base_url,
            "model": model,
            "api_key_env_name": credential.api_key_env_name,
            "headers": profile.headers,
            "extra_body": profile.extra_body,
            "timeout_seconds": profile.timeout_seconds,
        }
        command_preview = target.command_template.format(prompt="<prompt>")
    else:
        command_preview = target.command_template.format(prompt="<prompt>")

    env_script_lines = [f"set {key}={value}" for key, value in env_vars.items()]
    preview = {
        "target_app": request.target_app,
        "export_mode": request.export_mode,
        "profile_id": profile.profile_id,
        "credential_id": credential.credential_id,
        "env_vars": env_vars,
        "env_script": "\n".join(env_script_lines),
        "settings_path": request.settings_path or target.settings_path,
        "settings_json": settings_json,
        "command_preview": command_preview,
        "profile_json": settings_json,
        "model_mapping": profile.model_mapping,
        "warnings": warnings,
        "dry_run": request.dry_run,
        "will_write": bool(request.write_config and not request.dry_run),
    }
    return preview


def export_app_target(request: AppTargetExportRequest) -> dict:
    preview = preview_app_target(request)
    write_allowed = bool(request.write_config and not request.dry_run and request.confirm_write)
    if not write_allowed:
        preview["written"] = False
        preview["message"] = "Dry-run preview only. Set dry_run=false + confirm_write=true to write file."
        return preview

    settings_path = preview.get("settings_path")
    if not settings_path:
        preview["written"] = False
        preview["message"] = "No settings_path provided for write operation."
        return preview

    target_path = Path(settings_path).expanduser().resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(str(preview.get("settings_json", {})), encoding="utf-8")

    preview["written"] = True
    preview["written_path"] = str(target_path)
    preview["message"] = "Config exported successfully."
    return preview


def check_app_target(target_app: str) -> dict:
    target = app_target_store.get(target_app)
    binary_map = {
        "claude_code": "claude",
        "codex": "codex",
        "gemini_cli": "gemini",
        "opencode": "opencode",
        "generic_cli": "",
    }
    binary = binary_map.get(target_app, "")
    path = shutil.which(binary) if binary else None
    return {
        "target_app": target_app,
        "enabled": target.enabled,
        "binary": binary,
        "installed": bool(path) if binary else True,
        "path": path,
        "export_mode": target.export_mode,
        "settings_path": target.settings_path,
        "command_template": target.command_template,
    }
