from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SECRET_PATTERNS = [
    re.compile(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"Bearer\s+[A-Za-z0-9._-]{24,}", re.IGNORECASE),
]

ABSOLUTE_PATH_PATTERNS = [
    re.compile(r"[A-Za-z]:\\Users\\[^\\\r\n]+", re.IGNORECASE),
    re.compile(r"/(?:Users|home)/[^/\r\n]+"),
]

ALLOWED_COMMIT_EMAIL_SUFFIXES = (
    "@users.noreply.github.com",
    "@synapse-relay.local",
)


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    return result.stdout


def tracked_files() -> list[Path]:
    return [
        ROOT / item
        for item in run_git("ls-files", "-z").split("\0")
        if item
    ]


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def scan_tracked_files() -> None:
    tracked = tracked_files()
    tracked_names = {path.relative_to(ROOT).as_posix() for path in tracked}
    assert_true(".env" not in tracked_names, ".env must never be tracked")

    for path in tracked:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                raise AssertionError(f"possible secret leaked in tracked file: {path.relative_to(ROOT)}")
        for pattern in ABSOLUTE_PATH_PATTERNS:
            if pattern.search(text):
                raise AssertionError(f"personal absolute path leaked in tracked file: {path.relative_to(ROOT)}")


def scan_commit_metadata() -> None:
    metadata = run_git("log", "--all", "--format=%H%x09%an%x09%ae%x09%cn%x09%ce")
    for line in metadata.splitlines():
        commit, author_name, author_email, committer_name, committer_email = line.split("\t", 4)
        for name in (author_name, committer_name):
            assert_true("@" not in name and "\\" not in name, f"suspicious identity in commit metadata: {commit}")
        for email in (author_email, committer_email):
            assert_true(
                email.endswith(ALLOWED_COMMIT_EMAIL_SUFFIXES),
                f"personal email in commit metadata: {commit}",
            )


def main() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8", errors="ignore")
    assert_true(".env" in gitignore, ".gitignore missing .env")
    assert_true(".synapse/" in gitignore, ".gitignore missing .synapse/")
    scan_tracked_files()
    scan_commit_metadata()
    print("Validation passed: tracked files and commit metadata contain no detected secrets or personal paths.")


if __name__ == "__main__":
    main()
