# Test Cases

These cases are used to pressure-test Route Reasoning Skill v0.1.0.

They should not add official cards directly. Use them to evaluate whether candidate cards should be promoted in v0.2.

## Case 1: Continue Neige Lite or Extract Skill First

## Input

我现在有一个本地 AI 指挥台原型，功能越做越多。继续做软件会越来越重，但我也看到里面的路线规划和任务包能力可以单独抽成 Skill。我不知道该继续开发软件，还是先抽 Skill。

## Expected Behavior

- 先用选择题确认目标：产品继续开发、Skill 抽取、发布清理或路线判断
- 输出至少 3 条路线
- 比较继续开发、先抽 Skill、先 release clean 的成本、风险、收益
- 最终只推荐 1 条路线

## Should Trigger

- 需求不清先规划
- 高风险先分析
- 目标函数先定义
- 防止锚定第一方案

## Should Not Do

- 不直接建议继续加功能
- 不把原型项目重构成新产品
- 不声称已经读过完整代码

## Pass Criteria

- 推荐路线清晰
- 有 First Action
- 有 TaskSpec
- 有 HandoffBrief

## Case 2: Codex Broke UI/API Input

## Input

Codex 改完以后，页面 UI 乱了，API 输入框也不好用了。我不确定是先修 UI，还是先修接口输入逻辑。不要新增依赖，不要大改。

## Expected Behavior

- 先判断这是 bugfix + UI risk
- 输出 3 条路线：先修 API 输入、先恢复 UI、先审查改动范围
- 最终推荐低风险最短闭环
- 生成 Codex 或 Reviewer 指令

## Should Trigger

- UI 变更隔离
- 明确 bug 交给 Codex
- 小步可验证优先
- 稳定优先

## Should Not Do

- 不建议重写页面
- 不新增依赖
- 不扩大到整体设计改版

## Pass Criteria

- 有明确禁止事项
- TaskSpec 可交给 Codex
- ReviewReport 能检查是否又改坏 UI

## Case 3: Operations Research Candidate Rules for v0.2

## Input

我想把运筹学里的一些思想加入 Skill，比如目标函数、硬约束、瓶颈、最短路径。但我怕变成理论堆砌，不知道哪些该进正式 cards。

## Expected Behavior

- 不直接加入正式 cards
- 使用 distillation 机制筛选候选
- 输出候选规则评估路线
- 说明最多提升少量卡片

## Should Trigger

- 目标函数先定义
- 硬约束不可违反
- 阻塞任务优先
- 不允许为了显得高级而添加理论术语

## Should Not Do

- 不摘抄书籍原文
- 不扩写 SKILL.md 成理论文章
- 不把所有候选直接加入 cards/

## Pass Criteria

- 给出筛选标准
- 给出测试方法
- 保持正式 Skill 简洁

## Case 4: Codex / Claude Code / DeepSeek Division

## Input

我有一个任务，不知道该交给 Codex、Claude Code 还是 DeepSeek。它可能要读项目，也可能只是修个小 bug。我不想浪费 token，也不想让 Agent 改太多。

## Expected Behavior

- 先问任务清晰度、范围、风险和成本
- 输出 3 条 Agent 分工路线
- 推荐 1 个 Agent 或先 Reviewer / Human
- 生成对应 TaskSpec

## Should Trigger

- 成本受限选低成本路径
- 重构先读项目
- 明确 bug 交给 Codex
- 防止工具光环

## Should Not Do

- 不默认把所有任务交给最强模型
- 不忽略成本约束
- 不让分析型 Agent 直接大改

## Pass Criteria

- Agent 推荐有理由链
- TaskSpec 限定范围
- 输出可执行指令

## Case 5: Huge AI Software Idea

## Input

我想做一个很大的 AI 软件，能规划项目、管理 Agent、接入模型、审查代码、自动生成任务，还能做长期记忆。我想法很多，不知道从哪开始。

## Expected Behavior

- 先生成最多 5 个选择题
- 不直接输出完整产品蓝图
- 收敛到 v0.1 第一条路线
- 推荐最小可验证闭环

## Should Trigger

- 需求不清先规划
- 最短闭环优先
- 事实和假设分离
- 高风险先列未知项

## Should Not Do

- 不生成过大的功能清单
- 不承诺自动执行或自动读取文件
- 不把长期愿景当作第一轮任务

## Pass Criteria

- 输出 Choice Questions
- 输出 3 条路线
- 最终推荐 1 条最小闭环
- 保留 HandoffBrief

## Case 6: Distilled Logic Game Theory Operations Research Pitch

## Input

我想把这个 Skill 包装成一个有噱头的路线决策引擎，说它蒸馏了逻辑学、博弈论、运筹学的书。但不能只是听起来高级，必须真的好用、有测试、有可验证效果。

## Expected Behavior

- 把“噱头”转成可执行产品定位
- 明确哪些理论进入 Decision Cards、Risk Cards、Scoring Rules 或 ReviewReport
- 比较至少 3 条完善路线：只做文案包装、规则卡片化、规则 + 自动测试
- 最终推荐规则 + 自动测试路线
- 生成 TaskSpec，要求可运行校验脚本或固定评测流程

## Should Trigger

- 概念不清先定义
- 推荐必须有理由链
- 防止工具光环
- 激励一致才委派
- 理论堆砌风险

## Should Not Do

- 不声称逐字读完或复制某些书
- 不输出大段理论讲义
- 不把噱头做成空泛品牌文案
- 不跳过测试

## Pass Criteria

- 有“蒸馏规则”而不是理论堆砌
- 有至少 3 条路线比较
- 有自动或人工可复测评测方法
- 有 TaskSpec
- 有 ReviewReport 或 rubric 更新要求

## Case 7: Fable 5 Delegates to Opus and Sonnet

## Input

我正在 Fable5 中处理一个大型代码任务。Fable5 很强但很贵，我希望它负责主持和最终裁决，让 Sonnet 执行，让 Opus 只在困难或高风险时复核。

## Expected Behavior

- 输出 ModelCabinetPlan
- 默认把第一轮执行交给 Sonnet
- 写出 Sonnet 升级到 Opus、Opus 升级到 Fable 5 的明确条件
- 宿主支持 delegation 工具时，由 Fable 5 发起调用并接收回报
- 宿主不支持调用时，输出可复制的 Delegation Calls
- 裁决完成后把明确执行任务降级给 Sonnet

## Should Trigger

- 便宜模型先证伪
- 贵模型只解瓶颈
- 裁决后立即降级
- 防止工具光环

## Should Not Do

- 不让 Fable 5 执行批量或重复工作
- 不在没有失败证据时直接升级到 Opus
- 不写死模型 ID 或价格
- 不声称调用了宿主不支持的模型

## Pass Criteria

- 有 Delegation Calls
- 有升级和降级闸门
- 有成本假设
- 有明确第一步

## Case 8: High-Stakes Decision Cabinet

## Input

我们准备把新认证系统一次性切到所有用户。测试通过，但没有真实流量验证。团队多数人赞成立即发布，少数人担心无法回滚。

## Expected Behavior

- 先区分事实、假设和未知项
- 至少比较立即全量、分阶段发布、暂缓发布 3 条路线
- 独立记录 Advocate、Devil's Advocate、Risk Minister 和 Executor 意见
- Risk Minister 基于不可回滚风险提出 Veto 或条件放行
- 最终输出 DecisionReceipt
- 包含 Strongest Dissent、Veto Record 和可验证 Flip Conditions

## Should Trigger

- 独立表态防从众
- 否决必须可解除
- 先写翻案条件
- 最小后悔优先

## Should Not Do

- 不用多数票替代理由链
- 不隐藏少数意见
- 不使用没有解除条件的否决
- 不声称已经发布

## Pass Criteria

- DecisionReceipt validator 通过
- 至少 3 条路线
- 有明确 Veto 状态
- 有 Observable Signal、Threshold 和 Action When Triggered
