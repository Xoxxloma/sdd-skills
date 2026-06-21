---
id: SYS-NNN
source: REQ-NNN
status: draft
services: [<service names>]
---

# SYS-NNN — System requirements for <REQ title>

> Traces to **REQ-NNN**. Definition of done = all acceptance scenarios pass + non-functional requirements met.

## Functional requirements (EARS)
| ID | Requirement | Service |
|----|-------------|---------|
| SYS-NNN-F1 | When <trigger>, the <system> shall <response>. | <svc> |
| SYS-NNN-F2 | The <system> shall <do X>. | <svc> |
| SYS-NNN-F3 | If <condition>, then the <system> shall <handle>. | <svc> |

## Non-functional requirements
| ID | Category | Requirement (measurable) |
|----|----------|--------------------------|
| SYS-NNN-N1 | performance | <e.g. p95 of endpoint X < 300 ms at 50 rps> |
| SYS-NNN-N2 | accessibility | <e.g. screen Y meets WCAG 2.1 AA> |
| SYS-NNN-N3 | observability | <e.g. failures of flow Z emit a structured error with correlation id> |

## Interfaces & contracts
- **API:** <new/changed endpoints — method, path, request, response, error codes>
- **Events:** <new/changed topics/queues + schema; producers/consumers>
- **Backward compatibility:** <breaking? migration/versioning needed?>

## Data
- **Entities/changes:** <new fields, tables, collections>
- **Migration:** <forward/backward, data backfill>
- **Retention/PII:** <if relevant>

## Acceptance criteria (Gherkin)
```
Scenario: <name> (covers SYS-NNN-F1)
  Given <context>
  When <action>
  Then <observable outcome>

Scenario: <name> (covers SYS-NNN-F2)
  Given <context>
  When <action>
  Then <observable outcome>
```

## Dependencies & risks
<Cross-service ordering, external systems, feature flags, rollback considerations.>
