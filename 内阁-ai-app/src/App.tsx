import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, RotateCcw, X } from 'lucide-react';
import { ActivityCenter } from './components/ActivityCenter';
import { AppHeader } from './components/AppHeader';
import { ExecutionPlanPanel } from './components/ExecutionPlanPanel';
import { HeroSection } from './components/HeroSection';
import { ManagerReportPanel } from './components/ManagerReportPanel';
import { PlanForm } from './components/PlanForm';
import { ResultReportPanel } from './components/ResultReportPanel';
import { Sidebar } from './components/Sidebar';
import { SupervisorPanel } from './components/SupervisorPanel';
import { TaskDraftEditor } from './components/TaskDraftEditor';
import { translations, type Language, type TranslationKey } from './translations';
import { requestJson } from './api';
import { computeProgress, currentWaveIndex as deriveCurrentWaveIndex, launchableWaveTasks as deriveLaunchableWaveTasks, pickDefaultAgentId, agentForIndex, mapAgentTestResult, type AgentTestResult } from './planLogic';
import type { Agent, AgentActivity, AgentTestState, ManagerReport, Plan, PlanTask, ResultReport, TaskDraft } from './types';

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
  const launchableWaveTasks: PlanTask[] = plan ? deriveLaunchableWaveTasks(plan.waves, plan.tasks, currentWaveIndex) : [];

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

  const statusPillConfig = { statusLabels, statusUnknownLabel: t('statusUnknown') };

  return (
    <main className="app-shell">
      <AppHeader
        busy={busy}
        t={t}
        onRefreshAgents={() => void loadAgents(true)}
        onToggleLanguage={() => setLanguage((current) => (current === 'zh' ? 'en' : 'zh'))}
      />

      <HeroSection
        callableAgentCount={callableAgents.length}
        plan={plan}
        t={t}
        onLoadStarter={loadStarter}
      />

      {notice && <div className="toast"><Check size={15} />{notice}</div>}
      {error && <div className="error-banner"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Close"><X size={15} /></button></div>}

      <div className="workspace">
        <Sidebar
          agents={agents}
          agentTests={agentTests}
          formatTime={formatTime}
          plan={plan}
          recentPlans={recentPlans}
          showArchived={showArchived}
          t={t}
          onLoadPlans={(includeArchived) => void loadPlans(includeArchived)}
          onRefreshPlan={(planId) => void refreshPlan(planId)}
          onSetShowArchived={setShowArchived}
          onTestAgentConnection={(agentId) => void testAgentConnection(agentId)}
          {...statusPillConfig}
        />

        <section className="planner">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">{t('planWorkspace')}</span>
              <strong>{goal || t('newPlan')}</strong>
            </div>
            <button className="ghost-button" onClick={resetDraft}><RotateCcw size={14} />{t('newPlan')}</button>
          </div>

          <PlanForm
            busy={busy}
            callableAgents={callableAgents}
            goal={goal}
            projectPath={projectPath}
            supervisor={supervisor}
            t={t}
            onClearValidationErrors={() => setValidationErrors([])}
            onGenerateManagerDraft={() => void generateManagerDraft()}
            onLoadStarter={loadStarter}
            onResetDraft={resetDraft}
            onSetGoal={setGoal}
            onSetProjectPath={setProjectPath}
            onSetSupervisor={setSupervisor}
          />

          {activeManagerReport && (
            <ManagerReportPanel
              advancedOpen={advancedOpen}
              busy={busy}
              managerReport={managerReport}
              projectPath={projectPath}
              report={activeManagerReport}
              t={t}
              onCreatePlan={() => void createPlan()}
              onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
            />
          )}

          <TaskDraftEditor
            activeManagerReport={activeManagerReport}
            advancedOpen={advancedOpen}
            busy={busy}
            callableAgents={callableAgents}
            tasks={tasks}
            t={t}
            validationErrors={validationErrors}
            onAddTask={() => setTasks((current) => [...current, newTask(current.length + 1, callableAgents[0]?.id)])}
            onCreatePlan={() => void createPlan()}
            onRemoveTask={(index) => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))}
            onSetInitialTask={() => setTasks([newTask(1, callableAgents[0]?.id)])}
            onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
            onUpdateTask={updateTask}
          />

          {plan && (
            <>
              <ExecutionPlanPanel
                agents={agents}
                autoRun={autoRun}
                busy={busy}
                completedCount={completedCount}
                currentWaveIndex={currentWaveIndex}
                launchableWaveTasks={launchableWaveTasks}
                plan={plan}
                progress={progress}
                t={t}
                taskReadiness={taskReadiness}
                onCancelTask={(taskId) => void cancelTask(taskId)}
                onCopyPrompt={(taskId) => void copyPrompt(taskId)}
                onRefreshPlan={() => void refreshPlan()}
                onSelectActivity={(taskId) => {
                  setSelectedActivityId(taskId);
                  document.getElementById('agent-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onStartCurrentWave={() => void startCurrentWave()}
                onStartTask={(taskId) => void startTask(taskId)}
                onToggleAutoRun={toggleAutoRun}
                {...statusPillConfig}
              />

              {resultReport && (
                <ResultReportPanel
                  acceptanceNote={acceptanceNote}
                  busy={busy}
                  hasRunningAgents={hasRunningAgents}
                  issueLabels={issueLabels}
                  nextActionLabels={nextActionLabels}
                  plan={plan}
                  resultReport={resultReport}
                  t={t}
                  verdictLabels={verdictLabels}
                  onDecideAcceptance={(accepted) => void decideAcceptance(accepted)}
                  onDeletePlan={() => void deletePlan()}
                  onDownloadResult={() => void downloadResult()}
                  onSetAcceptanceNote={setAcceptanceNote}
                  onToggleArchivePlan={() => void toggleArchivePlan()}
                  {...statusPillConfig}
                />
              )}

              <ActivityCenter
                activity={activity}
                agents={agents}
                busy={busy}
                eventDetail={eventDetail}
                eventLabels={eventLabels}
                formatTime={formatTime}
                messageContent={messageContent}
                messageTarget={messageTarget}
                plan={plan}
                selectedActivityId={selectedActivityId}
                t={t}
                onSendMessage={() => void sendMessage()}
                onSetMessageContent={setMessageContent}
                onSetMessageTarget={setMessageTarget}
                onSetSelectedActivityId={setSelectedActivityId}
                {...statusPillConfig}
              />

              <SupervisorPanel
                advice={advice}
                busy={busy}
                formatTime={formatTime}
                plan={plan}
                t={t}
                onCancelSupervisor={() => void cancelSupervisor()}
                onCopySupervisorPrompt={() => void copySupervisorPrompt()}
                onSendAdvice={() => void sendAdvice()}
                onSetAdvice={setAdvice}
                onStartSupervisor={() => void startSupervisor()}
                {...statusPillConfig}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
