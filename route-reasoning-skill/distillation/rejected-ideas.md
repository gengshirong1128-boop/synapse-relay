# Rejected Ideas

This file records concepts that should not enter the official Skill yet.

Rejection does not mean the idea is bad. It means it is not executable enough for Route Reasoning Skill v0.1.x.

## Too Mathematical Without Route Impact

- Formula-heavy derivations that do not change route selection
- Proof techniques that cannot be turned into trigger conditions
- Optimization models that require unavailable numeric data

Reason: The Skill should stay usable in project conversations.

## Classroom-Only Knowledge

- Concepts useful for learning theory but hard to apply to Agent instructions
- Definitions that do not change RoutePlan, TaskSpec, ReviewReport, or HandoffBrief

Reason: The Skill needs executable checks, not lecture notes.

## Context-Heavy Models

- Models requiring complete project graphs
- Models requiring historical delivery metrics
- Models requiring external market, team, or cost data

Reason: The Skill must work with partial user-provided context.

## High-Risk Automation Ideas

- Rules that imply automatic command execution
- Rules that require reading local secrets or config files
- Rules that push changes without user confirmation

Reason: The Skill does not execute code, read files, or call tools.
