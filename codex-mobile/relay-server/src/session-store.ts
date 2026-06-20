import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Backend, TransportMode } from './process-manager';

interface PersistedSession {
  id: string;
  backend: Backend;
  transportMode?: TransportMode;
  cwd: string;
  name: string;
  createdAt: number;
  lastActivity: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  messages: StoredMessage[];
}

interface StoredToolUse {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
  status?: string;
  output?: string;
  exitCode?: number | null;
  durationMs?: number | null;
  patch?: unknown;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isThinking?: boolean;
  toolUse?: StoredToolUse;
}

export interface SessionListItem extends Omit<PersistedSession, 'messages'> {
  messageCount: number;
  lastMessagePreview: string;
  lastMessageAt: number | null;
}

const DATA_DIR = join(process.cwd(), '.codex-mobile');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const MAX_MESSAGES_PER_SESSION = 300;
const MAX_MESSAGE_CHARS = 12000;
const STREAM_SAVE_DEBOUNCE_MS = 500;

export class SessionStore {
  private sessions: PersistedSession[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(SESSIONS_FILE)) {
        const raw = readFileSync(SESSIONS_FILE, 'utf-8');
        this.sessions = JSON.parse(raw).map((session: Partial<PersistedSession>) => ({
          ...session,
          messages: Array.isArray(session.messages) ? session.messages : [],
        })) as PersistedSession[];
      }
    } catch {
      this.sessions = [];
    }
  }

  private save(): void {
    this.clearPendingSave();
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(SESSIONS_FILE, JSON.stringify(this.sessions, null, 2), 'utf-8');
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, STREAM_SAVE_DEBOUNCE_MS);
  }

  private clearPendingSave(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  flush(): void {
    this.save();
  }

  upsert(session: PersistedSession): void {
    const idx = this.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.sessions[idx] = { ...session, messages: this.sessions[idx].messages || session.messages || [] };
    } else {
      this.sessions.push({ ...session, messages: session.messages || [] });
    }
    this.save();
  }

  updateActivity(id: string, inputTokens?: number, outputTokens?: number): void {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    session.lastActivity = Date.now();
    if (inputTokens) session.totalInputTokens += inputTokens;
    if (outputTokens) session.totalOutputTokens += outputTokens;
    this.save();
  }

  remove(id: string): void {
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.save();
  }

  getAll(): PersistedSession[] {
    return [...this.sessions];
  }

  getList(): SessionListItem[] {
    return this.sessions.map(session => {
      const lastMessage = [...session.messages].reverse().find(message =>
        message.content || message.toolUse?.output || message.toolUse?.toolName
      );
      return {
        id: session.id,
        backend: session.backend,
        transportMode: session.transportMode,
        cwd: session.cwd,
        name: session.name,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        totalInputTokens: session.totalInputTokens,
        totalOutputTokens: session.totalOutputTokens,
        messageCount: session.messages.length,
        lastMessagePreview: previewMessage(lastMessage),
        lastMessageAt: lastMessage?.timestamp || null,
      };
    });
  }

  get(id: string): PersistedSession | undefined {
    return this.sessions.find(s => s.id === id);
  }

  getMessages(id: string): StoredMessage[] {
    return [...(this.get(id)?.messages || [])];
  }

  appendMessage(id: string, message: StoredMessage): void {
    const session = this.get(id);
    if (!session) return;
    session.messages.push({
      ...message,
      content: trimContent(message.content),
      toolUse: trimToolUse(message.toolUse),
    });
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    session.lastActivity = Date.now();
    this.save();
  }

  updateStreamingMessage(id: string, text: string): void {
    const session = this.get(id);
    if (!session) return;
    const last = session.messages[session.messages.length - 1];
    if (last?.role === 'assistant' && last.isStreaming && !last.toolUse && !last.isThinking) {
      last.content = trimContent(last.content + text);
    } else {
      session.messages.push({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: trimContent(text),
        timestamp: Date.now(),
        isStreaming: true,
      });
    }
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    session.lastActivity = Date.now();
    this.scheduleSave();
  }

  updateToolMessage(id: string, toolId: string, update: Record<string, unknown>): void {
    const session = this.get(id);
    if (!session) return;
    let found = false;
    session.messages = session.messages.map(message => {
      if (message.toolUse?.toolId !== toolId) return message;
      found = true;
      const nextOutput = typeof update.appendOutput === 'string'
        ? trimContent(`${message.toolUse.output || ''}${update.appendOutput}`)
        : typeof update.output === 'string'
          ? trimContent(update.output)
          : message.toolUse.output;
      return {
        ...message,
        toolUse: trimToolUse({
          ...message.toolUse,
          input: isRecord(update.input)
            ? { ...message.toolUse.input, ...update.input }
            : message.toolUse.input,
          status: typeof update.status === 'string' ? update.status : message.toolUse.status,
          output: nextOutput,
          exitCode: typeof update.exitCode === 'number' || update.exitCode === null
            ? update.exitCode as number | null
            : message.toolUse.exitCode,
          durationMs: typeof update.durationMs === 'number' || update.durationMs === null
            ? update.durationMs as number | null
            : message.toolUse.durationMs,
          patch: update.patch ?? message.toolUse.patch,
        }),
      };
    });

    if (!found) {
      this.appendMessage(id, {
        id: `tool-${Date.now()}`,
        role: 'system',
        content: '',
        timestamp: Date.now(),
        toolUse: trimToolUse({
          toolName: String(update.toolName || 'tool'),
          toolId,
          input: isRecord(update.input) ? update.input : {},
          status: typeof update.status === 'string' ? update.status : undefined,
          output: typeof update.output === 'string'
            ? trimContent(update.output)
            : typeof update.appendOutput === 'string'
              ? trimContent(update.appendOutput)
              : undefined,
        }),
      });
      return;
    }

    session.lastActivity = Date.now();
    this.save();
  }

  completeStreaming(id: string): void {
    const session = this.get(id);
    if (!session) return;
    session.messages = session.messages.map(message => message.isStreaming
      ? { ...message, isStreaming: false }
      : message);
    session.lastActivity = Date.now();
    this.flush();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimContent(value: string): string {
  return value.length > MAX_MESSAGE_CHARS ? value.slice(-MAX_MESSAGE_CHARS) : value;
}

function trimToolUse(toolUse?: StoredToolUse): StoredToolUse | undefined {
  if (!toolUse) return undefined;
  return {
    ...toolUse,
    output: toolUse.output ? trimContent(toolUse.output) : toolUse.output,
  };
}

function previewMessage(message?: StoredMessage): string {
  if (!message) return '';
  if (message.content) return message.content.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (message.toolUse?.output) return message.toolUse.output.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (message.toolUse?.toolName) return `工具：${message.toolUse.toolName}`;
  return '';
}
