from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.core.executors.runner import _rejected_arg, run_executor
from backend.schemas import ExecutorRunRequest


def test_rejected_arg_flags_known_bypasses():
    assert _rejected_arg(["--dangerously-skip-permissions"]) == "--dangerously-skip-permissions"
    assert _rejected_arg(["--yolo"]) == "--yolo"
    assert _rejected_arg(["--Full-Auto"]) == "--Full-Auto"  # case-insensitive
    assert _rejected_arg(["--no-sandbox=1"]) == "--no-sandbox=1"  # substring match


def test_rejected_arg_allows_safe_args():
    assert _rejected_arg([]) is None
    assert _rejected_arg(["--model", "opus", "-v"]) is None


def test_run_executor_blocks_bypass_flag(tmp_path: Path):
    request = ExecutorRunRequest(
        executor_type="claude_code",
        project_path=str(tmp_path),
        prompt="do something",
        dry_run=True,
        extra_args=["--dangerously-skip-permissions"],
    )
    result = run_executor(request, str(tmp_path))
    assert result.error is not None
    assert "blocked sandbox/permission bypass" in result.error
    assert result.started is False


def test_executor_request_rejects_oversized_prompt():
    with pytest.raises(ValidationError):
        ExecutorRunRequest(executor_type="codex", project_path="/p", prompt="x" * 100_001)


def test_executor_request_rejects_out_of_range_timeout():
    with pytest.raises(ValidationError):
        ExecutorRunRequest(executor_type="codex", project_path="/p", prompt="hi", timeout_seconds=0)
    with pytest.raises(ValidationError):
        ExecutorRunRequest(executor_type="codex", project_path="/p", prompt="hi", timeout_seconds=99_999)


def test_executor_request_rejects_too_many_extra_args():
    with pytest.raises(ValidationError):
        ExecutorRunRequest(
            executor_type="codex",
            project_path="/p",
            prompt="hi",
            extra_args=[f"--flag{i}" for i in range(65)],
        )
