# Desktop Plan (Tauri)

Current status: desktop skeleton implemented in `desktop/`.

Implemented:

- Tauri project skeleton
- `tauri.conf.json` with local URL `http://127.0.0.1:8000`
- Rust entrypoint checks backend health and starts `launch.py --no-browser` when backend is unavailable

Planned next steps:

1. Proper backend lifecycle management (start/stop hooks)
2. System tray integration
3. Installer packaging for Windows/macOS/Linux
4. Better desktop-mode detection and status in UI
5. Signed builds and update channel
