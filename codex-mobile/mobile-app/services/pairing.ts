/**
 * Parse the payload of a relay-server connection QR.
 *
 * The server encodes `{"lanUrls": ["ws://10..:8765", "ws://<zt-ip>:8765"],
 * "tunnelUrl": "wss://...", "code": "123456"}` so the app can probe several
 * direct paths (physical WiFi, then ZeroTier/Tailscale VPN) before the tunnel.
 * We stay backward-compatible with the older `{lanUrl}` / `{url}` single-address
 * shapes and a bare `wss://...` string. Returns null when no valid ws/wss URL.
 */
export interface PairingPayload {
  /** Direct LAN/VPN addresses, best-first; preferred over the tunnel. */
  lanUrls: string[];
  /** Public tunnel address (wss://...), used when no direct path works. */
  tunnelUrl: string;
  code: string;
}

function isWsUrl(value: string): boolean {
  return /^wss?:\/\//i.test(value);
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(isWsUrl);
}

export function parsePairingQr(data: string): PairingPayload | null {
  let lanUrls: string[] = [];
  let tunnelUrl = '';
  let code = '';
  try {
    const parsed = JSON.parse(data);
    lanUrls = cleanList(parsed.lanUrls);
    tunnelUrl = typeof parsed.tunnelUrl === 'string' ? parsed.tunnelUrl.trim() : '';
    // Back-compat: older single-address fields.
    if (!lanUrls.length && !tunnelUrl) {
      const single = typeof parsed.lanUrl === 'string' ? parsed.lanUrl.trim()
        : typeof parsed.url === 'string' ? parsed.url.trim() : '';
      if (/^ws:\/\//i.test(single)) lanUrls = [single];
      else if (/^wss:\/\//i.test(single)) tunnelUrl = single;
    }
    code = typeof parsed.code === 'string' ? parsed.code : String(parsed.code ?? '');
  } catch {
    // Not JSON: treat the raw string as a single URL.
    const u = (data || '').trim();
    if (/^ws:\/\//i.test(u)) lanUrls = [u];
    else if (/^wss:\/\//i.test(u)) tunnelUrl = u;
  }
  if (!tunnelUrl || !isWsUrl(tunnelUrl)) tunnelUrl = '';
  if (!lanUrls.length && !tunnelUrl) return null;
  return { lanUrls, tunnelUrl, code: /^\d{4,8}$/.test(code) ? code : '' };
}

/**
 * Ordered list of candidate URLs to try when connecting: all direct LAN/VPN
 * addresses first (best-first as the server ordered them), then the tunnel.
 * Dedupes and drops empties. The caller probes each with a short timeout and
 * falls through to the next.
 */
export function connectionCandidates(p: { lanUrls?: string[]; tunnelUrl?: string }): string[] {
  return [...(p.lanUrls || []), p.tunnelUrl || '']
    .map(u => (u || '').trim())
    .filter(u => isWsUrl(u))
    .filter((u, i, arr) => arr.indexOf(u) === i);
}
