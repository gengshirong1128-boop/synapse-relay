from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def main() -> None:
    html = ROOT / "frontend" / "index.html"
    js = ROOT / "frontend" / "app.js"
    assert_true(html.exists(), "frontend/index.html missing")
    assert_true(js.exists(), "frontend/app.js missing")

    h = read(html)
    a = read(js)

    assert_true("const i18n" in a, "i18n dictionary missing")
    assert_true("zh:" in a and "en:" in a, "zh/en i18n blocks missing")
    assert_true('currentLang: "zh"' in a or "currentLang:\"zh\"" in a, "default language is not zh")
    assert_true("data-i18n" in h, "data-i18n markers missing")
    assert_true("data-i18n-placeholder" in h, "data-i18n-placeholder markers missing")

    forbidden = [
        "Start Debate",
        "Private Chat",
        "Sync To Room",
        "Compact Context",
        "Preview Handoff",
        "Group Mode",
        "Create Agent Instance",
        "Add To Room",
        "Send To Host",
        "Continue Next Round",
        "Export Codex",
        "Dry Run Codex",
        "Check Runners",
        "Reload Credentials",
        "List Profiles",
        "Create Profile",
        "Update Profile",
        "Delete Profile",
        "Test Profile",
        "Diagnose Profile",
    ]
    for item in forbidden:
        assert_true(item not in h, f"index.html contains hardcoded english button: {item}")

    print("Validation passed: frontend i18n checks are working.")


if __name__ == "__main__":
    main()
