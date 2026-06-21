import { Activity, AlertTriangle, Bot, CircleStop, Clipboard, Clock3, Eye, FileCode2, Play, Radio, RefreshCw, ShieldCheck, Waves, Zap } from 'lucide-react';
import type { Agent, AppTranslator, Plan, PlanTask, StatusPillConfig } from '../types';
import { StatusPill } from './StatusPill';

type ExecutionPlanPanelProps = StatusPillConfig & {
  agents: Agent[];
  autoRun: boolean;
  busy: string;
  completedCount: number;
  currentWaveIndex: number;
  launchableWaveTasks: PlanTask[];
  plan: Plan;
  progress: number;
  t: AppTranslator;
  taskReadiness: (task: PlanTask) => string;
  onCancelTask: (taskId: string) => void;
  onCopyPrompt: (taskId: string) => void;
  onRefreshPlan: () => void;
  onSelectActivity: (taskId: string) => void;
  onStartCurrentWave: () => void;
  onStartTask: (taskId: string) => void;
  onToggleAutoRun: () => void;
};

export function ExecutionPlanPanel({
  agents,
  autoRun,
  busy,
  completedCount,
  currentWaveIndex,
  launchableWaveTasks,
  onCancelTask,
  onCopyPrompt,
  onRefreshPlan,
  onSelectActivity,
  onStartCurrentWave,
  onStartTask,
  onToggleAutoRun,
  plan,
  progress,
  statusLabels,
  statusUnknownLabel,
  t,
  taskReadiness,
}: ExecutionPlanPanelProps) {
  const statusPillConfig = { statusLabels, statusUnknownLabel };

  return (
    <div className="panel execution-plan" id="execution-plan">
      <div className="panel-heading">
        <div><Waves size={18} /><strong>{t('stepExecution')}</strong><StatusPill status={plan.status} {...statusPillConfig} /></div>
        <div className="heading-actions">
          <button className={`ghost-button ${autoRun ? 'danger-button' : 'accent'}`} disabled={busy === 'wave' && !autoRun} onClick={onToggleAutoRun}>
            {autoRun ? <CircleStop size={14} /> : <Zap size={14} />}{autoRun ? t('stopAutoRun') : t('autoRun')}
          </button>
          <button className="ghost-button accent" disabled={!launchableWaveTasks.length || busy === 'wave' || autoRun} onClick={onStartCurrentWave}>
            {busy === 'wave' ? <RefreshCw className="spin" size={14} /> : <Play size={14} />}{busy === 'wave' ? t('startingWave') : t('startWave')}
          </button>
          <button className="ghost-button" onClick={onRefreshPlan}><RefreshCw size={15} />{t('refresh')}</button>
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
                    <div className="task-title"><Bot size={17} /><strong title={task.title || task.task_id}>{task.title || task.task_id}</strong><StatusPill status={task.status} {...statusPillConfig} /></div>
                    <span>{agents.find((agent) => agent.id === task.agent_id)?.name || task.agent_id}</span>
                    <div className="path-summary"><Eye size={13} />{task.read_paths.length} {t('read')} <FileCode2 size={13} />{task.write_paths.length} {t('write')}</div>
                    <div className={`task-readiness ${canStart ? 'ready' : ''}`}><Clock3 size={12} /><span>{readiness}</span>{Boolean(task.attempts) && <small>{t('attempts')}: {task.attempts}</small>}</div>
                    <div className="task-actions">
                      <button onClick={() => onSelectActivity(taskId)}><Radio size={14} />{t('viewActivity')}</button>
                      <button onClick={() => onCopyPrompt(taskId)}><Clipboard size={14} />{t('copyTask')}</button>
                      {task.status === 'running'
                        ? <button className="cancel-button" disabled={busy === `cancel-${taskId}`} onClick={() => onCancelTask(taskId)}><CircleStop size={14} />{t('cancel')}</button>
                        : <button className="start-button" disabled={busy === taskId || !canStart} onClick={() => onStartTask(taskId)}><Play size={14} />{['failed', 'cancelled'].includes(task.status) ? t('retry') : t('start')}</button>}
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
  );
}
