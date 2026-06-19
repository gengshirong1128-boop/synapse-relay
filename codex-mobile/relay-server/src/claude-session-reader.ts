import { readdir, readFile, stat } from 'fs/promises';
import type { Dirent } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';
import type { StoredMessage } from './session-store';

export const CLAUDE_SESSION_PREFIX = 'claude-session:';

export type ClaudeSessionListItem = {
  id: string;
  backend: 'claude-code';
  cwd: string;
  name: string;
  createdAt: number;
  lastActivity: number;
  state: 'idle';
  isRunning: false;
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  lastMessagePreview: string;
  lastMessageAt: number | null;
  transportMode: 'bridge';
  remoteSessionId: string;
};

export type ClaudeSessionSnapshot = ClaudeSessionListItem & {
  messages: StoredMessage[];
};

type SessionFile = {
  path: string;
  sessionId: string;
  mtimeMs: number;
};

type ParseResult = {
  cwd: string;
  name: string;
  createdAt: number;
  lastActivity: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  messages: StoredMessage[];
};

const MAX_LIST_SESSIONS = 50;
const MAX_TRANSCRIPT_MESSAGES = 300;
const MAX_MESSAGE_CHARS = 12000;

export async function listClaudeSessions(limit = MAX_LIST_SESSIONS): Promise<ClaudeSessionListItem[]> {
  const files = (await findClaudeSessionFiles()).slice(0, limit);
  const sessions = await Promise.all(files.map(async file => {
    try {
      const parsed = await parseSessionFile(file.path, file.mtimeMs, false);
      return toListItem(file.sessionId, parsed);
    } catch {
      return null;
    }
  }));

  return sessions
    .filter((session): session is ClaudeSessionListItem => !!session)
    .sort((a, b) => b.lastActivity - a.lastActivity);
}

export async function readClaudeSessionSnapshot(sessionId: string): Promise<ClaudeSessionSnapshot | null> {
  const remoteSessionId = parseClaudeSessionId(sessionId);
  if (!remoteSessionId) return null;

  const file = (await findClaudeSessionFiles()).find(item => item.sessionId === remoteSessionId);
  if (!file) return null;

  const parsed = await parseSessionFile(file.path, file.mtimeMs, true);
  return {
    ...toListItem(remoteSessionId, parsed),
    messages: parsed.messages.slice(-MAX_TRANSCRIPT_MESSAGES),
  };
}

export function parseClaudeSessionId(sessionId: string): string | null {
  return sessionId.startsWith(CLAUDE_SESSION_PREFIX)
    ? sessionId.slice(CLAUDE_SESSION_PREFIX.length)
    : null;
}

async function findClaudeSessionFiles(): Promise<SessionFile[]> {
  const root = join(homedir(), '.claude', 'projects');
  const files: SessionFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === 'subagents' || entry.name === 'tool-results') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      try {
        const info = await stat(fullPath);
        files.push({
          path: fullPath,
          sessionId: basename(entry.name, '.jsonl'),
          mtimeMs: info.mtimeMs,
        });
      } catch {
        // Skip files that disappear while scanning.
      }
    }
  }

  await walk(root);
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function parseSessionFile(path: string, fallbackTime: number, includeMessages: boolean): Promise<ParseResult> {
  const raw = await readFile(path, 'utf-8');
  const messages: StoredMessage[] = [];
  let cwd = '';
  let name = '';
  let createdAt = 0;
  let lastActivity = fallbackTime || Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let messageCount = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const timestamp = parseTimestamp(event.timestamp) || lastActivity;
    if (!createdAt && timestamp) createdAt = timestamp;
    if (timestamp) lastActivity = Math.max(lastActivity, timestamp);
    if (typeof event.cwd === 'string' && event.cwd) cwd = event.cwd;
    if (event.type === 'last-prompt' && typeof event.lastPrompt === 'string') {
      name = firstLine(event.lastPrompt);
    }

    if (event.type === 'user' && event.message) {
      const content = messageContentText(event.message.content);
      if (content && !name) name = firstLine(content);
      if (content) messageCount += 1;
      if (includeMessages && content) {
        messages.push({
          id: String(event.uuid || `user-${messages.length}`),
          role: 'user',
          content: trimContent(content),
          timestamp,
        });
      }
      continue;
    }

    if (event.type === 'assistant' && event.message) {
      const usage = event.message.usage || {};
      totalInputTokens += Number(usage.input_tokens || 0)
        + Number(usage.cache_creation_input_tokens || 0)
        + Number(usage.cache_read_input_tokens || 0);
      totalOutputTokens += Number(usage.output_tokens || 0);

      const parsed = parseAssistantContent(event.message.content, event.uuid, timestamp);
      messageCount += parsed.messages.length;
      if (parsed.text && !name) name = firstLine(parsed.text);
      if (includeMessages) messages.push(...parsed.messages);
    }
  }

  const listMessages = includeMessages ? messages : await parsePreviewMessages(raw, fallbackTime);
  return {
    cwd,
    name: name || basename(path, '.jsonl'),
    createdAt: createdAt || fallbackTime || Date.now(),
    lastActivity,
    totalInputTokens,
    totalOutputTokens,
    messageCount,
    messages: includeMessages ? messages : listMessages,
  };
}

async function parsePreviewMessages(raw: string, fallbackTime: number): Promise<StoredMessage[]> {
  const messages: StoredMessage[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const timestamp = parseTimestamp(event.timestamp) || fallbackTime || Date.now();
    if (event.type === 'user' && event.message) {
      const content = messageContentText(event.message.content);
      if (content) messages.push({ id: String(event.uuid || `user-${messages.length}`), role: 'user', content: trimContent(content), timestamp });
    } else if (event.type === 'assistant' && event.message) {
      messages.push(...parseAssistantContent(event.message.content, event.uuid, timestamp).messages);
    }
  }
  return messages.slice(-MAX_TRANSCRIPT_MESSAGES);
}

function parseAssistantContent(content: unknown, uuid: unknown, timestamp: number): {
  text: string;
  messages: StoredMessage[];
} {
  const messages: StoredMessage[] = [];
  const textParts: string[] = [];

  if (typeof content === 'string') {
    textParts.push(content);
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
        messages.push({
          id: String(block.id || `thinking-${messages.length}-${timestamp}`),
          role: 'system',
          content: trimContent(block.thinking),
          timestamp,
          isThinking: true,
        });
      } else if (block.type === 'tool_use') {
        const toolId = String(block.id || `tool-${messages.length}-${timestamp}`);
        messages.push({
          id: toolId,
          role: 'system',
          content: '',
          timestamp,
          toolUse: {
            toolName: String(block.name || 'tool'),
            toolId,
            input: isRecord(block.input) ? block.input : {},
            status: 'completed',
          },
        });
      }
    }
  }

  const text = textParts.join('\n').trim();
  if (text) {
    messages.push({
      id: String(uuid || `assistant-${messages.length}-${timestamp}`),
      role: 'assistant',
      content: trimContent(text),
      timestamp,
    });
  }
  return { text, messages };
}

function messageContentText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (!isRecord(part)) return '';
      if (part.type === 'text' && typeof part.text === 'string') return part.text;
      if (part.type === 'image') return '[image]';
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function toListItem(remoteSessionId: string, parsed: ParseResult): ClaudeSessionListItem {
  const lastMessage = [...parsed.messages].reverse().find(message =>
    message.content || message.toolUse?.output || message.toolUse?.toolName
  );

  return {
    id: `${CLAUDE_SESSION_PREFIX}${remoteSessionId}`,
    backend: 'claude-code',
    cwd: parsed.cwd,
    name: parsed.name || `Claude ${remoteSessionId.slice(0, 8)}`,
    createdAt: parsed.createdAt,
    lastActivity: parsed.lastActivity,
    state: 'idle',
    isRunning: false,
    totalInputTokens: parsed.totalInputTokens,
    totalOutputTokens: parsed.totalOutputTokens,
    messageCount: parsed.messageCount,
    lastMessagePreview: previewMessage(lastMessage),
    lastMessageAt: lastMessage?.timestamp || parsed.lastActivity,
    transportMode: 'bridge',
    remoteSessionId,
  };
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function previewMessage(message?: StoredMessage): string {
  if (!message) return '';
  if (message.content) return firstLine(message.content);
  if (message.toolUse?.output) return firstLine(message.toolUse.output);
  if (message.toolUse?.toolName) return `工具：${message.toolUse.toolName}`;
  return '';
}

function firstLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function trimContent(value: string): string {
  return value.length > MAX_MESSAGE_CHARS ? value.slice(-MAX_MESSAGE_CHARS) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
