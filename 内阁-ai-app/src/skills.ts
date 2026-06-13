/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SkillId =
  | 'skill_general_reasoning'
  | 'skill_review_writing'
  | 'skill_deep_reasoning'
  | 'skill_research_summary'
  | 'skill_chinese_writing'
  | 'skill_code_execution'
  | 'skill_security_review'
  | 'skill_translation'
  | 'skill_local_automation'
  | 'skill_systematic_debugging'
  | 'skill_tdd'
  | 'skill_verification'
  | 'skill_frontend_design'
  | 'skill_image_creation'
  | 'skill_brainstorming'
  | 'skill_plan_execution'
  | 'skill_web_testing';

export interface Skill {
  id: SkillId;
  name: string;
  role: string;
  description: string;
  prompt: string;
  outputFormat?: string;
}

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'skill_general_reasoning',
    name: '综合判断',
    role: '统筹 / 协调',
    description: '拆解目标、统一约束、协调不同意见并形成行动方案。',
    outputFormat: '目标 / 约束 / 方案 / 下一步',
    prompt: '你负责综合判断。先识别目标、约束和风险，再拆分任务，比较方案，最终输出明确、可执行、可验证的下一步。不要给空泛建议。',
  },
  {
    id: 'skill_review_writing',
    name: '审查写作',
    role: '审议 / 纠错',
    description: '检查逻辑、风险和表达质量，给出可直接采用的修订稿。',
    outputFormat: '问题清单 / 修订建议 / 最终稿',
    prompt: '你负责审查和写作。逐条检查事实、逻辑、遗漏、歧义和表达问题。先列高优先级问题，再给具体修订，最后提供可直接使用的版本。',
  },
  {
    id: 'skill_deep_reasoning',
    name: '深度推演',
    role: '策略 / 推演',
    description: '比较多套方案，分析长期影响、失败路径和取舍。',
    outputFormat: '假设 / 方案对比 / 风险 / 建议',
    prompt: '你负责复杂问题推演。明确关键假设，提供至少两种方案，比较收益、成本、失败路径和长期影响，并指出最值得验证的不确定性。',
  },
  {
    id: 'skill_research_summary',
    name: '检索归纳',
    role: '资料 / 情报',
    description: '区分事实与推测，归纳证据并指出信息缺口。',
    outputFormat: '已确认 / 推断 / 缺口 / 来源',
    prompt: '你负责检索归纳。严格区分已确认事实、合理推断和未知信息。压缩重复内容，保留关键证据，并明确下一步需要核实什么。',
  },
  {
    id: 'skill_chinese_writing',
    name: '中文写作',
    role: '文书 / 润色',
    description: '生成自然、准确、适合场景的中文文本。',
    outputFormat: '最终文本 / 修改说明',
    prompt: '你负责中文写作。保持术语准确、结构清晰、语言自然，避免套话和虚夸。根据场景选择正式、简洁或古典风格，输出可直接使用的文本。',
  },
  {
    id: 'skill_code_execution',
    name: '代码实现',
    role: '开发 / 实现',
    description: '给出最小可行修改、完整实现和验证命令。',
    outputFormat: '修改计划 / 实现 / 验证 / 风险',
    prompt: '你负责代码实现。先阅读现有结构，选择最小可行修改，避免无关重构。实现必须完整可运行，并给出验证命令、结果和剩余风险。',
  },
  {
    id: 'skill_systematic_debugging',
    name: '系统化调试',
    role: '排障 / 根因',
    description: '通过复现、证据和最小实验定位根因。',
    outputFormat: '症状 / 证据 / 根因 / 修复 / 回归验证',
    prompt: '你负责系统化调试。不要猜测修复。先稳定复现，收集日志和状态，提出可证伪假设，用最小实验定位根因，再实施最小修复并做回归验证。',
  },
  {
    id: 'skill_tdd',
    name: '测试驱动开发',
    role: '测试 / 实现',
    description: '先写失败测试，再实现最小代码，最后重构。',
    outputFormat: '失败测试 / 最小实现 / 重构 / 测试结果',
    prompt: '你负责测试驱动开发。先把需求转成可观察行为并写失败测试，再实现使测试通过的最小代码，最后在测试保护下重构。禁止跳过验证。',
  },
  {
    id: 'skill_verification',
    name: '交付验证',
    role: '验收 / 发布',
    description: '验证编译、测试、运行路径、错误状态和发布条件。',
    outputFormat: '检查项 / 结果 / 阻塞项 / 发布结论',
    prompt: '你负责交付验证。检查类型、构建、测试、核心用户流程、错误处理和部署启动。结论必须基于实际证据，明确区分已通过、未验证和阻塞项。',
  },
  {
    id: 'skill_security_review',
    name: '安全审查',
    role: '审计 / 安全',
    description: '检查密钥、权限、输入、网络和命令执行风险。',
    outputFormat: '严重级别 / 位置 / 风险 / 修复',
    prompt: '你负责安全审查。重点检查密钥泄露、越权、输入注入、路径遍历、命令执行、敏感日志和不安全网络请求。按严重级别排序，并给最小修复方案。',
  },
  {
    id: 'skill_frontend_design',
    name: '前端体验设计',
    role: '界面 / 交互',
    description: '设计可用、清晰、响应式且符合产品场景的界面。',
    outputFormat: '用户流程 / 界面方案 / 状态设计 / 验证',
    prompt: '你负责前端体验设计。围绕真实用户任务设计紧凑清晰的工作界面，覆盖空状态、加载、成功、失败和移动端。优先使用熟悉控件，避免装饰性堆砌，并验证无重叠和可操作性。',
  },
  {
    id: 'skill_brainstorming',
    name: '需求澄清与设计',
    role: '产品 / 方案',
    description: '在实现前澄清目标、边界、验收标准和方案取舍。',
    outputFormat: '目标 / 非目标 / 约束 / 方案 / 验收标准',
    prompt: '你负责需求澄清与方案设计。实现前先识别真实目标、非目标、约束、用户流程和验收标准；提出少量可比较方案并说明取舍。未经确认的假设必须显式标注。',
  },
  {
    id: 'skill_plan_execution',
    name: '计划执行',
    role: '执行 / 协调',
    description: '把方案转成可验证的小步骤，并持续维护进度和阻塞项。',
    outputFormat: '步骤 / 当前进度 / 证据 / 阻塞项 / 下一步',
    prompt: '你负责计划执行。将目标拆成有明确完成证据的小步骤，一次推进一个关键步骤；每次更新实际结果、失败原因和下一步。不能用计划代替执行，也不能在未验证时宣称完成。',
  },
  {
    id: 'skill_web_testing',
    name: '网页端到端测试',
    role: '浏览器 / 验收',
    description: '通过真实浏览器验证关键流程、状态、错误提示和响应式布局。',
    outputFormat: '测试场景 / 操作 / 实际结果 / 缺陷 / 截图',
    prompt: '你负责网页端到端测试。使用真实浏览器逐步执行核心用户流程，覆盖正常、空状态、失败状态和关键响应式视口；检查控制台错误、网络请求、文本溢出和交互阻塞，并记录可复现证据。',
  },
  {
    id: 'skill_image_creation',
    name: '图像创作',
    role: '绘画 / 视觉',
    description: '将需求转成明确的构图、风格、光线和生成提示。',
    outputFormat: '视觉目标 / 构图 / 风格 / Prompt / Negative Prompt',
    prompt: '你负责图像创作。先确定用途、主体、构图、镜头、光线、色彩、材质和输出比例，再生成可直接用于图像模型的 prompt。避免含糊风格词，确保主体清楚、文字需求明确。',
  },
  {
    id: 'skill_translation',
    name: '专业翻译',
    role: '翻译 / 术语',
    description: '保持原意、语气、格式和专业术语一致。',
    outputFormat: '译文 / 术语说明 / 待确认项',
    prompt: '你负责专业翻译。保持原文语义、语气、格式和技术术语，优先采用行业常用译法。不确定术语保留原文并标注待确认。',
  },
  {
    id: 'skill_local_automation',
    name: '本地自动化',
    role: 'CLI / 工具',
    description: '设计安全、可回滚、可验证的本地工具执行流程。',
    outputFormat: '前置检查 / 命令 / 结果 / 回滚',
    prompt: '你负责本地自动化。执行前检查环境和权限，使用明确、可回滚的命令，避免破坏性操作。每一步说明预期结果，并在完成后验证实际状态。',
  },
];

export const MINISTRY_SKILLS: Record<string, SkillId> = {
  rites: 'skill_chinese_writing',
  personnel: 'skill_general_reasoning',
  revenue: 'skill_deep_reasoning',
  war: 'skill_systematic_debugging',
  works: 'skill_code_execution',
  punishments: 'skill_security_review',
  archive: 'skill_research_summary',
};

export function getSkillById(skillId: string): Skill | undefined {
  return DEFAULT_SKILLS.find((skill) => skill.id === skillId);
}

export function getDefaultSkillIds(): SkillId[] {
  return DEFAULT_SKILLS.map((skill) => skill.id);
}
