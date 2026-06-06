from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.core.ai_member_settings import DATA_DIR


@dataclass
class WebAIBrowserResult:
    success: bool
    available: bool
    opened: bool = False
    loggedIn: bool = False
    status: str = "not_checked"
    error: str = ""
    message: str = ""
    url: str = ""
    profileDir: str = ""
    responseText: str = ""
    promptPreview: str = ""
    elapsedMs: int = 0


@dataclass
class WebAISiteSelectors:
    logged_in: tuple[str, ...]
    logged_out: tuple[str, ...]
    prompt_inputs: tuple[str, ...]
    send_buttons: tuple[str, ...]
    response_blocks: tuple[str, ...]


SITE_SELECTORS: dict[str, WebAISiteSelectors] = {
    "chatgpt": WebAISiteSelectors(
        logged_in=(
            "#prompt-textarea",
            "[data-testid='composer']",
            "textarea",
            "[contenteditable='true']",
        ),
        logged_out=(
            "text=Log in",
            "text=Sign up",
            "text=登录",
        ),
        prompt_inputs=(
            "#prompt-textarea",
            "textarea",
            "[contenteditable='true']",
        ),
        send_buttons=(
            "[data-testid='send-button']",
            "button[aria-label='Send prompt']",
            "button[aria-label='Send message']",
        ),
        response_blocks=(
            "[data-message-author-role='assistant']",
            ".markdown",
            "[class*='markdown']",
            "article",
        ),
    ),
    "deepseek": WebAISiteSelectors(
        logged_in=(
            "textarea",
            "[contenteditable='true']",
            ".chat-input",
        ),
        logged_out=(
            "text=Log in",
            "text=Sign in",
            "text=登录",
        ),
        prompt_inputs=(
            "textarea",
            "[contenteditable='true']",
            ".chat-input",
        ),
        send_buttons=(
            "button[type='submit']",
            "button[aria-label='Send']",
        ),
        response_blocks=(
            ".ds-markdown",
            ".markdown",
            "[class*='markdown']",
            "article",
        ),
    ),
}


class WebAIBrowserManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, dict[str, Any]] = {}

    def availability(self) -> dict:
        try:
            import playwright.sync_api  # noqa: F401
        except ImportError:
            return {
                "available": False,
                "error": "playwright_not_installed",
                "installHint": "pip install playwright && python -m playwright install chromium",
            }
        return {"available": True, "error": ""}

    def profile_dir(self, site_id: str) -> Path:
        return DATA_DIR / "web_ai_profiles" / site_id

    def open_login(self, site: dict) -> WebAIBrowserResult:
        available = self.availability()
        if not available["available"]:
            return WebAIBrowserResult(
                success=False,
                available=False,
                status="error",
                error=str(available["error"]),
                message=str(available.get("installHint") or ""),
                url=str(site.get("website") or ""),
                profileDir=str(self.profile_dir(str(site["id"]))),
            )

        from playwright.sync_api import Error, sync_playwright

        site_id = str(site["id"])
        profile_dir = self.profile_dir(site_id)
        profile_dir.mkdir(parents=True, exist_ok=True)

        with self._lock:
            existing = self._sessions.get(site_id)
            if existing:
                page = existing["page"]
                try:
                    page.goto(str(site["website"]), wait_until="domcontentloaded", timeout=30_000)
                    page.bring_to_front()
                    return WebAIBrowserResult(
                        success=True,
                        available=True,
                        opened=True,
                        status="opened",
                        url=page.url,
                        profileDir=str(profile_dir),
                    )
                except Error as exc:
                    self._close_locked(site_id)
                    return WebAIBrowserResult(
                        success=False,
                        available=True,
                        opened=False,
                        status="error",
                        error=str(exc),
                        profileDir=str(profile_dir),
                    )

            playwright = None
            try:
                playwright = sync_playwright().start()
                context = playwright.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir),
                    headless=False,
                    viewport={"width": 1280, "height": 860},
                )
                page = context.pages[0] if context.pages else context.new_page()
                page.goto(str(site["website"]), wait_until="domcontentloaded", timeout=30_000)
                self._sessions[site_id] = {
                    "playwright": playwright,
                    "context": context,
                    "page": page,
                }
                return WebAIBrowserResult(
                    success=True,
                    available=True,
                    opened=True,
                    status="opened",
                    url=page.url,
                    profileDir=str(profile_dir),
                )
            except Error as exc:
                if playwright is not None:
                    try:
                        playwright.stop()
                    except Exception:
                        pass
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    opened=False,
                    status="error",
                    error=str(exc),
                    profileDir=str(profile_dir),
                )

    def detect_login(self, site: dict) -> WebAIBrowserResult:
        available = self.availability()
        if not available["available"]:
            return WebAIBrowserResult(
                success=False,
                available=False,
                status="error",
                error=str(available["error"]),
                message=str(available.get("installHint") or ""),
                url=str(site.get("website") or ""),
                profileDir=str(self.profile_dir(str(site["id"]))),
            )

        from playwright.sync_api import Error

        site_id = str(site["id"])
        if site_id not in self._sessions:
            opened = self.open_login(site)
            if not opened.opened:
                return opened

        with self._lock:
            session = self._sessions.get(site_id)
            if not session:
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    status="login_required",
                    message="Open the login window first, complete manual login, then check again.",
                    url=str(site.get("website") or ""),
                    profileDir=str(self.profile_dir(site_id)),
                )

            page = session["page"]
            selectors = SITE_SELECTORS.get(site_id)
            try:
                if selectors:
                    for selector in selectors.logged_in:
                        if page.locator(selector).first.count() > 0:
                            return WebAIBrowserResult(
                                success=True,
                                available=True,
                                loggedIn=True,
                                status="logged_in",
                                url=page.url,
                                profileDir=str(self.profile_dir(site_id)),
                            )
                    for selector in selectors.logged_out:
                        if page.locator(selector).first.count() > 0:
                            return WebAIBrowserResult(
                                success=True,
                                available=True,
                                loggedIn=False,
                                status="login_required",
                                url=page.url,
                                profileDir=str(self.profile_dir(site_id)),
                            )
                return WebAIBrowserResult(
                    success=True,
                    available=True,
                    loggedIn=False,
                    status="login_required",
                    message="Login state is unclear. Keep the site open and check whether the chat input is visible.",
                    url=page.url,
                    profileDir=str(self.profile_dir(site_id)),
                )
            except Error as exc:
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    status="error",
                    error=str(exc),
                    profileDir=str(self.profile_dir(site_id)),
                )

    def call_prompt(self, site: dict, prompt: str, timeout_ms: int = 120_000) -> WebAIBrowserResult:
        started_at = time.monotonic()
        available = self.availability()
        site_id = str(site["id"])
        if not available["available"]:
            return WebAIBrowserResult(
                success=False,
                available=False,
                status="error",
                error=str(available["error"]),
                message=str(available.get("installHint") or ""),
                url=str(site.get("website") or ""),
                profileDir=str(self.profile_dir(site_id)),
                promptPreview=prompt[:200],
            )

        from playwright.sync_api import Error, TimeoutError

        if site_id not in self._sessions:
            opened = self.open_login(site)
            if not opened.opened:
                return WebAIBrowserResult(
                    success=False,
                    available=opened.available,
                    status=opened.status,
                    error=opened.error or "browser_session_not_open",
                    message=opened.message or "Unable to open browser session.",
                    url=opened.url,
                    profileDir=opened.profileDir,
                    promptPreview=prompt[:200],
                )

        with self._lock:
            session = self._sessions.get(site_id)
            if not session:
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    status="login_required",
                    error="browser_session_not_open",
                    message="Open the login window first, complete manual login, then call again.",
                    url=str(site.get("website") or ""),
                    profileDir=str(self.profile_dir(site_id)),
                    promptPreview=prompt[:200],
                )

            page = session["page"]
            selectors = SITE_SELECTORS.get(site_id)
            if selectors is None:
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    status="error",
                    error="site_selectors_not_configured",
                    url=page.url,
                    profileDir=str(self.profile_dir(site_id)),
                    promptPreview=prompt[:200],
                )

            try:
                input_locator = self._first_visible_locator(page, selectors.prompt_inputs)
                if input_locator is None:
                    return WebAIBrowserResult(
                        success=False,
                        available=True,
                        status="login_required",
                        error="prompt_input_not_found",
                        message="The chat input is not visible. The site may need manual login or its UI changed.",
                        url=page.url,
                        profileDir=str(self.profile_dir(site_id)),
                        promptPreview=prompt[:200],
                    )

                before_text = self._last_response_text(page, selectors.response_blocks)
                input_locator.click(timeout=10_000)
                try:
                    input_locator.fill(prompt, timeout=10_000)
                except Error:
                    page.keyboard.insert_text(prompt)

                sent = False
                for selector in selectors.send_buttons:
                    button = page.locator(selector).last
                    try:
                        if button.count() > 0 and button.is_visible(timeout=1_000):
                            button.click(timeout=5_000)
                            sent = True
                            break
                    except (Error, TimeoutError):
                        continue
                if not sent:
                    page.keyboard.press("Enter")

                response_text = self._wait_for_response_text(
                    page=page,
                    response_selectors=selectors.response_blocks,
                    previous_text=before_text,
                    timeout_ms=timeout_ms,
                )
                if not response_text:
                    return WebAIBrowserResult(
                        success=False,
                        available=True,
                        loggedIn=True,
                        status="error",
                        error="response_timeout",
                        message="Prompt was submitted, but no stable assistant response was detected before timeout.",
                        url=page.url,
                        profileDir=str(self.profile_dir(site_id)),
                        promptPreview=prompt[:200],
                        elapsedMs=int((time.monotonic() - started_at) * 1000),
                    )

                return WebAIBrowserResult(
                    success=True,
                    available=True,
                    loggedIn=True,
                    status="completed",
                    responseText=response_text,
                    url=page.url,
                    profileDir=str(self.profile_dir(site_id)),
                    promptPreview=prompt[:200],
                    elapsedMs=int((time.monotonic() - started_at) * 1000),
                )
            except Error as exc:
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    status="error",
                    error=str(exc),
                    url=page.url,
                    profileDir=str(self.profile_dir(site_id)),
                    promptPreview=prompt[:200],
                    elapsedMs=int((time.monotonic() - started_at) * 1000),
                )

    def _first_visible_locator(self, page, selectors: tuple[str, ...]):
        from playwright.sync_api import Error, TimeoutError

        for selector in selectors:
            locator = page.locator(selector).last
            try:
                if locator.count() > 0 and locator.is_visible(timeout=1_000):
                    return locator
            except (Error, TimeoutError):
                continue
        return None

    def _last_response_text(self, page, selectors: tuple[str, ...]) -> str:
        from playwright.sync_api import Error

        for selector in selectors:
            locator = page.locator(selector)
            try:
                count = locator.count()
                if count <= 0:
                    continue
                texts = [text.strip() for text in locator.all_text_contents() if text.strip()]
                if texts:
                    return texts[-1]
            except Error:
                continue
        return ""

    def _wait_for_response_text(self, page, response_selectors: tuple[str, ...], previous_text: str, timeout_ms: int) -> str:
        deadline = time.monotonic() + (timeout_ms / 1000)
        last_text = ""
        stable_text = ""
        stable_since = 0.0

        while time.monotonic() < deadline:
            page.wait_for_timeout(1000)
            current_text = self._last_response_text(page, response_selectors)
            if current_text and current_text != previous_text:
                if current_text != last_text:
                    last_text = current_text
                    stable_since = time.monotonic()
                elif not stable_text and stable_since and time.monotonic() - stable_since >= 2.0:
                    stable_text = current_text
                    break

        return stable_text or last_text

    def close(self, site_id: str) -> WebAIBrowserResult:
        with self._lock:
            closed = self._close_locked(site_id)
        return WebAIBrowserResult(
            success=closed,
            available=self.availability()["available"],
            status="closed" if closed else "not_running",
            profileDir=str(self.profile_dir(site_id)),
        )

    def _close_locked(self, site_id: str) -> bool:
        session = self._sessions.pop(site_id, None)
        if not session:
            return False
        try:
            session["context"].close()
        finally:
            session["playwright"].stop()
        return True


web_ai_browser_manager = WebAIBrowserManager()
