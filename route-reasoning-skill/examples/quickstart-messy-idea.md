# Quickstart Messy Idea Example

## Messy Input

> I want to build an AI collaboration app, but the scope is messy.
> It should support multiple agents, project planning, code review, handoff, local files, and different AI models.
> I don't know what to build first.

## Choice Questions

## 1. Primary Goal

A. Build a usable MVP
B. Design the full architecture
C. Create a product demo
D. Validate the idea first

Recommended: A

## 2. Hard Constraint

A. Limited API budget
B. Limited development time
C. Local-first privacy
D. Cross-platform support

Recommended: B

## 3. First Deliverable

A. UI prototype
B. Backend architecture
C. Agent workflow
D. End-to-end minimal demo

Recommended: D

## RoutePlan

## 1. Situation

The idea is broad and contains too many product directions.

## 2. Goal

Build a minimal AI collaboration workflow before expanding UI and integrations.

## 3. Constraints

- Keep scope small
- Do not redesign the whole app
- Do not expand provider support yet
- Must produce a testable output

## 4. Options

### Option A: UI Prototype First

- Benefit: easy to show
- Cost: medium
- Risk: hides workflow uncertainty
- Best For: visual demo

### Option B: Full Architecture First

- Benefit: long-term clarity
- Cost: high
- Risk: over-planning before validation
- Best For: large team buildout

### Option C: Minimal Workflow First

- Benefit: validates the core idea fastest
- Cost: low to medium
- Risk: UI remains rough
- Best For: first working demo

## 5. Recommended Route

Recommend Option C: Minimal Workflow First.

## 6. First Action

Build one room with initial input, coordinator response, two agent replies, final summary, and HandoffBrief export.

## 7. Validation Criteria

- One complete workflow can be tested manually
- Output includes final summary
- HandoffBrief can be copied into the next round

## 8. Risks

- Scope expansion
- Provider instability
- UI work distracting from workflow validation

## TaskSpec

## Background

The project idea is broad and needs a minimal testable workflow.

## Objective

Build a minimal multi-agent room workflow.

## Scope

- initial input
- coordinator response
- two agent replies
- final summary
- HandoffBrief export

## Non-goals

- No full architecture redesign
- No complex UI redesign
- No broad provider expansion

## Steps

1. Define room workflow state.
2. Add coordinator and two agent response slots.
3. Add final summary.
4. Add HandoffBrief export.

## Acceptance Criteria

- Workflow can be tested manually.
- HandoffBrief is generated.
- Scope remains limited to the room workflow.

## Restrictions

- Do not redesign the whole app.
- Do not add unnecessary integrations.

## Output Required

- Modified areas
- Assumptions
- Manual test steps
- HandoffBrief

## Agent Instruction

Implement the minimal multi-agent workflow described in the TaskSpec. Do not redesign the entire app. Focus only on the room workflow, message state, role assignment, final summary, and HandoffBrief export. Return modified files or areas, assumptions, and test steps.

## ReviewReport

Check:

- Does the implementation match the TaskSpec?
- Are hard constraints respected?
- Are assumptions listed?
- Can the workflow be tested manually?
- Is unnecessary complexity avoided?

## HandoffBrief

Current state: the MVP workflow has been defined and partially implemented.

Next step: test one complete user → coordinator → agents → summary → HandoffBrief cycle.

Risks:

- Scope expansion
- Provider instability
- UI changes distracting from workflow validation
