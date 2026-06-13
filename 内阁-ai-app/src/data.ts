/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CabinetMember, ChatMessage } from './types';

export const INITIAL_MEMBERS: CabinetMember[] = [
  // No default members - users create their own
];


/** Sender name mapping for language switch */
const SENDER_MAP: Record<string, { zh: string; en: string }> = {
  '朕（圣上）': { zh: '朕（圣上）', en: 'Emperor' },
  'Emperor': { zh: '朕（圣上）', en: 'Emperor' },
  '内阁首辅（ChatGPT）': { zh: '内阁首辅（ChatGPT）', en: 'Chief Minister (ChatGPT)' },
  'Chief Minister (ChatGPT)': { zh: '内阁首辅（ChatGPT）', en: 'Chief Minister (ChatGPT)' },
  '审议大臣（Claude）': { zh: '审议大臣（Claude）', en: 'Review Minister (Claude)' },
  'Review Minister (Claude)': { zh: '审议大臣（Claude）', en: 'Review Minister (Claude)' },
  '推演大臣（DeepSeek）': { zh: '推演大臣（DeepSeek）', en: 'Reasoning Minister (DeepSeek)' },
  'Reasoning Minister (DeepSeek)': { zh: '推演大臣（DeepSeek）', en: 'Reasoning Minister (DeepSeek)' },
  '文书大臣（Qwen）': { zh: '文书大臣（Qwen）', en: 'Scribe Minister (Qwen)' },
  'Scribe Minister (Qwen)': { zh: '文书大臣（Qwen）', en: 'Scribe Minister (Qwen)' },
  '代码大臣（Codex）': { zh: '代码大臣（Codex）', en: 'Code Minister (Codex)' },
  'Code Minister (Codex)': { zh: '代码大臣（Codex）', en: 'Code Minister (Codex)' },
  '审计大臣（Claude Code）': { zh: '审计大臣（Claude Code）', en: 'Audit Minister (Claude Code)' },
  'Audit Minister (Claude Code)': { zh: '审计大臣（Claude Code）', en: 'Audit Minister (Claude Code)' },
};

const ROLE_MAP: Record<string, { zh: string; en: string }> = {
  '圣上': { zh: '圣上', en: 'Emperor' },
  'Emperor': { zh: '圣上', en: 'Emperor' },
  '内阁': { zh: '内阁', en: 'Cabinet' },
  'Cabinet': { zh: '内阁', en: 'Cabinet' },
  '工部': { zh: '工部', en: 'Works' },
  'Works': { zh: '工部', en: 'Works' },
  '领衔首辅': { zh: '领衔首辅', en: 'Chief' },
  'Chief': { zh: '领衔首辅', en: 'Chief' },
  '首辅': { zh: '首辅', en: 'PM' },
  'PM': { zh: '首辅', en: 'PM' },
};

export function normalizeMessageForLanguage(msg: ChatMessage, lang: 'zh' | 'en'): ChatMessage {
  const result = { ...msg };

  // Normalize sender
  const senderMatch = SENDER_MAP[msg.sender];
  if (senderMatch) {
    result.sender = senderMatch[lang];
  }

  // Normalize roleLabel
  if (msg.roleLabel) {
    const roleMatch = ROLE_MAP[msg.roleLabel];
    if (roleMatch) {
      result.roleLabel = roleMatch[lang];
    }
  }

  // Normalize round divider text (only translate the EN locale; keep the
  // content set by the caller for zh so modern/classic wording is preserved).
  if (msg.isRoundDivider) {
    const roundNum = msg.roundNumber || 1;
    if (lang === 'en') {
      result.content = `─── Round ${roundNum} ───`;
    }
  }

  return result;
}
