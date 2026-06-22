---
name: propose-improvements
description: Use after a system map exists to audit a large application and generate a prioritized backlog of business requirements — across three tracks: a technical/code-quality audit (reliability, performance, observability, DX, security, cross-service consistency), a UX audit via impeccable on the frontends, and a new-features track that finds high-value capabilities the system lacks (grounded in the map, optionally informed by VISION.md/COMPETITORS.md and web research). Each finding is written as one business-requirement file in the backlog. Second stage of the bundle; reads system/, writes backlog/F-N.feature.md.
version: 2.0.0
user-invocable: true
argument-hint: "[--track tech|ux|features] [--service <name>] [--no-web]"
---

Audits the mapped system and turns it into a **backlog of business requirements (БТ)** — one file per improvement. Bias toward changes that are clearly valuable and shippable on their own. This is the audit-driven path into the backlog; `design-feature` is its human-driven sibling (same output format).

## Inputs / outputs
- Reads (preferred, not required): `system/system-map.md` + `system/services/*.md` + `system/manifest.yaml`. The map makes the audit far better, but **`system/` is NOT mandatory** — if it's absent, **don't stop**: degrade to auditing the code you can read directly (path from the argument, or ask the user). Note in the output "audited without a system map — coverage may be partial" and suggest running `/system-map <path>` later for a fuller pass. Still anchor every finding to something concrete you actually observed (a flow/screen/file), never invented.
- Reads (optional): `VISION.md` / `COMPETITORS.md` in the workspace root — used by the new-features track.
- Writes: one `backlog/F-N.feature.md` per improvement (БТ format, template `reference/feature.template.md`), plus an optional `backlog/index.md` priority table.
- `--track` limits to one of `tech` | `ux` | `features`; `--service` limits to one service; `--no-web` disables web research in the features track. Default = all three tracks, all services, web allowed.

## Numbering
Single `F-N` namespace shared with `design-feature` and `features/`. Allocate the next id by **scanning both** `backlog/*.feature.md` and `features/F-*/` and taking `max(N)+1`. Allocate the whole block for this run contiguously **before** writing. Never renumber existing items. Run **sequentially** with `design-feature`, never in parallel (parallel allocation collides).

## Tracks

### 1. Load the map (if present)
If `system/` exists, read the system map and the relevant service cards. **If it doesn't, skip this step** and work from the code you can read (path from the argument / ask the user) — the tracks below then scan that code directly instead of service cards. Either way, anchor every finding to something concrete you actually observed (a capability, flow, endpoint, UI surface, file, or risk) — record that pointer in the item's **Evidence** field.

### Track A — technical / code-quality audit
Scan the service cards' **Risks/smells**, **Key flows**, and **Cross-cutting observations** for concrete, small, high-leverage changes across: reliability (error handling, retries/timeouts, idempotency, graceful degradation), performance (obvious latency/throughput wins, N+1, payload size, caching), observability (logging/metrics/traces gaps, actionable errors), DX (build/test friction, missing tests, config clarity), security (input validation, secrets, authz gaps — factual, no scare), and consistency (duplicated logic, divergent patterns across services). Prefer specific over generic ("add timeout+retry to orders→payment call" not "improve reliability"). For broad coverage you may fan out one subagent per area; keep ideas grounded in the map.

### Track B — UX audit (impeccable)
For each service with `UI surfaces` (type `frontend`/`fullstack` in `system/manifest.yaml`; **without a manifest** — each frontend path you were given or could identify): invoke the **impeccable** skill in audit mode on that frontend (`impeccable audit <path>`) and convert its findings into improvement items. Reuse impeccable's output — don't hand-roll a UI critique. If impeccable's CLI detector is unavailable (closed network), use its `reference/audit.md` flow on the code you can read.

> **GigaCode note.** impeccable's reference files were written for another harness and say "call the AskUserQuestion tool". In GigaCode the same tool exists as **`ask_user_question`** — so call it, but its `header` field is **capped at 12 chars** (impeccable's files don't mention this cap, which is what makes the call fail). Per **`GIGACODE.md`/`GIGACODE_BASE.md` → B2**: use `ask_user_question` with short `header`s (≤ 12) and `options` that each have `label`+`description`; ask before writing any backlog item.

### Track C — new features
Find capabilities the system lacks that would advance it. Think in **outcomes**, not tools — a feature is worth proposing only if it serves a real user/business outcome the map shows is unmet.
- Derive candidate gaps from the capability catalog + end-to-end journeys (missing steps, dead ends, manual workarounds).
- If `VISION.md` is present, frame opportunities against its goal and **filter them through its principles** (in priority order); cite `Scope — Out` to drop anything deliberately excluded. If absent, proceed from the map and note "without authored vision".
- If `COMPETITORS.md` is present, use it for differentiation (what rivals close, where we can do better/differently).
- Unless `--no-web`, you may `WebSearch` for current best practices / patterns for the outcome; on rate-limit/error, degrade gracefully and note "without fresh research".
- Drop opportunities that fail the principle filter (don't write them as items); keep what survives.

### 4. Score & write the backlog
For each surviving finding from any track, write one `backlog/F-N.feature.md` using `reference/feature.template.md`:
- **Business language only — WHAT the user/business gets and WHY, never HOW it's built.** Even the tech track describes the *outcome* (e.g. "checkout no longer times out under load"), not the implementation. **Do NOT name** components/classes/functions/variables/stores/hooks, file or directory paths, API signatures/endpoints, or state fields — those belong to `spec-feature`. **Fill exactly the template's sections; do not add your own** ("How it works", "before/after", "Affected files", "API", "Scope of work"). Anchor to a capability/flow/screen, not to a file.
- Keep items **small**: if something is a big feature, split it or set `size: M` and note "epic — split before spec" in Scope.
- Fill Context/Goal/Scope/Success metrics from the map; put the concrete pointer in **Evidence**; list unknowns in **Open questions** instead of guessing.
- Maintain `backlog/index.md`: a **priority table** (ID · title · track · impact · size · risk), sorted impact↓ then size↑ (small wins first), covering all items in `backlog/`.

### 5. Report
Print the count by track and the top 5 by priority. End with: **Next:** pick an item and run `/spec-feature F-N`.

## Notes
- This stage proposes; a human chooses what to pursue. Don't auto-advance to spec/implementation.
- **БТ are business documents.** No code identifiers, file paths, API contracts, or implementation sections — that detail is produced later by `spec-feature`. A reviewer with no code access must understand each item.
- Don't invent capabilities the system doesn't have — every item traces to the map (Evidence).
- Read-only on the analyzed system. Writes only into the workspace (CWD).
