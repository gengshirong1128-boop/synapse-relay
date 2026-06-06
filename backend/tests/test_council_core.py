from __future__ import annotations

import unittest

from backend.core.council_service import CouncilService
from backend.core.providers.mock_provider import MockProvider


class CouncilCoreTests(unittest.TestCase):
    def setUp(self):
        self.service = CouncilService(provider=MockProvider())

    def test_conversation_crud_basics(self):
        convo = self.service.create_conversation("t1", "测试")
        self.assertEqual(convo.id, "t1")
        convo.title = "重命名"
        self.assertEqual(self.service.get_conversation("t1").title, "重命名")

    def test_minister_basics(self):
        convo = self.service.get_conversation("m1")
        self.assertGreaterEqual(len(convo.ministers), 5)
        chief = next((m for m in convo.ministers if m.isChief), None)
        self.assertIsNotNone(chief)
        non_chief = next((m for m in convo.ministers if not m.isChief), None)
        self.assertIsNotNone(non_chief)
        non_chief.enabled = False
        self.assertFalse(non_chief.enabled)

    def test_submit_memorial_flow(self):
        result = self.service.submit_memorial(
            {
                "conversationId": "c_flow",
                "content": "请评估下一步重点",
                "attachments": [],
                "mode": "council",
            }
        )
        self.assertIn("memorial", result)
        self.assertIn("opinions", result)
        self.assertIn("verdict", result)
        self.assertGreaterEqual(len(result["activeMinisters"]), 1)
        self.assertGreaterEqual(len(result["opinions"]), 1)

    def test_mock_provider_varies_by_office(self):
        result = self.service.submit_memorial(
            {
                "conversationId": "c_provider",
                "content": "测试不同官职输出",
                "attachments": [],
                "mode": "council",
            }
        )
        texts = [item["content"] for item in result["opinions"]]
        self.assertGreater(len(set(texts)), 1)


if __name__ == "__main__":
    unittest.main()
