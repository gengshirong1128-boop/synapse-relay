from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def file_contains(path: Path, text: str) -> bool:
    if not path.exists():
        return False
    return text in path.read_text(encoding='utf-8', errors='ignore')


def main() -> None:
    readme = ROOT / 'README.md'
    assert_true(readme.exists(), 'README.md missing')
    assert_true(file_contains(readme, 'Synapse Relay'), 'README.md missing Synapse Relay')

    assert_true((ROOT / 'LICENSE').exists(), 'LICENSE missing')
    assert_true((ROOT / 'release_check.ps1').exists(), 'release_check.ps1 missing')
    assert_true((ROOT / 'start_windows.bat').exists(), 'start_windows.bat missing')

    react_app = ROOT / '内阁-ai-app'
    react_src = react_app / 'src'
    react_dist = react_app / 'dist'
    assert_true((react_app / 'package.json').exists(), '内阁-ai-app/package.json missing')
    assert_true((react_src / 'App.tsx').exists(), '内阁-ai-app/src/App.tsx missing')
    assert_true((react_dist / 'index.html').exists(), '内阁-ai-app/dist/index.html missing')

    backend_main = ROOT / 'backend' / 'main.py'
    assert_true(backend_main.exists(), 'backend/main.py missing')

    provider_api_strings = [
        '/provider-profiles',
        '/credentials',
        '/provider-profiles/',
        '/diagnose',
    ]
    for s in provider_api_strings:
        assert_true(file_contains(backend_main, s), f'backend/main.py missing provider api string: {s}')

    target_api_strings = [
        '/app-targets/claude-code/preview',
        '/app-targets/claude-code/export',
        '/app-targets/codex/preview',
        '/app-targets/codex/export',
    ]
    for s in target_api_strings:
        assert_true(file_contains(backend_main, s), f'backend/main.py missing app-target api string: {s}')

    executor_api_strings = [
        '/executor/check/codex',
        '/executor/check/claude-code',
        '/executor/run/confirm',
        '/executor/run/codex',
        '/executor/run/claude-code',
        '/executor/runs',
    ]
    for s in executor_api_strings:
        assert_true(file_contains(backend_main, s), f'backend/main.py missing executor api string: {s}')

    desktop_dir = ROOT / 'desktop'
    assert_true((desktop_dir / 'src-tauri' / 'tauri.conf.json').exists(), 'desktop tauri.conf.json missing')

    release_endpoints = ['/api/debate', '/api/finalize', '/system/self-check', '/ai-members']
    for s in release_endpoints:
        assert_true(file_contains(backend_main, s), f'backend/main.py missing release endpoint: {s}')

    print('Validation passed: release readiness checks are working.')


if __name__ == '__main__':
    main()
