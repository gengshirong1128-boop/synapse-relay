# Changelog

## v0.2.0

Release candidate for a GitHub-ready Route Reasoning Skill.

Added:

- Standard skill frontmatter and `agents/openai.yaml` metadata
- Distilled decision framing from logic, game theory, and operations research
- 30 official Decision Cards, including objective functions, hard constraints, reason chains, agent fit, incentive alignment, minimum regret, and bottlenecks
- Expanded Risk Cards for theory dumping, agent mismatch, and strategic reaction risk
- Updated route scoring with Constraint Fit and Incentive Fit
- Output evaluator for RoutePlan / TaskSpec / HandoffBrief quality gates
- Passing and failing fixtures to prove the evaluator has useful signal
- GitHub Actions workflow for package validation and fixture evaluation

Changed:

- README now uses GitHub release-style positioning, quickstart, output contract, validation commands, and MIT license callout
- Route planner, task package, and reviewer prompts now require distilled rules, reason chains, and agent fit checks
- Evaluation rubric now checks distilled rule quality and task-agent fit

## v0.1.0

Initial release clean for Route Reasoning Skill.

Core capabilities:

- Demo-first README
- Quickstart guide
- Router entry rules for choosing the right workflow
- Choice Question Router for vague project ideas
- RoutePlan generation with at least 3 comparable routes
- TaskSpec generation from the recommended route
- Executor instruction templates, including Generic Agent / Human and Codex / Claude Code / DeepSeek for code scenarios
- ReviewReport flow for checking Agent output
- HandoffBrief flow for next-round context
- Decision Cards, Risk Cards, Priority Cards, and Route Scoring Rules
- Examples for quickstart, bugfix, UI cleanup, refactor, release, research, and vague ideas

Safety boundaries:

- Does not execute code
- Does not read local files
- Does not call tools
- Does not include API keys or private local paths
