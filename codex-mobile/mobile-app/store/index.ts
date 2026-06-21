import { create } from 'zustand';
import { ConnectionState, Backend } from '../services/websocket';
import { ApiProfile } from '../services/profiles';

export type EffortLevel = 'low' | 'medium' | 'high';
export type PermissionMode = 'default' | 'plan' | 'auto' | 'bypassPermissions';
export type ResponseSpeed = 'standard' | 'priority';
export type TransportMode = 'bridge' | 'official-remote';
export type ApprovalDecision = 'approve_once' | 'approve_session' | 'deny' | 'cancel';
export type ApprovalKind = 'command' | 'file_change' | 'permissions' | 'unknown';

export interface AgentCapabilities {
  claudeRemoteControlAvailable: boolean;
  codexAppServerAvailable: boolean;
  persistentSessions: boolean;
  liveApprovals: boolean;
  canStop: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  lastUsed?: number;
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  backend: Backend;
  kind: ApprovalKind;
  title: string;
  preview: string;
  method?: string;
  command?: string;
  cwd?: string;
  reason?: string;
  grantRoot?: string;
  permissions?: Record<string, unknown>;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isThinking?: boolean;
  toolUse?: {
    toolName: string;
    toolId: string;
    input: Record<string, unknown>;
    status?: string;
    output?: string;
    exitCode?: number | null;
    durationMs?: number | null;
    patch?: unknown;
  };
}

export interface Session {
  id: string;
  name: string;
  backend: Backend;
  cwd?: string;
  messages: ChatMessage[];
  tokenUsage: { input: number; output: number; cost: number };
  state: 'running' | 'idle' | 'crashed';
  lastActivity: number;
  messageCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: number | null;
  transportMode?: TransportMode;
}

export interface RemoteSessionInfo {
  id: string;
  name?: string;
  backend: Backend;
  cwd?: string;
  lastActivity?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  state?: Session['state'];
  isRunning?: boolean;
  messageCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: number | null;
  transportMode?: TransportMode;
}

interface AppState {
  connectionState: ConnectionState;
  sessions: Session[];
  activeSessionId: string | null;
  // True when the user tapped "new chat": show a blank thread (suppress the
  // fallback-to-latest in useAgentSession) until they send the first message.
  composingNew: boolean;
  activeBackend: Backend;
  theme: 'light' | 'dark';
  serverUrl: string;
  claudeModel: string;
  codexModel: string;
  claudeModels: string[];
  codexModels: string[];
  effortLevel: EffortLevel;
  permissionMode: PermissionMode;
  claudeTransportMode: TransportMode;
  codexTransportMode: TransportMode;
  codexResponseSpeed: ResponseSpeed;
  transportMode: TransportMode;
  agentCapabilities: AgentCapabilities;
  workspacePath: string;
  availableWorkspaces: WorkspaceInfo[];
  availableTools: string[];
  pendingApprovals: ApprovalRequest[];
  apiConfig: { baseUrl: string; apiKey: string; model: string };
  profiles: ApiProfile[];
  activeProfileId: string | null;
  scannedPairing: { lanUrls: string[]; tunnelUrl: string; code: string } | null;

  setConnectionState: (state: ConnectionState) => void;
  setServerUrl: (url: string) => void;
  setClaudeModel: (model: string) => void;
  setCodexModel: (model: string) => void;
  setClaudeModels: (models: string[]) => void;
  setCodexModels: (models: string[]) => void;
  setEffortLevel: (level: EffortLevel) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setClaudeTransportMode: (mode: TransportMode) => void;
  setCodexTransportMode: (mode: TransportMode) => void;
  setCodexResponseSpeed: (speed: ResponseSpeed) => void;
  setTransportMode: (mode: TransportMode) => void;
  setAgentCapabilities: (capabilities: Partial<AgentCapabilities>) => void;
  setWorkspacePath: (path: string) => void;
  setAvailableWorkspaces: (workspaces: WorkspaceInfo[]) => void;
  setAvailableTools: (tools: string[]) => void;
  addApprovalRequest: (request: ApprovalRequest) => void;
  resolveApprovalRequest: (approvalId: string) => void;
  clearSessionApprovals: (sessionId: string) => void;
  setApiConfig: (cfg: { baseUrl: string; apiKey: string; model: string }) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveBackend: (backend: Backend) => void;
  setProfiles: (profiles: ApiProfile[]) => void;
  setActiveProfile: (id: string) => void;
  setScannedPairing: (pairing: { lanUrls: string[]; tunnelUrl: string; code: string } | null) => void;
  addSession: (session: Session) => void;
  mergeRemoteSessions: (sessions: RemoteSessionInfo[]) => void;
  setActiveSession: (id: string) => void;
  startNewSession: () => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  updateStreamingMessage: (sessionId: string, text: string) => void;
  updateToolMessage: (sessionId: string, toolId: string, update: Record<string, unknown>) => void;
  completeStreaming: (sessionId: string) => void;
  updateTokenUsage: (sessionId: string, input: number, output: number, cost: number) => void;
  updateSessionState: (sessionId: string, state: Session['state']) => void;
  updateSessionTransportMode: (sessionId: string, mode: TransportMode) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  connectionState: 'disconnected',
  sessions: [],
  activeSessionId: null,
  composingNew: false,
  activeBackend: 'claude-code',
  theme: 'dark',
  serverUrl: '',
  claudeModel: '',
  codexModel: '',
  claudeModels: [],
  codexModels: [],
  effortLevel: 'high',
  permissionMode: 'default',
  claudeTransportMode: 'bridge',
  codexTransportMode: 'official-remote',
  codexResponseSpeed: 'standard',
  transportMode: 'bridge',
  agentCapabilities: {
    claudeRemoteControlAvailable: false,
    codexAppServerAvailable: false,
    persistentSessions: false,
    liveApprovals: false,
    canStop: true,
  },
  workspacePath: '',
  availableWorkspaces: [],
  availableTools: [],
  pendingApprovals: [],
  apiConfig: { baseUrl: '', apiKey: '', model: '' },
  profiles: [],
  activeProfileId: null,
  scannedPairing: null,

  setConnectionState: (state) => set({ connectionState: state }),
  setServerUrl: (url) => set({ serverUrl: url }),
  setClaudeModel: (model) => set({ claudeModel: model }),
  setCodexModel: (model) => set({ codexModel: model }),
  setClaudeModels: (models) => set({ claudeModels: models }),
  setCodexModels: (models) => set({ codexModels: models }),
  setEffortLevel: (level) => set({ effortLevel: level }),
  setPermissionMode: (mode) => set({ permissionMode: mode }),
  setClaudeTransportMode: (mode) => set((s) => {
    const latest = latestSessionFor(s.sessions, 'claude-code', mode);
    return { claudeTransportMode: mode, activeSessionId: latest?.id ?? null };
  }),
  setCodexTransportMode: (mode) => set((s) => {
    const latest = latestSessionFor(s.sessions, 'codex', mode);
    return { codexTransportMode: mode, activeSessionId: latest?.id ?? null };
  }),
  setCodexResponseSpeed: (speed) => set({ codexResponseSpeed: speed }),
  setTransportMode: (mode) => set({ transportMode: mode }),
  setAgentCapabilities: (capabilities) => set((s) => ({
    agentCapabilities: { ...s.agentCapabilities, ...capabilities },
  })),
  setWorkspacePath: (path) => set({ workspacePath: path }),
  setAvailableWorkspaces: (workspaces) => set((s) => ({
    availableWorkspaces: workspaces,
    workspacePath: s.workspacePath || workspaces[0]?.path || '',
  })),
  setAvailableTools: (tools) => set({ availableTools: tools }),
  addApprovalRequest: (request) => set((s) => ({
    pendingApprovals: [
      ...s.pendingApprovals.filter(item => item.id !== request.id),
      request,
    ],
  })),
  resolveApprovalRequest: (approvalId) => set((s) => ({
    pendingApprovals: s.pendingApprovals.filter(item => item.id !== approvalId),
  })),
  clearSessionApprovals: (sessionId) => set((s) => ({
    pendingApprovals: s.pendingApprovals.filter(item => item.sessionId !== sessionId),
  })),
  setApiConfig: (cfg) => set({ apiConfig: cfg }),
  setTheme: (theme) => set({ theme }),
  setActiveBackend: (backend) => set((s) => {
    const mode = backend === 'codex' ? s.codexTransportMode : s.claudeTransportMode;
    const latest = [...s.sessions]
      .filter(sess => sess.backend === backend && (!sess.transportMode || sess.transportMode === mode))
      .sort((a, b) => b.lastActivity - a.lastActivity)[0];
    return { activeBackend: backend, activeSessionId: latest?.id ?? null };
  }),
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (id) => {
    const profile = get().profiles.find(p => p.id === id);
    if (profile) {
      set({ activeProfileId: id, apiConfig: { baseUrl: profile.baseUrl, apiKey: profile.apiKey, model: profile.model } });
    }
  },
  setScannedPairing: (pairing) => set({ scannedPairing: pairing }),

  addSession: (session) => set((s) => ({
    sessions: [...s.sessions, session],
    activeSessionId: session.id,
    activeBackend: session.backend,
    composingNew: false,
  })),

  mergeRemoteSessions: (remoteSessions) => set((s) => {
    const localById = new Map(s.sessions.map(session => [session.id, session]));
    const merged = [...s.sessions];

    for (const remote of remoteSessions) {
      const existing = localById.get(remote.id);
      const tokenUsage = {
        input: remote.totalInputTokens || existing?.tokenUsage.input || 0,
        output: remote.totalOutputTokens || existing?.tokenUsage.output || 0,
        cost: existing?.tokenUsage.cost || 0,
      };
      const state: Session['state'] = remote.state
        || (remote.isRunning ? 'running' : existing?.state || 'idle');

      if (existing) {
        const index = merged.findIndex(session => session.id === remote.id);
        merged[index] = {
          ...existing,
          name: remote.name || existing.name,
          cwd: remote.cwd || existing.cwd,
          tokenUsage,
          state,
          lastActivity: remote.lastActivity || existing.lastActivity,
          messageCount: remote.messageCount ?? existing.messageCount,
          lastMessagePreview: remote.lastMessagePreview ?? existing.lastMessagePreview,
          lastMessageAt: remote.lastMessageAt ?? existing.lastMessageAt,
          transportMode: remote.transportMode ?? existing.transportMode,
        };
      } else {
        merged.push({
          id: remote.id,
          name: remote.name || `${remote.backend} session`,
          backend: remote.backend,
          cwd: remote.cwd,
          messages: [],
          tokenUsage,
          state,
          lastActivity: remote.lastActivity || Date.now(),
          messageCount: remote.messageCount,
          lastMessagePreview: remote.lastMessagePreview,
          lastMessageAt: remote.lastMessageAt,
          transportMode: remote.transportMode,
        });
      }
    }

    // Pick a default active session ONLY within the user's currently selected
    // backend+transportMode. Never switch activeBackend here: the user picks the
    // backend in settings, and a refresh of the remote session list (which
    // includes the other backend's history) must not yank them to claude-code
    // just because the globally-newest session happens to be a Claude one.
    const mode = s.activeBackend === 'codex' ? s.codexTransportMode : s.claudeTransportMode;
    const inScope = [...merged]
      .filter(session => session.backend === s.activeBackend && (!session.transportMode || session.transportMode === mode))
      .sort((a, b) => b.lastActivity - a.lastActivity);
    const activeStillValid = !!s.activeSessionId && inScope.some(session => session.id === s.activeSessionId);
    // While the user is composing a brand-new chat, do NOT auto-pick a session —
    // a session_list refresh (relay pushes these on connect) would otherwise
    // yank them back into the latest old conversation the moment they tap "new".
    const activeSessionId = s.composingNew
      ? s.activeSessionId
      : (activeStillValid ? s.activeSessionId : (inScope[0]?.id ?? null));

    return {
      sessions: merged.sort((a, b) => b.lastActivity - a.lastActivity),
      activeSessionId,
      activeBackend: s.activeBackend,
    };
  }),

  setActiveSession: (id) => set((s) => {
    const session = s.sessions.find(sess => sess.id === id);
    if (!session) return { activeSessionId: id };
    // Align backend AND transportMode to the opened session, otherwise
    // useAgentSession's exact match fails (transportMode mismatch) and it falls
    // back to a different session — making a Codex session show Claude content.
    const mode = session.transportMode;
    const backendModePatch = mode
      ? session.backend === 'codex'
        ? { codexTransportMode: mode }
        : { claudeTransportMode: mode }
      : {};
    return {
      activeSessionId: id,
      activeBackend: session.backend,
      composingNew: false,
      ...backendModePatch,
    };
  }),

  // Start a blank chat in the current backend/mode. We don't create a session
  // object yet — useAgentSession.send() will mint one on the first message.
  // composingNew suppresses the "fall back to latest session" behavior so the
  // thread shows empty until then.
  startNewSession: () => set({ activeSessionId: null, composingNew: true }),

  setSessionMessages: (sessionId, messages) => set((s) => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const normalized = normalizeMessages(messages);
      return {
        ...sess,
        messages: normalized,
        ...messageSummary(normalized),
        lastActivity: Date.now(),
      };
    }),
  })),

  appendMessage: (sessionId, msg) => set((s) => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const messages = [...sess.messages, msg];
      return { ...sess, messages, ...messageSummary(messages), lastActivity: Date.now() };
    }),
  })),

  updateStreamingMessage: (sessionId, text) => set((s) => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const msgs = [...sess.messages];
      const last = msgs[msgs.length - 1];
      if (last?.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      } else {
        msgs.push({ id: Date.now().toString(), role: 'assistant', content: text, timestamp: Date.now(), isStreaming: true });
      }
      return { ...sess, messages: msgs, ...messageSummary(msgs), lastActivity: Date.now() };
    }),
  })),

  updateToolMessage: (sessionId, toolId, update) => set((s) => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      let found = false;
      const messages = sess.messages.map(msg => {
        if (msg.toolUse?.toolId !== toolId) return msg;
        found = true;
        const nextOutput = typeof update.appendOutput === 'string'
          ? `${msg.toolUse.output || ''}${update.appendOutput}`.slice(-12000)
          : typeof update.output === 'string'
            ? update.output.slice(-12000)
            : msg.toolUse.output;
        return {
          ...msg,
          toolUse: {
            ...msg.toolUse,
            input: typeof update.input === 'object' && update.input
              ? { ...msg.toolUse.input, ...update.input as Record<string, unknown> }
              : msg.toolUse.input,
            status: typeof update.status === 'string' ? update.status : msg.toolUse.status,
            output: nextOutput,
            exitCode: typeof update.exitCode === 'number' || update.exitCode === null
              ? update.exitCode as number | null
              : msg.toolUse.exitCode,
            durationMs: typeof update.durationMs === 'number' || update.durationMs === null
              ? update.durationMs as number | null
              : msg.toolUse.durationMs,
            patch: update.patch ?? msg.toolUse.patch,
          },
        };
      });

      if (!found) {
        messages.push({
          id: `tool-${Date.now()}`,
          role: 'system',
          content: '',
          timestamp: Date.now(),
          toolUse: {
            toolName: String(update.toolName || 'tool'),
            toolId,
            input: typeof update.input === 'object' && update.input ? update.input as Record<string, unknown> : {},
            status: typeof update.status === 'string' ? update.status : undefined,
            output: typeof update.output === 'string'
              ? update.output.slice(-12000)
              : typeof update.appendOutput === 'string'
                ? update.appendOutput.slice(-12000)
                : undefined,
          },
        });
      }

      return { ...sess, messages, ...messageSummary(messages), lastActivity: Date.now() };
    }),
  })),

  completeStreaming: (sessionId) => set((s) => ({
    sessions: s.sessions.map(sess => {
      if (sess.id !== sessionId) return sess;
      const msgs = sess.messages.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
      return { ...sess, messages: msgs, ...messageSummary(msgs), state: sess.state === 'running' ? 'idle' : sess.state, lastActivity: Date.now() };
    }),
  })),

  updateTokenUsage: (sessionId, input, output, cost) => set((s) => ({
    sessions: s.sessions.map(sess =>
      sess.id === sessionId
        ? { ...sess, tokenUsage: { input: sess.tokenUsage.input + input, output: sess.tokenUsage.output + output, cost: sess.tokenUsage.cost + cost } }
        : sess
    ),
  })),

  updateSessionState: (sessionId, state) => set((s) => ({
    sessions: s.sessions.map(sess =>
      sess.id === sessionId
        ? { ...sess, state, lastActivity: Date.now() }
        : sess
    ),
  })),

  updateSessionTransportMode: (sessionId, mode) => set((s) => ({
    sessions: s.sessions.map(sess =>
      sess.id === sessionId ? { ...sess, transportMode: mode } : sess
    ),
  })),
}));

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message, index) => ({
    ...message,
    id: message.id || `msg-${index}`,
    timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now(),
    content: typeof message.content === 'string' ? message.content : '',
  }));
}

function messageSummary(messages: ChatMessage[]) {
  const last = [...messages].reverse().find(message =>
    message.content || message.toolUse?.output || message.toolUse?.toolName
  );
  return {
    messageCount: messages.length,
    lastMessagePreview: previewMessage(last),
    lastMessageAt: last?.timestamp || null,
  };
}

function previewMessage(message?: ChatMessage) {
  if (!message) return '';
  if (message.content) return message.content.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (message.toolUse?.output) return message.toolUse.output.replace(/\s+/g, ' ').trim().slice(0, 180);
  if (message.toolUse?.toolName) return `工具：${message.toolUse.toolName}`;
  return '';
}

function latestSessionFor(sessions: Session[], backend: Backend, mode: TransportMode): Session | undefined {
  return [...sessions]
    .filter(session => session.backend === backend && (!session.transportMode || session.transportMode === mode))
    .sort((a, b) => b.lastActivity - a.lastActivity)[0];
}
