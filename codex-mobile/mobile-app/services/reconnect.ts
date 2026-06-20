/**
 * Pure helpers for the relay WebSocket reconnect state machine, extracted so
 * the (subtle) backoff/give-up decisions can be unit-tested without a socket.
 */

export interface ReconnectState {
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  hasConnectedOnce: boolean;
}

/**
 * Decide whether another reconnect should be scheduled.
 *
 * Rule: once we've connected successfully at least once, retry forever (free
 * tunnels drop idle sockets often). Only the very first connect sequence is
 * capped at maxReconnectAttempts.
 */
export function shouldReconnect(state: ReconnectState): boolean {
  if (state.hasConnectedOnce) return true;
  return state.reconnectAttempts < state.maxReconnectAttempts;
}

/** Exponential backoff in ms, capped at 30s. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export interface ForegroundReconnectState {
  /** Has the client ever connected? Nothing to reconnect to otherwise. */
  hasConnectedOnce: boolean;
  /** Is a server url known? */
  hasUrl: boolean;
  /** Is the socket cleanly connected right now? */
  isConnected: boolean;
}

/**
 * Decide whether returning to the foreground should trigger an immediate
 * reconnect. We only act when there's a known endpoint we've reached before,
 * and we're not already cleanly connected — otherwise we'd churn a healthy
 * socket on every app switch.
 */
export function shouldReconnectNow(state: ForegroundReconnectState): boolean {
  return state.hasUrl && state.hasConnectedOnce && !state.isConnected;
}
