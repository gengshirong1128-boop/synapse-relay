import { AlertTriangle, Archive, Check, CheckCircle2, Download, FileCheck2, ListChecks, Trash2, X } from 'lucide-react';
import type { AppTranslator, Plan, ResultReport, StatusPillConfig } from '../types';
import { StatusPill } from './StatusPill';

type ResultReportPanelProps = StatusPillConfig & {
  acceptanceNote: string;
  busy: string;
  hasRunningAgents: boolean;
  issueLabels: Record<string, string>;
  nextActionLabels: Record<string, string>;
  plan: Plan;
  resultReport: ResultReport;
  t: AppTranslator;
  verdictLabels: Record<string, string>;
  onDecideAcceptance: (accepted: boolean) => void;
  onDeletePlan: () => void;
  onDownloadResult: () => void;
  onSetAcceptanceNote: (value: string) => void;
  onToggleArchivePlan: () => void;
};

export function ResultReportPanel({
  acceptanceNote,
  busy,
  hasRunningAgents,
  issueLabels,
  nextActionLabels,
  onDecideAcceptance,
  onDeletePlan,
  onDownloadResult,
  onSetAcceptanceNote,
  onToggleArchivePlan,
  plan,
  resultReport,
  statusLabels,
  statusUnknownLabel,
  t,
  verdictLabels,
}: ResultReportPanelProps) {
  const statusPillConfig = { statusLabels, statusUnknownLabel };

  return (
    <div className="panel result-panel" id="result-report">
      <div className="panel-heading">
        <div>
          <FileCheck2 size={18} />
          <strong>{t('stepResult')}</strong>
          <span className={`status-pill ${resultReport.verdict === 'ready' ? 'good' : resultReport.verdict === 'in_progress' ? 'active' : 'bad'}`}>{verdictLabels[resultReport.verdict]}</span>
          <StatusPill status={resultReport.acceptance.status} {...statusPillConfig} />
        </div>
        <div className="heading-actions">
          <button className="ghost-button" disabled={busy === 'export'} onClick={onDownloadResult}><Download size={14} />{t('exportReport')}</button>
          <button className="ghost-button" disabled={hasRunningAgents || busy === 'archive'} onClick={onToggleArchivePlan}><Archive size={14} />{plan.archived ? t('restorePlan') : t('archivePlan')}</button>
          <button className="ghost-button danger-button" disabled={hasRunningAgents || busy === 'delete'} onClick={onDeletePlan}><Trash2 size={14} />{t('deletePlan')}</button>
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
              <StatusPill status={task.status} {...statusPillConfig} />
              <small>{t('attempts')}: {task.attempts} · {t('write')}: {task.write_paths.length}</small>
            </article>
          ))}
        </div>
      </div>
      <div className="acceptance-box">
        <label>{t('acceptanceNote')}<textarea rows={3} value={acceptanceNote} onChange={(event) => onSetAcceptanceNote(event.target.value)} placeholder={t('acceptanceNotePlaceholder')} /></label>
        <div>
          <button className="ghost-button danger-button" disabled={hasRunningAgents || busy === 'acceptance'} onClick={() => onDecideAcceptance(false)}><X size={15} />{t('rejectResult')}</button>
          <button className="primary-button" disabled={!resultReport.ready_for_acceptance || busy === 'acceptance'} onClick={() => onDecideAcceptance(true)}><Check size={15} />{t('acceptResult')}</button>
        </div>
      </div>
    </div>
  );
}
