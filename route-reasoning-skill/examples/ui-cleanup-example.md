# UI Cleanup Example

## Input

页面有点乱，我想整理一下，但不要影响现有功能。

## Choices

- 当前情况：ui-cleanup
- 目标清晰度：部分清楚
- 修改范围：single-module
- 约束：不破坏功能
- 风险：UI 被误改、需求不清
- 推荐 Agent：Claude Code 先分析

## Selected Cards

- 需求不清先规划
- UI 变更隔离
- 稳定优先
- 先验收后扩展

## RoutePlan

## Goal

- 整理页面结构，让视觉和信息层级更清楚。

## Route

1. 先列出现有页面问题和可保留行为。
2. 确认只做布局/层级整理，不改业务逻辑。
3. 生成小范围 UI cleanup 指令。

## Constraints

- 不改变业务行为。
- 不删除功能入口。
- 不新增依赖。

## Recommended Agent

- agent: claude-code
- reason: 需求还不够具体，先分析页面结构和最小整理方案。

## Acceptance Criteria

- 页面更易扫描。
- 原交互入口仍存在。
- 无业务逻辑改动。

## TaskSpec

```json
{
  "taskType": "ui-cleanup",
  "goal": "整理页面信息层级，不影响现有功能",
  "scope": ["目标页面布局", "视觉层级", "信息组织"],
  "constraints": ["不改业务逻辑", "不删除功能入口", "不新增依赖"],
  "acceptanceCriteria": ["页面更清晰", "现有功能入口保留", "无业务行为变化"],
  "preferredAgent": "claude-code",
  "decisionCards": ["需求不清先规划", "UI 变更隔离", "稳定优先"],
  "riskCards": ["UI 被误改", "需求不清"],
  "priority": "P1",
  "confidence": 0.68,
  "assumptions": ["用户还没有指定具体页面细节"],
  "forbiddenChanges": ["不要改业务逻辑", "不要删除入口"],
  "handoffBrief": "先分析 UI cleanup 范围，确认后再交给执行 Agent。"
}
```

## Claude Code Instruction

请先分析目标页面的信息层级、交互入口和现有行为。不要立即修改代码。输出最小 UI cleanup 方案、涉及文件、风险、需要用户确认的问题。

## ReviewReport

- 是否先分析而不是直接改
- 是否隔离 UI 改动
- 是否保留现有功能
- 是否提出明确验收标准

## HandoffBrief

当前任务是 UI cleanup，但需求细节不足。优先让 Claude Code 分析页面结构，确认后再生成 Codex 实现任务。
