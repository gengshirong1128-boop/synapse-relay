# RoutePlan

## 1. Situation

用户想把 Skill 完善成好用、有测试、有“蒸馏逻辑学/博弈论/运筹学”噱头的路线决策引擎。

## 2. Goal

目标函数是：优先提升可验证效果，其次提升产品记忆点，避免理论堆砌。

## 3. Constraints

- 不声称逐字复制书籍内容
- 不只做品牌文案
- 必须有测试或评测方法

## 3.5 Distilled Rules Used

- Logic: 概念不清先定义、推荐必须有理由链
- Game Theory: 防止工具光环、激励一致才委派
- Operations Research: 目标函数先定义、硬约束不可违反、瓶颈优先

## 4. Options

### Option A: 文案包装优先

- Benefit: 最快形成噱头
- Cost: 低
- Risk: 容易空泛，不能证明好用
- Best For: 只做演示页
- Not For: 需要真实可复测效果
- Cards Used: 概念不清先定义
- Scores:
  - Goal Fit: 2
  - Constraint Fit: 3
  - Cost: 5
  - Risk: 2
  - Reversibility: 5
  - Verifiability: 1
  - Dependency: 5
  - Time to First Result: 5
  - Incentive Fit: 2
- Total Score: 30

### Option B: 规则卡片化优先

- Benefit: 把理论转成可执行判断
- Cost: 中
- Risk: 如果没有测试，仍可能只是看起来完整
- Best For: 需要提升推理质量
- Not For: 需要立即证明稳定有效
- Cards Used: 目标函数先定义、推荐必须有理由链、防止工具光环
- Scores:
  - Goal Fit: 4
  - Constraint Fit: 4
  - Cost: 4
  - Risk: 4
  - Reversibility: 4
  - Verifiability: 3
  - Dependency: 5
  - Time to First Result: 4
  - Incentive Fit: 4
- Total Score: 49

### Option C: 规则卡片化 + 自动评测

- Benefit: 同时获得噱头、可用规则和可复测证据
- Cost: 中
- Risk: 初版评测只能检查结构和关键门槛，不能替代真人质量判断
- Best For: 需要“好用、有测试、有记忆点”
- Not For: 只想快速写营销介绍
- Cards Used: 硬约束不可违反、激励一致才委派、瓶颈优先
- Scores:
  - Goal Fit: 5
  - Constraint Fit: 5
  - Cost: 4
  - Risk: 4
  - Reversibility: 4
  - Verifiability: 5
  - Dependency: 5
  - Time to First Result: 4
  - Incentive Fit: 5
- Total Score: 61

## 5. Recommended Route

Recommend Option C: 规则卡片化 + 自动评测。

Reason Chain:
1. Objective Function: 本轮首要目标是证明 Skill 好用，其次是形成“蒸馏三学科”的产品记忆点。
2. Hard Constraints: 不能只做噱头，必须有测试和可验证效果。
3. Key Risks / Counterexamples: 如果只写文案，无法证明好用；如果只加卡片，无法防止回归。
4. Score Signal: Option C 在 Goal Fit、Constraint Fit、Verifiability 和 Incentive Fit 上最高。
5. Why This Executor: Codex 适合做小范围文件修改和测试脚本；Reviewer 后续适合检查输出质量。

## 6. First Action

补充正式 Decision Cards、Risk Cards、scoring rules，并新增验证脚本。

## 7. Validation Criteria

- Skill 有标准 frontmatter
- 至少 3 个理论来源领域进入可执行规则
- 自动验证脚本通过
- 样例输出能通过 output evaluator

## 8. Risks

- 自动评测偏结构化，不能完全判断语义质量
- 后续仍需人工样例和真实任务 forward-test

# TaskSpec

## Background

当前 Skill 已有路线规划结构，但理论蒸馏和测试证据不足。

## Objective

把 Skill 完善成可触发、可复测、可宣传的路线决策引擎。

## Scope

- SKILL.md 定位
- Decision Cards / Risk Cards / Scoring Rules
- route planner / task package / reviewer prompt
- 自动验证脚本和测试样例

## Non-goals

- 不接入 app UI
- 不调用真实模型
- 不复制书籍原文

## Files / Areas

- route-reasoning-skill

## Steps

1. 补足三学科蒸馏定位。
2. 将关键理论变成卡片和评分维度。
3. 增加 skill 结构验证脚本。
4. 增加输出评测脚本。
5. 跑通测试。

## Acceptance Criteria

- `validate_skill.py` 通过
- `evaluate_output.py` 对 passing fixture 通过
- 对坏样例能失败

## Restrictions

- 不新增第三方依赖
- 不改无关 app 代码
- 不创建无关文档

## Output Required

- 修改文件列表
- 测试命令和结果
- 剩余风险

# HandoffBrief

## Current Goal

完善 Route Reasoning Skill，使其好用、有测试、有蒸馏逻辑学/博弈论/运筹学的产品记忆点。

## Confirmed Decisions

采用“规则卡片化 + 自动评测”路线。

## Recommended Route

先强化 Skill 本体，不接入 app。

## Selected Agent

Codex 负责实现和本地测试，Reviewer 后续做输出质量审查。

## Constraints

不复制书籍原文，不新增依赖，不改无关 app 代码。

## Risks

自动评测不能完全替代人工语义判断。

## Acceptance Criteria

Skill 验证脚本通过，输出评测脚本通过合格样例并能拒绝坏样例。

## Next Action

运行验证脚本并根据失败项修正。
