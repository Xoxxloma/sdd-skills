---
name: project-baseline
description: Use to produce or improve docs/dev/PROJECT.md — the project's living, machine-written technical document for developers. Create builds it by analyzing the frontend codebase with parallel read-only subagents (or from stated intent for greenfield); Refine re-scans the code and re-confirms human-sourced parts to catch drift. Trigger when the user wants to create, bootstrap, or refresh a baseline / PROJECT.md / project document for a frontend project.
---

# Project Baseline

## Goal

Produce `docs/dev/PROJECT.md`: one living technical document that helps a developer
understand how the project is built and why. There is a single body of content — no
frozen "Baseline", no separate "Current State", no Changelog. `project-baseline`
establishes and periodically re-scans it; `sync-project-doc` updates the code-readable
parts after each feature. The file is machine-written throughout and is not edited by hand.

Besides the document itself, this skill registers a one-block pointer to `PROJECT.md` in
the project's init/context file (see the registration step), so code tasks find the
technical document even when run without any skill. It touches nothing else.

This skill never writes production code. Its only document deliverable is `PROJECT.md`;
the pointer above is what makes that document discoverable, not a second deliverable.

**Guiding principle — document understanding, not inventory.** The point is fast
onboarding: help a developer understand how the project is built and why. Capture
architectural decisions, module boundaries, non-obvious connections, the reasoning a
reader could not get by glancing at the code. Do NOT dump inventory trivially readable
from the repo — full dependency lists with versions (they live in `package.json` and go
stale), every shared component (that is the code tree's job), exhaustive file listings.
Prefer "the few libraries that shape the architecture and what each is for" over "all N
packages with versions". A shorter document that explains the project beats a long one
that mirrors the repo.

**The floor — what "understanding, not inventory" must never cut.** Concision cuts
inventory, not the load-bearing facts a newcomer needs. Capture these whenever the
project has them (skip a category only when the project genuinely lacks it):
- external services / integrations by name (names only, not full contracts);
- intentional fixtures and security-relevant facts (hardcoded tokens/credentials, mocks,
  feature flags gating unreleased work) — by location and confirmed intent;
- roles / permissions, if any: the list the code shows (§8), plus what each role may do —
  user-confirmed, `TBD` if they decline, never guessed;
- the entry-point wiring: the provider/context stack and any non-obvious bootstrap step,
  not just "renders the app";
- the Always/Never rules of the project (§9): mandatory steps and hard prohibitions a
  newcomer would miss — from the user or an explicit marker in the repo, never inferred.
  An empty §9 is a correct outcome when no such source exists.
When unsure whether something is inventory or floor, keep it: under-summarizing the floor
is the failure this guards against.

## Language

**Write the PROJECT.md document in Russian prose; keep technical terms in English and
never translate them** — the reader must see the same word that appears in the code.
Also English: the section headings and field labels from the document shape, the
`## Metadata` field names, and the init-file pointer block (that block is an instruction
to the runner, not part of PROJECT.md). The block labels «Факты» / «Почему / решения» stay
Russian — they are document structure. Correct line:

```md
- Entry point: `src/main.tsx` — здесь собирается провайдерная обвязка, конфиг
  подтягивается до первого рендера.
```

This keeps PROJECT.md in the same register as DESIGN.md. Do not leave the language to the
run — pin it, else the document drifts between Russian and English across runs.

## Paths

Base docs directory: `docs/dev/`
- Living document: `docs/dev/PROJECT.md`
- Plans directory (read-only context only): `docs/dev/plans/`

If you change this base path, keep it identical to the path used by `writing-plans-front`,
`executing-plans-front`, and `sync-project-doc`.

## Ownership — two visible blocks, one document (the rule that prevents collisions)

`PROJECT.md` has two writers — this skill and `sync-project-doc` — and they never collide,
because ownership is **by visible block**, not by section and not by an invisible marker:

- **«Факты»** — statements verifiable from the repo (the routing approach, the state
  approach, module boundaries as they physically are). This skill writes them on Create
  and re-scans on Refine; **`sync-project-doc` keeps them current** after each feature.
- **«Почему / решения»** — human knowledge not in the code (why a module exists, what is
  canonical, the rationale behind a boundary). `sync` **never touches** these.
- **§1 Overview, §9 Conventions, §10 Known Gaps — whole human zones.** `sync` never
  enters them at all.

So `sync`'s rule is one line: **edit only under «Факты»; never enter «Почему / решения»,
§1, §9, §10.** A violation shows up in a diff — no checker needed.

Placement is single-hop: **a fact readable from code → «Факты»; a why/canonical/rationale
→ «Почему»; a normative rule → §9.** The test is "could `sync` keep this current by
reading the code?":
- yes → «Факты» (even if it reads like a design decision);
- no (purpose, audience, why a module exists, a confirmed fixture, canonical vs tech
  debt) → «Почему» or the matching human zone;
- a §9 rule → always §9 (code shows what *is* done, not what *must* be done, so a rule is
  never "verifiable from code").

When in doubt about a rationale/purpose/classification, it is human-given → «Почему». When
in doubt about a plain fact, keep it in «Факты»: parking a code-fact in «Почему» silently
locks `sync` out of a fact it must be able to fix. **Never mix a code-fact and its
rationale in one line** — the bare fact goes in «Факты», its "why" as its own line in
«Почему». See [`references/examples.md`](references/examples.md) for ❌/✅ contrasts, and
[`references/document-shape.md`](references/document-shape.md) for the full form.

An empty «Почему» block is a correct outcome — write «—». Every «Почему» line must trace
to a specific thing the user said through the gate. Never manufacture a rationale, never
lift one from `references/examples.md` (the examples teach the shape, their text never
enters the document), and — the common trap — never write a generic architectural truism
you inferred yourself ("modules are independent so they can be reused", "the boundary
prevents cycles"): that is a guess, not human knowledge, so it is «—», not «Почему».

## Modes

Detect the mode before doing anything else:

- **Create** — `docs/dev/PROJECT.md` does not exist. Build it from scratch.
- **Refine** — it already exists. Re-scan the code to correct drift across the whole
  document, re-confirm «Почему»/human-zone content with the user, and re-check block
  placement: move a statement from «Почему» to «Факты» once it becomes maintainable from
  code, and the reverse when a code-fact turns into a human judgment call (see 7r). This
  is the drift-catcher: `sync` only nudges «Факты» per feature, so Refine is where the
  document is reconciled with reality end to end — and where a greenfield document (which
  starts almost entirely in «Почему») is progressively handed to `sync` as real code lands.

## Subagent roster

In Create + brownfield, the orchestrator (this skill) launches parallel **read-only**
subagents. Each owns a section cluster and reads only the relevant files; the orchestrator
then writes one document from their findings and synthesizes §1 Overview from all of them.
Subagents must not write files and must not modify code.

| Subagent | Fills | Reads |
|----------|-------|-------|
| A — stack/conventions      | §2, §9      | package.json, lock file, tsconfig, build/lint/test/format configs, CONTRIBUTING |
| B — architecture           | §3          | folder tree, entry point, module boundaries, render model |
| C — routes                 | §4          | router config, page/screen files |
| D — components/design      | §5          | shared/primitive components, tokens, theme, styling setup |
| E — state/data             | §6          | stores, hooks, data-fetching/caching layer, context providers |
| F — backend integration    | §7          | API clients, fetch/request call sites, contract/type definitions |
| G — cross-cutting/gaps      | §8, §10     | auth/session, roles & permission checks, i18n, error boundaries, a11y, TODO/FIXME/HACK markers |

Scale to project size: on a small project, merge roles into 2–3 subagents; on a large one,
split F by backend domain. Number of subagents is recorded in `## Metadata`.

Each subagent reports **understanding, not a dump**: architectural decisions, boundaries,
and non-obvious connections — not exhaustive lists. One that finds 30 dependencies reports
the few that shape the architecture. But "not a dump" never means dropping the floor: each
still returns, in full, the load-bearing facts in its cluster — external services by name,
intentional/security fixtures, roles, entry-point wiring, Always/Never rule candidates.

Subagent A owns §9, so one limit is on it: it may collect Always/Never candidates **only**
from explicit markers (CONTRIBUTING, a config, a comment stating the rule). A merely
observed pattern is not a rule — that goes to the gate as a question, never into §9. A
subagent that meets a rule-stating comment in code reports it as a §9 candidate and does
not write it itself.

## Process

### Step 0 — Detect mode and project type
1. Check whether `docs/dev/PROJECT.md` exists → set mode (Create / Refine).
2. In Create, detect project type. If the source tree is empty or contains only untouched
   scaffolding (fresh `create-vite`/CRA/Next starter, near-empty `src`, brand-new git
   history), treat it as **possible greenfield** and confirm with the user before
   proceeding — do not silently guess. Otherwise proceed as brownfield.

### Create — brownfield
3. Plan the subagent fanout (roster above, scaled to size) and record the count.
4. Launch the read-only subagents in parallel. Give each its section cluster, file scope,
   the document shape ([`references/document-shape.md`](references/document-shape.md)), and
   the Language rule, so findings come back mapped to sections and in the document's register.
5. Collect findings. Where a subagent flags an ambiguity it could not resolve from code,
   route it into the Clarification gate rather than guessing. **Run the Detection half of
   the registration step here too** (locate the init/context file, determine whether a
   pointer exists — see [`references/register-pointer.md`](references/register-pointer.md)):
   it must happen now, while the gate is open. Route any question it raises into the gate.
6. **Run the mandatory Clarification gate now — before assembling:** collect every open
   question and debatable classification, ask the user in batches of at most four per turn.
   Incorporate the answers; user answers override code inferences. Content from these
   answers is human-origin — it goes in «Почему» / a human zone, never «Факты».
7. Assemble the document per the shape, and synthesize §1 Overview from evidenced facts
   (README, package description, code) or from the user's answers; never invent it. The
   findings are raw material, not text to paste: whatever language they came back in, the
   document is Russian prose per the Language rule. Place each statement in «Факты» /
   «Почему» / a human zone per the Ownership rule as you assemble. If assembly surfaces a
   new question, re-open the gate before writing.
8. Fill `## Metadata`. On Create, set `Last synced: n/a` — it is `sync-project-doc`'s field.
9. **Write the assembled document to `docs/dev/PROJECT.md` on disk now.** Do not write with
   open questions outstanding. Create `docs/dev/` if it does not exist. Assembling in your
   reply is NOT sufficient — the file must be created.
10. Register the pointer (registration step below), then run Self-Review and hand off.

### Create — greenfield (optional)
3g. Do **not** launch the subagent fanout — there is no code to read. Run at most one
    orchestrator pass over whatever exists (e.g. scaffold `package.json`).
4g. Fill the document from stated intent: accept a provided intent/design document, or run
    a short section-guided intake (stack, intended architecture, planned routes,
    conventions). Phrase sections as intended/planned, not observed. Nearly everything here
    is human-given → it lives in «Почему» / human zones; «Факты» blocks stay thin («—»)
    until real code lands.
5g. Anything the user did not provide and is not in code: mark `TBD`. Never fabricate.
    **Run the Detection half of the registration step now**, while the gate is open; any
    question goes into the gate batch.
6g. Fill `## Metadata`: `Last code re-scan: n/a`, `Generated by: project-baseline
    (greenfield)`, `Last synced: n/a`. **Run the Clarification gate**, then **write the
    document to disk now** (create `docs/dev/` if missing). Register the pointer, run
    Self-Review, hand off.

### Refine
3r. Read the existing `PROJECT.md` in full. Note the «Почему» / human-zone content and
    reuse decisions already recorded (e.g. certain credentials confirmed intentional — do
    not re-ask).
4r. Run the brownfield analysis (subagent fanout, scaled, briefed as in step 4) to gather a
    current picture, targeting incomplete sections, `TBD`/`TODO`, and likely inaccuracies.
    **Run the Detection half of the registration step here** — a regenerated init file is
    what this catches. Any question must reach the gate in 9r while it is open.
5r. Diff the new findings against the document. Do not rewrite from scratch — that discards
    the user's prior interview answers.
6r. Apply purely additive improvements only when the new content is a verifiable fact from
    code (or already user-confirmed). Filling a `TBD` with an inferred value is NOT
    additive — route it through the gate. Additive improvements still obey the guiding
    principle: understanding, not inventory.
7r. **Re-check block placement against the current code.** Per statement:
    - still human-given (why a module exists, what is canonical, purpose, a confirmed
      fixture) or normative (§9) → **keep** it in «Почему» / its human zone;
    - now maintainable from code (a greenfield "intended" fact that is now real, a
      rationale now self-evident in the structure) → **move it to «Факты»** so `sync`
      maintains it going forward (confirm on any conflict per 8r).
    Conversely, if a «Факты» statement has turned into a human judgment call, move it to
    «Почему». This is what keeps a greenfield document from freezing. Moving a line between
    blocks is a handover, not a content change; if the content itself also changes, that
    goes through 8r. Same pass: split any inherited line that mixes a fact with its
    rationale — bare fact in «Факты», rationale in «Почему».
8r. **For any value that conflicts with what the document already states, always ask the
    user before writing — every conflict, no exceptions. Never silently overwrite.**
    Present existing vs proposed side by side. This applies with special force to «Почему»
    / human-zone statements whose *content* changes: those change only by re-asking the
    human. (Moving a line to «Факты» in 7r because it is now code-evident is a handover,
    not a content change — but if unsure whether the meaning shifted, treat it as a conflict.)
9r. Update `## Metadata` for the fields this run changed: the re-scan date/commit, and
    `Generated by` if this run's fanout differs. Leave `Created` and leave `Last synced`
    as `sync` set it. **Run the Clarification gate before writing** (covers 8r conflicts
    plus other open questions), then **write the updated document back to disk now** — edit
    the actual file. Then register the pointer (restores it if the init file lost it — file
    and pointer state are known from 4r). Self-Review, then hand off.

### Clarification loop (shared, Create and Refine) — MANDATORY GATE
Not optional and not purely reactive. Before writing to disk you MUST run an explicit
clarification pass: collect every open ambiguity, batch the questions, ask the user.
Proceed to the write only after the user answered (or explicitly declined). A run that
writes without surfacing its open questions is incorrect. If after honest analysis there
are genuinely zero open questions, state that explicitly. If the user declines a question,
mark the affected content `TBD` or omit it — never fill it with the answer you would have
guessed. (That rule is about document content: the init-file question has no field, so
`TBD` does not apply to it — its outcomes are in the registration step.) Everything the
user answers here is human-origin — it goes in «Почему» / a human zone.

You MAY ask about: intentional vs accidental (credentials, mocks, flags, commented-out
code); which pattern is canonical when several conflict; purpose/intent not derivable from
code; classification of something debatable (decision vs tech debt); boundaries (what must
not be touched, what is deprecated); confirmation of a code-inventoried role/permission
list (completeness, which is authoritative, what each role may do); which file the runner
reads at session start when it cannot be identified confidently; in Refine, conflict
confirmations (8r).

You must NOT ask about: anything readable directly from code; stylistic trivia; operational
details with an unambiguous default visible in the project. Never stretch "default" to
cover intent, purpose, audience, canonical-pattern choice, or any debatable classification.

Batch with answer options where possible, but **at most 4 questions per turn** — the
interface accepts no more than that. If more are open, ask the four most important first
and continue next turn(s). Never drop the remaining questions to fit.

### Register the project document in the always-on context — MANDATORY, every mode
Detection during the analysis phase (steps 5 / 5g / 4r), Append after the write. Full rules
in [`references/register-pointer.md`](references/register-pointer.md) — the shared source
for both baseline skills. Report exactly one Append outcome in the handoff (`added to
<file>` / `already present` / `no init file found` / `not registered (init file not
confirmed)`). Leave any `business-baseline` block untouched.

### Secrets handling (shared)
- Do not copy secret values into the document. Record the fact neutrally, by location only
  — e.g. "test credentials present in `<file>`, confirmed intentional by the user." Because
  that is a user-confirmed judgement, the line lives in «Почему» / §8's human block.
- Do not raise a false alarm. Ask whether they are intentional (Clarification loop) rather
  than labeling a leak.
- Credentials the user confirms are intentional test fixtures do NOT go into §10 Known
  Gaps. Only genuine, user-confirmed concerns go there.

## Document shape

`PROJECT.md` is one flat document. See
[`references/document-shape.md`](references/document-shape.md) for the full template with
the «Факты» / «Почему / решения» blocks per section and the §1/§9/§10 human zones. Fill it
from evidence or user input; mark unknowns `TBD`; never fabricate purpose/audience.

## Rules

- Document understanding, not inventory. No full dependency lists, no version numbers, no
  exhaustive component/file enumerations; use one-line pointers for readable-but-bulky facts.
- Write the document in Russian prose; keep technical terms in English and never Russify
  them. English too: section headings, field labels, `## Metadata` field names, the
  init-file pointer block. «Факты» / «Почему / решения» block labels stay Russian (document
  structure). Subagent findings are raw material — write the document yourself, in Russian.
- Own by block, not by marker: «Факты» is what `sync` maintains; «Почему / решения», §1,
  §9, §10 are what it must never touch. Place per the Ownership rule; never mix a code-fact
  and its rationale in one line. A misplaced statement (a human rationale in «Факты», or a
  code-fact parked in «Почему») is a defect.
- §9 Always/Never is normative: a runner obeys it, so it holds hard rules only — breaking
  one breaks something real (a request bypasses retries, a build fails, data is corrupted).
  Preferences and taste stay descriptive, in Naming / File conventions. Only two sources
  qualify: the user via the gate, or an explicit marker in the repo. Never derive a rule
  from observation — that is an invented law, worse than an empty list. An observed module
  boundary (e.g. "features don't import each other") is a §3 «Факты» fact, never a §9
  Never — do not restate a boundary or pattern you merely saw as a rule. Skip anything
  lint/TS/CI already enforces. Cap each list at 5–8 lines. §9 is a whole human zone.
- An §9 rule that turned out wrong — the user says it no longer holds, or the code moved
  past it — is a conflict for Refine (8r), never something to quietly drop or rewrite.
- This skill writes at most two files: `docs/dev/PROJECT.md` (always), and a one-block
  pointer appended to the init/context file (unless already there or no init file exists).
  Nothing else in the repo is modified. Whatever is written must persist to disk. Create
  `docs/dev/` if needed.
- Register a pointer to `PROJECT.md` per the registration step — in all modes, detection
  during analysis, append after the write. Never guess the file; never duplicate an
  existing pointer; leave any `business-baseline` block untouched.
- `PROJECT.md` is machine-written. This skill and `sync-project-doc` are its only writers;
  it is not hand-edited.
- Analysis is read-only inspection of files (and git metadata) only. Neither the
  orchestrator nor any subagent may install dependencies, run build/dev/test/lint scripts,
  execute project code, or perform any state-mutating shell command. Subagents never write
  files or change code.
- User answers override code inferences. A stated fact is recorded as fact.
- The Clarification gate is mandatory, not reactive. If there are truly no open questions,
  say so rather than skipping silently.
- Never record a guess, suspicion, or your own classification as a Known Gap. Anything
  debatable is confirmed via the gate first; if unconfirmed, leave it out.
- Never copy secret values into the document; record location and confirmed intent only.
- Greenfield disables the subagent fanout; fill from intent, keep «Факты» thin, mark
  unknowns `TBD`. Never fabricate.
- In Refine, never rewrite from scratch and never silently overwrite. Every conflict is
  confirmed with the user first; «Почему» / human-zone content changes only by re-asking.
- Reuse decisions already recorded; do not re-ask settled questions on a re-run.
- Do not run git write operations; reading the current commit sha for Metadata is fine.
- Do not write production code under any mode.

## Self-Review

Before reporting done, confirm:
1. The file exists on disk at `docs/dev/PROJECT.md` with the written content — not just in
   the reply.
2. Language: Russian prose, technical terms in English (not Russified); headings, labels,
   `## Metadata` field names untranslated; the pointer block fully English. One consistent
   language, no drift.
3. Ownership: every statement `sync` cannot maintain (purpose, audience, why-a-module-
   exists, canonical choice, confirmed fixture, known gaps, every §9 rule) lives in «Почему»
   / §1 / §9 / §10 — never under «Факты»; and, conversely, every «Факты» line is something
   `sync` could maintain from code. No line mixes a code-fact with its rationale.
4. Every section is filled from evidence or user input, or honestly `TBD` — no fabricated
   content, no invented purpose/audience/classification.
5. Understanding, not inventory: (a) §5 does NOT list shared components by name — it states
   the layer exists and where; (b) §2 «Факты» contains NO version numbers; (c) no
   exhaustive dependency or file enumeration.
6. The floor survived: external services named; intentional/security fixtures recorded (by
   location + intent, in a human block); the roles the code shows captured in §8 «Факты»
   with their meaning either user-confirmed in §8 «Почему» or `TBD`; entry-point wiring
   described; §9 captures any user-confirmed or marker-backed mandatory steps — empty is
   valid, no rule inferred from observation.
7. The Clarification gate ran: open questions surfaced before the write (or stated there
   were none); declined document questions became `TBD`, not guesses.
8. §10 Known Gaps contains only verifiable facts or user-confirmed items.
9. `## Metadata` reflects this run for the fields this skill owns: `Created` (real date,
   set once), `Last code re-scan` (this run's date/commit — `n/a` on greenfield),
   `Generated by`. `Last synced` was not touched (`n/a` on Create only).
10. In Refine: prior «Почему»/human content reused and re-confirmed on conflict; nothing
    silently overwritten; block placement re-checked — statements now code-maintainable
    moved to «Факты», still-human ones kept — so a formerly greenfield document is not
    frozen; Detection ran in 4r, so a pointer lost to a regenerated init file was restored.
11. No production code or non-PROJECT.md file was modified — except the single pointer block
    appended to the init/context file — no dependencies installed, no scripts run, no git
    writes.
12. A pointer to `PROJECT.md` was added to the init/context file as real markdown (not
    blockquoted or fenced), or was already present and left alone, or was not registered —
    and the user was told. Any existing `Business Context` block was left untouched.

## Handoff

Report concisely:

> "PROJECT.md <created | refined> in `docs/dev/` (<mode>, <N> subagents | greenfield)."
> "Sections filled: <list>. «Почему»/human-zone items: <count>. Marked TBD: <list or none>."
> "Open clarifications resolved: <count>."
> "Project-document pointer: <added to `<init file>` | already present | not registered (init file not confirmed) | no init file found>."

If anything remains `TBD`, add:

> "Still TBD and worth a follow-up: <list>."
