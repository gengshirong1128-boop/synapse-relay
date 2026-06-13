from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='ignore')


def main() -> None:
    react_index = ROOT / '内阁-ai-app' / 'dist' / 'index.html'
    react_src = ROOT / '内阁-ai-app' / 'src'
    if react_index.exists() and react_src.exists():
        src_text = '\n'.join(read(path) for path in react_src.rglob('*.tsx'))
        required = [
            '/orchestration/agents',
            '/orchestration/plans',
            'read_paths',
            'write_paths',
            'supervisor_agent_id',
            '生成无冲突执行计划',
        ]
        for item in required:
            assert_true(item in src_text, f'React orchestration UI missing: {item}')
        assert_true(not (react_src / 'components' / 'ImageStudio.tsx').exists(), 'obsolete ImageStudio remains')
        assert_true(not (react_src / 'components' / 'CabinetMeeting.tsx').exists(), 'obsolete CabinetMeeting remains')
        print('Validation passed: Agent Relay frontend integrity checks are working.')
        return

    index_html = ROOT / 'frontend' / 'index.html'
    app_js = ROOT / 'frontend' / 'app.js'
    style_css = ROOT / 'frontend' / 'style.css'

    assert_true(index_html.exists(), 'frontend/index.html missing')
    assert_true(app_js.exists(), 'frontend/app.js missing')
    assert_true(style_css.exists(), 'frontend/style.css missing')

    index_text = read(index_html)
    app_text = read(app_js)

    assert_true('内阁' in index_text or '内阁' in app_text, 'UI name 内阁 not found')
    assert_true('lang-zh-btn' in index_text and 'lang-en-btn' in index_text, 'language switch buttons missing')
    assert_true('const i18n =' in app_text, 'i18n dictionary missing in app.js')

    required_api_paths = [
        '/room/create',
        '/demo/create-room',
        '/room/',
        '/project/scan',
        '/project/',
        '/provider-profiles',
        '/credentials',
        '/executor/export/codex',
        '/executor/export/claude-code',
        '/executor/run/codex',
        '/executor/run/claude-code',
        '/executor/check/codex',
        '/executor/check/claude-code',
        '/app-targets/claude-code/preview',
        '/app-targets/codex/preview',
        '/history/rooms',
        '/history/search',
        '/history/rooms/',
    ]
    for path in required_api_paths:
        assert_true(path in app_text, f'missing API path in app.js: {path}')

    assert_true('src="/frontend/app.js"' in index_text, 'frontend entry mismatch')
    assert_true('history-list' in index_text, 'history list area missing in index.html')
    assert_true('history-search-input' in index_text, 'history search input missing in index.html')
    assert_true('history-rename-btn' in app_text or '/rename' in app_text, 'history rename action missing')
    assert_true('history-delete-btn' in app_text or 'DELETE' in app_text, 'history delete action missing')
    assert_true('history-export-btn' in app_text or '/export' in app_text, 'history export action missing')

    print('Validation passed: frontend integrity checks are working.')


if __name__ == '__main__':
    main()
