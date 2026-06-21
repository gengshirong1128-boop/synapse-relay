import { Archive, ArrowRight, Bot, Clock3, FolderGit2, History, Plug, RefreshCw } from 'lucide-react';
import type { Agent, AgentTestState, AppTranslator, Plan, StatusPillConfig } from '../types';
import { StatusPill } from './StatusPill';

type SidebarProps = StatusPillConfig & {
  agents: Agent[];
  agentTests: Record<string, AgentTestState>;
  plan: Plan | null;
  recentPlans: Plan[];
  showArchived: boolean;
  t: AppTranslator;
  formatTime: (value?: string) => string;
  onLoadPlans: (includeArchived?: boolean) => void;
  onRefreshPlan: (planId?: string) => void;
  onSetShowArchived: (value: boolean) => void;
  onTestAgentConnection: (agentId: string) => void;
};

export function Sidebar({
  agents,
  agentTests,
  formatTime,
  onLoadPlans,
  onRefreshPlan,
  onSetShowArchived,
  onTestAgentConnection,
  plan,
  recentPlans,
  showArchived,
  statusLabels,
  statusUnknownLabel,
  t,
}: SidebarProps) {
  const statusPillConfig = { statusLabels, statusUnknownLabel };

  return (
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
                    onClick={() => onTestAgentConnection(agent.id)}
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
              <StatusPill status={agent.status} {...statusPillConfig} />
            </article>
          ))}
          {!agents.length && <div className="empty-state"><RefreshCw size={18} /><span>{t('noCallableAgents')}</span></div>}
        </div>
      </section>

      <section className="history-panel panel">
        <div className="panel-heading">
          <div><History size={17} /><strong>{t('recentPlans')}</strong></div>
          <div className="heading-actions">
            <button
              className={`icon-button ${showArchived ? 'active' : ''}`}
              onClick={() => {
                const next = !showArchived;
                onSetShowArchived(next);
                onLoadPlans(next);
              }}
              aria-label={showArchived ? t('hideArchived') : t('showArchived')}
              title={showArchived ? t('hideArchived') : t('showArchived')}
            >
              <Archive size={14} />
            </button>
            <button className="icon-button" onClick={() => onLoadPlans()} aria-label={t('refresh')}><RefreshCw size={14} /></button>
          </div>
        </div>
        <div className="history-list">
          {recentPlans.slice(0, 6).map((item) => (
            <button className={plan?.plan_id === item.plan_id ? 'active' : ''} key={item.plan_id} onClick={() => onRefreshPlan(item.plan_id)}>
              <span><FolderGit2 size={14} /><strong>{item.goal || item.plan_id}</strong></span>
              <small>
                <StatusPill status={item.status} {...statusPillConfig} />
                {item.archived && <span className="archive-label">{t('archived')}</span>}
                {formatTime(item.updated_at || item.created_at)}
              </small>
              <ArrowRight size={13} />
            </button>
          ))}
          {!recentPlans.length && <div className="empty-state compact"><Clock3 size={16} /><span>{t('noRecentPlans')}</span></div>}
        </div>
      </section>
    </aside>
  );
}
