import { describe, it, expect } from 'vitest';
import { parsePairingQr, connectionCandidates } from './pairing';

describe('parsePairingQr', () => {
  it('parses the multi-address JSON payload (LAN list + tunnel)', () => {
    const result = parsePairingQr(JSON.stringify({
      lanUrls: ['ws://10.60.101.84:8765', 'ws://192.168.191.5:8765'],
      tunnelUrl: 'wss://abc.trycloudflare.com',
      code: '123456',
    }));
    expect(result).toEqual({
      lanUrls: ['ws://10.60.101.84:8765', 'ws://192.168.191.5:8765'],
      tunnelUrl: 'wss://abc.trycloudflare.com',
      code: '123456',
    });
  });

  it('parses a LAN-only payload (no tunnel running)', () => {
    const result = parsePairingQr(JSON.stringify({ lanUrls: ['ws://10.0.0.5:8765'], tunnelUrl: '', code: '000000' }));
    expect(result).toEqual({ lanUrls: ['ws://10.0.0.5:8765'], tunnelUrl: '', code: '000000' });
  });

  it('drops invalid entries inside lanUrls', () => {
    const result = parsePairingQr(JSON.stringify({ lanUrls: ['ws://ok:8765', 'garbage', 'http://nope'], code: '111111' }));
    expect(result).toEqual({ lanUrls: ['ws://ok:8765'], tunnelUrl: '', code: '111111' });
  });

  it('tolerates a numeric code field', () => {
    const result = parsePairingQr(JSON.stringify({ lanUrls: ['ws://10.0.0.5:8765'], code: 654321 }));
    expect(result).toEqual({ lanUrls: ['ws://10.0.0.5:8765'], tunnelUrl: '', code: '654321' });
  });

  it('back-compat: old single lanUrl maps into lanUrls', () => {
    const result = parsePairingQr(JSON.stringify({ lanUrl: 'ws://10.0.0.5:8765', code: '111111' }));
    expect(result).toEqual({ lanUrls: ['ws://10.0.0.5:8765'], tunnelUrl: '', code: '111111' });
  });

  it('back-compat: old single wss url maps to tunnelUrl', () => {
    const result = parsePairingQr(JSON.stringify({ url: 'wss://x.trycloudflare.com', code: '222222' }));
    expect(result).toEqual({ lanUrls: [], tunnelUrl: 'wss://x.trycloudflare.com', code: '222222' });
  });

  it('treats a bare wss string as the tunnel url with empty code', () => {
    const result = parsePairingQr('wss://bare.example.com');
    expect(result).toEqual({ lanUrls: [], tunnelUrl: 'wss://bare.example.com', code: '' });
  });

  it('blanks a non-numeric / garbage code', () => {
    const result = parsePairingQr(JSON.stringify({ lanUrls: ['ws://x:8765'], code: 'not-a-code' }));
    expect(result).toEqual({ lanUrls: ['ws://x:8765'], tunnelUrl: '', code: '' });
  });

  it('rejects a non-ws url (e.g. https link)', () => {
    expect(parsePairingQr('https://evil.example.com')).toBeNull();
  });

  it('rejects an arbitrary non-connection QR', () => {
    expect(parsePairingQr('just some random text')).toBeNull();
  });

  it('rejects JSON without any valid url', () => {
    expect(parsePairingQr(JSON.stringify({ code: '123456' }))).toBeNull();
  });

  it('rejects empty input', () => {
    expect(parsePairingQr('')).toBeNull();
  });
});

describe('connectionCandidates (all LAN/VPN first, tunnel last)', () => {
  it('orders multiple LAN addresses before the tunnel', () => {
    expect(connectionCandidates({ lanUrls: ['ws://10.0.0.5:8765', 'ws://192.168.191.5:8765'], tunnelUrl: 'wss://x.com' }))
      .toEqual(['ws://10.0.0.5:8765', 'ws://192.168.191.5:8765', 'wss://x.com']);
  });

  it('preserves the server-provided LAN order (physical before VPN)', () => {
    expect(connectionCandidates({ lanUrls: ['ws://wifi:8765', 'ws://zerotier:8765'] }))
      .toEqual(['ws://wifi:8765', 'ws://zerotier:8765']);
  });

  it('drops empties (LAN-only when no tunnel)', () => {
    expect(connectionCandidates({ lanUrls: ['ws://10.0.0.5:8765'], tunnelUrl: '' }))
      .toEqual(['ws://10.0.0.5:8765']);
  });

  it('drops invalid urls', () => {
    expect(connectionCandidates({ lanUrls: ['nope'], tunnelUrl: 'wss://x.com' }))
      .toEqual(['wss://x.com']);
  });

  it('dedupes identical addresses', () => {
    expect(connectionCandidates({ lanUrls: ['wss://x.com'], tunnelUrl: 'wss://x.com' }))
      .toEqual(['wss://x.com']);
  });

  it('returns empty when nothing valid', () => {
    expect(connectionCandidates({ lanUrls: [], tunnelUrl: '' })).toEqual([]);
  });
});
