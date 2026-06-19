from __future__ import annotations

import json

from backend import detect_agents


SAMPLE = [
    {
        "id": "cli.claude_code",
        "name": "Claude Code",
        "status": "callable",
        "executablePath": "/usr/bin/claude",
        "configPaths": ["/opt/agent/.claude"],
    },
    {
        "id": "cli.opencode",
        "name": "OpenCode",
        "status": "not_installed",
        "executablePath": None,
        "configPaths": [],
    },
]


def test_format_table_summarises_callable(monkeypatch):
    text = detect_agents.format_table(SAMPLE)
    assert "1 callable" in text
    assert "Claude Code" in text
    assert "/usr/bin/claude" in text
    assert "[OK]" in text


def test_main_human_output_and_exit_code(monkeypatch, capsys):
    monkeypatch.setattr(detect_agents, "detect_cli_tools", lambda: SAMPLE)
    code = detect_agents.main([])
    out = capsys.readouterr().out
    assert "Claude Code" in out
    assert code == 0


def test_main_json_output(monkeypatch, capsys):
    monkeypatch.setattr(detect_agents, "detect_cli_tools", lambda: SAMPLE)
    code = detect_agents.main(["--json"])
    payload = json.loads(capsys.readouterr().out)
    assert [tool["id"] for tool in payload["tools"]] == ["cli.claude_code", "cli.opencode"]
    assert code == 0


def test_main_exit_1_when_none_callable(monkeypatch, capsys):
    monkeypatch.setattr(detect_agents, "detect_cli_tools", lambda: [SAMPLE[1]])
    code = detect_agents.main([])
    capsys.readouterr()
    assert code == 1


def test_main_json_preserves_non_ascii_paths(monkeypatch, capsys):
    cjk_tool = [
        {
            "id": "cli.claude_code",
            "name": "Claude Code",
            "status": "callable",
            "executablePath": "D:\\Tools\\代理\\claude.CMD",
            "configPaths": ["D:\\Tools\\代理\\.claude"],
        }
    ]
    monkeypatch.setattr(detect_agents, "detect_cli_tools", lambda: cjk_tool)
    detect_agents.main(["--json"])
    payload = json.loads(capsys.readouterr().out)
    assert payload["tools"][0]["executablePath"].endswith("claude.CMD")
    assert "代理" in payload["tools"][0]["configPaths"][0]


def test_main_test_flag_probes_callable(monkeypatch, capsys):
    monkeypatch.setattr(detect_agents, "detect_cli_tools", lambda: SAMPLE)
    probes: list[str] = []

    def fake_probe(tool_id):
        probes.append(tool_id)
        return {"success": True}

    monkeypatch.setattr(detect_agents, "test_local_tool", fake_probe)
    detect_agents.main(["--test"])
    out = capsys.readouterr().out
    assert "cli.claude_code" in probes
    assert "reachable" in out


def test_orchestration_agent_test_endpoint(monkeypatch):
    import backend.main as main_module
    from fastapi.testclient import TestClient

    monkeypatch.setattr(
        main_module,
        "test_local_tool",
        lambda tool_id: {"tool": {"id": tool_id}, "success": True, "status": "callable", "output": "v1.2.3"},
    )
    client = TestClient(main_module.app)
    response = client.post("/orchestration/agents/cli.codex/test")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["output"] == "v1.2.3"


def test_orchestration_agent_test_unknown_id_returns_404():
    import backend.main as main_module
    from fastapi.testclient import TestClient

    client = TestClient(main_module.app)
    response = client.post("/orchestration/agents/cli.does_not_exist/test")
    assert response.status_code == 404
