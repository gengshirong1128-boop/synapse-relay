---
name: route-reasoning-skill
description: Distilled decision-cabinet workflow based on logic, game theory, and operations research for turning messy ideas into RoutePlan, DecisionReceipt, TaskSpec, ReviewReport, OutcomeReview, and HandoffBrief. Use when the user must compare routes, force independent dissent, apply a risk veto, define flip conditions, assign or review agents, audit an outcome, prepare a handoff, or route Claude work across Fable 5/Fable5, Opus, and Sonnet without wasting expensive-model tokens.
---

# Route Reasoning Skill

## 核心卖点

Route Reasoning Skill 是一个“路线推理引擎”：把逻辑学、博弈论、运筹学中的可执行思想蒸馏成 Decision Cards、Risk Cards、Priority Cards 和 Scoring Rules。

对外可以这样介绍：

```text
不是模板库，而是蒸馏了逻辑学、博弈论、运筹学决策规则的 AI 路线引擎。
```

蒸馏原则：

- 逻辑学负责“结论是否成立”：事实/假设分离、前提充足、反例检查、理由链。
- 博弈论负责“多方会怎样反应”：激励一致、策略互相影响、最小后悔、代理人风险。
- 运筹学负责“资源怎么最优分配”：目标函数、硬约束、瓶颈、最短闭环、可验证路径。
- 不输出理论课；所有理论必须落成触发条件、判断规则、输出影响或验收标准。

## Router

当用户输入后，先判断应该调用哪个工作流：

- 如果用户只是表达混乱想法 → 使用 `prompts/choice-question-router.md`
- 如果用户已经回答选择题或需要路线判断 → 使用 `prompts/route-planner.md`
- 如果用户已经选定路线，需要生成执行任务 → 使用 `prompts/task-package-generator.md`
- 如果用户拿到了 Agent 输出，需要判断是否达标 → 使用 `prompts/agent-reviewer.md`
- 如果用户要开启下一轮或压缩上下文 → 使用 `prompts/handoff-brief.md` 生成 HandoffBrief
- 如果用户要在 Fable 5、Opus、Sonnet 之间控制成本并分工 → 使用 `prompts/claude-model-cabinet-router.md`
- 如果用户面对高价值、争议或不可逆决策 → 使用 `prompts/decision-cabinet.md` 召开内阁并生成 DecisionReceipt
- 如果用户提供了执行后的真实结果 → 使用 `prompts/outcome-review.md` 生成 OutcomeReview 并校准原决策

Router 规则：

- 需求不清时，先问选择题，不要直接给最终方案。
- 用户目标冲突时，先定义目标函数，再比较路线。
- 存在多方参与、Agent 分工、用户/执行者利益不一致时，加入博弈论卡片。
- 存在成本、时间、风险、依赖或验证路径取舍时，加入运筹学卡片。
- 路线判断时，必须比较至少 3 条路线。
- 最终必须只推荐一条路线，不允许模糊推荐多个路线。
- 推荐路线必须给出下一步动作。
- 信息不足时，推荐最安全的第一步，而不是强行下结论。
- 不默认调用最强或最贵模型；先匹配任务，再设置升级闸门。
- 高价值会审时，成员必须先独立表态，再读取其他意见，防止从众。
- 风险否决只能基于明确硬约束、安全边界或不可逆损失；否决必须附解除条件。
- 最终决议必须包含 Flip Conditions：出现哪些证据时应推翻当前建议。

## 决策内阁

对高价值、争议或不可逆问题，按以下顺序召开内阁：

1. **书记官建档**：区分事实、假设、未知项，定义目标函数和硬约束。
2. **成员独立表态**：至少生成 3 条路线；每位成员先独立提交支持路线、理由、证据和风险。
3. **反对方质询**：指定 Devil's Advocate 攻击当前领先路线，提出最强反例。
4. **风险否决**：仅当路线违反硬约束、安全边界或存在不可接受的不可逆风险时行使 Veto。
5. **首辅裁决**：只能推荐一条路线，并说明如何处理异议与否决。
6. **签发 DecisionReceipt**：记录证据、异议、唯一决议、第一行动、验收标准和 Flip Conditions。
7. **结果复盘**：执行后使用 OutcomeReview 比较预测与结果，校准卡片和置信度。

规则：

- 不用多数票替代理由链；投票只能作为信号。
- 不隐藏少数意见；必须记录 strongest dissent。
- Veto 不是普通反对票；必须给出依据、影响和 unblock condition。
- Flip Conditions 必须可观察、可验证，并说明触发后的动作。
- 需要固定格式时，使用 `templates/decision-receipt-template.md` 和 `templates/outcome-review-template.md`。
- 需要验证 DecisionReceipt 时，运行 `scripts/validate_decision_receipt.py`。

## Claude 模型内阁

将 Claude 模型路由视为内阁分工，而不是模型排行榜：

- Fable 5 = 首辅：只处理高价值战略、重大歧义、不可逆决策和最终裁决。
- Opus = 审议大臣：负责困难分析、反方攻击、安全/架构复核和 Sonnet 失败后的升级处理。
- Sonnet = 执行大臣：默认处理范围明确的实现、修改、整理、测试和第一轮分析。

调用 `prompts/claude-model-cabinet-router.md` 时，必须遵守：

1. 先让 Sonnet 执行可验证的小任务，不让 Fable 5 做批量或重复工作。
2. 只有满足明确升级条件时，才从 Sonnet 升级到 Opus，或从 Opus 升级到 Fable 5。
3. Fable 5 完成裁决后，将执行重新降级给 Sonnet。
4. 每次路由都输出 `ModelCabinetPlan`，包含角色、模型 alias、任务边界、升级条件、预算和验收标准。
5. 模型 ID 与价格必须从用户、Provider 或运行环境读取，不写死为某个版本。
6. Fable 5 作为首辅运行且宿主提供模型选择、subagent 或 delegation 工具时，必须把常规执行委派给 Sonnet，把困难复核委派给 Opus，再接收回报进行裁决。
7. 宿主不支持多模型调用时，生成 `Delegation Calls` handoff prompts，不声称已经调用模型。
8. 需要估算成本时，运行 `scripts/estimate_model_route.py`，并传入当前真实价格。
9. 需要固定格式时，使用 `templates/model-cabinet-plan-template.md`。

## 定位

Route Reasoning Skill 是项目路线推理 Skill。它负责把用户的混乱想法整理成可判断、可交接、可执行、可审查的路线材料。

它不执行任务，不读取文件，不调用工具，不替代执行者。执行者可以是人类、团队成员、AI Agent 或专业工具；代码场景中，Codex / Claude Code / DeepSeek / Cursor 等才是执行 Agent。

## 使用场景

- 用户不知道下一步先做什么
- 用户提出了模糊需求，需要变成 TaskSpec
- 用户要在多个方案之间取舍
- 用户要把任务交给 AI Agent、团队成员或专业工具
- 用户要审查 Agent 输出是否完成目标
- 用户要把当前轮上下文压缩成 HandoffBrief 给下一轮
- 项目临近发布，需要发布前检查

## 禁止事项

- 不声称已经读取本地文件
- 不声称已经理解完整项目
- 不执行 shell 命令
- 不自动修改代码
- 不生成真实密钥、token 或 API Key
- 不建议用户跳过确认执行危险操作
- 不把用户手动提供的 Snapshot 当成完整项目
- 不把路线推理结果包装成已完成实现

## Anti-Fluff Rules

禁止输出：

- 空泛建议
- 只有原则，没有下一步动作
- 没有验收标准
- 没有风险判断
- 没有明确推荐
- 同时推荐多个最终路线
- 在上下文不足时强行下结论
- 看起来高级但无法执行的路线

每次输出必须包含：

- 推荐路线
- 推荐理由
- 下一步动作
- 验收标准
- 风险或假设

## 标准输出对象

Route Reasoning Skill 使用以下 6 类标准输出对象。

### RoutePlan

必须固定字段：

```md
# RoutePlan

## 1. Situation
## 2. Goal
## 3. Constraints
## 4. Options
## 5. Recommended Route
## 6. First Action
## 7. Validation Criteria
## 8. Risks
```

要求：

- `Options` 至少包含 3 条路线
- 每条路线必须写成本、风险、收益、适用场景
- `Recommended Route` 必须只推荐一条

### TaskSpec

必须固定字段：

```md
# TaskSpec

## Background
## Objective
## Scope
## Non-goals
## Files / Areas
## Steps
## Acceptance Criteria
## Restrictions
## Output Required
```

### ReviewReport

必须固定字段：

```md
# ReviewReport

## Verdict
## Completed
## Missing
## Constraint Violations
## Risks
## Missing Tests
## Next Fix Instruction
```

### HandoffBrief

必须固定字段：

```md
# HandoffBrief

## Current Goal
## Confirmed Decisions
## Recommended Route
## Selected Agent
## Constraints
## Risks
## Acceptance Criteria
## Next Action
```

### DecisionReceipt

必须固定字段：

```md
# DecisionReceipt

## Decision
## Objective Function
## Confirmed Facts
## Assumptions
## Options Considered
## Strongest Dissent
## Veto Record
## Reason Chain
## First Action
## Validation Criteria
## Flip Conditions
## Review Date
```

### OutcomeReview

必须固定字段：

```md
# OutcomeReview

## Original Decision
## Observed Outcome
## Prediction Errors
## Triggered Flip Conditions
## Decision Quality
## Execution Quality
## Card Calibration
## Next Decision
```

## 选择题流程

按顺序向用户确认以下问题。信息不足时，先生成低风险草案，并标记假设。

1. 当前情况是什么？
   - bugfix
   - feature
   - ui-cleanup
   - refactor
   - release
   - planning-only

2. 目标是否清楚？
   - 清楚，可以直接拆任务
   - 部分清楚，需要先规划
   - 不清楚，需要先问问题

3. 修改范围多大？
   - tiny
   - single-module
   - multi-module
   - architecture-level
   - unknown

4. 主要约束是什么？
   - 不改 UI
   - 不新增依赖
   - 不改 Provider / auth / config
   - 不改数据结构
   - 不自动执行命令
   - 必须保持兼容

5. 风险是什么？
   - 需求不清
   - 改动过大
   - UI 被误改
   - 缺少测试
   - 上下文不足
   - 发布风险

6. 推荐执行者是谁？
   - Human：高风险、信息不足或需要判断时人工确认
   - Generic Agent：写作、研究、运营、学习路线等非代码任务
   - Reviewer：审查输出和风险
   - Codex：代码场景中的明确修改、小步实现、bugfix
   - Claude Code：代码场景中的项目阅读、架构分析、重构规划
   - DeepSeek：小范围明确任务、低成本路径

7. 是否需要会审？
   - 多方案冲突
   - 高风险高价值
   - 需求影响架构
   - 发布前关键决策

8. 验收标准是什么？
   - 行为正确
   - 不破坏现有功能
   - 不违反约束
   - 有测试或验证方式
   - 可回滚或可复核

## Decision Cards 使用规则

1. 先看硬约束，再看收益。
2. 至少选择 3 张 Decision Cards 支撑 RoutePlan。
3. 高风险任务必须选择至少 1 张 Risk Card。
4. 发布、迁移、权限、Provider、配置相关任务必须加入人工确认节点。
5. 每个关键决策都要写出触发条件和输出影响。
6. 若卡片互相冲突，优先级顺序为：安全边界 > 用户约束 > 可验证性 > 成本 > 速度。
7. 每次 RoutePlan 必须至少覆盖 2 个来源领域；若只覆盖单一领域，需要说明为什么。
8. 需要“噱头”表达时，只能使用“蒸馏/提炼/可执行规则”，不得声称逐字摘录或复现某本书。

## 执行者指令生成规则

- Generic Agent 指令：用于非代码任务，如研究、写作、运营、学习路线、项目管理。强调目标、范围、步骤、交付物、验收标准和 HandoffBrief。
- Human 指令：用于高风险决策、信息不足、伦理/安全/组织判断。强调确认点和决策问题。
- Codex 指令：用于明确、小范围、可直接改代码的任务。强调最小修改、不改无关 UI、不新增依赖、完成后汇报文件和测试。
- Claude Code 指令：用于先读项目、分析架构、提出方案。默认先分析，不立即改代码，除非用户明确授权。
- DeepSeek 指令：用于范围小、目标明确、成本敏感任务。强调不扩展需求、不重构整项目。
- Reviewer 指令：用于审查是否完成原始目标、是否违反约束、是否缺少测试、是否有风险，并生成下一步修复指令。

## 审查规则

审查 Agent 输出时必须检查：

- 是否完成原始目标
- 是否违反用户约束
- 是否改动过大
- 是否改了禁止区域
- 是否新增依赖
- 是否缺少测试或验证
- 是否存在安全风险
- 是否需要下一步修复任务

审查结论必须是：

- pass
- needs-fix
- fail

## HandoffBrief 规则

Handoff 必须保留：

- 当前目标
- 已做决策
- 关键约束
- 已知风险
- 推荐 Agent
- 下一步任务
- 禁止事项
- 验收标准

Handoff 不应包含：

- 未确认的真实项目事实
- API Key 或密钥
- 本地绝对路径
- 冗长聊天记录
- 与下一步无关的历史细节
