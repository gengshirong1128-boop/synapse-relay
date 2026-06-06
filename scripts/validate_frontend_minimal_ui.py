from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8', errors='ignore')


def main() -> None:
    html = ROOT / 'frontend' / 'index.html'
    js = ROOT / 'frontend' / 'app.js'
    css = ROOT / 'frontend' / 'style.css'

    assert_true(html.exists() and js.exists() and css.exists(), 'frontend core files missing')

    h = read(html)
    a = read(js)

    assert_true('内阁' in h or '内阁' in a, 'UI name 内阁 missing')
    assert_true('right-drawer' in h or 'side-panel' in h, 'drawer/side-panel structure missing')
    assert_true('const i18n' in a, 'i18n dictionary missing in app.js')
    assert_true('currentLang' in a and '"zh"' in a, 'default zh language missing')
    assert_true('lang-zh-btn' in h and 'lang-en-btn' in h, 'language switch buttons missing')
    assert_true('more-btn' in h, 'more entry missing')

    required_api_strings = [
        '/provider-profiles', '/credentials', '/project/scan', '/executor/export/codex',
        '/executor/export/claude-code', '/executor/run/codex', '/executor/run/claude-code',
        '/app-targets/claude-code/preview', '/app-targets/codex/preview', '/room/create', '/demo/create-room'
    ]
    for s in required_api_strings:
        assert_true(s in a, f'missing API string: {s}')

    assert_true('src="/frontend/app.js"' in h, 'unexpected frontend entry point changed')

    print('Validation passed: minimal UI frontend checks are working.')


if __name__ == '__main__':
    main()
