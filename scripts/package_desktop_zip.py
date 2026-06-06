import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "内阁-ai-app"
OUT_DIR = ROOT / "dist-desktop"
UNPACKED_DIR = OUT_DIR / "win-unpacked"
ZIP_BASE = OUT_DIR / "neige-desktop-win-x64"
NPM = shutil.which("npm.cmd") or shutil.which("npm") or "npm"


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def main() -> int:
    run([NPM, "run", "build"], FRONTEND_DIR)
    run([NPM, "run", "pack:dir", "--prefix", "desktop"], ROOT)

    if not (UNPACKED_DIR / "内阁.exe").exists():
        raise FileNotFoundError(f"Missing desktop executable: {UNPACKED_DIR / '内阁.exe'}")

    zip_path = ZIP_BASE.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()
    shutil.make_archive(str(ZIP_BASE), "zip", UNPACKED_DIR)
    print(f"Desktop zip created: {zip_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
