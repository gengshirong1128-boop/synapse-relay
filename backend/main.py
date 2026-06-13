from __future__ import annotations

import os
import json
import smtplib
import subprocess
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.config import FRONTEND_DIR, REACT_FRONTEND_DIST, ROOT_DIR, get_settings
from backend.core.agent_instance import agent_instance_store
from backend.core.agent_factory import build_agent_from_instance
from backend.core.chatroom import (
    apply_imperial_review,
    add_agent_instance_to_room,
    add_agent_member,
    build_runtime_directives,
    create_system_message,
    post_user_message,
    remove_agent_member,
    room_store,
    set_chief_agent,
    set_active_agent,
    set_room_mode,
    set_work_mode,
)
from backend.core.context_manager import context_manager
from backend.core.context_builder import build_project_context, select_relevant_files
from backend.core.credentials import credential_store
from backend.core.ccswitch_store import sync_ccswitch_providers, test_ccswitch_provider
from backend.core.app_targets import app_target_store, check_app_target, export_app_target, preview_app_target
from backend.core.debate import (
    build_final_answer,
    build_room_final_plan,
    evaluate_stop_condition,
    run_debate_round,
)
from backend.core.history_store import history_store
from backend.core.panel import preview_room_handoffs, run_panel_handoff, run_primary_panel_turn
from backend.core.positions import position_store
from backend.core.project_index import project_index_store
from backend.core.rounds import evaluate_debate_stop, run_round
from backend.core.session import session_store
from backend.core.token_meter import estimate_cost, estimate_payload_tokens
from backend.core.executors import ClaudeCodeExporter, CodexExporter, GenericExporter
from backend.core.executors.runner import check_executor, run_executor
from backend.core.executors.runner import build_confirmation_token, run_store
from backend.schemas import (
    ActiveAgentRequest,
    AddAgentInstanceToRoomRequest,
    AddAgentRequest,
    AgentInstanceCreateRequest,
    AgentInstancePatchRequest,
    CompactResponse,
    ContextUsageResponse,
    DebateContinueRequest,
    DebateRoundContinueRequest,
    DebateRoundStartRequest,
    DebateStartRequest,
    FinalizeRequest,
    AgentRole,
    MessageState,
    Mode,
    PanelHandoffRequest,
    PanelRoundContinueRequest,
    PanelRoundFeedbackRequest,
    PanelRoundStartRequest,
    PanelStartRequest,
    PositionAssignRequest,
    PositionCustomCreateRequest,
    PrivateChatRequest,
    PrivateSyncRequest,
    RemoveAgentRequest,
    RoomCreateRequest,
    RoomDebateContinueRequest,
    RoomDebateRequest,
    RoomEnvelope,
    RoomMessageRequest,
    RoomModeRequest,
    RoomPanelRequest,
    RoomProjectAttachRequest,
    SessionEnvelope,
    SoloRequest,
    TokenUsage,
    ProjectScanRequest,
    ProjectRelevantFilesRequest,
    ProjectContextBuildRequest,
    ExecutorExportRequest,
    ExecutionPackage,
    ProviderProfileCreateRequest,
    ProviderProfilePatchRequest,
    ProviderProfileTestRequest,
    ExecutorRunRequest,
    AgentConfig,
    AppTargetPreviewRequest,
    AppTargetExportRequest,
    RoomRenameRequest,
    RoomArchiveRequest,
    RoomPinRequest,
    ChiefAgentRequest,
    WorkModeRequest,
    ImperialReviewRequest,
    RoomSettingsPatchRequest,
)
from backend.core.provider_profiles import provider_profile_store
from backend.core.provider_detection import detect_cli_tools, local_tool_config, test_local_tool
from backend.core.ai_member_settings import ai_member_settings_store
from backend.core.ai_websites import get_ai_website
from backend.core.web_ai_adapters import ai_website_registry
from backend.core.web_ai_browser import web_ai_browser_manager
from backend.core.app_settings import app_settings_store
from backend.core.providers.provider_registry import provider_registry
from backend.core.council_service import council_service
from backend.core.minister_registry import minister_presets

settings = get_settings()
app = FastAPI(title=settings.app_name)
ISSUE_REPORT_DIR = ROOT_DIR / ".synapse" / "runtime" / "issue_reports"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_token_usage(payload) -> TokenUsage:
    estimated_tokens = estimate_payload_tokens(payload)
    return TokenUsage(
        estimated_tokens=estimated_tokens,
        estimated_cost=estimate_cost(estimated_tokens, settings.cost_per_1k_tokens),
    )


def get_room_or_404(room_id: str):
    try:
        return room_store.get(room_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def build_room_envelope(
    room,
    latest_messages=None,
    host_decision=None,
    handoff_packet=None,
    shared_brief=None,
    latest_round=None,
):
    return RoomEnvelope(
        room=room,
        latest_messages=latest_messages or [],
        host_decision=host_decision,
        handoff_packet=handoff_packet,
        shared_brief=shared_brief,
        latest_round=latest_round,
        token_usage=build_token_usage(room.model_dump(mode="json")),
    )


def _pick_round(room, round_id: str | None):
    if not room.rounds:
        return None
    if round_id is None:
        return room.rounds[-1]
    return next((item for item in room.rounds if item.round_id == round_id), room.rounds[-1])


def _build_execution_package(room, request: ExecutorExportRequest, executor_type: str) -> ExecutionPackage:
    round_record = _pick_round(room, request.round_id)
    context = room.attached_project_context or {}
    if request.project_id:
        cached = project_index_store.get_context(request.project_id)
        if cached:
            context = cached.model_dump(mode="json")
        else:
            index = project_index_store.get(request.project_id)
            context = {
                "project_id": index.project_id,
                "project_name": index.project_name,
                "project_path": index.project_path,
                "relevant_files": [],
                "dependency_files": [],
                "warnings": index.warnings,
            }

    relevant_files_raw = context.get("relevant_files", [])
    selected_set = set(request.selected_files)
    if selected_set:
        relevant_files_raw = [item for item in relevant_files_raw if item.get("relative_path") in selected_set]
    relevant_files = []
    for item in relevant_files_raw[:10]:
        snippets = item.get("snippets", [])
        snippet_text = snippets[0].get("content", "") if snippets else ""
        relevant_files.append(
            {
                "path": item.get("relative_path", ""),
                "reason": item.get("reason", ""),
                "snippet": snippet_text[:900],
            }
        )

    final_plan = request.final_plan or room.final_plan or ""
    if not final_plan and round_record and round_record.coordinator_output:
        final_plan = round_record.coordinator_output.final_answer_candidate

    modification_steps = []
    if round_record and round_record.coordinator_output:
        modification_steps.extend(
            item.get("task", "")
            for item in round_record.coordinator_output.next_round_task_assignments
            if item.get("task")
        )
    liaison_output = None
    if round_record:
        liaison_output = next(
            (item for item in round_record.specialist_outputs if item.position_id == "executor_liaison"),
            None,
        )
    if liaison_output:
        modification_steps.insert(0, liaison_output.suggested_action)
    if not modification_steps:
        modification_steps = [
            "Inspect selected files and explain the planned minimal changes.",
            "Apply minimal code edits aligned with final plan.",
            "Run validation commands and summarize results.",
        ]

    validation_commands = [
        "python -m compileall backend",
        "python scripts\\validate_round_workflow.py",
    ]
    if room.attached_project_path and "package.json" in " ".join(file.get("path", "") for file in relevant_files):
        validation_commands.append("npm test")
    package = ExecutionPackage(
        executor_type=executor_type,  # type: ignore[arg-type]
        project_path=room.attached_project_path or context.get("project_path", ""),
        task_goal=room.title,
        final_plan=final_plan or "No final plan generated yet. Use latest coordinator summary.",
        relevant_files=relevant_files,
        modification_steps=modification_steps[:8],
        validation_commands=validation_commands,
        constraints=[
            "Do not perform unrelated refactors.",
            "Do not delete user code.",
            "Prefer minimal viable modifications.",
            "Explain the edit plan before applying changes.",
        ],
        rollback_notes=["Create checkpoints before touching risky files.", "Keep changes scoped and reversible."],
        generated_prompt="",
    )
    return package


def _available_providers() -> list[dict]:
    return [
        {"provider": "mock", "api_format": "mock"},
        {"provider": "openai", "api_format": "openai_compatible"},
        {"provider": "deepseek", "api_format": "openai_compatible"},
        {"provider": "openrouter", "api_format": "openrouter"},
        {"provider": "newapi", "api_format": "newapi"},
        {"provider": "ccswitch", "api_format": "openai_compatible"},
        {"provider": "qwen", "api_format": "qwen"},
        {"provider": "claude", "api_format": "anthropic"},
        {"provider": "gemini", "api_format": "gemini"},
        {"provider": "webai", "api_format": "web_browser"},
    ]


def _diagnose_profile(profile_id: str, smoke_test: bool = False, model: str | None = None):
    profile = provider_profile_store.get(profile_id)
    credential = credential_store.get(profile.credential_id)
    credential_store.reload()
    warnings = []
    errors = []
    if not profile.base_url and profile.api_format != "mock":
        warnings.append("base_url is empty.")
    if not profile.default_model and not profile.models:
        warnings.append("default_model/models is empty.")
    if not profile.target_apps:
        warnings.append("target_apps is empty.")
    if profile.api_format not in {"openai_compatible", "anthropic", "gemini", "qwen", "openrouter", "newapi", "mock"}:
        errors.append("Unsupported api_format.")
    if not credential.key_available and profile.api_format != "mock":
        warnings.append("API key not available in environment, fallback to mock expected.")

    smoke_result = None
    if smoke_test and credential.key_available:
        try:
            temp_instance = agent_instance_store.create(
                AgentInstanceCreateRequest(
                    agent_id=f"diagnose_{profile_id}",
                    display_name=f"Diagnose-{profile_id}",
                    provider=profile.provider,
                    model=model or profile.default_model or (profile.models[0] if profile.models else "mock-gpt"),
                    credential_id=profile.credential_id,
                    profile_id=profile.profile_id,
                    role=AgentRole.EXPERT,
                    position_id="domain_expert",
                    position_name="Domain Expert",
                    persona="profile diagnose",
                    context_limit_tokens=8000,
                )
            )
        except ValueError:
            temp_instance = agent_instance_store.get(f"diagnose_{profile_id}")
        agent = build_agent_from_instance(temp_instance)
        if hasattr(agent, "test_connection"):
            smoke_result = agent.test_connection("Respond with profile diagnose ok")
        else:
            smoke_result = {"success": False, "fallback_to_mock": True, "error": "agent_has_no_test_connection", "latency_ms": 0}

    success = not errors
    if smoke_result and not smoke_result.get("success"):
        success = False

    return {
        "profile_id": profile.profile_id,
        "provider": profile.provider,
        "api_format": profile.api_format,
        "key_available": credential.key_available,
        "warnings": warnings,
        "errors": errors,
        "success": success,
        "fallback_to_mock": (not credential.key_available) or bool(smoke_result and smoke_result.get("fallback_to_mock")),
        "latency_ms": 0 if not smoke_result else smoke_result.get("latency_ms", 0),
        "smoke_test": smoke_result,
    }


@app.get("/ministers/presets")
def get_minister_presets():
    presets = minister_presets()
    return {
        "defaults": [item.model_dump(mode="json") for item in presets["defaults"]],
        "optional": [item.model_dump(mode="json") for item in presets["optional"]],
        "advanced": [item.model_dump(mode="json") for item in presets["advanced"]],
    }


def _ensure_agent_instance(request: AgentInstanceCreateRequest):
    try:
        return agent_instance_store.create(request)
    except ValueError:
        return agent_instance_store.get(request.agent_id)


@app.get("/")
def index():
    if REACT_FRONTEND_DIST.exists():
        return FileResponse(str(REACT_FRONTEND_DIST / "index.html"))
    return RedirectResponse(url="/frontend/index.html")


@app.get("/app/{path:path}")
def react_app_fallback(path: str):
    if not REACT_FRONTEND_DIST.exists():
        raise HTTPException(status_code=404, detail="React frontend is not built")
    target = REACT_FRONTEND_DIST / path
    if target.exists() and target.is_file():
        return FileResponse(str(target))
    return FileResponse(str(REACT_FRONTEND_DIST / "index.html"))


@app.get("/history/rooms")
def history_rooms(include_archived: bool = False, limit: int = 20):
    return {
        "rooms": history_store.list_rooms(include_archived=include_archived, limit=limit),
    }


@app.get("/history/rooms/{room_id}")
def history_room_get(room_id: str):
    try:
        room = history_store.load_room(room_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    room_store.save(room)
    latest_round = room.rounds[-1] if room.rounds else None
    return build_room_envelope(room, latest_messages=room.messages[-20:], latest_round=latest_round)


@app.post("/history/rooms/{room_id}/rename")
def history_room_rename(room_id: str, request: RoomRenameRequest):
    try:
        result = history_store.rename_room(room_id, request.title)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return result


@app.post("/history/rooms/{room_id}/archive")
def history_room_archive(room_id: str, request: RoomArchiveRequest):
    try:
        return history_store.archive_room(room_id, archived=request.archived)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/history/rooms/{room_id}/pin")
def history_room_pin(room_id: str, request: RoomPinRequest):
    try:
        return history_store.pin_room(room_id, pinned=request.pinned)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/history/rooms/{room_id}")
def history_room_delete(room_id: str):
    return history_store.delete_room(room_id)


@app.get("/history/search")
def history_search(q: str, limit: int = 20):
    return {"rooms": history_store.search(q, limit=limit)}


@app.get("/history/rooms/{room_id}/export")
def history_export(room_id: str):
    try:
        markdown = history_store.export_transcript_markdown(room_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"room_id": room_id, "format": "markdown", "content": markdown}


@app.post("/project/scan")
def project_scan(request: ProjectScanRequest):
    try:
        index = project_index_store.scan(request.project_path, request.max_file_size_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    indexed_files = len([item for item in index.files if item.is_readable])
    return {
        "project_id": index.project_id,
        "project_name": index.project_name,
        "project_path": index.project_path,
        "total_files": index.total_files,
        "indexed_files": indexed_files,
        "ignored_files": len(index.ignored_files),
        "warnings": index.warnings,
    }


@app.get("/project/{project_id}/tree")
def project_tree(project_id: str):
    try:
        index = project_index_store.get(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "project_id": index.project_id,
        "project_name": index.project_name,
        "project_path": index.project_path,
        "file_tree": project_index_store.file_tree(project_id),
        "ignored_files": index.ignored_files[:300],
        "ignored_dirs": index.ignored_dirs,
        "warnings": index.warnings,
    }


@app.post("/project/{project_id}/relevant-files")
def project_relevant_files(project_id: str, request: ProjectRelevantFilesRequest):
    try:
        index = project_index_store.get(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    relevant = select_relevant_files(
        index=index,
        question=request.question,
        top_k=request.top_k,
        manual_selected_paths=request.manual_selected_paths,
    )
    return {
        "project_id": project_id,
        "question": request.question,
        "relevant_files": [item.model_dump(mode="json") for item in relevant],
    }


@app.post("/project/{project_id}/context-build")
def project_context_build(project_id: str, request: ProjectContextBuildRequest):
    try:
        context = build_project_context(project_id, request.question, request.selected_paths)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "project_context": context.model_dump(mode="json"),
        "token_estimate": context.context_token_estimate,
    }


@app.post("/project/{project_id}/compact-context")
def project_compact_context(project_id: str, request: ProjectContextBuildRequest):
    """返回安全裁剪后的项目上下文，包含 selectedFiles/skippedFiles/warnings/tokenEstimate。"""
    from pathlib import Path

    MAX_SINGLE_FILE = 200_000
    MAX_TOTAL_CHARS = 800_000
    try:
        index = project_index_store.get(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="project_id not found") from exc

    project_root = Path(index.project_path).resolve()
    question = request.question or ""
    selected_paths = request.selected_paths or []
    selected_files: list[dict] = []
    skipped_files: list[dict] = []
    warnings: list[str] = []

    total_chars = 0

    # Select relevant files
    relevant = select_relevant_files(index, question, top_k=min(10, max(5, len(selected_paths) or 8)), manual_selected_paths=selected_paths)
    if selected_paths:
        selected_set = set(selected_paths)
        relevant = [r for r in relevant if r.relative_path in selected_set]

    for rel_file in relevant:
        file_item = next((f for f in index.files if f.relative_path == rel_file.relative_path), None)
        if file_item is None:
            skipped_files.append({"path": rel_file.relative_path, "reason": "not_found_in_index"})
            continue
        if file_item.is_sensitive:
            skipped_files.append({"path": rel_file.relative_path, "reason": "sensitive_file_excluded"})
            continue
        if not file_item.is_readable:
            skipped_files.append({"path": rel_file.relative_path, "reason": "unreadable_or_binary"})
            continue
        if file_item.size_bytes > MAX_SINGLE_FILE:
            warnings.append(f"文件过大，已截断: {file_item.relative_path} ({file_item.size_bytes / 1024:.0f}KB)")

        try:
            file_path = Path(file_item.path).resolve()
            file_path.relative_to(project_root)
            raw = file_path.read_text(encoding="utf-8", errors="ignore")
        except ValueError:
            skipped_files.append({"path": file_item.relative_path, "reason": "path_outside_project"})
            continue
        except Exception:
            skipped_files.append({"path": file_item.relative_path, "reason": "read_error"})
            continue

        snippet = raw[:MAX_SINGLE_FILE]
        if len(raw) > MAX_SINGLE_FILE:
            snippet = snippet + "\n\n... [文件已截断：超过 200KB 上限] ..."
        selected_files.append({
            "path": file_item.relative_path,
            "language": file_item.language,
            "size_bytes": file_item.size_bytes,
            "content": snippet,
        })
        total_chars += len(snippet)

        # Stop if total context too large
        if total_chars > MAX_TOTAL_CHARS:
            warnings.append(f"上下文超过 {MAX_TOTAL_CHARS} 字符上限，后续相关文件已跳过。")
            break

    token_est = total_chars // 4  # rough token estimate

    if not selected_files:
        warnings.append("没有找到匹配问题的可读文件。")

    return {
        "project_id": project_id,
        "selectedFiles": selected_files,
        "skippedFiles": skipped_files,
        "warnings": warnings,
        "tokenEstimate": token_est,
    }


@app.get("/agents/templates")
def agent_templates():
    return {"templates": [item.model_dump(mode="json") for item in agent_instance_store.list_templates()]}


@app.get("/providers")
def providers_list():
    return {"providers": _available_providers()}


@app.get("/providers/detect-local-tools")
def detect_local_tools():
    return {"tools": detect_cli_tools()}


@app.post("/providers/local-tools/{tool_id}/test")
def local_tool_test(tool_id: str):
    try:
        return test_local_tool(tool_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/providers/local-tools/{tool_id}/config")
def local_tool_config_get(tool_id: str):
    try:
        return local_tool_config(tool_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/app-settings")
def app_settings_get():
    return {"settings": app_settings_store.get()}


@app.patch("/app-settings")
def app_settings_patch(payload: dict):
    try:
        return {"settings": app_settings_store.patch(payload)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/ai-members")
def ai_members_get():
    return {
        "appSettings": app_settings_store.get(),
        "settings": ai_member_settings_store.get(),
        "profiles": [item.model_dump(mode="json") for item in provider_profile_store.list()],
        "localTools": detect_cli_tools(),
        "websites": ai_website_registry.list_sites(),
    }


def _provider_for_profile_id(profile_id: str):
    if not profile_id:
        return provider_registry.get("mock")
    if profile_id.startswith("webai:"):
        return provider_registry.get("webai")
    try:
        profile = provider_profile_store.get(profile_id)
    except KeyError:
        return provider_registry.get("mock")
    return provider_registry.get(profile.provider)


@app.get("/ai-members/websites")
def ai_members_websites():
    return {"websites": ai_website_registry.list_sites()}


@app.get("/ai-members/websites/{site_id}/status")
def ai_members_website_status(site_id: str):
    try:
        return {"site": ai_website_registry.get_site(site_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/ai-members/websites/{site_id}/open")
def ai_members_website_open(site_id: str):
    try:
        adapter = ai_website_registry.adapter_for(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = adapter.open("website")
    return {**result, "site": ai_website_registry.get_site(site_id)}


@app.patch("/ai-members/websites/{site_id}/login")
def ai_members_website_login_config(site_id: str, payload: dict):
    try:
        get_ai_website(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    username = str(payload.get("username") or "")
    password_env_name = str(payload.get("passwordEnvName") or "")
    login_status = str(payload.get("loginStatus") or "not_checked")
    if password_env_name and not password_env_name.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="invalid_password_env_name")
    settings_payload = {
        "websiteLogins": {
            site_id: {
                "username": username,
                "passwordEnvName": password_env_name,
                "loginStatus": login_status,
            }
        }
    }
    return {"settings": ai_member_settings_store.patch(settings_payload)}


@app.post("/ai-members/websites/{site_id}/login-fallback")
def ai_members_website_login_fallback(site_id: str):
    try:
        adapter = ai_website_registry.adapter_for(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = adapter.request_manual_login()
    return {**result, "site": ai_website_registry.get_site(site_id)}


@app.post("/ai-members/websites/{site_id}/login-detect")
def ai_members_website_login_detect(site_id: str):
    try:
        adapter = ai_website_registry.adapter_for(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = adapter.detect_login()
    return {**result, "site": ai_website_registry.get_site(site_id)}


@app.post("/ai-members/websites/{site_id}/browser/close")
def ai_members_website_browser_close(site_id: str):
    try:
        adapter = ai_website_registry.adapter_for(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = adapter.close_browser()
    return {**result, "site": ai_website_registry.get_site(site_id)}


@app.post("/ai-members/websites/{site_id}/call")
def ai_members_website_call(site_id: str, payload: dict):
    try:
        adapter = ai_website_registry.adapter_for(site_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    prompt = str(payload.get("prompt") or "")
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    result = adapter.call(prompt)
    if result.get("success"):
        return {**result, "site": ai_website_registry.get_site(site_id)}
    if result.get("error") == "web_prompt_automation_not_implemented":
        raise HTTPException(status_code=501, detail=result)
    if result.get("status") == "login_required" or result.get("error") in {"browser_session_not_open", "prompt_input_not_found"}:
        raise HTTPException(status_code=409, detail=result)
    if result.get("error") == "response_timeout":
        raise HTTPException(status_code=504, detail=result)
    raise HTTPException(status_code=500, detail=result)


@app.patch("/ai-members/settings")
def ai_members_settings_patch(payload: dict):
    try:
        return {"settings": ai_member_settings_store.patch(payload)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/ai-members/roles/{role_id}/assign")
def ai_members_role_assign(role_id: str, payload: dict):
    provider_profile_id = str(payload.get("profileId") or "")
    local_tool_id = str(payload.get("localToolId") or "")
    website_id = str(payload.get("websiteId") or "")
    patch: dict = {"roleAssignments": {}}
    if website_id:
        try:
            site = ai_website_registry.get_site(website_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if not site.get("webAI", {}).get("canSendPrompt"):
            raise HTTPException(status_code=400, detail="website_does_not_support_prompt_automation")
        patch["roleAssignments"][role_id] = f"webai:{website_id}"
    if provider_profile_id:
        if provider_profile_id.startswith("webai:"):
            website_id_from_profile = provider_profile_id.split(":", 1)[1]
            try:
                site = ai_website_registry.get_site(website_id_from_profile)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc
            if not site.get("webAI", {}).get("canSendPrompt"):
                raise HTTPException(status_code=400, detail="website_does_not_support_prompt_automation")
        else:
            try:
                provider_profile_store.get(provider_profile_id)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc
        patch["roleAssignments"][role_id] = provider_profile_id
    if role_id == "chief" and local_tool_id:
        try:
            local_tool_config(local_tool_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        patch["chiefLocalToolId"] = local_tool_id
    try:
        return {"settings": ai_member_settings_store.patch(patch)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/agents/instances/create")
def agent_instance_create(request: AgentInstanceCreateRequest):
    try:
        instance = agent_instance_store.create(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return instance


@app.get("/agents/instances")
def agent_instances():
    return {"instances": [item.model_dump(mode="json") for item in agent_instance_store.list_instances()]}


@app.patch("/agents/instances/{agent_id}")
def agent_instance_patch(agent_id: str, request: AgentInstancePatchRequest):
    try:
        instance = agent_instance_store.patch(agent_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return instance


@app.patch("/agents/instances/{agent_id}/position")
def agent_instance_assign_position(agent_id: str, request: PositionAssignRequest):
    try:
        instance = agent_instance_store.patch(
            agent_id,
            AgentInstancePatchRequest(position_id=request.position_id, position_name=request.position_name),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return instance


@app.get("/credentials")
def credentials_list():
    credentials = credential_store.reload()
    return {
        "credentials": [
            {
                "credential_id": item.credential_id,
                "provider": item.provider,
                "name": item.name,
                "api_key_env_name": item.api_key_env_name,
                "key_available": item.key_available,
                "enabled": item.enabled,
            }
            for item in credentials
        ]
    }


@app.post("/credentials/reload")
def credentials_reload():
    credentials = credential_store.reload()
    return {
        "reloaded": True,
        "credentials": [
            {
                "credential_id": item.credential_id,
                "provider": item.provider,
                "name": item.name,
                "api_key_env_name": item.api_key_env_name,
                "key_available": item.key_available,
                "enabled": item.enabled,
            }
            for item in credentials
        ],
    }


@app.get("/provider-profiles")
def provider_profiles_list():
    credential_store.reload()
    profiles = provider_profile_store.list()
    credentials_by_id = {item.credential_id: item for item in credential_store.list()}
    credential_summaries = []
    enriched_profiles = []
    for profile in profiles:
        credential = credentials_by_id.get(profile.credential_id)
        profile_payload = profile.model_dump(mode="json")
        profile_payload["credential"] = {
            "credential_id": profile.credential_id,
            "provider": credential.provider if credential else profile.provider,
            "api_key_env_name": profile.auth_env_name or (credential.api_key_env_name if credential else ""),
            "key_available": bool(credential.key_available) if credential else False,
            "enabled": bool(credential.enabled) if credential else False,
        }
        enriched_profiles.append(profile_payload)

    for credential in credentials_by_id.values():
        credential_summaries.append({
            "credential_id": credential.credential_id,
            "provider": credential.provider,
            "name": credential.name,
            "api_key_env_name": credential.api_key_env_name,
            "key_available": credential.key_available,
            "enabled": credential.enabled,
        })

    return {
        "profiles": enriched_profiles,
        "profile_count": len(enriched_profiles),
        "credentials": credential_summaries,
    }


@app.post("/provider-profiles/create")
def provider_profiles_create(request: ProviderProfileCreateRequest):
    try:
        profile = provider_profile_store.create(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return profile


@app.patch("/provider-profiles/{profile_id}")
def provider_profiles_patch(profile_id: str, request: ProviderProfilePatchRequest):
    try:
        profile = provider_profile_store.patch(profile_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return profile


@app.post("/provider-profiles/{profile_id}/configure")
def provider_profiles_configure(profile_id: str, payload: dict):
    try:
        profile = provider_profile_store.get(profile_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    patch_payload: dict = {}
    base_url = str(payload.get("baseUrl") or payload.get("base_url") or "").strip()
    model = str(payload.get("model") or "").strip()
    auth_env_name = str(payload.get("authEnvName") or payload.get("auth_env_name") or "").strip()
    api_key = str(payload.get("apiKey") or payload.get("api_key") or "").strip()

    if base_url:
        if not (base_url.startswith("http://") or base_url.startswith("https://")):
            raise HTTPException(status_code=400, detail="invalid_base_url")
        patch_payload["base_url"] = base_url
    if model:
        patch_payload["default_model"] = model
        patch_payload["models"] = sorted(set([*profile.models, model]))
    if auth_env_name:
        patch_payload["auth_env_name"] = auth_env_name

    if patch_payload:
        profile = provider_profile_store.patch(profile_id, ProviderProfilePatchRequest(**patch_payload))

    if api_key or auth_env_name:
        try:
            credential_store.set_runtime_key(profile.credential_id, api_key, auth_env_name or profile.auth_env_name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    credential_store.reload()
    credential = credential_store.get(profile.credential_id)
    if profile.auth_env_name:
        credential.key_available = bool(os.getenv(profile.auth_env_name, "").strip())
    return {
        "profile": profile.model_dump(mode="json"),
        "credential": {
            "credential_id": credential.credential_id,
            "provider": credential.provider,
            "api_key_env_name": profile.auth_env_name or credential.api_key_env_name,
            "key_available": credential.key_available,
            "enabled": credential.enabled,
        },
    }


@app.delete("/provider-profiles/{profile_id}")
def provider_profiles_delete(profile_id: str):
    provider_profile_store.delete(profile_id)
    return {"deleted": True, "profile_id": profile_id}


@app.post("/provider-profiles/{profile_id}/test")
def provider_profiles_test(profile_id: str, request: ProviderProfileTestRequest):
    try:
        profile = provider_profile_store.get(profile_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    credential_store.reload()
    credential = credential_store.get(profile.credential_id)
    if profile.auth_env_name:
        credential.api_key_env_name = profile.auth_env_name
        credential.key_available = bool(os.getenv(profile.auth_env_name, "").strip())
    if not credential.key_available:
        return {
            "profile_id": profile_id,
            "success": False,
            "fallback_to_mock": True,
            "latency_ms": 0,
            "error": "missing_api_key",
        }

    try:
        temp_instance = agent_instance_store.create(
            AgentInstanceCreateRequest(
                agent_id=f"provider_test_{profile_id}",
                display_name=f"ProviderTest-{profile_id}",
                provider=profile.provider,
                model=request.model or profile.default_model or "mock-gpt",
                credential_id=profile.credential_id,
                profile_id=profile.profile_id,
                role=AgentRole.EXPERT,
                position_id="domain_expert",
                position_name="Domain Expert",
                persona="provider profile test",
                context_limit_tokens=8000,
            )
        )
    except ValueError:
        temp_instance = agent_instance_store.get(f"provider_test_{profile_id}")

    agent = build_agent_from_instance(temp_instance)
    if hasattr(agent, "test_connection"):
        result = agent.test_connection(request.test_prompt)
    else:
        result = {"success": False, "fallback_to_mock": True, "error": "agent_has_no_test_connection", "latency_ms": 0}
    return {"profile_id": profile_id, **result}


@app.post("/provider-profiles/{profile_id}/diagnose")
def provider_profiles_diagnose(profile_id: str, request: ProviderProfileTestRequest):
    try:
        return _diagnose_profile(profile_id, smoke_test=request.smoke_test, model=request.model)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/app-targets")
def app_targets_list():
    return {"targets": [item.model_dump(mode="json") for item in app_target_store.list()]}


@app.post("/app-targets/preview-config")
def app_targets_preview(request: AppTargetPreviewRequest):
    try:
        return preview_app_target(request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/app-targets/export-config")
def app_targets_export(request: AppTargetExportRequest):
    try:
        return export_app_target(request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/app-targets/check")
def app_targets_check(request: AppTargetPreviewRequest):
    try:
        return check_app_target(request.target_app)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/app-targets/claude-code/preview")
def app_targets_claude_preview(request: AppTargetPreviewRequest):
    payload = request.model_copy(update={"target_app": "claude_code"})
    return preview_app_target(payload)


@app.post("/app-targets/claude-code/export")
def app_targets_claude_export(request: AppTargetExportRequest):
    payload = request.model_copy(update={"target_app": "claude_code"})
    return export_app_target(payload)


@app.post("/app-targets/codex/preview")
def app_targets_codex_preview(request: AppTargetPreviewRequest):
    payload = request.model_copy(update={"target_app": "codex"})
    return preview_app_target(payload)


@app.post("/app-targets/codex/export")
def app_targets_codex_export(request: AppTargetExportRequest):
    payload = request.model_copy(update={"target_app": "codex"})
    return export_app_target(payload)


@app.get("/positions/templates")
def position_templates():
    return {"positions": [item.model_dump(mode="json") for item in position_store.list()]}


@app.post("/positions/custom")
def position_custom(request: PositionCustomCreateRequest):
    position = position_store.add_custom(request)
    return position


@app.post("/room/create")
def room_create(request: RoomCreateRequest):
    room = room_store.create_default_room(request)
    create_system_message(room, f"会审「{room.title}」已创建，当前主持 AI：{room.members[0].display_name or room.members[0].name}。")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:])


@app.post("/demo/create-room")
def demo_create_room():
    room = room_store.create_default_room(
        RoomCreateRequest(
            title="演示会审",
            owner_user="User",
            host_agent=AgentConfig(name="Mock Claude 主持", provider="mock", role=AgentRole.HOST.value),
        )
    )

    demo_instances = [
        AgentInstanceCreateRequest(
            agent_id="demo_creative_gpt",
            display_name="Mock GPT 创意",
            provider="mock",
            model="mock-gpt",
            credential_id="mock_default",
            role=AgentRole.EXPERT,
            position_id="creative_strategist",
            position_name="Creative Strategist",
            persona="负责创意发散与策略构想。",
            context_limit_tokens=32000,
        ),
        AgentInstanceCreateRequest(
            agent_id="demo_implementer_deepseek",
            display_name="Mock DeepSeek 实现",
            provider="mock",
            model="mock-deepseek",
            credential_id="mock_default",
            role=AgentRole.EXPERT,
            position_id="code_implementer",
            position_name="Code Implementer",
            persona="负责将方案拆解为可执行的代码实现步骤。",
            context_limit_tokens=32000,
        ),
        AgentInstanceCreateRequest(
            agent_id="demo_reviewer_deepseek",
            display_name="Mock DeepSeek 审查",
            provider="mock",
            model="mock-deepseek",
            credential_id="mock_default",
            role=AgentRole.EXPERT,
            position_id="skeptic_reviewer",
            position_name="Skeptic Reviewer",
            persona="负责挑错质疑与风险审查。",
            context_limit_tokens=32000,
        ),
        AgentInstanceCreateRequest(
            agent_id="demo_executor_codex",
            display_name="Mock Codex 执行",
            provider="mock",
            model="mock-codex",
            credential_id="mock_default",
            role=AgentRole.EXECUTOR,
            position_id="executor_liaison",
            position_name="Executor Liaison",
            persona="负责对接本地 Codex/Claude Code 执行交付。",
            context_limit_tokens=32000,
        ),
    ]

    for request in demo_instances:
        instance = _ensure_agent_instance(request)
        add_agent_instance_to_room(room, instance)

    create_system_message(room, "演示会审已就绪，已加入主持与多位演示大臣。")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:])


@app.get("/room/{room_id}")
def room_get(room_id: str):
    room = get_room_or_404(room_id)
    context_manager.refresh_room(room)
    room_store.save(room)
    latest_round = room.rounds[-1] if room.rounds else None
    return build_room_envelope(room, latest_messages=room.messages[-20:], latest_round=latest_round)


@app.post("/room/{room_id}/project/attach")
def room_project_attach(room_id: str, request: RoomProjectAttachRequest):
    room = get_room_or_404(room_id)
    try:
        index = project_index_store.get(request.project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    context = project_index_store.get_context(request.project_id)
    if context is None:
        question = request.question or room.title
        context = build_project_context(request.project_id, question, request.selected_paths)

    room.attached_project_id = index.project_id
    room.attached_project_name = index.project_name
    room.attached_project_path = index.project_path
    room.attached_project_context = context.model_dump(mode="json")
    system_message = create_system_message(
        room,
        f"Project {index.project_name} attached with {len(context.relevant_files)} relevant files.",
        metadata={"project_id": index.project_id},
    )
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message], latest_round=room.rounds[-1] if room.rounds else None)


@app.get("/room/{room_id}/project/context")
def room_project_context(room_id: str):
    room = get_room_or_404(room_id)
    if not room.attached_project_id:
        return {"room_id": room.room_id, "project_context": None}
    return {
        "room_id": room.room_id,
        "project_id": room.attached_project_id,
        "project_name": room.attached_project_name,
        "project_path": room.attached_project_path,
        "project_context": room.attached_project_context,
    }


@app.post("/room/{room_id}/message")
def room_message(room_id: str, request: RoomMessageRequest):
    room = get_room_or_404(room_id)
    user_message, agent_message, host_decision = post_user_message(room, request.content)
    room_store.save(room)
    return build_room_envelope(
        room,
        latest_messages=[user_message, agent_message],
        host_decision=host_decision,
    )


@app.post("/room/{room_id}/agents/add")
def room_agents_add(room_id: str, request: AddAgentRequest):
    room = get_room_or_404(room_id)
    member = add_agent_member(room, request.agent, request.context_limit_tokens)
    system_message = create_system_message(room, f"{member.display_name or member.name} joined as {member.role.value}.")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message])


@app.post("/room/{room_id}/agents/add-instance")
def room_agents_add_instance(room_id: str, request: AddAgentInstanceToRoomRequest):
    room = get_room_or_404(room_id)
    try:
        instance = agent_instance_store.get(request.agent_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    member = add_agent_instance_to_room(room, instance)
    system_message = create_system_message(
        room,
        f"{member.display_name or member.name} joined ({member.provider}/{member.model}) as {member.position_name}.",
    )
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message])


@app.post("/room/{room_id}/agents/remove")
def room_agents_remove(room_id: str, request: RemoveAgentRequest):
    room = get_room_or_404(room_id)
    try:
        member = remove_agent_member(room, request.agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    system_message = create_system_message(room, f"{member.display_name or member.name} was removed from the room.")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message])


@app.post("/room/{room_id}/agents/remove-instance")
def room_agents_remove_instance(room_id: str, request: RemoveAgentRequest):
    return room_agents_remove(room_id, request)


@app.post("/room/{room_id}/mode")
def room_mode(room_id: str, request: RoomModeRequest):
    room = get_room_or_404(room_id)
    set_room_mode(room, request.mode)
    system_message = create_system_message(room, f"Room mode switched to {request.mode.value}.")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message])


@app.post("/room/{room_id}/active-agent")
def room_active_agent(room_id: str, request: ActiveAgentRequest):
    room = get_room_or_404(room_id)
    try:
        set_active_agent(room, request.agent_id)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    label = request.agent_id or room.host_agent_id
    system_message = create_system_message(room, f"Active agent switched to {label}.")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message])


@app.post("/room/{room_id}/chief-agent")
def room_chief_agent(room_id: str, request: ChiefAgentRequest):
    room = get_room_or_404(room_id)
    try:
        set_chief_agent(room, request.agent_id)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    system_message = create_system_message(room, f"Chief agent switched to {request.agent_id}.")
    context_manager.refresh_room(room)
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/room/{room_id}/work-mode")
def room_work_mode(room_id: str, request: WorkModeRequest):
    room = get_room_or_404(room_id)
    set_work_mode(room, request.mode)
    system_message = create_system_message(room, f"Active work mode set to {request.mode.value}.")
    room_store.save(room)
    return {
        "room_id": room.room_id,
        "active_mode": room.active_mode.value,
        "runtime_rules": build_runtime_directives(room),
        "message": system_message.model_dump(mode="json"),
    }


@app.patch("/room/{room_id}/settings")
def room_settings_patch(room_id: str, request: RoomSettingsPatchRequest):
    room = get_room_or_404(room_id)
    if request.theme is not None:
        room.settings.theme = request.theme
    if request.language is not None:
        room.settings.language = request.language
    room_store.save(room)
    return {"room_id": room.room_id, "settings": room.settings.model_dump(mode="json")}


@app.post("/room/{room_id}/messages/{message_id}/imperial-review")
def room_message_imperial_review(room_id: str, message_id: str, request: ImperialReviewRequest):
    room = get_room_or_404(room_id)
    try:
        target = apply_imperial_review(room, message_id=message_id, review_type=request.type, instruction=request.instruction)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    system_message = create_system_message(
        room,
        f"Imperial review applied: {'准奏' if request.type == 'approve' else '驳回'} on {target.sender_id}.",
        metadata={"review_type": request.type, "message_id": message_id},
    )
    room_store.save(room)
    return {
        "room_id": room.room_id,
        "message_id": target.message_id,
        "imperial_review": target.imperial_review,
        "guiding_directives": [item.model_dump(mode="json") for item in room.guiding_directives],
        "forbidden_directives": [item.model_dump(mode="json") for item in room.forbidden_directives],
        "runtime_rules": build_runtime_directives(room),
        "system_message": system_message.model_dump(mode="json"),
    }


@app.get("/room/{room_id}/agents/{agent_id}/stats")
def room_agent_stats(room_id: str, agent_id: str):
    room = get_room_or_404(room_id)
    usage = context_manager.refresh_room(room)
    member = next((m for m in room.members if m.agent_id == agent_id), None)
    if member is None:
        raise HTTPException(status_code=404, detail=f"Unknown agent_id: {agent_id}")
    usage_item = next((item for item in usage.agents if item.agent_id == agent_id), None)
    used = usage_item.used_tokens if usage_item else member.estimated_used_tokens
    limit = usage_item.limit_tokens if usage_item else member.context_limit_tokens
    return {
        "room_id": room.room_id,
        "agent_id": agent_id,
        "display_name": member.display_name or member.name,
        "model": member.model,
        "provider": member.provider,
        "is_chief": (room.chief_agent_id or room.host_agent_id) == agent_id,
        "current_round_tokens_estimate": int(used * 0.2),
        "total_tokens_estimate": used,
        "context_used": used,
        "context_limit": limit,
        "context_remaining": max(limit - used, 0),
        "context_usage_percent": (used / limit * 100) if limit else 0,
        "runtime_rules": build_runtime_directives(room),
    }


@app.get("/room/{room_id}/messages")
def room_messages(room_id: str):
    room = get_room_or_404(room_id)
    return {
        "room_id": room.room_id,
        "messages": [message.model_dump(mode="json") for message in room.messages],
        "shared_briefs": [brief.model_dump(mode="json") for brief in room.shared_briefs],
        "rounds": [item.model_dump(mode="json") for item in room.rounds],
    }


@app.post("/room/{room_id}/panel/preview")
def room_panel_preview(room_id: str, request: RoomPanelRequest):
    room = get_room_or_404(room_id)
    packets = preview_room_handoffs(
        room=room,
        selected_agent_ids=request.selected_agent_ids,
        blocker=request.blocker,
        need=request.need,
        constraints=request.constraints,
    )
    room_store.save(room)
    return {
        "room_id": room.room_id,
        "handoff_packets": [packet.model_dump(mode="json") for packet in packets],
        "token_usage": build_token_usage([packet.model_dump(mode="json") for packet in packets]).model_dump(),
    }


@app.post("/room/{room_id}/panel/start")
def room_panel_start(room_id: str, request: RoomPanelRequest):
    room = get_room_or_404(room_id)
    round_record = run_round(
        room=room,
        mode="panel",
        participant_agent_ids=request.selected_agent_ids,
        current_goal=request.need or room.title,
        constraints=request.constraints,
    )
    create_system_message(
        room,
        f"Panel Round {round_record.round_number} completed. Waiting for user decision.",
        metadata={"round_id": round_record.round_id, "status": round_record.status.value},
    )
    room_store.save(room)
    return build_room_envelope(
        room,
        latest_messages=room.messages[-1:],
        shared_brief=round_record.shared_brief,
        latest_round=round_record,
    )


@app.post("/room/{room_id}/panel/round/start")
def room_panel_round_start(room_id: str, request: PanelRoundStartRequest):
    room = get_room_or_404(room_id)
    round_record = run_round(
        room=room,
        mode="panel",
        participant_agent_ids=request.participant_agent_ids,
        current_goal=request.current_goal,
        constraints=request.constraints,
    )
    create_system_message(
        room,
        f"Panel Round {round_record.round_number} done; waiting for user.",
        metadata={"round_id": round_record.round_id, "status": round_record.status.value},
    )
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:], shared_brief=round_record.shared_brief, latest_round=round_record)


@app.post("/room/{room_id}/panel/round/feedback")
def room_panel_round_feedback(room_id: str, request: PanelRoundFeedbackRequest):
    room = get_room_or_404(room_id)
    coordinator = next(
        (member for member in room.members if member.status.value == "active" and (member.position_id or "") == "coordinator"),
        next(member for member in room.members if member.agent_id == room.host_agent_id),
    )
    room.pending_user_feedback = request.content
    system_message = create_system_message(
        room,
        f"User feedback received by coordinator {coordinator.display_name or coordinator.name}.",
        metadata={
            "feedback": request.content,
            "received_by": coordinator.agent_id,
        },
    )
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/room/{room_id}/panel/round/continue")
def room_panel_round_continue(room_id: str, request: PanelRoundContinueRequest):
    room = get_room_or_404(room_id)
    round_record = run_round(
        room=room,
        mode="panel",
        participant_agent_ids=request.participant_agent_ids,
        current_goal=request.current_goal,
        constraints=request.constraints,
    )
    create_system_message(
        room,
        f"Panel Round {round_record.round_number} completed. Waiting for user decision.",
        metadata={"round_id": round_record.round_id, "status": round_record.status.value},
    )
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:], shared_brief=round_record.shared_brief, latest_round=round_record)


@app.post("/room/{room_id}/panel/round/finalize")
def room_panel_round_finalize(room_id: str):
    room = get_room_or_404(room_id)
    if not room.final_plan:
        build_room_final_plan(room)
    message = create_system_message(room, "Coordinator finalized panel discussion.", metadata={"final_plan": room.final_plan})
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/room/{room_id}/debate/start")
def room_debate_start(room_id: str, request: RoomDebateRequest):
    room = get_room_or_404(room_id)
    room.max_rounds = request.max_rounds
    room.token_budget = request.token_budget
    room.cost_budget = request.cost_budget
    room.consensus_threshold = request.consensus_threshold
    round_record = run_round(
        room=room,
        mode="debate",
        participant_agent_ids=request.selected_agent_ids,
        current_goal=room.title,
        constraints=[],
    )
    stop, reason = evaluate_debate_stop(room, round_record)
    room.stop_reason = reason if stop else None
    create_system_message(room, f"Debate Round {round_record.round_number} done. {reason}")
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:], shared_brief=round_record.shared_brief, latest_round=round_record)


@app.post("/room/{room_id}/debate/continue")
def room_debate_continue(room_id: str, request: RoomDebateContinueRequest):
    room = get_room_or_404(room_id)
    if request.manual_stop:
        room.stop_reason = "Stopped by user."
        build_room_final_plan(room)
        room_store.save(room)
        return build_room_envelope(room, latest_messages=room.messages[-1:], latest_round=room.rounds[-1] if room.rounds else None)

    selected_agent_ids = [
        member.agent_id
        for member in room.members
        if member.status.value == "active" and member.agent_id != room.host_agent_id
    ]
    round_record = run_round(
        room=room,
        mode="debate",
        participant_agent_ids=selected_agent_ids,
        current_goal=room.title,
        constraints=[],
    )
    stop, reason = evaluate_debate_stop(room, round_record)
    room.stop_reason = reason if stop else None
    create_system_message(room, f"Debate Round {round_record.round_number} done. {reason}")
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:], shared_brief=round_record.shared_brief, latest_round=round_record)


@app.post("/room/{room_id}/debate/round/start")
def room_debate_round_start(room_id: str, request: DebateRoundStartRequest):
    room = get_room_or_404(room_id)
    room.max_rounds = request.max_rounds
    room.token_budget = request.token_budget
    room.cost_budget = request.cost_budget
    room.consensus_threshold = request.consensus_threshold
    round_record = run_round(
        room=room,
        mode="debate",
        participant_agent_ids=request.participant_agent_ids,
        current_goal=request.current_goal,
        constraints=request.constraints,
    )
    stop, reason = evaluate_debate_stop(room, round_record)
    room.stop_reason = reason if stop else None
    create_system_message(room, f"Debate round {round_record.round_number}: {reason}")
    room_store.save(room)
    return build_room_envelope(room, latest_messages=room.messages[-1:], shared_brief=round_record.shared_brief, latest_round=round_record)


@app.post("/room/{room_id}/debate/round/continue")
def room_debate_round_continue(room_id: str, request: DebateRoundContinueRequest):
    room = get_room_or_404(room_id)
    if request.manual_stop:
        room.stop_reason = "Stopped by user."
        build_room_final_plan(room)
        room_store.save(room)
        return build_room_envelope(room, latest_messages=room.messages[-1:], latest_round=room.rounds[-1] if room.rounds else None)

    stop = False
    reason = "Continue debate."
    latest_round = None
    for _ in range(max(request.max_auto_rounds, 1)):
        participant_ids = [
            member.agent_id
            for member in room.members
            if member.status.value == "active" and member.agent_id != room.host_agent_id
        ]
        latest_round = run_round(
            room=room,
            mode="debate",
            participant_agent_ids=participant_ids,
            current_goal=room.title,
            constraints=[],
        )
        stop, reason = evaluate_debate_stop(room, latest_round)
        if stop:
            break
    room.stop_reason = reason if stop else None
    create_system_message(room, f"Debate continue result: {reason}")
    room_store.save(room)
    return build_room_envelope(
        room,
        latest_messages=room.messages[-1:],
        shared_brief=latest_round.shared_brief if latest_round else None,
        latest_round=latest_round,
    )


@app.post("/room/{room_id}/debate/round/stop")
def room_debate_round_stop(room_id: str):
    room = get_room_or_404(room_id)
    room.stop_reason = "Stopped by user."
    build_room_final_plan(room)
    message = create_system_message(room, "Debate manually stopped.")
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/room/{room_id}/debate/round/finalize")
def room_debate_round_finalize(room_id: str):
    room = get_room_or_404(room_id)
    if not room.final_plan:
        build_room_final_plan(room)
    message = create_system_message(room, "Coordinator finalized debate output.", metadata={"final_plan": room.final_plan})
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/room/{room_id}/finalize")
def room_finalize(room_id: str):
    room = get_room_or_404(room_id)
    if not room.final_plan:
        build_room_final_plan(room)
    system_message = create_system_message(room, "Host finalized the current plan.", metadata={"final_plan": room.final_plan})
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[system_message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/chat/private/{agent_id}")
def private_chat(agent_id: str, request: PrivateChatRequest):
    room = get_room_or_404(request.room_id)
    try:
        set_active_agent(room, agent_id)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    user_message, agent_message, _ = post_user_message(room, request.content)
    room_store.save(room)
    return {
        "room_id": room.room_id,
        "private_agent_id": agent_id,
        "messages": [user_message.model_dump(mode="json"), agent_message.model_dump(mode="json")],
        "note": "Private chat only called the selected agent.",
    }


@app.post("/chat/private/{agent_id}/sync-to-room")
def private_sync_to_room(agent_id: str, request: PrivateSyncRequest):
    room = get_room_or_404(request.room_id)
    coordinator = next(
        (member for member in room.members if member.status.value == "active" and (member.position_id or "") == "coordinator"),
        next(member for member in room.members if member.agent_id == room.host_agent_id),
    )
    room.pending_user_feedback = f"[PrivateSync from {agent_id}] {request.summary}"
    message = create_system_message(
        room,
        f"Private chat summary from {agent_id} forwarded to coordinator {coordinator.display_name or coordinator.name}.",
        metadata={"private_sync": request.summary, "received_by": coordinator.agent_id},
    )
    room_store.save(room)
    return build_room_envelope(room, latest_messages=[message], latest_round=room.rounds[-1] if room.rounds else None)


@app.post("/executor/export/codex")
def export_codex(request: ExecutorExportRequest):
    room = get_room_or_404(request.room_id)
    package = _build_execution_package(room, request, executor_type="codex")
    exporter = CodexExporter()
    package = exporter.export(package)
    history_store.save_room(room, execution_log_summary="Exported Codex execution package.")
    return {
        "executor_type": "codex",
        "generated_prompt": package.generated_prompt,
        "copy_ready": True,
        "execution_package": package.model_dump(mode="json"),
    }


@app.post("/executor/export/claude-code")
def export_claude_code(request: ExecutorExportRequest):
    room = get_room_or_404(request.room_id)
    package = _build_execution_package(room, request, executor_type="claude_code")
    exporter = ClaudeCodeExporter()
    package = exporter.export(package)
    history_store.save_room(room, execution_log_summary="Exported Claude Code execution package.")
    return {
        "executor_type": "claude_code",
        "generated_prompt": package.generated_prompt,
        "copy_ready": True,
        "execution_package": package.model_dump(mode="json"),
    }


@app.post("/api/debate")
def api_debate(payload: dict):
    """Adapter: frontend debate request → council_service opinions → ChatMessage format.

    Ministers are built directly from the frontend roster so that user selections,
    custom members, and per-member skills are all honored verbatim (no fragile id mapping).
    """
    import uuid
    from backend.core.council_models import Minister

    mode = payload.get("mode", "modern")
    query = str(payload.get("query") or "").strip()
    selected_members = payload.get("selectedMembers", []) or []
    api_configs = payload.get("apiConfigs", []) or []
    project_brief = payload.get("projectBrief", "")
    project_handoff = payload.get("projectHandoff", "")
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    if (
        not isinstance(selected_members, list)
        or not selected_members
        or not all(isinstance(item, dict) for item in selected_members)
    ):
        raise HTTPException(status_code=400, detail="at least one selected member is required")
    if not isinstance(api_configs, list) or not all(isinstance(item, dict) for item in api_configs):
        raise HTTPException(status_code=400, detail="apiConfigs must be a list")

    # Wire each frontend apiConfig (provider endpoint/model/key) into the matching
    # backend default profile + runtime credential, so members reach real models
    # using the keys the user typed in Settings — no env vars required.
    provider_to_profile = {
        "openai": "openai_default_profile",
        "claude": "claude_default_profile",
        "anthropic": "claude_default_profile",
        "deepseek": "deepseek_default_profile",
        "gemini": "gemini_default_profile",
        "qwen": "qwen_default_profile",
        "openrouter": "openrouter_default_profile",
        "newapi": "newapi_default_profile",
        "ccswitch": "ccswitch_default_profile",
    }
    configured_profiles: set[str] = set()
    for cfg in api_configs:
        cfg_id = str(cfg.get("id", "")).lower()
        profile_id = provider_to_profile.get(cfg_id)
        if not profile_id:
            continue
        endpoint = str(cfg.get("endpoint") or "").strip().rstrip("/")
        model = str(cfg.get("model") or "").strip()
        api_key = str(cfg.get("apiKey") or "").strip()
        patch_kwargs: dict = {}
        if endpoint:
            patch_kwargs["base_url"] = endpoint
        if model:
            patch_kwargs["default_model"] = model
            patch_kwargs["models"] = [model]
        try:
            profile = provider_profile_store.get(profile_id)
            if patch_kwargs:
                profile = provider_profile_store.patch(profile_id, ProviderProfilePatchRequest(**patch_kwargs))
            if api_key:
                credential_store.set_runtime_key(profile.credential_id, api_key, profile.auth_env_name or None)
                configured_profiles.add(profile_id)
            elif cfg_id == "ccswitch":
                configured_profiles.add(profile_id)
            elif credential_store.get(profile.credential_id).key_available:
                configured_profiles.add(profile_id)
        except (KeyError, ValueError):
            continue

    # Build a conversation from members, run council, convert to messages
    conv_id = f"_debate_{uuid.uuid4().hex[:8]}"
    content = query
    if project_brief:
        content = f"【项目背景】\n{project_brief}\n\n{project_handoff}\n\n【议题】\n{query}"

    def _build_system_prompt(member: dict) -> str:
        name = str(member.get("name") or member.get("nickname") or "成员")
        skill_prompt = str(member.get("skillPrompt") or "").strip()
        is_chief = member.get("role") == "pm"
        lines = [f"你是「{name}」，多 AI 协作讨论中的一位成员。"]
        if is_chief:
            lines.append("你是召集人，负责统筹议题、协调其他成员、并形成最终可执行结论。")
        if skill_prompt:
            lines.append(skill_prompt)
        else:
            lines.append("请基于自身职责给出专业意见。")
        lines.append("请用简明、专业的现代中文作答，内容要具体、务实、可执行，不要空话套话。")
        lines.append("只代表你自己发言，针对当前议题给出意见。")
        return "\n".join(lines)



    # Build ministers directly from the frontend roster.
    ministers: list[Minister] = []
    real_by_id: dict[str, bool] = {}
    member_by_id: dict[str, dict] = {}
    for idx, m in enumerate(selected_members):
        mid = str(m.get("id") or f"member_{idx}")
        member_by_id[mid] = m
        name = str(m.get("name") or m.get("nickname") or "成员")
        provider_id = str(m.get("providerId") or "").lower()
        api_profile_id = str(m.get("apiProfileId") or "")

        # Resolve which backend profile this member should use:
        # explicit apiProfileId wins; otherwise map by providerId if that provider is configured.
        if not api_profile_id and provider_id in provider_to_profile:
            mapped_profile = provider_to_profile[provider_id]
            if mapped_profile in configured_profiles:
                api_profile_id = mapped_profile

        provider_name = "mock"
        model_name = ""
        is_real = False
        if api_profile_id.startswith("webai:"):
            provider_name = "webai"
            model_name = api_profile_id.split(":", 1)[1]
            is_real = True
        elif api_profile_id and api_profile_id != "mock_default_profile":
            # Resolve provider_name from the actual profile so we call the real API
            try:
                prof = provider_profile_store.get(api_profile_id)
                provider_name = prof.provider
                model_name = model_name or prof.default_model
                is_real = True
            except KeyError:
                api_profile_id = "mock_default_profile"
        real_by_id[mid] = is_real
        ministers.append(
            Minister(
                id=mid,
                title=name,
                displayName=name,
                office=str(m.get("ministry") or "none"),
                duty=str(m.get("badge") or ""),
                capabilityTags=[],
                provider=provider_name,
                model=model_name,
                apiProfileId=api_profile_id or "mock_default_profile",
                systemPrompt=_build_system_prompt(m),
                enabled=True,
                isChief=(m.get("role") == "pm"),
                order=idx,
            )
        )

    ministers = ministers[:6]
    # Guarantee exactly one chief after applying the participant cap.
    chief_index = next((idx for idx, item in enumerate(ministers) if item.isChief), 0)
    for idx, item in enumerate(ministers):
        item.isChief = idx == chief_index

    try:
        def resolver(minister):
            return _provider_for_profile_id(getattr(minister, "apiProfileId", ""))

        result = council_service.submit_memorial(
            {"conversationId": conv_id, "content": content, "discussionMode": mode},
            provider=provider_registry.get("mock"),
            provider_resolver=resolver,
            explicit_ministers=ministers,
        )
        opinions = result.get("opinions", [])

        any_demo = False
        messages = []
        for op in opinions:
            mid = op.get("ministerId", "")
            member = member_by_id.get(mid, {})
            sender_name = str(member.get("name") or member.get("nickname") or "阁臣")
            op_content = op.get("content", "")
            if not real_by_id.get(mid, False):
                any_demo = True
                op_content = f"（演示数据 · 该成员未接入真实模型）\n{op_content}"
            messages.append({
                "id": f"msg_{uuid.uuid4().hex[:8]}",
                "ministerId": mid,
                "sender": sender_name,
                "content": op_content,
                "isUser": False,
                "roleLabel": str(member.get("badge") or "内阁"),
                "status": op.get("status", "done"),
            })

        return {"messages": messages, "demoMode": any_demo}
    except Exception as exc:  # noqa: BLE001
        # Surface the real error instead of faking a council reply.
        raise HTTPException(status_code=500, detail=f"debate_failed: {exc}") from exc



@app.post("/api/finalize")
def api_finalize(payload: dict):
    """Synthesize 3 candidate plans from the discussion transcript.

    Uses the召集人/first configured real provider when available; otherwise returns
    neutral demo placeholders clearly marked as such (no fake hardcoded content).
    """
    context_title = str(payload.get("contextTitle") or "讨论")
    messages = payload.get("messages", []) or []
    api_configs = payload.get("apiConfigs", []) or []

    transcript = "\n".join(
        f"{m.get('sender', '成员')}: {m.get('content', '')}"
        for m in messages
        if not m.get("isUser") and m.get("content")
    )[:6000]

    provider_to_profile = {
        "openai": "openai_default_profile", "claude": "claude_default_profile",
        "anthropic": "claude_default_profile", "deepseek": "deepseek_default_profile",
        "gemini": "gemini_default_profile", "qwen": "qwen_default_profile",
        "openrouter": "openrouter_default_profile", "newapi": "newapi_default_profile",
        "ccswitch": "ccswitch_default_profile",
    }
    # Find first configured provider with a usable key.
    chosen_profile_id = ""
    for cfg in api_configs:
        cfg_id = str(cfg.get("id", "")).lower()
        pid = provider_to_profile.get(cfg_id)
        if not pid:
            continue
        try:
            prof = provider_profile_store.get(pid)
            if cfg_id == "ccswitch" or str(cfg.get("apiKey") or "").strip() or credential_store.get(prof.credential_id).key_available:
                chosen_profile_id = pid
                break
        except KeyError:
            continue

    if chosen_profile_id and transcript:
        try:
            from backend.core.council_models import Minister
            agent = _provider_for_profile_id(chosen_profile_id)
            synth = Minister(
                id="synthesizer", title="方案综合", displayName="方案综合",
                office="none", duty="", capabilityTags=[],
                apiProfileId=chosen_profile_id,
                systemPrompt=(
                    "你是讨论方案综合器。基于讨论记录，提炼 3 个互不相同、可执行的候选方案。"
                    "严格输出 JSON 数组，每项含 id(alpha/beta/gamma)、title、badge、description、icon。"
                    "icon 从 psychology/policy/public 中选。用简明现代中文。只输出 JSON。"
                ),
            )
            if hasattr(agent, "_resolve_config"):
                cfg = agent._resolve_config(synth)
                raw = agent._request(
                    messages=[
                        {"role": "system", "content": synth.systemPrompt},
                        {"role": "user", "content": f"议题：{context_title}\n讨论记录：\n{transcript}\n请输出 3 个候选方案的 JSON 数组。"},
                    ],
                    config=cfg, max_tokens=900,
                )
                import json as _json, re as _re
                match = _re.search(r"\[.*\]", raw, _re.DOTALL)
                if match:
                    plans = _json.loads(match.group(0))
                    if isinstance(plans, list) and plans:
                        return {"plans": plans[:3]}
        except Exception:  # noqa: BLE001
            pass  # fall through to placeholders

    # No real provider configured (or synthesis failed): neutral, clearly-marked placeholders.
    note = "（演示占位 · 接入模型后将基于真实讨论生成）"
    return {
        "plans": [
            {"id": "alpha", "title": "稳健折中方案", "badge": "折中",
             "description": f"{note} 综合各方意见，优先低风险、可快速落地的步骤，分阶段推进。", "icon": "psychology"},
            {"id": "beta", "title": "重点突破方案", "badge": "激进",
             "description": f"{note} 集中资源解决核心矛盾，先攻最关键环节，接受更高风险换取速度。", "icon": "policy"},
            {"id": "gamma", "title": "开放协作方案", "badge": "开放",
             "description": f"{note} 引入外部资源与协作，以更长周期换取更可持续的结果。", "icon": "public"},
        ],
        "demoMode": True,
    }


@app.post("/executor/export/generic")
def export_generic(request: ExecutorExportRequest):
    room = get_room_or_404(request.room_id)
    package = _build_execution_package(room, request, executor_type="generic")
    exporter = GenericExporter()
    package = exporter.export(package)
    history_store.save_room(room, execution_log_summary="Exported generic execution package.")
    return {
        "executor_type": "generic",
        "generated_prompt": package.generated_prompt,
        "copy_ready": True,
        "execution_package": package.model_dump(mode="json"),
    }


@app.post("/executor/check/codex")
def executor_check_codex():
    result = check_executor("codex", help_args=["exec", "--help"])
    return {
        "executor_type": "codex",
        "available": result.get("installed", False),
        **result,
    }


@app.post("/executor/check/claude-code")
def executor_check_claude():
    result = check_executor("claude", help_args=["--help"])
    help_text = (result.get("help_excerpt") or "").lower()
    result["supports_prompt_flag"] = ("-p" in help_text) or ("--print" in help_text)
    return {
        "executor_type": "claude_code",
        "available": result.get("installed", False),
        **result,
    }


@app.post("/executor/run/confirm")
def executor_run_confirm(request: ExecutorRunRequest):
    if request.executor_type not in {"codex", "claude_code"}:
        raise HTTPException(status_code=400, detail="executor_type must be codex or claude_code.")
    room = room_store.find_by_project_path(request.project_path)
    if room is None:
        raise HTTPException(status_code=400, detail="project_path must be attached to a room before execution.")
    return build_confirmation_token(request.executor_type, request.project_path)


@app.post("/executor/run/codex")
def executor_run_codex(request: ExecutorRunRequest):
    room = room_store.find_by_project_path(request.project_path)
    if room is None:
        raise HTTPException(status_code=400, detail="project_path must be attached to a room before execution.")
    if request.executor_type != "codex":
        raise HTTPException(status_code=400, detail="executor_type must be codex for this endpoint.")
    result = run_executor(request, room_project_path=room.attached_project_path or "")
    history_store.save_room(
        room,
        execution_log_summary=f"Codex run dry_run={request.dry_run} exit={result.exit_code} error={result.error or ''}",
    )
    return result.model_dump(mode="json")


@app.post("/executor/run/claude-code")
def executor_run_claude(request: ExecutorRunRequest):
    room = room_store.find_by_project_path(request.project_path)
    if room is None:
        raise HTTPException(status_code=400, detail="project_path must be attached to a room before execution.")
    if request.executor_type != "claude_code":
        raise HTTPException(status_code=400, detail="executor_type must be claude_code for this endpoint.")
    result = run_executor(request, room_project_path=room.attached_project_path or "")
    history_store.save_room(
        room,
        execution_log_summary=f"Claude run dry_run={request.dry_run} exit={result.exit_code} error={result.error or ''}",
    )
    return result.model_dump(mode="json")


@app.get("/executor/runs")
def executor_runs_list():
    return {"runs": run_store.list_runs()}


@app.get("/executor/runs/{run_id}")
def executor_runs_get(run_id: str):
    run = run_store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Unknown run_id: {run_id}")
    return run


@app.get("/context/{room_id}/usage")
def context_usage(room_id: str) -> ContextUsageResponse:
    room = get_room_or_404(room_id)
    usage = context_manager.refresh_room(room)
    room_store.save(room)
    return usage


@app.post("/context/{room_id}/compact")
def context_compact_room(room_id: str):
    room = get_room_or_404(room_id)
    usage = context_manager.compact_room_context(room)
    room_store.save(room)
    compacted = [
        {
            "agent_id": item.agent_id,
            "display_name": item.display_name,
            "summary": item.compacted_summary,
        }
        for item in usage.agents
    ]
    return CompactResponse(room_id=room.room_id, compacted_agents=compacted)


@app.post("/context/{room_id}/compact/{agent_id}")
def context_compact_agent(room_id: str, agent_id: str):
    room = get_room_or_404(room_id)
    summary = context_manager.compact_agent_context(room, agent_id)
    usage = context_manager.refresh_room(room)
    room_store.save(room)
    return {
        "room_id": room.room_id,
        "agent_id": agent_id,
        "summary": summary,
        "usage": usage.model_dump(mode="json"),
    }


# Legacy /chat endpoints retained for compatibility.
@app.post("/chat/solo")
def chat_solo(request: SoloRequest):
    session = session_store.create(
        mode=Mode.SOLO,
        user_goal=request.prompt,
        agents=[request.agent],
        max_rounds=1,
        budget_tokens=settings.default_budget_tokens,
    )
    response = run_primary_panel_turn(session, request.agent)
    response.state = MessageState.RESOLVED
    session.final_answer = response.claim
    session.status = "completed"
    session_store.save(session)
    return SessionEnvelope(
        session=session,
        latest_responses=[response],
        token_usage=build_token_usage({"session": session.model_dump(), "response": response.model_dump()}),
    )


@app.post("/chat/panel/start")
def panel_start(request: PanelStartRequest):
    session = session_store.create(
        mode=Mode.PANEL,
        user_goal=request.prompt,
        agents=[request.primary_agent, *request.support_agents],
        max_rounds=1,
        budget_tokens=settings.default_budget_tokens,
    )
    response = run_primary_panel_turn(session, request.primary_agent)
    session_store.save(session)
    return SessionEnvelope(
        session=session,
        latest_responses=[response],
        token_usage=build_token_usage({"session": session.model_dump(), "response": response.model_dump()}),
    )


@app.post("/chat/panel/handoff")
def panel_handoff(request: PanelHandoffRequest):
    try:
        session = session_store.get(request.session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    support_agents = session.agents[1:]
    responses, handoff_packet, shared_brief = run_panel_handoff(
        session=session,
        support_agents=support_agents,
        blocker=request.blocker,
        need=request.need,
        constraints=request.constraints,
    )
    session_store.save(session)
    return SessionEnvelope(
        session=session,
        latest_responses=responses,
        shared_brief=shared_brief,
        token_usage=build_token_usage(
            {
                "handoff_packet": handoff_packet.model_dump(),
                "shared_brief": shared_brief.model_dump(),
                "responses": [response.model_dump() for response in responses],
            }
        ),
    )


@app.post("/chat/debate/start")
def debate_start(request: DebateStartRequest):
    session = session_store.create(
        mode=Mode.DEBATE,
        user_goal=request.prompt,
        agents=request.agents,
        max_rounds=request.max_rounds,
        budget_tokens=request.budget_tokens,
    )
    responses, shared_brief = run_debate_round(session, use_shared_brief=False)
    stop, reason = evaluate_stop_condition(session, responses)
    if stop:
        build_final_answer(session)
    session.messages.append({"type": "system", "content": reason})
    session_store.save(session)
    return SessionEnvelope(
        session=session,
        latest_responses=responses,
        shared_brief=shared_brief,
        token_usage=build_token_usage(
            {"shared_brief": shared_brief.model_dump(), "responses": [item.model_dump() for item in responses]}
        ),
    )


@app.post("/chat/debate/continue")
def debate_continue(request: DebateContinueRequest):
    try:
        session = session_store.get(request.session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if session.status == "completed":
        return SessionEnvelope(
            session=session,
            latest_responses=[],
            shared_brief=session.shared_briefs[-1] if session.shared_briefs else None,
            token_usage=build_token_usage(session.model_dump()),
        )
    responses, shared_brief = run_debate_round(session, use_shared_brief=True)
    stop, reason = evaluate_stop_condition(session, responses)
    if stop:
        build_final_answer(session)
    session.messages.append({"type": "system", "content": reason})
    session_store.save(session)
    return SessionEnvelope(
        session=session,
        latest_responses=responses,
        shared_brief=shared_brief,
        token_usage=build_token_usage(
            {"shared_brief": shared_brief.model_dump(), "responses": [item.model_dump() for item in responses]}
        ),
    )


@app.post("/chat/finalize")
def finalize(request: FinalizeRequest):
    try:
        session = session_store.get(request.session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not session.final_answer:
        session.final_answer = build_final_answer(session)
        for brief in session.shared_briefs:
            for item in brief.each_agent_position:
                item.state = MessageState.RESOLVED
    session_store.save(session)
    return {
        "session_id": session.session_id,
        "final_answer": session.final_answer,
        "shared_briefs": [brief.model_dump() for brief in session.shared_briefs],
        "token_usage": build_token_usage(session.model_dump()).model_dump(),
    }


@app.post("/api/council/submit")
def council_submit(payload: dict):
    import inspect

    explicit_provider = str(payload.get("provider") or "").lower()
    default_profile_by_provider = {
        "openai": "openai_default_profile",
        "deepseek": "deepseek_default_profile",
        "anthropic": "claude_default_profile",
        "claude": "claude_default_profile",
        "gemini": "gemini_default_profile",
        "openrouter": "openrouter_default_profile",
        "newapi": "newapi_default_profile",
        "qwen": "qwen_default_profile",
    }

    def provider_for_profile(profile_id: str):
        return _provider_for_profile_id(profile_id)

    def assert_council_provider(provider_name: str, provider):
        sig = inspect.signature(provider.generate_opinion)
        params = list(sig.parameters.keys())
        if "payload" in params and "minister" not in params:
            raise HTTPException(
                status_code=400,
                detail=f"Provider {provider_name} does not implement the council interface.",
            )

    if explicit_provider:
        if explicit_provider in default_profile_by_provider and not payload.get("profileId"):
            payload = {**payload, "profileId": default_profile_by_provider[explicit_provider]}
        provider = provider_registry.get(explicit_provider)
        assert_council_provider(explicit_provider, provider)
        return council_service.submit_memorial(payload, provider=provider)

    if payload.get("profileId"):
        provider = provider_for_profile(str(payload["profileId"]))
        assert_council_provider(str(payload["profileId"]), provider)
        return council_service.submit_memorial(payload, provider=provider)

    def resolver(minister):
        provider = provider_for_profile(getattr(minister, "apiProfileId", ""))
        assert_council_provider(getattr(minister, "apiProfileId", "mock"), provider)
        return provider

    return council_service.submit_memorial(payload, provider=provider_registry.get("mock"), provider_resolver=resolver)


@app.get("/health")
def health():
    credential_store.reload()
    return {
        "status": "ok",
        "app": settings.app_name,
        "frontend": {
            "built": REACT_FRONTEND_DIST.exists(),
            "dist": str(REACT_FRONTEND_DIST),
        },
        "providers": {
            "profiles": len(provider_profile_store.list()),
            "credentials": [
                {
                    "credential_id": item.credential_id,
                    "provider": item.provider,
                    "key_available": item.key_available,
                    "enabled": item.enabled,
                }
                for item in credential_store.list()
            ],
        },
    }


@app.get("/api/runtime-check")
def runtime_check():
    import urllib.error
    import urllib.request

    def fetch_json(url: str) -> dict:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                raw = response.read().decode("utf-8", errors="replace")
            return {"ok": True, "data": json.loads(raw) if raw else {}}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            return {"ok": False, "error": str(exc)}

    cc_switch_base = os.getenv("CCSWITCH_BASE_URL", "http://127.0.0.1:15721").rstrip("/")
    cc_health = fetch_json(f"{cc_switch_base}/health")
    cc_status = fetch_json(f"{cc_switch_base}/status")
    status = cc_status.get("data", {}) if cc_status.get("ok") else {}
    service_ok = bool(cc_health.get("ok"))
    route_ready = bool(service_ok and status.get("current_provider_id") and not status.get("last_error"))
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "app": {"ok": True, "url": "http://127.0.0.1:8000"},
        "ccSwitch": {
            "ok": route_ready,
            "health": bool(cc_health.get("ok")),
            "serviceOk": service_ok,
            "routeReady": route_ready,
            "provider": status.get("current_provider", ""),
            "providerId": status.get("current_provider_id", ""),
            "activeTargets": status.get("active_targets", []),
            "lastError": status.get("last_error", "") or cc_health.get("error", "") or cc_status.get("error", ""),
            "url": cc_switch_base,
        },
        "backend": {"ok": True, "url": "http://127.0.0.1:8000", "error": ""},
        "features": {
            "issueReporting": {"ok": True, "storage": str(ISSUE_REPORT_DIR)},
            "imageGeneration": {"ok": True, "endpoint": "/api/images/generate"},
        },
    }


@app.get("/api/ccswitch/providers")
def list_ccswitch_providers():
    providers = sync_ccswitch_providers()
    return {
        "ok": True,
        "providers": providers,
        "count": len(providers),
    }


@app.post("/api/ccswitch/providers/{profile_id}/test")
def test_saved_ccswitch_provider(profile_id: str):
    try:
        return test_ccswitch_provider(profile_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/issues")
def create_issue_report(payload: dict):
    title = str(payload.get("title", "")).strip() or "未命名问题"
    category = str(payload.get("category", "")).strip() or "功能异常"
    report_text = str(payload.get("reportText", "")).strip()
    recipient = os.getenv("FEEDBACK_EMAIL", "").strip() or str(payload.get("recipient", "")).strip()
    if not report_text:
        raise HTTPException(status_code=400, detail="reportText is required")

    report_id = f"issue_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:8]}"
    record = {
        "id": report_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "title": title,
        "category": category,
        "recipient": recipient,
        "reportText": report_text,
        "diagnosis": payload.get("diagnosis"),
    }
    ISSUE_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = ISSUE_REPORT_DIR / f"{report_id}.json"
    report_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")

    email_sent = False
    email_error = ""
    smtp_host = os.getenv("FEEDBACK_SMTP_HOST", "").strip()
    if smtp_host and recipient:
        try:
            smtp_port = int(os.getenv("FEEDBACK_SMTP_PORT", "587"))
            smtp_user = os.getenv("FEEDBACK_SMTP_USER", "").strip()
            smtp_password = os.getenv("FEEDBACK_SMTP_PASSWORD", "")
            sender = os.getenv("FEEDBACK_SMTP_FROM", "").strip() or smtp_user
            if not sender:
                raise ValueError("FEEDBACK_SMTP_FROM or FEEDBACK_SMTP_USER is required")
            message = EmailMessage()
            message["Subject"] = f"[内阁反馈][{category}] {title}"
            message["From"] = sender
            message["To"] = recipient
            message.set_content(report_text)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
                if os.getenv("FEEDBACK_SMTP_TLS", "true").lower() not in {"0", "false", "no"}:
                    smtp.starttls()
                if smtp_user:
                    smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
            email_sent = True
        except Exception as exc:  # noqa: BLE001
            email_error = str(exc)

    return {
        "ok": True,
        "reportId": report_id,
        "saved": True,
        "path": str(report_path),
        "emailSent": email_sent,
        "emailError": email_error,
        "emailConfigured": bool(smtp_host),
    }


@app.post("/api/images/generate")
def generate_image(payload: dict):
    prompt = str(payload.get("prompt", "")).strip()
    endpoint = str(payload.get("endpoint", "")).strip().rstrip("/")
    api_key = str(payload.get("apiKey", "")).strip()
    model = str(payload.get("model", "")).strip() or "gpt-image-1"
    size = str(payload.get("size", "")).strip() or "1024x1024"
    quality = str(payload.get("quality", "")).strip() or "standard"
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    if not endpoint:
        raise HTTPException(status_code=400, detail="image provider endpoint is required")

    image_url = endpoint if endpoint.endswith("/images/generations") else f"{endpoint}/images/generations"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    body = {"model": model, "prompt": prompt, "size": size, "quality": quality, "n": 1}
    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(image_url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:1000]
        raise HTTPException(status_code=502, detail=f"Image provider returned HTTP {exc.response.status_code}: {detail}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Image provider request failed: {exc}") from exc

    items = data.get("data") if isinstance(data, dict) else None
    item = items[0] if isinstance(items, list) and items else {}
    result_url = item.get("url") if isinstance(item, dict) else None
    b64_json = item.get("b64_json") if isinstance(item, dict) else None
    if b64_json:
        result_url = f"data:image/png;base64,{b64_json}"
    if not result_url:
        raise HTTPException(status_code=502, detail="Image provider returned no image URL or base64 data")
    return {
        "ok": True,
        "imageUrl": result_url,
        "revisedPrompt": item.get("revised_prompt", "") if isinstance(item, dict) else "",
        "providerEndpoint": image_url,
        "model": model,
        "size": size,
    }


@app.post("/api/ccswitch/test")
def test_ccswitch_route(payload: dict | None = None):
    payload = payload or {}
    base_url = str(payload.get("endpoint", "")).strip().rstrip("/") or os.getenv(
        "CCSWITCH_BASE_URL", "http://127.0.0.1:15721"
    ).rstrip("/")
    api_base_url = base_url if base_url.endswith("/v1") else f"{base_url}/v1"
    responses_url = f"{api_base_url}/responses"
    messages_url = f"{api_base_url}/messages"
    requested_model = str(payload.get("model", "")).strip()
    response_models = list(dict.fromkeys(filter(None, [requested_model, "gpt-5.5", "gpt-5", "gpt-4o"])))
    message_models = list(dict.fromkeys(filter(None, [requested_model, "claude-sonnet-4-20250514", "claude-opus-4-7"])))
    api_key = str(payload.get("apiKey", "")).strip() or "cc-switch-local-routing"
    last_error = ""
    last_status_code = 0
    response_attempt = (
            "openai_responses",
            responses_url,
            response_models,
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "codex-cli"},
            lambda model: {
                "model": model,
                "input": [{"role": "user", "content": [{"type": "input_text", "text": "Reply only: OK"}]}],
                "max_output_tokens": 8,
            },
        )
    message_attempt = (
        "anthropic_messages",
        messages_url,
        message_models,
        {
            "Authorization": f"Bearer {api_key}",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Reply only: OK"}],
            "max_tokens": 8,
        },
    )
    attempts = [message_attempt, response_attempt] if not requested_model or requested_model.lower().startswith("claude") else [response_attempt, message_attempt]
    try:
        with httpx.Client(timeout=25) as client:
            for route_type, url, models, headers, make_body in attempts:
                for model in models:
                    response = client.post(url, headers=headers, json=make_body(model))
                    last_status_code = response.status_code
                    if response.is_success:
                        working_model = model
                        provider_profile_store.patch(
                            "ccswitch_default_profile",
                            ProviderProfilePatchRequest(base_url=api_base_url, default_model=working_model, models=[working_model]),
                        )
                        return {
                            "ok": True,
                            "routeReady": True,
                            "routeType": route_type,
                            "statusCode": response.status_code,
                            "workingModel": working_model,
                            "message": f"CC Switch {route_type} route is callable with {working_model}.",
                            "url": url,
                        }
                    try:
                        data = response.json()
                        error = data.get("error", {}) if isinstance(data, dict) else {}
                        last_error = error.get("message") if isinstance(error, dict) else str(error)
                    except (ValueError, UnicodeError):
                        last_error = response.text
    except httpx.HTTPError as exc:
        return {"ok": False, "routeReady": False, "message": str(exc), "url": api_base_url}
    return {
        "ok": False,
        "routeReady": False,
        "statusCode": last_status_code,
        "message": last_error or "No callable CC Switch model was found.",
        "triedModels": list(dict.fromkeys(message_models + response_models)),
        "url": api_base_url,
    }


@app.post("/api/ccswitch/launch")
def launch_ccswitch():
    candidates = [
        Path(os.getenv("LOCALAPPDATA", "")) / "Programs" / "CC Switch" / "cc-switch.exe",
        Path(os.getenv("PROGRAMFILES", "")) / "CC Switch" / "cc-switch.exe",
    ]
    executable = next((path for path in candidates if path.is_file()), None)
    if executable is None:
        raise HTTPException(status_code=404, detail="CC Switch executable was not found")
    subprocess.Popen([str(executable)], cwd=str(executable.parent), creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return {"ok": True, "launched": True, "path": str(executable)}


@app.post("/api/local-agent/launch")
def launch_local_agent(payload: dict):
    """Open a locally-detected AI agent app/CLI so the user can paste the decision and submit themselves.

    Security: the executable path is taken ONLY from the allow-listed detection results
    (DETECT_TARGETS via get_local_tool). No shell, no user-supplied path or args.
    """
    from backend.core.provider_detection import get_local_tool

    # Map VerdictModal execution-agent ids to detected local tool ids.
    agent_to_tool = {
        "codex": "cli.codex",
        "claudecode": "cli.claude_code",
        "trae": "cli.trae",
        "workbuddy": "cli.workbuddy",
        "cursor": "app.cursor",
        "gemini": "cli.gemini",
    }
    agent_id = str(payload.get("agentId", "")).strip().lower()
    tool_id = agent_to_tool.get(agent_id)
    if not tool_id:
        # Not a launchable local app (e.g. localscript/browserauto/custom) — caller handles fallback.
        return {"ok": False, "launchable": False, "message": f"No launchable local app mapped for agent '{agent_id}'."}

    try:
        info = get_local_tool(tool_id)
    except KeyError:
        return {"ok": False, "launchable": False, "message": f"Unknown local tool for agent '{agent_id}'."}

    exe_path = info.get("executablePath")
    if not exe_path:
        return {
            "ok": False,
            "launchable": True,
            "installed": False,
            "message": f"{info.get('name', agent_id)} 未安装或不在 PATH 中。请先安装后再试。",
        }

    try:
        subprocess.Popen(
            [exe_path],
            cwd=str(Path(exe_path).parent),
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except OSError as exc:
        return {"ok": False, "launchable": True, "installed": True, "message": f"启动失败：{exc}"}

    return {"ok": True, "launched": True, "name": info.get("name", agent_id), "path": exe_path}


@app.post("/api/provider/test")
def test_openai_compatible_provider(payload: dict):
    endpoint = str(payload.get("endpoint", "")).strip().rstrip("/")
    api_key = str(payload.get("apiKey", "")).strip()
    model = str(payload.get("model", "")).strip()
    if not endpoint or not model:
        raise HTTPException(status_code=400, detail="endpoint and model are required")
    url = endpoint if endpoint.endswith("/chat/completions") else f"{endpoint}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(
                url,
                headers=headers,
                json={"model": model, "messages": [{"role": "user", "content": "Reply only: OK"}], "max_tokens": 8},
            )
            data = response.json()
            if not response.is_success:
                detail = data.get("error", {}).get("message") if isinstance(data, dict) else response.text
                return {"ok": False, "success": False, "statusCode": response.status_code, "error": detail or response.text, "url": url}
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "success": False, "error": str(exc), "url": url}
    return {"ok": True, "success": True, "statusCode": response.status_code, "url": url}


@app.get("/system/self-check")
def system_self_check():
    import uuid

    from backend.core.provider_detection import detect_cli_tools

    warnings: list[str] = []

    # 1. Backend
    backend_check = {"ok": True, "app": settings.app_name, "version": "0.1.0"}

    # 2. Frontend (React dist)
    react_dist_ok = REACT_FRONTEND_DIST.exists() and any(REACT_FRONTEND_DIST.iterdir())
    frontend_check = {"ok": react_dist_ok, "dist_path": str(REACT_FRONTEND_DIST)}
    if not react_dist_ok:
        warnings.append("React dist not found — run 'npm run build' in 内阁-ai-app")

    # 3. Desktop
    desktop_bat = ROOT_DIR / "启动内阁桌面版.bat"
    desktop_electron = ROOT_DIR / "desktop" / "main.cjs"
    desktop_ok = desktop_bat.exists() and desktop_electron.exists()
    desktop_check = {"ok": desktop_ok, "bat_exists": desktop_bat.exists(), "electron_main_exists": desktop_electron.exists()}
    if not desktop_bat.exists():
        warnings.append("Desktop launcher batch file missing")
    if not desktop_electron.exists():
        warnings.append("Electron main.cjs missing")

    # 4. Providers
    profiles = provider_profile_store.list()
    configured_count = 0
    profile_infos = []
    for p in profiles:
        try:
            cred = credential_store.get(p.credential_id)
            has_key = bool(cred.key_available)
            if has_key and p.provider != "mock":
                configured_count += 1
        except KeyError:
            has_key = False
        profile_infos.append({"profile_id": p.profile_id, "provider": p.provider, "enabled": p.enabled, "has_credential_configured": has_key})
    providers_check = {"ok": len(profiles) > 0, "profile_count": len(profiles), "configured_count": configured_count, "profiles": profile_infos}
    if configured_count == 0:
        warnings.append("No provider credentials configured — only mock mode available")

    # 5. Local Tools
    try:
        local_tools = detect_cli_tools()
        callable_tools = [t for t in local_tools if t.get("status") == "callable"]
        local_tools_check = {"total": len(local_tools), "callable": len(callable_tools), "ok": True}
    except Exception as exc:
        local_tools_check = {"ok": False, "error": str(exc)}
        warnings.append(f"Local tools detection failed: {exc}")

    # 6. File Reader
    try:
        from backend.core.project_reader import is_path_allowed, is_supported_file
        file_reader_check = {"ok": True, "module": "project_reader"}
    except ImportError as exc:
        file_reader_check = {"ok": False, "error": str(exc)}
        warnings.append("File reader module unavailable")

    # 7. Mock council
    try:
        mock_result = council_service.submit_memorial({
            "conversationId": f"_self_check_{uuid.uuid4().hex}",
            "content": "自检测试",
            "discussionMode": "council",
        })
        mock_council_check = {"ok": True, "opinion_count": len(mock_result.get("opinions", []))}
    except Exception as exc:
        mock_council_check = {"ok": False, "error": str(exc)}
        warnings.append(f"Mock council failed: {exc}")

    # 8. API Debate
    try:
        debate_result = api_debate({
            "mode": "cabinet",
            "query": "self check debate smoke",
            "selectedMembers": [
                {
                    "id": "model-chatgpt",
                    "name": "ChatGPT",
                    "apiProfileId": "mock_default_profile",
                    "skillPrompt": "",
                }
            ],
        })
        debate_messages = debate_result.get("messages", []) if isinstance(debate_result, dict) else []
        debate_check = {
            "ok": bool(debate_messages),
            "endpoint": "/api/debate",
            "message_count": len(debate_messages),
        }
        if not debate_messages:
            warnings.append("API debate smoke test returned no messages")
    except Exception as exc:
        debate_check = {"ok": False, "error": str(exc)}
        warnings.append(f"API debate smoke test failed: {exc}")

    # 9. API Finalize
    try:
        from backend.core.debate import build_final_answer
        finalize_check = {"ok": True, "endpoint": "/api/finalize"}
    except Exception as exc:
        finalize_check = {"ok": False, "error": str(exc)}

    # 10. AI Members
    try:
        ai_members_data = ai_member_settings_store.get()
        ai_members_check = {"ok": True, "endpoint": "/ai-members", "custom_members_count": len(ai_members_data.get("customMembers", []))}
    except Exception as exc:
        ai_members_check = {"ok": False, "error": str(exc)}

    # 11. Web AI browser automation
    try:
        browser_availability = web_ai_browser_manager.availability()
        websites = ai_website_registry.list_sites()
        supported = [site for site in websites if site.get("webAI", {}).get("canSendPrompt")]
        callable_sites = [site for site in supported if site.get("webAI", {}).get("callable")]
        settings_data = ai_member_settings_store.get()
        webai_assignments = {
            role: profile_id
            for role, profile_id in settings_data.get("roleAssignments", {}).items()
            if str(profile_id).startswith("webai:")
        }
        assigned_not_callable = []
        by_id = {site["id"]: site for site in supported}
        for role, profile_id in webai_assignments.items():
            site_id = str(profile_id).split(":", 1)[1]
            site = by_id.get(site_id)
            if not site or not site.get("webAI", {}).get("callable"):
                assigned_not_callable.append({"role": role, "site_id": site_id})

        web_ai_ok = (
            bool(browser_availability.get("available"))
            and bool(supported)
            and bool(callable_sites)
            and not assigned_not_callable
        )
        web_ai_check = {
            "ok": web_ai_ok,
            "browser_available": bool(browser_availability.get("available")),
            "browser_error": browser_availability.get("error", ""),
            "supported_count": len(supported),
            "callable_count": len(callable_sites),
            "supported_sites": [
                {
                    "id": site["id"],
                    "name": site.get("name", site["id"]),
                    "status": site.get("webAI", {}).get("status"),
                    "callable": site.get("webAI", {}).get("callable"),
                }
                for site in supported
            ],
            "role_assignments": webai_assignments,
            "assigned_not_callable": assigned_not_callable,
        }
        if not browser_availability.get("available"):
            warnings.append("Playwright browser automation is not available")
        if not supported:
            warnings.append("No Web AI sites support prompt automation")
        if supported and not callable_sites:
            warnings.append("Web AI browser automation is installed, but no supported website is logged in and callable")
        if assigned_not_callable:
            warnings.append("Some Web AI role assignments are not callable; open login page and detect login first")
    except Exception as exc:
        web_ai_check = {"ok": False, "error": str(exc)}
        warnings.append(f"Web AI self-check failed: {exc}")

    # 12. CC Switch and utility endpoints
    runtime = runtime_check()
    cc_switch_status = runtime.get("ccSwitch", {})
    if cc_switch_status.get("health"):
        cc_switch_check = test_ccswitch_route()
        cc_switch_check["health"] = True
        cc_switch_check["serviceUrl"] = cc_switch_status.get("url")
        if not cc_switch_check.get("routeReady"):
            warnings.append(f"CC Switch is running but route test failed: {cc_switch_check.get('message', '')}")
    else:
        cc_switch_check = {
            "ok": False,
            "routeReady": False,
            "health": False,
            "serviceUrl": cc_switch_status.get("url"),
            "message": cc_switch_status.get("lastError", "CC Switch is not running"),
        }
        warnings.append("CC Switch is not running")
    if cc_switch_check.get("routeReady"):
        if configured_count == 0:
            configured_count = 1
            providers_check["configured_count"] = configured_count
            warning = "No provider credentials configured — only mock mode available"
            if warning in warnings:
                warnings.remove(warning)
        for profile_info in providers_check["profiles"]:
            if profile_info["provider"] == "ccswitch":
                profile_info["route_callable"] = True
    utility_features_check = {
        "ok": True,
        "issueReporting": {"ok": True, "endpoint": "/api/issues"},
        "imageGeneration": {"ok": True, "endpoint": "/api/images/generate"},
    }

    checks = {
        "backend": backend_check,
        "frontend": frontend_check,
        "desktop": desktop_check,
        "providers": providers_check,
        "localTools": local_tools_check,
        "fileReader": file_reader_check,
        "mockCouncil": mock_council_check,
        "apiDebate": debate_check,
        "apiFinalize": finalize_check,
        "aiMembers": ai_members_check,
        "webAI": web_ai_check,
        "ccSwitch": cc_switch_check,
        "utilityFeatures": utility_features_check,
    }
    core_check_names = [
        "backend",
        "frontend",
        "desktop",
        "providers",
        "localTools",
        "fileReader",
        "mockCouncil",
        "apiDebate",
        "apiFinalize",
        "aiMembers",
    ]
    core_ready = all(checks[name].get("ok", False) for name in core_check_names)
    api_ready = core_ready and configured_count > 0
    web_ai_ready = core_ready and bool(web_ai_check.get("ok", False))
    full_ready = core_ready and api_ready and web_ai_ready
    if full_ready:
        mode = "full"
    elif api_ready and web_ai_ready:
        mode = "api_and_web_ai"
    elif api_ready:
        mode = "api_only"
    elif web_ai_ready:
        mode = "web_ai_only"
    elif core_ready:
        mode = "core_only"
    else:
        mode = "blocked"

    readiness_blockers = []
    if not core_ready:
        readiness_blockers.append("Core desktop/backend workflow is not ready")
    if configured_count == 0:
        readiness_blockers.append("No API provider credentials configured")
    if not web_ai_check.get("browser_available", False):
        readiness_blockers.append("Playwright browser automation is unavailable")
    elif web_ai_check.get("supported_count", 0) == 0:
        readiness_blockers.append("No supported Web AI adapters")
    elif web_ai_check.get("callable_count", 0) == 0:
        readiness_blockers.append("No supported Web AI site is logged in and callable")
    if web_ai_check.get("assigned_not_callable"):
        readiness_blockers.append("Some Web AI role assignments are not callable")
    if cc_switch_check.get("health") and not cc_switch_check.get("routeReady"):
        readiness_blockers.append("CC Switch is running but its current provider route is not callable")

    readiness_actions = []
    if configured_count == 0:
        readiness_actions.append({
            "id": "configure_api_provider",
            "kind": "manual",
            "label": "Configure API provider",
            "description": "Add an API key in Settings, then run provider test again.",
        })
    if cc_switch_check.get("health") and not cc_switch_check.get("routeReady"):
        readiness_actions.append({
            "id": "configure_ccswitch_provider",
            "kind": "manual",
            "label": "Configure CC Switch provider",
            "description": cc_switch_check.get("message") or "Open CC Switch and configure the active provider base_url, API Key, and model.",
        })
    if not cc_switch_check.get("health"):
        readiness_actions.append({
            "id": "launch_ccswitch",
            "kind": "http",
            "label": "Launch CC Switch",
            "description": "Start the installed CC Switch desktop application and local routing service.",
            "method": "POST",
            "endpoint": "/api/ccswitch/launch",
            "refreshAfter": True,
        })
    if not web_ai_check.get("browser_available", False):
        readiness_actions.append({
            "id": "install_playwright_browser",
            "kind": "manual",
            "label": "Install Playwright browser",
            "description": "Run python -m playwright install chromium, then restart backend.",
        })
    for site in web_ai_check.get("supported_sites", []):
        if site.get("callable"):
            continue
        site_id = site.get("id")
        if not site_id:
            continue
        site_name = site.get("name") or site_id
        readiness_actions.extend([
            {
                "id": f"open_web_ai_login:{site_id}",
                "kind": "http",
                "label": f"Open {site_name} login",
                "description": "Open a persistent browser profile for manual login.",
                "method": "POST",
                "endpoint": f"/ai-members/websites/{site_id}/login-fallback",
                "refreshAfter": False,
            },
            {
                "id": f"detect_web_ai_login:{site_id}",
                "kind": "http",
                "label": f"Detect {site_name} login",
                "description": "Check whether the persistent browser profile is logged in and callable.",
                "method": "POST",
                "endpoint": f"/ai-members/websites/{site_id}/login-detect",
                "refreshAfter": True,
            },
        ])

    readiness = {
        "coreReady": core_ready,
        "apiReady": api_ready,
        "webAIReady": web_ai_ready,
        "fullReady": full_ready,
        "mode": mode,
        "blockers": readiness_blockers,
        "actions": readiness_actions,
    }
    overall_ok = core_ready
    errors = [
        f"{name}: {item.get('error') or 'not ok'}"
        for name, item in checks.items()
        if name in core_check_names and not item.get("ok", False)
    ]
    capability_errors = [
        f"{name}: {item.get('error') or 'not ok'}"
        for name, item in checks.items()
        if name not in core_check_names and not item.get("ok", False)
    ]

    return {
        "ok": overall_ok,
        "overall_ok": overall_ok,
        "readiness": readiness,
        "checks": checks,
        "backend": backend_check,
        "frontend": frontend_check,
        "desktop": desktop_check,
        "providers": providers_check,
        "localTools": local_tools_check,
        "fileReader": file_reader_check,
        "mockCouncil": mock_council_check,
        "apiDebate": debate_check,
        "apiFinalize": finalize_check,
        "aiMembers": ai_members_check,
        "webAI": web_ai_check,
        "warnings": warnings,
        "errors": errors,
        "capability_errors": capability_errors,
    }


@app.get("/dev/council-test")
def dev_council_test_page():
    page = FRONTEND_DIR / "dev" / "council-test.html"
    if not page.exists():
        raise HTTPException(status_code=404, detail="dev council test page not found")
    return FileResponse(str(page))


if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")

if REACT_FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(REACT_FRONTEND_DIST / "assets")), name="react-assets")

