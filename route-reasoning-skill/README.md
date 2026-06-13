# Route Reasoning Skill

**English** | [简体中文](./README.zh-CN.md)

[![Validate Decision Cabinet](https://github.com/gengshirong1128-boop/route-reasoning-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/gengshirong1128-boop/route-reasoning-skill/actions/workflows/validate.yml)

Turn messy ideas into executable decisions.

Route Reasoning Skill is an auditable AI decision-cabinet workflow that converts vague intent into choice questions, comparable routes, DecisionReceipts, executable TaskSpecs, review reports, outcome reviews, and handoff briefs. It distills practical rules from logic, game theory, and operations research into cards, scoring rules, veto gates, flip conditions, and validation scripts.

```text
Messy input -> Choice Questions -> RoutePlan -> Decision Cabinet -> DecisionReceipt -> TaskSpec -> ReviewReport -> OutcomeReview -> HandoffBrief
```

## Why It Exists

Most prompts answer too early. This skill slows the first step down just enough to avoid vague plans, tool hype, and untestable recommendations.

It is built for:

- software planning and agent handoff
- Codex / Claude Code / DeepSeek task routing
- product direction and release decisions
- research, writing, learning, and operations plans
- reviewing whether an agent output actually met the goal

## Distilled Decision Engine

The "distillation" is not copied book content. It is a compact rule system:

- Logic: separate facts from assumptions, define vague concepts, require reason chains, check counterexamples.
- Game theory: match agents to incentives, avoid tool halo, anticipate stakeholder reactions, choose minimum-regret first moves.
- Operations research: define objective functions, enforce hard constraints, prioritize bottlenecks, score routes by verifiability and cost.

These rules live in:

- [`cards/decision-cards.md`](./cards/decision-cards.md)
- [`cards/risk-cards.md`](./cards/risk-cards.md)
- [`cards/scoring-rules.md`](./cards/scoring-rules.md)
- [`distillation/source-map.md`](./distillation/source-map.md)

## Decision Cabinet

For high-value, disputed, or irreversible decisions, the skill:

- separates facts, assumptions, and unknowns
- requires members to state positions independently before cross-reading
- assigns a Devil's Advocate to attack the leading route
- allows a Risk Minister to veto only on hard constraints, safety boundaries, or unacceptable irreversible risk
- requires every veto to include an unblock condition
- records the strongest dissent
- defines observable flip conditions before issuing a final decision
- separates decision quality from execution quality during outcome review

## Quick Start

Install for Claude Code:

```bash
git clone https://github.com/gengshirong1128-boop/route-reasoning-skill.git ~/.claude/skills/route-reasoning-skill
```

Install for Codex:

```bash
git clone https://github.com/gengshirong1128-boop/route-reasoning-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/route-reasoning-skill"
```

Use this prompt:

```text
Use Route Reasoning Skill on this messy input.
First generate choice questions.
Do not generate a final plan until the key choices are resolved.
```

Then answer with compact choices, for example:

```text
1A 2B 3D 4D 5A
```

Ask the skill to continue:

```text
Generate a RoutePlan, TaskSpec, agent instruction, ReviewReport checklist, and HandoffBrief.
Recommend exactly one route.
```

## Output Contract

A complete output should include:

- `# RoutePlan` with at least 3 options
- exactly 1 recommended route
- cost, risk, benefit, best-fit, not-fit, scores, and reason chain
- `# TaskSpec` with scope, restrictions, steps, acceptance criteria, and required output
- agent fit explanation for Human / Generic Agent / Reviewer / Codex / Claude Code / DeepSeek
- `# ReviewReport` or review checklist
- `# HandoffBrief` for the next round
- `# DecisionReceipt` for high-value decisions, including Strongest Dissent, Veto Record, and Flip Conditions
- `# OutcomeReview` after execution, separating Decision Quality from Execution Quality

## Validation

Current reproducible package metrics:

- **37** decision cards validated
- **13** scenario test cases validated
- passing fixtures accepted and intentionally weak fixtures rejected
- DecisionReceipt and OutcomeReview structure checked by deterministic scripts

Run the skill package validator:

```bash
python scripts/validate_skill.py
```

Evaluate a generated output:

```bash
python scripts/evaluate_output.py tests/fixtures/passing-route-output.md
```

Validate an auditable decision:

```bash
python scripts/validate_decision_receipt.py tests/fixtures/passing-decision-receipt.md
```

Validate an outcome review:

```bash
python scripts/validate_outcome_review.py tests/fixtures/passing-outcome-review.md
```

The evaluator rejects fluffy outputs that lack three routes, a reason chain, TaskSpec, HandoffBrief, or distilled decision rules:

```bash
python scripts/evaluate_output.py tests/fixtures/failing-fluffy-output.md
```

## Suggested GitHub Topics

```text
ai-agents, codex, decision-making, prompt-engineering, skills, task-planning, route-planning, operations-research, game-theory, logic
```

## Examples

- [`examples/quickstart-messy-idea.md`](./examples/quickstart-messy-idea.md)
- [`examples/bugfix-example.md`](./examples/bugfix-example.md)
- [`examples/refactor-example.md`](./examples/refactor-example.md)
- [`examples/release-example.md`](./examples/release-example.md)
- [`examples/research-plan-example.md`](./examples/research-plan-example.md)

## What This Is Not

- not a code execution tool
- not a file reader
- not an automation agent
- not a collection of copied book passages
- not a theory essay generator

## Repository Structure

```text
route-reasoning-skill/
  .github/workflows/validate.yml
  SKILL.md
  README.md
  README.zh-CN.md
  QUICKSTART.md
  LICENSE
  agents/
  cards/
  prompts/
  templates/
  scripts/
  tests/
  distillation/
```

## License

MIT. See [`LICENSE`](./LICENSE).
