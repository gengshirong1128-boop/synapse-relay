"""Lightweight local-agent detector.

Run a one-shot scan for installed AI agent CLIs without starting the backend
server or the desktop app:

    python -m backend.detect_agents            # human-readable table
    python -m backend.detect_agents --json     # machine-readable JSON
    python -m backend.detect_agents --test     # also probe connectivity

Reuses backend.core.provider_detection so the result matches the API exactly.
"""
from __future__ import annotations

import argparse
import json
import sys

from backend.core.provider_detection import detect_cli_tools, test_local_tool

STATUS_LABEL = {
    "callable": "[OK]  callable",
    "installed": "[ ~ ] installed (not verified callable)",
    "configured": "[ ~ ] configured (executable not on PATH)",
    "open_only": "[ ~ ] open only",
    "not_installed": "[X]  not installed",
}


def format_table(tools: list[dict], run_test: bool = False) -> str:
    lines: list[str] = []
    callable_count = sum(1 for tool in tools if tool["status"] == "callable")
    lines.append(f"Detected {len(tools)} known agents - {callable_count} callable\n")
    for tool in tools:
        status = STATUS_LABEL.get(tool["status"], tool["status"])
        lines.append(f"{tool['name']:<14} {status}")
        if tool.get("executablePath"):
            lines.append(f"               exe:    {tool['executablePath']}")
        for config_path in tool.get("configPaths", []):
            lines.append(f"               config: {config_path}")
        if run_test and tool["status"] in {"callable", "installed"}:
            probe = test_local_tool(tool["id"])
            verdict = "reachable" if probe.get("success") else f"failed ({probe.get('error', 'unknown')})"
            lines.append(f"               probe:  {verdict}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Detect locally installed AI agent CLIs.")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument("--test", action="store_true", help="probe connectivity of detected agents")
    args = parser.parse_args(argv)

    # Force UTF-8 stdout so non-ASCII paths (e.g. Chinese usernames) stay parseable
    # regardless of the Windows console code page.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    tools = detect_cli_tools()
    if args.json:
        payload = {"tools": tools}
        if args.test:
            payload["tests"] = {
                tool["id"]: test_local_tool(tool["id"])
                for tool in tools
                if tool["status"] in {"callable", "installed"}
            }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(format_table(tools, run_test=args.test))

    # Exit 0 when at least one agent is callable, 1 otherwise (useful for scripts).
    return 0 if any(tool["status"] == "callable" for tool in tools) else 1


if __name__ == "__main__":
    sys.exit(main())
