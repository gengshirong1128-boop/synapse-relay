from __future__ import annotations

import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any

from backend.core.context_builder import build_project_context
from backend.core.project_index import project_index_store
from backend.core.provider_detection import detect_cli_tools, get_local_tool
from backend.schemas import CollaborationDraftRequest


LAUNCHABLE_AGENT_IDS = {"cli.codex", "cli.claude_code", "cli.gemini", "cli.opencode"}
RESERVED_PARTS = {".git", ".synapse", ".venv", "node_modules"}

MAX_MANAGER_OUTPUT_BYTES = 1_048_576
MAX_JSON_NESTING = 3
_SENSITIVE_PATTERNS = (
    re.compile(r"[A-Za-z]:\\[^\s\"']+"),
    re.compile(r"(?:/[^\s\"'/]+){2,}"),
    re.compile(r"\b[A-Z_]{3,}=[^\s]+"),
)

PLANNER_SCHEMA = {
    "type": "object",
    "properties": {
        "analysis": {"type": "string"},
        "recommendations": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "agent_id": {"type": "string"},
                    "title": {"type": "string"},
                    "instructions": {"type": "string"},
                    "read_paths": {"type": "array", "items": {"type": "string"}},
                    "write_paths": {"type": "array", "items": {"type": "string"}},
                    "depends_on": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "task_id",
                    "agent_id",
                    "title",
                    "instructions",
                    "read_paths",
                    "write_paths",
                    "depends_on",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["analysis", "recommendations", "risks", "acceptance_criteria", "tasks"],
    "additionalProperties": False,
}


def _safe_relative_path(raw_path: str) -> str | None:
    value = str(raw_path or "").strip().replace("\\", "/")
    if not value or Path(value).is_absolute():
        return None
    parts = tuple(part for part in PurePosixPath(value).parts if part != ".")
    if not parts or ".." in parts or any(part in RESERVED_PARTS for part in parts):
        return None
    return PurePosixPath(*parts).as_posix()


def _extract_json(raw: str, _depth: int = 0) -> dict[str, Any]:
    if _depth > MAX_JSON_NESTING:
        raise ValueError("Manager agent output nested too deeply.")
    text = raw.strip()
    if not text:
        raise ValueError("Manager agent returned no output.")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Manager agent did not return a JSON plan.")
        parsed = json.loads(text[start : end + 1])
    if isinstance(parsed, dict) and isinstance(parsed.get("result"), str):
        return _extract_json(parsed["result"], _depth + 1)
    if isinstance(parsed, dict) and isinstance(parsed.get("structured_output"), dict):
        return parsed["structured_output"]
    if not isinstance(parsed, dict):
        raise ValueError("Manager agent returned an invalid plan.")
    return parsed


def _read_capped(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_bytes()[:MAX_MANAGER_OUTPUT_BYTES].decode("utf-8", errors="ignore")


def _sanitize_detail(text: str) -> str:
    cleaned = text
    for pattern in _SENSITIVE_PATTERNS:
        cleaned = pattern.sub("[redacted]", cleaned)
    return cleaned


def _sanitize_instructions(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        lowered = stripped.lower()
        if any(
            marker in lowered
            for marker in (
                "ignore previous",
                "ignore the above",
                "disregard previous",
                "system prompt",
                "you are now",
                "override",
            )
        ):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def _available_workers(requested: list[str]) -> list[str]:
    callable_ids = [
        item["id"]
        for item in detect_cli_tools()
        if item.get("status") == "callable" and item.get("id") in LAUNCHABLE_AGENT_IDS
    ]
    selected = [item for item in requested if item in callable_ids]
    return selected or callable_ids


def _manager_command(agent_id: str, prompt: str, work_dir: Path, schema_path: Path, output_path: Path) -> list[str]:
    info = get_local_tool(agent_id)
    executable = info.get("executablePath")
    if not executable:
        raise ValueError(f"Manager agent executable is not available: {agent_id}")
    if agent_id == "cli.codex":
        return [
            str(executable),
            "exec",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--ephemeral",
            "-C",
            str(work_dir),
            "--output-schema",
            str(schema_path),
            "-o",
            str(output_path),
            "-",
        ]
    if agent_id == "cli.claude_code":
        return [
            str(executable),
            "-p",
            "--permission-mode",
            "plan",
            "--tools",
            "",
            "--no-session-persistence",
            "--json-schema",
            json.dumps(PLANNER_SCHEMA),
            "--output-format",
            "json",
        ]
    command_map = {
        "cli.gemini": ["-p"],
        "cli.opencode": ["run"],
    }
    args = command_map.get(agent_id)
    if args is None:
        raise ValueError(f"Agent cannot be used as manager: {agent_id}")
    return [str(executable), *args, prompt]


def _project_summary(index, context) -> dict[str, Any]:
    readable = [item for item in index.files if item.is_readable and not item.is_sensitive]
    languages = Counter(item.language for item in readable)
    top_level = Counter(PurePosixPath(item.relative_path.replace("\\", "/")).parts[0] for item in readable)
    return {
        "project_name": index.project_name,
        "total_files": index.total_files,
        "readable_files": len(readable),
        "languages": dict(languages.most_common(8)),
        "top_level_areas": [item for item, _ in top_level.most_common(15)],
        "file_tree": sorted(item.relative_path for item in readable)[:250],
        "relevant_files": [item.relative_path for item in context.relevant_files],
        "dependency_files": context.dependency_files,
        "warnings": context.warnings,
    }


def _planning_prompt(request: CollaborationDraftRequest, summary: dict[str, Any], context) -> str:
    language_rule = "Use Chinese for analysis, titles, instructions, risks, recommendations, and criteria." if request.language == "zh" else "Use English for all prose."
    snippets = []
    for item in context.relevant_files[:8]:
        snippet = item.snippets[0].content[:1800] if item.snippets else ""
        snippets.append({"path": item.relative_path, "language": item.language, "snippet": snippet})
    return "\n".join(
        [
            "You are the read-only manager agent for a software project.",
            "The user only knows the desired outcome. You must analyze the supplied project context and delegate a safe, practical implementation plan.",
            "Do not ask the user to decompose work. Do not modify files. Return JSON only, matching the supplied schema.",
            language_rule,
            f"User goal: {request.goal.strip()}",
            f"Worker agent ids you may assign: {', '.join(_available_workers(request.worker_agent_ids))}",
            f"Maximum tasks: {request.max_tasks}",
            "",
            "Planning requirements:",
            "- Assign each task to one available worker agent id.",
            "- Give concrete completion criteria and validation commands inside task instructions.",
            "- Declare the smallest practical relative read_paths and write_paths.",
            "- New file paths are allowed when clearly needed, but never use absolute paths, .., .git, .synapse, .venv, or node_modules.",
            "- Add dependencies only when technically required. Independent tasks should remain parallel.",
            "- Include a final verification/review task when the change spans multiple areas.",
            "- Identify assumptions, user-visible acceptance criteria, risks, and recommendations.",
            "",
            f"Project summary:\n{json.dumps(summary, ensure_ascii=False, indent=2)}",
            f"Relevant project excerpts:\n{json.dumps(snippets, ensure_ascii=False, indent=2)}",
        ]
    )


def _run_manager(request: CollaborationDraftRequest, prompt: str) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="agent-relay-manager-") as temp:
        work_dir = Path(temp)
        schema_path = work_dir / "plan-schema.json"
        output_path = work_dir / "manager-output.json"
        schema_path.write_text(json.dumps(PLANNER_SCHEMA, ensure_ascii=False, indent=2), encoding="utf-8")
        command = _manager_command(request.manager_agent_id, prompt, work_dir, schema_path, output_path)
        stdin_prompt = prompt if request.manager_agent_id in {"cli.codex", "cli.claude_code"} else None
        stdout_path = work_dir / "manager-stdout.txt"
        stderr_path = work_dir / "manager-stderr.txt"
        # Redirect to files so a hostile manager cannot exhaust memory via
        # unbounded stdout/stderr (capture_output buffers everything in RAM).
        try:
            with stdout_path.open("wb") as out_file, stderr_path.open("wb") as err_file:
                completed = subprocess.run(
                    command,
                    cwd=str(work_dir),
                    input=stdin_prompt.encode("utf-8") if stdin_prompt else None,
                    stdout=out_file,
                    stderr=err_file,
                    timeout=300,
                    check=False,
                    shell=False,
                )
        except subprocess.TimeoutExpired as exc:
            raise ValueError("Manager agent planning timed out.") from exc
        except OSError as exc:
            raise ValueError(f"Failed to launch manager agent: {exc}") from exc
        raw = _read_capped(output_path) or _read_capped(stdout_path)
        if completed.returncode != 0 and not raw.strip():
            detail = _sanitize_detail(_read_capped(stderr_path).strip())[-600:]
            raise ValueError(f"Manager agent failed: {detail or f'exit_code_{completed.returncode}'}")
        return _extract_json(raw)


def _fallback_plan(request: CollaborationDraftRequest, summary: dict[str, Any], context, workers: list[str], error: str) -> dict[str, Any]:
    source_roots = {"src", "app", "pages", "frontend", "backend", "web", "server", "lib", "desktop"}
    areas: list[str] = []
    for raw_path in summary.get("file_tree", []):
        parts = PurePosixPath(raw_path.replace("\\", "/")).parts
        if not parts:
            continue
        area = ""
        for marker in ("src", "app", "pages"):
            if marker in parts:
                area = PurePosixPath(*parts[: parts.index(marker) + 1]).as_posix()
                break
        if not area and parts[0].lower() in source_roots:
            area = parts[0]
        if area and area not in areas:
            areas.append(area)
    goal_lower = request.goal.lower()
    frontend_terms = {"ui", "ux", "user", "onboarding", "frontend", "page", "用户", "体验", "界面", "首次"}
    backend_terms = {"api", "backend", "database", "auth", "server", "后端", "接口", "数据库", "认证"}
    if any(term in goal_lower for term in frontend_terms):
        areas.sort(key=lambda item: (0 if any(term in item.lower() for term in ("src", "app", "page", "front", "web")) else 1, item))
    elif any(term in goal_lower for term in backend_terms):
        areas.sort(key=lambda item: (0 if any(term in item.lower() for term in ("backend", "server", "api")) else 1, item))
    if not areas:
        areas = [
            item
            for item in summary.get("top_level_areas", [])
            if item.lower() not in {"docs", ".github", "scripts"}
        ]
    areas = areas[: max(1, request.max_tasks - 1)]
    tasks = []
    for index, area in enumerate(areas, start=1):
        tasks.append(
            {
                "task_id": f"task-{index}",
                "agent_id": workers[(index - 1) % len(workers)],
                "title": f"完善 {area}" if request.language == "zh" else f"Improve {area}",
                "instructions": (
                    f"分析并完成与目标相关的 {area} 改动；保持现有架构风格，运行对应测试并报告修改文件、验证结果和剩余风险。"
                    if request.language == "zh"
                    else f"Implement the goal-related changes in {area}; preserve existing architecture, run relevant tests, and report changed files, validation results, and remaining risk."
                ),
                "read_paths": [area],
                "write_paths": [area],
                "depends_on": [],
            }
        )
    if len(tasks) > 1 and len(tasks) < request.max_tasks:
        review_paths = [task["read_paths"][0] for task in tasks]
        review_paths.extend(summary.get("dependency_files", [])[:4])
        tasks.append(
            {
                "task_id": f"task-{len(tasks) + 1}",
                "agent_id": workers[len(tasks) % len(workers)],
                "title": "集成验证与审查" if request.language == "zh" else "Integration verification and review",
                "instructions": (
                    "审查所有任务交付，运行项目级测试或构建，确认目标、回归风险与用户体验均达标；仅报告问题，不修改文件。"
                    if request.language == "zh"
                    else "Review all task deliveries, run project-level tests or builds, and verify the goal, regression risk, and user experience; report issues without modifying files."
                ),
                "read_paths": sorted(set(review_paths)),
                "write_paths": [],
                "depends_on": [task["task_id"] for task in tasks],
            }
        )
    return {
        "analysis": (
            "主管 Agent 不可用，系统依据项目索引生成了保守草案。请在执行前检查任务边界。"
            if request.language == "zh"
            else "The manager agent was unavailable, so a conservative draft was generated from the project index. Review boundaries before execution."
        ),
        "recommendations": [
            "先审核任务边界，再启动执行。" if request.language == "zh" else "Review task boundaries before launch.",
            "为每个改动运行对应测试。" if request.language == "zh" else "Run relevant tests for every change.",
        ],
        "risks": [error],
        "acceptance_criteria": [
            "用户目标已实现且现有功能无回归。" if request.language == "zh" else "The user goal is met without regressions.",
            "所有相关测试与构建通过。" if request.language == "zh" else "All relevant tests and builds pass.",
        ],
        "tasks": tasks,
    }


def _normalise_plan(raw: dict[str, Any], request: CollaborationDraftRequest, workers: list[str]) -> dict[str, Any]:
    project_path = Path(request.project_path).resolve()

    def valid_paths(values: list[Any], allow_new: bool) -> list[str]:
        result = set()
        for raw_path in values:
            path = _safe_relative_path(raw_path)
            if not path:
                continue
            candidate = project_path / Path(path)
            top_level = project_path / PurePosixPath(path).parts[0]
            # Resolve symlinks and confirm the real target stays inside the project.
            try:
                resolved = candidate.resolve()
                resolved.relative_to(project_path)
            except (OSError, ValueError):
                continue
            if candidate.exists() or (allow_new and top_level.exists()):
                result.add(path)
        return sorted(result)

    tasks = []
    seen_ids: set[str] = set()
    for index, item in enumerate(raw.get("tasks", [])[: request.max_tasks], start=1):
        if not isinstance(item, dict):
            continue
        task_id = str(item.get("task_id") or f"task-{index}").strip()
        if not task_id or task_id in seen_ids:
            task_id = f"task-{index}"
        seen_ids.add(task_id)
        read_paths = valid_paths(item.get("read_paths", []), allow_new=False)
        write_paths = valid_paths(item.get("write_paths", []), allow_new=True)
        if not read_paths and not write_paths:
            continue
        agent_id = str(item.get("agent_id") or "")
        if agent_id not in workers:
            agent_id = workers[(index - 1) % len(workers)]
        tasks.append(
            {
                "task_id": task_id,
                "agent_id": agent_id,
                "title": str(item.get("title") or task_id).strip(),
                "instructions": _sanitize_instructions(str(item.get("instructions") or "")),
                "read_paths": read_paths,
                "write_paths": write_paths,
                "depends_on": [str(dep).strip() for dep in item.get("depends_on", []) if str(dep).strip()],
            }
        )
    known_ids = {task["task_id"] for task in tasks}
    for task in tasks:
        task["depends_on"] = sorted({dep for dep in task["depends_on"] if dep in known_ids and dep != task["task_id"]})
    if not tasks:
        raise ValueError("Manager agent did not produce any usable tasks.")
    return {
        "analysis": str(raw.get("analysis") or "").strip(),
        "recommendations": [str(item).strip() for item in raw.get("recommendations", []) if str(item).strip()],
        "risks": [str(item).strip() for item in raw.get("risks", []) if str(item).strip()],
        "acceptance_criteria": [str(item).strip() for item in raw.get("acceptance_criteria", []) if str(item).strip()],
        "tasks": tasks,
    }


def generate_collaboration_draft(request: CollaborationDraftRequest) -> dict[str, Any]:
    project_path = Path(request.project_path).resolve()
    if not project_path.exists() or not project_path.is_dir():
        raise ValueError("project_path does not exist or is not a directory.")
    workers = _available_workers(request.worker_agent_ids)
    if not workers:
        raise ValueError("No callable worker agent is available.")
    if request.manager_agent_id not in workers:
        manager = get_local_tool(request.manager_agent_id)
        if manager.get("status") != "callable" or request.manager_agent_id not in LAUNCHABLE_AGENT_IDS:
            raise ValueError("The selected manager agent is not callable.")

    index = project_index_store.scan(str(project_path), 300_000)
    context = build_project_context(index.project_id, request.goal, [])
    summary = _project_summary(index, context)
    prompt = _planning_prompt(request, summary, context)
    mode = "agent"
    manager_error = ""
    try:
        raw = _run_manager(request, prompt)
        report = _normalise_plan(raw, request, workers)
    except (ValueError, json.JSONDecodeError) as exc:
        mode = "fallback"
        manager_error = str(exc)
        report = _normalise_plan(_fallback_plan(request, summary, context, workers, manager_error), request, workers)
    return {
        "mode": mode,
        "manager_agent_id": request.manager_agent_id,
        "manager_error": manager_error,
        "project_summary": summary,
        **report,
    }
