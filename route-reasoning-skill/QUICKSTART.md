# Quickstart

## 1. Start with a messy idea

Example:

> I want to build a project, but I don't know where to start.
> It involves AI agents, planning, review, and task generation.

## 2. Run the Router

Use:

```text
Apply Route Reasoning Skill to the messy input.
First convert it into choice questions.
Do not generate a full plan until key choices are resolved.
```

## 3. Answer the choice questions

Example:

```text
1A, 2B, 3D
```

## 4. Generate the RoutePlan

Use:

```text
Based on the selected choices, generate a RoutePlan.
Separate facts, assumptions, constraints, risks, and next actions.
Recommend exactly one route.
```

## 5. Generate TaskSpec and Instruction

Use:

```text
Convert the RoutePlan into:
1. TaskSpec
2. executable instruction
3. ReviewReport checklist
4. HandoffBrief
```

## 6. Review the result

Use:

```text
Review the output against the TaskSpec.
Check constraints, risks, missing tests, and next actions.
```
