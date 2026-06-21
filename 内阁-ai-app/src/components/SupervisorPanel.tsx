import { Activity, CheckCircle2, CircleStop, Clipboard, Clock3, Play, ShieldCheck } from 'lucide-react';
import type { AppTranslator, Plan, StatusPillConfig } from '../types';
import { StatusPill } from './StatusPill';

type SupervisorPanelProps = StatusPillConfig & {
  advice: string;
  busy: string;
  formatTime: (value?: string) => string;
  plan: Plan;
  t: AppTranslator;
  onCancelSupervisor: () => void;
  onCopySupervisorPrompt: () => void;
  onSendAdvice: () => void;
  onSetAdvice: (value: string) => void;
  onStartSupervisor: () => void;
};

export function SupervisorPanel({
  advice,
  busy,
  formatTime,
  onCancelSupervisor,
  onCopySupervisorPrompt,
  onSendAdvice,
  onSetAdvice,
  onStartSupervisor,
  plan,
  statusLabels,
  statusUnknownLabel,
  t,
}: SupervisorPanelProps) {
  const statusPillConfig = { statusLabels, statusUnknownLabel };

  return (
    <div className="panel supervisor-panel">
      <div className="panel-heading">
        <div><ShieldCheck size={18} /><strong>{t('stepSupervisor')}</strong><StatusPill status={plan.supervisor_run.status} {...statusPillConfig} /></div>
        <div className="supervisor-actions">
          <button className="ghost-button" onClick={onCopySupervisorPrompt}><Clipboard size={15} />{t('copyContext')}</button>
          {plan.supervisor_run.status === 'running'
            ? <button className="ghost-button danger-button" disabled={busy === 'cancel-supervisor'} onClick={onCancelSupervisor}><CircleStop size={15} />{t('cancel')}</button>
            : <button className="ghost-button accent" disabled={!plan.supervisor_agent_id || busy === 'supervisor'} onClick={onStartSupervisor}><Play size={15} />{t('startSupervisor')}</button>}
        </div>
      </div>
      <p>{t('supervisorDescription')}</p>
      <div className="advice-box">
        <textarea rows={3} value={advice} onChange={(event) => onSetAdvice(event.target.value)} placeholder={t('advicePlaceholder')} />
        <button className="primary-button" disabled={!advice.trim() || busy === 'advice'} onClick={onSendAdvice}><CheckCircle2 size={16} />{t('sendAdvice')}</button>
      </div>
      <div className="activity-heading"><Activity size={14} />{t('activity')}</div>
      <div className="event-stream">
        {plan.events.slice(-8).reverse().map((event) => (
          <div key={event.event_id}><Activity size={13} /><span>{event.type}</span><time>{formatTime(event.created_at)}</time></div>
        ))}
        {!plan.events.length && <div className="empty-state compact"><Clock3 size={15} /><span>{t('noActivity')}</span></div>}
      </div>
    </div>
  );
}
