import type { StatusPillConfig } from '../types';

type StatusPillProps = StatusPillConfig & {
  status: string;
};

const statusTone = (status: string) =>
  status === 'completed' || status === 'callable' || status === 'accepted'
    ? 'good'
    : status === 'running'
      ? 'active'
      : status === 'failed' || status === 'needs_attention' || status === 'rejected'
        ? 'bad'
        : 'muted';

export function StatusPill({ status, statusLabels, statusUnknownLabel }: StatusPillProps) {
  return <span className={`status-pill ${statusTone(status)}`}>{statusLabels[status] || status || statusUnknownLabel}</span>;
}
