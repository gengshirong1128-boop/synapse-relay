# Route Reasoning Skill

[English](./README.md) | **简体中文**

[![Validate Decision Cabinet](https://github.com/gengshirong1128-boop/route-reasoning-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/gengshirong1128-boop/route-reasoning-skill/actions/workflows/validate.yml)

把混乱想法变成可执行、可审计的决策。

Route Reasoning Skill 是一个 AI 决策内阁工作流：它把模糊意图转换成选择题、可比较路线、DecisionReceipt、可执行 TaskSpec、审查报告、结果复盘和 HandoffBrief。它将逻辑学、博弈论与运筹学提炼成决策卡片、评分规则、风险否决、翻案条件和自动验证脚本。

```text
混乱输入 -> 选择题 -> RoutePlan -> 决策内阁 -> DecisionReceipt -> TaskSpec -> ReviewReport -> OutcomeReview -> HandoffBrief
```

## 为什么需要它

大多数 Prompt 太早给出答案。这个 Skill 会先澄清目标、约束与风险，避免空泛计划、工具光环和无法验证的建议。

适用场景：

- 软件规划与 Agent 交接
- Codex / Claude Code / DeepSeek 任务路由
- 产品方向与发布决策
- 研究、写作、学习和运营规划
- 审查 Agent 是否真正完成目标

## 提炼后的决策引擎

这里的“提炼”不是复制书籍内容，而是把理论变成紧凑的执行规则：

- 逻辑学：区分事实与假设，定义模糊概念，要求理由链，检查反例。
- 博弈论：匹配执行者与激励，避免工具光环，预测参与方反应，选择最小后悔动作。
- 运筹学：定义目标函数，执行硬约束，优先处理瓶颈，按可验证性和成本比较路线。

核心规则位于：

- [`cards/decision-cards.md`](./cards/decision-cards.md)
- [`cards/risk-cards.md`](./cards/risk-cards.md)
- [`cards/scoring-rules.md`](./cards/scoring-rules.md)
- [`distillation/source-map.md`](./distillation/source-map.md)

## 决策内阁

面对高价值、存在争议或不可逆的决策时，Skill 会：

- 分离事实、假设和未知项
- 要求成员在阅读其他意见前独立表态
- 指定 Devil's Advocate 攻击领先路线
- 仅允许 Risk Minister 基于硬约束、安全边界或不可接受的不可逆风险行使否决权
- 要求每次否决包含解除条件
- 记录最强反对意见
- 在签发最终决议前定义可观察的翻案条件
- 在结果复盘中分开评价决策质量与执行质量

## 快速开始

安装到 Claude Code：

```bash
git clone https://github.com/gengshirong1128-boop/route-reasoning-skill.git ~/.claude/skills/route-reasoning-skill
```

安装到 Codex：

```bash
git clone https://github.com/gengshirong1128-boop/route-reasoning-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/route-reasoning-skill"
```

使用以下 Prompt：

```text
使用 Route Reasoning Skill 处理这个混乱想法。
先生成选择题。
关键选择确认前，不要生成最终方案。
```

用紧凑选项回答，例如：

```text
1A 2B 3D 4D 5A
```

然后要求 Skill 继续：

```text
生成 RoutePlan、TaskSpec、Agent 指令、ReviewReport 检查清单和 HandoffBrief。
最终只推荐一条路线。
```

## 输出契约

完整输出应包含：

- 至少包含 3 条路线的 `# RoutePlan`
- 只推荐 1 条最终路线
- 每条路线的成本、风险、收益、适用与不适用场景、评分和理由链
- 包含范围、限制、步骤、验收标准和交付要求的 `# TaskSpec`
- Human / Generic Agent / Reviewer / Codex / Claude Code / DeepSeek 的执行者适配理由
- `# ReviewReport` 或审查清单
- 下一轮使用的 `# HandoffBrief`
- 高价值决策使用的 `# DecisionReceipt`，包含 Strongest Dissent、Veto Record 和 Flip Conditions
- 执行后的 `# OutcomeReview`，分别评价 Decision Quality 和 Execution Quality

## 验证

当前可复现的包数据：

- 已验证 **37** 条 decision cards
- 已验证 **13** 个场景测试用例
- 正确样例必须通过，故意空泛的样例必须被拒绝
- DecisionReceipt 与 OutcomeReview 由 deterministic scripts 检查结构

运行 Skill 包验证器：

```bash
python scripts/validate_skill.py
```

验证生成的路线输出：

```bash
python scripts/evaluate_output.py tests/fixtures/passing-route-output.md
```

验证可审计决议：

```bash
python scripts/validate_decision_receipt.py tests/fixtures/passing-decision-receipt.md
```

验证结果复盘：

```bash
python scripts/validate_outcome_review.py tests/fixtures/passing-outcome-review.md
```

评估器会拒绝缺少三条路线、理由链、TaskSpec、HandoffBrief 或提炼决策规则的空泛输出：

```bash
python scripts/evaluate_output.py tests/fixtures/failing-fluffy-output.md
```

## 建议的 GitHub Topics

```text
ai-agents, codex, decision-making, prompt-engineering, skills, task-planning, route-planning, operations-research, game-theory, logic
```

## 示例

- [`examples/quickstart-messy-idea.md`](./examples/quickstart-messy-idea.md)
- [`examples/bugfix-example.md`](./examples/bugfix-example.md)
- [`examples/refactor-example.md`](./examples/refactor-example.md)
- [`examples/release-example.md`](./examples/release-example.md)
- [`examples/research-plan-example.md`](./examples/research-plan-example.md)

## 它不是什么

- 不是代码执行工具
- 不是文件读取工具
- 不是自动化 Agent
- 不是书籍内容摘抄合集
- 不是理论文章生成器

## 仓库结构

```text
route-reasoning-skill/
  .github/workflows/validate.yml
  SKILL.md
  README.md
  README.zh-CN.md
  QUICKSTART.md
  LICENSE
  agents/
  cards/
  prompts/
  templates/
  scripts/
  tests/
  distillation/
```

## 许可证

MIT，详见 [`LICENSE`](./LICENSE)。
