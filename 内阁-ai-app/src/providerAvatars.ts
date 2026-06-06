/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stable avatar helpers — no external image dependency.
 * Uses CSS gradient initials as fallback, plus provider-specific colors.
 */

export interface ProviderAvatarInfo {
  provider: string;
  color: string;
  bg: string;
  initial: string;
}

const PROVIDER_AVATARS: Record<string, ProviderAvatarInfo> = {
  openai:     { provider: 'openai',     color: '#10a37f', bg: '#10a37f20', initial: 'O' },
  chatgpt:    { provider: 'chatgpt',    color: '#10a37f', bg: '#10a37f20', initial: 'C' },
  claude:     { provider: 'claude',     color: '#d97706', bg: '#d9770620', initial: 'C' },
  anthropic:  { provider: 'anthropic',  color: '#d97706', bg: '#d9770620', initial: 'A' },
  deepseek:   { provider: 'deepseek',   color: '#3b82f6', bg: '#3b82f620', initial: 'D' },
  gemini:     { provider: 'gemini',     color: '#8b5cf6', bg: '#8b5cf620', initial: 'G' },
  qwen:       { provider: 'qwen',       color: '#06b6d4', bg: '#06b6d420', initial: 'Q' },
  codex:      { provider: 'codex',      color: '#f59e0b', bg: '#f59e0b20', initial: 'X' },
  claudecode: { provider: 'claudecode', color: '#f59e0b', bg: '#f59e0b20', initial: 'C' },
  cursor:     { provider: 'cursor',     color: '#ec4899', bg: '#ec489920', initial: 'C' },
  trae:       { provider: 'trae',       color: '#14b8a6', bg: '#14b8a620', initial: 'T' },
  workbuddy:  { provider: 'workbuddy',  color: '#f97316', bg: '#f9731620', initial: 'W' },
  local:      { provider: 'local',      color: '#6b7280', bg: '#6b728020', initial: 'L' },
  browser:    { provider: 'browser',    color: '#ef4444', bg: '#ef444420', initial: 'B' },
  custom:     { provider: 'custom',     color: '#a855f7', bg: '#a855f720', initial: '?' },
};

/** Given a providerId or localToolId, return avatar info */
export function getProviderAvatar(providerId: string): ProviderAvatarInfo {
  const key = (providerId || '').toLowerCase();
  return PROVIDER_AVATARS[key] || PROVIDER_AVATARS.custom;
}

/** Generate CSS style for an avatar circle with gradient background and initial */
export function avatarStyle(name: string, providerId?: string): Record<string, string> {
  const info = providerId ? getProviderAvatar(providerId) : PROVIDER_AVATARS.custom;
  const initial = name ? name.charAt(0).toUpperCase() : info.initial;
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${info.color}, ${info.color}88)`,
    color: '#fff',
    fontWeight: '700',
    fontSize: 'inherit',
  };
}

/** Get the display initial character for an avatar */
export function getAvatarInitial(name: string, providerId?: string): string {
  if (providerId) {
    const info = getProviderAvatar(providerId);
    return info.initial;
  }
  if (name) return name.charAt(0).toUpperCase();
  return '?';
}

/** Get provider color for badges etc. */
export function getProviderColor(providerId: string): string {
  return getProviderAvatar(providerId).color;
}
