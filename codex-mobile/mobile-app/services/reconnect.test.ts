import { describe, it, expect } from 'vitest';
import { shouldReconnect, reconnectDelayMs, shouldReconnectNow } from './reconnect';

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
