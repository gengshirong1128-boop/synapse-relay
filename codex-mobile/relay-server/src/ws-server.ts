import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { RelayConfig } from './config';
import { AuthManager } from './auth';
import { ProcessManager, Backend, PermissionMode, TransportMode } from './process-manager';
import { TokenTracker } from './token-tracker';
import { FileService } from './file-service';
import { SessionStore } from './session-store';
import { PushService } from './push-service';
import { createLogger } from './logger';
import { readAgentInfo } from './agent-info';
import { evaluateHeartbeat } from './heartbeat';
import { discoverWorkspaces } from './workspace-discovery';

const log = createLogger('ws');

export interface ClientMessage {
  type: 'auth' | 'command' | 'file_list' | 'file_content' | 'switch_backend'
    | 'session_list' | 'session_subscribe' | 'session_kill' | 'session_restart' | 'register_push'
    | 'desktop_sessions' | 'list_workspaces' | 'agent_info' | 'approval_response';
  sessionId?: string;
  payload: {
    pairingCode?: string;
    token?: string;
    text?: string;
    path?: string;
    backend?: Backend;
    model?: string;
    effortLevel?: string;
    permissionMode?: PermissionMode;
    transportMode?: TransportMode;
    responseSpeed?: string;
    cwd?: string;
    desktopSessionId?: string;
    apiConfig?: { baseUrl: string; apiKey: string; model: string };
    pushToken?: string;
    approvalId?: string;
    decision?: 'approve_once' | 'approve_session' | 'deny' | 'cancel';
  };
}

export interface ServerMessage {
  type: 'auth_result' | 'output' | 'status' | 'file_list_result'
    | 'file_content_result' | 'token_usage' | 'error' | 'notification'
    | 'session_list_result' | 'desktop_sessions_result' | 'workspaces_result'
    | 'agent_info_result' | 'approval_request' | 'approval_resolved'
    | 'session_transcript';
  sessionId?: string;
  payload: Record<string, unknown>;
}

interface AuthenticatedClient {
  ws: WebSocket;
  clientId: string;
  sessionId?: string;
  isAlive: boolean;
  missedHeartbeats: number;
  pushToken?: string;
  lastActivity: number;
}

export class RelayServer {
  private wss: WebSocketServer;
  private auth: AuthManager;
  private processManager: ProcessManager;
  private tokenTracker: TokenTracker;
  private sessionStore: SessionStore;
  private pushService: PushService;
  private clients = new Map<WebSocket, AuthenticatedClient>();
  private heartbeatInterval: ReturnType<typeof setInterval>;
  private timeoutInterval: ReturnType<typeof setInterval>;

  constructor(
    private config: RelayConfig,
    auth: AuthManager,
    processManager: ProcessManager
  ) {
    this.auth = auth;
    this.processManager = processManager;
    this.tokenTracker = new TokenTracker();
    this.sessionStore = new SessionStore();
    this.pushService = new PushService();

    if (config.tls.enabled) {
      const httpsServer = createHttpsServer({
        cert: readFileSync(config.tls.certPath),
        key: readFileSync(config.tls.keyPath),
      });
      this.wss = new WebSocketServer({ server: httpsServer });
      httpsServer.listen(config.port);
      log.info('Server started (WSS/TLS)', { port: config.port });
    } else {
      this.wss = new WebSocketServer({ port: config.port });
      log.info('Server started (WS)', { port: config.port });
    }

    this.setupProcessEvents();
    this.setupServer();
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 30000);
    this.timeoutInterval = setInterval(() => this.checkSessionTimeouts(), 60000);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws) => {
      log.info('New connection');
      ws.on('message', (raw) => {
        const str = raw.toString();
        log.debug('Received', { msg: str.slice(0, 200) });
        if (str === '{"type":"ping"}') {
          const client = this.clients.get(ws);
          if (client) { client.isAlive = true; client.missedHeartbeats = 0; }
          ws.send('{"type":"pong"}');
          return;
        }

        try {
          const msg: ClientMessage = JSON.parse(str);
          this.handleMessage(ws, msg);
        } catch {
          this.send(ws, { type: 'error', payload: { message: 'Invalid JSON' } });
        }
      });
      ws.on('close', () => { this.clients.delete(ws); });
    });
  }

  private setupProcessEvents(): void {
    this.processManager.on('status', (sid: string, status: Record<string, unknown>) => {
      this.broadcast(sid, { type: 'status', sessionId: sid, payload: status });
      void this.broadcastSessionList();
    });

    this.processManager.on('output', (sid: string, text: string) => {
      this.sessionStore.updateStreamingMessage(sid, text);
      this.broadcast(sid, { type: 'output', sessionId: sid, payload: { text, isComplete: false } });
    });

    this.processManager.on('thinking', (sid: string, text: string) => {
      this.sessionStore.appendMessage(sid, {
        id: `think-${Date.now()}`,
        role: 'system',
        content: text,
        timestamp: Date.now(),
        isThinking: true,
      });
      this.broadcast(sid, { type: 'output', sessionId: sid, payload: { thinking: text, isComplete: false } });
    });

    this.processManager.on('init', (sid: string, info: Record<string, unknown>) => {
      this.broadcast(sid, { type: 'status', sessionId: sid, payload: { processState: 'running', ...info } });
    });

    this.processManager.on('tool_use', (sid: string, tool: Record<string, unknown>) => {
      this.sessionStore.appendMessage(sid, {
        id: `tool-${Date.now()}`,
        role: 'system',
        content: '',
        timestamp: Date.now(),
        toolUse: {
          toolName: String(tool.toolName || 'tool'),
          toolId: String(tool.toolId || `tool-${Date.now()}`),
          input: this.recordPayload(tool.input),
          status: typeof tool.status === 'string' ? tool.status : undefined,
        },
      });
      this.broadcast(sid, { type: 'output', sessionId: sid, payload: { text: '', isComplete: false, toolUse: tool } });
    });

    this.processManager.on('tool_update', (sid: string, update: Record<string, unknown>) => {
      if (update.toolId) this.sessionStore.updateToolMessage(sid, String(update.toolId), update);
      this.broadcast(sid, { type: 'output', sessionId: sid, payload: { text: '', isComplete: false, toolUpdate: update } });
    });

    this.processManager.on('approval_request', (sid: string, request: Record<string, unknown>) => {
      this.broadcast(sid, { type: 'approval_request', sessionId: sid, payload: request });
    });

    this.processManager.on('approval_resolved', (sid: string, result: Record<string, unknown>) => {
      this.broadcast(sid, { type: 'approval_resolved', sessionId: sid, payload: result });
    });

    this.processManager.on('usage', (sid: string, usage: Record<string, number>) => {
      this.broadcast(sid, { type: 'token_usage', sessionId: sid, payload: usage });
      this.sessionStore.updateActivity(sid, usage.inputTokens, usage.outputTokens);
      void this.broadcastSessionList();
    });

    this.processManager.on('exit', (sid: string, code: number) => {
      this.broadcast(sid, {
        type: 'status',
        sessionId: sid,
        payload: { processState: code === 0 ? 'idle' : 'crashed' },
      });
      this.sessionStore.completeStreaming(sid);
      this.broadcast(sid, { type: 'output', sessionId: sid, payload: { text: '', isComplete: true } });
      this.sessionStore.updateActivity(sid);
      void this.broadcastSessionList();
      this.notifySessionExit(sid, code);
    });

    this.processManager.on('process_error', (sid: string, message: string) => {
      this.sessionStore.appendMessage(sid, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `错误：${message}`,
        timestamp: Date.now(),
      });
      this.broadcast(sid, { type: 'error', sessionId: sid, payload: { message } });
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    if (msg.type === 'auth') {
      this.handleAuth(ws, msg);
      return;
    }

    const client = this.clients.get(ws);
    if (!client) {
      this.send(ws, { type: 'error', payload: { message: 'Not authenticated' } });
      return;
    }

    switch (msg.type) {
      case 'command': void this.handleCommand(client, msg); break;
      case 'file_list': this.handleFileList(client, msg); break;
      case 'file_content': this.handleFileContent(client, msg); break;
      case 'switch_backend': this.handleSwitchBackend(client, msg); break;
      case 'session_list': void this.handleSessionList(client); break;
      case 'session_subscribe': void this.handleSessionSubscribe(client, msg); break;
      case 'session_kill': this.handleSessionKill(client, msg); break;
      case 'session_restart': this.handleSessionRestart(client, msg); break;
      case 'register_push': this.handleRegisterPush(client, msg); break;
      case 'desktop_sessions': this.handleDesktopSessions(client, msg); break;
      case 'list_workspaces': void this.handleListWorkspaces(client); break;
      case 'agent_info': void this.handleAgentInfo(client, msg); break;
      case 'approval_response': this.handleApprovalResponse(client, msg); break;
    }
  }

  private handleAuth(ws: WebSocket, msg: ClientMessage): void {
    const { pairingCode, token } = msg.payload;
    if (token) {
      const decoded = this.auth.verifyToken(token);
      if (decoded) {
        this.clients.set(ws, { ws, clientId: decoded.clientId, isAlive: true, missedHeartbeats: 0, lastActivity: Date.now() });
        this.send(ws, { type: 'auth_result', payload: { success: true } });
        return;
      }
    }

    if (pairingCode && this.auth.verifyPairingCode(pairingCode)) {
      const clientId = randomUUID();
      const newToken = this.auth.generateToken(clientId);
      this.clients.set(ws, { ws, clientId, isAlive: true, missedHeartbeats: 0, lastActivity: Date.now() });
      this.send(ws, { type: 'auth_result', payload: { success: true, token: newToken } });
      return;
    }

    this.send(ws, { type: 'auth_result', payload: { success: false } });
  }

  private async handleCommand(client: AuthenticatedClient, msg: ClientMessage): Promise<void> {
    client.lastActivity = Date.now();
    const sessionId = msg.sessionId || randomUUID();
    const backend = (msg.payload.backend || 'claude-code') as Backend;
    const transportMode = this.normalizeTransportMode(backend, sessionId, msg.payload.transportMode);
    // A resumed Claude history session is cwd-scoped: `claude --resume` only
    // finds it when run from the directory it was recorded in. The phone may
    // send a stale global workspace, so prefer the cwd stored in the session
    // file. Only do this for a session we haven't started yet this run.
    const cwd = !this.processManager.getSession(sessionId)
      ? await this.resolveResumeCwd(sessionId, msg.payload.cwd)
      : msg.payload.cwd || this.defaultWorkspacePath();

    if (!this.processManager.getSession(sessionId)) {
      this.processManager.startSession(sessionId, backend, cwd, transportMode);
      this.sessionStore.upsert({
        id: sessionId,
        backend,
        cwd,
        transportMode,
        name: `${backend === 'codex' ? 'Codex' : 'Claude Code'} ${transportMode === 'official-remote' ? 'Desktop' : 'CLI'} · ${this.workspaceName(cwd)}`,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        messages: [],
      });
      log.info('Session created', { sessionId, backend, cwd });
    } else {
      const session = this.processManager.getSession(sessionId);
      if (session && session.state !== 'running') session.transportMode = transportMode;
    }

    client.sessionId = sessionId;
    this.sessionStore.updateActivity(sessionId);
    if (msg.payload.text?.trim()) {
      this.sessionStore.appendMessage(sessionId, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: msg.payload.text.trim(),
        timestamp: Date.now(),
      });
    }

    const ok = this.processManager.runCommand(
      sessionId,
      msg.payload.text || '',
      this.buildAgentEnv(backend, msg.payload.apiConfig),
      msg.payload.model,
      msg.payload.effortLevel,
      msg.payload.permissionMode,
      msg.payload.responseSpeed,
    );

    if (!ok) {
      this.send(client.ws, {
        type: 'error',
        sessionId,
        payload: { message: 'Session busy, wait for current command to finish' },
      });
    }
  }

  // For a resumed history session, the directory it was recorded in wins over
  // whatever cwd the phone sent — otherwise `claude --resume` can't find it.
  private async resolveResumeCwd(sessionId: string, requestedCwd?: string): Promise<string> {
    if (sessionId.startsWith('claude-session:')) {
      const snapshot = await this.processManager.readClaudeSessionSnapshot(sessionId);
      if (snapshot?.cwd) return snapshot.cwd;
    }
    if (sessionId.startsWith('codex-thread:')) {
      const snapshot = await this.processManager.readCodexThreadSnapshot(sessionId);
      if (snapshot?.cwd) return snapshot.cwd;
    }
    return requestedCwd || this.defaultWorkspacePath();
  }

  private handleFileList(client: AuthenticatedClient, msg: ClientMessage): void {
    const fileService = new FileService(msg.payload.cwd || this.defaultWorkspacePath());
    const files = fileService.listDirectory(msg.payload.path || '.');
    if (files) {
      this.send(client.ws, { type: 'file_list_result', payload: { files } });
    } else {
      this.send(client.ws, { type: 'error', payload: { message: 'Cannot read directory or access denied' } });
    }
  }

  private handleFileContent(client: AuthenticatedClient, msg: ClientMessage): void {
    const filePath = msg.payload.path;
    if (!filePath) {
      this.send(client.ws, { type: 'error', payload: { message: 'Path required' } });
      return;
    }

    const fileService = new FileService(msg.payload.cwd || this.defaultWorkspacePath());
    const result = fileService.readFile(filePath, 500);
    if (result) {
      this.send(client.ws, {
        type: 'file_content_result',
        payload: { content: result.content, path: result.path, truncated: result.truncated },
      });
    } else {
      this.send(client.ws, { type: 'error', payload: { message: 'Cannot read file or access denied' } });
    }
  }

  private handleSwitchBackend(client: AuthenticatedClient, msg: ClientMessage): void {
    client.lastActivity = Date.now();
    const backend = msg.payload.backend || 'claude-code';
    this.send(client.ws, { type: 'status', payload: { backend, processState: 'idle' } });
  }

  private async handleSessionList(client: AuthenticatedClient): Promise<void> {
    this.send(client.ws, { type: 'session_list_result', payload: await this.buildSessionListPayload() });
  }

  private async handleSessionSubscribe(client: AuthenticatedClient, msg: ClientMessage): Promise<void> {
    const sid = msg.sessionId;
    if (!sid) {
      this.send(client.ws, { type: 'error', payload: { message: 'sessionId required' } });
      return;
    }

    const processSession = this.processManager.getSession(sid);
    const storedSession = this.sessionStore.get(sid);
    const codexSnapshot = !processSession
      ? await this.processManager.readCodexThreadSnapshot(sid)
      : null;
    const claudeSnapshot = !processSession && !codexSnapshot
      ? await this.processManager.readClaudeSessionSnapshot(sid)
      : null;
    const remoteSnapshot = codexSnapshot || claudeSnapshot;
    if (!processSession && !storedSession && !remoteSnapshot) {
      this.send(client.ws, { type: 'error', sessionId: sid, payload: { message: 'Session not found' } });
      return;
    }

    client.sessionId = sid;
    client.lastActivity = Date.now();
    this.send(client.ws, {
      type: 'status',
      sessionId: sid,
      payload: {
        processState: processSession?.state || remoteSnapshot?.state || 'idle',
        backend: processSession?.backend || storedSession?.backend || remoteSnapshot?.backend,
        cwd: processSession?.cwd || storedSession?.cwd || remoteSnapshot?.cwd,
        transportMode: processSession?.transportMode || storedSession?.transportMode || remoteSnapshot?.transportMode,
      },
    });
    this.send(client.ws, {
      type: 'session_transcript',
      sessionId: sid,
      payload: { messages: remoteSnapshot?.messages || this.sessionStore.getMessages(sid) },
    });
    await this.handleSessionList(client);
  }

  private handleSessionKill(client: AuthenticatedClient, msg: ClientMessage): void {
    const sid = msg.sessionId;
    if (!sid) {
      this.send(client.ws, { type: 'error', payload: { message: 'sessionId required' } });
      return;
    }

    this.processManager.killSession(sid);
    log.info('Session killed', { sessionId: sid });
    this.send(client.ws, { type: 'status', sessionId: sid, payload: { processState: 'idle' } });
    this.send(client.ws, { type: 'output', sessionId: sid, payload: { text: '', isComplete: true } });
    void this.broadcastSessionList();
  }

  private async handleListWorkspaces(client: AuthenticatedClient): Promise<void> {
    const workspaces = await discoverWorkspaces(this.defaultWorkspacePath(), [
      resolve(process.cwd(), '..'),
      process.cwd(),
      resolve(process.cwd(), '..', 'mobile-app'),
    ]);
    this.send(client.ws, { type: 'workspaces_result', payload: { workspaces } });
  }

  private async handleAgentInfo(client: AuthenticatedClient, msg: ClientMessage): Promise<void> {
    const payload = await readAgentInfo({
      backend: msg.payload.backend || 'claude-code',
      claudeCodePath: this.config.claudeCodePath,
      codexPath: this.config.codexPath,
      workspacePath: this.defaultWorkspacePath(),
    });
    this.send(client.ws, { type: 'agent_info_result', payload: { ...payload } });
  }

  private async handleDesktopSessions(client: AuthenticatedClient, msg: ClientMessage): Promise<void> {
    try {
      const sessions = (await this.processManager.listClaudeSessions()).slice(0, 20).map(session => ({
        id: session.remoteSessionId,
        name: session.name,
        date: new Date(session.lastActivity).toISOString(),
        summary: session.lastMessagePreview,
      }));
      this.send(client.ws, { type: 'desktop_sessions_result', payload: { sessions } });
    } catch {
      this.send(client.ws, { type: 'desktop_sessions_result', payload: { sessions: [] } });
    }

    if (msg.payload.desktopSessionId) {
      const remoteId = msg.payload.desktopSessionId.startsWith('claude-session:')
        ? msg.payload.desktopSessionId
        : `claude-session:${msg.payload.desktopSessionId}`;
      const sessionId = msg.sessionId || remoteId;
      if (!this.processManager.getSession(sessionId)) {
        this.processManager.startSession(sessionId, 'claude-code', this.defaultWorkspacePath());
      }
      client.sessionId = sessionId;
      this.processManager.runCommand(sessionId, 'Continue from where I left off', {}, msg.payload.model);
      log.info('Resuming desktop session', { desktopId: msg.payload.desktopSessionId });
    }
  }

  private handleSessionRestart(client: AuthenticatedClient, msg: ClientMessage): void {
    const sid = msg.sessionId;
    if (!sid) {
      this.send(client.ws, { type: 'error', payload: { message: 'sessionId required' } });
      return;
    }

    const result = this.processManager.restartSession(sid);
    if (result) {
      log.info('Session restarted', { sessionId: sid });
      this.send(client.ws, { type: 'status', sessionId: sid, payload: { processState: 'idle' } });
      void this.broadcastSessionList();
    } else {
      this.send(client.ws, { type: 'error', payload: { message: 'Session not found' } });
    }
  }

  private handleRegisterPush(client: AuthenticatedClient, msg: ClientMessage): void {
    const pushToken = msg.payload.pushToken;
    if (!pushToken) {
      this.send(client.ws, { type: 'error', payload: { message: 'pushToken required' } });
      return;
    }
    client.pushToken = pushToken;
    this.pushService.registerToken(client.clientId, pushToken);
    log.info('Push token registered', { clientId: client.clientId });
  }

  private handleApprovalResponse(client: AuthenticatedClient, msg: ClientMessage): void {
    const sid = msg.sessionId;
    const approvalId = msg.payload.approvalId;
    const decision = msg.payload.decision;
    if (!sid || !approvalId || !decision) {
      this.send(client.ws, {
        type: 'error',
        sessionId: sid,
        payload: { message: 'approvalId and decision required' },
      });
      return;
    }

    client.lastActivity = Date.now();
    const ok = this.processManager.resolveApproval(sid, approvalId, decision);
    if (!ok) {
      this.send(client.ws, {
        type: 'error',
        sessionId: sid,
        payload: { message: 'Approval request not found' },
      });
    }
  }

  private buildAgentEnv(
    backend: Backend,
    apiConfig?: { baseUrl: string; apiKey: string; model: string },
  ): Record<string, string> {
    if (!apiConfig) return {};
    if (backend === 'claude-code') {
      return {
        ANTHROPIC_BASE_URL: apiConfig.baseUrl,
        ANTHROPIC_API_KEY: apiConfig.apiKey,
      };
    }
    return {
      OPENAI_BASE_URL: apiConfig.baseUrl,
      OPENAI_API_KEY: apiConfig.apiKey,
    };
  }

  private notifySessionExit(sessionId: string, code: number): void {
    const title = code === 0 ? '任务完成' : '任务异常退出';
    const body = `会话 ${sessionId.slice(0, 8)} ${code === 0 ? '已完成' : `异常退出(code=${code})`}`;
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.pushToken) {
        this.pushService.notify(client.clientId, title, body, { sessionId });
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify(msg);
    if (payload.length <= 65536) {
      ws.send(payload);
      return;
    }

    const chunks = Math.ceil(payload.length / 65536);
    const chunkId = randomUUID().slice(0, 8);
    for (let i = 0; i < chunks; i++) {
      const slice = payload.slice(i * 65536, (i + 1) * 65536);
      ws.send(JSON.stringify({
        type: '__chunk',
        payload: { chunkId, index: i, total: chunks, data: slice },
      }));
    }
  }

  private broadcast(sessionId: string, msg: ServerMessage): void {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        this.send(client.ws, msg);
      }
    }
  }

  private async broadcastSessionList(): Promise<void> {
    const payload = await this.buildSessionListPayload();
    for (const client of this.clients.values()) {
      this.send(client.ws, { type: 'session_list_result', payload });
    }
  }

  private async buildSessionListPayload(): Promise<{ sessions: Record<string, unknown>[] }> {
    const localSessions = this.sessionStore.getList().map(s => {
      const processSession = this.processManager.getSession(s.id);
      return {
        ...s,
        state: processSession?.state || 'idle',
        isRunning: processSession?.state === 'running',
        transportMode: processSession?.transportMode || s.transportMode,
      };
    });
    const byId = new Map<string, Record<string, unknown>>();
    for (const session of localSessions) byId.set(String(session.id), session);
    for (const session of await this.processManager.listClaudeSessions()) {
      const local = byId.get(session.id);
      byId.set(session.id, local ? { ...session, ...local } : session);
    }
    for (const thread of await this.processManager.listCodexThreads()) {
      const local = byId.get(thread.id);
      byId.set(thread.id, local ? { ...local, ...thread } : thread);
    }
    const sessions = Array.from(byId.values())
      .sort((a, b) => Number(b.lastActivity || 0) - Number(a.lastActivity || 0));
    return { sessions };
  }

  private checkHeartbeats(): void {
    for (const [ws, client] of this.clients.entries()) {
      const { next, terminate } = evaluateHeartbeat(client);
      client.isAlive = next.isAlive;
      client.missedHeartbeats = next.missedHeartbeats;
      if (terminate) {
        ws.terminate();
        this.clients.delete(ws);
      }
    }
  }

  private checkSessionTimeouts(): void {
    const now = Date.now();
    for (const [ws, client] of this.clients.entries()) {
      if (now - client.lastActivity > this.config.sessionTimeoutMs) {
        log.info('Client timed out', { clientId: client.clientId });
        this.send(ws, { type: 'error', payload: { message: 'Session timed out due to inactivity' } });
        ws.close(4008, 'Session timeout');
        this.clients.delete(ws);
      }
    }
  }

  close(): void {
    clearInterval(this.heartbeatInterval);
    clearInterval(this.timeoutInterval);
    this.wss.close();
  }

  private defaultWorkspacePath(): string {
    return resolve(process.cwd(), '..', '..');
  }

  private workspaceName(path: string): string {
    return path.split(/[\\/]/).filter(Boolean).pop() || path;
  }

  private normalizeTransportMode(
    backend: Backend,
    sessionId: string,
    requested?: TransportMode
  ): TransportMode {
    if (sessionId.startsWith('codex-thread:')) return 'official-remote';
    if (requested === 'bridge' || requested === 'official-remote') return requested;
    return backend === 'codex' ? 'official-remote' : 'bridge';
  }

  private recordPayload(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }
}
