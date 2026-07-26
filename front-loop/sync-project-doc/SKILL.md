---
name: sync-project-doc
description: Use after an approved plan has been fully executed, to fold the increment into the project's living documents. From a single reading of the plan it writes two projections of the same change: the code-readable technical state in PROJECT.md and, in business language, the capabilities in BUSINESS.md. It never touches interview-origin (<!--i-->) content and never writes production code. This is the manual "archive" step that keeps the living docs current.
---

# Sync Project Doc

## Goal

Bring the project's living documents up to date after one increment is finished. From
a single reading of the plan it produces two projections of the same change:
- the **technical** projection → `PROJECT.md` (developer language, code-readable parts),
- the **business** projection → `BUSINESS.md` `## Capabilities` (analyst language).

There is no Changelog to write and no plan folder to delete. History lives in the plan
folders under `docs/dev/plans/` (kept, marked `.synced`) and in the always-current
`PROJECT.md`. This skill never writes production code and never modifies the plan pack.
Its deliverables are the updated living documents plus a `.synced` marker per plan.

This is a documentation edit, not an investigation. You derive the increment entirely
from the plan pack files (`plan.md` and `plan-status.md`) and then edit the documents.
You do not inspect git, diff the codebase, or open source files — the plan already
states what changed. If the plan files give you what you need for both projections, you
are done gathering; go write.

### One reading, two projections (this is what keeps it simple)
Understand the increment ONCE (Step 4). Then phrase that one understanding two ways —
you are translating, not re-analyzing. Route by what the change actually is:
- **Behavior/product change** (most features) → write the business projection in
  `BUSINESS.md` Capabilities, and the technical projection in `PROJECT.md` if the
  code-readable state also changed.
- **Purely technical** (refactor, no user-visible behavior change) → write only the
  `PROJECT.md` technical projection; the business projection is empty.
- **Both** (the common case) → write both.
Never re-read the plan separately for each document; the analysis is shared.

### What you may and may not touch in PROJECT.md
`PROJECT.md` is one machine-written document. Two kinds of content live in it:
- **Code-readable** (unmarked) statements — the routing approach, state approach,
  boundaries as they are. **These you update** so the document reads as the present
  system.
- **Interview-origin** statements, marked `<!--i-->` — why a module exists, what is
  canonical, product purpose, confirmed fixtures, known gaps. **These you must never
  rewrite, reword, or delete.** They came from the human; you have no interview to
  regenerate them. If an increment appears to make a marked statement stale (e.g. a
  module's purpose really changed), do NOT edit it — leave it and flag it in the
  handoff for `project-baseline` Refine to update with the user.

Apply the guiding principle here too: **understanding, not inventory.** When you update
a code-readable part, keep it to the load-bearing approach and pointers — do not expand
it into full route tables, version numbers, or component enumerations. Match the
document's existing register.

## Paths

Base docs directory: `docs/dev/`
- Technical living document: `docs/dev/PROJECT.md`
- Business living document: `docs/dev/BUSINESS.md` (Capabilities). Optional — if it does
  not exist, the business projection is skipped.
- Plans directory: `docs/dev/plans/`, one subfolder per feature. A single increment is
  a feature folder `docs/dev/plans/<feature>/` with `plan.md` and, optionally,
  `plan-status.md` and `plan-test-plan.md`.

If you renamed the plans directory, change this base path here and keep it identical to
the path used by `writing-plans-front` / `executing-plans-front`.

## When to run

Run this only when ALL of the following are true:
1. A plan exists at `docs/dev/plans/<feature>/plan.md`.
2. Its execution is finished: every milestone gate (in the plan or the `-status.md`
   companion) passes, and `## Milestone Status` shows the work done.
3. The increment has not yet been synced — there is no `.synced` marker in its folder.

If execution is not finished, stop and say so. Do not partially sync an in-progress
plan. If the plan is trivial and produced no observable change at all, you may skip both
projections and only drop the `.synced` marker.

## Document shape

This skill edits two living documents. In `PROJECT.md` it updates only the
code-readable parts the increment changed (never `<!--i-->` statements); in
`BUSINESS.md` it edits only `## Capabilities`.

### PROJECT.md (excerpt — the parts sync may update)

```md
## 3. Architecture & Structure
- Module boundaries: `features/` never imports from `pages/`.  ← unmarked: sync may update
- Why this boundary: deliberate, keeps route code swappable. <!--i-->
- Rendering model: SPA (client-rendered, single entry).        ← unmarked: sync may update

## 4. Routes & Screens
<routing approach; sync folds a new/changed route into the present-state description>
```

Because origins are one-per-line (project-baseline splits the fact from its rationale),
the code-fact line — the boundary itself — is unmarked and sync maintains it, while the
"why" line stays `<!--i-->` and sync leaves it alone. Update unmarked statements in
place so the section reads as "what is now". Do not append "added X / changed Y"
sentences — fold the change into the description. Leave `<!--i-->` statements exactly as
they are.

### BUSINESS.md — only `## Capabilities`

`business-baseline` owns the document and its format; sync edits only this one section,
matching the existing table shape. Do not change other sections.

```md
## Capabilities
<Present-state slice of what the product can do today, in analyst language. A live list,
not a log — add/rewrite/remove rows.>
| Capability | For which user/role | Notes |
|------------|---------------------|-------|
```

## Process

You may be given several finished plans in one run (a feature may take 2–3 plans, then
one sync). Sync whatever you were handed, in the order the user listed them; this skill
does not scan folders to discover plans. Do all edits in one run; do not stop after the
first plan. There is no "one row vs many" question anymore — that was the Changelog; it
is gone.

1. **Resolve the increment.** You are given a `<feature>` (folder name) or a plan path.
   Find `docs/dev/plans/<feature>/plan.md` and, if present, `plan-status.md`. If you
   cannot identify exactly one plan, ask rather than guessing.
2. **Confirm completion.** Read `plan-status.md` (`## Milestone Status`, `## Current
   Task`, `## Blockers`). If unfinished or blocked, stop and report. Do not sync an
   unfinished increment.
3. **Read `PROJECT.md`.** If it does not exist, stop and tell the user to establish it
   first with `project-baseline`, then run sync — do not create `PROJECT.md` yourself and
   do not infer its content. Establishing the document is `project-baseline`'s job; sync
   only evolves an existing one.
4. **Read the increment from the plan, not the repository.** Take what changed directly
   from `plan.md` (summary, `User-facing outcome`, scope, tasks) and `plan-status.md` —
   new/changed/removed screens, routes, components, shared state, contracts,
   conventions. State it as end state. Do not run git, diff code, or open source files;
   the plan is the source of truth for the increment.
5. **Write the technical projection into `PROJECT.md`.** Update only the **unmarked
   (code-readable)** statements the increment actually changed, folding the change into
   present-tense description so a fresh reader sees only how things are now. Keep it
   understanding-first — approach and pointers, not inventory. Leave unrelated parts
   untouched. **Never edit a `<!--i-->` statement.** If the increment seems to make a
   marked statement stale, leave it and note it for the handoff. If the change was
   purely technical-internal with no architectural effect, there may be little or
   nothing to change here; that is fine.
6. **Write the business projection into `BUSINESS.md` `## Capabilities`.** Source the
   capability text in this priority, never reconstructing it from implementation tasks:
   - If the plan has a `User-facing outcome` line, use it — phrase it as a capability row.
   - Else, if the plan's Summary states the user-facing meaning in plain terms, take it
     from there (reading, not inferring).
   - Else (only technical tasks, no stated user meaning), mark the capability `TBD` and
     note it — do NOT guess from components/routes.
   Phrase it in analyst language ("users can group nearby points on the map when zoomed
   out"), never developer language. Keep `## Capabilities` a **present-state slice**, not
   a log:
   - **Added** → add the row.
   - **Changed** → rewrite the existing row so it reads as current behavior; do not add a
     second row beside the old one.
   - **Removed** → delete the row.
   Rules for this section:
   - Touch **only** `## Capabilities`. Do NOT edit `## Business Scenarios`, `## Business
     Entities`, `## Product`, `## Users & Roles`, or `## Scope` — those belong to
     `business-baseline`.
   - If the increment is purely technical, write nothing here.
   - If `BUSINESS.md` does not exist, skip this projection and note it in the handoff
     ("BUSINESS.md not found — capability not recorded; run `business-baseline`"). Do NOT
     create it or infer its core.
6a. **Stamp `Last synced`.** In each living document this run actually edited
   (`PROJECT.md` and/or `BUSINESS.md`), set the `## Metadata` field `Last synced:` to
   today's real local date, generated from the current environment (not hardcoded). This is a plain date write, not
   a git operation, so it does not break the no-repository-investigation rule. Do not
   touch the `Last code re-scan` field in either `PROJECT.md` or `BUSINESS.md` — it
   records the last `project-baseline` / `business-baseline` scan and is not yours to
   move. If a document was not edited this run (e.g. a purely technical
   increment left `BUSINESS.md` untouched), do not stamp it. If the field is absent
   because the document predates this convention, add it under `## Metadata`.
7. **Drop a sync marker.** Create an empty file `docs/dev/plans/<feature>/.synced` to
   mark the plan merged. Do not edit `plan.md` or any existing pack file. If `.synced`
   already exists, the plan was synced before (see the duplicate rule).
8. Self-check against the rules below, then report what changed.

## Rules

- **Never edit an interview-origin (`<!--i-->`) statement** in `PROJECT.md` — not
  reword, not delete, not "improve". You cannot regenerate it; only `project-baseline`
  Refine can, by re-asking the human. If an increment makes one stale, leave it and flag
  it in the handoff.
- **Route meaning-changing increments to Refine, don't project them.** `sync` maintains
  only what it may: code-readable facts and additive/in-place capabilities. When an
  increment changes user-facing paths or the *meaning* of something previously recorded
  — a canonical-pattern choice, a module's purpose, a business scenario, or a marked
  note it makes stale — that is human-authored content `sync` cannot regenerate. Do not
  rewrite it and do not invent a replacement; leave it and flag it for `project-baseline`
  Refine (scenario/core changes → `business-baseline` Refine). This is the intended path
  for a "big change": small present-state delta here, human re-ask in Refine.
- Update only the code-readable (unmarked) parts the increment changed. `PROJECT.md`
  describes the present system, never a change log: if a sentence starts with "added",
  "now also", "changed", or names a date, rewrite it as present-tense state.
- Apply understanding-not-inventory when updating: approach + pointers, no version
  numbers, no full route/component enumerations.
- This skill does not investigate the repository. Do not run git (diff/log/status), do
  not diff or read source files, do not run build/test/dev commands. The increment's
  content comes from `plan.md` and `plan-status.md` only. The files you may modify are
  `docs/dev/PROJECT.md` (code-readable parts, plus the `Last synced` field in its
  `## Metadata`) and `docs/dev/BUSINESS.md` (`## Capabilities` only, plus the
  `Last synced` field in its `## Metadata`). Writing the date into `Last synced` is a
  plain edit, not a git operation, so it does not breach the no-investigation rule.
  Creating the `.synced` marker beside the pack is allowed.
- One reading of the plan, two projections: understand once, then phrase for
  `PROJECT.md` in developer terms and for `BUSINESS.md` in analyst terms. Do not
  re-analyze per document.
- In `BUSINESS.md`, edit only `## Capabilities` (and the `Last synced` field in
  `## Metadata`). Never touch the other sections — they are owned by `business-baseline`.
  If `BUSINESS.md` is missing, skip and note it; never create it or infer its core.
- Keep registers separate: developer language in `PROJECT.md`, analyst language in
  `BUSINESS.md`. Never put implementation detail in `BUSINESS.md` Capabilities.
- Do not write production code, and do not edit any existing file in the plan pack
  (`plan.md`, `plan-status.md`, `plan-test-plan.md`). Creating `.synced` is the only new
  file.
- If completion is ambiguous (status missing, gate not passed, open blocker), stop and
  ask. Do not sync on assumption.
- **`.synced` is the sole duplicate-sync guard.** A plan is already synced iff a
  `.synced` marker exists in its folder. If asked to sync one that already has it, say so
  and make no change.

## Self-Review

Before reporting done, confirm:
1. No `<!--i-->` statement in `PROJECT.md` was reworded, deleted, or otherwise changed;
   any increment-induced staleness in a marked statement was left in place and flagged
   for `project-baseline` Refine.
2. The unmarked code-readable parts the increment touched now read as present-tense
   developer-language description — no diff/log phrasing, no leftover stale statements
   contradicting the new state, understanding-first (no inventory bloat).
3. The business projection: if user-visible and `BUSINESS.md` exists, `## Capabilities`
   reads as a present-state slice — the affected capability added, rewritten in place, or
   removed (not duplicated, not accumulated), in analyst language, only that section
   touched. Its text came from `User-facing outcome` or an explicitly stated meaning —
   not reconstructed from tasks; where none was stated it was left `TBD`. If purely
   technical, nothing was written; if `BUSINESS.md` is missing, it was skipped and noted.
4. The single understanding was phrased twice, not re-analyzed per document.
5. The `BUSINESS.md` core/scenarios sections are byte-for-byte unchanged.
6. A `.synced` marker was created for each synced plan; no plan-pack file was modified;
   the increment was taken from the plan files only — no git or codebase investigation.
7. `Last synced` was stamped (today's date) in each living document this run actually
   edited, and only that field — the `Last code re-scan` field (in either document) and
   every non-Capabilities section were left untouched. A document not edited this run was
   not stamped.

## Handoff

After updating, report concisely (one line set per plan if several were synced):

> "Synced `<feature>`."
> "PROJECT.md: <one-line of what code-readable state now reads differently, or 'no technical change'>."
> "BUSINESS.md Capabilities: <one-line capability added/updated, or 'no user-visible change' / 'BUSINESS.md not found — run business-baseline'>."
> "`.synced` marker written to `docs/dev/plans/<feature>/`."

Route large or meaning-changing increments to Refine. `sync` only projects what it may
maintain (code-readable facts, additive capabilities). Anything that changes user-facing
paths or the *meaning* of something previously recorded — a canonical choice, a module's
purpose, a business scenario, or an interview-origin note the increment appears to make
stale — is not `sync`'s to rewrite. Do not attempt to project it; flag it for
`project-baseline` Refine (or `business-baseline` Refine for scenario/core changes). This
is the standing route for the "big change" case: `sync` handles the small present-state
delta, Refine re-asks the human for the parts that carry human meaning. When any of that
applies, add:

> "Heads-up: this feature may affect human-authored content that `sync` doesn't maintain — <what: e.g. an interview-origin note in PROJECT.md, a canonical-pattern choice, a business scenario>. I left it untouched — run `project-baseline` Refine (or `business-baseline` Refine for scenarios/core) to update it with you."
