import { AlertTriangle, ChevronRight, Eye, FileCode2, GitMerge, ListChecks, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { Agent, AppTranslator, ManagerReport, TaskDraft } from '../types';

type TaskDraftEditorProps = {
  activeManagerReport: ManagerReport | null;
  advancedOpen: boolean;
  busy: string;
  callableAgents: Agent[];
  tasks: TaskDraft[];
  t: AppTranslator;
  validationErrors: string[];
  onAddTask: () => void;
  onCreatePlan: () => void;
  onRemoveTask: (index: number) => void;
  onSetInitialTask: () => void;
  onToggleAdvanced: () => void;
  onUpdateTask: (index: number, patch: Partial<TaskDraft>) => void;
};

export function TaskDraftEditor({
  activeManagerReport,
  advancedOpen,
  busy,
  callableAgents,
  onAddTask,
  onCreatePlan,
  onRemoveTask,
  onSetInitialTask,
  onToggleAdvanced,
  onUpdateTask,
  tasks,
  t,
  validationErrors,
}: TaskDraftEditorProps) {
  return (
    <div className="panel task-builder">
      <div className="panel-heading">
        <div><GitMerge size={18} /><strong>{activeManagerReport ? t('stepTasks') : t('advancedEditor')}</strong></div>
        <div className="heading-actions">
          <span>{activeManagerReport ? t('taskHint') : t('advancedHint')}</span>
          <button className="ghost-button" onClick={onToggleAdvanced}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>
          {advancedOpen && <button className="ghost-button" onClick={onAddTask}><Plus size={15} />{t('addTask')}</button>}
        </div>
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
                    <label>{t('taskId')}<input value={task.task_id} onChange={(event) => onUpdateTask(index, { task_id: event.target.value })} /></label>
                    <label>{t('executorAgent')}
                      <select value={task.agent_id} onChange={(event) => onUpdateTask(index, { agent_id: event.target.value })}>
                        <option value="">-</option>
                        {callableAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                      </select>
                    </label>
                    <label className="grow">{t('taskTitle')}<input value={task.title} onChange={(event) => onUpdateTask(index, { title: event.target.value })} placeholder={t('taskTitlePlaceholder')} /></label>
                  </div>
                  <label>{t('taskInstructions')}<textarea rows={2} value={task.instructions} onChange={(event) => onUpdateTask(index, { instructions: event.target.value })} placeholder={t('instructionsPlaceholder')} /></label>
                  <div className="compact-row boundaries">
                    <label><Eye size={14} />{t('allowedRead')}<textarea rows={2} value={task.read_paths} onChange={(event) => onUpdateTask(index, { read_paths: event.target.value })} placeholder={t('pathPlaceholder')} /></label>
                    <label><FileCode2 size={14} />{t('allowedWrite')}<textarea rows={2} value={task.write_paths} onChange={(event) => onUpdateTask(index, { write_paths: event.target.value })} placeholder={t('pathPlaceholder')} /></label>
                    <label><ChevronRight size={14} />{t('mustWait')}<textarea rows={2} value={task.depends_on} onChange={(event) => onUpdateTask(index, { depends_on: event.target.value })} placeholder={t('dependencyPlaceholder')} /></label>
                  </div>
                </div>
                <button className="icon-button danger" aria-label={t('removeTask')} title={t('removeTask')} onClick={() => onRemoveTask(index)}><Trash2 size={16} /></button>
              </article>
            ))}
            {!tasks.length && (
              <div className="empty-state task-empty">
                <Plus size={18} />
                <span>{t('validationTaskRequired')}</span>
                <button className="ghost-button" onClick={onSetInitialTask}>{t('addTask')}</button>
              </div>
            )}
          </div>
          {validationErrors.length > 0 && (
            <div className="validation-box">
              <strong><AlertTriangle size={15} />{t('validationTitle')}</strong>
              {validationErrors.map((item) => <span key={item}>{item}</span>)}
            </div>
          )}
          <button className="primary-button create-plan" disabled={busy === 'create'} onClick={onCreatePlan}>
            {busy === 'create' ? <RefreshCw className="spin" size={17} /> : <ShieldCheck size={17} />}
            {busy === 'create' ? t('generatingPlan') : t('generatePlan')}
          </button>
        </>
      )}
    </div>
  );
}
