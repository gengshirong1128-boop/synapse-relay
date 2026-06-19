from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def _create_dangling_profile(client: TestClient, profile_id: str) -> None:
    client.delete(f"/provider-profiles/{profile_id}")  # ensure clean slate (idempotent)
    resp = client.post(
        "/provider-profiles/create",
        json={
            "profile_id": profile_id,
            "name": "Dangling",
            "provider": "test",
            "api_format": "openai_compatible",
            "base_url": "https://example.com",
            "default_model": "m",
            "credential_id": "no-such-credential",
            "target_apps": ["synapse"],
        },
    )
    assert resp.status_code == 200, resp.text


@pytest.fixture
def dangling_profile(client: TestClient):
    created: list[str] = []

    def _make(profile_id: str) -> str:
        _create_dangling_profile(client, profile_id)
        created.append(profile_id)
        return profile_id

    yield _make
    for profile_id in created:
        client.delete(f"/provider-profiles/{profile_id}")


def test_profile_test_with_dangling_credential_returns_404(client: TestClient, dangling_profile):
    # A profile referencing a deleted/unknown credential must yield a clean 404,
    # not an unhandled KeyError (HTTP 500).
    profile_id = dangling_profile("dangling-test")
    resp = client.post(f"/provider-profiles/{profile_id}/test", json={})
    assert resp.status_code == 404
    assert "credential" in resp.json()["detail"].lower()


def test_profile_configure_with_dangling_credential_returns_404(client: TestClient, dangling_profile):
    profile_id = dangling_profile("dangling-configure")
    resp = client.post(f"/provider-profiles/{profile_id}/configure", json={})
    assert resp.status_code == 404
