---
name: system-map
description: Use when you need to understand the full functionality of a large or multi-service codebase before changing it — build a "system map": a per-service capability card, a cross-service dependency graph, end-to-end user journeys, and a catalog of everything the system does. Use for onboarding onto an unfamiliar app, auditing a microservice landscape (e.g. 10-20 services across separate repos/folders), or refreshing an existing map after changes. First stage of the product-skills pipeline; its output feeds propose-improvements.
version: 1.0.0
user-invocable: true
argument-hint: "[workspace-path] [--refresh] [--service <name>]"
---

Builds and maintains a **system map** of a large application from its source. Designed for many services living in separate local folders. Output is the shared foundation every later stage reads.

## Workspace contract

All artifacts live in a workspace dir — default `./product/` (or the path passed as the first arg). Create it if missing. You produce:

```
product/system/system-map.md        # synthesis (capability catalog + journeys)
product/system/services/<name>.md    # one card per service
product/system/dependency-graph.mmd  # mermaid graph
product/.cache/map-state.json        # { "<name>": { "fingerprint": "...", "mappedAt": "..." } }
```

The list of services comes from `product/manifest.yaml`:
```yaml
services:
  - name: orders
    path: D:/work/orders            # local folder
    type: backend                   # backend | frontend | fullstack | lib
    repo: git@…                     # optional
```

## Procedure

### 0. Resolve workspace + manifest
- Determine the workspace dir (arg or `./product/`). Create the subfolders above.
- If `manifest.yaml` is missing or empty: **ask the user** for the service folders (name → path), or, if they give a parent directory, scan its immediate subdirs that look like services (have `package.json` / `pom.xml` / `go.mod` / `*.csproj` / `Dockerfile`) and propose a manifest for confirmation. Write `manifest.yaml`. Do not guess silently.

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
Write each returned card to `product/system/services/<name>.md`. Filter out agents that returned nothing.

### 3. Synthesize the system map
From all cards (existing + new) produce:
- `product/system/system-map.md`:
  - **Capability catalog** — grouped list of what the whole system does (by domain), each capability noting which service(s) own it.
  - **End-to-end journeys** — 3-7 cross-service user/business flows (e.g. "place order → payment → fulfilment → notification"), naming the services each step touches.
  - **Service index** — table: name · type · purpose · key deps.
  - **Cross-cutting observations** — duplication, missing ownership, fragile coupling, inconsistent UX across frontends.
- `product/system/dependency-graph.mmd` — a mermaid `graph LR` of service→service dependencies (use the "Depends on" of each card).
- Update `.cache/map-state.json` with new fingerprints + timestamp.

### 4. Report
Print: services mapped vs skipped, # capabilities, # journeys, and the path to `system-map.md`. End with: **Next:** run `/propose-improvements` to turn this map into an improvement backlog.

## Notes
- Mapping is the expensive stage — rely on the cache; never re-read unchanged services without `--refresh`.
- Keep cards factual and short; this is a map, not a code review.
- Do not modify any service source. Read-only on the targets; writes only into the workspace.
