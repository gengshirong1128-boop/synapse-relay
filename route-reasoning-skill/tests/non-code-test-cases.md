# Non-Code Test Cases

These cases test whether Route Reasoning Skill works beyond coding projects.

## Case 1: Learning a New Field

## Input

我想系统学习决策心理学，但资料太多，不知道先看书、看课程，还是直接做案例练习。

## Expected Behavior

- Ask choice questions about goal, time, depth, and output format.
- Compare at least 3 routes.
- Recommend exactly 1 route.
- Produce a TaskSpec that is usable as a learning plan.

## Should Trigger

- 目标函数先定义
- 最短闭环优先
- 防止锚定第一方案

## Should Not Do

- Do not output a long reading list.
- Do not assume the user wants academic depth.
- Do not recommend all routes at once.

## Pass Criteria

- Has RoutePlan
- Has TaskSpec
- Has First Action
- Has HandoffBrief

## Case 2: Writing Project Structure

## Input

我想写一篇关于 AI Agent 工作流的长文，但观点很多，不知道怎么组织结构，也怕写成空泛鸡汤。

## Expected Behavior

- Turn the idea into route choices: outline first, argument map first, or example-first.
- Compare cost, risk, and benefit.
- Recommend one writing route.
- Include ReviewReport criteria for checking fluff.

## Should Trigger

- 概念不清先定义
- 推荐必须有理由链
- 先验收后扩展

## Should Not Do

- Do not write the whole article immediately.
- Do not output generic advice.
- Do not skip validation criteria.

## Pass Criteria

- Has a concrete article route
- Has anti-fluff checks
- Has next writing action

## Case 3: Career Transition Plan

## Input

我想转到 AI 产品方向，但不知道先学技术、做作品集，还是先找实习机会。

## Expected Behavior

- Ask about time horizon, current skill base, risk tolerance, and target role.
- Compare learning-first, portfolio-first, and opportunity-first routes.
- Recommend one route with clear first action.

## Should Trigger

- 事实和假设分离
- 目标函数先定义
- 高风险先列未知项

## Should Not Do

- Do not promise career outcomes.
- Do not create a huge multi-month plan without first action.
- Do not ignore constraints like time and cost.

## Pass Criteria

- Has assumptions
- Has route comparison
- Has first action
- Has HandoffBrief

## Case 4: Small Team Product Direction

## Input

我们小团队有三个产品想法，但资源只能做一个。我不知道该选用户增长最快的、技术最稳的，还是最容易做 demo 的。

## Expected Behavior

- Define the objective function first.
- Compare 3 product routes.
- Use scoring only as decision support.
- Recommend one direction and one validation step.

## Should Trigger

- 目标函数先定义
- 硬约束不可违反
- 高风险先列未知项

## Should Not Do

- Do not recommend all three.
- Do not rely only on excitement or novelty.
- Do not ignore team capacity.

## Pass Criteria

- Has route scoring
- Has one recommendation
- Has validation criteria

## Case 5: Operations Campaign Planning

## Input

我想做一次线上活动，但预算少、人手少，又想有增长效果。不知道先做内容预热、社群转化，还是合作推广。

## Expected Behavior

- Clarify objective: awareness, conversion, retention, or learning.
- Compare at least 3 campaign routes.
- Recommend the lowest-risk first loop.
- Produce TaskSpec for execution.

## Should Trigger

- 成本受限选低成本路径
- 最短闭环优先
- 可验证优先

## Should Not Do

- Do not produce a huge campaign calendar.
- Do not ignore budget and staffing constraints.
- Do not skip measurement.

## Pass Criteria

- Has low-cost route
- Has measurable validation
- Has next action
