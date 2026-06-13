from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.core.collaboration import CollaborationStore
from backend.schemas import CollaborationPlanCreateRequest, CollaborationTaskCreate


def _request(project_path: Path, tasks: list[CollaborationTaskCreate]) -> CollaborationPlanCreateRequest:
    return CollaborationPlanCreateRequest(
        project_path=str(project_path),
        goal="Build without agent conflicts",
        supervisor_agent_id="cli.claude_code",
        tasks=tasks,
    )


def test_non_conflicting_tasks_share_wave(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="backend",
                    agent_id="cli.codex",
                    title="Backend",
                    read_paths=["backend"],
                    write_paths=["backend/api.py"],
                ),
                CollaborationTaskCreate(
                    task_id="frontend",
                    agent_id="cli.claude_code",
                    title="Frontend",
                    read_paths=["web"],
                    write_paths=["web/App.tsx"],
                ),
            ],
        )
    )

    assert plan["waves"] == [["backend", "frontend"]]
    assert plan["conflicts"] == []
    assert Path(plan["shared_plan_path"]).exists()


def test_conflicting_tasks_are_serialised(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="reader",
                    agent_id="cli.codex",
                    title="Read API",
                    read_paths=["backend/api.py"],
                ),
                CollaborationTaskCreate(
                    task_id="writer",
                    agent_id="cli.claude_code",
                    title="Write API",
                    write_paths=["backend/api.py"],
                ),
            ],
        )
    )

    assert plan["waves"] == [["reader"], ["writer"]]
    assert plan["conflicts"][0]["reasons"] == ["read/write: backend/api.py <> backend/api.py"]


def test_dependencies_force_later_wave(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="contract",
                    agent_id="cli.codex",
                    title="Contract",
                    write_paths=["api/schema.json"],
                ),
                CollaborationTaskCreate(
                    task_id="consumer",
                    agent_id="cli.claude_code",
                    title="Consumer",
                    read_paths=["api/schema.json"],
                    write_paths=["web/client.ts"],
                    depends_on=["contract"],
                ),
            ],
        )
    )

    assert plan["waves"] == [["contract"], ["consumer"]]


def test_later_conflict_wave_cannot_start_first(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="first",
                    agent_id="cli.codex",
                    title="First",
                    read_paths=["shared.py"],
                ),
                CollaborationTaskCreate(
                    task_id="second",
                    agent_id="cli.claude_code",
                    title="Second",
                    write_paths=["shared.py"],
                ),
            ],
        )
    )

    with pytest.raises(ValueError, match="Earlier wave is not complete"):
        store.start_task(plan["plan_id"], "second", confirm=True)


def test_non_conflicting_tasks_run_concurrently(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; time.sleep(0.05); print('done')"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="left",
                    agent_id="cli.codex",
                    title="Left",
                    write_paths=["left.py"],
                ),
                CollaborationTaskCreate(
                    task_id="right",
                    agent_id="cli.claude_code",
                    title="Right",
                    write_paths=["right.py"],
                ),
            ],
        )
    )

    left = store.start_task(plan["plan_id"], "left", confirm=True)
    right = store.start_task(plan["plan_id"], "right", confirm=True)
    assert left["status"] == "running"
    assert right["status"] == "running"

    for _ in range(30):
        refreshed = store.get(plan["plan_id"])
        if refreshed["status"] == "completed":
            break
        time.sleep(0.02)
    assert refreshed["status"] == "completed"
    assert refreshed["locks"] == {}


def test_supervisor_output_becomes_shared_advice(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "print('Review task boundaries before launch.')"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="worker",
                    agent_id="cli.codex",
                    title="Worker",
                    write_paths=["worker.py"],
                )
            ],
        )
    )

    supervisor = store.start_supervisor(plan["plan_id"], confirm=True)
    assert supervisor["status"] == "running"
    for _ in range(30):
        refreshed = store.get(plan["plan_id"])
        if refreshed["supervisor_run"]["status"] != "running":
            break
        time.sleep(0.02)
    advice_events = [item for item in refreshed["events"] if item["type"] == "supervisor_advice"]
    assert "Review task boundaries before launch." in advice_events[-1]["payload"]["content"]


def test_rejects_path_outside_project(tmp_path: Path):
    store = CollaborationStore()
    with pytest.raises(ValueError, match="outside project"):
        store.create(
            _request(
                tmp_path,
                [
                    CollaborationTaskCreate(
                        task_id="escape",
                        agent_id="cli.codex",
                        title="Escape",
                        write_paths=["../outside.txt"],
                    )
                ],
            )
        )


def test_rejects_reserved_agent_paths(tmp_path: Path):
    store = CollaborationStore()
    with pytest.raises(ValueError, match="reserved"):
        store.create(
            _request(
                tmp_path,
                [
                    CollaborationTaskCreate(
                        task_id="unsafe",
                        agent_id="cli.codex",
                        title="Unsafe",
                        write_paths=[".git/config"],
                    )
                ],
            )
        )


def test_task_prompt_contains_boundaries(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="bounded",
                    agent_id="cli.codex",
                    title="Bounded change",
                    read_paths=["backend/main.py"],
                    write_paths=["backend/core/new.py"],
                )
            ],
        )
    )

    prompt = store.task_prompt(plan["plan_id"], "bounded")
    assert "Before editing, print a short execution report" in prompt
    assert "backend/main.py" in prompt
    assert "backend/core/new.py" in prompt
    assert "Do not read or modify paths outside the declarations." in prompt


def test_boundary_report_detects_undeclared_changes(tmp_path: Path):
    store = CollaborationStore()
    (tmp_path / "allowed.txt").write_text("before", encoding="utf-8")
    plan = store.create(
        _request(
            tmp_path,
            [
                CollaborationTaskCreate(
                    task_id="bounded",
                    agent_id="cli.codex",
                    title="Bounded change",
                    write_paths=["allowed.txt"],
                )
            ],
        )
    )
    plan["tasks"][0]["status"] = "completed"
    (tmp_path / "allowed.txt").write_text("after", encoding="utf-8")
    (tmp_path / "undeclared.txt").write_text("not allowed", encoding="utf-8")

    refreshed = store.get(plan["plan_id"])
    assert refreshed["boundary_report"]["changed_paths"] == ["allowed.txt", "undeclared.txt"]
    assert refreshed["boundary_report"]["undeclared_changes"] == ["undeclared.txt"]
    assert refreshed["status"] == "needs_attention"


def test_plan_index_survives_restart(tmp_path: Path):
    index_path = tmp_path / "state" / "plans.json"
    project_path = tmp_path / "project"
    project_path.mkdir()
    first = CollaborationStore(index_path=index_path)
    plan = first.create(
        _request(
            project_path,
            [
                CollaborationTaskCreate(
                    task_id="persisted",
                    agent_id="cli.codex",
                    title="Persisted",
                    write_paths=["output.py"],
                )
            ],
        )
    )

    second = CollaborationStore(index_path=index_path)
    loaded = second.get(plan["plan_id"])
    assert loaded["goal"] == "Build without agent conflicts"
    assert loaded["tasks"][0]["task_id"] == "persisted"


def test_orchestration_api(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import backend.main as main_module

    monkeypatch.setattr(main_module, "collaboration_store", CollaborationStore())
    response = client.post(
        "/orchestration/plans",
        json={
            "project_path": str(tmp_path),
            "goal": "Coordinate two local agents",
            "supervisor_agent_id": "cli.claude_code",
            "tasks": [
                {
                    "task_id": "one",
                    "agent_id": "cli.codex",
                    "title": "Task one",
                    "read_paths": ["backend"],
                    "write_paths": ["backend/a.py"],
                },
                {
                    "task_id": "two",
                    "agent_id": "cli.claude_code",
                    "title": "Task two",
                    "read_paths": ["frontend"],
                    "write_paths": ["frontend/a.ts"],
                },
            ],
        },
    )
    assert response.status_code == 200
    plan = response.json()
    assert plan["waves"] == [["one", "two"]]

    agents = client.get("/orchestration/agents")
    assert agents.status_code == 200
    assert any(item["id"] == "cli.codex" for item in agents.json()["agents"])
    assert all(item["id"] != "app.cursor" for item in agents.json()["callable_agents"])

    prompt = client.get(f"/orchestration/plans/{plan['plan_id']}/tasks/one/prompt")
    assert prompt.status_code == 200
    assert "strict local-agent collaboration contract" in prompt.json()["prompt"]

    denied = client.post(f"/orchestration/plans/{plan['plan_id']}/tasks/one/start", json={"confirm": False})
    assert denied.status_code == 400
