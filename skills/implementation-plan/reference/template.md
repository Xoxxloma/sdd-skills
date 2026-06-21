---
id: PLAN-NNN
source: SYS-NNN
status: draft
services: [<service names>]
estimate: <rough total, e.g. 5d>
---

# PLAN-NNN — Implementation plan for <SYS title>

> Traces to **SYS-NNN** → REQ-NNN. Done = all acceptance scenarios automated & green + non-functional reqs verified.

## Affected services & files
| Service | Files/modules | Change |
|---------|---------------|--------|
| <svc> | <path/to/file> | <what changes> |

## Change sequence
1. <step — e.g. "add nullable column + migration"> — *covers SYS-NNN-F1* — service: <svc>
2. <step — "emit new event field behind flag"> — *covers SYS-NNN-F2*
3. <step — "consumer reads new field"> …
> Cross-service ordering / contract-first notes here.

## Contracts & migrations
- **API/events:** <new/changed shapes; versioning to stay backward-compatible>
- **DB migration:** <forward + rollback; backfill plan>

## Test strategy
| Requirement | Test type | What |
|-------------|-----------|------|
| SYS-NNN-F1 | integration | <automate the Gherkin scenario> |
| SYS-NNN-N1 | perf | <load check vs budget> |

## Rollout & observability
- **Flag/phasing:** <feature flag? % rollout? dark launch?>
- **Observability:** <metrics/logs/traces added to confirm success metrics>
- **Rollback:** <how to revert safely>

## Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| <risk> | low/med/high | <mitigation> |

## Task breakdown (tracker-ready)
| # | Task | Service | Est | Depends on | Covers |
|---|------|---------|-----|-----------|--------|
| 1 | <task> | <svc> | <e.g. 0.5d> | — | SYS-NNN-F1 |
| 2 | <task> | <svc> | <…> | 1 | SYS-NNN-F2 |
