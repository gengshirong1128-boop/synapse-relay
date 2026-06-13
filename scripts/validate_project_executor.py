from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    client = TestClient(app)

    # 1) Scan project
    scan_resp = client.post("/project/scan", json={"project_path": str(ROOT), "max_file_size_bytes": 1048576})
    assert_true(scan_resp.status_code == 200, "project scan failed")
    scan_json = scan_resp.json()
    project_id = scan_json["project_id"]
    assert_true(scan_json["indexed_files"] > 0, "no indexed files")

    # 2) .env content must not be read
    tree_resp = client.get(f"/project/{project_id}/tree")
    assert_true(tree_resp.status_code == 200, "project tree failed")
    tree_json = tree_resp.json()
    warnings = tree_json.get("warnings", [])
    env_in_tree = any(path.lower().endswith(".env") for path in tree_json.get("file_tree", []))
    if env_in_tree:
        assert_true(any(".env exists" in warning for warning in warnings), ".env warning missing")

    # 3) noisy dirs ignored in file tree output
    file_tree = tree_json.get("file_tree", [])
    lowered_tree = [item.lower().replace("\\", "/") for item in file_tree]
    assert_true(
        all(".git/" not in item and "node_modules/" not in item and "__pycache__/" not in item for item in lowered_tree),
        "ignored dirs leaked into file tree",
    )

    # 4) relevant file retrieval
    relevant_resp = client.post(
        f"/project/{project_id}/relevant-files",
        json={"question": "FastAPI room handoff packet and panel round", "top_k": 8, "manual_selected_paths": []},
    )
    assert_true(relevant_resp.status_code == 200, "relevant files failed")
    relevant_files = relevant_resp.json()["relevant_files"]
    assert_true(len(relevant_files) > 0, "no relevant files")
    assert_true(len(relevant_files) <= 10, "too many relevant files selected")
    assert_true(all(".env" not in item["relative_path"].lower() for item in relevant_files), ".env leaked into relevant files")

    # 5) context-build with user cancellation
    selected_paths = [item["relative_path"] for item in relevant_files[:4]]
    removed_path = selected_paths[-1]
    kept_paths = selected_paths[:-1]
    context_resp = client.post(
        f"/project/{project_id}/context-build",
        json={"question": "Build context for room workflow", "selected_paths": kept_paths},
    )
    assert_true(context_resp.status_code == 200, "context build failed")
    project_context = context_resp.json()["project_context"]
    context_paths = [item["relative_path"] for item in project_context["relevant_files"]]
    assert_true(removed_path not in context_paths, "removed file still present in context")
    assert_true(len(context_paths) <= 10, "context included too many files")

    # 6) attach project to room and verify handoff includes local project context
    room_resp = client.post(
        "/room/create",
        json={
            "title": "Project Attach Validation",
            "owner_user": "User",
            "host_agent": {"name": "Mock GPT", "provider": "mock", "role": "host"},
        },
    )
    assert_true(room_resp.status_code == 200, "room create failed")
    room_id = room_resp.json()["room"]["room_id"]

    # create one specialist instance and add to room
    instance_payload = {
        "agent_id": "project_reader_specialist",
        "display_name": "Project Reader Specialist",
        "provider": "mock",
        "model": "mock-deepseek",
        "credential_id": "mock_default",
        "role": "expert",
        "position_id": "context_curator",
        "position_name": "Context Curator",
        "persona": "Context extraction specialist",
        "context_limit_tokens": 64000,
    }
    client.post("/agents/instances/create", json=instance_payload)
    add_resp = client.post(f"/room/{room_id}/agents/add-instance", json={"agent_id": "project_reader_specialist"})
    assert_true(add_resp.status_code == 200, "add specialist failed")

    attach_resp = client.post(
        f"/room/{room_id}/project/attach",
        json={"project_id": project_id, "question": "Need handoff context", "selected_paths": kept_paths},
    )
    assert_true(attach_resp.status_code == 200, "attach project failed")

    preview_resp = client.post(
        f"/room/{room_id}/panel/preview",
        json={
            "selected_agent_ids": ["project_reader_specialist"],
            "blocker": "Need external review",
            "need": "Review implementation path",
            "constraints": ["minimal changes"],
        },
    )
    assert_true(preview_resp.status_code == 200, "panel preview failed")
    packet = preview_resp.json()["handoff_packets"][0]
    assert_true("project_name=" in packet["local_project_context"], "handoff missing local project context")
    assert_true(len(packet.get("project_files_sent", [])) > 0, "handoff missing project files sent")
    if env_in_tree:
        assert_true(packet.get("env_notice") is not None, "handoff env notice missing")

    # 7) export codex prompt
    codex_resp = client.post(
        "/executor/export/codex",
        json={"room_id": room_id, "project_id": project_id, "selected_files": kept_paths},
    )
    assert_true(codex_resp.status_code == 200, "codex export failed")
    assert_true("项目路径" in codex_resp.json()["generated_prompt"], "codex prompt format incorrect")

    # 8) export claude code prompt
    claude_resp = client.post(
        "/executor/export/claude-code",
        json={"room_id": room_id, "project_id": project_id, "selected_files": kept_paths},
    )
    assert_true(claude_resp.status_code == 200, "claude export failed")
    assert_true("Please inspect the local project" in claude_resp.json()["generated_prompt"], "claude prompt format incorrect")

    # 9) not defaulting to whole project
    context_relevant_count = len(project_context["relevant_files"])
    assert_true(context_relevant_count < scan_json["total_files"], "whole project was sent as context")

    print("Validation passed: project reader/context builder/executor export workflow is working.")


if __name__ == "__main__":
    main()
