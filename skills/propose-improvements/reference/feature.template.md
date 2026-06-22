---
id: F-N
status: backlog            # backlog | promoted   (set to "promoted" once spec-feature moves it into features/F-N/)
track: tech | ux | features | human   # origin: which propose-improvements track, or design-feature (human)
source: <propose-improvements:tech | propose-improvements:ux | propose-improvements:features | design-feature | impeccable:<finding>>
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
<Where this comes from: system/services/<svc>.md (Risks/smells / Key flow), system-map.md cross-cutting observation, an impeccable finding, or a competitor/vision gap. One concrete pointer.>

## Open questions
<Unknowns to resolve before/while specifying. Don't guess — list them.>
