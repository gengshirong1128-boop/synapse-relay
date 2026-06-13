# Refactor Example

## Input

项目结构有点乱，想重构一下，但我怕改坏功能。

## Choices

- 当前情况：refactor
- 目标清晰度：不清楚
- 修改范围：architecture-level
- 约束：不破坏现有功能
- 风险：改动过大、缺少测试
- 推荐 Agent：Claude Code

## Selected Cards

- 重构先读项目
- 高风险先分析
- 稳定优先
- 多方案先会审

## RoutePlan

## Goal

- 梳理项目结构，找出低风险重构路线。

## Route

1. 先分析项目模块和依赖。
2. 输出 2-3 个重构方案。
3. 选择最小可回滚方案。
4. 每轮只重构一个边界清晰的模块。

## Constraints

- 不立即大改。
- 不删除现有功能。
- 不新增依赖。
- 必须保留验证方式。

## Recommended Agent

- agent: claude-code
- reason: 重构前需要读项目和分析架构，默认不立即改代码。

## Acceptance Criteria

- 产出清晰模块图或依赖说明。
- 产出最小重构方案。
- 每步都有验证方式。

## TaskSpec

```json
{
  "taskType": "refactor",
  "goal": "分析项目结构并提出低风险重构路线",
  "scope": ["模块边界", "依赖关系", "重构候选路径"],
  "constraints": ["不立即大改", "不删除现有功能", "不新增依赖"],
  "acceptanceCriteria": ["输出相关文件和数据流", "输出最小修改方案", "列出风险和验证方式"],
  "preferredAgent": "claude-code",
  "decisionCards": ["重构先读项目", "高风险先分析", "稳定优先"],
  "riskCards": ["改动过大", "缺少测试"],
  "priority": "P1",
  "confidence": 0.72,
  "assumptions": ["用户尚未提供完整项目结构"],
  "forbiddenChanges": ["不要立即重构代码", "不要删除功能"],
  "handoffBrief": "当前只做重构分析，等待用户确认后再执行。"
}
```

## Claude Code Instruction

请先阅读用户提供的项目上下文，分析模块边界、数据流和耦合点。默认不要修改代码。输出最小重构方案、风险清单、验证方式和建议执行顺序。

## ReviewReport

- 是否先分析而非直接改
- 是否避免大范围重写
- 是否列出验证方式
- 是否保留用户确认节点

## HandoffBrief

当前任务是重构前分析。推荐 Claude Code 输出结构分析和低风险路线，下一轮再决定是否交给 Codex 执行局部修改。
