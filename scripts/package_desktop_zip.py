import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "内阁-ai-app"
OUT_DIR = ROOT / "dist-desktop"
UNPACKED_DIR = OUT_DIR / "win-unpacked"
ZIP_BASE = OUT_DIR / "agent-relay-win-x64"
NPM = shutil.which("npm.cmd") or shutil.which("npm") or "npm"


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def main() -> int:
    run([NPM, "run", "build"], FRONTEND_DIR)
    run([NPM, "run", "pack:dir", "--prefix", "desktop"], ROOT)

    executable = UNPACKED_DIR / "Agent Relay.exe"
    if not executable.exists():
        raise FileNotFoundError(f"Missing desktop executable: {executable}")

    zip_path = ZIP_BASE.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()
    shutil.make_archive(str(ZIP_BASE), "zip", UNPACKED_DIR)
    print(f"Desktop zip created: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
