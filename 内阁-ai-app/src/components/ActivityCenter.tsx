import { Bot, Eye, FileCode2, History, ListChecks, MessageSquare, Radio, Send, ShieldCheck, Terminal } from 'lucide-react';
import type { Agent, AgentActivity, AppTranslator, Plan, StatusPillConfig } from '../types';
import { StatusPill } from './StatusPill';

type ActivityCenterProps = StatusPillConfig & {
  activity: AgentActivity | null;
  agents: Agent[];
  busy: string;
  eventDetail: (event: Plan['events'][number]) => string;
  eventLabels: Record<string, string>;
  formatTime: (value?: string) => string;
  messageContent: string;
  messageTarget: string;
  plan: Plan;
  selectedActivityId: string;
  t: AppTranslator;
  onSendMessage: () => void;
  onSetMessageContent: (value: string) => void;
  onSetMessageTarget: (value: string) => void;
  onSetSelectedActivityId: (value: string) => void;
};

export function ActivityCenter({
  activity,
  agents,
  busy,
  eventDetail,
  eventLabels,
  formatTime,
  messageContent,
  messageTarget,
  onSendMessage,
  onSetMessageContent,
  onSetMessageTarget,
  onSetSelectedActivityId,
  plan,
  selectedActivityId,
  statusLabels,
  statusUnknownLabel,
  t,
}: ActivityCenterProps) {
  const statusPillConfig = { statusLabels, statusUnknownLabel };

  return (
    <div className="panel activity-center" id="agent-activity">
      <div className="panel-heading">
        <div><Radio size={18} /><strong>{t('agentActivity')}</strong>{activity && <StatusPill status={activity.status} {...statusPillConfig} />}</div>
        <span>{t('publicOutputHint')}</span>
      </div>
      <div className="activity-tabs">
        {plan.tasks.map((task) => (
          <button className={selectedActivityId === task.task_id ? 'active' : ''} key={task.task_id} onClick={() => onSetSelectedActivityId(task.task_id)}>
            <Bot size={14} /><span>{task.title || task.task_id}</span><StatusPill status={task.status} {...statusPillConfig} />
          </button>
        ))}
        {plan.supervisor_agent_id && (
          <button className={selectedActivityId === '__supervisor__' ? 'active' : ''} onClick={() => onSetSelectedActivityId('__supervisor__')}>
            <ShieldCheck size={14} /><span>{t('supervisor')}</span><StatusPill status={plan.supervisor_run.status} {...statusPillConfig} />
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
                  <span key={run.attempt}><strong>{t('attempt').replace('{count}', String(run.attempt))}</strong><StatusPill status={run.status} {...statusPillConfig} /><small>{formatTime(run.finished_at || run.started_at || undefined)}</small></span>
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
        <select value={messageTarget} onChange={(event) => onSetMessageTarget(event.target.value)}>
          <option value="">{t('allAgents')}</option>
          {plan.tasks.map((task) => <option value={task.task_id} key={task.task_id}>{task.title || task.task_id}</option>)}
        </select>
        <textarea rows={2} value={messageContent} onChange={(event) => onSetMessageContent(event.target.value)} placeholder={t('messagePlaceholder')} />
        <button className="primary-button" disabled={!messageContent.trim() || busy === 'message'} onClick={onSendMessage}><Send size={15} />{t('sendMessage')}</button>
      </div>
    </div>
  );
}
