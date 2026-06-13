# Route Scoring Rules

Use scoring only to compare routes. Do not overfit the formula. The score is a decision aid, not a proof.

评分只用于辅助排序，不是绝对结论。

如果某条路线违反用户约束、安全边界、成本限制或稳定性要求，即使分数高也不得推荐。

## Score Dimensions

Each route is scored from 1 to 5.

- Goal Fit：是否贴合目标
- Constraint Fit：是否完全满足硬约束
- Cost：成本是否可接受
- Risk：风险是否可控
- Reversibility：是否可回滚
- Verifiability：是否容易验证
- Dependency：依赖是否少
- Time to First Result：多久能看到结果
- Incentive Fit：执行者、用户和验收目标是否一致

## Recommended Formula

```text
Score =
Goal Fit * 2
+ Constraint Fit * 3
+ Verifiability * 2
+ Reversibility * 1.5
+ Cost * 1
+ Risk * 1
+ Dependency * 1
+ Time to First Result * 1
+ Incentive Fit * 1
```

## Scoring Rules

- 5 = very strong
- 4 = good
- 3 = acceptable
- 2 = weak
- 1 = poor

For Risk, higher means safer and more controllable.

For Cost, higher means lower cost and easier execution.

For Constraint Fit, 5 means all hard constraints are satisfied. A route with Constraint Fit below 3 must be eliminated, not merely scored lower.

For Incentive Fit, higher means the selected executor has the right capability, context, permission, and acceptance criteria.

## Route Comparison Format

```md
## Options

### Option A: ...
- Benefit:
- Cost:
- Risk:
- Best For:
- Not For:
- Scores:
  - Goal Fit:
  - Constraint Fit:
  - Cost:
  - Risk:
  - Reversibility:
  - Verifiability:
  - Dependency:
  - Time to First Result:
  - Incentive Fit:
- Total Score:

### Option B: ...
...

### Option C: ...
...
```

## Recommendation Rule

- Always recommend exactly one route.
- Reject any route that violates user constraints, safety boundaries, cost limits, or stability requirements.
- Reject any route whose executor cannot be verified, cannot report back, or has unclear acceptance criteria.
- If scores are close, choose the route with lower risk and better verifiability.
- If information is insufficient, recommend the safest first action, not a full implementation.
- Never recommend multiple routes as the final answer.
