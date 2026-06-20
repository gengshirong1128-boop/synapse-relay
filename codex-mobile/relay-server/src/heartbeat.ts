/**
 * Pure helper for the heartbeat liveness decision, extracted from RelayServer
 * so the (subtle) missed-beat tolerance can be unit-tested without sockets.
 */

export interface HeartbeatState {
  isAlive: boolean;
  missedHeartbeats: number;
}

export interface HeartbeatDecision {
  /** Next state to store back on the client. */
  next: HeartbeatState;
  /** Whether the connection should be terminated this cycle. */
  terminate: boolean;
}

/**
 * Decide a client's fate for one heartbeat cycle.
 *
 * The client sends a ping every ~30s which sets isAlive=true; this checker also
 * runs every ~30s. Because the two cycles race, a single late ping (tunnel
 * latency) must NOT kill an otherwise-healthy connection. So we only terminate
 * after `maxMissed` consecutive cycles with no ping.
 *
 * - If a ping arrived since last check (isAlive): reset and keep alive.
 * - Otherwise: increment the missed counter, terminate once it reaches maxMissed.
 */
export function evaluateHeartbeat(state: HeartbeatState, maxMissed = 2): HeartbeatDecision {
  if (state.isAlive) {
    return { next: { isAlive: false, missedHeartbeats: 0 }, terminate: false };
  }
  const missedHeartbeats = state.missedHeartbeats + 1;
  return {
    next: { isAlive: false, missedHeartbeats },
    terminate: missedHeartbeats >= maxMissed,
  };
}
