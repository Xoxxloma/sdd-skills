---
name: system-map
description: Use when you need to understand the full functionality of a large or multi-service codebase before changing it — build a "system map": a per-service capability card, a cross-service dependency graph, end-to-end user journeys, and a catalog of everything the system does. Takes the path to the system folder as its first argument and writes a cached knowledge base (incl. manifest.yaml) into the current product workspace. Use for onboarding onto an unfamiliar app, auditing a microservice landscape (e.g. 10-20 services across separate repos/folders), or refreshing an existing map after changes. First stage of the bundle; its output is the shared foundation every later skill reads.
version: 2.0.0
user-invocable: true
argument-hint: "<target-path> [--refresh] [--service <name>]"
---

Builds and maintains a **system map** of a large application from its source. The system to analyze is passed as a **path** (its first argument); it may be a single app or a parent folder holding many services. Output is a cached knowledge base — the shared foundation every later skill (`propose-improvements`, `design-feature`, `spec-feature`, `implement-feature`) reads.

## Workspace contract

The skills run inside a dedicated **product workspace** (the current directory). All artifacts are written here; the analyzed system is **read-only** and lives elsewhere (referenced by absolute path). You produce:

```
system/system-map.md          # synthesis (capability catalog + journeys)
system/services/<name>.md      # one card per service / area
system/dependency-graph.mmd    # mermaid graph
system/manifest.yaml           # OUTPUT: targetRoot + services[] — where the real code lives
.cache/map-state.json          # { "<name>": { "fingerprint": "...", "mappedAt": "..." } }
```

`system/manifest.yaml` is **produced** by this skill (not an input). It is the load-bearing contract every downstream skill uses to find the real code:
```yaml
targetRoot: D:/work/shop            # absolute path passed as the first arg
services:
  - name: orders
    path: D:/work/shop/orders       # absolute folder of this service
    type: backend                   # backend | frontend | fullstack | lib
    repo: git@…                     # optional
```
For a single app, emit one service whose `path` equals `targetRoot`.

## Procedure

### 0. Resolve the target path
- The **first argument is the path to the system** to analyze. If it's missing, ask for it (do not guess).
- Decide the shape: if the path has service-like subdirs (each with `package.json` / `pom.xml` / `go.mod` / `*.csproj` / `Dockerfile`), enumerate them as services. Otherwise treat the path as a **single app** (one service). If the layout is ambiguous (mixed monorepo), propose the service list for confirmation — don't guess silently.
- The workspace is the **current directory**; create `system/` and `.cache/` here.

### 1. Decide what to (re)map (incremental)
- Read `.cache/map-state.json`. For each service compute a cheap **fingerprint** (e.g. `git -C <path> rev-parse HEAD` if a repo, else hash of file list + mtimes of source dirs).
- Map a service only if: `--refresh` is set, or `--service` names it, or its fingerprint changed, or it has no card yet. Skip unchanged services (their card stays). Report what you skipped.

### 2. Map each service — parallel agents (one per service)
Launch the **Explore** agent **once per service to map, concurrently** (single message, multiple Agent calls; cap ~6 in flight). Give each agent the service's path and require it to return a **service card** in exactly this shape:

```
# <service name> (<type>)
**Purpose:** 1-2 sentences — what this service is responsible for.
**Tech:** language/framework, datastore(s), messaging.
**Public API:** endpoints / RPC / GraphQL (method + path + 1-line purpose). "—" if none.
**Events:** consumes [...] / produces [...] (topics/queues). "—" if none.
**Data owned:** main entities / tables / collections.
**Depends on:** other services it calls (by name) + external systems.
**UI surfaces:** pages/screens/components if it has a frontend; else "—".
**Key flows:** 2-5 bullet user/data flows this service participates in.
**Risks/smells:** anything notable (tech debt, missing tests, security) — brief, factual.
```
Write each returned card to `system/services/<name>.md`. Filter out agents that returned nothing.

### 3. Synthesize the system map
From all cards (existing + new) produce:
- `system/system-map.md`:
  - **Capability catalog** — grouped list of what the whole system does (by domain), each capability noting which service(s) own it.
  - **End-to-end journeys** — 3-7 cross-service user/business flows (e.g. "place order → payment → fulfilment → notification"), naming the services each step touches.
  - **Service index** — table: name · type · purpose · key deps.
  - **Cross-cutting observations** — duplication, missing ownership, fragile coupling, inconsistent UX across frontends.
- `system/dependency-graph.mmd` — a mermaid `graph LR` of service→service dependencies (use the "Depends on" of each card).
- `system/manifest.yaml` — `targetRoot` + the `services[]{name, path, type}` list (see schema above; absolute paths). This is what `implement-feature` reads to locate the real code, and what `propose-improvements` reads to route the UI track.
- Update `.cache/map-state.json` with new fingerprints + timestamp.

### 4. Report
Print: services mapped vs skipped, # capabilities, # journeys, and the path to `system-map.md`. End with: **Next:** run `/propose-improvements` to turn this map into an improvement backlog (or `/design-feature "<idea>"` / `/spec-feature F-N` once you have one).

## Notes
- Mapping is the expensive stage — rely on the cache; never re-read unchanged services without `--refresh`.
- Keep cards factual and short; this is a map, not a code review.
- Do not modify any service source. Read-only on the target; writes only into the product workspace (CWD).
- `system/manifest.yaml` is the single source of truth for "where the code lives" — keep its paths absolute and accurate; downstream skills depend on it.
