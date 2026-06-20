import { describe, it, expect } from 'vitest';
import { validateRelayUrl } from './relayUrl';

describe('validateRelayUrl', () => {
  it('accepts ws:// and wss:// addresses', () => {
    expect(validateRelayUrl('ws://10.60.101.84:8765').ok).toBe(true);
    expect(validateRelayUrl('wss://abc.trycloudflare.com').ok).toBe(true);
  });

  it('trims whitespace and strips trailing slash', () => {
    const r = validateRelayUrl('  wss://abc.trycloudflare.com/  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('wss://abc.trycloudflare.com');
  });

  it('rejects empty input', () => {
    expect(validateRelayUrl('').ok).toBe(false);
    expect(validateRelayUrl('   ').ok).toBe(false);
  });

  it('rejects http(s):// with a helpful message', () => {
    const r = validateRelayUrl('https://abc.trycloudflare.com');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('ws://');
  });

  it('rejects missing scheme', () => {
    expect(validateRelayUrl('10.60.101.84:8765').ok).toBe(false);
  });

  it('rejects scheme with no host', () => {
    expect(validateRelayUrl('ws://').ok).toBe(false);
    expect(validateRelayUrl('wss:///path').ok).toBe(false);
  });
});
