---
name: propose-improvements
description: Use after a system map exists to generate a prioritized backlog of small, high-leverage improvements to an existing application — UI/UX polish (via an impeccable audit), reliability, performance, observability, developer experience, security, and cross-service consistency. Each item is scoped small and written so it can be turned into a requirement. Second stage of the product-skills pipeline; reads product/system, writes product/backlog/improvements.md.
version: 1.0.0
user-invocable: true
argument-hint: "[workspace-path] [--lens ui|reliability|perf|observability|dx|security|consistency] [--service <name>]"
---

Turns the system map into a **backlog of small, high-leverage improvements**. Bias toward changes that are low-risk, clearly valuable, and shippable on their own.

## Inputs / outputs
- Reads: `product/system/system-map.md` + `product/system/services/*.md` (run `/system-map` first; if missing, say so and stop).
- Writes: `product/backlog/improvements.md`.
- Optional `--lens` limits to one category; `--service` limits to one service. Default = all lenses, all services.

## Lenses (idea categories)
- **ui** — UX/visual quality, hierarchy, accessibility, consistency, anti-patterns.
- **reliability** — error handling, retries/timeouts, idempotency, graceful degradation.
- **perf** — obvious latency/throughput wins, N+1, payload/size, caching.
- **observability** — logging/metrics/traces gaps, actionable errors.
- **dx** — build/test friction, missing tests, config clarity.
- **security** — input validation, secrets handling, authz gaps (factual, no scare).
- **consistency** — duplicated logic, divergent patterns/UX across services.
- **strategy** — стратегические разрывы из vision-audit (заносятся скиллом `vision-to-backlog`, не генерируются здесь).

## Procedure

### 1. Load the map
Read the system map and the relevant service cards. Anchor every idea to something concrete in them (a capability, flow, endpoint, UI surface, or risk).

### 2. UI lens → use **impeccable**
For each service with `UI surfaces` (type `frontend`/`fullstack`): invoke the **impeccable** skill in audit mode on that frontend (`impeccable audit <path>`) and convert its findings into improvement items. Reuse impeccable's output — don't hand-roll a UI critique. If impeccable's CLI detector is unavailable (closed network), use its `reference/audit.md` flow on the code you can read.

### 3. Other lenses → derive from the map
For each remaining lens, scan the cards' **Risks/smells**, **Key flows**, and **Cross-cutting observations** and propose concrete small changes. Prefer specific over generic ("add timeout+retry to orders→payment call" not "improve reliability"). For broad coverage you may fan out one subagent per lens; keep ideas grounded in the map (don't invent features the system doesn't have).

### 4. Score & write the backlog
Each item:
```
### IMP-NNN — <short title>
- **Lens:** ui | reliability | …
- **Service(s):** <names>
- **What:** 1-2 sentences — the concrete change.
- **Why:** the value / what it improves (user, ops, or dev).
- **Evidence:** where in the map/code this comes from (file/flow/impeccable finding).
- **Size:** S | M    **Risk:** low | med    **Impact:** low | med | high
```
- Number items `IMP-001`, `IMP-002`, … (continue from existing max if the file already exists — never renumber).
- Top of the file: a **priority table** (ID · title · lens · impact · size · risk), sorted impact↓ then size↑ (small wins first).
- Keep items **small**: if something is a big feature, split it or note "epic — split before requirement".

### 5. Report
Print the count by lens and the top 5 by priority. End with: **Next:** pick an item and run `/draft-requirement IMP-NNN`.

## Notes
- This stage proposes; a human chooses what to pursue. Don't auto-advance to requirements.
- Don't modify service source. Writes only into the workspace.
