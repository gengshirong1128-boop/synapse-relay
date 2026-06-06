from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    ROOT / 'frontend' / 'index.html',
    ROOT / 'frontend' / 'app.js',
    ROOT / 'frontend' / 'style.css',
]

BAD_PATTERNS = [
    'ï»¿',
    '�',
    'Ã',
    'â€',
    '\ufffd',
]


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    for path in FILES:
        assert_true(path.exists(), f'missing file: {path}')
        text = path.read_text(encoding='utf-8', errors='strict')
        for bad in BAD_PATTERNS:
            assert_true(bad not in text, f'possible mojibake in {path.name}: {bad}')

    html_text = FILES[0].read_text(encoding='utf-8')
    assert_true('<meta charset="UTF-8"' in html_text, 'index.html missing UTF-8 meta charset')

    print('Validation passed: frontend encoding looks clean.')


if __name__ == '__main__':
    main()
