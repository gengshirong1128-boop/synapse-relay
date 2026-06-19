export type Backend = 'claude-code' | 'codex';

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
    permissionMode?: string;
    transportMode?: string;
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
  payload: Record<string, any>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

type MessageHandler = (msg: ServerMessage) => void;

export class RelayClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private messageQueue: ClientMessage[] = [];
  private _state: ConnectionState = 'disconnected';
  private onStateChange?: (state: ConnectionState) => void;
  private chunkBuffers = new Map<string, { total: number; parts: string[] }>();

  get state(): ConnectionState { return this._state; }

  setStateListener(fn: (state: ConnectionState) => void): void {
    this.onStateChange = fn;
  }

  connect(url: string, token?: string): void {
    this.url = url;
    this.token = token || null;
    this.maxReconnectAttempts = 10;
    this.doConnect();
  }

  private doConnect(): void {
    this.setState('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      if (this.token) {
        this.sendRaw({ type: 'auth', payload: { token: this.token } });
      }
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        if (raw.type === '__chunk') {
          const { chunkId, index, total, data } = raw.payload;
          if (!this.chunkBuffers.has(chunkId)) {
            this.chunkBuffers.set(chunkId, { total, parts: new Array(total).fill('') });
          }
          const buf = this.chunkBuffers.get(chunkId)!;
          buf.parts[index] = data;
          const received = buf.parts.filter(p => p !== '').length;
          if (received === buf.total) {
            const full = buf.parts.join('');
            this.chunkBuffers.delete(chunkId);
            const msg: ServerMessage = JSON.parse(full);
            this.handlers.forEach(h => h(msg));
          }
          return;
        }
        const msg: ServerMessage = raw;
        this.handlers.forEach(h => h(msg));
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      this.setState('disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private setState(s: ConnectionState): void {
    this._state = s;
    this.onStateChange?.(s);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.sendRaw(msg);
    }
  }

  private sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(msg);
    } else {
      this.messageQueue.push(msg);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  setToken(token: string): void {
    this.token = token;
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.maxReconnectAttempts = 0;
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
  }
}

export const relayClient = new RelayClient();
