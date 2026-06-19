from __future__ import annotations

from pathlib import Path

import pytest

from backend.core.project_reader import is_path_allowed


@pytest.mark.parametrize(
    "raw_path, expected_allowed",
    [
        (r"C:\Projects\foo\myproject", True),
        (r"C:\projects\app", True),
        (r"C:\Windows\System32", False),
        (r"C:\Work\AppData\Local", False),
        (r"C:\Program Files\app", False),
        ("C:\\", False),
    ],
)
def test_is_path_allowed_matrix(raw_path: str, expected_allowed: bool):
    allowed, reason = is_path_allowed(Path(raw_path))
    assert allowed is expected_allowed
    if not allowed:
        assert reason  # a human-readable reason is always provided


def test_ordinary_c_drive_project_is_not_over_blocked():
    # Regression: a bare "c:\\" prefix used to reject every C: drive path,
    # including normal user projects.
    allowed, _ = is_path_allowed(Path(r"C:\Projects\dev\code\agent-relay"))
    assert allowed is True
