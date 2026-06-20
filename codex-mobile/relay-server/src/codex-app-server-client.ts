import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { request as httpRequest } from 'http';
import WebSocket from 'ws';
import { RelayConfig } from './config';
import type { PermissionMode } from './process-manager';

type JsonMap = Record<string, unknown>;
type ApprovalDecision = 'approve_once' | 'approve_session' | 'deny' | 'cancel';
const CODEX_THREAD_SESSION_PREFIX = 'codex-thread:';

export type CodexRunOptions = {
  sessionId: string;
  cwd: string;
  text: string;
  model?: string;
  effort?: string;
  permissionMode?: PermissionMode;
  responseSpeed?: string;
  env?: Record<string, string>;
};

type CodexThreadState = {
  threadId: string;
  turnId?: string;
  cwd: string;
  timeout?: ReturnType<typeof setTimeout>;
};

type PendingApproval = {
  sessionId: string;
  requestId: number;
  method: string;
  params: any;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type CodexThreadListItem = {
  id: string;
  backend: 'codex';
  cwd: string;
  name: string;
  createdAt: number;
  lastActivity: number;
  state: 'running' | 'idle' | 'crashed';
  isRunning: boolean;
  messageCount: number;
  lastMessagePreview: string;
  lastMessageAt: number | null;
  transportMode: 'official-remote';
  remoteThreadId: string;
};

export type CodexThreadSnapshot = CodexThreadListItem & {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isThinking?: boolean;
    toolUse?: {
      toolName: string;
      toolId: string;
      input: Record<string, unknown>;
      status?: string;
      output?: string;
      exitCode?: number | null;
      durationMs?: number | null;
    };
  }>;
};

const TURN_INACTIVITY_TIMEOUT_MS = Number(process.env.CODEX_TURN_TIMEOUT_MS || 5 * 60 * 1000);

export class CodexAppServerClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private initPromise: Promise<void> | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private sessions = new Map<string, CodexThreadState>();
  private threadToSession = new Map<string, string>();
  private readonly port = Number(process.env.CODEX_APP_SERVER_PORT || 39877);

  constructor(private config: RelayConfig) {
    super();
  }

  async runTurn(options: CodexRunOptions): Promise<void> {
    await this.ensureConnected();

    let thread = this.sessions.get(options.sessionId);
    if (!thread || thread.cwd !== options.cwd) {
      const remoteThreadId = parseCodexThreadSessionId(options.sessionId);
      thread = remoteThreadId
        ? await this.resumeThread(options, remoteThreadId)
        : await this.startThread(options);
      this.sessions.set(options.sessionId, thread);
      this.threadToSession.set(thread.threadId, options.sessionId);
    } else if (thread.turnId) {
      await this.interruptSession(options.sessionId);
    }

    this.emit('status', options.sessionId, {
      processState: 'running',
      backend: 'codex',
      cwd: options.cwd,
      model: options.model,
      transportMode: 'official-remote',
    });

    const response = await this.request('turn/start', {
      threadId: thread.threadId,
      input: [{ type: 'text', text: options.text, text_elements: [] }],
      cwd: options.cwd,
      runtimeWorkspaceRoots: [options.cwd],
      model: options.model || undefined,
      effort: options.effort || undefined,
      serviceTier: options.responseSpeed === 'priority' ? 'priority' : undefined,
      approvalPolicy: this.approvalPolicy(options.permissionMode),
      sandboxPolicy: this.sandboxPolicy(options.permissionMode, options.cwd),
    });

    thread.turnId = response?.turn?.id;
    this.armTimeout(options.sessionId, thread);
  }

  async interruptSession(sessionId: string): Promise<void> {
    const thread = this.sessions.get(sessionId);
    if (!thread?.threadId || !thread.turnId) return;
    const turnId = thread.turnId;
    if (thread.timeout) {
      clearTimeout(thread.timeout);
      thread.timeout = undefined;
    }
    thread.turnId = undefined;
    try {
      await this.request('turn/interrupt', { threadId: thread.threadId, turnId });
    } catch {
      // The turn may already be finished.
    }
  }

  resolveApproval(approvalId: string, decision: ApprovalDecision): boolean {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(approvalId);
    this.sendApprovalResult(pending, decision);
    this.emit('approval_resolved', pending.sessionId, { approvalId, decision });
    return true;
  }

  async listThreads(limit = 50): Promise<CodexThreadListItem[]> {
    await this.ensureConnected();
    const response = await this.request('thread/list', {
      limit,
      sortKey: 'updated_at',
      sortDirection: 'desc',
      archived: false,
    });
    return (response?.data || []).map((thread: any) => this.threadListItem(thread));
  }

  async readThreadSnapshot(sessionId: string): Promise<CodexThreadSnapshot | null> {
    const threadId = parseCodexThreadSessionId(sessionId);
    if (!threadId) return null;
    await this.ensureConnected();
    const response = await this.request('thread/read', { threadId, includeTurns: true });
    const thread = response?.thread;
    if (!thread) return null;
    return {
      ...this.threadListItem(thread),
      messages: this.threadMessages(thread),
    };
  }

  private async startThread(options: CodexRunOptions): Promise<CodexThreadState> {
    const response = await this.request('thread/start', {
      cwd: options.cwd,
      runtimeWorkspaceRoots: [options.cwd],
      model: options.model || undefined,
      serviceTier: options.responseSpeed === 'priority' ? 'priority' : undefined,
      sandbox: this.sandboxMode(options.permissionMode),
      approvalPolicy: this.approvalPolicy(options.permissionMode),
      approvalsReviewer: 'user',
      ephemeral: false,
    });

    const threadId = response?.thread?.id;
    if (!threadId) throw new Error('Codex app-server did not return a thread id.');
    return { threadId, cwd: options.cwd };
  }

  private async resumeThread(options: CodexRunOptions, threadId: string): Promise<CodexThreadState> {
    const response = await this.request('thread/resume', {
      threadId,
      cwd: options.cwd || undefined,
      model: options.model || undefined,
      serviceTier: options.responseSpeed === 'priority' ? 'priority' : undefined,
      approvalPolicy: this.approvalPolicy(options.permissionMode),
      approvalsReviewer: 'user',
      sandbox: this.sandboxMode(options.permissionMode),
    });

    const resumedThreadId = response?.thread?.id || threadId;
    const cwd = response?.cwd || response?.thread?.cwd || options.cwd;
    return { threadId: resumedThreadId, cwd };
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.connect();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async connect(): Promise<void> {
    await this.ensureServer();

    this.ws = await this.openSocket();
    this.ws.on('message', raw => this.handleMessage(raw.toString()));
    this.ws.on('close', () => {
      this.ws = null;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Codex app-server connection closed.'));
      }
      this.pending.clear();
    });

    await this.request('initialize', {
      clientInfo: { name: 'codex-mobile-relay', title: 'CodexMobile Relay', version: '1.0.0' },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    this.send({ method: 'initialized' });
  }

  private async ensureServer(): Promise<void> {
    if (await this.isHealthy()) return;

    const listenUrl = this.serverUrl();
    spawn(this.commandString([this.config.codexPath, 'app-server', '--listen', listenUrl]), {
      shell: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      detached: true,
    }).unref();

    const started = Date.now();
    while (Date.now() - started < 8000) {
      if (await this.isHealthy()) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Codex app-server did not become healthy.');
  }

  private isHealthy(): Promise<boolean> {
    return new Promise(resolve => {
      const req = httpRequest(`http://127.0.0.1:${this.port}/healthz`, { method: 'GET', timeout: 1000 }, res => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
  }

  private openSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl());
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('Timed out connecting to Codex app-server.'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timer);
        resolve(ws);
      });
      ws.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private request(method: string, params?: unknown): Promise<any> {
    const id = this.nextRequestId++;
    this.send({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  private send(payload: JsonMap): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Codex app-server is not connected.');
    }
    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(raw: string): void {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }

    if (message.id && message.method) {
      this.handleServerRequest(message);
      return;
    }

    if (message.method) {
      this.handleNotification(message.method, message.params || {});
    }
  }

  private handleNotification(method: string, params: any): void {
    const sessionId = params.threadId ? this.threadToSession.get(params.threadId) : undefined;
    if (!sessionId) return;
    this.bumpTimeout(sessionId);

    switch (method) {
      case 'item/agentMessage/delta':
        if (typeof params.delta === 'string') this.emit('output', sessionId, params.delta);
        break;
      case 'item/reasoning/summaryTextDelta':
      case 'item/reasoning/textDelta':
        if (typeof params.delta === 'string') this.emit('thinking', sessionId, params.delta);
        break;
      case 'item/started':
        this.handleToolItem(sessionId, params.item);
        break;
      case 'item/completed':
        this.handleToolCompleted(sessionId, params.item);
        break;
      case 'item/commandExecution/outputDelta':
      case 'item/fileChange/outputDelta':
        if (params.itemId && typeof params.delta === 'string') {
          this.emit('tool_update', sessionId, {
            toolId: params.itemId,
            status: 'running',
            appendOutput: params.delta,
          });
        }
        break;
      case 'item/fileChange/patchUpdated':
        if (params.itemId) {
          this.emit('tool_update', sessionId, {
            toolId: params.itemId,
            status: 'running',
            patch: params.patch || params.changes || params,
          });
        }
        break;
      case 'thread/status/changed':
        this.emit('status', sessionId, {
          processState: params.status?.type === 'active' ? 'running' : 'idle',
          backend: 'codex',
          transportMode: 'official-remote',
        });
        break;
      case 'thread/tokenUsage/updated':
        this.emit('usage', sessionId, {
          inputTokens: params.tokenUsage?.last?.inputTokens || 0,
          outputTokens: params.tokenUsage?.last?.outputTokens || 0,
          cacheRead: params.tokenUsage?.last?.cachedInputTokens || 0,
          cacheCreation: 0,
          costUsd: 0,
          durationMs: 0,
        });
        break;
      case 'turn/completed':
        this.completeTurn(sessionId, params.turn?.status === 'completed' ? 0 : 1);
        break;
      case 'error':
        if (params.message) this.emit('process_error', sessionId, String(params.message));
        break;
      case 'warning':
        break;
    }
  }

  private handleToolItem(sessionId: string, item: any): void {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'commandExecution') {
      this.emit('tool_use', sessionId, {
        toolName: 'shell',
        toolId: item.id,
        status: item.status || 'running',
        input: { command: item.command, cwd: item.cwd },
      });
    } else if (item.type === 'fileChange') {
      this.emit('tool_use', sessionId, {
        toolName: 'file_change',
        toolId: item.id,
        status: item.status || 'running',
        input: { changes: item.changes },
      });
    } else if (item.type === 'mcpToolCall') {
      this.emit('tool_use', sessionId, {
        toolName: `${item.server}.${item.tool}`,
        toolId: item.id,
        status: item.status || 'running',
        input: item.arguments || {},
      });
    } else if (item.type === 'dynamicToolCall') {
      this.emit('tool_use', sessionId, {
        toolName: item.namespace ? `${item.namespace}.${item.tool}` : item.tool,
        toolId: item.id,
        status: item.status || 'running',
        input: item.arguments || {},
      });
    } else if (item.type === 'webSearch') {
      this.emit('tool_use', sessionId, {
        toolName: 'web_search',
        toolId: item.id,
        status: item.action ? 'running' : 'completed',
        input: { query: item.query },
      });
    }
  }

  private handleToolCompleted(sessionId: string, item: any): void {
    if (!item || typeof item !== 'object' || !item.id) return;

    if (item.type === 'commandExecution') {
      this.emit('tool_update', sessionId, {
        toolId: item.id,
        status: item.status || (item.exitCode === 0 ? 'completed' : 'failed'),
        output: item.aggregatedOutput || undefined,
        exitCode: item.exitCode,
        durationMs: item.durationMs,
      });
    } else if (item.type === 'fileChange') {
      this.emit('tool_update', sessionId, {
        toolId: item.id,
        status: item.status || 'completed',
        input: { changes: item.changes },
      });
    } else if (item.type === 'mcpToolCall') {
      this.emit('tool_update', sessionId, {
        toolId: item.id,
        status: item.status || (item.error ? 'failed' : 'completed'),
        output: item.error ? JSON.stringify(item.error) : this.stringifyToolResult(item.result),
        durationMs: item.durationMs,
      });
    } else if (item.type === 'dynamicToolCall') {
      this.emit('tool_update', sessionId, {
        toolId: item.id,
        status: item.status || (item.success === false ? 'failed' : 'completed'),
        output: this.stringifyToolResult(item.contentItems),
        durationMs: item.durationMs,
      });
    }
  }

  private handleServerRequest(message: any): void {
    const params = message.params || {};
    if (!this.isApprovalRequest(message.method)) {
      this.send({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } });
      return;
    }

    const threadId = params.threadId || params.conversationId;
    const sessionId = threadId ? this.threadToSession.get(threadId) : undefined;
    if (!sessionId) {
      this.send({ id: message.id, result: this.approvalResult(message.method, params, 'deny') });
      return;
    }

    const approvalId = String(message.id);
    const timeout = setTimeout(() => {
      const pending = this.pendingApprovals.get(approvalId);
      if (!pending) return;
      this.pendingApprovals.delete(approvalId);
      this.sendApprovalResult(pending, 'deny');
      this.emit('approval_resolved', sessionId, { approvalId, decision: 'deny', timedOut: true });
    }, 60000);

    this.pendingApprovals.set(approvalId, {
      sessionId,
      requestId: message.id,
      method: message.method,
      params,
      timeout,
    });

    const payload = this.buildApprovalPayload(approvalId, message.method, params);
    this.bumpTimeout(sessionId);
    this.emit('approval_request', sessionId, payload);
    this.emit('tool_use', sessionId, {
      toolName: 'approval_request',
      toolId: approvalId,
      input: payload,
    });
  }

  private completeTurn(sessionId: string, code: number): void {
    const thread = this.sessions.get(sessionId);
    if (thread?.timeout) {
      clearTimeout(thread.timeout);
      thread.timeout = undefined;
    }
    if (thread) thread.turnId = undefined;
    this.emit('exit', sessionId, code);
  }

  private armTimeout(sessionId: string, thread: CodexThreadState): void {
    if (thread.timeout) clearTimeout(thread.timeout);
    thread.timeout = setTimeout(() => {
      this.emit('process_error', sessionId, 'Codex app-server turn timed out after 5 minutes without activity.');
      void this.interruptSession(sessionId);
      this.completeTurn(sessionId, 1);
    }, TURN_INACTIVITY_TIMEOUT_MS);
  }

  private bumpTimeout(sessionId: string): void {
    const thread = this.sessions.get(sessionId);
    if (thread?.turnId) this.armTimeout(sessionId, thread);
  }

  private sandboxMode(permissionMode?: PermissionMode): string {
    if (permissionMode === 'plan') return 'read-only';
    if (permissionMode === 'bypassPermissions') return 'danger-full-access';
    return 'workspace-write';
  }

  private approvalPolicy(permissionMode?: PermissionMode): string {
    if (permissionMode === 'bypassPermissions' || permissionMode === 'plan') return 'never';
    if (permissionMode === 'auto') return 'on-failure';
    return 'on-request';
  }

  private sandboxPolicy(permissionMode: PermissionMode | undefined, cwd: string): JsonMap {
    if (permissionMode === 'plan') return { type: 'readOnly', networkAccess: false };
    if (permissionMode === 'bypassPermissions') return { type: 'dangerFullAccess' };
    return {
      type: 'workspaceWrite',
      writableRoots: [cwd],
      networkAccess: false,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false,
    };
  }

  private isApprovalRequest(method: string): boolean {
    return method === 'item/commandExecution/requestApproval'
      || method === 'item/fileChange/requestApproval'
      || method === 'item/permissions/requestApproval'
      || method === 'execCommandApproval'
      || method === 'applyPatchApproval';
  }

  private sendApprovalResult(pending: PendingApproval, decision: ApprovalDecision): void {
    this.send({
      id: pending.requestId,
      result: this.approvalResult(pending.method, pending.params, decision),
    });
  }

  private approvalResult(method: string, params: any, decision: ApprovalDecision): JsonMap {
    if (method === 'item/permissions/requestApproval') {
      if (decision === 'deny' || decision === 'cancel') {
        return { permissions: {}, scope: 'turn' };
      }
      const requested = params.permissions || {};
      return {
        permissions: {
          ...(requested.network ? { network: requested.network } : {}),
          ...(requested.fileSystem ? { fileSystem: requested.fileSystem } : {}),
        },
        scope: decision === 'approve_session' ? 'session' : 'turn',
      };
    }

    if (method === 'execCommandApproval' || method === 'applyPatchApproval') {
      const legacyDecision = decision === 'approve_once'
        ? 'approved'
        : decision === 'approve_session'
          ? 'approved_for_session'
          : decision === 'cancel'
            ? 'abort'
            : 'denied';
      return { decision: legacyDecision };
    }

    const reviewDecision = decision === 'approve_once'
      ? 'accept'
      : decision === 'approve_session'
        ? 'acceptForSession'
        : decision === 'cancel'
          ? 'cancel'
          : 'decline';
    return { decision: reviewDecision };
  }

  private buildApprovalPayload(approvalId: string, method: string, params: any): JsonMap {
    const kind = this.approvalKind(method);
    const command = Array.isArray(params.command) ? params.command.join(' ') : params.command;
    const cwd = params.cwd || null;
    const reason = params.reason || null;
    const fileChanges = params.fileChanges || params.changes || null;
    const permissions = params.permissions || null;
    const preview = this.approvalPreview(kind, { command, cwd, reason, fileChanges, permissions, grantRoot: params.grantRoot });

    return {
      approvalId,
      backend: 'codex',
      kind,
      method,
      itemId: params.itemId || params.callId || null,
      title: this.approvalTitle(kind),
      command,
      cwd,
      reason,
      grantRoot: params.grantRoot || null,
      permissions,
      fileChanges,
      preview,
      createdAt: Date.now(),
    };
  }

  private approvalKind(method: string): string {
    if (method === 'item/commandExecution/requestApproval' || method === 'execCommandApproval') return 'command';
    if (method === 'item/fileChange/requestApproval' || method === 'applyPatchApproval') return 'file_change';
    if (method === 'item/permissions/requestApproval') return 'permissions';
    return 'unknown';
  }

  private approvalTitle(kind: string): string {
    if (kind === 'command') return '需要执行命令';
    if (kind === 'file_change') return '需要修改文件';
    if (kind === 'permissions') return '需要更多权限';
    return '需要审批';
  }

  private approvalPreview(kind: string, data: JsonMap): string {
    if (kind === 'command') return String(data.command || 'Run command');
    if (kind === 'file_change') return String(data.grantRoot || JSON.stringify(data.fileChanges || {}).slice(0, 400));
    if (kind === 'permissions') return JSON.stringify(data.permissions || {}).slice(0, 400);
    return JSON.stringify(data).slice(0, 400);
  }

  private stringifyToolResult(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result == null) return '';
    return JSON.stringify(result).slice(0, 12000);
  }

  private threadListItem(thread: any): CodexThreadListItem {
    const updatedAt = secondsToMs(thread.updatedAt) || Date.now();
    const createdAt = secondsToMs(thread.createdAt) || updatedAt;
    const state = this.threadState(thread.status);
    const messages = Array.isArray(thread.turns) && thread.turns.length ? this.threadMessages(thread) : [];
    return {
      id: `${CODEX_THREAD_SESSION_PREFIX}${thread.id}`,
      backend: 'codex',
      cwd: thread.cwd || '',
      name: thread.name || firstLine(thread.preview) || `Codex ${String(thread.id).slice(0, 8)}`,
      createdAt,
      lastActivity: updatedAt,
      state,
      isRunning: state === 'running',
      messageCount: messages.length,
      lastMessagePreview: previewMessages(messages) || firstLine(thread.preview),
      lastMessageAt: messages[messages.length - 1]?.timestamp || updatedAt,
      transportMode: 'official-remote',
      remoteThreadId: thread.id,
    };
  }

  private threadMessages(thread: any): CodexThreadSnapshot['messages'] {
    const messages: CodexThreadSnapshot['messages'] = [];
    for (const turn of thread.turns || []) {
      const timestamp = secondsToMs(turn.completedAt || turn.startedAt) || Date.now();
      for (const item of turn.items || []) {
        const message = this.threadItemMessage(item, timestamp);
        if (message) messages.push(message);
      }
    }
    return messages;
  }

  private threadItemMessage(item: any, timestamp: number): CodexThreadSnapshot['messages'][number] | null {
    if (!item || typeof item !== 'object') return null;
    if (item.type === 'userMessage') {
      const content = (item.content || [])
        .map((part: any) => part.type === 'text' ? part.text : `[${part.type}]`)
        .filter(Boolean)
        .join('\n');
      return { id: item.id, role: 'user', content, timestamp };
    }
    if (item.type === 'agentMessage') {
      return { id: item.id, role: 'assistant', content: item.text || '', timestamp };
    }
    if (item.type === 'reasoning') {
      const content = [...(item.summary || []), ...(item.content || [])].join('\n');
      if (!content) return null;
      return { id: item.id, role: 'system', content, timestamp, isThinking: true };
    }
    if (item.type === 'commandExecution') {
      return {
        id: item.id,
        role: 'system',
        content: '',
        timestamp,
        toolUse: {
          toolName: 'shell',
          toolId: item.id,
          input: { command: item.command, cwd: item.cwd },
          status: item.status || (item.exitCode === 0 ? 'completed' : 'failed'),
          output: item.aggregatedOutput || undefined,
          exitCode: item.exitCode,
          durationMs: item.durationMs,
        },
      };
    }
    if (item.type === 'fileChange') {
      return {
        id: item.id,
        role: 'system',
        content: '',
        timestamp,
        toolUse: {
          toolName: 'file_change',
          toolId: item.id,
          input: { changes: item.changes },
          status: item.status,
        },
      };
    }
    return null;
  }

  private threadState(status: any): 'running' | 'idle' | 'crashed' {
    if (status?.type === 'active') return 'running';
    if (status?.type === 'systemError') return 'crashed';
    return 'idle';
  }

  private serverUrl(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  private commandString(args: string[]): string {
    return args.map(arg => /^[A-Za-z0-9_./:=@+-]+$/.test(arg)
      ? arg
      : `"${arg.replace(/"/g, '""')}"`).join(' ');
  }
}

export function parseCodexThreadSessionId(sessionId: string): string | null {
  return sessionId.startsWith(CODEX_THREAD_SESSION_PREFIX)
    ? sessionId.slice(CODEX_THREAD_SESSION_PREFIX.length)
    : null;
}

function secondsToMs(value: unknown): number | null {
  return typeof value === 'number' ? value * 1000 : null;
}

function firstLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
}

function previewMessages(messages: CodexThreadSnapshot['messages']): string {
  const last = [...messages].reverse().find(message =>
    message.content || message.toolUse?.output || message.toolUse?.toolName
  );
  if (!last) return '';
  if (last.content) return firstLine(last.content);
  if (last.toolUse?.output) return firstLine(last.toolUse.output);
  return last.toolUse?.toolName ? `工具：${last.toolUse.toolName}` : '';
}
