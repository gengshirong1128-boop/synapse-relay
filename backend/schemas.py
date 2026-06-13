from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Mode(str, Enum):
    SOLO = "solo"
    PANEL = "panel"
    DEBATE = "debate"


class RoomMode(str, Enum):
    PRIVATE = "private"
    GROUP = "group"
    PANEL = "panel"
    DEBATE = "debate"


class MessageState(str, Enum):
    THINKING = "thinking"
    PUBLISHED = "published"
    BRIEFED = "briefed"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"


class AgentRole(str, Enum):
    HOST = "host"
    EXPERT = "expert"
    EXECUTOR = "executor"


class AgentStatus(str, Enum):
    ACTIVE = "active"
    MUTED = "muted"
    REMOVED = "removed"


class SenderType(str, Enum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"


class VisibleTo(str, Enum):
    ALL = "all"
    SPECIFIC_AGENT = "specific_agent"


class ContextStatus(str, Enum):
    OK = "ok"
    WARNING = "warning"
    CRITICAL = "critical"
    COMPACTED = "compacted"


class WorkMode(str, Enum):
    DEFAULT = "default"
    CONTINUE_ROUND = "continue_round"
    FINAL_SUMMARY = "final_summary"
    AUTO_DEBATE = "auto_debate"


class ThemeMode(str, Enum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class DecisionState(str, Enum):
    EXPLORING = "exploring"
    CONFLICTING = "conflicting"
    CONVERGING = "converging"
    READY_TO_EXECUTE = "ready_to_execute"
    NEED_USER_INPUT = "need_user_input"


class ExecutionReadiness(str, Enum):
    NOT_READY = "not_ready"
    DRAFT_READY = "draft_ready"
    CODEX_READY = "codex_ready"
    CLAUDE_CODE_READY = "claude_code_ready"


class RoundStatus(str, Enum):
    PENDING = "pending"
    ASSIGNING = "assigning"
    SPECIALISTS_THINKING = "specialists_thinking"
    SPECIALISTS_PUBLISHED = "specialists_published"
    COORDINATOR_THINKING = "coordinator_thinking"
    COORDINATOR_PUBLISHED = "coordinator_published"
    BRIEFED = "briefed"
    WAITING_USER = "waiting_user"
    COMPLETED = "completed"


class AssignmentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class MinisterStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    DONE = "done"
    ERROR = "error"


class MinisterPreset(BaseModel):
    id: str
    title: str
    display_name: str
    office: str
    duty: str
    capability_tags: list[str] = Field(default_factory=list)
    is_chief: bool = False
    enabled: bool = True
    status: MinisterStatus = MinisterStatus.IDLE
    system_prompt: str = ""


class Credential(BaseModel):
    credential_id: str
    provider: str
    name: str
    api_key_env_name: str
    base_url: str | None = None
    default_model: str | None = None
    enabled: bool = True
    key_available: bool = False


class ProviderProfile(BaseModel):
    profile_id: str
    name: str
    provider: str
    api_format: Literal["openai_compatible", "anthropic", "gemini", "qwen", "openrouter", "newapi", "mock"]
    base_url: str | None = None
    default_model: str | None = None
    models: list[str] = Field(default_factory=list)
    credential_id: str
    enabled: bool = True
    target_apps: list[str] = Field(default_factory=lambda: ["synapse"])
    headers: dict[str, Any] = Field(default_factory=dict)
    extra_body: dict[str, Any] = Field(default_factory=dict)
    model_mapping: dict[str, str] = Field(default_factory=dict)
    system_prompt_template: str = ""
    timeout_seconds: int = 35
    max_retries: int = 1
    stream_supported: bool = False
    tool_call_supported: bool = False
    auth_env_name: str | None = None
    notes: str = ""


class AgentTemplate(BaseModel):
    template_id: str
    display_name: str
    provider: str
    model: str
    default_role: AgentRole = AgentRole.EXPERT
    default_position_id: str = "domain_expert"
    description: str = ""


class PositionTemplate(BaseModel):
    position_id: str
    display_name: str
    description: str
    default_responsibilities: list[str] = Field(default_factory=list)
    default_system_prompt: str = ""
    default_round_order: int = 50
    output_schema: dict[str, Any] = Field(default_factory=dict)
    recommended_models: list[str] = Field(default_factory=list)
    can_be_multiple: bool = True


class AgentInstance(BaseModel):
    agent_id: str
    display_name: str
    provider: str
    model: str
    credential_id: str
    profile_id: str | None = None
    role: AgentRole
    position_id: str = "domain_expert"
    position_name: str = "Domain Expert"
    responsibilities: list[str] = Field(default_factory=list)
    persona: str = ""
    system_prompt: str = ""
    status: AgentStatus = AgentStatus.ACTIVE
    context_limit_tokens: int = 8000
    estimated_used_tokens: int = 0
    context_usage_percent: float = 0.0
    joined_at: datetime
    last_active_at: datetime
    round_order: int = 50
    can_receive_user_feedback: bool = False
    can_assign_tasks: bool = False
    can_finalize: bool = False
    reads_full_round_outputs: bool = False
    receives_task_from_coordinator: bool = True


class AgentConfig(BaseModel):
    name: str
    provider: str
    role: str


class AgentResponse(BaseModel):
    agent_name: str
    provider: str
    role: str
    round_number: int = 1
    claim: str
    reasoning: str
    risks: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    suggested_next_step: str = ""
    state: MessageState = MessageState.PUBLISHED
    answer: str | None = None
    need_expert_suggestion: bool = False
    suggested_experts: list[str] = Field(default_factory=list)
    reason: str | None = None
    next_actions: list[str] = Field(default_factory=list)
    suggested_fix: str | None = None
    context_usage_percent: float = 0.0


class SpecialistRoundOutput(BaseModel):
    agent_id: str
    display_name: str
    position_id: str
    assigned_task: str
    claim: str
    analysis: str
    findings: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    suggested_action: str
    confidence: float = 0.0
    needs_coordinator_attention: bool = False
    token_estimate: int = 0


class CoordinatorRoundOutput(BaseModel):
    round_number: int
    summary_for_user: str
    what_each_agent_found: list[dict[str, str]] = Field(default_factory=list)
    common_ground: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    coordinator_decision: str
    risks_remaining: list[str] = Field(default_factory=list)
    user_decision_needed: str
    next_round_task_assignments: list[dict[str, str]] = Field(default_factory=list)
    recommended_next_action: str
    final_answer_candidate: str
    execution_prompt_candidate: str
    confidence: float = 0.0


class SharedBrief(BaseModel):
    round_number: int
    each_agent_position: list[AgentResponse] = Field(default_factory=list)
    common_ground: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    suggested_next_step: str = ""
    comparison_summary: str | None = None
    agent_positions: list[dict[str, Any]] = Field(default_factory=list)
    coordinator_summary: str = ""
    specialist_outputs_summary: list[dict[str, Any]] = Field(default_factory=list)
    resolved_conflicts: list[str] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)
    strongest_plan: str = ""
    minority_opinions: list[str] = Field(default_factory=list)
    user_decision_needed: str = ""
    suggested_next_round_focus: str = ""
    compact_summary_for_next_round: str = ""
    decision_state: DecisionState = DecisionState.EXPLORING
    execution_readiness: ExecutionReadiness = ExecutionReadiness.NOT_READY
    recommended_next_action: str = "ask_user"


class HandoffPacket(BaseModel):
    task: str
    context: str
    attempts: list[str]
    blocker: str
    need: str
    constraints: list[str]
    room_state: str | None = None
    user_intent: str | None = None
    local_project_context: str | None = None
    conversation_summary: str | None = None
    main_agent_attempt: str | None = None
    need_from_new_agent: str | None = None
    output_format: list[str] = Field(default_factory=list)
    project_files_sent: list[str] = Field(default_factory=list)
    project_files_excluded: list[str] = Field(default_factory=list)
    env_notice: str | None = None


class TokenUsage(BaseModel):
    estimated_tokens: int
    estimated_cost: float


class TaskAssignment(BaseModel):
    assignment_id: str
    round_id: str
    from_agent_id: str
    to_agent_id: str
    position_id: str
    task_type: str
    instruction: str
    required_output_format: list[str] = Field(default_factory=list)
    context_packet: str = ""
    priority: int = 5
    status: AssignmentStatus = AssignmentStatus.PENDING
    created_at: datetime
    completed_at: datetime | None = None


class UserFeedback(BaseModel):
    feedback_id: str
    room_id: str
    round_id: str
    content: str
    received_by: str
    interpreted_intent: str = ""
    updated_constraints: list[str] = Field(default_factory=list)
    next_round_goal: str = ""
    created_at: datetime


class RoundInput(BaseModel):
    original_task: str
    current_goal: str
    previous_shared_brief: str = ""
    previous_agent_outputs_summary: list[str] = Field(default_factory=list)
    user_feedback_since_last_round: str = ""
    updated_constraints: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    this_round_objective: str = ""
    local_project_context: str = ""
    selected_project_files: list[str] = Field(default_factory=list)


class RoundRecord(BaseModel):
    round_id: str
    room_id: str
    mode: Literal["panel", "debate"]
    round_number: int
    participant_agent_ids: list[str]
    coordinator_agent_id: str
    round_input: RoundInput
    task_assignments: list[TaskAssignment] = Field(default_factory=list)
    specialist_outputs: list[SpecialistRoundOutput] = Field(default_factory=list)
    coordinator_output: CoordinatorRoundOutput | None = None
    shared_brief: SharedBrief | None = None
    user_feedback: list[UserFeedback] = Field(default_factory=list)
    status: RoundStatus = RoundStatus.PENDING
    created_at: datetime
    completed_at: datetime | None = None
    stop_reason: str | None = None


class SessionRecord(BaseModel):
    session_id: str
    mode: Mode
    user_goal: str
    messages: list[dict[str, Any]] = Field(default_factory=list)
    agents: list[AgentConfig]
    round_number: int = 0
    shared_briefs: list[SharedBrief] = Field(default_factory=list)
    handoff_packet: HandoffPacket | None = None
    final_answer: str | None = None
    status: Literal["active", "waiting", "completed"] = "active"
    budget_tokens: int = 6000
    max_rounds: int = 3


class AgentMember(BaseModel):
    agent_id: str
    name: str
    provider: str
    role: AgentRole
    display_name: str | None = None
    model: str | None = None
    credential_id: str | None = None
    profile_id: str | None = None
    position_id: str | None = None
    position_name: str | None = None
    persona: str | None = None
    system_prompt: str | None = None
    status: AgentStatus = AgentStatus.ACTIVE
    joined_at: datetime
    context_usage_percent: float = 0.0
    context_limit_tokens: int = 8000
    estimated_used_tokens: int = 0
    last_compacted_at: datetime | None = None
    compacted_summary: str | None = None
    round_order: int = 50
    can_receive_user_feedback: bool = False
    can_assign_tasks: bool = False
    can_finalize: bool = False
    reads_full_round_outputs: bool = False
    receives_task_from_coordinator: bool = True


class RoomMessage(BaseModel):
    message_id: str
    room_id: str
    sender_type: SenderType
    sender_id: str
    content: str
    visible_to: VisibleTo = VisibleTo.ALL
    target_agent_id: str | None = None
    mode: Literal["private", "group"] = "group"
    status: MessageState = MessageState.PUBLISHED
    token_estimate: int = 0
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)
    imperial_review: dict[str, Any] | None = None


class Directive(BaseModel):
    id: str
    source_message_id: str
    source_agent_id: str | None = None
    type: Literal["approve", "reject", "mode", "user"] = "user"
    content: str
    enabled: bool = True
    permanent: bool = True
    created_at: datetime


class RoomSettings(BaseModel):
    theme: ThemeMode = ThemeMode.SYSTEM
    language: Literal["zh", "en"] = "zh"


class ChatRoom(BaseModel):
    room_id: str
    title: str
    owner_user: str
    host_agent_id: str
    chief_agent_id: str | None = None
    active_mode: WorkMode = WorkMode.DEFAULT
    members: list[AgentMember] = Field(default_factory=list)
    messages: list[RoomMessage] = Field(default_factory=list)
    mode: RoomMode = RoomMode.GROUP
    active_agent_id: str | None = None
    shared_briefs: list[SharedBrief] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    final_plan: str | None = None
    pending_handoff_packet: HandoffPacket | None = None
    max_rounds: int = 3
    token_budget: int = 6000
    cost_budget: float = 5.0
    consensus_threshold: float = 0.66
    stop_reason: str | None = None
    rounds: list[RoundRecord] = Field(default_factory=list)
    latest_round_id: str | None = None
    pending_user_feedback: str = ""
    attached_project_id: str | None = None
    attached_project_name: str | None = None
    attached_project_path: str | None = None
    attached_project_context: dict[str, Any] | None = None
    pinned: bool = False
    guiding_directives: list[Directive] = Field(default_factory=list)
    forbidden_directives: list[Directive] = Field(default_factory=list)
    files: list[dict[str, Any]] = Field(default_factory=list)
    settings: RoomSettings = Field(default_factory=RoomSettings)


class HostDecision(BaseModel):
    answer: str
    need_expert_suggestion: bool
    suggested_experts: list[str]
    reason: str
    next_actions: list[str]


class SoloRequest(BaseModel):
    prompt: str
    agent: AgentConfig


class PanelStartRequest(BaseModel):
    prompt: str
    primary_agent: AgentConfig
    support_agents: list[AgentConfig] = Field(default_factory=list)


class PanelHandoffRequest(BaseModel):
    session_id: str
    blocker: str
    need: str
    constraints: list[str] = Field(default_factory=list)


class DebateStartRequest(BaseModel):
    prompt: str
    agents: list[AgentConfig]
    max_rounds: int = 3
    budget_tokens: int = 6000


class DebateContinueRequest(BaseModel):
    session_id: str


class FinalizeRequest(BaseModel):
    session_id: str


class SessionEnvelope(BaseModel):
    session: SessionRecord
    latest_responses: list[AgentResponse] = Field(default_factory=list)
    shared_brief: SharedBrief | None = None
    token_usage: TokenUsage


class RoomCreateRequest(BaseModel):
    title: str = "Synapse Relay Workspace"
    owner_user: str = "User"
    host_agent: AgentConfig = Field(
        default_factory=lambda: AgentConfig(name="Mock GPT", provider="mock", role=AgentRole.HOST.value)
    )


class AddAgentRequest(BaseModel):
    agent: AgentConfig
    context_limit_tokens: int = 8000


class AddAgentInstanceToRoomRequest(BaseModel):
    agent_id: str


class RemoveAgentRequest(BaseModel):
    agent_id: str


class RoomModeRequest(BaseModel):
    mode: RoomMode


class ActiveAgentRequest(BaseModel):
    agent_id: str | None = None


class ChiefAgentRequest(BaseModel):
    agent_id: str


class WorkModeRequest(BaseModel):
    mode: WorkMode


class RoomSettingsPatchRequest(BaseModel):
    theme: ThemeMode | None = None
    language: Literal["zh", "en"] | None = None


class RoomMessageRequest(BaseModel):
    content: str


class ImperialReviewRequest(BaseModel):
    type: Literal["approve", "reject"]
    instruction: str = ""


class RoomPanelRequest(BaseModel):
    selected_agent_ids: list[str] = Field(default_factory=list)
    blocker: str
    need: str
    constraints: list[str] = Field(
        default_factory=lambda: [
            "Do not rewrite the whole project.",
            "Keep token usage low.",
            "Prefer minimal viable changes.",
        ]
    )


class PanelRoundStartRequest(BaseModel):
    participant_agent_ids: list[str] = Field(default_factory=list)
    current_goal: str = ""
    constraints: list[str] = Field(default_factory=list)


class PanelRoundFeedbackRequest(BaseModel):
    content: str


class PanelRoundContinueRequest(BaseModel):
    participant_agent_ids: list[str] = Field(default_factory=list)
    current_goal: str = ""
    constraints: list[str] = Field(default_factory=list)


class DebateRoundStartRequest(BaseModel):
    participant_agent_ids: list[str] = Field(default_factory=list)
    current_goal: str = ""
    constraints: list[str] = Field(default_factory=list)
    max_rounds: int = 3
    token_budget: int = 6000
    cost_budget: float = 5.0
    consensus_threshold: float = 0.66


class DebateRoundContinueRequest(BaseModel):
    manual_stop: bool = False
    max_auto_rounds: int = 1


class PrivateChatRequest(BaseModel):
    room_id: str
    content: str


class PrivateSyncRequest(BaseModel):
    room_id: str
    summary: str


class AgentInstanceCreateRequest(BaseModel):
    agent_id: str
    display_name: str
    provider: str
    model: str
    credential_id: str
    profile_id: str | None = None
    role: AgentRole = AgentRole.EXPERT
    position_id: str = "domain_expert"
    position_name: str = "Domain Expert"
    persona: str = ""
    system_prompt: str = ""
    context_limit_tokens: int = 8000


class AgentInstancePatchRequest(BaseModel):
    display_name: str | None = None
    model: str | None = None
    credential_id: str | None = None
    profile_id: str | None = None
    persona: str | None = None
    system_prompt: str | None = None
    status: AgentStatus | None = None
    context_limit_tokens: int | None = None
    position_id: str | None = None
    position_name: str | None = None


class PositionCustomCreateRequest(BaseModel):
    position_id: str
    display_name: str
    description: str
    default_responsibilities: list[str] = Field(default_factory=list)
    default_system_prompt: str = ""
    default_round_order: int = 50
    output_schema: dict[str, Any] = Field(default_factory=dict)
    recommended_models: list[str] = Field(default_factory=list)
    can_be_multiple: bool = True


class PositionAssignRequest(BaseModel):
    position_id: str
    position_name: str | None = None


class RoomDebateRequest(BaseModel):
    selected_agent_ids: list[str] = Field(default_factory=list)
    max_rounds: int = 3
    token_budget: int = 6000
    cost_budget: float = 5.0
    consensus_threshold: float = 0.66


class RoomDebateContinueRequest(BaseModel):
    manual_stop: bool = False


class RoomFinalizeRequest(BaseModel):
    room_id: str


class CompactResponse(BaseModel):
    room_id: str
    compacted_agents: list[dict[str, Any]]


class ContextAgentUsage(BaseModel):
    agent_id: str
    display_name: str
    provider: str
    model: str
    credential_id: str | None
    used_tokens: int
    limit_tokens: int
    usage_percent: float
    status: ContextStatus
    compacted_summary: str | None = None


class ContextUsageResponse(BaseModel):
    room_id: str
    agents: list[ContextAgentUsage]


class RoomEnvelope(BaseModel):
    room: ChatRoom
    latest_messages: list[RoomMessage] = Field(default_factory=list)
    host_decision: HostDecision | None = None
    handoff_packet: HandoffPacket | None = None
    shared_brief: SharedBrief | None = None
    latest_round: RoundRecord | None = None
    token_usage: TokenUsage


class ProviderProfileCreateRequest(BaseModel):
    profile_id: str
    name: str
    provider: str
    api_format: Literal["openai_compatible", "anthropic", "gemini", "qwen", "openrouter", "newapi", "mock"]
    base_url: str | None = None
    default_model: str | None = None
    models: list[str] = Field(default_factory=list)
    credential_id: str
    enabled: bool = True
    target_apps: list[str] = Field(default_factory=lambda: ["synapse"])
    headers: dict[str, Any] = Field(default_factory=dict)
    extra_body: dict[str, Any] = Field(default_factory=dict)
    model_mapping: dict[str, str] = Field(default_factory=dict)
    system_prompt_template: str = ""
    timeout_seconds: int = 35
    max_retries: int = 1
    stream_supported: bool = False
    tool_call_supported: bool = False
    auth_env_name: str | None = None
    notes: str = ""


class ProviderProfilePatchRequest(BaseModel):
    name: str | None = None
    api_format: Literal["openai_compatible", "anthropic", "gemini", "qwen", "openrouter", "newapi", "mock"] | None = None
    base_url: str | None = None
    default_model: str | None = None
    models: list[str] | None = None
    credential_id: str | None = None
    enabled: bool | None = None
    target_apps: list[str] | None = None
    headers: dict[str, Any] | None = None
    extra_body: dict[str, Any] | None = None
    model_mapping: dict[str, str] | None = None
    system_prompt_template: str | None = None
    timeout_seconds: int | None = None
    max_retries: int | None = None
    stream_supported: bool | None = None
    tool_call_supported: bool | None = None
    auth_env_name: str | None = None
    notes: str | None = None


class ProviderProfileTestRequest(BaseModel):
    test_prompt: str = "Respond with: provider test ok"
    model: str | None = None
    smoke_test: bool = False


class ExecutorRunRequest(BaseModel):
    executor_type: Literal["codex", "claude_code"]
    project_path: str
    prompt: str = ""
    prompt_file: str | None = None
    dry_run: bool = True
    timeout_seconds: int = 600
    allow_write: bool = False
    extra_args: list[str] = Field(default_factory=list)
    confirmation_token: str | None = None


class ExecutorRunResult(BaseModel):
    run_id: str | None = None
    executor_type: str
    command_preview: list[str] = Field(default_factory=list)
    prompt_file: str | None = None
    dry_run: bool = True
    started: bool = False
    exit_code: int | None = None
    stdout: str = ""
    stderr: str = ""
    error: str | None = None
    require_confirmation_token: bool = False
    confirmation_hint: str | None = None


class CollaborationTaskCreate(BaseModel):
    task_id: str
    agent_id: str
    title: str
    instructions: str = ""
    read_paths: list[str] = Field(default_factory=list)
    write_paths: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)


class CollaborationPlanCreateRequest(BaseModel):
    project_path: str
    goal: str
    supervisor_agent_id: str | None = None
    tasks: list[CollaborationTaskCreate] = Field(min_length=1)


class CollaborationTaskStartRequest(BaseModel):
    confirm: bool = False


class CollaborationSupervisorStartRequest(BaseModel):
    confirm: bool = False


class CollaborationAdviceRequest(BaseModel):
    content: str
    target_task_ids: list[str] = Field(default_factory=list)


class ProjectFile(BaseModel):
    path: str
    relative_path: str
    filename: str
    extension: str
    language: str
    size_bytes: int
    line_count: int
    is_readable: bool
    is_sensitive: bool = False
    is_too_large: bool = False
    summary: str = ""
    keywords: list[str] = Field(default_factory=list)
    selected: bool = False


class ProjectIndex(BaseModel):
    project_id: str
    project_path: str
    project_name: str
    files: list[ProjectFile] = Field(default_factory=list)
    ignored_files: list[str] = Field(default_factory=list)
    ignored_dirs: list[str] = Field(default_factory=list)
    total_files: int = 0
    total_size_bytes: int = 0
    created_at: datetime
    updated_at: datetime
    warnings: list[str] = Field(default_factory=list)


class CodeSnippet(BaseModel):
    start_line: int
    end_line: int
    content: str


class RelevantFile(BaseModel):
    relative_path: str
    language: str
    reason: str
    score: float
    snippets: list[CodeSnippet] = Field(default_factory=list)
    token_estimate: int = 0


class ProjectContext(BaseModel):
    project_id: str
    project_name: str
    project_path: str
    file_tree: list[str] = Field(default_factory=list)
    relevant_files: list[RelevantFile] = Field(default_factory=list)
    dependency_files: list[str] = Field(default_factory=list)
    user_question: str
    context_token_estimate: int = 0
    warnings: list[str] = Field(default_factory=list)


class ProjectScanRequest(BaseModel):
    project_path: str
    max_file_size_bytes: int = 1_048_576


class ProjectRelevantFilesRequest(BaseModel):
    question: str
    top_k: int = 8
    manual_selected_paths: list[str] = Field(default_factory=list)


class ProjectContextBuildRequest(BaseModel):
    question: str
    selected_paths: list[str] = Field(default_factory=list)


class RoomProjectAttachRequest(BaseModel):
    project_id: str
    question: str = ""
    selected_paths: list[str] = Field(default_factory=list)


class ExecutionPackage(BaseModel):
    executor_type: Literal["codex", "claude_code", "generic"]
    project_path: str
    task_goal: str
    final_plan: str
    relevant_files: list[dict[str, Any]] = Field(default_factory=list)
    modification_steps: list[str] = Field(default_factory=list)
    validation_commands: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    rollback_notes: list[str] = Field(default_factory=list)
    generated_prompt: str


class ExecutorExportRequest(BaseModel):
    room_id: str
    round_id: str | None = None
    project_id: str | None = None
    final_plan: str | None = None
    selected_files: list[str] = Field(default_factory=list)


class AppTargetConfig(BaseModel):
    target_app: Literal["claude_code", "codex", "gemini_cli", "opencode", "generic_cli"]
    export_mode: Literal["env", "settings_json", "command_args", "prompt_only"] = "env"
    settings_path: str | None = None
    env_vars: dict[str, str] = Field(default_factory=dict)
    command_template: str = ""
    model_mapping: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True


class AppTargetPreviewRequest(BaseModel):
    target_app: Literal["claude_code", "codex", "gemini_cli", "opencode", "generic_cli"]
    profile_id: str
    credential_id: str | None = None
    model: str | None = None
    export_mode: Literal["env", "settings_json", "command_args", "prompt_only"] = "env"
    dry_run: bool = True
    settings_path: str | None = None
    write_config: bool = False


class AppTargetExportRequest(AppTargetPreviewRequest):
    confirm_write: bool = False


class RoomHistoryItem(BaseModel):
    room_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    last_message_preview: str = ""
    member_count: int = 0
    round_count: int = 0
    project_name: str | None = None
    tags: list[str] = Field(default_factory=list)
    archived: bool = False
    pinned: bool = False


class RoomRenameRequest(BaseModel):
    title: str


class RoomArchiveRequest(BaseModel):
    archived: bool = True


class RoomPinRequest(BaseModel):
    pinned: bool = True
