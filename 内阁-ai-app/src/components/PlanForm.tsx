import { BrainCircuit, FolderGit2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { Agent, AppTranslator } from '../types';

type PlanFormProps = {
  busy: string;
  callableAgents: Agent[];
  goal: string;
  projectPath: string;
  supervisor: string;
  t: AppTranslator;
  onClearValidationErrors: () => void;
  onGenerateManagerDraft: () => void;
  onLoadStarter: () => void;
  onResetDraft: () => void;
  onSetGoal: (value: string) => void;
  onSetProjectPath: (value: string) => void;
  onSetSupervisor: (value: string) => void;
};

export function PlanForm({
  busy,
  callableAgents,
  goal,
  onClearValidationErrors,
  onGenerateManagerDraft,
  onLoadStarter,
  onResetDraft,
  onSetGoal,
  onSetProjectPath,
  onSetSupervisor,
  projectPath,
  supervisor,
  t,
}: PlanFormProps) {
  return (
    <div className="panel plan-form" id="plan-form">
      <div className="panel-heading">
        <div><FolderGit2 size={18} /><strong>{t('stepProject')}</strong></div>
        <span>{t('projectHint')}</span>
      </div>
      <div className="form-grid">
        <label>{t('projectPath')}<input value={projectPath} onChange={(event) => onSetProjectPath(event.target.value)} /></label>
        <label>{t('managerAgent')}
          <select value={supervisor} onChange={(event) => onSetSupervisor(event.target.value)}>
            <option value="">{t('noSupervisor')}</option>
            {callableAgents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <label className="wide">
          {t('userGoal')}
          <textarea
            rows={3}
            value={goal}
            onChange={(event) => {
              onSetGoal(event.target.value);
              onClearValidationErrors();
            }}
            placeholder={t('goalPlaceholder')}
          />
        </label>
      </div>
      <div className="manager-callout">
        <div><BrainCircuit size={20} /><span><strong>{t('managerAgent')}</strong><small>{t('autoPlanDescription')}</small></span></div>
        <button className="primary-button" disabled={busy === 'manager' || !callableAgents.length} onClick={onGenerateManagerDraft}>
          {busy === 'manager' ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
          {busy === 'manager' ? t('autoPlanning') : t('autoPlan')}
        </button>
      </div>
      <div className="form-footer">
        <button className="text-button" onClick={onLoadStarter}><Sparkles size={14} />{t('useStarter')}</button>
        <button className="text-button" onClick={onResetDraft}><Trash2 size={14} />{t('clearDraft')}</button>
      </div>
    </div>
  );
}
