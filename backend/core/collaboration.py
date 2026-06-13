from __future__ import annotations

import json
import hashlib
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from threading import Lock
from uuid import uuid4

from backend.core.provider_detection import get_local_tool
from backend.schemas import CollaborationPlanCreateRequest, CollaborationTaskCreate


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalise_path(project_path: Path, raw_path: str) -> str:
    value = raw_path.strip().replace("\\", "/")
    if not value:
        raise ValueError("Declared paths cannot be empty.")
    candidate = Path(value)
    if candidate.is_absolute():
        try:
            value = candidate.resolve().relative_to(project_path).as_posix()
        except ValueError as exc:
            raise ValueError(f"Path is outside project: {raw_path}") from exc
    parts = PurePosixPath(value).parts
    if ".." in parts:
        raise ValueError(f"Path is outside project: {raw_path}")
    forbidden_parts = {".git", ".synapse", ".venv", "node_modules"}
    if any(part in forbidden_parts for part in parts):
        raise ValueError(f"Path is reserved and cannot be assigned to an agent: {raw_path}")
    normalised = PurePosixPath(*(part for part in parts if part != ".")).as_posix()
    if normalised in {"", "."}:
        raise ValueError(f"Path is outside project: {raw_path}")
    return normalised


def _paths_overlap(left: str, right: str) -> bool:
    left_parts = PurePosixPath(left).parts
    right_parts = PurePosixPath(right).parts
    shorter = min(len(left_parts), len(right_parts))
    return left_parts[:shorter] == right_parts[:shorter]


def _task_conflict(left: dict, right: dict) -> list[str]:
    reasons: list[str] = []
    for write_path in left["write_paths"]:
        for path in right["write_paths"]:
            if _paths_overlap(write_path, path):
                reasons.append(f"write/write: {write_path} <> {path}")
        for path in right["read_paths"]:
            if _paths_overlap(write_path, path):
                reasons.append(f"write/read: {write_path} <> {path}")
    for write_path in right["write_paths"]:
        for path in left["read_paths"]:
            if _paths_overlap(write_path, path):
                reasons.append(f"read/write: {path} <> {write_path}")
    return sorted(set(reasons))


def _project_snapshot(project_path: Path) -> dict[str, str]:
    ignored_dirs = {
        ".git",
        ".synapse",
        ".venv",
        "__pycache__",
        "node_modules",
        "dist",
        "dist-desktop",
        "build",
        "coverage",
    }
    snapshot: dict[str, str] = {}
    for path in project_path.rglob("*"):
        if path.is_symlink() or not path.is_file():
            continue
        relative = path.relative_to(project_path)
        if any(part in ignored_dirs for part in relative.parts):
            continue
        try:
            stat = path.stat()
            if stat.st_size <= 2_000_000:
                fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
            else:
                fingerprint = f"{stat.st_size}:{stat.st_mtime_ns}"
            snapshot[relative.as_posix()] = fingerprint
        except OSError:
            continue
    return snapshot


def _schedule(tasks: list[dict]) -> tuple[list[list[str]], list[dict]]:
    task_by_id = {task["task_id"]: task for task in tasks}
    pending = set(task_by_id)
    scheduled: set[str] = set()
    waves: list[list[str]] = []
    conflicts: list[dict] = []

    for index, left in enumerate(tasks):
        for right in tasks[index + 1 :]:
            reasons = _task_conflict(left, right)
            if reasons:
                conflicts.append(
                    {
                        "left_task_id": left["task_id"],
                        "right_task_id": right["task_id"],
                        "reasons": reasons,
                    }
                )

    while pending:
        ready = sorted(
            task_id
            for task_id in pending
            if set(task_by_id[task_id]["depends_on"]).issubset(scheduled)
        )
        if not ready:
            raise ValueError("Task dependencies contain a cycle or an unknown task_id.")

        wave: list[str] = []
        for task_id in ready:
            task = task_by_id[task_id]
            if all(not _task_conflict(task, task_by_id[selected]) for selected in wave):
                wave.append(task_id)

        waves.append(wave)
        scheduled.update(wave)
        pending.difference_update(wave)

    for wave_index, wave in enumerate(waves, start=1):
        for order_index, task_id in enumerate(wave, start=1):
            task_by_id[task_id]["wave"] = wave_index
            task_by_id[task_id]["order_in_wave"] = order_index

    return waves, conflicts


class CollaborationStore:
    def __init__(self, index_path: Path | None = None) -> None:
        self._plans: dict[str, dict] = {}
        self._processes: dict[tuple[str, str], subprocess.Popen] = {}
        self._log_files: dict[tuple[str, str], object] = {}
        self._baselines: dict[str, dict[str, str]] = {}
        self._lock = Lock()
        self._index_path = index_path
        self._load_index()

    def create(self, request: CollaborationPlanCreateRequest) -> dict:
        project_path = Path(request.project_path).resolve()
        if not project_path.exists() or not project_path.is_dir():
            raise ValueError("project_path does not exist or is not a directory.")

        task_ids = [task.task_id for task in request.tasks]
        if len(task_ids) != len(set(task_ids)):
            raise ValueError("task_id values must be unique.")
        known_ids = set(task_ids)

        tasks = [
            self._normalise_task(project_path, task, known_ids)
            for task in request.tasks
        ]
        waves, conflicts = _schedule(tasks)
        plan_id = str(uuid4())
        plan_dir = project_path / ".synapse" / "collaboration" / plan_id
        plan = {
            "plan_id": plan_id,
            "project_path": str(project_path),
            "goal": request.goal.strip(),
            "supervisor_agent_id": request.supervisor_agent_id,
            "status": "ready",
            "created_at": _now(),
            "updated_at": _now(),
            "waves": waves,
            "conflicts": conflicts,
            "locks": {},
            "boundary_report": {
                "changed_paths": [],
                "undeclared_changes": [],
                "ok": True,
            },
            "tasks": tasks,
            "events": [],
            "supervisor_run": {
                "status": "idle",
                "pid": None,
                "started_at": None,
                "finished_at": None,
                "exit_code": None,
                "log_path": None,
            },
            "shared_plan_path": str(plan_dir / "plan.json"),
            "event_log_path": str(plan_dir / "events.jsonl"),
        }
        self._plans[plan_id] = plan
        self._baselines[plan_id] = _project_snapshot(project_path)
        self._event(plan, "plan_created", {"waves": waves, "conflict_count": len(conflicts)})
        self._save(plan)
        return plan

    def list(self) -> list[dict]:
        return [self.get(plan_id) for plan_id in reversed(list(self._plans))]

    def get(self, plan_id: str) -> dict:
        plan = self._plans.get(plan_id)
        if plan is None:
            raise KeyError(f"Unknown plan_id: {plan_id}")
        self._refresh(plan)
        return plan

    def start_task(self, plan_id: str, task_id: str, confirm: bool) -> dict:
        if not confirm:
            raise ValueError("confirm=true is required before launching a local agent.")
        with self._lock:
            plan = self.get(plan_id)
            task = self._task(plan, task_id)
            if plan_id not in self._baselines:
                self._baselines[plan_id] = _project_snapshot(Path(plan["project_path"]))
            if task["status"] not in {"pending", "failed"}:
                raise ValueError(f"Task is not launchable from status={task['status']}.")
            incomplete = [
                item
                for item in task["depends_on"]
                if self._task(plan, item)["status"] != "completed"
            ]
            if incomplete:
                raise ValueError(f"Dependencies are not complete: {', '.join(incomplete)}")
            earlier_wave = [
                item["task_id"]
                for item in plan["tasks"]
                if item["wave"] < task["wave"] and item["status"] != "completed"
            ]
            if earlier_wave:
                raise ValueError(f"Earlier wave is not complete: {', '.join(earlier_wave)}")
            blockers = self._lock_blockers(plan, task)
            if blockers:
                raise ValueError(f"Declared path lock conflict: {', '.join(blockers)}")

            command = self._command(task["agent_id"], self.task_prompt(plan_id, task_id))
            log_path = Path(plan["project_path"]) / ".synapse" / "collaboration" / plan_id / f"{task_id}.log"
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_file = log_path.open("w", encoding="utf-8")
            try:
                process = subprocess.Popen(
                    command,
                    cwd=plan["project_path"],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    text=True,
                    shell=False,
                )
            except OSError as exc:
                log_file.close()
                raise ValueError(f"Failed to launch {task['agent_id']}: {exc}") from exc
            self._processes[(plan_id, task_id)] = process
            self._log_files[(plan_id, task_id)] = log_file
            plan["status"] = "running"
            task.update(
                {
                    "status": "running",
                    "pid": process.pid,
                    "started_at": _now(),
                    "finished_at": None,
                    "exit_code": None,
                    "log_path": str(log_path),
                    "command_preview": command[:-1] + ["<collaboration-prompt>"],
                }
            )
            for path in task["write_paths"]:
                plan["locks"][path] = task_id
            self._event(plan, "task_started", {"task_id": task_id, "pid": process.pid})
            self._save(plan)
            return task

    def start_supervisor(self, plan_id: str, confirm: bool) -> dict:
        if not confirm:
            raise ValueError("confirm=true is required before launching the supervisor agent.")
        with self._lock:
            plan = self.get(plan_id)
            agent_id = plan.get("supervisor_agent_id")
            if not agent_id:
                raise ValueError("No supervisor_agent_id is configured for this plan.")
            supervisor_run = plan["supervisor_run"]
            if supervisor_run["status"] == "running":
                raise ValueError("Supervisor is already running.")
            command = self._command(agent_id, self.supervisor_prompt(plan_id))
            log_path = Path(plan["project_path"]) / ".synapse" / "collaboration" / plan_id / "supervisor.log"
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_file = log_path.open("w", encoding="utf-8")
            try:
                process = subprocess.Popen(
                    command,
                    cwd=plan["project_path"],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    text=True,
                    shell=False,
                )
            except OSError as exc:
                log_file.close()
                raise ValueError(f"Failed to launch supervisor {agent_id}: {exc}") from exc
            key = (plan_id, "__supervisor__")
            self._processes[key] = process
            self._log_files[key] = log_file
            supervisor_run.update(
                {
                    "status": "running",
                    "pid": process.pid,
                    "started_at": _now(),
                    "finished_at": None,
                    "exit_code": None,
                    "log_path": str(log_path),
                }
            )
            self._event(plan, "supervisor_started", {"agent_id": agent_id, "pid": process.pid})
            self._save(plan)
            return supervisor_run

    def add_advice(self, plan_id: str, advice: str, target_task_ids: list[str]) -> dict:
        plan = self.get(plan_id)
        for task_id in target_task_ids:
            self._task(plan, task_id)
        item = {
            "advice_id": str(uuid4()),
            "from_agent_id": plan.get("supervisor_agent_id") or "user",
            "target_task_ids": target_task_ids,
            "content": advice.strip(),
            "created_at": _now(),
        }
        self._event(plan, "supervisor_advice", item)
        self._save(plan)
        return item

    def task_prompt(self, plan_id: str, task_id: str) -> str:
        plan = self.get(plan_id)
        task = self._task(plan, task_id)
        advice = [
            event["payload"]["content"]
            for event in plan["events"]
            if event["type"] == "supervisor_advice"
            and (not event["payload"]["target_task_ids"] or task_id in event["payload"]["target_task_ids"])
        ]
        return "\n".join(
            [
                "You are working under a strict local-agent collaboration contract.",
                f"Shared plan: {plan['shared_plan_path']}",
                f"Project: {plan['project_path']}",
                f"Goal: {plan['goal']}",
                f"Your task id: {task_id}",
                f"Your task: {task['title']}",
                f"Instructions: {task['instructions']}",
                f"Read only these declared paths: {', '.join(task['read_paths']) or '(none)'}",
                f"Write only these declared paths: {', '.join(task['write_paths']) or '(none)'}",
                f"Dependencies already completed before you start: {', '.join(task['depends_on']) or '(none)'}",
                f"Supervisor advice: {' | '.join(advice) or '(none)'}",
                "",
                "Before editing, print a short execution report listing the files you will read and modify.",
                "Do not read or modify paths outside the declarations.",
                "Do not revert another agent's work. Read the shared plan before each write.",
                "When done, report modified files, validations run, and any remaining risk.",
            ]
        )

    def supervisor_prompt(self, plan_id: str) -> str:
        plan = self.get(plan_id)
        task_lines = [
            (
                f"- {task['task_id']} agent={task['agent_id']} status={task['status']} wave={task['wave']} "
                f"reads={task['read_paths']} writes={task['write_paths']}"
            )
            for task in plan["tasks"]
        ]
        return "\n".join(
            [
                "You are the supervisor agent. Monitor only; do not modify project files.",
                f"Shared plan: {plan['shared_plan_path']}",
                f"Goal: {plan['goal']}",
                *task_lines,
                "",
                "Check task boundaries, missing dependencies, risky overlap, and validation gaps.",
                "Return concise advice addressed to specific task ids.",
            ]
        )

    def _normalise_task(self, project_path: Path, task: CollaborationTaskCreate, known_ids: set[str]) -> dict:
        unknown = sorted(set(task.depends_on) - known_ids)
        if unknown:
            raise ValueError(f"Unknown depends_on task_id: {', '.join(unknown)}")
        if task.task_id in task.depends_on:
            raise ValueError(f"Task cannot depend on itself: {task.task_id}")
        read_paths = sorted({_normalise_path(project_path, path) for path in task.read_paths})
        write_paths = sorted({_normalise_path(project_path, path) for path in task.write_paths})
        if not read_paths and not write_paths:
            raise ValueError(f"Task {task.task_id} must declare read_paths or write_paths.")
        return {
            "task_id": task.task_id,
            "agent_id": task.agent_id,
            "title": task.title.strip(),
            "instructions": task.instructions.strip(),
            "read_paths": read_paths,
            "write_paths": write_paths,
            "depends_on": sorted(set(task.depends_on)),
            "status": "pending",
            "wave": 0,
            "order_in_wave": 0,
            "pid": None,
            "started_at": None,
            "finished_at": None,
            "exit_code": None,
            "log_path": None,
            "command_preview": [],
        }

    def _command(self, agent_id: str, prompt: str) -> list[str]:
        command_map = {
            "cli.codex": ("codex", ["exec"]),
            "cli.claude_code": ("claude", ["-p"]),
            "cli.gemini": ("gemini", ["-p"]),
            "cli.opencode": ("opencode", ["run"]),
        }
        item = command_map.get(agent_id)
        if item is None:
            raise ValueError(f"Agent cannot be launched by this app: {agent_id}")
        binary, args = item
        info = get_local_tool(agent_id)
        executable = info.get("executablePath") or shutil.which(binary)
        if not executable:
            raise ValueError(f"Agent executable is not available: {agent_id}")
        return [str(executable), *args, prompt]

    def _task(self, plan: dict, task_id: str) -> dict:
        task = next((item for item in plan["tasks"] if item["task_id"] == task_id), None)
        if task is None:
            raise KeyError(f"Unknown task_id: {task_id}")
        return task

    def _lock_blockers(self, plan: dict, task: dict) -> list[str]:
        blockers = []
        for declared in [*task["read_paths"], *task["write_paths"]]:
            for locked_path, owner in plan["locks"].items():
                if owner != task["task_id"] and _paths_overlap(declared, locked_path):
                    blockers.append(f"{declared} locked by {owner}")
        return sorted(set(blockers))

    def _refresh(self, plan: dict) -> None:
        changed = False
        for task in plan["tasks"]:
            if task["status"] != "running":
                continue
            process = self._processes.get((plan["plan_id"], task["task_id"]))
            if process is None:
                continue
            exit_code = process.poll()
            if exit_code is None:
                continue
            task["status"] = "completed" if exit_code == 0 else "failed"
            task["exit_code"] = exit_code
            task["finished_at"] = _now()
            plan["locks"] = {
                path: owner
                for path, owner in plan["locks"].items()
                if owner != task["task_id"]
            }
            self._event(
                plan,
                "task_finished",
                {"task_id": task["task_id"], "exit_code": exit_code, "status": task["status"]},
            )
            self._processes.pop((plan["plan_id"], task["task_id"]), None)
            log_file = self._log_files.pop((plan["plan_id"], task["task_id"]), None)
            if log_file:
                log_file.close()
            changed = True
        supervisor_run = plan.get("supervisor_run", {})
        if supervisor_run.get("status") == "running":
            key = (plan["plan_id"], "__supervisor__")
            process = self._processes.get(key)
            exit_code = process.poll() if process else None
            if exit_code is not None:
                log_file = self._log_files.pop(key, None)
                if log_file:
                    log_file.close()
                log_path = Path(supervisor_run["log_path"])
                output = log_path.read_text(encoding="utf-8", errors="ignore")[-6000:] if log_path.exists() else ""
                supervisor_run.update(
                    {
                        "status": "completed" if exit_code == 0 else "failed",
                        "finished_at": _now(),
                        "exit_code": exit_code,
                    }
                )
                self._processes.pop(key, None)
                self._event(
                    plan,
                    "supervisor_advice",
                    {
                        "advice_id": str(uuid4()),
                        "from_agent_id": plan.get("supervisor_agent_id"),
                        "target_task_ids": [],
                        "content": output or f"Supervisor exited with code {exit_code} without output.",
                        "created_at": _now(),
                    },
                )
                changed = True
        statuses = {task["status"] for task in plan["tasks"]}
        if statuses and statuses.issubset({"completed", "failed"}):
            self._update_boundary_report(plan)
        if statuses == {"completed"}:
            plan["status"] = "completed" if plan["boundary_report"]["ok"] else "needs_attention"
            changed = True
        elif "running" in statuses:
            plan["status"] = "running"
        elif "failed" in statuses:
            plan["status"] = "needs_attention"
        if changed:
            self._save(plan)

    def _update_boundary_report(self, plan: dict) -> None:
        baseline = self._baselines.get(plan["plan_id"])
        if baseline is None:
            return
        current = _project_snapshot(Path(plan["project_path"]))
        changed_paths = sorted(
            path
            for path in set(baseline) | set(current)
            if baseline.get(path) != current.get(path)
        )
        allowed_write_paths = [
            path
            for task in plan["tasks"]
            for path in task["write_paths"]
        ]
        undeclared = [
            path
            for path in changed_paths
            if not any(_paths_overlap(path, allowed) for allowed in allowed_write_paths)
        ]
        plan["boundary_report"] = {
            "changed_paths": changed_paths,
            "undeclared_changes": undeclared,
            "ok": not undeclared,
        }

    def _event(self, plan: dict, event_type: str, payload: dict) -> None:
        plan["events"].append(
            {
                "event_id": str(uuid4()),
                "type": event_type,
                "created_at": _now(),
                "payload": payload,
            }
        )
        plan["events"] = plan["events"][-200:]
        plan["updated_at"] = _now()

    def _save(self, plan: dict) -> None:
        plan_path = Path(plan["shared_plan_path"])
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        event_path = Path(plan["event_log_path"])
        event_path.write_text(
            "\n".join(json.dumps(item, ensure_ascii=False) for item in plan["events"]) + "\n",
            encoding="utf-8",
        )
        if self._index_path:
            self._index_path.parent.mkdir(parents=True, exist_ok=True)
            self._index_path.write_text(
                json.dumps(
                    {"plan_paths": [item["shared_plan_path"] for item in self._plans.values()]},
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

    def _load_index(self) -> None:
        if not self._index_path or not self._index_path.exists():
            return
        try:
            data = json.loads(self._index_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        for raw_path in data.get("plan_paths", []):
            plan_path = Path(raw_path)
            if not plan_path.exists():
                continue
            try:
                plan = json.loads(plan_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            for task in plan.get("tasks", []):
                if task.get("status") == "running":
                    task["status"] = "failed"
                    task["finished_at"] = _now()
                    task["exit_code"] = None
            supervisor_run = plan.get("supervisor_run", {})
            if supervisor_run.get("status") == "running":
                supervisor_run["status"] = "failed"
                supervisor_run["finished_at"] = _now()
            plan["locks"] = {}
            if any(task.get("status") == "failed" for task in plan.get("tasks", [])):
                plan["status"] = "needs_attention"
            plan_id = plan.get("plan_id")
            project_path = Path(plan.get("project_path", ""))
            if plan_id and project_path.exists():
                self._plans[plan_id] = plan


collaboration_store = CollaborationStore(Path.home() / ".agent-relay" / "plans.json")
