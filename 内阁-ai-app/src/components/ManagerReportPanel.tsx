import { AlertTriangle, BrainCircuit, CheckCircle2, ListChecks, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { AppTranslator, ManagerReport } from '../types';

type ManagerReportPanelProps = {
  advancedOpen: boolean;
  busy: string;
  managerReport: ManagerReport | null;
  projectPath: string;
  report: ManagerReport;
  t: AppTranslator;
  onCreatePlan: () => void;
  onToggleAdvanced: () => void;
};

export function ManagerReportPanel({
  advancedOpen,
  busy,
  managerReport,
  onCreatePlan,
  onToggleAdvanced,
  projectPath,
  report,
  t,
}: ManagerReportPanelProps) {
  return (
    <div className="panel manager-report" id="manager-report">
      <div className="panel-heading">
        <div>
          <BrainCircuit size={18} />
          <strong>{t('managerReport')}</strong>
          <span className={`status-pill ${report.mode === 'agent' ? 'good' : 'bad'}`}>{report.mode === 'agent' ? t('agentPlan') : t('fallbackPlan')}</span>
        </div>
        <button className="ghost-button" onClick={onToggleAdvanced}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>
      </div>
      <div className="report-summary">
        <div className="report-analysis">
          <span>{t('managerAnalysis')}</span>
          <p>{report.analysis}</p>
        </div>
        <div className="project-facts">
          <span>{t('projectSummary')}</span>
          <strong>{report.project_summary.project_name || projectPath}</strong>
          <small>{report.project_summary.readable_files || 0} files · {report.tasks.length} tasks</small>
          <div>{Object.entries(report.project_summary.languages || {}).slice(0, 5).map(([name, count]) => <em key={name}>{name} {count}</em>)}</div>
        </div>
      </div>
      <div className="report-columns">
        <div><strong><CheckCircle2 size={15} />{t('acceptanceCriteria')}</strong>{report.acceptance_criteria.map((item) => <p key={item}>{item}</p>)}</div>
        <div><strong><Sparkles size={15} />{t('managerRecommendations')}</strong>{report.recommendations.map((item) => <p key={item}>{item}</p>)}</div>
        <div className={report.risks.length ? 'risk-column' : ''}><strong><AlertTriangle size={15} />{t('managerRisks')}</strong>{report.risks.map((item) => <p key={item}>{item}</p>)}</div>
      </div>
      <div className="report-actions">
        <button className="ghost-button" onClick={onToggleAdvanced}><ListChecks size={15} />{advancedOpen ? t('hideTasks') : t('reviewTasks')}</button>
        {managerReport && (
          <button className="primary-button" disabled={busy === 'create'} onClick={onCreatePlan}>
            {busy === 'create' ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
            {t('approvePlan')}
          </button>
        )}
      </div>
    </div>
  );
}
