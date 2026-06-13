# Run Log v0.2 Candidate 002

## Date

2026-06-10

## Model Used

Manual evaluation with Route Reasoning Skill v0.1.0.

## Test Case

`tests/test-cases.md` Case 2: Codex Broke UI/API Input

## Input

Codex 改完以后，页面 UI 乱了，API 输入框也不好用了。我不确定是先修 UI，还是先修接口输入逻辑。不要新增依赖，不要大改。

## Baseline Setup

Use only official v0.1.0 files:

- `SKILL.md`
- official `cards/`
- official `prompts/`
- official `templates/`

Do not use `distillation/candidate-cards.md`.

## Baseline Output Summary

Expected baseline behavior:

- It should identify this as bugfix with UI risk.
- It should preserve constraints: no dependency, no big rewrite.
- It should recommend Codex or Reviewer.

Likely weakness:

- It may recommend fixing both UI and API input at the same time.
- It may not treat “不要新增依赖，不要大改” as hard gates.
- It may not separate confirmed facts from assumptions about what Codex changed.

## Candidate Setup

Use official v0.1.0 files plus these candidate rules:

- 硬约束不可违反
- 最短闭环优先
- 事实和假设分离
- 推荐必须有理由链

## Candidate Output Summary

Candidate-improved behavior:

## 1. Choice Questions

The output should first confirm:

- Is the API input failure blocking usage?
- Is the UI issue visual-only or function-breaking?
- Should the first action be review-only or direct fix?

## 2. RoutePlan Difference

### Route A: Fix API Input First

- Benefit: restores core function first
- Cost: low to medium
- Risk: may leave visual disorder temporarily
- Best For: API input is blocking usage
- Not For: UI damage prevents using the page at all

### Route B: Restore UI First

- Benefit: makes the page usable and visible again
- Cost: medium
- Risk: may ignore the deeper input logic bug
- Best For: UI damage blocks testing
- Not For: UI is only cosmetic

### Route C: Reviewer First, Then Codex Fix

- Benefit: identifies whether UI and API problems share one cause
- Cost: medium
- Risk: slower first result
- Best For: unclear change scope after Codex edits
- Not For: urgent production bug with obvious root cause

## 3. Recommended Route

Recommended route: Reviewer first, then Codex fix.

Reason chain:

1. The user says Codex already changed something and two areas are now broken.
2. The confirmed facts are UI disorder and API input failure; root cause is still unknown.
3. The hard constraints are no dependency and no big rewrite.
4. A review-first step is the shortest safe loop because it prevents fixing the wrong layer.
5. After review, generate a small Codex task for either API input or UI restoration.

## TaskSpec

## Background

- Codex output appears to have affected both UI and API input behavior.
- Root cause is not confirmed.

## Objective

- Identify the smallest safe repair route, then generate a focused Codex fix.

## Scope

- UI disorder caused by recent changes
- API input failure
- Recent Agent output or changed areas described by the user

## Non-goals

- No redesign
- No dependency changes
- No large rewrite

## Files / Areas

- Settings or API configuration page
- API input component
- Related validation or request logic

## Steps

1. Review whether UI and API input issues share one cause.
2. Decide whether API input or UI restoration is the P0 fix.
3. Generate a small Codex instruction for the selected repair.

## Acceptance Criteria

- API input works again or the P0 failure is isolated.
- UI is not further changed outside the broken area.
- No dependencies are added.
- The next Codex task has explicit forbidden changes.

## Restrictions

- Do not redesign the page.
- Do not rewrite the component.
- Do not add dependencies.

## Output Required

- ReviewReport
- Focused Codex instruction
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

- HandoffBrief is still not fully written in the output example.
- The candidate route is strong, but “Reviewer first” may be too cautious if the API input root cause is obvious.

## Candidate Fix

Add a check before recommending Reviewer first:

- If root cause is unknown and multiple areas broke, review first.
- If API input root cause is known, send focused Codex fix directly.

## Should Update Skill?

No.

## Should Promote Candidate Cards?

No.

Reason: This is only the second run. Signals are stronger, but promotion should wait until the same rule improves at least 2 cases and does not duplicate official cards.

## Candidate Signal

Strong candidates:

- 硬约束不可违反
- 事实和假设分离
- 推荐必须有理由链

Needs more testing:

- 最短闭环优先

## Notes

This run shows that hard constraints and fact/assumption separation reduce the chance of a bad “fix everything” instruction.
