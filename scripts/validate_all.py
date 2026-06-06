from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(script: str, timeout_seconds: int = 60) -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script)],
        cwd=str(ROOT),
        shell=False,
        timeout=timeout_seconds,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> None:
    include_release = "--include-release" in sys.argv
    run("validate_round_workflow.py", timeout_seconds=60)
    run("validate_project_executor.py", timeout_seconds=60)
    run("validate_provider_runner.py", timeout_seconds=60)
    if include_release and (ROOT / "scripts" / "validate_release_ready.py").exists():
        run("validate_release_ready.py", timeout_seconds=60)
    print("Validation passed: validate_all includes round/project/provider workflows.")


if __name__ == "__main__":
    main()
