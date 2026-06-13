from __future__ import annotations

import secrets
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from backend.schemas import ExecutorRunRequest, ExecutorRunResult


class _RunStore:
    def __init__(self) -> None:
        self._confirm_tokens: dict[str, dict] = {}
        self._runs: list[dict] = []

    def issue_confirmation_token(self, executor_type: str, project_path: str) -> str:
        token = secrets.token_urlsafe(24)
        self._confirm_tokens[token] = {
            "executor_type": executor_type,
            "project_path": str(Path(project_path).resolve()),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        return token

    def verify_confirmation_token(self, token: str, executor_type: str, project_path: str) -> bool:
        data = self._confirm_tokens.get(token)
        if not data:
            return False
        if data["executor_type"] != executor_type:
            return False
        if data["project_path"] != str(Path(project_path).resolve()):
            return False
        if data["expires_at"] < datetime.now(timezone.utc):
            return False
        return True

    def add_run(self, run_record: dict) -> None:
        self._runs.insert(0, run_record)
        self._runs = self._runs[:100]

    def list_runs(self) -> list[dict]:
        return self._runs

    def get_run(self, run_id: str) -> dict | None:
        return next((item for item in self._runs if item["run_id"] == run_id), None)


run_store = _RunStore()


def _safe_under_project(path: Path, project_path: Path) -> bool:
    try:
        path.resolve().relative_to(project_path.resolve())
        return True
    except Exception:  # noqa: BLE001
        return False


def _write_prompt_file(project_path: Path, filename: str, prompt: str) -> Path:
    target_dir = project_path / ".synapse" / "execution"
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    file_path.write_text(prompt, encoding="utf-8")
    return file_path


def check_executor(binary: str, help_args: list[str] | None = None) -> dict:
    path = shutil.which(binary)
    if path is None:
        return {
            "installed": False,
            "binary": binary,
            "path": None,
            "version": "",
            "help_excerpt": "",
            "supported_modes": [],
            "recommended_command": "",
        }

    # Fast check only: avoid potentially long `--help` calls.
    version_output = ""
    try:
        version_run = subprocess.run([binary, "--version"], capture_output=True, text=True, timeout=5, shell=False)
        version_output = (version_run.stdout or version_run.stderr or "")[:400]
    except Exception:  # noqa: BLE001
        version_output = ""

    if binary == "codex":
        supported_modes = ["exec", "prompt"]
        recommended = "codex exec \"<prompt>\""
    else:
        supported_modes = ["-p", "interactive"]
        recommended = "claude -p \"<prompt>\""

    return {
        "installed": True,
        "binary": binary,
        "path": path,
        "version": version_output.strip(),
        "help_excerpt": "fast-check mode: help probing skipped",
        "supported_modes": supported_modes,
        "recommended_command": recommended,
    }


def build_confirmation_token(executor_type: str, project_path: str) -> dict:
    token = run_store.issue_confirmation_token(executor_type, project_path)
    return {
        "executor_type": executor_type,
        "project_path": str(Path(project_path).resolve()),
        "confirmation_token": token,
        "expires_in_seconds": 600,
    }


def _new_run_record(request: ExecutorRunRequest, command: list[str], prompt_file: str) -> dict:
    return {
        "run_id": str(uuid4()),
        "executor_type": request.executor_type,
        "project_path": request.project_path,
        "prompt_file": prompt_file,
        "command_preview": command,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "exit_code": None,
        "stdout_excerpt": "",
        "stderr_excerpt": "",
        "dry_run": request.dry_run,
    }


def run_executor(request: ExecutorRunRequest, room_project_path: str) -> ExecutorRunResult:
    project_path = Path(request.project_path).resolve()
    bound_path = Path(room_project_path).resolve()
    if project_path != bound_path:
        return ExecutorRunResult(
            executor_type=request.executor_type,
            dry_run=request.dry_run,
            error="project_path must match attached room project path.",
        )
    if not project_path.exists() or not project_path.is_dir():
        return ExecutorRunResult(
            executor_type=request.executor_type,
            dry_run=request.dry_run,
            error="project_path does not exist or is not a directory.",
        )

    binary = "codex" if request.executor_type == "codex" else "claude"
    check = check_executor(binary)

    prompt = request.prompt.strip()
    if not prompt and request.prompt_file:
        file_path = Path(request.prompt_file)
        if not _safe_under_project(file_path, project_path):
            return ExecutorRunResult(
                executor_type=request.executor_type,
                dry_run=request.dry_run,
                error="prompt_file must be inside project_path.",
            )
        prompt = file_path.read_text(encoding="utf-8", errors="ignore")
    if not prompt:
        return ExecutorRunResult(
            executor_type=request.executor_type,
            dry_run=request.dry_run,
            error="prompt is empty.",
        )

    prompt_filename = "codex_prompt.md" if request.executor_type == "codex" else "claude_code_prompt.md"
    prompt_file = _write_prompt_file(project_path, prompt_filename, prompt)

    if request.executor_type == "codex":
        command = [binary, "exec", prompt, *request.extra_args]
    else:
        command = [binary, "-p", prompt, *request.extra_args]

    run_record = _new_run_record(request, command, str(prompt_file))
    result = ExecutorRunResult(
        run_id=run_record["run_id"],
        executor_type=request.executor_type,
        command_preview=command,
        prompt_file=str(prompt_file),
        dry_run=request.dry_run,
    )

    if request.dry_run:
        if not check["installed"]:
            result.error = f"{binary} is not available on this machine. Preview only."
        run_record["finished_at"] = datetime.now(timezone.utc).isoformat()
        run_store.add_run(run_record)
        return result

    if not check["installed"]:
        result.error = f"{binary} is not available on this machine."
        run_record["finished_at"] = datetime.now(timezone.utc).isoformat()
        run_record["stderr_excerpt"] = result.error
        run_store.add_run(run_record)
        return result

    if not request.confirmation_token or not run_store.verify_confirmation_token(
        request.confirmation_token,
        request.executor_type,
        str(project_path),
    ):
        result.error = "confirmation_token is required for non-dry-run execution."
        result.require_confirmation_token = True
        result.confirmation_hint = "Call POST /executor/run/confirm first, then retry with returned token."
        run_record["finished_at"] = datetime.now(timezone.utc).isoformat()
        run_record["stderr_excerpt"] = result.error
        run_store.add_run(run_record)
        return result

    try:
        completed = subprocess.run(
            command,
            cwd=str(project_path),
            capture_output=True,
            text=True,
            timeout=max(request.timeout_seconds, 1),
            shell=False,
        )
        result.started = True
        result.exit_code = completed.returncode
        result.stdout = (completed.stdout or "")[:12000]
        result.stderr = (completed.stderr or "")[:12000]
        run_record["exit_code"] = completed.returncode
        run_record["stdout_excerpt"] = result.stdout[:1200]
        run_record["stderr_excerpt"] = result.stderr[:1200]
    except subprocess.TimeoutExpired as exc:
        result.started = True
        result.error = f"timeout: {exc}"
        run_record["stderr_excerpt"] = result.error
    except Exception as exc:  # noqa: BLE001
        result.error = str(exc)
        run_record["stderr_excerpt"] = result.error

    run_record["finished_at"] = datetime.now(timezone.utc).isoformat()
    run_store.add_run(run_record)
    return result
