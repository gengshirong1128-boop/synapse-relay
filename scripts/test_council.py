from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.core.council_service import council_service


def main() -> None:
    payload = {
        "conversationId": "cli_demo",
        "content": "帮我检查当前内阁项目，下一步应该先修 UI 还是先做后端？",
        "attachments": [],
        "mode": "council",
    }
    result = council_service.submit_memorial(payload)
    print("=== 奏折 ===")
    print(result["memorial"]["content"])
    print("\n=== 参与大臣 ===")
    for m in result["activeMinisters"]:
        print(f"- {m['title']} ({m['provider']}/{m['model']})")
    print("\n=== 奏议 ===")
    for op in result["opinions"]:
        title = next((m["title"] for m in result["activeMinisters"] if m["id"] == op["ministerId"]), op["ministerId"])
        print(f"[{title}] {op['content']}")
    print("\n=== 朱批 ===")
    print(result["verdict"]["content"], f"(decision={result['verdict']['decision']})")
    print("\nconversationId:", result["conversation"]["id"])
    print("success: true")


if __name__ == "__main__":
    main()
