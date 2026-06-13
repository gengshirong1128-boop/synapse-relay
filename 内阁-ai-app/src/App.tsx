import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Eye,
  FileCode2,
  GitMerge,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';

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
};

type Plan = {
  plan_id: string;
  project_path: string;
  goal: string;
  supervisor_agent_id?: string | null;
  status: string;
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
  };
  events: Array<{ event_id: string; type: string; created_at: string; payload: Record<string, unknown> }>;
};

const statusLabels: Record<string, string> = {
  callable: '可调用',
  installed: '已安装',
  configured: '已配置',
  not_installed: '未安装',
  pending: '等待',
  running: '执行中',
  completed: '完成',
  failed: '失败',
  ready: '可执行',
  needs_attention: '需处理',
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

async function requestJson(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  return data;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed' || status === 'callable'
      ? 'good'
      : status === 'running'
        ? 'active'
        : status === 'failed' || status === 'needs_attention'
          ? 'bad'
          : 'muted';
  return <span className={`status-pill ${tone}`}>{statusLabels[status] || status}</span>;
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectPath, setProjectPath] = useState('D:\\内阁');
  const [goal, setGoal] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([newTask(1), newTask(2)]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [advice, setAdvice] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const callableAgents = useMemo(
    () => agents.filter((item) => item.status === 'callable' && launchableAgentIds.has(item.id)),
    [agents],
  );

  const loadAgents = async () => {
    setError('');
    try {
      const data = await requestJson('/orchestration/agents');
      setAgents(data.agents || []);
      const defaultId = (data.callable_agents || [])[0]?.id || '';
      setSupervisor((current) => current || defaultId);
      setTasks((current) =>
        current.map((task, index) => ({
          ...task,
          agent_id: task.agent_id || data.callable_agents?.[index % Math.max(data.callable_agents.length, 1)]?.id || defaultId,
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const refreshPlan = async () => {
    if (!plan) return;
    try {
      setPlan(await requestJson(`/orchestration/plans/${plan.plan_id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    if (!plan || plan.status === 'completed') return;
    const timer = window.setInterval(() => void refreshPlan(), 2500);
    return () => window.clearInterval(timer);
  }, [plan?.plan_id, plan?.status]);

  const updateTask = (index: number, patch: Partial<TaskDraft>) => {
    setTasks((current) => current.map((task, taskIndex) => (taskIndex === index ? { ...task, ...patch } : task)));
  };

  const createPlan = async () => {
    setBusy('create');
    setError('');
    try {
      const payload = {
        project_path: projectPath,
        goal,
        supervisor_agent_id: supervisor || null,
        tasks: tasks.map((task) => ({
          ...task,
          read_paths: splitPaths(task.read_paths),
          write_paths: splitPaths(task.write_paths),
          depends_on: splitPaths(task.depends_on),
        })),
      };
      setPlan(await requestJson('/orchestration/plans', { method: 'POST', body: JSON.stringify(payload) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const copyPrompt = async (taskId: string) => {
    const data = await requestJson(`/orchestration/plans/${plan?.plan_id}/tasks/${taskId}/prompt`);
    await navigator.clipboard.writeText(data.prompt);
  };

  const copySupervisorPrompt = async () => {
    const data = await requestJson(`/orchestration/plans/${plan?.plan_id}/supervisor-prompt`);
    await navigator.clipboard.writeText(data.prompt);
  };

  const startTask = async (taskId: string) => {
    if (!plan || !window.confirm(`确认启动 ${taskId}？Agent 将严格按已声明的读写范围执行。`)) return;
    setBusy(taskId);
    setError('');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/tasks/${taskId}/start`, {
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

  const sendAdvice = async () => {
    if (!plan || !advice.trim()) return;
    setBusy('advice');
    try {
      await requestJson(`/orchestration/plans/${plan.plan_id}/advice`, {
        method: 'POST',
        body: JSON.stringify({ content: advice, target_task_ids: [] }),
      });
      setAdvice('');
      await refreshPlan();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy('');
    }
  };

  const startSupervisor = async () => {
    if (!plan || !window.confirm('确认启动监工 Agent？监工只读取共享计划，不拥有项目写权限。')) return;
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><GitMerge size={20} /></div>
          <div>
            <strong>Agent Relay</strong>
            <span>本地 Agent 协作调度器</span>
          </div>
        </div>
        <div className="topbar-right">
          <span><ShieldCheck size={15} /> 执行前声明</span>
          <span><LockKeyhole size={15} /> 文件冲突锁</span>
          <button className="ghost-button" onClick={() => void loadAgents()}><RefreshCw size={15} /> 重新检测</button>
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">NO MORE AGENT INFORMATION GAPS</span>
          <h1>两个 Agent 同时干活，<br /><em>但永远不互相覆盖。</em></h1>
          <p>系统先检测本地 Agent，再强制声明读取、修改和依赖顺序。无冲突任务并行执行，有冲突任务自动排队，监工 Agent 全程查看共享日志并给建议。</p>
        </div>
        <div className="hero-proof">
          <div><Users /><strong>{callableAgents.length}</strong><span>可调用 Agent</span></div>
          <div><Waves /><strong>{plan?.waves.length || 0}</strong><span>执行 Wave</span></div>
          <div><LockKeyhole /><strong>{Object.keys(plan?.locks || {}).length}</strong><span>活动文件锁</span></div>
        </div>
      </section>

      {error && <div className="error-banner"><AlertTriangle size={18} />{error}</div>}

      <div className="workspace">
        <aside className="agent-panel panel">
          <div className="panel-heading">
            <div><Bot size={18} /><strong>本地 Agent</strong></div>
            <span>{agents.length} detected</span>
          </div>
          <div className="agent-list">
            {agents.map((agent) => (
              <article className={`agent-card ${agent.status === 'callable' ? 'callable' : ''}`} key={agent.id}>
                <div className="agent-icon"><Bot size={18} /></div>
                <div className="agent-info">
                  <strong>{agent.name}</strong>
                  <span>{agent.executablePath || agent.id}</span>
                  <div>{agent.capabilities.map((item) => <small key={item}>{item}</small>)}</div>
                </div>
                <StatusPill status={agent.status} />
              </article>
            ))}
          </div>
        </aside>

        <section className="planner">
          <div className="panel plan-form">
            <div className="panel-heading">
              <div><FileCode2 size={18} /><strong>1. 声明项目与总任务</strong></div>
              <span>先汇报，再执行</span>
            </div>
            <div className="form-grid">
              <label>本地项目路径<input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} /></label>
              <label>监工 Agent
                <select value={supervisor} onChange={(event) => setSupervisor(event.target.value)}>
                  <option value="">不设置监工</option>
                  {callableAgents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
                </select>
              </label>
              <label className="wide">用户任务<textarea rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例如：重构认证模块，同时更新前端登录页和后端 API，不能互相覆盖。" /></label>
            </div>
          </div>

          <div className="panel task-builder">
            <div className="panel-heading">
              <div><GitMerge size={18} /><strong>2. 分配任务与读写边界</strong></div>
              <button className="ghost-button" onClick={() => setTasks((current) => [...current, newTask(current.length + 1, callableAgents[0]?.id)])}><Plus size={15} />添加 Agent 任务</button>
            </div>
            <div className="task-drafts">
              {tasks.map((task, index) => (
                <article className="task-draft" key={`${task.task_id}-${index}`}>
                  <div className="task-index">A{index + 1}</div>
                  <div className="task-fields">
                    <div className="compact-row">
                      <label>Task ID<input value={task.task_id} onChange={(event) => updateTask(index, { task_id: event.target.value })} /></label>
                      <label>执行 Agent
                        <select value={task.agent_id} onChange={(event) => updateTask(index, { agent_id: event.target.value })}>
                          {callableAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                        </select>
                      </label>
                      <label className="grow">任务名称<input value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder="明确交付物" /></label>
                    </div>
                    <label>任务说明<textarea rows={2} value={task.instructions} onChange={(event) => updateTask(index, { instructions: event.target.value })} placeholder="这个 Agent 具体负责什么，完成标准是什么" /></label>
                    <div className="compact-row boundaries">
                      <label><Eye size={14} />允许读取<textarea rows={2} value={task.read_paths} onChange={(event) => updateTask(index, { read_paths: event.target.value })} placeholder="backend/main.py, backend/core/" /></label>
                      <label><FileCode2 size={14} />允许修改<textarea rows={2} value={task.write_paths} onChange={(event) => updateTask(index, { write_paths: event.target.value })} placeholder="backend/core/auth.py" /></label>
                      <label><ChevronRight size={14} />必须等待<textarea rows={2} value={task.depends_on} onChange={(event) => updateTask(index, { depends_on: event.target.value })} placeholder="task-1" /></label>
                    </div>
                  </div>
                  <button className="icon-button danger" onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))}><Trash2 size={16} /></button>
                </article>
              ))}
            </div>
            <button className="primary-button create-plan" disabled={busy === 'create' || !goal.trim()} onClick={() => void createPlan()}>
              {busy === 'create' ? <RefreshCw className="spin" size={17} /> : <ShieldCheck size={17} />}
              生成无冲突执行计划
            </button>
          </div>

          {plan && (
            <>
              <div className="panel execution-plan">
                <div className="panel-heading">
                  <div><Waves size={18} /><strong>3. 执行顺序</strong><StatusPill status={plan.status} /></div>
                  <button className="ghost-button" onClick={() => void refreshPlan()}><RefreshCw size={15} />刷新</button>
                </div>
                <div className="shared-log"><Activity size={16} /><span>共享计划</span><code>{plan.shared_plan_path}</code></div>
                <div className="waves">
                  {plan.waves.map((wave, waveIndex) => (
                    <div className="wave" key={waveIndex}>
                      <div className="wave-label"><span>WAVE {waveIndex + 1}</span><small>{wave.length > 1 ? '可并行' : '单任务'}</small></div>
                      <div className="wave-tasks">
                        {wave.map((taskId) => {
                          const task = plan.tasks.find((item) => item.task_id === taskId)!;
                          return (
                            <article className={`plan-task ${task.status}`} key={taskId}>
                              <div className="task-title"><Bot size={17} /><strong>{task.title || task.task_id}</strong><StatusPill status={task.status} /></div>
                              <span>{agents.find((agent) => agent.id === task.agent_id)?.name || task.agent_id}</span>
                              <div className="path-summary"><Eye size={13} />{task.read_paths.length} read <FileCode2 size={13} />{task.write_paths.length} write</div>
                              <div className="task-actions">
                                <button onClick={() => void copyPrompt(taskId)}><Clipboard size={14} />复制任务</button>
                                <button disabled={busy === taskId || !['pending', 'failed'].includes(task.status)} onClick={() => void startTask(taskId)}><Play size={14} />启动</button>
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
                    <strong><AlertTriangle size={16} />已自动隔离 {plan.conflicts.length} 组冲突</strong>
                    {plan.conflicts.map((item) => <p key={`${item.left_task_id}-${item.right_task_id}`}><code>{item.left_task_id}</code> 与 <code>{item.right_task_id}</code>：{item.reasons.join('；')}</p>)}
                  </div>
                )}
                {!plan.boundary_report.ok && (
                  <div className="boundary-violation">
                    <strong><AlertTriangle size={16} />发现未声明修改，计划已阻止完成</strong>
                    <p>{plan.boundary_report.undeclared_changes.join('；')}</p>
                  </div>
                )}
              </div>

              <div className="panel supervisor-panel">
                <div className="panel-heading">
                  <div><ShieldCheck size={18} /><strong>4. 监工建议</strong><StatusPill status={plan.supervisor_run.status} /></div>
                  <div className="supervisor-actions">
                    <button className="ghost-button" onClick={() => void copySupervisorPrompt()}><Clipboard size={15} />复制上下文</button>
                    <button className="ghost-button supervisor-start" disabled={!plan.supervisor_agent_id || plan.supervisor_run.status === 'running' || busy === 'supervisor'} onClick={() => void startSupervisor()}><Play size={15} />启动监工检查</button>
                  </div>
                </div>
                <p>监工只读取共享计划和运行状态，不直接修改项目文件。建议会同步进每个 Agent 的后续任务上下文。</p>
                <div className="advice-box">
                  <textarea rows={3} value={advice} onChange={(event) => setAdvice(event.target.value)} placeholder="例如：task-2 在 task-1 完成 schema 后再启动；两个 Agent 都必须运行对应测试。" />
                  <button className="primary-button" disabled={!advice.trim() || busy === 'advice'} onClick={() => void sendAdvice()}><CheckCircle2 size={16} />写入共享建议</button>
                </div>
                <div className="event-stream">
                  {plan.events.slice(-6).reverse().map((event) => (
                    <div key={event.event_id}><Activity size={13} /><span>{event.type}</span><time>{new Date(event.created_at).toLocaleTimeString()}</time></div>
                  ))}
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
