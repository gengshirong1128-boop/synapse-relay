import { Backend } from '../../services/websocket';
import { BackendBrand } from '../../theme/colors';

export type AgentCopy = {
  name: string;
  surface: string;
  emptyTitle: string;
  emptyBody: string;
  inputPlaceholder: string;
  userLabel: string;
  assistantLabel: string;
  toolLabel: string;
};

export const AGENT_COPY: Record<Backend, AgentCopy> = {
  'claude-code': {
    name: 'Claude Code',
    surface: 'Remote Control',
    emptyTitle: '连接电脑上的 Claude Code',
    emptyBody: '发送任务、查看输出、审批本机操作。先在电脑启动中继服务并连接。',
    inputPlaceholder: '给 Claude Code 发消息…',
    userLabel: '指令',
    assistantLabel: 'Claude Code 输出',
    toolLabel: '本机操作',
  },
  codex: {
    name: 'Codex',
    surface: 'Host Thread',
    emptyTitle: '连接电脑上的 Codex',
    emptyBody: '发送任务、查看输出、审批本机操作。先在电脑启动中继服务并连接。',
    inputPlaceholder: '给 Codex 发消息…',
    userLabel: '提示词',
    assistantLabel: 'Codex',
    toolLabel: '操作',
  },
};

export function getBackendBrand(backend: Backend): BackendBrand {
  return backend === 'codex' ? 'codex' : 'claude';
}

export function getToolPreview(input: Record<string, unknown>): string {
  if (input.file_path) return `${input.file_path}`;
  if (input.command) return `$ ${input.command}`;
  if (input.pattern) return `grep: ${input.pattern}`;
  if (input.query) return `${input.query}`;
  if (input.url) return `${input.url}`;
  return JSON.stringify(input).slice(0, 160);
}

export function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
