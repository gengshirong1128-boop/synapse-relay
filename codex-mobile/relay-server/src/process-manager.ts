import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { RelayConfig } from './config';
import { CodexAppServerClient, CodexThreadListItem, CodexThreadSnapshot } from './codex-app-server-client';
import {
  ClaudeSessionListItem,
  ClaudeSessionSnapshot,
  listClaudeSessions,
  parseClaudeSessionId,
  readClaudeSessionSnapshot,
} from './claude-session-reader';

export type Backend = 'claude-code' | 'codex';
export type PermissionMode = 'default' | 'plan' | 'auto' | 'bypassPermissions';
export type TransportMode = 'bridge' | 'official-remote';

export interface SessionInfo {
  id: string;
  claudeSessionId: string;
  backend: Backend;
  process: ChildProcess | null;
  cwd: string;
  transportMode: TransportMode;
  state: 'running' | 'idle' | 'crashed';
  createdAt: number;
  outputBuffer: string;
}

export class ProcessManager extends EventEmitter {
  private sessions = new Map<string, SessionInfo>();
  private config: RelayConfig;
  private codexAppServer: CodexAppServerClient;

  constructor(config: RelayConfig) {
    super();
    this.config = config;
    this.codexAppServer = new CodexAppServerClient(config);
    this.setupCodexAppServerEvents();
  }

  startSession(
    sessionId: string,
    backend: Backend,
    cwd: string,
    transportMode?: TransportMode,
    env?: Record<string, string>
  ): SessionInfo {
    const existing = this.sessions.get(sessionId);
    if (existing && existing.state === 'running') return existing;

    const session: SessionInfo = {
      id: sessionId,
      claudeSessionId: parseClaudeSessionId(sessionId) || randomUUID(),
      backend,
      process: null,
      cwd,
      transportMode: this.resolveTransportMode(backend, sessionId, transportMode),
      state: 'idle',
      createdAt: Date.now(),
      outputBuffer: '',
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  runCommand(
    sessionId: string,
    text: string,
    env?: Record<string, string>,
    model?: string,
    effort?: string,
    permissionMode?: PermissionMode,
    responseSpeed?: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.state === 'running') {
      this.stopRunningSession(session);
      session.state = 'idle';
    }

    if (session.backend === 'codex' && session.transportMode === 'official-remote') {
      session.state = 'running';
      this.emit('status', sessionId, {
        processState: 'running',
        backend: session.backend,
        cwd: session.cwd,
        model,
        transportMode: session.transportMode,
      });
      this.codexAppServer.runTurn({
        sessionId,
        cwd: session.cwd,
        text,
        model: model || undefined,
        effort,
        permissionMode,
        responseSpeed,
        env,
      }).catch(error => {
        const current = this.sessions.get(sessionId);
        if (!current || current.backend !== 'codex') return;
        current.state = 'crashed';
        this.emit('process_error', sessionId, error instanceof Error ? error.message : String(error));
        this.emit('exit', sessionId, 1);
      });
      return true;
    }

    if (session.backend === 'claude-code' && session.transportMode === 'official-remote') {
      session.state = 'crashed';
      this.emit('status', sessionId, {
        processState: 'crashed',
        backend: session.backend,
        cwd: session.cwd,
        model,
        transportMode: session.transportMode,
      });
      this.emit('process_error', sessionId, 'Claude Code Desktop remote-control protocol is detected, but this relay cannot control it yet. Switch Claude Code to CLI mode to send messages.');
      this.emit('exit', sessionId, 1);
      return true;
    }

    const command = session.backend === 'codex' ? this.config.codexPath : this.config.claudeCodePath;
    const args = session.backend === 'codex'
      ? this.buildCodexCliArgs(session, text, model, effort, permissionMode, responseSpeed)
      : this.buildClaudeCliArgs(session, text, model, effort, permissionMode, responseSpeed);

    const proc = spawn(this.commandString([command, ...args]), {
      cwd: session.cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      windowsHide: true,
    });

    session.process = proc;
    session.state = 'running';
    this.emit('status', sessionId, {
      processState: 'running',
      backend: session.backend,
      cwd: session.cwd,
      model,
      transportMode: session.transportMode,
    });
    if (session.backend === 'codex' && session.transportMode === 'bridge') {
      proc.stdin?.write(`${text}\n`);
    }
    proc.stdin?.end();

    let lineBuffer = '';
    let stderrBuffer = '';
    let finished = false;

    const finishProcess = (code: number, errorMessage?: string) => {
      if (finished || session.process !== proc) return;
      finished = true;
      clearTimeout(timeout);
      session.state = code === 0 ? 'idle' : 'crashed';
      if (errorMessage) {
        this.emit('process_error', sessionId, errorMessage);
      } else if (code !== 0 && stderrBuffer.trim()) {
        this.emit('process_error', sessionId, stderrBuffer.trim().slice(-2000));
      }
      this.emit('exit', sessionId, code);
    };

    const timeout = setTimeout(() => {
      if (session.process !== proc || session.state !== 'running') return;
      finishProcess(1, 'Agent command timed out after 60 seconds.');
      try { proc.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
      }, 3000);
    }, 60000);

    proc.stdout?.on('data', (data: Buffer) => {
      if (finished || session.process !== proc) return;
      const chunk = data.toString();
      session.outputBuffer += chunk;
      lineBuffer += chunk;

      const parts = lineBuffer.split('\n');
      lineBuffer = parts.pop() || '';

      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          this.handleBridgeEvent(session, event);
        } catch {
          // Ignore non-JSON lines from Claude Code.
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      if (finished || session.process !== proc) return;
      stderrBuffer += data.toString();
      if (stderrBuffer.length > 12000) {
        stderrBuffer = stderrBuffer.slice(-12000);
      }
    });

    proc.on('exit', (code) => {
      finishProcess(code ?? 1);
    });

    proc.on('error', (err) => {
      finishProcess(1, err.message);
    });

    return true;
  }

  private buildClaudeCliArgs(
    session: SessionInfo,
    prompt: string,
    model?: string,
    effort?: string,
    permissionMode?: PermissionMode,
    responseSpeed?: string
  ): string[] {
    const args = [
      '--print', '--verbose', '--output-format', 'stream-json',
      '--bare',
    ];
    const resumeSessionId = session.backend === 'claude-code'
      ? parseClaudeSessionId(session.id)
      : null;
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    } else {
      args.push('--session-id', session.claudeSessionId);
    }
    if (model) args.push('--model', model);
    if (effort) args.push('--effort', effort);
    if (permissionMode) args.push('--permission-mode', permissionMode);
    args.push('--', prompt);
    return args;
  }

  private buildCodexCliArgs(
    session: SessionInfo,
    prompt: string,
    model?: string,
    effort?: string,
    permissionMode?: PermissionMode,
    responseSpeed?: string
  ): string[] {
    const args: string[] = [];
    if (model) args.push('--model', model);
    if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
    if (responseSpeed === 'priority') args.push('-c', 'service_tier="priority"');
    args.push('-C', session.cwd);

    if (permissionMode === 'bypassPermissions') {
      args.push('--dangerously-bypass-approvals-and-sandbox');
    } else {
      args.push('--ask-for-approval', this.codexApprovalPolicy(permissionMode));
      args.push('--sandbox', this.codexSandboxMode(permissionMode));
    }

    args.push('exec', '--json');
    return args;
  }

  private handleBridgeEvent(session: SessionInfo, event: any): void {
    if (session.backend === 'codex') {
      this.handleCodexCliEvent(session, event);
    } else {
      this.handleClaudeCliEvent(session, event);
    }
  }

  private handleClaudeCliEvent(session: SessionInfo, event: any): void {
    if (event.type === 'system' && event.subtype === 'init') {
      this.emit('init', session.id, {
        backend: session.backend,
        model: event.model,
        cwd: event.cwd,
        tools: event.tools,
        sessionId: event.session_id,
        transportMode: session.transportMode,
      });
    } else if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'text' && block.text) {
          this.emit('output', session.id, block.text);
        } else if (block.type === 'thinking' && block.thinking) {
          this.emit('thinking', session.id, block.thinking);
        } else if (block.type === 'tool_use') {
          this.emit('tool_use', session.id, {
            toolName: block.name,
            toolId: block.id,
            input: block.input,
          });
        }
      }
    } else if (event.type === 'result') {
      this.emit('usage', session.id, {
        inputTokens: event.usage?.input_tokens || 0,
        outputTokens: event.usage?.output_tokens || 0,
        cacheRead: event.usage?.cache_read_input_tokens || 0,
        cacheCreation: event.usage?.cache_creation_input_tokens || 0,
        costUsd: event.total_cost_usd || 0,
        durationMs: event.duration_ms || 0,
      });
    }
  }

  private handleCodexCliEvent(session: SessionInfo, event: any): void {
    if (event.type === 'thread.started') {
      this.emit('init', session.id, {
        backend: 'codex',
        cwd: session.cwd,
        sessionId: event.thread_id,
        transportMode: session.transportMode,
      });
      return;
    }

    if ((event.type === 'item.started' || event.type === 'item.completed' || event.type === 'item.updated') && event.item) {
      this.handleCodexCliItem(session, event.item, event.type === 'item.started');
      return;
    }

    if (event.type === 'turn.completed') {
      this.emit('usage', session.id, {
        inputTokens: event.usage?.input_tokens || 0,
        outputTokens: event.usage?.output_tokens || 0,
        cacheRead: event.usage?.cached_input_tokens || 0,
        cacheCreation: 0,
        costUsd: 0,
        durationMs: 0,
      });
    }
  }

  private handleCodexCliItem(session: SessionInfo, item: any, started: boolean): void {
    if (item.type === 'agent_message' && typeof item.text === 'string') {
      this.emit('output', session.id, item.text);
      return;
    }
    if (item.type === 'reasoning' && typeof item.text === 'string') {
      this.emit('thinking', session.id, item.text);
      return;
    }
    if (item.type === 'error') {
      const message = String(item.message || '');
      if (!message.includes('Exceeded skills context budget')) {
        this.emit('tool_use', session.id, {
          toolName: 'codex_error',
          toolId: String(item.id || `error-${Date.now()}`),
          status: 'failed',
          input: { message },
        });
      }
      return;
    }
    if (item.type !== 'command_execution' && item.type !== 'commandExecution') return;

    const toolId = String(item.id || `cmd-${Date.now()}`);
    const input = { command: item.command, cwd: item.cwd || session.cwd };
    if (started) {
      this.emit('tool_use', session.id, {
        toolName: 'shell',
        toolId,
        status: 'running',
        input,
      });
      return;
    }

    this.emit('tool_update', session.id, {
      toolId,
      toolName: 'shell',
      status: item.status || (item.exit_code === 0 || item.exitCode === 0 ? 'completed' : 'completed'),
      output: item.output || item.aggregated_output || item.aggregatedOutput || '',
      exitCode: item.exit_code ?? item.exitCode ?? null,
      durationMs: item.duration_ms ?? item.durationMs ?? null,
      input,
    });
  }

  sendInput(sessionId: string, text: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process?.stdin) return false;
    if (session.state !== 'running') return false;
    session.process.stdin.write(text + '\n');
    return true;
  }

  resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: 'approve_once' | 'approve_session' | 'deny' | 'cancel'
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.backend !== 'codex' || session.transportMode !== 'official-remote') return false;
    return this.codexAppServer.resolveApproval(approvalId, decision);
  }

  async listCodexThreads(): Promise<CodexThreadListItem[]> {
    try {
      return await this.codexAppServer.listThreads();
    } catch {
      return [];
    }
  }

  async listClaudeSessions(): Promise<ClaudeSessionListItem[]> {
    try {
      return await listClaudeSessions();
    } catch {
      return [];
    }
  }

  async readCodexThreadSnapshot(sessionId: string): Promise<CodexThreadSnapshot | null> {
    try {
      return await this.codexAppServer.readThreadSnapshot(sessionId);
    } catch {
      return null;
    }
  }

  async readClaudeSessionSnapshot(sessionId: string): Promise<ClaudeSessionSnapshot | null> {
    try {
      return await readClaudeSessionSnapshot(sessionId);
    } catch {
      return null;
    }
  }

  restartSession(sessionId: string): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    this.killSession(sessionId);
    return this.startSession(sessionId, session.backend, session.cwd, session.transportMode);
  }

  killSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.stopRunningSession(session);
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  private setupCodexAppServerEvents(): void {
    this.codexAppServer.on('status', (sessionId: string, status: Record<string, unknown>) => {
      const session = this.sessions.get(sessionId);
      if (!session || session.backend !== 'codex') return;
      const state = status.processState;
      if (state === 'running' || state === 'idle' || state === 'crashed') {
        session.state = state;
      }
      this.emit('status', sessionId, status);
    });
    this.codexAppServer.on('output', (sessionId: string, text: string) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('output', sessionId, text);
    });
    this.codexAppServer.on('thinking', (sessionId: string, text: string) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('thinking', sessionId, text);
    });
    this.codexAppServer.on('tool_use', (sessionId: string, tool: Record<string, unknown>) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('tool_use', sessionId, tool);
    });
    this.codexAppServer.on('tool_update', (sessionId: string, update: Record<string, unknown>) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('tool_update', sessionId, update);
    });
    this.codexAppServer.on('approval_request', (sessionId: string, request: Record<string, unknown>) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('approval_request', sessionId, request);
    });
    this.codexAppServer.on('approval_resolved', (sessionId: string, result: Record<string, unknown>) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('approval_resolved', sessionId, result);
    });
    this.codexAppServer.on('usage', (sessionId: string, usage: Record<string, number>) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('usage', sessionId, usage);
    });
    this.codexAppServer.on('process_error', (sessionId: string, message: string) => {
      if (this.sessions.get(sessionId)?.backend === 'codex') this.emit('process_error', sessionId, message);
    });
    this.codexAppServer.on('exit', (sessionId: string, code: number) => {
      const session = this.sessions.get(sessionId);
      if (!session || session.backend !== 'codex') return;
      session.state = code === 0 ? 'idle' : 'crashed';
      this.emit('exit', sessionId, code);
    });
  }

  private stopRunningSession(session: SessionInfo): void {
    if (session.backend === 'codex' && session.transportMode === 'official-remote') {
      void this.codexAppServer.interruptSession(session.id);
      return;
    }
    const staleProcess = session.process;
    if (!staleProcess) return;
    try { staleProcess.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { staleProcess.kill('SIGKILL'); } catch {}
    }, 3000);
  }

  private resolveTransportMode(
    backend: Backend,
    sessionId: string,
    requested?: TransportMode
  ): TransportMode {
    if (sessionId.startsWith('codex-thread:')) return 'official-remote';
    if (sessionId.startsWith('claude-session:')) return requested || 'bridge';
    if (requested === 'bridge' || requested === 'official-remote') return requested;
    return backend === 'codex' ? 'official-remote' : 'bridge';
  }

  private codexSandboxMode(permissionMode?: PermissionMode): string {
    if (permissionMode === 'plan') return 'read-only';
    if (permissionMode === 'bypassPermissions') return 'danger-full-access';
    return 'workspace-write';
  }

  private codexApprovalPolicy(permissionMode?: PermissionMode): string {
    if (permissionMode === 'plan' || permissionMode === 'bypassPermissions') return 'never';
    if (permissionMode === 'auto') return 'on-failure';
    return 'on-request';
  }

  private commandString(args: string[]): string {
    return args.map(arg => /^[A-Za-z0-9_./:=@+-]+$/.test(arg)
      ? arg
      : `"${arg.replace(/"/g, '""')}"`).join(' ');
  }
}
