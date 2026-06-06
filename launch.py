from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"
REACT_FRONTEND = ROOT / "内阁-ai-app"


def port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def ensure_env_file() -> None:
    env_file = ROOT / ".env"
    example = ROOT / ".env.example"
    if not env_file.exists() and example.exists():
        env_file.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")


def choose_python() -> str:
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    return sys.executable


def ensure_requirements(python_bin: str) -> None:
    req = ROOT / "requirements.txt"
    if not req.exists():
        return
    subprocess.run([python_bin, "-m", "pip", "install", "-r", str(req)], cwd=str(ROOT), check=False, shell=False)


def ensure_react_frontend() -> None:
    package_json = REACT_FRONTEND / "package.json"
    if not package_json.exists():
        return
    node_modules = REACT_FRONTEND / "node_modules"
    dist_index = REACT_FRONTEND / "dist" / "index.html"
    if not node_modules.exists():
        subprocess.run(["npm.cmd", "install"], cwd=str(REACT_FRONTEND), check=True, shell=False)
    if not dist_index.exists():
        subprocess.run(["npm.cmd", "run", "build"], cwd=str(REACT_FRONTEND), check=True, shell=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if port_in_use(args.host, args.port):
        print(f"Synapse Relay is already running at http://{args.host}:{args.port}")
        if not args.no_browser:
            webbrowser.open(f"http://{args.host}:{args.port}")
        return 0

    ensure_env_file()
    python_bin = choose_python()
    ensure_requirements(python_bin)
    ensure_react_frontend()

    cmd = [
        python_bin,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]

    print("Starting Synapse Relay backend...")
    process = subprocess.Popen(cmd, cwd=str(ROOT), shell=False)
    print(f"Backend PID: {process.pid}")
    if not args.no_browser:
        webbrowser.open(f"http://{args.host}:{args.port}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
