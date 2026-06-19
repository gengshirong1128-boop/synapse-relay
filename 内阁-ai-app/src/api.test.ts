import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestJson } from './api';

function mockFetch(body: string, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(body),
  } as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestJson', () => {
  it('parses a successful JSON response', async () => {
    mockFetch(JSON.stringify({ plans: [1, 2] }));
    const data = await requestJson<{ plans: number[] }>('/x');
    expect(data.plans).toEqual([1, 2]);
  });

  it('returns {} for an empty successful body', async () => {
    mockFetch('');
    const data = await requestJson('/x');
    expect(data).toEqual({});
  });

  it('throws the server detail message on a non-ok response', async () => {
    mockFetch(JSON.stringify({ detail: 'path locked' }), false, 400);
    await expect(requestJson('/x')).rejects.toThrow('path locked');
  });

  it('falls back to raw text when the error body is not JSON', async () => {
    mockFetch('upstream exploded', false, 502);
    await expect(requestJson('/x')).rejects.toThrow('upstream exploded');
  });

  it('falls back to the HTTP status when no message is present', async () => {
    mockFetch('', false, 503);
    await expect(requestJson('/x')).rejects.toThrow('HTTP 503');
  });

  it('sets a JSON content-type and forwards options', async () => {
    const fn = mockFetch('{}');
    await requestJson('/x', { method: 'POST', body: '{}' });
    const [path, init] = fn.mock.calls[0];
    expect(path).toBe('/x');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
