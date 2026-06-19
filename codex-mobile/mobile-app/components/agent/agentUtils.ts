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
    emptyTitle: 'No active Claude Code run',
    emptyBody: 'Connect the desktop relay, then send a task to the local Claude Code session.',
    inputPlaceholder: 'Message Claude Code...',
    userLabel: 'Instruction',
    assistantLabel: 'Claude Code output',
    toolLabel: 'Local action',
  },
  codex: {
    name: 'Codex',
    surface: 'Host Thread',
    emptyTitle: 'No Codex thread yet',
    emptyBody: 'Start a Codex task on the connected host.',
    inputPlaceholder: 'Message Codex...',
    userLabel: 'Prompt',
    assistantLabel: 'Codex',
    toolLabel: 'Action',
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
