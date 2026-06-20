/**
 * Parse the payload of a relay-server connection QR.
 *
 * The server now encodes `{"lanUrl": "ws://...", "tunnelUrl": "wss://...",
 * "code": "123456"}` so the app can prefer the direct LAN path on the same WiFi
 * and fall back to the tunnel when remote. We still tolerate the older
 * `{"url": "..."}` shape and a bare `wss://...` string for hand-made QRs.
 * Returns null when the payload carries no valid ws/wss URL at all.
 */
export interface PairingPayload {
  /** Direct LAN address (ws://<lan-ip>:port), preferred on same network. */
  lanUrl: string;
  /** Public tunnel address (wss://...), used when LAN is unreachable. */
  tunnelUrl: string;
  code: string;
}

function isWsUrl(value: string): boolean {
  return /^wss?:\/\//i.test(value);
}

export function parsePairingQr(data: string): PairingPayload | null {
  let lanUrl = '';
  let tunnelUrl = '';
  let code = '';
  try {
    const parsed = JSON.parse(data);
    lanUrl = typeof parsed.lanUrl === 'string' ? parsed.lanUrl.trim() : '';
    tunnelUrl = typeof parsed.tunnelUrl === 'string' ? parsed.tunnelUrl.trim() : '';
    // Back-compat: an older single-url payload.
    if (!lanUrl && !tunnelUrl && typeof parsed.url === 'string') {
      const u = parsed.url.trim();
      // A ws:// (non-TLS) url is almost certainly a LAN address; wss:// a tunnel.
      if (/^ws:\/\//i.test(u)) lanUrl = u; else tunnelUrl = u;
    }
    code = typeof parsed.code === 'string' ? parsed.code : String(parsed.code ?? '');
  } catch {
    // Not JSON: treat the raw string as a single URL.
    const u = (data || '').trim();
    if (/^ws:\/\//i.test(u)) lanUrl = u; else tunnelUrl = u;
  }
  if (!isWsUrl(lanUrl) && !isWsUrl(tunnelUrl)) return null;
  if (!isWsUrl(lanUrl)) lanUrl = '';
  if (!isWsUrl(tunnelUrl)) tunnelUrl = '';
  if (!/^\d{4,8}$/.test(code)) code = '';
  return { lanUrl, tunnelUrl, code };
}

/**
 * Ordered list of candidate URLs to try when connecting, LAN first.
 * Dedupes and drops empties. The caller races/falls-back through this list:
 * try LAN with a short timeout, then the tunnel.
 */
export function connectionCandidates(p: { lanUrl?: string; tunnelUrl?: string }): string[] {
  return [p.lanUrl, p.tunnelUrl]
    .map(u => (u || '').trim())
    .filter(u => isWsUrl(u))
    .filter((u, i, arr) => arr.indexOf(u) === i);
}
