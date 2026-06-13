# Vague Idea Example

## Input

我这个项目越做越乱，不知道先修 bug、整理 UI，还是先重构。感觉哪里都不对，但又怕越改越乱。

## Choice Questions

## 1. 当前任务类型

A. 新功能
B. Bug 修复
C. UI 优化
D. 重构
E. 发布检查
F. 不确定，需要先规划

推荐：F
理由：用户同时提到 bug、UI 和重构，目标不清。

## 2. 当前清晰度

A. 目标明确
B. 目标大概明确
C. 只有想法
D. 不知道从哪开始

推荐：D
理由：用户明确说不知道先做什么。

## 3. 优先级

A. 快速能用
B. 稳定可靠
C. 代码质量
D. 长期扩展
E. 成本最低

推荐：B
理由：用户担心越改越乱，稳定优先。

## 4. 执行 Agent

A. Codex
B. Claude Code
C. DeepSeek
D. Reviewer
E. Human

推荐：B
理由：需要先分析路线，不适合直接改代码。

## 5. 输出需求

A. 路线图
B. 执行指令
C. 审查清单
D. 交接摘要
E. 先问更多问题

推荐：A
理由：当前最缺的是路线判断。

## Assumed User Choice

`1F 2D 3B 4B 5A`

## RoutePlan

## 1. Situation

项目同时存在 bug、UI 混乱和重构冲动，但缺少优先级判断。

## 2. Goal

先建立低风险路线，避免直接大改导致返工。

## 3. Constraints

- 不直接重构整个项目
- 不一次性修改多个方向
- 每一步都要可验证

## 4. Options

### Option A: 先修最阻塞 bug

- Benefit：最快恢复可用性
- Cost：低
- Risk：低
- Best For：存在明确错误或阻塞流程
- Not For：bug 不明确时
- Total Score：36

### Option B: 先做 UI cleanup

- Benefit：改善体验和可读性
- Cost：中
- Risk：中
- Best For：核心功能稳定但界面混乱
- Not For：功能仍不稳定时
- Total Score：31

### Option C: 先做重构分析，不改代码

- Benefit：找出长期结构问题
- Cost：中
- Risk：低
- Best For：用户不知道先做什么且怕改坏
- Not For：需要立刻上线修 bug
- Total Score：38

## 5. Recommended Route

推荐 Option C：先做重构分析，不改代码。

理由：当前信息混乱，直接修 bug 或 UI 可能继续扩大范围。先分析能降低风险，并为后续 bugfix / UI cleanup 排序。

## 6. First Action

生成 Claude Code 分析任务：让它先读项目结构、列出阻塞 bug、UI 混乱点和重构候选点，不立即改代码。

## 7. Validation Criteria

- 输出至少 3 个问题类别
- 每个问题有影响范围和风险
- 给出 P0/P1/P2 顺序
- 不修改代码

## 8. Risks

- 用户提供上下文不足
- Claude Code 可能直接开始改代码
- 分析过大导致没有下一步动作

## TaskSpec

```json
{
  "taskType": "planning",
  "goal": "先分析混乱项目并给出低风险路线",
  "scope": ["项目结构", "阻塞 bug", "UI 混乱点", "重构候选点"],
  "constraints": ["不要立即修改代码", "不要重构整个项目", "每一步要可验证"],
  "acceptanceCriteria": ["输出 P0/P1/P2", "每项有风险说明", "给出下一步执行指令"],
  "preferredAgent": "claude-code",
  "decisionCards": ["需求不清先规划", "高风险先分析", "稳定优先"],
  "riskCards": ["需求不清", "改动过大", "缺少测试"],
  "priority": "P0",
  "confidence": 0.74,
  "assumptions": ["用户没有提供完整项目上下文"],
  "forbiddenChanges": ["不要立即改代码", "不要删除功能"],
  "handoffBrief": "当前项目想法混乱，先让 Claude Code 做结构和风险分析，再决定后续执行路线。"
}
```

## Claude Code Instruction

请先分析项目结构和问题类别，不要修改代码。输出阻塞 bug、UI 混乱点、重构候选点、风险、P0/P1/P2 顺序和下一步建议。

## HandoffBrief

用户当前不知道项目先修 bug、整理 UI 还是重构。已选择稳定优先。推荐路线是先做 Claude Code 分析，不立即改代码。下一步要产出 P0/P1/P2，并为后续 Codex 执行生成明确任务。
