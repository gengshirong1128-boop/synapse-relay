import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthManager } from './auth';
import type { RelayConfig } from './config';

function makeAuth(): AuthManager {
  const config: RelayConfig = {
    port: 8765,
    jwtSecret: 'test-secret',
    authTokenExpiry: '30d',
    tunnelEnabled: false,
    claudeCodePath: 'claude',
    codexPath: 'codex',
    customApiEndpoints: [],
    tls: { enabled: false, certPath: '', keyPath: '' },
    sessionTimeoutMs: 3600000,
  };
  return new AuthManager(config);
}

describe('AuthManager pairing code', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns valid for the correct code and clears it', () => {
    const auth = makeAuth();
    const code = auth.generatePairingCode();

    expect(auth.verifyPairingCodeDetailed(code)).toBe('valid');
    expect(auth.verifyPairingCodeDetailed(code)).toBe('invalid');
  });

  it('counts wrong attempts and locks on the fifth failure', () => {
    const auth = makeAuth();
    auth.generatePairingCode();

    expect(auth.verifyPairingCodeDetailed('000000')).toBe('invalid');
    expect(auth.verifyPairingCodeDetailed('000001')).toBe('invalid');
    expect(auth.verifyPairingCodeDetailed('000002')).toBe('invalid');
    expect(auth.verifyPairingCodeDetailed('000003')).toBe('invalid');
    expect(auth.verifyPairingCodeDetailed('000004')).toBe('locked');
  });

  it('clears the code after locking', () => {
    const auth = makeAuth();
    const code = auth.generatePairingCode();

    for (let i = 0; i < 5; i += 1) {
      auth.verifyPairingCodeDetailed('111111');
    }

    expect(auth.verifyPairingCodeDetailed(code)).toBe('invalid');
  });

  it('returns expired after the ttl without sleeping', () => {
    const auth = makeAuth();
    const code = auth.generatePairingCode();

    vi.advanceTimersByTime(3 * 60 * 1000 + 1);

    expect(auth.verifyPairingCodeDetailed(code)).toBe('expired');
    expect(auth.verifyPairingCodeDetailed(code)).toBe('invalid');
  });
});
