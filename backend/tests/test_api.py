from __future__ import annotations

from fastapi.testclient import TestClient


class TestHealth:
    def test_health_ok(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_system_self_check_includes_runtime_smoke_checks(self, client: TestClient):
        resp = client.get("/system/self-check")
        assert resp.status_code == 200
        data = resp.json()
        assert "webAI" in data["checks"]
        assert data["apiDebate"]["endpoint"] == "/api/debate"
        assert data["apiDebate"]["message_count"] >= 1
        assert data["webAI"]["browser_available"] is True
        assert data["webAI"]["supported_count"] >= 1
        assert data["readiness"]["coreReady"] is data["overall_ok"]
        assert data["readiness"]["apiReady"] is (
            data["readiness"]["coreReady"] and data["providers"]["configured_count"] > 0
        )
        assert data["readiness"]["webAIReady"] is (
            data["readiness"]["coreReady"] and data["webAI"]["ok"]
        )
        assert data["readiness"]["fullReady"] is (
            data["readiness"]["coreReady"]
            and data["readiness"]["apiReady"]
            and data["readiness"]["webAIReady"]
        )
        assert isinstance(data["readiness"]["blockers"], list)
        assert isinstance(data["readiness"]["actions"], list)
        if not data["readiness"]["apiReady"]:
            assert any(action["id"] == "configure_api_provider" for action in data["readiness"]["actions"])
        if data["webAI"]["supported_count"] > data["webAI"]["callable_count"]:
            assert any(
                action["id"].startswith("open_web_ai_login:")
                for action in data["readiness"]["actions"]
            )
            assert any(
                action["id"].startswith("detect_web_ai_login:")
                for action in data["readiness"]["actions"]
            )


class TestUtilityEndpoints:
    def test_issue_report_is_saved(self, client: TestClient, tmp_path, monkeypatch):
        import backend.main as main_module

        monkeypatch.setattr(main_module, "ISSUE_REPORT_DIR", tmp_path)
        monkeypatch.delenv("FEEDBACK_SMTP_HOST", raising=False)
        resp = client.post(
            "/api/issues",
            json={
                "recipient": "owner@example.com",
                "category": "功能异常",
                "title": "测试问题",
                "reportText": "测试报告正文",
                "diagnosis": {"app": {"ok": True}},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["saved"] is True
        assert data["emailSent"] is False
        assert len(list(tmp_path.glob("issue_*.json"))) == 1

    def test_image_generation_openai_compatible(self, client: TestClient, monkeypatch):
        import backend.main as main_module

        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"data": [{"b64_json": "aGVsbG8=", "revised_prompt": "revised"}]}

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def post(self, url, headers, json):
                assert url == "https://example.com/v1/images/generations"
                assert json["model"] == "gpt-image-1"
                return FakeResponse()

        monkeypatch.setattr(main_module.httpx, "Client", FakeClient)
        resp = client.post(
            "/api/images/generate",
            json={
                "endpoint": "https://example.com/v1",
                "apiKey": "secret",
                "model": "gpt-image-1",
                "prompt": "一座宫殿",
                "size": "1024x1024",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imageUrl"] == "data:image/png;base64,aGVsbG8="
        assert data["revisedPrompt"] == "revised"

    def test_ccswitch_route_test_reports_provider_error(self, client: TestClient, monkeypatch):
        import backend.main as main_module

        class FakeResponse:
            is_success = False
            status_code = 400
            text = "bad route"

            def json(self):
                return {"error": {"message": "provider missing base_url"}}

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def post(self, url, headers, json):
                assert url in {
                    "http://127.0.0.1:15721/v1/responses",
                    "http://127.0.0.1:15721/v1/messages",
                }
                return FakeResponse()

        monkeypatch.setattr(main_module.httpx, "Client", FakeClient)
        resp = client.post("/api/ccswitch/test", json={"endpoint": "http://127.0.0.1:15721/v1", "model": "gpt-5"})
        assert resp.status_code == 200
        assert resp.json()["routeReady"] is False
        assert "base_url" in resp.json()["message"]

    def test_ccswitch_saved_providers_are_exposed_without_keys(self, client: TestClient, monkeypatch):
        import backend.main as main_module

        monkeypatch.setattr(
            main_module,
            "sync_ccswitch_providers",
            lambda: [{
                "id": "provider-1",
                "name": "Saved Provider",
                "appType": "claude",
                "isCurrent": True,
                "baseUrl": "https://example.test",
                "model": "claude-test",
                "profileId": "ccswitch_import_test",
                "keyAvailable": True,
            }],
        )
        resp = client.get("/api/ccswitch/providers")
        assert resp.status_code == 200
        provider = resp.json()["providers"][0]
        assert provider["profileId"] == "ccswitch_import_test"
        assert "apiKey" not in provider

    def test_ccswitch_route_test_falls_back_to_working_model(self, client: TestClient, monkeypatch):
        import backend.main as main_module

        calls = []

        class FakeResponse:
            status_code = 200
            text = "event: response.completed\ndata: {}\n"

            def __init__(self, success):
                self.is_success = success
                if not success:
                    self.status_code = 400
                    self.text = "unsupported model"

            def json(self):
                return {"error": {"message": "unsupported model"}}

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def post(self, url, headers, json):
                calls.append(json["model"])
                return FakeResponse(json["model"] == "gpt-5.5")

        monkeypatch.setattr(main_module.httpx, "Client", FakeClient)
        resp = client.post("/api/ccswitch/test", json={"endpoint": "http://127.0.0.1:15721/v1", "model": "missing-model"})
        assert resp.status_code == 200
        assert resp.json()["routeReady"] is True
        assert resp.json()["workingModel"] == "gpt-5.5"
        assert calls == ["missing-model", "gpt-5.5"]

    def test_ccswitch_sse_output_parser(self):
        from backend.core.providers.ccswitch_provider import CCSwitchProvider

        stream = "\n".join([
            "event: response.output_text.delta",
            'data: {"type":"response.output_text.delta","delta":"O"}',
            "event: response.output_text.delta",
            'data: {"type":"response.output_text.delta","delta":"K"}',
            "event: response.completed",
            'data: {"type":"response.completed","response":{"output_text":"OK"}}',
        ])
        assert CCSwitchProvider._sse_output_text(stream) == "OK"

    def test_openai_compatible_relay_test(self, client: TestClient, monkeypatch):
        import backend.main as main_module

        class FakeResponse:
            is_success = True
            status_code = 200

            def json(self):
                return {"choices": [{"message": {"content": "OK"}}]}

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def post(self, url, headers, json):
                assert url == "https://relay.example/v1/chat/completions"
                assert headers["Authorization"] == "Bearer secret"
                return FakeResponse()

        monkeypatch.setattr(main_module.httpx, "Client", FakeClient)
        resp = client.post(
            "/api/provider/test",
            json={"endpoint": "https://relay.example/v1", "apiKey": "secret", "model": "relay-model"},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestRoomCreate:
    def test_create_room(self, client: TestClient):
        resp = client.post(
            "/room/create",
            json={
                "title": "Integration Test Room",
                "owner_user": "User",
                "host_agent": {"name": "Mock Host", "provider": "mock", "role": "host"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["room"]["title"] == "Integration Test Room"
        assert len(data["room"]["members"]) >= 1

    def test_get_room(self, client: TestClient, room_id: str):
        resp = client.get(f"/room/{room_id}")
        assert resp.status_code == 200
        assert resp.json()["room"]["room_id"] == room_id

    def test_get_nonexistent_room(self, client: TestClient):
        resp = client.get("/room/nonexistent-id")
        assert resp.status_code == 404


class TestRoomMessage:
    def test_post_message(self, client: TestClient, room_id: str):
        resp = client.post(f"/room/{room_id}/message", json={"content": "Hello"})
        assert resp.status_code == 200
        messages = resp.json()["latest_messages"]
        assert len(messages) == 2  # user + agent response
        assert messages[0]["sender_type"] == "user"
        assert messages[1]["sender_type"] == "agent"

    def test_private_chat(self, client: TestClient, room_id: str):
        resp = client.post(
            "/chat/private/mock-gpt-host",
            json={"room_id": room_id, "content": "Private message"},
        )
        assert resp.status_code in (200, 400)


class TestAgentInstances:
    def test_create_instance(self, client: TestClient):
        resp = client.post(
            "/agents/instances/create",
            json={
                "agent_id": "test_instance_1",
                "display_name": "Test GPT",
                "provider": "mock",
                "model": "mock-gpt",
                "credential_id": "mock_default",
                "role": "expert",
                "position_id": "domain_expert",
                "position_name": "Domain Expert",
                "persona": "Testing",
                "context_limit_tokens": 8000,
            },
        )
        assert resp.status_code == 200

    def test_list_instances(self, client: TestClient):
        resp = client.get("/agents/instances")
        assert resp.status_code == 200
        assert "instances" in resp.json()

    def test_list_templates(self, client: TestClient):
        resp = client.get("/agents/templates")
        assert resp.status_code == 200
        assert "templates" in resp.json()


class TestAddAgentToRoom:
    def test_add_agent_instance(self, client: TestClient, room_id: str):
        client.post(
            "/agents/instances/create",
            json={
                "agent_id": "add_test_agent",
                "display_name": "Add Test",
                "provider": "mock",
                "model": "mock-gpt",
                "credential_id": "mock_default",
                "role": "expert",
                "position_id": "domain_expert",
                "position_name": "Domain Expert",
                "persona": "Test",
                "context_limit_tokens": 8000,
            },
        )
        resp = client.post(
            f"/room/{room_id}/agents/add-instance",
            json={"agent_id": "add_test_agent"},
        )
        assert resp.status_code == 200


class TestPositions:
    def test_list_positions(self, client: TestClient):
        resp = client.get("/positions/templates")
        assert resp.status_code == 200
        positions = resp.json()["positions"]
        assert len(positions) >= 5


class TestProviders:
    def test_list_providers(self, client: TestClient):
        resp = client.get("/providers")
        assert resp.status_code == 200
        assert len(resp.json()["providers"]) >= 5

    def test_list_profiles(self, client: TestClient):
        resp = client.get("/provider-profiles")
        assert resp.status_code == 200
        assert len(resp.json()["profiles"]) >= 3


class TestCredentials:
    def test_list_credentials(self, client: TestClient):
        resp = client.get("/credentials")
        assert resp.status_code == 200
        assert len(resp.json()["credentials"]) >= 3


class TestMinisters:
    def test_minister_presets(self, client: TestClient):
        resp = client.get("/ministers/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert "defaults" in data
        assert "optional" in data
        assert "advanced" in data
        assert len(data["defaults"]) >= 5


class TestRoomPanel:
    def test_panel_preview(self, client: TestClient, room_id: str):
        resp = client.post(
            f"/room/{room_id}/panel/preview",
            json={
                "selected_agent_ids": [],
                "blocker": "Need review",
                "need": "Code review",
                "constraints": ["MVP only"],
            },
        )
        assert resp.status_code == 200

    def test_panel_round_start(self, client: TestClient, room_id: str):
        resp = client.post(
            f"/room/{room_id}/panel/round/start",
            json={
                "participant_agent_ids": [],
                "current_goal": "Test goal",
                "constraints": [],
            },
        )
        assert resp.status_code == 200


class TestRoomDebate:
    def test_debate_round_start(self, client: TestClient, room_id: str):
        resp = client.post(
            f"/room/{room_id}/debate/round/start",
            json={
                "participant_agent_ids": [],
                "current_goal": "Find best solution",
                "constraints": [],
                "max_rounds": 2,
                "token_budget": 5000,
                "cost_budget": 3,
                "consensus_threshold": 0.66,
            },
        )
        assert resp.status_code == 200


class TestContext:
    def test_context_usage(self, client: TestClient, room_id: str):
        resp = client.get(f"/context/{room_id}/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["room_id"] == room_id
        assert len(data["agents"]) >= 1

    def test_context_compact(self, client: TestClient, room_id: str):
        resp = client.post(f"/context/{room_id}/compact")
        assert resp.status_code == 200


class TestHistory:
    def test_list_history(self, client: TestClient):
        resp = client.get("/history/rooms")
        assert resp.status_code == 200
        assert "rooms" in resp.json()


class TestDemoRoom:
    def test_create_demo(self, client: TestClient):
        resp = client.post("/demo/create-room")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["room"]["members"]) >= 3
