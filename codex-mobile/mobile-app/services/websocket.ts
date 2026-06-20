import { shouldReconnect, reconnectDelayMs, shouldReconnectNow, nextCandidateAction } from './reconnect';

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
  // Ordered connect candidates, LAN first then tunnel. We try LAN with a short
  // probe timeout so same-WiFi users get the fast direct path, and only fall
  // back to the tunnel when LAN can't be reached (remote / 4G).
  private candidates: string[] = [];
  private candidateIndex = 0;
  private probeTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private hasConnectedOnce = false;
  private awaitingPong = false;
  private messageQueue: ClientMessage[] = [];
  private _state: ConnectionState = 'disconnected';
  private onStateChange?: (state: ConnectionState) => void;
  private chunkBuffers = new Map<string, { total: number; parts: string[] }>();

  // LAN probe budget. A reachable same-subnet socket opens in well under this;
  // if it doesn't, we assume we're off-network and move on to the tunnel.
  private static readonly LAN_PROBE_MS = 3000;

  get state(): ConnectionState { return this._state; }

  setStateListener(fn: (state: ConnectionState) => void): void {
    this.onStateChange = fn;
  }

  connect(urls: string | string[], token?: string): void {
    const list = (Array.isArray(urls) ? urls : [urls]).map(u => (u || '').trim()).filter(Boolean);
    this.candidates = list.length ? list : [''];
    this.candidateIndex = 0;
    this.url = this.candidates[0];
    this.token = token || null;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
    this.hasConnectedOnce = false;
    this.awaitingPong = false;
    this.doConnect();
  }

  private doConnect(): void {
    this.setState('connecting');
    this.url = this.candidates[this.candidateIndex] || this.candidates[0] || this.url;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.advanceOrReconnect();
      return;
    }

    // If there's another candidate to try (e.g. LAN before tunnel), give this
    // one a short probe window; on timeout, close it and try the next.
    const hasFallback = this.candidateIndex < this.candidates.length - 1;
    if (hasFallback) {
      this.probeTimer = setTimeout(() => {
        if (this._state !== 'connected') {
          try { this.ws?.close(); } catch { /* noop */ }
        }
      }, RelayClient.LAN_PROBE_MS);
    }

    this.ws.onopen = () => {
      this.clearProbe();
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.hasConnectedOnce = true;
      this.awaitingPong = false;
      this.startHeartbeat();
      if (this.token) {
        this.sendRaw({ type: 'auth', payload: { token: this.token } });
      }
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string);
        if (raw.type === 'pong') {
          this.awaitingPong = false;
          return;
        }
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
      this.clearProbe();
      this.stopHeartbeat();
      // Not connected on this candidate and another remains in this round → try
      // the next address now (e.g. LAN failed, fall back to tunnel). This must
      // NOT depend on hasConnectedOnce: a user who connected via LAN at home and
      // then left the network still needs to fail over to the tunnel.
      if (this._state !== 'connected' && nextCandidateAction(this.candidateIndex, this.candidates.length) === 'advance') {
        this.candidateIndex++;
        this.doConnect();
        return;
      }
      // Exhausted this round (or a live connection dropped). Reset to the top of
      // the candidate list so the next backoff attempt re-probes LAN first.
      this.candidateIndex = 0;
      this.setState('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private clearProbe(): void {
    if (this.probeTimer) { clearTimeout(this.probeTimer); this.probeTimer = null; }
  }

  private advanceOrReconnect(): void {
    // WebSocket ctor threw for this candidate; try the next one in the round,
    // else reset to the top and schedule a backed-off retry.
    if (nextCandidateAction(this.candidateIndex, this.candidates.length) === 'advance') {
      this.candidateIndex++;
      this.doConnect();
    } else {
      this.candidateIndex = 0;
      this.scheduleReconnect();
    }
  }

  private setState(s: ConnectionState): void {
    this._state = s;
    this.onStateChange?.(s);
  }

  private scheduleReconnect(): void {
    // Once we've connected successfully, keep retrying indefinitely — free
    // tunnels drop idle sockets often, and giving up would strand the user on a
    // dead connection. Only the very first connect attempt is capped.
    if (!shouldReconnect({
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasConnectedOnce: this.hasConnectedOnce,
    })) return;
    const delay = reconnectDelayMs(this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // If the previous ping never got a pong, the link is dead (common with
        // free tunnels that silently drop idle WebSockets). Force a reconnect.
        if (this.awaitingPong) {
          this.ws.close();
          return;
        }
        this.awaitingPong = true;
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.awaitingPong = false;  // reset so a reconnect starts with a clean ping cycle
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

  // Called when the app returns to the foreground. Mobile OSes suspend sockets
  // in the background, so a connection that looks OPEN may actually be dead.
  // If we're not cleanly connected, cancel any pending backoff and reconnect
  // immediately instead of making the user wait out the exponential delay.
  reconnectNow(): void {
    const isConnected = this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
    if (!shouldReconnectNow({ hasUrl: !!this.url, hasConnectedOnce: this.hasConnectedOnce, isConnected })) return;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    // Tear down any half-dead socket left over from suspension before retrying.
    if (this.ws) { try { this.ws.close(); } catch { /* already closing */ } this.ws = null; }
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  setToken(token: string): void {
    this.token = token;
  }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.clearProbe();
    this.stopHeartbeat();
    this.maxReconnectAttempts = 0;
    this.hasConnectedOnce = false;  // user-initiated: do not auto-reconnect
    this.awaitingPong = false;
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
  }
}

export const relayClient = new RelayClient();
