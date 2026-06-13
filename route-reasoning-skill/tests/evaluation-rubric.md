# Evaluation Rubric

Use this rubric to manually evaluate Route Reasoning Skill outputs.

Score each item as:

- pass
- partial
- fail

## Core Criteria

## 1. Asks Choice Questions When Needed

- pass: vague input is routed to Choice Questions first
- partial: asks questions but too many or unclear
- fail: jumps directly to a final answer

## 2. Outputs 3 Routes

- pass: RoutePlan contains at least 3 comparable routes
- partial: routes exist but are not comparable
- fail: only one route appears

## 3. Recommends Exactly 1 Route

- pass: one final route is recommended
- partial: one route is preferred but alternatives remain ambiguous
- fail: recommends multiple routes as final answer

## 4. Lists Cost, Risk, and Benefit

- pass: every route includes cost, risk, benefit, and best-fit scenario
- partial: some routes are missing one field
- fail: route comparison is generic

## 5. Generates Executable TaskSpec

- pass: TaskSpec has objective, scope, steps, restrictions, acceptance criteria
- partial: TaskSpec exists but lacks constraints or output requirements
- fail: no executable TaskSpec

## 6. Avoids Fluff

- pass: output has concrete next action and validation criteria
- partial: useful but still too abstract
- fail: only principles or motivational language

## 7. Avoids Theory Dumping

- pass: theory is converted into simple decision rules
- partial: some theory terms appear but are still usable
- fail: output reads like an essay or lecture

## 8. Keeps HandoffBrief

- pass: output preserves next-round HandoffBrief
- partial: handoff exists but lacks decisions or constraints
- fail: no HandoffBrief

## 9. Uses Distilled Rules Correctly

- pass: logic/game theory/operations research ideas appear as executable cards, constraints, scores, or review checks
- partial: domain labels are present but only weakly affect the route
- fail: output is theory branding without operational impact

## 10. Matches Agent to Task

- pass: selected executor fits task risk, context needs, cost, permissions, and acceptance criteria
- partial: executor is plausible but missing boundaries or report-back requirements
- fail: defaults to a famous/powerful/cheap tool without fit analysis

## 11. Preserves Dissent

- pass: records the strongest dissent with evidence and explains why it was overruled
- partial: mentions disagreement but lacks evidence or disposition
- fail: presents consensus without preserving minority objections

## 12. Uses Veto Correctly

- pass: veto is limited to hard constraints, safety boundaries, or unacceptable irreversible risk and includes an unblock condition
- partial: veto basis is plausible but incomplete
- fail: veto is arbitrary, missing, or treated as an ordinary vote

## 13. Defines Flip Conditions

- pass: includes observable signals, thresholds, and trigger actions
- partial: flip condition exists but cannot be tested
- fail: no condition for revisiting the decision

## 14. Reviews Outcomes Without Outcome Bias

- pass: separates decision quality from execution quality and calibrates rules
- partial: reviews the result but weakly separates causes
- fail: treats a good outcome as proof or a bad outcome as disproof

## Result

- Ready: all pass or at most 2 partial
- Needs fix: any fail in criteria 1, 3, 5, 6, 9, 10, 11, 12, or 13
- Reject: more than 3 fail
