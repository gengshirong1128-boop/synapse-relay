from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.core.ai_member_settings import AIMemberSettings, ai_member_settings_store
from backend.core.web_ai_browser import WebAIBrowserResult, web_ai_browser_manager
from backend.main import app


class AIMemberEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self._original_settings = ai_member_settings_store.get()
        self._original_save = ai_member_settings_store._save
        self._original_call_prompt = web_ai_browser_manager.call_prompt
        self._original_detect_login = web_ai_browser_manager.detect_login
        ai_member_settings_store._save = lambda: None
        web_ai_browser_manager.call_prompt = lambda site, prompt, timeout_ms=120_000: WebAIBrowserResult(
            success=False,
            available=True,
            status="login_required",
            error="prompt_input_not_found",
            message="test browser not logged in",
            url=str(site.get("website") or ""),
            profileDir=str(web_ai_browser_manager.profile_dir(str(site["id"]))),
            promptPreview=prompt[:200],
        )
        web_ai_browser_manager.detect_login = lambda site: WebAIBrowserResult(
            success=False,
            available=True,
            status="login_required",
            message="test browser not logged in",
            url=str(site.get("website") or ""),
            profileDir=str(web_ai_browser_manager.profile_dir(str(site["id"]))),
        )

    def tearDown(self):
        ai_member_settings_store._settings = AIMemberSettings()
        ai_member_settings_store.patch(self._original_settings, save=False)
        ai_member_settings_store._save = self._original_save
        web_ai_browser_manager.call_prompt = self._original_call_prompt
        web_ai_browser_manager.detect_login = self._original_detect_login

    def test_ai_members_snapshot(self):
        resp = self.client.get("/ai-members")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("settings", data)
        self.assertIn("profiles", data)
        self.assertIn("localTools", data)

    def test_local_tool_config_rejects_unknown_id(self):
        resp = self.client.get("/providers/local-tools/not-real/config")
        self.assertEqual(resp.status_code, 404)

    def test_local_tool_test_rejects_unknown_id(self):
        resp = self.client.post("/providers/local-tools/not-real/test")
        self.assertEqual(resp.status_code, 404)

    def test_assign_chief_local_tool(self):
        resp = self.client.post("/ai-members/roles/chief/assign", json={"localToolId": "cli.codex"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["settings"]["chiefLocalToolId"], "cli.codex")

    def test_assign_role_to_web_ai_website(self):
        resp = self.client.post("/ai-members/roles/summary/assign", json={"websiteId": "chatgpt"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["settings"]["roleAssignments"]["summary"], "webai:chatgpt")

    def test_assign_invalid_role(self):
        resp = self.client.post("/ai-members/roles/not_a_role/assign", json={"profileId": "mock_default_profile"})
        self.assertEqual(resp.status_code, 400)

    def test_website_login_does_not_store_plain_password(self):
        resp = self.client.patch(
            "/ai-members/settings",
            json={
                "websiteLogins": {
                    "chatgpt": {
                        "username": "user@example.com",
                        "password": "plain-secret",
                        "passwordEnvName": "CHATGPT_PASSWORD",
                    }
                }
            },
        )
        self.assertEqual(resp.status_code, 200)
        login = resp.json()["settings"]["websiteLogins"]["chatgpt"]
        self.assertEqual(login["username"], "user@example.com")
        self.assertEqual(login["passwordEnvName"], "CHATGPT_PASSWORD")
        self.assertNotIn("password", login)

    def test_ai_websites_endpoint_has_web_login_entries(self):
        resp = self.client.get("/ai-members/websites")
        self.assertEqual(resp.status_code, 200)
        websites = resp.json()["websites"]
        self.assertGreaterEqual(len(websites), 10)
        self.assertTrue(any(item["id"] == "chatgpt" for item in websites))
        self.assertTrue(all("website" in item for item in websites))
        chatgpt = next(item for item in websites if item["id"] == "chatgpt")
        self.assertIn("webAI", chatgpt)
        self.assertIn(chatgpt["webAI"]["status"], {"open_only", "login_required", "logged_in", "callable", "error"})

    def test_ai_website_status_endpoint(self):
        resp = self.client.get("/ai-members/websites/chatgpt/status")
        self.assertEqual(resp.status_code, 200)
        site = resp.json()["site"]
        self.assertEqual(site["id"], "chatgpt")
        self.assertEqual(site["webAI"]["siteId"], "chatgpt")
        self.assertFalse(site["webAI"]["callable"])
        self.assertTrue(site["webAI"]["hasAdapter"])
        self.assertTrue(site["webAI"]["canDetectLogin"])
        self.assertTrue(site["webAI"]["canSendPrompt"])
        self.assertIn("browserAvailable", site["webAI"])
        self.assertIn("profileDir", site["webAI"])

    def test_ai_website_login_detect_reports_browser_state(self):
        resp = self.client.post("/ai-members/websites/chatgpt/login-detect")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("browser", data)
        self.assertIn("available", data["browser"])
        self.assertEqual(data["site"]["id"], "chatgpt")

    def test_ai_website_call_requires_browser_session_for_supported_sites(self):
        resp = self.client.post("/ai-members/websites/chatgpt/call", json={"prompt": "hello"})
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["detail"]["status"], "login_required")

    def test_ai_website_call_is_explicitly_not_implemented_for_unsupported_sites(self):
        resp = self.client.post("/ai-members/websites/claude/call", json={"prompt": "hello"})
        self.assertEqual(resp.status_code, 501)
        self.assertEqual(resp.json()["detail"]["error"], "web_prompt_automation_not_implemented")

    def test_browser_call_attempts_to_open_persistent_profile_when_session_missing(self):
        calls = []
        original_sessions = dict(web_ai_browser_manager._sessions)
        original_open_login = web_ai_browser_manager.open_login
        try:
            web_ai_browser_manager._sessions.clear()

            def fake_open_login(site):
                calls.append(site["id"])
                return WebAIBrowserResult(
                    success=False,
                    available=True,
                    opened=False,
                    status="error",
                    error="fake_open_failed",
                    profileDir=str(web_ai_browser_manager.profile_dir(str(site["id"]))),
                )

            web_ai_browser_manager.open_login = fake_open_login
            result = self._original_call_prompt({"id": "chatgpt", "website": "https://chatgpt.com/"}, "hello")
        finally:
            web_ai_browser_manager.open_login = original_open_login
            web_ai_browser_manager._sessions.clear()
            web_ai_browser_manager._sessions.update(original_sessions)

        self.assertEqual(calls, ["chatgpt"])
        self.assertFalse(result.success)
        self.assertEqual(result.error, "fake_open_failed")

    def test_council_can_resolve_web_ai_profile_without_falling_back_to_mock(self):
        resp = self.client.post(
            "/api/council/submit",
            json={
                "conversationId": "test_webai_profile",
                "content": "请给出一句测试意见",
                "discussionMode": "ask",
                "profileId": "webai:chatgpt",
            },
        )
        self.assertEqual(resp.status_code, 200)
        opinion = resp.json()["opinions"][0]
        self.assertEqual(opinion["status"], "error")
        self.assertIn("网页版调用失败", opinion["content"])

    def test_api_debate_preserves_frontend_web_ai_profile(self):
        resp = self.client.post(
            "/api/debate",
            json={
                "mode": "cabinet",
                "query": "请给出一句测试意见",
                "selectedMembers": [
                    {
                        "id": "model-chatgpt",
                        "name": "ChatGPT",
                        "apiProfileId": "webai:chatgpt",
                        "skillPrompt": "",
                    }
                ],
            },
        )
        self.assertEqual(resp.status_code, 200)
        messages = resp.json()["messages"]
        self.assertGreaterEqual(len(messages), 1)
        self.assertIn("网页版调用失败", messages[0]["content"])

    def test_api_debate_unknown_profile_falls_back_to_marked_demo(self):
        resp = self.client.post(
            "/api/debate",
            json={
                "mode": "modern",
                "query": "test unknown profile",
                "selectedMembers": [
                    {
                        "id": "unknown-model",
                        "name": "Unknown",
                        "apiProfileId": "missing_profile",
                    }
                ],
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["demoMode"])
        self.assertIn("演示数据", resp.json()["messages"][0]["content"])

    @patch("backend.core.providers.ccswitch_provider.CCSwitchProvider._request", return_value="CC Switch OK")
    def test_api_debate_accepts_keyless_local_ccswitch(self, _request):
        resp = self.client.post(
            "/api/debate",
            json={
                "mode": "modern",
                "query": "test keyless route",
                "apiConfigs": [
                    {
                        "id": "ccswitch",
                        "endpoint": "http://127.0.0.1:15721/v1",
                        "model": "gpt-test",
                    }
                ],
                "selectedMembers": [
                    {
                        "id": "ccswitch-model",
                        "name": "CC Switch",
                        "providerId": "ccswitch",
                    }
                ],
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["demoMode"])
        self.assertEqual(resp.json()["messages"][0]["content"], "CC Switch OK")

    @patch(
        "backend.core.providers.ccswitch_provider.CCSwitchProvider._request",
        return_value='[{"id":"alpha","title":"A","badge":"A","description":"A","icon":"policy"}]',
    )
    def test_api_finalize_accepts_keyless_local_ccswitch(self, _request):
        resp = self.client.post(
            "/api/finalize",
            json={
                "contextTitle": "test",
                "messages": [{"sender": "Member", "content": "Opinion", "isUser": False}],
                "apiConfigs": [{"id": "ccswitch"}],
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("demoMode", resp.json())
        self.assertEqual(resp.json()["plans"][0]["title"], "A")

    def test_api_debate_requires_query_and_member(self):
        self.assertEqual(self.client.post("/api/debate", json={}).status_code, 400)


if __name__ == "__main__":
    unittest.main()
