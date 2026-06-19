from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.core.collaboration import CollaborationStore, _read_log_tail, _atomic_write_text
from backend.schemas import CollaborationPlanCreateRequest, CollaborationTaskCreate
from pydantic import ValidationError


@pytest.mark.parametrize(
    "evil_id",
    ["../escape", "a/b", "a\\b", "../../etc/x", "id with space", "id$"],
)
def test_task_id_rejects_unsafe_chars(evil_id: str):
    # task_id is interpolated into log file paths; reject anything that is not a
    # safe slug to prevent path traversal.
    with pytest.raises(ValidationError):
        CollaborationTaskCreate(task_id=evil_id, agent_id="cli.codex", title="X", write_paths=["x.py"])


def test_task_id_accepts_safe_slugs():
    for ok in ["backend", "task-1", "task_2", "a.b.c", "T1"]:
        task = CollaborationTaskCreate(task_id=ok, agent_id="cli.codex", title="X", write_paths=["x.py"])
        assert task.task_id == ok


def test_read_log_tail_returns_only_tail(tmp_path: Path):
    log = tmp_path / "big.log"
    log.write_text("A" * 200_000 + "TAIL_MARKER", encoding="utf-8")
    result = _read_log_tail(log, max_bytes=1024)
    assert result.endswith("TAIL_MARKER")
    assert len(result.encode("utf-8")) <= 1024
    assert _read_log_tail(None) == ""
    assert _read_log_tail(tmp_path / "missing.log") == ""


def test_atomic_write_replaces_without_leaving_tmp(tmp_path: Path):
    target = tmp_path / "plan.json"
    _atomic_write_text(target, '{"a": 1}')
    assert target.read_text(encoding="utf-8") == '{"a": 1}'
    # Overwrite, and confirm no leftover .tmp files in the directory.
    _atomic_write_text(target, '{"a": 2, "中文": "ok"}')
    assert '"中文": "ok"' in target.read_text(encoding="utf-8")
    assert [p.name for p in tmp_path.glob("*.tmp")] == []


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

    for _ in range(100):
        refreshed = store.get(plan["plan_id"])
        if refreshed["status"] == "completed":
            break
        time.sleep(0.02)
    assert refreshed["status"] == "completed"
    assert refreshed["locks"] == {}


def test_concurrent_get_during_task_lifecycle_is_safe(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    # get() refreshes shared process/lock state; hammering it from many threads
    # while a task starts and finishes must not raise or corrupt state (RLock).
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; time.sleep(0.1); print('done')"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="solo", agent_id="cli.codex", title="Solo", write_paths=["solo.py"])],
        )
    )

    errors: list[Exception] = []
    stop = threading.Event()

    def poll():
        while not stop.is_set():
            try:
                store.get(plan["plan_id"])
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

    pollers = [threading.Thread(target=poll) for _ in range(6)]
    for thread in pollers:
        thread.start()
    try:
        store.start_task(plan["plan_id"], "solo", confirm=True)
        for _ in range(100):
            if store.get(plan["plan_id"])["status"] in {"completed", "needs_attention"}:
                break
            time.sleep(0.02)
    finally:
        stop.set()
        for thread in pollers:
            thread.join(timeout=2)

    assert errors == []
    final = store.get(plan["plan_id"])
    assert final["tasks"][0]["status"] == "completed"
    assert final["locks"] == {}


def test_running_task_can_be_cancelled_and_retried_without_overwriting_history(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; print('started', flush=True); time.sleep(10)"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )

    first = store.start_task(plan["plan_id"], "worker", confirm=True)
    first_attempt = first["attempts"]
    first_log_path = first["log_path"]
    cancelled = store.cancel_task(plan["plan_id"], "worker", confirm=True)
    cancelled_status = cancelled["status"]
    cancelled_history = list(cancelled["run_history"])
    second = store.start_task(plan["plan_id"], "worker", confirm=True)

    assert first_attempt == 1
    assert cancelled_status == "cancelled"
    assert cancelled_history[0]["attempt"] == 1
    assert cancelled_history[0]["status"] == "cancelled"
    assert second["attempts"] == 2
    assert second["log_path"] != first_log_path
    store.cancel_task(plan["plan_id"], "worker", confirm=True)


def test_running_supervisor_can_be_cancelled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; time.sleep(10)"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )

    store.start_supervisor(plan["plan_id"], confirm=True)
    cancelled = store.cancel_supervisor(plan["plan_id"], confirm=True)

    assert cancelled["status"] == "cancelled"
    assert cancelled["run_history"][0]["status"] == "cancelled"


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
    for _ in range(100):
        refreshed = store.get(plan["plan_id"])
        if refreshed["supervisor_run"]["status"] != "running":
            break
        time.sleep(0.02)
    advice_events = [item for item in refreshed["events"] if item["type"] == "supervisor_advice"]
    assert "Review task boundaries before launch." in advice_events[-1]["payload"]["content"]


def test_task_activity_exposes_public_output_and_messages(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [
            sys.executable,
            "-c",
            "print('<analysis>private reasoning</analysis>'); print('Editing worker.py'); print('api_key=secret-value')",
        ],
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
    store.add_message(plan["plan_id"], "Run the focused unit test.", ["worker"])
    store.start_task(plan["plan_id"], "worker", confirm=True)
    for _ in range(100):
        refreshed = store.get(plan["plan_id"])
        if refreshed["tasks"][0]["status"] != "running":
            break
        time.sleep(0.02)

    activity = store.task_activity(plan["plan_id"], "worker")

    assert "Editing worker.py" in activity["public_output"]
    assert "private reasoning" not in activity["public_output"]
    assert "secret-value" not in activity["public_output"]
    assert any(event["type"] == "user_message" for event in activity["events"])


def test_supervisor_activity_exposes_public_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "print('Check task boundaries.')"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )
    store.start_supervisor(plan["plan_id"], confirm=True)
    for _ in range(100):
        refreshed = store.get(plan["plan_id"])
        if refreshed["supervisor_run"]["status"] != "running":
            break
        time.sleep(0.02)

    activity = store.supervisor_activity(plan["plan_id"])

    assert "Check task boundaries." in activity["public_output"]
    assert activity["status"] == "completed"


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


def test_result_report_can_be_accepted_and_exported(tmp_path: Path):
    store = CollaborationStore()
    request = _request(
        tmp_path,
        [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
    )
    request.manager_report = {"acceptance_criteria": ["Focused tests pass."]}
    plan = store.create(request)
    plan["tasks"][0]["status"] = "completed"
    plan["tasks"][0]["attempts"] = 1
    (tmp_path / "worker.py").write_text("done = True\n", encoding="utf-8")

    report = store.result_report(plan["plan_id"])
    acceptance = store.set_acceptance(plan["plan_id"], accepted=True, note="Reviewed by user.")
    exported = store.export_markdown(plan["plan_id"])

    assert report["ready_for_acceptance"] is True
    assert report["summary"]["completed"] == 1
    assert report["acceptance_criteria"] == ["Focused tests pass."]
    assert acceptance["status"] == "accepted"
    assert "Focused tests pass." in exported["content"]
    assert "Reviewed by user." in exported["content"]


def test_result_report_blocks_acceptance_when_boundary_fails(tmp_path: Path):
    store = CollaborationStore()
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )
    plan["tasks"][0]["status"] = "completed"
    (tmp_path / "unexpected.py").write_text("unsafe = True\n", encoding="utf-8")

    report = store.result_report(plan["plan_id"])

    assert report["verdict"] == "needs_attention"
    assert report["issues"] == [{"code": "undeclared_changes", "items": ["unexpected.py"]}]
    with pytest.raises(ValueError, match="not ready"):
        store.set_acceptance(plan["plan_id"], accepted=True, note="")


def test_plan_can_be_archived_restored_and_removed_from_index(tmp_path: Path):
    index_path = tmp_path / "state" / "plans.json"
    project_path = tmp_path / "project"
    project_path.mkdir()
    store = CollaborationStore(index_path=index_path)
    plan = store.create(
        _request(
            project_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )

    archived = store.archive(plan["plan_id"])
    assert archived["archived"] is True
    assert store.list() == []
    assert store.list(include_archived=True)[0]["plan_id"] == plan["plan_id"]

    restored = store.archive(plan["plan_id"], archived=False)
    assert restored["archived"] is False
    deleted = store.delete(plan["plan_id"])
    assert deleted["deleted"] is True
    with pytest.raises(KeyError):
        store.get(plan["plan_id"])
    assert CollaborationStore(index_path=index_path).list(include_archived=True) == []


def test_running_plan_cannot_be_archived_or_deleted(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    store = CollaborationStore()
    monkeypatch.setattr(
        store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; time.sleep(10)"],
    )
    plan = store.create(
        _request(
            tmp_path,
            [CollaborationTaskCreate(task_id="worker", agent_id="cli.codex", title="Worker", write_paths=["worker.py"])],
        )
    )
    store.start_task(plan["plan_id"], "worker", confirm=True)

    with pytest.raises(ValueError, match="Cannot archive"):
        store.archive(plan["plan_id"])
    with pytest.raises(ValueError, match="Cannot delete"):
        store.delete(plan["plan_id"])
    store.cancel_task(plan["plan_id"], "worker", confirm=True)


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

    message = client.post(
        f"/orchestration/plans/{plan['plan_id']}/messages",
        json={"content": "Run focused tests.", "target_task_ids": ["one"]},
    )
    assert message.status_code == 200
    activity = client.get(f"/orchestration/plans/{plan['plan_id']}/tasks/one/activity")
    assert activity.status_code == 200
    assert any(event["type"] == "user_message" for event in activity.json()["events"])

    denied = client.post(f"/orchestration/plans/{plan['plan_id']}/tasks/one/start", json={"confirm": False})
    assert denied.status_code == 400

    monkeypatch.setattr(
        main_module.collaboration_store,
        "_command",
        lambda agent_id, prompt: [sys.executable, "-c", "import time; time.sleep(10)"],
    )
    started = client.post(f"/orchestration/plans/{plan['plan_id']}/tasks/one/start", json={"confirm": True})
    assert started.status_code == 200
    cancelled = client.post(f"/orchestration/plans/{plan['plan_id']}/tasks/one/cancel", json={"confirm": True})
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    result = client.get(f"/orchestration/plans/{plan['plan_id']}/result")
    assert result.status_code == 200
    assert result.json()["verdict"] == "in_progress"
    rejected = client.post(
        f"/orchestration/plans/{plan['plan_id']}/acceptance",
        json={"accepted": False, "note": "Needs another pass."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    exported = client.get(f"/orchestration/plans/{plan['plan_id']}/export")
    assert exported.status_code == 200
    assert "Needs another pass." in exported.json()["content"]
    archived = client.post(f"/orchestration/plans/{plan['plan_id']}/archive", json={"archived": True})
    assert archived.status_code == 200
    assert client.get("/orchestration/plans").json()["plans"] == []
    assert len(client.get("/orchestration/plans?include_archived=true").json()["plans"]) == 1
    deleted = client.delete(f"/orchestration/plans/{plan['plan_id']}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True


def test_normalise_path_blocks_resolved_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    # Environment-independent: simulate a symlink whose resolved target escapes
    # the project, so the guard is covered even where real symlinks need admin.
    from backend.core import collaboration

    project = tmp_path / "project"
    escaped = tmp_path / "outside" / "secret.txt"

    real_resolve = Path.resolve

    def fake_resolve(self, *args, **kwargs):
        if self.name == "leak.txt":
            return escaped
        return real_resolve(self, *args, **kwargs)

    monkeypatch.setattr(Path, "resolve", fake_resolve)
    with pytest.raises(ValueError, match="outside project"):
        collaboration._normalise_path(project, "leak.txt")
    # A normal in-project path still passes under the same patch.
    assert collaboration._normalise_path(project, "real.py") == "real.py"


def test_declared_path_symlink_escape_is_rejected(tmp_path: Path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_text("secret\n", encoding="utf-8")
    project = tmp_path / "project"
    project.mkdir()
    link = project / "leak.txt"
    try:
        link.symlink_to(outside / "secret.txt")
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not supported in this environment")

    store = CollaborationStore()
    with pytest.raises(ValueError, match="outside project"):
        store.create(
            _request(
                project,
                [
                    CollaborationTaskCreate(
                        task_id="leaker",
                        agent_id="cli.codex",
                        title="Leak",
                        read_paths=["leak.txt"],
                    )
                ],
            )
        )
