import type { TranslationKey } from './translations';

export type Agent = {
  id: string;
  name: string;
  status: string;
  executablePath?: string | null;
  capabilities: string[];
};

export type TaskDraft = {
  task_id: string;
  agent_id: string;
  title: string;
  instructions: string;
  read_paths: string;
  write_paths: string;
  depends_on: string;
};

export type PlanTask = {
  task_id: string;
  agent_id: string;
  title: string;
  instructions: string;
  read_paths: string[];
  write_paths: string[];
  depends_on: string[];
  status: string;
  wave: number;
  pid?: number | null;
  log_path?: string | null;
  exit_code?: number | null;
  attempts?: number;
  run_history?: RunRecord[];
};

export type RunRecord = {
  attempt: number;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  exit_code?: number | null;
  log_path?: string | null;
};

export type AcceptanceDecision = {
  status: 'pending' | 'accepted' | 'rejected';
  note: string;
  decided_at?: string | null;
};

export type ManagerReport = {
  mode: 'agent' | 'fallback';
  manager_agent_id: string;
  manager_error?: string;
  analysis: string;
  recommendations: string[];
  risks: string[];
  acceptance_criteria: string[];
  project_summary: {
    project_name?: string;
    total_files?: number;
    readable_files?: number;
    languages?: Record<string, number>;
    top_level_areas?: string[];
    relevant_files?: string[];
    warnings?: string[];
  };
  tasks: Array<{
    task_id: string;
    agent_id: string;
    title: string;
    instructions: string;
    read_paths: string[];
    write_paths: string[];
    depends_on: string[];
  }>;
};

export type Plan = {
  plan_id: string;
  project_path: string;
  goal: string;
  created_at?: string;
  updated_at?: string;
  supervisor_agent_id?: string | null;
  manager_report?: ManagerReport | null;
  status: string;
  archived?: boolean;
  archived_at?: string | null;
  acceptance?: AcceptanceDecision;
  waves: string[][];
  conflicts: Array<{ left_task_id: string; right_task_id: string; reasons: string[] }>;
  tasks: PlanTask[];
  locks: Record<string, string>;
  boundary_report: {
    changed_paths: string[];
    undeclared_changes: string[];
    ok: boolean;
  };
  shared_plan_path: string;
  event_log_path: string;
  supervisor_run: {
    status: string;
    pid?: number | null;
    log_path?: string | null;
    exit_code?: number | null;
    attempts?: number;
    run_history?: RunRecord[];
  };
  events: Array<{ event_id: string; type: string; created_at: string; payload: Record<string, unknown> }>;
};

export type ResultReport = {
  plan_id: string;
  goal: string;
  generated_at: string;
  verdict: 'ready' | 'in_progress' | 'needs_attention';
  ready_for_acceptance: boolean;
  suggested_next_action: 'accept' | 'complete_tasks' | 'resolve_issues';
  acceptance: AcceptanceDecision;
  acceptance_criteria: string[];
  summary: Record<'total' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled', number>;
  tasks: Array<{
    task_id: string;
    agent_id: string;
    title: string;
    status: string;
    attempts: number;
    exit_code?: number | null;
    write_paths: string[];
    public_output: string;
  }>;
  boundary_report: Plan['boundary_report'];
  issues: Array<{ code: string; items: string[] }>;
};

export type AgentActivity = {
  task_id?: string;
  agent_id?: string | null;
  status: string;
  title?: string;
  instructions?: string;
  read_paths?: string[];
  write_paths?: string[];
  depends_on?: string[];
  started_at?: string | null;
  finished_at?: string | null;
  exit_code?: number | null;
  attempts?: number;
  run_history?: RunRecord[];
  public_output: string;
  events: Plan['events'];
};

export type AgentTestState = {
  state: 'testing' | 'ok' | 'fail';
  detail?: string;
};

export type AppTranslator = (key: TranslationKey) => string;

export type StatusPillConfig = {
  statusLabels: Record<string, string>;
  statusUnknownLabel: string;
};
