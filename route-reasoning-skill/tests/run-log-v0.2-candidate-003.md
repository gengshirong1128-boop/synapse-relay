# Run Log v0.2 Candidate 003

## Date

2026-06-10

## Model Used

Manual evaluation with Route Reasoning Skill v0.1.0.

## Test Case

`tests/test-cases.md` Case 3: Operations Research Candidate Rules for v0.2

## Input

我想把运筹学里的一些思想加入 Skill，比如目标函数、硬约束、瓶颈、最短路径。但我怕变成理论堆砌，不知道哪些该进正式 cards。

## Baseline Setup

Use only official v0.1.0 files:

- `SKILL.md`
- official `cards/`
- official `prompts/`
- official `templates/`

Do not use `distillation/candidate-cards.md`.

## Baseline Output Summary

Expected baseline behavior:

- It should warn against adding too many cards.
- It should keep formal cards stable.
- It should recommend testing before promotion.

Likely weakness:

- It may still list many theory terms as if they are equally useful.
- It may not clearly reject formulas or concepts that do not change RoutePlan.
- It may not define a hard promotion gate.

## Candidate Setup

Use official v0.1.0 files plus:

- `distillation/candidate-cards.md`
- `distillation/v0.2-plan.md`
- `cards/scoring-rules.md`

Focus candidate rules:

- 目标函数先定义
- 硬约束不可违反
- 阻塞任务优先
- 最短闭环优先

## Candidate Output Summary

Candidate-improved behavior:

## 1. Choice Questions

The output should ask:

- Is the goal to improve route choice, Agent assignment, or review quality?
- Which candidate changes the output in real test cases?
- Is the concept executable as a trigger condition and decision rule?

## 2. RoutePlan Difference

### Route A: Promote All Operations Research Ideas

- Benefit: fast expansion
- Cost: high complexity
- Risk: theory dumping and duplicate cards
- Best For: research notes, not official Skill
- Not For: v0.2 release

### Route B: Keep All Ideas in Distillation Only

- Benefit: preserves v0.1.0 simplicity
- Cost: no official improvement yet
- Risk: useful rules remain unused
- Best For: early collection
- Not For: when test evidence is already available

### Route C: Promote Only Tested Candidate Rules

- Benefit: adds only rules that improve outputs
- Cost: requires manual run logs
- Risk: slower card growth
- Best For: v0.2 release quality
- Not For: fast brainstorming mode

## 3. Recommended Route

Recommended route: Promote only tested candidate rules.

Reason chain:

1. The objective is not to show theory depth; it is to improve route decisions.
2. Hard constraints and promotion criteria already forbid theory-only cards.
3. A candidate should enter official cards only after improving at least 2 test cases.
4. This keeps v0.2 small and prevents the Skill from becoming a knowledge warehouse.

## TaskSpec

## Background

- User wants to distill operations research ideas into Skill rules.
- User is worried about theory dumping.

## Objective

- Select a small number of candidate rules for v0.2 based on test evidence.

## Scope

- Candidate cards
- v0.2 promotion criteria
- run logs
- official cards only after validation

## Non-goals

- Do not add all theory terms.
- Do not copy book content.
- Do not edit official cards yet.

## Files / Areas

- `distillation/candidate-cards.md`
- `distillation/v0.2-plan.md`
- `tests/run-log-v0.2-candidate-*.md`

## Steps

1. Run at least 5 test cases.
2. Mark which candidate cards improve outputs.
3. Reject cards that do not change RoutePlan, TaskSpec, or ReviewReport.
4. Promote no more than 7 cards in v0.2.

## Acceptance Criteria

- Each promoted card improves at least 2 test cases.
- Each promoted card has trigger condition, judgment question, and output impact.
- No theory-only card enters official cards.

## Restrictions

- Do not modify official cards during this test phase.
- Do not expand SKILL.md into theory.
- Do not copy source text.

## Output Required

- Candidate ranking
- Promotion decision
- Rejected ideas
- HandoffBrief

## Pass / Fail

pass

## Rubric Result

- Asks Choice Questions When Needed: pass
- Outputs 3 Routes: pass
- Recommends Exactly 1 Route: pass
- Lists Cost, Risk, and Benefit: pass
- Generates Executable TaskSpec: pass
- Avoids Fluff: pass
- Avoids Theory Dumping: pass
- Keeps HandoffBrief: partial

## Problems Found

- HandoffBrief is again only requested, not fully written.
- Candidate rules need a small table that counts which tests they improved.

## Candidate Fix

Add a promotion evidence table in future run logs:

| Candidate Card | Improved Cases | Changed Output | Promote? |
| --- | --- | --- | --- |

## Should Update Skill?

No.

## Should Promote Candidate Cards?

No.

Reason: Do not promote during testing. Need the full 5-case run and an evidence table first.

## Candidate Signal

Strong:

- 目标函数先定义
- 硬约束不可违反

Useful but needs more task evidence:

- 阻塞任务优先
- 最短闭环优先

## Notes

This run confirms that the distillation workspace is doing its job: theory stays in candidates until it proves route impact.
