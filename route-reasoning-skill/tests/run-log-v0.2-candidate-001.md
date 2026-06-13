# Run Log v0.2 Candidate 001

## Date

2026-06-10

## Model Used

Manual evaluation with Route Reasoning Skill v0.1.0.

## Test Case

`tests/test-cases.md` Case 1: Continue Neige Lite or Extract Skill First

## Input

我现在有一个本地 AI 指挥台原型，功能越做越多。继续做软件会越来越重，但我也看到里面的路线规划和任务包能力可以单独抽成 Skill。我不知道该继续开发软件，还是先抽 Skill。

## Baseline Setup

Use only official v0.1.0 files:

- `SKILL.md`
- official `cards/`
- official `prompts/`
- official `templates/`

Do not use `distillation/candidate-cards.md`.

## Baseline Output Summary

Expected baseline behavior:

- It should detect planning uncertainty.
- It should compare at least 3 routes.
- It should recommend one route.

Likely weakness:

- It may compare routes without first naming the main objective.
- It may mix confirmed facts with assumptions.
- It may recommend “extract Skill first” without a clear reason chain.

## Candidate Setup

Use official v0.1.0 files plus these candidate rules:

- 目标函数先定义
- 事实和假设分离
- 推荐必须有理由链

## Candidate Output Summary

Candidate-improved behavior:

## 1. Choice Questions

The output should first ask or infer:

- Is the main objective speed, stability, learning, open-source release, or long-term leverage?
- Is the software prototype still the product, or is the Skill the reusable core?
- Does the next action need code changes, documentation, or route validation?

## 2. RoutePlan Difference

The candidate rules should force a clearer comparison:

### Route A: Continue Neige Lite Software

- Benefit: keeps product momentum
- Cost: higher complexity and maintenance
- Risk: feature creep
- Best For: when software delivery is the main objective

### Route B: Extract Route Reasoning Skill First

- Benefit: isolates the reusable decision workflow
- Cost: delays software features
- Risk: Skill may remain too abstract without tests
- Best For: when leverage and clarity are the main objective

### Route C: Release Clean First, Then Decide

- Benefit: stabilizes current work before branching
- Cost: slower exploration
- Risk: may postpone core decision
- Best For: when release readiness is urgent

## 3. Recommended Route

Recommended route: Extract Route Reasoning Skill first.

Reason chain:

1. Goal function appears to be long-term leverage and clarity, not immediate software growth.
2. Continuing software development increases scope and maintenance risk.
3. The reusable value is already visible in route planning, TaskSpec, and review workflow.
4. Extracting the Skill creates a smaller testable unit.
5. The choice remains reversible: the Skill can later feed the software again.

## Pass / Fail

pass

## Rubric Result

- Asks Choice Questions When Needed: pass
- Outputs 3 Routes: pass
- Recommends Exactly 1 Route: pass
- Lists Cost, Risk, and Benefit: pass
- Generates Executable TaskSpec: partial
- Avoids Fluff: pass
- Avoids Theory Dumping: pass
- Keeps HandoffBrief: partial

## Problems Found

- Candidate comparison improves route reasoning, but this run still needs a concrete TaskSpec after the recommended route.
- HandoffBrief is implied but should be written explicitly.
- Only one test case has been run, so no card should be promoted yet.

## Candidate Fix

For the next run, require candidate-enhanced output to include:

- `# TaskSpec`
- `# HandoffBrief`
- explicit `Objective`
- explicit `First Action`
- explicit `Restrictions`

## Should Update Skill?

No.

## Should Promote Candidate Cards?

No.

Reason: v0.2 promotion requires improvement in at least 2 test cases. This is only Case 1.

## Candidate Signal

Strong candidates to test again:

- 目标函数先定义
- 事实和假设分离
- 推荐必须有理由链

## Notes

This run suggests the three candidate rules are useful, but they must be tested against at least one more case before promotion.
