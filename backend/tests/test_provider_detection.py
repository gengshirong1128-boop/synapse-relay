from __future__ import annotations

from pathlib import Path

from backend.core import provider_detection as pd


def _isolate(monkeypatch, tmp_path: Path, *, on_path: set[str], configs: set[str], installs=None):
    """Make detection deterministic: control PATH hits, config dirs, install scan."""
    monkeypatch.setattr(pd.Path, "home", classmethod(lambda cls: tmp_path))
    for cfg in configs:
        (tmp_path / cfg).mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(pd.shutil, "which", lambda command: f"/usr/bin/{command}" if command in on_path else None)
    monkeypatch.setattr(pd, "_safe_search_install", lambda command: list(installs or []))


def test_callable_requires_exe_and_config(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path, on_path={"claude"}, configs={".claude"})
    info = pd.get_local_tool("cli.claude_code")
    assert info["status"] == "callable"
    assert info["executablePath"] == "/usr/bin/claude"
    assert any(p.endswith(".claude") for p in info["configPaths"])


def test_configured_only_when_exe_missing(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path, on_path=set(), configs={".gemini"})
    info = pd.get_local_tool("cli.gemini")
    assert info["status"] == "configured"
    assert info["executablePath"] is None


def test_not_installed_when_nothing_found(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path, on_path=set(), configs=set())
    info = pd.get_local_tool("cli.opencode")
    assert info["status"] == "not_installed"


def test_detect_returns_every_known_target(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path, on_path=set(), configs=set())
    tools = pd.detect_cli_tools()
    assert {t["id"] for t in tools} == {t["id"] for t in pd.DETECT_TARGETS}


def test_unknown_tool_id_raises():
    import pytest

    with pytest.raises(KeyError):
        pd.get_local_tool("cli.does_not_exist")
