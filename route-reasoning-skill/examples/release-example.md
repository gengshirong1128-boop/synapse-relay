# GitHub Release Example

## Input

我想把当前项目发到 GitHub，做一个 v0.3.0 release。

## Choices

- 当前情况：release
- 目标清晰度：清楚
- 修改范围：multi-module
- 约束：不加功能、不提交密钥、不自动 push
- 风险：发布风险、读取密钥风险、自动执行命令风险
- 推荐 Agent：Reviewer / Human

## Selected Cards

- 发布前先检查
- 安全边界先声明
- 约束优先
- 高影响决策人工确认

## RoutePlan

## Goal

- 完成 v0.3.0 发布前检查，准备 GitHub release。

## Route

1. 检查版本号、README、roadmap。
2. 扫描密钥、个人路径、日志和本地数据。
3. 运行构建或测试。
4. 输出建议 git 命令，不自动 push。

## Constraints

- 不新增功能。
- 不改业务逻辑。
- 不提交密钥和本地数据。
- 不自动 push。

## Recommended Agent

- agent: reviewer
- reason: 发布前重点是安全、文档和构建审查。

## Acceptance Criteria

- 版本号一致。
- 构建通过。
- 无真实密钥和个人信息。
- 发布说明清楚。

## TaskSpec

```json
{
  "taskType": "release",
  "goal": "完成 GitHub v0.3.0 发布前检查",
  "scope": ["版本号", "README", "docs", "安全扫描", "build"],
  "constraints": ["不新增功能", "不改业务逻辑", "不自动 push"],
  "acceptanceCriteria": ["版本号一致", "build 通过", "无敏感信息", "输出建议 git 命令"],
  "preferredAgent": "reviewer",
  "decisionCards": ["发布前先检查", "安全边界先声明", "约束优先"],
  "riskCards": ["读取密钥风险", "自动执行命令风险"],
  "priority": "P0",
  "confidence": 0.86,
  "assumptions": ["用户会手动确认 git push"],
  "forbiddenChanges": ["不要新增功能", "不要自动 push"],
  "handoffBrief": "当前目标是 release clean，完成检查后由用户手动提交和发布。"
}
```

## Reviewer Instruction

请检查发布前状态：版本号、文档、安全扫描、构建结果和 git 状态。不要新增功能，不要自动 commit 或 push。输出风险、修复建议和建议 commit message。

## ReviewReport

- 是否版本号一致
- 是否 README 和 docs 更新
- 是否无密钥和个人路径
- 是否 build 通过
- 是否未自动 push

## HandoffBrief

当前任务是 GitHub release clean。已确认目标为 v0.3.0，重点是版本、文档、安全和构建。下一步由用户手动执行 git commit / push。
