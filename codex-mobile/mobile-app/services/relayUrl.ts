/**
 * Pure validation/normalization for the relay server URL the user types on the
 * connect screen. Extracted so the rules can be unit-tested without RN.
 */

export interface UrlCheck {
  ok: boolean;
  /** Normalized URL to use when ok (trimmed, trailing slash removed). */
  value: string;
  /** Human-readable reason when not ok. */
  reason?: string;
}

/**
 * The relay speaks WebSocket, so the address must be ws:// or wss://. Reject the
 * common mistakes (empty, http://, missing scheme) with a clear message instead
 * of letting the socket attempt run into a 10s timeout.
 */
export function validateRelayUrl(raw: string): UrlCheck {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return { ok: false, value, reason: '请输入服务器地址' };
  if (/^https?:\/\//i.test(value)) {
    return { ok: false, value, reason: '地址应以 ws:// 或 wss:// 开头（不是 http）' };
  }
  if (!/^wss?:\/\//i.test(value)) {
    return { ok: false, value, reason: '地址应以 ws:// 或 wss:// 开头' };
  }
  // Require a host after the scheme.
  const host = value.replace(/^wss?:\/\//i, '');
  if (!host || host.startsWith('/') || host.startsWith(':')) {
    return { ok: false, value, reason: '地址缺少主机名' };
  }
  return { ok: true, value };
}
