# Bugfix Example

## Input

设置页里的 API 测试按钮失败了，但我不想改 UI，也不要新增依赖。

## Choices

- 当前情况：bugfix
- 目标清晰度：清楚
- 修改范围：single-module
- 约束：不改 UI、不新增依赖
- 风险：缺少测试、Provider 逻辑被误改
- 推荐 Agent：Codex

## Selected Cards

- 明确 bug 交给 Codex
- 约束优先
- 小步可验证优先
- Provider 逻辑被误改

## RoutePlan

## Goal

- 修复设置页 API 测试失败问题。

## Route

1. 定位 API 测试按钮调用链。
2. 最小修改失败路径。
3. 验证成功和失败提示。

## Constraints

- 不改 UI 布局和视觉样式。
- 不新增依赖。
- 不重写 Provider 逻辑。

## Recommended Agent

- agent: codex
- reason: 这是明确 bugfix，适合小步代码修改。

## Acceptance Criteria

- API 测试按钮能完成成功/失败验证。
- 原有 Provider 配置逻辑不变。
- 无新增依赖。

## TaskSpec

```json
{
  "taskType": "bugfix",
  "goal": "修复设置页 API 测试失败",
  "scope": ["设置页 API 测试调用链"],
  "constraints": ["不改 UI", "不新增依赖", "不重写 Provider 逻辑"],
  "acceptanceCriteria": ["API 测试成功路径可用", "失败时有明确反馈", "构建或相关测试通过"],
  "preferredAgent": "codex",
  "decisionCards": ["明确 bug 交给 Codex", "约束优先", "小步可验证优先"],
  "riskCards": ["Provider 逻辑被误改", "缺少测试"],
  "priority": "P0",
  "confidence": 0.82,
  "assumptions": ["用户提供的上下文足以定位大致模块"],
  "forbiddenChanges": ["不要改 UI", "不要新增依赖"],
  "handoffBrief": "修复设置页 API 测试失败，保持 UI 和 Provider 逻辑稳定。"
}
```

## Codex Instruction

请修复设置页 API 测试失败问题。只做最小修改，不改 UI，不新增依赖，不重写 Provider 逻辑。完成后汇报修改文件、原因、验证方式和剩余风险。

## ReviewReport

- 是否修复原始 API 测试失败
- 是否避免改 UI
- 是否避免新增依赖
- 是否说明验证方式

## HandoffBrief

当前任务是修复设置页 API 测试失败。约束是不改 UI、不新增依赖、不重写 Provider 逻辑。推荐 Codex 做最小修复，完成后用 Reviewer 检查输出是否违反约束。
