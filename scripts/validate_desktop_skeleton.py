from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    desktop = ROOT / 'desktop'
    tauri_conf = desktop / 'src-tauri' / 'tauri.conf.json'
    main_rs = desktop / 'src-tauri' / 'src' / 'main.rs'
    package_json = desktop / 'package.json'
    electron_main = desktop / 'main.cjs'
    launcher = ROOT / '启动内阁桌面版.bat'

    assert_true(desktop.exists(), 'desktop directory missing')
    assert_true(tauri_conf.exists(), 'tauri.conf.json missing')
    assert_true(main_rs.exists(), 'desktop main.rs missing')
    assert_true(package_json.exists(), 'desktop package.json missing')
    assert_true(electron_main.exists(), 'desktop Electron main.cjs missing')
    assert_true(launcher.exists(), 'desktop launcher bat missing')

    package_text = package_json.read_text(encoding='utf-8')
    main_text = electron_main.read_text(encoding='utf-8')
    assert_true('"start": "electron ."' in package_text, 'Electron start script missing')
    assert_true('launch.py' in main_text and '--no-browser' in main_text, 'backend autostart missing')
    assert_true('127.0.0.1:8000' in main_text, 'desktop app URL missing')

    print('Validation passed: desktop shell exists and auto-starts backend.')


if __name__ == '__main__':
    main()
