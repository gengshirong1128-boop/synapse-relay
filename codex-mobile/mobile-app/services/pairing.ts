/**
 * Parse the payload of a relay-server connection QR.
 *
 * The server encodes `{"url": "wss://...", "code": "123456"}`, but we also
 * tolerate a bare `wss://...` string so a hand-made URL-only QR still works.
 * Returns null when the payload does not contain a valid ws/wss URL.
 */
export interface PairingPayload {
  url: string;
  code: string;
}

export function parsePairingQr(data: string): PairingPayload | null {
  let url = '';
  let code = '';
  try {
    const parsed = JSON.parse(data);
    url = typeof parsed.url === 'string' ? parsed.url : '';
    code = typeof parsed.code === 'string' ? parsed.code : String(parsed.code ?? '');
  } catch {
    // Not JSON: treat the raw string as the URL.
    url = (data || '').trim();
  }
  if (!/^wss?:\/\//i.test(url)) return null;
  // Normalize a non-numeric/garbage code to empty so the UI asks for it.
  if (!/^\d{4,8}$/.test(code)) code = '';
  return { url, code };
}
