from __future__ import annotations

from fastapi.testclient import TestClient


def test_export_codex_invalid_project_id_returns_400(client: TestClient, room_id: str):
    # An unknown project_id used to surface as an unhandled KeyError (HTTP 500);
    # it must now be a clean 400.
    response = client.post(
        "/executor/export/codex",
        json={"room_id": room_id, "project_id": "does-not-exist"},
    )
    assert response.status_code == 400
    assert "project_id" in response.json()["detail"]


def test_export_generic_invalid_project_id_returns_400(client: TestClient, room_id: str):
    response = client.post(
        "/executor/export/generic",
        json={"room_id": room_id, "project_id": "does-not-exist"},
    )
    assert response.status_code == 400


def test_export_unknown_room_returns_404(client: TestClient):
    response = client.post(
        "/executor/export/codex",
        json={"room_id": "no-such-room", "project_id": "x"},
    )
    assert response.status_code == 404
