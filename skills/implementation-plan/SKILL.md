---
name: implementation-plan
description: Use to turn system requirements (SYS-NNN) into a concrete implementation plan — affected services/files, change sequence, API/contract changes and migrations, test strategy, rollout/feature-flags/observability, risks & rollback, effort estimate, and a Jira-ready task breakdown. Fifth/final stage of the product-skills pipeline; reads product/system-requirements, writes product/plans/PLAN-NNN.md.
version: 1.0.0
user-invocable: true
argument-hint: "SYS-NNN [workspace-path]"
---

Produces an executable **implementation plan** from system requirements.

## Inputs / outputs
- Input: a `SYS-NNN` id. Reads `product/system-requirements/SYS-NNN.md` + the affected service cards (and, when needed, the real service folders from `manifest.yaml` to name concrete files).
- Output: `product/plans/PLAN-NNN.md` (**same number** as the SYS).
- Template: `reference/template.md` — follow it.

## Procedure
1. **Read** the SYS doc + affected service cards. If the id isn't found, list available SYS ids and stop.
2. **Locate real anchors.** For each affected service, open the actual folder (path from `manifest.yaml`) enough to name the concrete files/modules/endpoints that change. Plans must point at real code, not abstractions. For deeper design, delegate to the **Plan** agent per service and fold its result in.
3. **Sequence the work** so each step is independently safe: contracts/migrations first, then producers, then consumers; flag any cross-service ordering. Map every step back to the SYS requirement(s) it satisfies (`covers SYS-NNN-F2`).
4. **Test strategy** per requirement: unit / integration / e2e, and which acceptance scenarios (Gherkin from SYS) become automated tests.
5. **Rollout**: feature flag? phased? observability to add (metrics/logs/traces to confirm success metrics)? **Rollback** path.
6. **Risks** + mitigations; **effort** estimate (rough, per task).
7. **Task breakdown** — small tasks, each with title, service, est, dependencies, and the SYS id it covers (Jira-ready: these become Stories/Sub-tasks).
8. **Write** `product/plans/PLAN-NNN.md`; update `product/traceability.md` (`SYS-NNN → PLAN-NNN`). **Report** task count + total estimate. End with: "Ready to implement, or export to the tracker."

## Notes
- This is a plan, not the change — do not modify service source here.
- Keep tasks small and verifiable; the acceptance scenarios are the gate.
- Structure the task list so a later `export-jira` step can map it mechanically.
