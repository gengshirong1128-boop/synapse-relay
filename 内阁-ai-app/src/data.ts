/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CabinetMember, ChatMessage } from './types';

export const INITIAL_MEMBERS: CabinetMember[] = [
  {
    id: 'model-chatgpt',
    name: '内阁首辅',
    nickname: 'ChatGPT',
    avatar: '',
    type: 'model',
    selected: true,
    role: 'pm',
    ministry: 'none',
    badge: '通用/统筹',
    desc: '负责总览议题、拆解目标、协调其他大臣形成可执行结论。',
    providerId: 'openai',
    modelId: 'gpt-4o',
    skillId: 'skill_general_reasoning',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'model-claude',
    name: '审议大臣',
    nickname: 'Claude',
    avatar: '',
    type: 'model',
    selected: true,
    role: 'none',
    ministry: 'works',
    badge: '审查/写作',
    desc: '负责审查论证、梳理风险、润色正式文书。',
    providerId: 'claude',
    modelId: 'claude-3-5-sonnet',
    skillId: 'skill_review_writing',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'model-deepseek',
    name: '推演大臣',
    nickname: 'DeepSeek',
    avatar: '',
    type: 'model',
    selected: true,
    role: 'none',
    ministry: 'war',
    badge: '深度推理/策略',
    desc: '负责复杂推理、多方案推演、找出关键冲突与取舍。',
    providerId: 'deepseek',
    modelId: 'deepseek-r1',
    skillId: 'skill_deep_reasoning',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'model-gemini',
    name: '检索大臣',
    nickname: 'Gemini',
    avatar: '',
    type: 'model',
    selected: false,
    role: 'none',
    ministry: 'rites',
    badge: '检索/摘要',
    desc: '负责资料检索、长上下文归纳和多来源摘要。',
    providerId: 'gemini',
    modelId: 'gemini-1.5-flash',
    skillId: 'skill_research_summary',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'model-qwen',
    name: '文书大臣',
    nickname: 'Qwen',
    avatar: '',
    type: 'model',
    selected: false,
    role: 'none',
    ministry: 'archive',
    badge: '中文/文书',
    desc: '负责中文表达、正式文书、术语统一和摘要成稿。',
    providerId: 'qwen',
    modelId: 'qwen-plus',
    skillId: 'skill_chinese_writing',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-codex',
    name: '代码大臣',
    nickname: 'Codex',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'works',
    badge: '代码/执行',
    desc: '负责代码修改、命令执行、测试验证和工程交付。',
    providerId: 'codex',
    localToolId: 'cli.codex',
    skillId: 'skill_code_execution',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-claudecode',
    name: '审计大臣',
    nickname: 'Claude Code',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'punishments',
    badge: '终端/审计',
    desc: '负责命令行审查、安全风险、补丁质量和执行计划。',
    providerId: 'claudecode',
    localToolId: 'cli.claude',
    skillId: 'skill_security_review',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-trae',
    name: '工程大臣',
    nickname: 'Trae',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'works',
    badge: 'IDE/编程',
    desc: '负责项目结构、文件操作、多文件链路和代码实现。',
    providerId: 'trae',
    localToolId: 'cli.trae',
    skillId: 'skill_code_execution',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-workbuddy',
    name: '协同大臣',
    nickname: 'WorkBuddy',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'personnel',
    badge: '协作/调度',
    desc: '负责跨工具协同、任务拆分、流程推进和资源调度。',
    providerId: 'workbuddy',
    localToolId: 'cli.workbuddy',
    skillId: 'skill_local_automation',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-localscript',
    name: '本地执行大臣',
    nickname: 'Local',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'none',
    badge: '本地/脚本',
    desc: '负责本地脚本、自动化任务和系统命令编排。',
    providerId: 'local',
    localToolId: 'local.script',
    skillId: 'skill_local_automation',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-browserauto',
    name: '网页执行大臣',
    nickname: 'Browser',
    avatar: '',
    type: 'tool',
    selected: false,
    role: 'none',
    ministry: 'none',
    badge: '网页/自动化',
    desc: '负责网页操作、表单流转、网页登录和可视化检查。',
    providerId: 'browser',
    localToolId: 'local.browser',
    skillId: 'skill_local_automation',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'tool-custom',
    name: '档案大臣',
    nickname: 'Custom',
    avatar: '',
    type: 'custom',
    selected: true,
    role: 'sg',
    ministry: 'archive',
    badge: '知识/档案',
    desc: '负责资料归档、历史记录、上下文整理和知识引用。',
    providerId: 'custom',
    skillId: 'skill_research_summary',
    avatarType: 'provider',
    enabled: true,
    isDefault: true,
  },
];

export const TOPICS = [
  {
    title: '关于北境盐铁专营之榷议',
    timestamp: '丙辰年 腊月廿三 · 军机处集议',
    query: '北境苦寒，边军粮饷仰赖盐铁之利。近日御史台奏报私盐泛滥，官营不振。请诸臣议定整饬之策。',
  },
  {
    title: '关于沿海御寇物流防卫之商议',
    timestamp: '丙辰年 正月初八 · 军机外议',
    query: '各口岸商船近来屡遭海盗袭扰，漕运和民生物资受阻。工部与兵部如何统筹防御设施，保障物流安全？',
  },
  {
    title: '关于两湖大区灾后财政核准案',
    timestamp: '丙辰年 仲春十五 · 内阁廷议',
    query: '两湖水患后民间存粮不足，工部请求拨付库银修筑堤防；户部称国库空虚。请诸臣就赈灾、财政和工程优先级定案。',
  },
];

export const INITIAL_MESSAGES_CABINET: ChatMessage[] = [
  {
    id: 'u-1',
    sender: '朕（圣上）',
    avatar: '',
    content: '北境苦寒，边军粮饷仰赖盐铁之利。近日御史台奏报私盐泛滥，官营不振。请诸臣议定整饬之策。',
    isUser: true,
    roleLabel: '圣上',
  },
  {
    id: 'a-1',
    sender: '审议大臣（Claude）',
    avatar: '',
    content: '臣以为，盐铁为国计根本，私贩固然可惩，但根源在官营法度僵化、运输不畅、地方中饱。宜先整顿官营，再设边地特许转运，令民有所依、官有所收。',
    isUser: false,
    roleLabel: '内阁',
    ministerId: 'model-claude',
  },
  {
    id: 'a-2',
    sender: '代码大臣（Codex）',
    avatar: '',
    content: '臣请先列执行清单：一查盐道账册，二核边关仓储，三设巡检节点，四限期复核地方官报。此案不可只停留在议论，应形成可追踪的交办计划。',
    isUser: false,
    roleLabel: '工部',
    ministerId: 'tool-codex',
  },
];

export const INITIAL_MESSAGES_UN = [
  {
    id: 'a-un-1',
    sender: '审议大臣（Claude）',
    avatar: '',
    content: '本案应同时衡量民生、财政和边防。若只用刑罚压制私盐而不改善官盐供应，弊端仍会反复。',
    isUser: false,
    roleLabel: '领衔首辅',
    ministerId: 'model-claude',
  },
  {
    id: 'a-un-2',
    sender: '代码大臣（Codex）',
    avatar: '',
    content: '臣建议把整饬方案拆成可执行节点，并为每个节点指定责任部门、验收口径和复核周期。',
    isUser: false,
    roleLabel: '工部',
    ministerId: 'tool-codex',
  },
];

// English versions of default messages
export const INITIAL_MESSAGES_CABINET_EN: ChatMessage[] = [
  {
    id: 'u-1-en',
    sender: 'Emperor',
    avatar: '',
    content: 'The northern border is severe. Military supplies depend on salt and iron profits. Recently the Censorate reported rampant private salt trade and failing state monopoly. Ministers, propose rectification measures.',
    isUser: true,
    roleLabel: 'Emperor',
  },
  {
    id: 'a-1-en',
    sender: 'Review Minister (Claude)',
    avatar: '',
    content: 'I submit: salt and iron are the foundation of national finance. Private trade deserves punishment, but the root cause lies in rigid state monopoly regulations, poor transport, and local corruption. First reform the state system, then permit regional licensed transport, so the people have recourse and the state has revenue.',
    isUser: false,
    roleLabel: 'Cabinet',
    ministerId: 'model-claude',
  },
  {
    id: 'a-2-en',
    sender: 'Code Minister (Codex)',
    avatar: '',
    content: 'I propose an execution checklist: 1) Audit salt route ledgers, 2) Verify border warehouse stocks, 3) Set up inspection points, 4) Set deadlines for local official rechecks. This case must not remain in discussion — form a traceable action plan.',
    isUser: false,
    roleLabel: 'Works',
    ministerId: 'tool-codex',
  },
];

export const INITIAL_MESSAGES_UN_EN: ChatMessage[] = [
  {
    id: 'a-un-1-en',
    sender: 'Review Minister (Claude)',
    avatar: '',
    content: 'This case should simultaneously weigh livelihoods, finance, and border defense. If we only suppress private salt with penalties without improving state supply, the problem will recur.',
    isUser: false,
    roleLabel: 'Chief',
    ministerId: 'model-claude',
  },
  {
    id: 'a-un-2-en',
    sender: 'Code Minister (Codex)',
    avatar: '',
    content: 'I suggest breaking the rectification plan into executable nodes, each with a designated responsible department, acceptance criteria, and review cycle.',
    isUser: false,
    roleLabel: 'Works',
    ministerId: 'tool-codex',
  },
];

export function getInitialMessages(mode: 'cabinet' | 'un', lang: 'zh' | 'en'): ChatMessage[] {
  if (lang === 'en') {
    return mode === 'cabinet' ? INITIAL_MESSAGES_CABINET_EN : INITIAL_MESSAGES_UN_EN;
  }
  return mode === 'cabinet' ? INITIAL_MESSAGES_CABINET : INITIAL_MESSAGES_UN;
}

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

  // Normalize round divider text
  if (msg.isRoundDivider) {
    const roundNum = msg.roundNumber || 1;
    if (lang === 'en') {
      result.content = `\u{1F4DC} ─── 【Round ${roundNum} Debate】 ─── \u{1F4DC}`;
    } else {
      result.content = `\u{1F4DC} ─── 【第 ${roundNum} 轮 廷议辩驳展开】 ─── \u{1F4DC}`;
    }
  }

  return result;
}
