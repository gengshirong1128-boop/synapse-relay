from __future__ import annotations

import webbrowser
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Literal

from backend.core.ai_websites import get_ai_website, list_ai_websites
from backend.core.ai_member_settings import ai_member_settings_store
from backend.core.web_ai_browser import web_ai_browser_manager


WebAIStatus = Literal["open_only", "login_required", "logged_in", "callable", "error"]


@dataclass
class WebAIAdapterState:
    siteId: str
    status: WebAIStatus
    loginStatus: str
    callable: bool = False
    hasAdapter: bool = False
    canOpen: bool = True
    canDetectLogin: bool = False
    canSendPrompt: bool = False
    browserAvailable: bool = False
    profileDir: str = ""
    lastCheckedAt: str = ""
    message: str = ""
    limitations: list[str] = field(default_factory=list)


class WebAIAdapter:
    can_detect_login = False
    can_send_prompt = False

    def __init__(self, site: dict) -> None:
        self.site = site

    @property
    def has_adapter(self) -> bool:
        return self.can_detect_login or self.can_send_prompt

    def state(self) -> WebAIAdapterState:
        settings = ai_member_settings_store.get()
        login = settings.get("websiteLogins", {}).get(self.site["id"], {})
        login_status = str(login.get("loginStatus") or "not_checked")
        requires_login = bool(self.site.get("loginRequired", False))
        browser = web_ai_browser_manager.availability()

        if login_status == "error":
            status: WebAIStatus = "error"
            message = "Browser login detection failed. Open the login page and try again."
        elif self.can_send_prompt and login_status in {"logged_in", "callable"}:
            status = "callable"
            message = "Web adapter is callable."
        elif login_status in {"logged_in", "callable"}:
            status = "logged_in"
            message = "Login is marked available, but prompt automation is not implemented yet."
        elif requires_login:
            status = "login_required"
            message = "Manual web login is required before this site can be considered usable."
        else:
            status = "open_only"
            message = "This site can be opened, but prompt automation is not implemented yet."

        limitations = []
        if not self.can_detect_login:
            limitations.append("login_detection_not_implemented")
        if self.can_detect_login and not browser["available"]:
            limitations.append("playwright_not_installed")
        if not self.can_send_prompt:
            limitations.append("prompt_automation_not_implemented")

        return WebAIAdapterState(
            siteId=str(self.site["id"]),
            status=status,
            loginStatus=login_status,
            callable=status == "callable",
            hasAdapter=self.has_adapter,
            canDetectLogin=self.can_detect_login,
            canSendPrompt=self.can_send_prompt,
            browserAvailable=bool(browser["available"]),
            profileDir=str(web_ai_browser_manager.profile_dir(str(self.site["id"]))),
            lastCheckedAt=datetime.now(timezone.utc).isoformat(),
            message=message,
            limitations=limitations,
        )

    def open(self, target: str = "website") -> dict:
        url = str(self.site.get("apiWebsite") if target == "api" else self.site.get("website") or "")
        if not url:
            return {"opened": False, "url": "", "error": "missing_url"}
        return {"opened": bool(webbrowser.open(url)), "url": url}

    def request_manual_login(self) -> dict:
        browser_result = web_ai_browser_manager.open_login(self.site)
        opened = asdict(browser_result)
        if not browser_result.opened:
            opened = {**opened, **self.open("website")}
        current = ai_member_settings_store.get().get("websiteLogins", {}).get(self.site["id"], {})
        settings_payload = {
            "websiteLogins": {
                self.site["id"]: {
                    "username": current.get("username", ""),
                    "passwordEnvName": current.get("passwordEnvName", ""),
                    "loginStatus": "manual_login_required",
                }
            }
        }
        return {
            **opened,
            "settings": ai_member_settings_store.patch(settings_payload),
            "state": asdict(self.state()),
        }

    def detect_login(self) -> dict:
        result = web_ai_browser_manager.detect_login(self.site)
        current = ai_member_settings_store.get().get("websiteLogins", {}).get(self.site["id"], {})
        if result.status == "logged_in":
            login_status = "logged_in"
        elif result.status == "login_required":
            login_status = "manual_login_required"
        elif result.status == "error":
            login_status = "error"
        else:
            login_status = "not_checked"
        settings_payload = {
            "websiteLogins": {
                self.site["id"]: {
                    "username": current.get("username", ""),
                    "passwordEnvName": current.get("passwordEnvName", ""),
                    "loginStatus": login_status,
                }
            }
        }
        return {
            "browser": asdict(result),
            "settings": ai_member_settings_store.patch(settings_payload),
            "state": asdict(self.state()),
        }

    def close_browser(self) -> dict:
        result = web_ai_browser_manager.close(str(self.site["id"]))
        return {"browser": asdict(result), "state": asdict(self.state())}

    def call(self, prompt: str) -> dict:
        if self.can_send_prompt:
            result = web_ai_browser_manager.call_prompt(self.site, prompt)
            current = ai_member_settings_store.get().get("websiteLogins", {}).get(self.site["id"], {})
            if result.success:
                login_status = "callable"
            elif result.status == "login_required":
                login_status = "manual_login_required"
            elif result.status == "error":
                login_status = "error"
            else:
                login_status = current.get("loginStatus", "not_checked")
            settings_payload = {
                "websiteLogins": {
                    self.site["id"]: {
                        "username": current.get("username", ""),
                        "passwordEnvName": current.get("passwordEnvName", ""),
                        "loginStatus": login_status,
                    }
                }
            }
            return {
                **asdict(result),
                "siteId": self.site["id"],
                "settings": ai_member_settings_store.patch(settings_payload),
                "state": asdict(self.state()),
            }

        return {
            "success": False,
            "siteId": self.site["id"],
            "status": self.state().status,
            "error": "web_prompt_automation_not_implemented",
            "message": "This website can be opened for manual use, but automatic prompt send/read is not implemented yet.",
            "promptPreview": prompt[:200],
        }


class ChatGPTWebAdapter(WebAIAdapter):
    can_detect_login = True
    can_send_prompt = True


class DeepSeekWebAdapter(WebAIAdapter):
    can_detect_login = True
    can_send_prompt = True


class AIWebsiteRegistry:
    adapter_classes = {
        "chatgpt": ChatGPTWebAdapter,
        "deepseek": DeepSeekWebAdapter,
    }

    def list_sites(self) -> list[dict]:
        return [self.with_state(site) for site in list_ai_websites()]

    def get_site(self, site_id: str) -> dict:
        return self.with_state(get_ai_website(site_id))

    def adapter_for(self, site_id: str) -> WebAIAdapter:
        site = get_ai_website(site_id)
        adapter_cls = self.adapter_classes.get(site_id, WebAIAdapter)
        return adapter_cls(site)

    def with_state(self, site: dict) -> dict:
        adapter_cls = self.adapter_classes.get(str(site["id"]), WebAIAdapter)
        adapter = adapter_cls(site)
        return {**site, "webAI": asdict(adapter.state())}


ai_website_registry = AIWebsiteRegistry()
