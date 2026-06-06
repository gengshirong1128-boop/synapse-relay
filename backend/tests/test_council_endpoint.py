from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.main import app


class CouncilEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def _submit(self, **overrides):
        payload = {
            "conversationId": "test_api_" + (overrides.pop("convSuffix", "0")),
            "content": "test council memorial",
        }
        payload.update(overrides)
        return self.client.post("/api/council/submit", json=payload)

    def test_mock_success(self):
        resp = self._submit(provider="mock")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("memorial", data)
        self.assertIn("opinions", data)
        self.assertIn("verdict", data)
        self.assertGreaterEqual(len(data["opinions"]), 1)
        self.assertEqual(data["opinions"][0]["status"], "done")

    def test_deepseek_no_key_returns_error_not_crash(self):
        resp = self._submit(provider="deepseek", convSuffix="ds")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["opinions"][0]["status"], "error")
        self.assertIn("missing_api_key", data["opinions"][0]["content"])
        self.assertEqual(data["verdict"]["decision"], "reconsider")

    def test_openai_no_key_returns_error_not_crash(self):
        resp = self._submit(provider="openai", convSuffix="oai")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["opinions"][0]["status"], "error")

    def test_anthropic_no_key_returns_error_not_crash(self):
        resp = self._submit(provider="anthropic", convSuffix="ant")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["opinions"][0]["status"], "error")

    def test_claude_alias_behaves_same_as_anthropic(self):
        resp_ant = self._submit(provider="anthropic", convSuffix="ant2")
        resp_claude = self._submit(provider="claude", convSuffix="cld")
        self.assertEqual(resp_ant.status_code, resp_claude.status_code)
        self.assertEqual(
            resp_ant.json()["opinions"][0]["status"],
            resp_claude.json()["opinions"][0]["status"],
        )

    def test_gemini_no_key_returns_error_not_crash(self):
        resp = self._submit(provider="gemini", convSuffix="gm")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["opinions"][0]["status"], "error")

    def test_local_stub_returns_400(self):
        resp = self._submit(provider="local", convSuffix="loc")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("does not implement", resp.json()["detail"])

    def test_custom_no_key_returns_error_not_crash(self):
        resp = self._submit(provider="custom", convSuffix="cust")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["opinions"][0]["status"], "error")

    def test_nonexistent_falls_back_to_mock(self):
        resp = self._submit(provider="nonexistent123", convSuffix="nx")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["opinions"][0]["status"], "done")

    def test_profileId_applied_to_ministers_without_state_pollution(self):
        resp = self._submit(provider="mock", profileId="deepseek_default_profile", convSuffix="pid")
        self.assertEqual(resp.status_code, 200)
        for minister in resp.json()["activeMinisters"]:
            self.assertEqual(minister.get("apiProfileId"), "deepseek_default_profile")

        resp2 = self._submit(provider="mock", convSuffix="pid")
        self.assertEqual(resp2.status_code, 200)
        for minister in resp2.json()["activeMinisters"]:
            self.assertEqual(minister.get("apiProfileId"), "mock_default")


if __name__ == "__main__":
    unittest.main()
