from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

DETECT_TARGETS = [
    {
        "id": "cli.claude_code",
        "name": "Claude Code",
        "command": "claude",
        "config_dir": ".claude",
        "capabilities": ["chat", "code", "review"],
    },
    {
        "id": "cli.codex",
        "name": "Codex",
        "command": "codex",
        "config_dir": ".codex",
        "capabilities": ["chat", "code", "review"],
    },
    {
        "id": "cli.codebuddy",
        "name": "CodeBuddy",
        "command": "codebuddy",
        "config_dir": ".codebuddy",
        "capabilities": ["code"],
    },
    {
        "id": "cli.trae",
        "name": "Trae",
        "command": "trae",
        "config_dir": ".trae",
        "capabilities": ["code"],
    },
    {
        "id": "app.cursor",
        "name": "Cursor",
        "command": "cursor",
        "config_dir": ".cursor",
        "capabilities": ["open", "code"],
    },
    {
        "id": "cli.workbuddy",
        "name": "WorkBuddy",
        "command": "workbuddy",
        "config_dir": ".workbuddy",
        "capabilities": ["chat", "code"],
    },
    {
        "id": "cli.gemini",
        "name": "Gemini CLI",
        "command": "gemini",
        "config_dir": ".gemini",
        "capabilities": ["chat", "code"],
    },
    {
        "id": "cli.opencode",
        "name": "OpenCode",
        "command": "opencode",
        "config_dir": ".config/opencode",
        "capabilities": ["chat", "code", "review"],
    },
]

SEARCH_ROOTS = [
    Path("C:/Program Files"),
    Path("C:/Program Files (x86)"),
    Path.home() / "AppData/Local",
    Path.home() / "AppData/Roaming",
]


def _safe_search_install(target_command: str) -> list[str]:
    """Search common install directories for a command name. Returns list of found paths."""
    found = []
    for root in SEARCH_ROOTS:
        if not root.exists():
            continue
        try:
            for entry in root.glob("*" + target_command + "*"):
                if entry.is_dir() or entry.suffix in (".exe", ".bat", ".cmd"):
                    str_path = str(entry)
                    if str_path not in found:
                        found.append(str_path)
        except (OSError, PermissionError):
            continue
    return found


def _target_by_id(tool_id: str) -> dict:
    for target in DETECT_TARGETS:
        if target["id"] == tool_id:
            return target
    raise KeyError(f"Unknown local tool: {tool_id}")


def _build_info(target: dict) -> dict:
    info: dict = {
        "id": target["id"],
        "name": target["name"],
        "type": target["id"],
        "status": "not_installed",
        "command": target["command"],
        "executablePath": None,
        "configPaths": [],
        "installPaths": [],
        "capabilities": target.get("capabilities", []),
    }

    exe_path = shutil.which(target["command"])
    if exe_path:
        info["executablePath"] = exe_path
        info["status"] = "installed"

    install_paths = _safe_search_install(target["command"])
    if install_paths:
        info["installPaths"] = install_paths
        if info["status"] == "not_installed":
            info["status"] = "installed"

    config_dir = Path.home() / target["config_dir"]
    if config_dir.exists():
        info["configPaths"].append(str(config_dir))
        if info["status"] == "not_installed":
            info["status"] = "configured"

    if info["executablePath"] and info["configPaths"]:
        info["status"] = "callable"

    return info


def detect_cli_tools() -> list[dict]:
    """Detect locally installed AI CLI tools. Returns a list of ProviderInfo dicts.

    Uses shutil.which for PATH detection and fixed directory lists for install scanning.
    No shell=True, no user input concatenation, no port probing.
    """
    results: list[dict] = []

    for target in DETECT_TARGETS:
        results.append(_build_info(target))

    return results


def get_local_tool(tool_id: str) -> dict:
    return _build_info(_target_by_id(tool_id))


def test_local_tool(tool_id: str, timeout_seconds: float = 3.0) -> dict:
    """Run a bounded, allow-listed CLI self check.

    The command is selected from DETECT_TARGETS only. No shell is used and no user-provided
    arguments are executed.
    """
    info = get_local_tool(tool_id)
    exe_path = info.get("executablePath")
    if not exe_path:
        return {
            "tool": info,
            "success": False,
            "status": info["status"],
            "error": "executable_not_found",
        }

    attempts = [["--version"], ["version"], ["--help"]]
    last_error = ""
    for args in attempts:
        try:
            completed = subprocess.run(
                [exe_path, *args],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                shell=False,
                check=False,
            )
        except subprocess.TimeoutExpired:
            last_error = "timeout"
            continue
        except OSError as exc:
            last_error = str(exc)
            continue

        output = (completed.stdout or completed.stderr or "").strip()
        if completed.returncode == 0 or output:
            return {
                "tool": info,
                "success": completed.returncode == 0,
                "status": "callable" if completed.returncode == 0 else info["status"],
                "exit_code": completed.returncode,
                "command": [info["command"], *args],
                "output": output[:1200],
            }
        last_error = f"exit_code_{completed.returncode}"

    return {
        "tool": info,
        "success": False,
        "status": info["status"],
        "error": last_error or "test_failed",
    }


def local_tool_config(tool_id: str) -> dict:
    info = get_local_tool(tool_id)
    return {
        "tool": info,
        "configPaths": info.get("configPaths", []),
        "installPaths": info.get("installPaths", []),
        "open_only": info["status"] in {"installed", "configured", "open_only"},
    }
