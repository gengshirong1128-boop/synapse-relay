import { describe, it, expect } from 'vitest';
import { shouldReconnect, reconnectDelayMs, shouldReconnectNow, nextCandidateAction } from './reconnect';

describe('shouldReconnect', () => {
  it('retries while under the cap on the first-ever connect sequence', () => {
    expect(shouldReconnect({ reconnectAttempts: 3, maxReconnectAttempts: 10, hasConnectedOnce: false })).toBe(true);
  });

  it('gives up after the cap when never connected', () => {
    expect(shouldReconnect({ reconnectAttempts: 10, maxReconnectAttempts: 10, hasConnectedOnce: false })).toBe(false);
  });

  it('retries forever once it has connected at least once', () => {
    expect(shouldReconnect({ reconnectAttempts: 999, maxReconnectAttempts: 10, hasConnectedOnce: true })).toBe(true);
  });

  it('does not reconnect after a user-initiated disconnect (max=0, never reconnected)', () => {
    // disconnect() sets maxReconnectAttempts=0 and hasConnectedOnce=false
    expect(shouldReconnect({ reconnectAttempts: 0, maxReconnectAttempts: 0, hasConnectedOnce: false })).toBe(false);
  });
});

describe('reconnectDelayMs', () => {
  it('grows exponentially from 1s', () => {
    expect(reconnectDelayMs(0)).toBe(1000);
    expect(reconnectDelayMs(1)).toBe(2000);
    expect(reconnectDelayMs(2)).toBe(4000);
  });

  it('caps at 30s', () => {
    expect(reconnectDelayMs(10)).toBe(30000);
    expect(reconnectDelayMs(100)).toBe(30000);
  });
});

describe('shouldReconnectNow (app foregrounded)', () => {
  it('reconnects when previously connected but now dropped', () => {
    expect(shouldReconnectNow({ hasUrl: true, hasConnectedOnce: true, isConnected: false })).toBe(true);
  });

  it('does nothing when already cleanly connected (no churn on app switch)', () => {
    expect(shouldReconnectNow({ hasUrl: true, hasConnectedOnce: true, isConnected: true })).toBe(false);
  });

  it('does nothing before the first successful connect', () => {
    expect(shouldReconnectNow({ hasUrl: true, hasConnectedOnce: false, isConnected: false })).toBe(false);
  });

  it('does nothing without a known server url', () => {
    expect(shouldReconnectNow({ hasUrl: false, hasConnectedOnce: true, isConnected: false })).toBe(false);
  });
});

describe('nextCandidateAction (LAN→tunnel failover)', () => {
  it('advances from LAN (index 0) to tunnel when LAN fails', () => {
    expect(nextCandidateAction(0, 2)).toBe('advance');
  });

  it('backs off after the last candidate (tunnel) fails', () => {
    expect(nextCandidateAction(1, 2)).toBe('backoff');
  });

  it('backs off immediately when only one candidate exists', () => {
    expect(nextCandidateAction(0, 1)).toBe('backoff');
  });

  // Regression: leaving home WiFi after a successful LAN connect must still fail
  // over to the tunnel. The decision depends only on position in the candidate
  // list, never on whether we'd connected before.
  it('failover does not depend on prior connection success', () => {
    // index 0 of 2 always advances, whether or not we connected earlier
    expect(nextCandidateAction(0, 2)).toBe('advance');
  });
});
