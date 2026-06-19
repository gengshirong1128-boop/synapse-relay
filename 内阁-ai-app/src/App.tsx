import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Clipboard,
  Clock3,
  Eye,
  Download,
  FileCheck2,
  FileCode2,
  FolderGit2,
  GitMerge,
  History,
  Languages,
  LockKeyhole,
  ListChecks,
  MessageSquare,
  Play,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import { translations, type Language, type TranslationKey } from './translations';
import { requestJson } from './api';
import { computeProgress, currentWaveIndex as deriveCurrentWaveIndex, launchableWaveTasks as deriveLaunchableWaveTasks, pickDefaultAgentId, agentForIndex, mapAgentTestResult, type AgentTestResult } from './planLogic';

type Agent = {
  id: string;
  name: string;
  status: string;
  executablePath?: string | null;
  capabilities: string[];
};

type TaskDraft = {
  task_id: string;
  agent_id: string;
  title: string;
  instructions: string;
  read_paths: string;
  write_paths: string;
  depends_on: string;
};

type PlanTask = {
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

type RunRecord = {
  attempt: number;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  exit_code?: number | null;
  log_path?: string | null;
};

type Plan = {
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

type AcceptanceDecision = {
  status: 'pending' | 'accepted' | 'rejected';
  note: string;
  decided_at?: string | null;
};

type ResultReport = {
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

type ManagerReport = {
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

type AgentActivity = {
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

const launchableAgentIds = new Set(['cli.codex', 'cli.claude_code', 'cli.gemini', 'cli.opencode']);

const splitPaths = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const newTask = (index: number, agentId = ''): TaskDraft => ({
  task_id: `task-${index}`,
  agent_id: agentId,
  title: '',
  instructions: '',
  read_paths: '',
  write_paths: '',
  depends_on: '',
});

function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('agent-relay-language') === 'en' ? 'en' : 'zh'));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentPlans, setRecentPlans] = useState<Plan[]>([]);
  const [projectPath, setProjectPath] = useState('D:\\内阁');
  const [goal, setGoal] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([newTask(1), newTask(2)]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [managerReport, setManagerReport] = useState<ManagerReport | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [resultReport, setResultReport] = useState<ResultReport | null>(null);
  const [acceptanceNote, setAcceptanceNote] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [messageTarget, setMessageTarget] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [advice, setAdvice] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [agentTests, setAgentTests] = useState<Record<string, { state: 'testing' | 'ok' | 'fail'; detail?: string }>>({});

  const t = (key: TranslationKey) => translations[language][key];
  const statusLabels: Record<string, string> = {
    callable: t('statusCallable'),
    installed: t('statusInstalled'),
    configured: t('statusConfigured'),
    not_installed: t('statusNotInstalled'),
    pending: t('statusPending'),
    running: t('statusRunning'),
    completed: t('statusCompleted'),
    failed: t('statusFailed'),
    ready: t('statusReady'),
    needs_attention: t('statusNeedsAttention'),
    idle: t('statusIdle'),
    cancelled: t('statusCancelled'),
    paused: t('statusPaused'),
    accepted: t('statusAccepted'),
    rejected: t('statusRejected'),
  };
  const eventLabels: Record<string, string> = {
    plan_created: t('eventPlanCreated'),
    task_started: t('eventTaskStarted'),
    task_finished: t('eventTaskFinished'),
    supervisor_started: t('eventSupervisorStarted'),
    supervisor_advice: t('eventSupervisorAdvice'),
    user_message: t('eventUserMessage'),
    task_cancelled: t('statusCancelled'),
    supervisor_cancelled: t('supervisorCancelled'),
    plan_accepted: t('resultAccepted'),
    plan_rejected: t('resultRejected'),
    plan_archived: t('planArchived'),
    plan_restored: t('planRestored'),
  };
  const issueLabels: Record<string, string> = {
    failed_tasks: t('issueFailedTasks'),
    cancelled_tasks: t('issueCancelledTasks'),
    running_tasks: t('issueRunningTasks'),
    pending_tasks: t('issuePendingTasks'),
    undeclared_changes: t('issueUndeclaredChanges'),
  };
  const nextActionLabels: Record<string, string> = {
    accept: t('nextAccept'),
    complete_tasks: t('nextCompleteTasks'),
    resolve_issues: t('nextResolveIssues'),
  };
  const verdictLabels: Record<string, string> = {
    ready: t('resultReady'),
    in_progress: t('resultInProgress'),
    needs_attention: t('resultNeedsAttention'),
  };

  const callableAgents = useMemo(
    () => agents.filter((item) => item.status === 'callable' && launchableAgentIds.has(item.id)),
    [agents],
  );
  const activeManagerReport = managerReport || plan?.manager_report || null;

  const completedCount = plan?.tasks.filter((task) => task.status === 'completed').length || 0;
  const hasRunningAgents = Boolean(plan?.tasks.some((task) => task.status === 'running') || plan?.supervisor_run.status === 'running');
  const progress = plan ? computeProgress(plan.tasks) : 0;
  const currentWaveIndex = plan ? deriveCurrentWaveIndex(plan.waves, plan.tasks) : -1;
  const launchableWaveTasks = plan ? deriveLaunchableWaveTasks(plan.waves, plan.tasks, currentWaveIndex) : [];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2600);
  };

  const loadPlans = async (includeArchived = showArchived) => {
    try {
      const data = await requestJson<{ plans?: Plan[] }>(`/orchestration/plans?include_archived=${includeArchived}`);
      setRecentPlans(data.plans || []);
    } catch {
      // The agent list error is more actionable on initial load.
    }
  };

  const loadAgents = async (announce = false) => {
    setError('');
    try {
      const data = await requestJson<{ agents?: Agent[]; callable_agents?: Agent[] }>('/orchestration/agents');
      setAgents(data.agents || []);
      const callable = data.callable_agents || [];
      const defaultId = pickDefaultAgentId(callable);
      setSupervisor((current) => current || defaultId);
      setTasks((current) =>
        current.map((task, index) => ({
          ...task,
          agent_id: task.agent_id || agentForIndex(callable, index, defaultId),
        })),
      );
      if (announce) showNotice(t('agentsUpdated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const testAgentConnection = async (agentId: string) => {
    setAgentTests((current) => ({ ...current, [agentId]: { state: 'testing' } }));
    try {
      const result = await requestJson<AgentTestResult>(
        `/orchestration/agents/${encodeURIComponent(agentId)}/test`,
        { method: 'POST' },
      );
      setAgentTests((current) => ({ ...current, [agentId]: mapAgentTestResult(result) }));
    } catch (cause) {
      setAgentTests((current) => ({
        ...current,
        [agentId]: { state: 'fail', detail: cause instanceof Error ? cause.message : String(cause) },
      }));
    }
  };

  const refreshPlan = async (planId = plan?.plan_id) => {
    if (!planId) return;
    if (planId !== plan?.plan_id) {
      setAcceptanceNote('');
      setResultReport(null);
    }
    try {
      const refreshed = await requestJson<Plan>(`/orchestration/plans/${planId}`);
      setPlan(refreshed);
      setManagerReport(null);
      setTasks(refreshed.tasks.map((task) => ({
        ...task,
        read_paths: task.read_paths.join('\n'),
        write_paths: task.write_paths.join('\n'),
        depends_on: task.depends_on.join('\n'),
      })));
      setSelectedActivityId((current) =>
        current === '__supervisor__' || refreshed.tasks.some((task) => task.task_id === current)
          ? current
          : refreshed.tasks[0]?.task_id || '',
      );
      setRecentPlans((current) =>
        refreshed.archived && !showArchived
          ? current.filter((item) => item.plan_id !== refreshed.plan_id)
          : [refreshed, ...current.filter((item) => item.plan_id !== refreshed.plan_id)],
      );
      await loadResult(refreshed.plan_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const loadResult = async (planId = plan?.plan_id) => {
    if (!planId) return;
    try {
      const report = await requestJson<ResultReport>(`/orchestration/plans/${planId}/result`);
      setResultReport(report);
      setAcceptanceNote((current) => current || report.acceptance.note || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  useEffect(() => {
    void loadAgents();
    void loadPlans();
  }, []);

  useEffect(() => {
    localStorage.setItem('agent-relay-language', language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    // Only poll while an agent is actually running; every static state
    // (completed / needs_attention / paused / ready) stops the timer to avoid
    // hammering the backend. Starting a task flips hasRunningAgents and the
    // effect re-subscribes.
    if (!plan || !hasRunningAgents) return;
    const timer = window.setInterval(() => void refreshPlan(plan.plan_id), 2500);
    return () => window.clearInterval(timer);
  }, [plan?.plan_id, hasRunningAgents]);

  useEffect(() => {
    if (!autoRun || !plan || busy) return;
    if (plan.tasks.some((task) => ['failed', 'cancelled'].includes(task.status))) {
      setAutoRun(false);
      showNotice(t('autoRunStopped'));
      return;
    }
    if (plan.tasks.every((task) => task.status === 'completed')) {
      setAutoRun(false);
      showNotice(plan.status === 'completed' ? t('autoRunComplete') : t('autoRunStopped'));
      return;
    }
    if (!plan.tasks.some((task) => task.status === 'running') && launchableWaveTasks.length) {
      void startCurrentWave(false);
    }
  }, [autoRun, plan?.updated_at, busy]);

  useEffect(() => {
    if (!plan || !selectedActivityId) {
      setActivity(null);
      return;
    }
    const load = () => void loadActivity(selectedActivityId);
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [plan?.plan_id, selectedActivityId]);

  const updateTask = (index: number, patch: Partial<TaskDraft>) => {
    setTasks((current) => current.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task)));
    setValidationErrors([]);
  };

  const validateDraft = () => {
    const errors: string[] = [];
    const ids = tasks.map((task) => task.task_id.trim()).filter(Boolean);
    const knownIds = new Set(ids);
    if (!projectPath.trim()) errors.push(t('validationProject'));
    if (!goal.trim()) errors.push(t('validationGoal'));
    if (!tasks.length) errors.push(t('validationTaskRequired'));
    if (tasks.some((task) => !task.task_id.trim())) errors.push(t('validationTaskId'));
    if (tasks.some((task) => !task.title.trim())) errors.push(t('validationTaskTitle'));
    if (tasks.some((task) => !task.agent_id.trim())) errors.push(t('validationTaskAgent'));
    if (ids.length !== new Set(ids).size) errors.push(t('validationDuplicateId'));
    if (tasks.some((task) => splitPaths(task.depends_on).some((id) => id === task.task_id || !knownIds.has(id)))) {
      errors.push(t('validationDependency'));
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const createPlan = async () => {
    if (!validateDraft()) return;
    setBusy('create');
    setError('');
    try {
      const payload = {
        project_path: projectPath,
        goal,
        supervisor_agent_id: supervisor || null,
        manager_report: managerReport,
        tasks: tasks.map((task) => ({
          ...task,
          read_paths: splitPaths(task.read_paths),
          write_paths: splitPaths(task.write_paths),
          depends_on: splitPaths(task.depends_on),
        })),
      };
      const created = await requestJson<Plan>('/orchestration/plans', { method: 'POST', body: JSON.stringify(payload) });
      setPlan(created);
      setManagerReport(null);
      setResultReport(null);
      setSelectedActivityId(created.tasks[0]?.task_id || '');
      setRecentPlans((current) => [created, ...current.filter((item) => item.plan_id !== created.plan_id)]);
      showNotice(t('planCreated'));
      await loadResult(created.plan_id);
      window.setTimeout(() => document.getElementById('execution-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const loadActivity = async (activityId: string) => {
    if (!plan) return;
    try {
      const path = activityId === '__supervisor__'
        ? `/orchestration/plans/${plan.plan_id}/supervisor/activity`
        : `/orchestration/plans/${plan.plan_id}/tasks/${activityId}/activity`;
      setActivity(await requestJson<AgentActivity>(path));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const sendMessage = async () => {
    if (!plan || !messageContent.trim()) return;
    setBusy('message');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: messageContent,
          target_task_ids: messageTarget ? [messageTarget] : [],
        }),
      });
      setMessageContent('');
      await refreshPlan();
      if (selectedActivityId) await loadActivity(selectedActivityId);
      showNotice(t('messageSent'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const generateManagerDraft = async () => {
    const errors = [];
    if (!projectPath.trim()) errors.push(t('validationProject'));
    if (!goal.trim()) errors.push(t('validationGoal'));
    if (!supervisor) errors.push(t('validationTaskAgent'));
    setValidationErrors(errors);
    if (errors.length) return;
    setBusy('manager');
    setError('');
    try {
      const report = await requestJson<ManagerReport>('/orchestration/draft', {
        method: 'POST',
        body: JSON.stringify({
          project_path: projectPath,
          goal,
          manager_agent_id: supervisor,
          worker_agent_ids: callableAgents.map((agent) => agent.id),
          language,
          max_tasks: Math.min(6, Math.max(3, callableAgents.length + 1)),
        }),
      });
      setManagerReport(report);
      setPlan(null);
      setResultReport(null);
      setTasks(report.tasks.map((task) => ({
        ...task,
        read_paths: task.read_paths.join('\n'),
        write_paths: task.write_paths.join('\n'),
        depends_on: task.depends_on.join('\n'),
      })));
      setAdvancedOpen(false);
      showNotice(report.mode === 'agent' ? t('managerPlanReady') : t('managerFallbackReady'));
      window.setTimeout(() => document.getElementById('manager-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showNotice(t('copySuccess'));
  };

  const copyPrompt = async (taskId: string) => {
    if (!plan) return;
    try {
      const data = await requestJson<{ prompt: string }>(`/orchestration/plans/${plan.plan_id}/tasks/${taskId}/prompt`);
      await copyText(data.prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const copySupervisorPrompt = async () => {
    if (!plan) return;
    try {
      const data = await requestJson<{ prompt: string }>(`/orchestration/plans/${plan.plan_id}/supervisor-prompt`);
      await copyText(data.prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const startTaskRequest = async (taskId: string) => {
    if (!plan) return;
    await requestJson(`/orchestration/plans/${plan.plan_id}/tasks/${taskId}/start`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  };

  const startTask = async (taskId: string) => {
    if (!plan || !window.confirm(t('confirmStartTask'))) return;
    setBusy(taskId);
    setError('');
    try {
      await startTaskRequest(taskId);
      await refreshPlan();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const cancelTask = async (taskId: string) => {
    if (!plan || !window.confirm(t('confirmCancelTask'))) return;
    setBusy(`cancel-${taskId}`);
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/tasks/${taskId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await refreshPlan();
      if (selectedActivityId === taskId) await loadActivity(taskId);
      showNotice(t('taskCancelled'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const startCurrentWave = async (requireConfirmation = true) => {
    if (!plan || !launchableWaveTasks.length || (requireConfirmation && !window.confirm(t('confirmStartWave')))) return;
    setBusy('wave');
    setError('');
    try {
      await Promise.all(launchableWaveTasks.map((task) => startTaskRequest(task.task_id)));
      await refreshPlan();
      showNotice(t('waveStarted'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setAutoRun(false);
      await refreshPlan();
    } finally {
      setBusy('');
    }
  };

  const toggleAutoRun = () => {
    if (autoRun) {
      setAutoRun(false);
      return;
    }
    if (!plan || !window.confirm(t('confirmAutoRun'))) return;
    setAutoRun(true);
  };

  const sendAdvice = async () => {
    if (!plan || !advice.trim()) return;
    setBusy('advice');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/advice`, {
        method: 'POST',
        body: JSON.stringify({ content: advice, target_task_ids: [] }),
      });
      setAdvice('');
      await refreshPlan();
      showNotice(t('adviceSent'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const startSupervisor = async () => {
    if (!plan || !window.confirm(t('confirmSupervisor'))) return;
    setBusy('supervisor');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/supervisor/start`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await refreshPlan();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const cancelSupervisor = async () => {
    if (!plan || !window.confirm(t('confirmCancelSupervisor'))) return;
    setBusy('cancel-supervisor');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/supervisor/cancel`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await refreshPlan();
      if (selectedActivityId === '__supervisor__') await loadActivity('__supervisor__');
      showNotice(t('supervisorCancelled'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const decideAcceptance = async (accepted: boolean) => {
    if (!plan || !window.confirm(accepted ? t('confirmAccept') : t('confirmReject'))) return;
    setBusy('acceptance');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/acceptance`, {
        method: 'POST',
        body: JSON.stringify({ accepted, note: acceptanceNote }),
      });
      await refreshPlan();
      showNotice(accepted ? t('resultAccepted') : t('resultRejected'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const downloadResult = async () => {
    if (!plan) return;
    setBusy('export');
    setError('');
    try {
      const exported = await requestJson<{ filename: string; content: string }>(`/orchestration/plans/${plan.plan_id}/export`);
      const url = URL.createObjectURL(new Blob([exported.content], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      showNotice(t('reportDownloaded'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const toggleArchivePlan = async () => {
    if (!plan || !window.confirm(plan.archived ? t('confirmRestore') : t('confirmArchive'))) return;
    setBusy('archive');
    setError('');
    try {
      const updated = await requestJson<Plan>(`/orchestration/plans/${plan.plan_id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archived: !plan.archived }),
      });
      setPlan(updated);
      await loadPlans();
      showNotice(updated.archived ? t('planArchived') : t('planRestored'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const deletePlan = async () => {
    if (!plan || !window.confirm(t('confirmDeletePlan'))) return;
    setBusy('delete');
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}`, { method: 'DELETE' });
      resetDraft();
      await loadPlans();
      showNotice(t('planDeleted'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const resetDraft = () => {
    const defaultAgent = callableAgents[0]?.id || '';
    setGoal('');
    setTasks([newTask(1, defaultAgent), newTask(2, callableAgents[1]?.id || defaultAgent)]);
    setPlan(null);
    setManagerReport(null);
    setAdvancedOpen(false);
    setSelectedActivityId('');
    setActivity(null);
    setResultReport(null);
    setAcceptanceNote('');
    setAutoRun(false);
    setValidationErrors([]);
    setError('');
  };

  const loadStarter = () => {
    const first = callableAgents[0]?.id || '';
    const second = callableAgents[1]?.id || first;
    setGoal(language === 'zh' ? '完善用户登录流程并验证前后端边界' : 'Improve the user login flow and verify frontend/backend boundaries');
    setTasks([
      {
        ...newTask(1, first),
        title: language === 'zh' ? '后端认证与测试' : 'Backend authentication and tests',
        instructions: language === 'zh' ? '完善认证 API，补充测试并报告验证结果。' : 'Improve the authentication API, add tests, and report verification results.',
        read_paths: 'backend/main.py\nbackend/schemas.py',
        write_paths: 'backend/core/auth.py\nbackend/tests/test_auth.py',
      },
      {
        ...newTask(2, second),
        title: language === 'zh' ? '前端登录体验' : 'Frontend login experience',
        instructions: language === 'zh' ? '完善登录页面状态、错误提示与可访问性。' : 'Improve login states, error feedback, and accessibility.',
        read_paths: '内阁-ai-app/src/',
        write_paths: '内阁-ai-app/src/',
        depends_on: 'task-1',
      },
    ]);
    setValidationErrors([]);
    setManagerReport(null);
    setPlan(null);
    setAdvancedOpen(true);
    setSelectedActivityId('');
    setActivity(null);
    setResultReport(null);
    setAcceptanceNote('');
    setAutoRun(false);
    showNotice(t('draftLoaded'));
  };

  const formatTime = (value?: string) => {
    if (!value) return '';
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  };

  const eventDetail = (event: Plan['events'][number]) => {
    const content = event.payload.content;
    if (typeof content === 'string') return content;
    const taskId = event.payload.task_id;
    const status = event.payload.status;
    if (taskId) return `${String(taskId)}${status ? ` · ${String(status)}` : ''}`;
    return '';
  };

  const taskReadiness = (task: PlanTask) => {
    if (task.status === 'running') return t('runningNow');
    if (task.status === 'completed') return t('completedAlready');
    if (['failed', 'cancelled'].includes(task.status)) return t('retryAvailable');
    if (task.depends_on.some((id) => plan?.tasks.find((item) => item.task_id === id)?.status !== 'completed')) return t('blockedByDependency');
    if (plan?.tasks.some((item) => item.wave < task.wave && item.status !== 'completed')) return t('blockedByWave');
    return t('readyToRun');
  };

  const statusTone = (status: string) =>
    status === 'completed' || status === 'callable' || status === 'accepted'
      ? 'good'
      : status === 'running'
        ? 'active'
        : status === 'failed' || status === 'needs_attention' || status === 'rejected'
          ? 'bad'
          : 'muted';

  const StatusPill = ({ status }: { status: string }) => (
    <span className={`status-pill ${statusTone(status)}`}>{statusLabels[status] || status || t('statusUnknown')}</span>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><GitMerge size={19} /></div>
          <div>
            <strong>{t('appName')}</strong>
            <span>{t('appTagline')}</span>
          </div>
        </div>
        <div className="topbar-right">
          <span><ShieldCheck size={15} /> {t('declareFirst')}</span>
          <span><LockKeyhole size={15} /> {t('fileLocks')}</span>
          <button className="ghost-button" onClick={() => setLanguage((current) => (current === 'zh' ? 'en' : 'zh'))}>
            <Languages size={15} /> {t('switchLanguage')}
          </button>
          <button className="ghost-button" disabled={busy === 'agents'} onClick={() => void loadAgents(true)}>
            <RefreshCw size={15} /> {t('refreshAgents')}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{t('heroEyebrow')}</span>
          <h1>{t('heroTitle')}<br /><em>{t('heroAccent')}</em></h1>
          <p>{t('heroDescription')}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => document.getElementById('plan-form')?.scrollIntoView({ behavior: 'smooth' })}>
              <Zap size={16} /> {t('newPlan')}
            </button>
            <button className="ghost-button" onClick={loadStarter}><Sparkles size={15} /> {t('useStarter')}</button>
          </div>
        </div>
        <div className="hero-proof">
          <div><Users /><strong>{callableAgents.length}</strong><span>{t('callableAgents')}</span></div>
          <div><Waves /><strong>{plan?.waves.length || 0}</strong><span>{t('executionWaves')}</span></div>
          <div><LockKeyhole /><strong>{Object.keys(plan?.locks || {}).length}</strong><span>{t('activeLocks')}</span></div>
        </div>
      </section>

      {notice && <div className="toast"><Check size={15} />{notice}</div>}
      {error && <div className="error-banner"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Close"><X size={15} /></button></div>}

      <div className="workspace">
        <aside className="sidebar">
          <section className="agent-panel panel">
            <div className="panel-heading">
              <div><Bot size={18} /><strong>{t('localAgents')}</strong></div>
              <span>{agents.length} {t('detected')}</span>
            </div>
            <div className="agent-list">
              {agents.map((agent) => (
                <article className={`agent-card ${agent.status === 'callable' ? 'callable' : ''}`} key={agent.id}>
                  <div className="agent-icon"><Bot size={17} /></div>
                  <div className="agent-info">
                    <strong>{agent.name}</strong>
                    <span title={agent.executablePath || agent.id}>{agent.executablePath || agent.id}</span>
                    <div>{agent.capabilities.map((item) => <small key={item}>{item}</small>)}</div>
                    {agent.status !== 'not_installed' && (
                      <button
                        className="ghost-button agent-test"
                        disabled={agentTests[agent.id]?.state === 'testing'}
                        onClick={() => void testAgentConnection(agent.id)}
                      >
                        <Plug size={13} />
                        {agentTests[agent.id]?.state === 'testing'
                          ? t('testing')
                          : agentTests[agent.id]?.state === 'ok'
                            ? t('connectionOk')
                            : agentTests[agent.id]?.state === 'fail'
                              ? t('connectionFailed')
                              : t('testConnection')}
                      </button>
                    )}
                    {agentTests[agent.id]?.detail && (
                      <small className={`agent-test-detail ${agentTests[agent.id]?.state}`} title={agentTests[agent.id]?.detail}>
                        {agentTests[agent.id]?.detail}
                      </small>
                    )}
                  </div>
                  <StatusPill status={agent.status} />
                </article>
              ))}
              {!agents.length && <div className="empty-state"><RefreshCw size={18} /><span>{t('noCallableAgents')}</span></div>}
            </div>
          </section>

          <section className="history-panel panel">
            <div className="panel-heading">
              <div><History size={17} /><strong>{t('recentPlans')}</strong></div>
              <div className="heading-actions">
                <button className={`icon-button ${showArchived ? 'active' : ''}`} onClick={() => { const next = !showArchived; setShowArchived(next); void loadPlans(next); }} aria-label={showArchived ? t('hideArchived') : t('showArchived')} title={showArchived ? t('hideArchived') : t('showArchived')}><Archive size={14} /></button>
                <button className="icon-button" onClick={() => void loadPlans()} aria-label={t('refresh')}><RefreshCw size={14} /></button>
              </div>
            </div>
            <div className="history-list">
              {recentPlans.slice(0, 6).map((item) => (
                <button className={plan?.plan_id === item.plan_id ? 'active' : ''} key={item.plan_id} onClick={() => void refreshPlan(item.plan_id)}>
                  <span><FolderGit2 size={14} /><strong>{item.goal || item.plan_id}</strong></span>
                  <small><StatusPill status={item.status} />{item.archived && <span className="archive-label">{t('archived')}</span>}{formatTime(item.updated_at || item.created_at)}</small>
                  <ArrowRight size={13} />
                </button>
              ))}
              {!recentPlans.length && <div className="empty-state compact"><Clock3 size={16} /><span>{t('noRecentPlans')}</span></div>}
            </div>
          </section>
        </aside>

        <section className="planner">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">{t('planWorkspace')}</span>
              <strong>{goal || t('newPlan')}</strong>
            </div>
            <button className="ghost-button" onClick={resetDraft}><RotateCcw size={14} />{t('newPlan')}</button>
          </div>

          <div className="panel plan-form" id="plan-form">
            <div className="panel-heading">
              <div><FolderGit2 size={18} /><strong>{t('stepProject')}</strong></div>
              <span>{t('projectHint')}</span>
            </div>
            <div className="form-grid">
              <label>{t('projectPath')}<input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} /></label>
              <label>{t('managerAgent')}
                <select value={supervisor} onChange={(event) => setSupervisor(event.target.value)}>
                  <option value="">{t('noSupervisor')}</option>
                  {callableAgents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
                </select>
              </label>
              <label className="wide">{t('userGoal')}<textarea rows={3} value={goal} onChange={(event) => { setGoal(event.target.value); setValidationErrors([]); }} placeholder={t('goalPlaceholder')} /></label>
            </div>
            <div className="manager-callout">
              <div><BrainCircuit size={20} /><span><strong>{t('managerAgent')}</strong><small>{t('autoPlanDescription')}</small></span></div>
              <button className="primary-button" disabled={busy === 'manager' || !callableAgents.length} onClick={() => void generateManagerDraft()}>
                {busy === 'manager' ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                {busy === 'manager' ? t('autoPlanning') : t('autoPlan')}
              </button>
            </div>
            <div className="form-footer">
              <button className="text-button" onClick={loadStarter}><Sparkles size={14} />{t('useStarter')}</button>
              <button className="text-button" onClick={resetDraft}><Trash2 size={14} />{t('clearDraft')}</button>
            </div>
          </div>

          {activeManagerReport && (
            <div className="panel manager-report" id="manager-report">
              <div className="panel-heading">
                <div><BrainCircuit size={18} /><strong>{t('managerReport')}</strong><span className={`status-pill ${activeManagerReport.mode === 'agent' ? 'good' : 'bad'}`}>{activeManagerReport.mode === 'agent' ? t('agentPlan') : t('fallbackPlan')}</span></div>
                <button className="ghost-button" onClick={() => setAdvancedOpen((current) => !current)}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>
              </div>
              <div className="report-summary">
                <div className="report-analysis">
                  <span>{t('managerAnalysis')}</span>
                  <p>{activeManagerReport.analysis}</p>
                </div>
                <div className="project-facts">
                  <span>{t('projectSummary')}</span>
                  <strong>{activeManagerReport.project_summary.project_name || projectPath}</strong>
                  <small>{activeManagerReport.project_summary.readable_files || 0} files · {activeManagerReport.tasks.length} tasks</small>
                  <div>{Object.entries(activeManagerReport.project_summary.languages || {}).slice(0, 5).map(([name, count]) => <em key={name}>{name} {count}</em>)}</div>
                </div>
              </div>
              <div className="report-columns">
                <div><strong><CheckCircle2 size={15} />{t('acceptanceCriteria')}</strong>{activeManagerReport.acceptance_criteria.map((item) => <p key={item}>{item}</p>)}</div>
                <div><strong><Sparkles size={15} />{t('managerRecommendations')}</strong>{activeManagerReport.recommendations.map((item) => <p key={item}>{item}</p>)}</div>
                <div className={activeManagerReport.risks.length ? 'risk-column' : ''}><strong><AlertTriangle size={15} />{t('managerRisks')}</strong>{activeManagerReport.risks.map((item) => <p key={item}>{item}</p>)}</div>
              </div>
              <div className="report-actions">
                <button className="ghost-button" onClick={() => setAdvancedOpen((current) => !current)}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>
                {managerReport && <button className="primary-button" disabled={busy === 'create'} onClick={() => void createPlan()}>{busy === 'create' ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}{t('approvePlan')}</button>}
              </div>
            </div>
          )}

          <div className="panel task-builder">
            <div className="panel-heading">
              <div><GitMerge size={18} /><strong>{activeManagerReport ? t('stepTasks') : t('advancedEditor')}</strong></div>
              <div className="heading-actions"><span>{activeManagerReport ? t('taskHint') : t('advancedHint')}</span><button className="ghost-button" onClick={() => setAdvancedOpen((current) => !current)}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>{advancedOpen && <button className="ghost-button" onClick={() => setTasks((current) => [...current, newTask(current.length + 1, callableAgents[0]?.id)])}><Plus size={15} />{t('addTask')}</button>}</div>
            </div>
            {advancedOpen && (
              <>
            {callableAgents.length === 0 && <div className="inline-warning"><AlertTriangle size={16} />{t('noCallableAgents')}</div>}
            <div className="task-drafts">
              {tasks.map((task, index) => (
                <article className="task-draft" key={`${task.task_id}-${index}`}>
                  <div className="task-index">A{index + 1}</div>
                  <div className="task-fields">
                    <div className="compact-row">
                      <label>{t('taskId')}<input value={task.task_id} onChange={(event) => updateTask(index, { task_id: event.target.value })} /></label>
                      <label>{t('executorAgent')}
                        <select value={task.agent_id} onChange={(event) => updateTask(index, { agent_id: event.target.value })}>
                          <option value="">-</option>
                          {callableAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                        </select>
                      </label>
                      <label className="grow">{t('taskTitle')}<input value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder={t('taskTitlePlaceholder')} /></label>
                    </div>
                    <label>{t('taskInstructions')}<textarea rows={2} value={task.instructions} onChange={(event) => updateTask(index, { instructions: event.target.value })} placeholder={t('instructionsPlaceholder')} /></label>
                    <div className="compact-row boundaries">
                      <label><Eye size={14} />{t('allowedRead')}<textarea rows={2} value={task.read_paths} onChange={(event) => updateTask(index, { read_paths: event.target.value })} placeholder={t('pathPlaceholder')} /></label>
                      <label><FileCode2 size={14} />{t('allowedWrite')}<textarea rows={2} value={task.write_paths} onChange={(event) => updateTask(index, { write_paths: event.target.value })} placeholder={t('pathPlaceholder')} /></label>
                      <label><ChevronRight size={14} />{t('mustWait')}<textarea rows={2} value={task.depends_on} onChange={(event) => updateTask(index, { depends_on: event.target.value })} placeholder={t('dependencyPlaceholder')} /></label>
                    </div>
                  </div>
                  <button className="icon-button danger" aria-label={t('removeTask')} title={t('removeTask')} onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))}><Trash2 size={16} /></button>
                </article>
              ))}
              {!tasks.length && <div className="empty-state task-empty"><Plus size={18} /><span>{t('validationTaskRequired')}</span><button className="ghost-button" onClick={() => setTasks([newTask(1, callableAgents[0]?.id)])}>{t('addTask')}</button></div>}
            </div>
            {validationErrors.length > 0 && (
              <div className="validation-box">
                <strong><AlertTriangle size={15} />{t('validationTitle')}</strong>
                {validationErrors.map((item) => <span key={item}>{item}</span>)}
              </div>
            )}
            <button className="primary-button create-plan" disabled={busy === 'create'} onClick={() => void createPlan()}>
              {busy === 'create' ? <RefreshCw className="spin" size={17} /> : <ShieldCheck size={17} />}
              {busy === 'create' ? t('generatingPlan') : t('generatePlan')}
            </button>
              </>
            )}
          </div>

          {plan && (
            <>
              <div className="panel execution-plan" id="execution-plan">
                <div className="panel-heading">
                  <div><Waves size={18} /><strong>{t('stepExecution')}</strong><StatusPill status={plan.status} /></div>
                  <div className="heading-actions">
                    <button className={`ghost-button ${autoRun ? 'danger-button' : 'accent'}`} disabled={busy === 'wave' && !autoRun} onClick={toggleAutoRun}>
                      {autoRun ? <CircleStop size={14} /> : <Zap size={14} />}{autoRun ? t('stopAutoRun') : t('autoRun')}
                    </button>
                    <button className="ghost-button accent" disabled={!launchableWaveTasks.length || busy === 'wave' || autoRun} onClick={() => void startCurrentWave()}>
                      {busy === 'wave' ? <RefreshCw className="spin" size={14} /> : <Play size={14} />}{busy === 'wave' ? t('startingWave') : t('startWave')}
                    </button>
                    <button className="ghost-button" onClick={() => void refreshPlan()}><RefreshCw size={15} />{t('refresh')}</button>
                  </div>
                </div>
                <div className="plan-overview">
                  <div className="progress-card">
                    <span>{t('currentProgress')}</span>
                    <strong>{progress}%</strong>
                    <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
                    <small>{completedCount}/{plan.tasks.length} {t('taskComplete')}</small>
                  </div>
                  <div className="metric-card"><Waves size={16} /><span>{t('currentWave')}</span><strong>{currentWaveIndex >= 0 ? currentWaveIndex + 1 : plan.waves.length}</strong></div>
                  <div className="metric-card"><ShieldCheck size={16} /><span>{t('boundaryStatus')}</span><strong className={plan.boundary_report.ok ? 'good-text' : 'bad-text'}>{plan.boundary_report.ok ? t('boundaryClean') : t('boundaryIssue')}</strong></div>
                </div>
                <div className="shared-log"><Activity size={16} /><span>{t('sharedPlan')}</span><code title={plan.shared_plan_path}>{plan.shared_plan_path}</code></div>
                <div className="waves">
                  {plan.waves.map((wave, waveIndex) => (
                    <div className={`wave ${waveIndex === currentWaveIndex ? 'current' : ''}`} key={waveIndex}>
                      <div className="wave-label"><span>WAVE {waveIndex + 1}</span><small>{wave.length > 1 ? t('parallel') : t('singleTask')}</small></div>
                      <div className="wave-tasks">
                        {wave.map((taskId) => {
                          const task = plan.tasks.find((item) => item.task_id === taskId)!;
                          const readiness = taskReadiness(task);
                          const canStart = ['pending', 'failed', 'cancelled'].includes(task.status) && readiness !== t('blockedByDependency') && readiness !== t('blockedByWave');
                          return (
                            <article className={`plan-task ${task.status}`} key={taskId}>
                              <div className="task-title"><Bot size={17} /><strong title={task.title || task.task_id}>{task.title || task.task_id}</strong><StatusPill status={task.status} /></div>
                              <span>{agents.find((agent) => agent.id === task.agent_id)?.name || task.agent_id}</span>
                              <div className="path-summary"><Eye size={13} />{task.read_paths.length} {t('read')} <FileCode2 size={13} />{task.write_paths.length} {t('write')}</div>
                              <div className={`task-readiness ${canStart ? 'ready' : ''}`}><Clock3 size={12} /><span>{readiness}</span>{Boolean(task.attempts) && <small>{t('attempts')}: {task.attempts}</small>}</div>
                              <div className="task-actions">
                                <button onClick={() => { setSelectedActivityId(taskId); document.getElementById('agent-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Radio size={14} />{t('viewActivity')}</button>
                                <button onClick={() => void copyPrompt(taskId)}><Clipboard size={14} />{t('copyTask')}</button>
                                {task.status === 'running'
                                  ? <button className="cancel-button" disabled={busy === `cancel-${taskId}`} onClick={() => void cancelTask(taskId)}><CircleStop size={14} />{t('cancel')}</button>
                                  : <button className="start-button" disabled={busy === taskId || !canStart} onClick={() => void startTask(taskId)}><Play size={14} />{['failed', 'cancelled'].includes(task.status) ? t('retry') : t('start')}</button>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {plan.conflicts.length > 0 && (
                  <div className="conflicts">
                    <strong><AlertTriangle size={16} />{t('conflictsIsolated')} · {plan.conflicts.length}</strong>
                    {plan.conflicts.map((item) => <p key={`${item.left_task_id}-${item.right_task_id}`}><code>{item.left_task_id}</code> ↔ <code>{item.right_task_id}</code>: {item.reasons.join(' · ')}</p>)}
                  </div>
                )}
                {!plan.boundary_report.ok && (
                  <div className="boundary-violation">
                    <strong><AlertTriangle size={16} />{t('undeclaredChanges')}</strong>
                    <p>{plan.boundary_report.undeclared_changes.join(' · ')}</p>
                  </div>
                )}
              </div>

              {resultReport && (
                <div className="panel result-panel" id="result-report">
                  <div className="panel-heading">
                    <div>
                      <FileCheck2 size={18} />
                      <strong>{t('stepResult')}</strong>
                      <span className={`status-pill ${resultReport.verdict === 'ready' ? 'good' : resultReport.verdict === 'in_progress' ? 'active' : 'bad'}`}>{verdictLabels[resultReport.verdict]}</span>
                      <StatusPill status={resultReport.acceptance.status} />
                    </div>
                    <div className="heading-actions">
                      <button className="ghost-button" disabled={busy === 'export'} onClick={() => void downloadResult()}><Download size={14} />{t('exportReport')}</button>
                      <button className="ghost-button" disabled={hasRunningAgents || busy === 'archive'} onClick={() => void toggleArchivePlan()}><Archive size={14} />{plan.archived ? t('restorePlan') : t('archivePlan')}</button>
                      <button className="ghost-button danger-button" disabled={hasRunningAgents || busy === 'delete'} onClick={() => void deletePlan()}><Trash2 size={14} />{t('deletePlan')}</button>
                    </div>
                  </div>
                  <div className="result-overview">
                    <div className={`result-verdict ${resultReport.ready_for_acceptance ? 'ready' : ''}`}>
                      {resultReport.ready_for_acceptance ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                      <div><strong>{resultReport.ready_for_acceptance ? t('readyForAcceptance') : t('notReadyForAcceptance')}</strong><span>{nextActionLabels[resultReport.suggested_next_action]}</span></div>
                    </div>
                    <div className="result-metric"><span>{t('completedTasks')}</span><strong>{resultReport.summary.completed}/{resultReport.summary.total}</strong></div>
                    <div className="result-metric"><span>{t('failedTasks')}</span><strong className={resultReport.summary.failed ? 'bad-text' : 'good-text'}>{resultReport.summary.failed}</strong></div>
                    <div className="result-metric"><span>{t('changedFiles')}</span><strong>{resultReport.boundary_report.changed_paths.length}</strong></div>
                  </div>
                  <div className="result-details">
                    <div className="result-list">
                      <strong><CheckCircle2 size={14} />{t('acceptanceCriteria')}</strong>
                      {(resultReport.acceptance_criteria.length ? resultReport.acceptance_criteria : [t('noAcceptanceCriteria')]).map((item) => <p key={item}>{item}</p>)}
                    </div>
                    <div className={`result-list ${resultReport.issues.length ? 'has-issues' : ''}`}>
                      <strong><AlertTriangle size={14} />{t('issues')}</strong>
                      {resultReport.issues.map((issue) => <p key={issue.code}><b>{issueLabels[issue.code] || issue.code}</b><span>{issue.items.join(' · ')}</span></p>)}
                      {!resultReport.issues.length && <p><b>{t('noIssues')}</b></p>}
                    </div>
                  </div>
                  <div className="task-results">
                    <div className="activity-section-title"><ListChecks size={14} />{t('taskResults')}</div>
                    <div>
                      {resultReport.tasks.map((task) => (
                        <article key={task.task_id}>
                          <div><strong>{task.title || task.task_id}</strong><span>{task.task_id}</span></div>
                          <StatusPill status={task.status} />
                          <small>{t('attempts')}: {task.attempts} · {t('write')}: {task.write_paths.length}</small>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="acceptance-box">
                    <label>{t('acceptanceNote')}<textarea rows={3} value={acceptanceNote} onChange={(event) => setAcceptanceNote(event.target.value)} placeholder={t('acceptanceNotePlaceholder')} /></label>
                    <div>
                      <button className="ghost-button danger-button" disabled={hasRunningAgents || busy === 'acceptance'} onClick={() => void decideAcceptance(false)}><X size={15} />{t('rejectResult')}</button>
                      <button className="primary-button" disabled={!resultReport.ready_for_acceptance || busy === 'acceptance'} onClick={() => void decideAcceptance(true)}><Check size={15} />{t('acceptResult')}</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="panel activity-center" id="agent-activity">
                <div className="panel-heading">
                  <div><Radio size={18} /><strong>{t('agentActivity')}</strong>{activity && <StatusPill status={activity.status} />}</div>
                  <span>{t('publicOutputHint')}</span>
                </div>
                <div className="activity-tabs">
                  {plan.tasks.map((task) => (
                    <button className={selectedActivityId === task.task_id ? 'active' : ''} key={task.task_id} onClick={() => setSelectedActivityId(task.task_id)}>
                      <Bot size={14} /><span>{task.title || task.task_id}</span><StatusPill status={task.status} />
                    </button>
                  ))}
                  {plan.supervisor_agent_id && (
                    <button className={selectedActivityId === '__supervisor__' ? 'active' : ''} onClick={() => setSelectedActivityId('__supervisor__')}>
                      <ShieldCheck size={14} /><span>{t('supervisor')}</span><StatusPill status={plan.supervisor_run.status} />
                    </button>
                  )}
                </div>
                {activity ? (
                  <div className="activity-layout">
                    <div className="activity-brief">
                      <div className="activity-section-title"><ListChecks size={14} />{t('taskBrief')}</div>
                      <strong>{activity.title || t('supervisor')}</strong>
                      {activity.instructions && <p>{activity.instructions}</p>}
                      {!!activity.read_paths?.length && <div className="activity-paths"><span><Eye size={12} />{t('allowedRead')}</span>{activity.read_paths.map((path) => <code key={path}>{path}</code>)}</div>}
                      {!!activity.write_paths?.length && <div className="activity-paths"><span><FileCode2 size={12} />{t('allowedWrite')}</span>{activity.write_paths.map((path) => <code key={path}>{path}</code>)}</div>}
                      <small>{agents.find((agent) => agent.id === activity.agent_id)?.name || activity.agent_id}</small>
                    </div>
                    <div className="activity-output">
                      <div className="activity-section-title"><Terminal size={14} />{t('publicOutput')}<i className={activity.status === 'running' ? 'live-dot' : ''} /></div>
                      {activity.public_output ? <pre>{activity.public_output}</pre> : <div className="empty-state compact"><Terminal size={16} /><span>{t('noPublicOutput')}</span></div>}
                      <div className="run-history">
                        <div className="activity-section-title"><History size={13} />{t('runHistory')}</div>
                        <div>
                          {activity.run_history?.slice().reverse().map((run) => (
                            <span key={run.attempt}><strong>{t('attempt').replace('{count}', String(run.attempt))}</strong><StatusPill status={run.status} /><small>{formatTime(run.finished_at || run.started_at || undefined)}</small></span>
                          ))}
                          {!activity.run_history?.length && <small>{t('noRunHistory')}</small>}
                        </div>
                      </div>
                    </div>
                    <div className="message-stream">
                      <div className="activity-section-title"><MessageSquare size={14} />{t('messages')}</div>
                      <div className="message-list">
                        {activity.events.slice().reverse().map((event) => (
                          <article key={event.event_id}>
                            <span>{eventLabels[event.type] || event.type}</span>
                            {eventDetail(event) && <p>{eventDetail(event)}</p>}
                            <time>{formatTime(event.created_at)}</time>
                          </article>
                        ))}
                        {!activity.events.length && <div className="empty-state compact"><MessageSquare size={15} /><span>{t('noMessages')}</span></div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state"><Radio size={18} /><span>{t('noPublicOutput')}</span></div>
                )}
                <div className="message-composer">
                  <select value={messageTarget} onChange={(event) => setMessageTarget(event.target.value)}>
                    <option value="">{t('allAgents')}</option>
                    {plan.tasks.map((task) => <option value={task.task_id} key={task.task_id}>{task.title || task.task_id}</option>)}
                  </select>
                  <textarea rows={2} value={messageContent} onChange={(event) => setMessageContent(event.target.value)} placeholder={t('messagePlaceholder')} />
                  <button className="primary-button" disabled={!messageContent.trim() || busy === 'message'} onClick={() => void sendMessage()}><Send size={15} />{t('sendMessage')}</button>
                </div>
              </div>

              <div className="panel supervisor-panel">
                <div className="panel-heading">
                  <div><ShieldCheck size={18} /><strong>{t('stepSupervisor')}</strong><StatusPill status={plan.supervisor_run.status} /></div>
                  <div className="supervisor-actions">
                    <button className="ghost-button" onClick={() => void copySupervisorPrompt()}><Clipboard size={15} />{t('copyContext')}</button>
                    {plan.supervisor_run.status === 'running'
                      ? <button className="ghost-button danger-button" disabled={busy === 'cancel-supervisor'} onClick={() => void cancelSupervisor()}><CircleStop size={15} />{t('cancel')}</button>
                      : <button className="ghost-button accent" disabled={!plan.supervisor_agent_id || busy === 'supervisor'} onClick={() => void startSupervisor()}><Play size={15} />{t('startSupervisor')}</button>}
                  </div>
                </div>
                <p>{t('supervisorDescription')}</p>
                <div className="advice-box">
                  <textarea rows={3} value={advice} onChange={(event) => setAdvice(event.target.value)} placeholder={t('advicePlaceholder')} />
                  <button className="primary-button" disabled={!advice.trim() || busy === 'advice'} onClick={() => void sendAdvice()}><CheckCircle2 size={16} />{t('sendAdvice')}</button>
                </div>
                <div className="activity-heading"><Activity size={14} />{t('activity')}</div>
                <div className="event-stream">
                  {plan.events.slice(-8).reverse().map((event) => (
                    <div key={event.event_id}><Activity size={13} /><span>{event.type}</span><time>{formatTime(event.created_at)}</time></div>
                  ))}
                  {!plan.events.length && <div className="empty-state compact"><Clock3 size={15} /><span>{t('noActivity')}</span></div>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
