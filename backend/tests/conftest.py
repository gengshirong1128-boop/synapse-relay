from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def room_id(client: TestClient) -> str:
    resp = client.post(
        "/room/create",
        json={
            "title": "Test Room",
            "owner_user": "TestUser",
            "host_agent": {"name": "Mock Host", "provider": "mock", "role": "host"},
        },
    )
    assert resp.status_code == 200
    return resp.json()["room"]["room_id"]
