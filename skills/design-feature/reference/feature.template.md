---
id: F-N
status: backlog            # backlog | promoted   (set to "promoted" once spec-feature moves it into features/F-N/)
track: human              # design-feature always writes track: human
source: design-feature
services: [<service names from system/manifest.yaml>]
size: S | M                # M that is really an epic → note "epic — split before spec" in Scope
risk: low | med
impact: low | med | high
---

# F-N — <short title>

## Context / Problem
<What's the situation today and why it's worth changing. Anchor to something concrete in the system map — a capability, flow, endpoint, UI surface, or risk. 2-4 sentences.>

## Goal
<The desired outcome in one sentence. What "better" means here.>

## Users / Stakeholders
<Who benefits or is affected — end users, operators, developers, support.>

## Scope
**In:**
- <what this change includes>

**Out:**
- <explicitly excluded, to prevent scope creep>

## Success metrics
<Measurable signals that this is done and worked. Each must be checkable.>
- <metric 1 — e.g. "p95 latency of X < N ms", "WCAG AA on screen Y", "error rate of flow Z → 0">

## Constraints
<Tech, compatibility, security/compliance, performance budgets, rollout limits.>

## Assumptions
<What we believe true; if wrong, the requirement may change.>

## Evidence
<Where this comes from in the system map: system/services/<svc>.md (a flow / risk) or system-map.md (a capability / journey gap). One concrete pointer.>

## Open questions
<Unknowns to resolve before/while specifying. Don't guess — list them.>
