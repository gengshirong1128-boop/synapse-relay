import { describe, it, expect } from 'vitest';
import { parsePairingQr } from './pairing';

describe('parsePairingQr', () => {
  it('parses the standard JSON payload from relay-server', () => {
    const result = parsePairingQr(JSON.stringify({ url: 'wss://abc.trycloudflare.com', code: '123456' }));
    expect(result).toEqual({ url: 'wss://abc.trycloudflare.com', code: '123456' });
  });

  it('accepts a LAN ws:// url', () => {
    const result = parsePairingQr(JSON.stringify({ url: 'ws://10.0.0.5:8765', code: '000000' }));
    expect(result).toEqual({ url: 'ws://10.0.0.5:8765', code: '000000' });
  });

  it('tolerates a numeric code field', () => {
    const result = parsePairingQr(JSON.stringify({ url: 'wss://x.com', code: 654321 }));
    expect(result).toEqual({ url: 'wss://x.com', code: '654321' });
  });

  it('treats a bare ws/wss string as the url with empty code', () => {
    const result = parsePairingQr('wss://bare.example.com');
    expect(result).toEqual({ url: 'wss://bare.example.com', code: '' });
  });

  it('blanks a non-numeric / garbage code', () => {
    const result = parsePairingQr(JSON.stringify({ url: 'wss://x.com', code: 'not-a-code' }));
    expect(result).toEqual({ url: 'wss://x.com', code: '' });
  });

  it('rejects a non-ws url (e.g. https link)', () => {
    expect(parsePairingQr('https://evil.example.com')).toBeNull();
  });

  it('rejects an arbitrary non-connection QR', () => {
    expect(parsePairingQr('just some random text')).toBeNull();
  });

  it('rejects JSON without a valid url', () => {
    expect(parsePairingQr(JSON.stringify({ code: '123456' }))).toBeNull();
  });

  it('rejects empty input', () => {
    expect(parsePairingQr('')).toBeNull();
  });
});
