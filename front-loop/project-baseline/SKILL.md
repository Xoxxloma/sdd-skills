---
name: project-baseline
description: Use to produce or improve docs/dev/PROJECT.md — the project's living, machine-written technical document for developers. Create builds it by analyzing the frontend codebase with parallel read-only subagents (or from stated intent for greenfield); Refine re-scans the code and re-confirms human-sourced parts to catch drift. Trigger when the user wants to create, bootstrap, or refresh a baseline / PROJECT.md / project document for a frontend project.
---

# Project Baseline

## Goal

Produce `docs/dev/PROJECT.md`: one living technical document that helps a developer
understand how the project is built and why. There is a single body of content — no
frozen "Baseline", no separate "Current State", no Changelog. `project-baseline`
establishes and periodically re-scans it; `sync-project-doc` updates the
code-readable parts after each feature. The file is machine-written throughout and is
not edited by hand.

Besides the document itself, this skill registers a one-block pointer to `PROJECT.md` in
the project's init/context file (see the shared registration step), so code tasks find
the technical document even when run without any skill — appending it when the file is
known and the pointer is not already there. It touches nothing else.

This skill never writes production code. Its only document deliverable is `PROJECT.md`;
the pointer above is what makes that document discoverable, not a second deliverable.

**Guiding principle — document understanding, not inventory.** The point of this
document is fast onboarding: help a developer understand how the project is built and
why. Capture architectural decisions, module boundaries, non-obvious connections, and
the reasoning a reader could not get by glancing at the code. Do NOT dump inventory
that is trivially readable from the repo — full dependency lists with versions (they
live in `package.json`/lock and go stale), every shared component (that is the code
tree's job, and the DESIGN.md component registry's if the project keeps one), exhaustive
file listings. Prefer "the few
libraries that shape the architecture and what each is for" over "all N packages with
versions" (e.g. name the state library — Redux, MobX, Zustand — and why it matters,
not every utility in the manifest). When a fact is both readable from code AND
stale-prone AND doesn't aid understanding, leave it out or replace it with a one-line
pointer to where it lives. A shorter document that explains the project beats a long
one that mirrors the repo.

**The floor — what "understanding, not inventory" must never cut.** Concision cuts
inventory, not the load-bearing facts a newcomer needs. The following are
*understanding*, not inventory, and must survive even the tersest pass — capture them
whenever the project has them (skip a category only when the project genuinely lacks
it, never because it looked like a list):
- external services / integrations by name (the map of what this app talks to — names
  only, not full contracts);
- intentional fixtures and security-relevant facts (hardcoded tokens/credentials,
  mocks, feature flags gating unreleased work) — record them by location and confirmed
  intent, and mark them `<!--i-->`;
- roles / permissions, if the project has them: the list the code shows (§8), plus what
  each role may do — user-confirmed, `TBD` if they decline, never guessed;
- the entry-point wiring: the provider/context stack and any non-obvious bootstrap
  step (e.g. config fetched before first render), not just "renders the app";
- the Always/Never rules of the project: mandatory steps and hard prohibitions a
  newcomer would otherwise miss (e.g. a build flag that must be toggled) — from the user
  or an explicit marker in the repo, never inferred. An empty §9 is a correct outcome
  when no such source exists — never manufacture a rule to fill it.
Naming these is not "dumping the inventory" — a list of service names or a fixture is
the thing a reader cannot reconstruct from a glance and most needs. When unsure
whether something is inventory or floor, keep it: under-summarizing the floor is the
failure this guards against.

## Language

**Write the PROJECT.md document in Russian prose; keep technical terms in English and
never translate them** — the reader must see in the document the same word that appears
in the code.

English as well, though not because they are terms: the section headings and field labels
from the document shape, the `<!--i-->` marker and the `## Metadata` field names, and the
init-file pointer block (that block is an instruction to the runner, not part of
PROJECT.md).

This is what a correct line looks like:

```md
- Entry point: `src/main.tsx` — здесь собирается провайдерная обвязка, конфиг
  подтягивается до первого рендера.
```

This keeps PROJECT.md in the same register as DESIGN.md, which follows the same rule.
The language is not left to the run's discretion: without this rule the document drifts
between Russian and English across runs — pin it.

## Paths

Base docs directory: `docs/dev/`
- Living document: `docs/dev/PROJECT.md`
- Plans directory (read-only context only): `docs/dev/plans/`

If you change this base path, keep it identical to the path used by
`writing-plans-front`, `executing-plans-front`, and `sync-project-doc`.

## Two content sources, one document (the rule that prevents collisions)

`PROJECT.md` has two writers — this skill and `sync-project-doc` — but they never
collide, because the split is by **where the content comes from**, not by section:

- **Interview-origin content** — statements that cannot be read from code and were
  given by the human (why a module exists, which route matters, what is canonical vs
  tech debt, a confirmed-intentional fixture, product purpose/audience, known gaps).
  Only `project-baseline` writes these, and only through the Clarification gate.
  `sync-project-doc` has no interview and can never regenerate them, so it must never
  rewrite or delete them.
- **Code-readable content** — statements a reader could verify from the repo (the
  routing approach, the state approach, module boundaries as they physically are).
  `project-baseline` writes these on Create and re-scans them on Refine;
  `sync-project-doc` updates the affected parts after each feature.

### Marking
Mark a statement by ending its line/bullet/cell with the invisible marker `<!--i-->`.
It renders as nothing and means exactly one thing: **`sync-project-doc` does not
maintain this line — only `project-baseline` (Refine) does.** The test is not "who said
it" but "could `sync` keep this current by reading the code?":
- a fact `sync` can verify and update from the repo → **unmarked**, even if it reads
  like a design decision;
- human knowledge `sync` cannot regenerate (purpose, audience, why a module exists, a
  confirmed fixture, canonical vs tech debt) → **marked**;
- a normative rule (§9 Always/Never) → **marked**, whatever its source. Code shows what
  *is* done, not what *must* be done, so a rule is never "verifiable from code".

When in doubt about a rationale/purpose/classification, it is human-given — mark it.
When in doubt about a plain fact, leave it unmarked: over-marking silently locks `sync`
out of a fact it must be able to fix. A missed marker is a real defect.

```md
- Module boundaries: `features/` never imports from `pages/`.
- Why this boundary: keeps route code swappable; deliberate, not incidental. <!--i-->
- Rendering model: SPA (client-rendered, single entry).
```

The first bullet is a fact `sync` can maintain → unmarked. The second is a human-given
rationale → marked. The third is read from code → unmarked.

**One owner per line.** Never mix a `sync`-maintainable fact and human rationale in one
line or cell — the split works only if each line has exactly one owner. Keep the bare
fact unmarked and its "why" on its own marked line; otherwise `sync` is locked out of a
fact it must fix, and any change forces a choice between updating the fact and keeping
the rationale. Tables are the same at cell granularity: rationale lives in prose beside
the table, never inside an inventoried cell. A mixed line is a defect, same as a missed
marker.

Markers are added and removed **only by this skill** — `sync` never changes them.
Create adds them; Refine adds, keeps, or removes them as content changes hands.
Removing a marker is how a statement that has become verifiable from code is handed
back to `sync` to maintain going forward (see Refine step 7r) — this is what stops a
greenfield document, which starts almost fully marked, from ossifying once real code
lands.

## Modes

Detect the mode before doing anything else:

- **Create** — `docs/dev/PROJECT.md` does not exist. Build it from scratch.
- **Refine** — `docs/dev/PROJECT.md` already exists. Re-scan the code to correct drift
  across the whole document, re-confirm interview-origin content with the user, and
  re-check marker ownership (drop `<!--i-->` where `sync` can now maintain the statement
  from code, keep it where it cannot — see 7r). This is the drift-catcher: `sync` only nudges
  code-readable parts per feature, so Refine is where the document is periodically
  reconciled with reality end to end — and where a greenfield document, initially almost
  fully marked, is progressively handed back to `sync` as real code lands.

## Subagent roster

In Create + brownfield, the orchestrator (this skill) launches parallel
**read-only** subagents. Each owns a section cluster and reads only the files
relevant to it; the orchestrator then writes one document from their findings and
synthesizes §1 Overview from all of them. Subagents must not write files and must not
modify code.

| Subagent | Fills | Reads |
|----------|-------|-------|
| A — stack/conventions      | §2, §9      | package.json, lock file, tsconfig, build/lint/test/format configs, CONTRIBUTING / contribution docs |
| B — architecture           | §3          | folder tree, entry point, module boundaries, render model |
| C — routes                 | §4          | router config, page/screen files |
| D — components/design      | §5          | shared/primitive components, tokens, theme, styling setup |
| E — state/data             | §6          | stores, hooks, data-fetching/caching layer, context providers |
| F — backend integration    | §7          | API clients, fetch/request call sites, contract/type definitions |
| G — cross-cutting/gaps      | §8, §10     | auth/session, roles & permission checks, i18n, error boundaries, a11y, TODO/FIXME/HACK markers |

Scale to project size: on a small project, merge roles into 2–3 subagents; on a large
one, split F by backend domain. Number of subagents is recorded in `## Metadata`.

Each subagent reports **understanding, not a dump**: architectural decisions,
boundaries, and non-obvious connections for its cluster — not exhaustive lists of
everything it saw. A subagent that finds 30 dependencies reports the few that shape
the architecture; one that finds 27 shared components reports that the layer exists
and where, not the full roster. The orchestrator enforces the guiding principle when
writing: cut inventory that is trivially readable from code and stale-prone, keep
what aids understanding. But "not a dump" never means dropping the floor: each
subagent still returns, in full, the load-bearing facts in its cluster — external
services by name, intentional/security-relevant fixtures, roles, entry-point
provider/bootstrap wiring, Always/Never rule candidates. Terse everywhere else; complete
on the floor.

Subagent A owns §9, so one limit is on it specifically: it may collect Always/Never
candidates **only** from explicit markers (CONTRIBUTING, a config, a comment stating the
rule). A pattern it merely observed is not a rule — that goes to the gate as a question,
never into the document as a rule. Rule-stating comments live in code, i.e. in other
subagents' scopes: a subagent that meets one reports it to the orchestrator as a
candidate for §9 and does not write it itself. Scope stays intact; A does not read the
codebase.

## Process

### Step 0 — Detect mode and project type
1. Check whether `docs/dev/PROJECT.md` exists → set mode (Create / Refine).
2. In Create, detect project type. If the source tree is empty or contains only
   untouched scaffolding (fresh `create-vite`/CRA/Next starter, near-empty `src`,
   brand-new git history), treat it as a **possible greenfield** and confirm with the
   user before proceeding — do not silently guess. Otherwise proceed as brownfield.

### Create — brownfield
3. Plan the subagent fanout (roster above, scaled to size) and record the count.
4. Launch the read-only subagents in parallel. Give each its section cluster, the file
   scope it owns, the document shape, and the Language rule, so findings come back
   already mapped to sections and in the document's register.
5. Collect findings. Where a subagent flags an ambiguity it could not resolve from
   code, route it into the shared Clarification loop rather than guessing. **Run the
   Detection half of the registration step here too** (locate the init/context file,
   determine whether a pointer already exists): it must happen now, while the gate is
   still open, because the append after the write asks nothing. Route any question it
   raises into the gate with the rest.
6. **Run the mandatory Clarification gate now — before assembling the document:**
   collect every open question and every debatable classification, and ask the user in
   batches of at most four questions per turn (see the Clarification loop for the cap).
   Incorporate the answers; user answers override code inferences. Content that comes
   from these answers is interview-origin — mark it `<!--i-->`.
7. Assemble the document from the findings and the answers, and synthesize §1 Overview
   from evidenced facts (README, package description, code — unmarked) or from the
   user's answers (marked); never invent it. The findings are raw material, not text to
   paste: whatever language they came back in, the document is Russian prose per the
   Language rule — write it, do not stitch it. Mark statements per the Marking rule as
   you assemble. If assembly surfaces a question the gate did not cover, re-open the
   gate before writing — never invent purpose or audience.
8. Fill `## Metadata`. On Create, set `Last synced: n/a` — it is `sync-project-doc`'s
   field, stamped only when the first increment is folded in; this skill never moves it
   (on Refine, leave any existing `Last synced` value as `sync` last set it).
9. **Write the assembled document to `docs/dev/PROJECT.md` on disk now.** Do not write
   with open questions outstanding. Create the `docs/dev/` directory if it does not
   exist. Assembling the content in your response is NOT sufficient — the file must be
   created.
10. Register the project document in the always-on context (shared step below), then
    run Self-Review and hand off.

### Create — greenfield (optional)
3g. Do **not** launch the subagent fanout — there is no code to read. Run at most one
    orchestrator pass over whatever exists (e.g. scaffold `package.json`).
4g. Fill the document from stated intent: accept a provided intent/design document, or
    run a short section-guided intake (stack, intended architecture, planned routes,
    conventions). Phrase sections as intended/planned, not observed. Nearly everything
    here is human-given → mark it `<!--i-->`.
5g. Anything the user did not provide and that is not in code: mark `TBD`. Never
    fabricate. The document honestly reflects that much is undecided at start. **Run the
    Detection half of the registration step now**, while the gate is still open; any
    question it raises goes into the gate batch below.
6g. Fill `## Metadata` per the shape, including: `Last code re-scan: n/a` (there was no
    code to scan), `Generated by: project-baseline (greenfield)`, `Last synced: n/a`.
    **Run the
    mandatory Clarification gate** (open questions about intent/scope, plus the
    init-file question if it is open), then **write the document to
    `docs/dev/PROJECT.md` on disk now** (create `docs/dev/` if missing). Register the
    project document in the always-on context (shared step below), run Self-Review,
    then hand off.

### Refine
3r. Read the existing `PROJECT.md` in full. Note what is marked `<!--i-->` and reuse
    decisions already recorded there (e.g. a prior run noted certain credentials are
    intentional test fixtures — do not re-ask).
4r. Run the brownfield analysis (subagent fanout, scaled, briefed as in step 4 — scope,
    document shape, Language rule) to gather a current picture, targeting incomplete
    sections, `TBD`/`TODO` placeholders, and likely inaccuracies.
    **Run the Detection half of the registration step here** — a regenerated init file is
    exactly what this catches. Any question it raises must reach the Clarification gate
    in 9r while it is still open.
5r. Diff the new findings against the document. This mode is diff-aware: do not rewrite
    from scratch — that would discard the user's prior interview answers.
6r. Apply and list purely additive improvements only when the new content is a
    verifiable fact from code (or already user-confirmed). Filling a `TBD` or a missing
    subsection with an inferred value is NOT additive — route it through the
    Clarification gate. Additive improvements still obey the guiding principle: add
    understanding, not inventory — no dependency lists, versions, or full
    component/file enumerations.
7r. **Re-check marker ownership against the current code.** Walk the `<!--i-->`
    statements and decide, per statement:
    - still human-given (why a module exists, what is canonical, purpose, a confirmed
      fixture) or normative (§9) → **keep** the marker;
    - now something `sync` can maintain from code — e.g. a greenfield "intended" fact
      that is now real, or a rationale that has become self-evident in the structure →
      **remove** the marker so `sync` can maintain it going forward (confirm on any
      conflict per 8r).
    Conversely, if an unmarked (code-readable) statement has turned into a human
    judgment call, add a marker. This ownership re-scan is what keeps a greenfield
    document — which starts almost fully marked — from freezing: as real code lands,
    Refine hands those statements back to `sync`. Removing a marker is not a silent
    overwrite of the statement's content; it only changes who may maintain it. If the
    content itself also changes, that goes through the conflict gate in 8r.
    Same pass: split any inherited line that mixes a fact with its rationale — bare fact
    unmarked, rationale on its own marked line. That is a change of form, not content;
    if a split would change either meaning, treat it as a conflict (8r).
8r. **For any value that conflicts with what the document already states, always ask
    the user before writing — every conflict, no exceptions. Never silently
    overwrite.** Present the existing value and the proposed new value side by side.
    This applies with special force to marked (`<!--i-->`) statements whose *content*
    changes: those change only by re-asking the human, never by code inference.
    (Dropping a marker in 7r because a fact is now code-evident is a handover, not a
    content change — but if you are unsure whether the meaning shifted, treat it as a
    conflict and ask.)
9r. Update `## Metadata` for the fields this run actually changes: the re-scan
    date/commit, and `Generated by` if this run's fanout differs from what is recorded
    (mode / subagent count — a Refine of a greenfield document is where this matters
    most). Leave `Created` as it is, and leave `Last synced` as `sync` set it — that
    field is not yours to move. **Run the mandatory
    Clarification gate before writing** (this covers conflict confirmations from 8r plus
    any other open questions), then **write the updated document back to
    `docs/dev/PROJECT.md` on disk now** — edit the actual file, do not just show the diff.
    Then register the project document in the always-on context (shared step below),
    which restores the pointer if the init file lost it — the file and its pointer state
    are already known from 4r. Self-Review, then hand off.

### Clarification loop (shared, Create and Refine) — MANDATORY GATE
This is not optional and not purely reactive. Before writing the document to disk, you
MUST run an explicit clarification pass: collect every open ambiguity found during
analysis, batch the questions, and ask the user. Only proceed to the write step after
the user has answered (or explicitly declined). A run that writes the file without
having surfaced its open questions is incorrect. If after honest analysis there are
genuinely zero open questions, state that explicitly rather than skipping silently. If
the user declines or skips a question, mark the affected content `TBD` or omit it —
never fill it with the answer you would have guessed. That rule is about document
content: the init-file question has no field to mark, so `TBD` does not apply to it —
its outcomes are defined in the registration step (skip the append, report it). Everything
the user answers here is interview-origin — mark it `<!--i-->`.

When an ambiguity cannot be resolved from code, ask — do not guess and do not draw
alarming conclusions. The user's answers take priority over inferences from code.

You MAY ask about:
- intentional vs accidental (hardcoded credentials, mocks, feature flags,
  commented-out code)
- which pattern is canonical when the code shows several conflicting approaches
- purpose/intent not derivable from code (why a module exists, which route matters)
- classification of something debatable (deliberate decision vs tech debt)
- boundaries: what must not be touched, what is deprecated and ignored
- confirmation of a code-inventoried role/permission list: whether it is complete, which
  list is authoritative, and what each role may do. The names are in the code and are not
  what you are asking about — their meaning and completeness are not.
- which file the runner reads at session start, when the init/context file cannot be
  identified confidently (see the registration step)
- in Refine: conflict confirmations (8r), including a split whose wording would change
  a meaning (7r)

You must NOT ask about:
- anything readable directly from the code
- stylistic trivia
- operational details with an unambiguous default visible in the project

Never stretch "default" to cover intent, purpose, audience, canonical-pattern choice,
or any debatable classification — those are never assumed, always asked.

Batch questions with answer options where possible, but ask **at most 4 questions per
turn** — the interface accepts no more than that in one message. If more than four are
open, ask the four most important first, then continue in the next turn(s) until all
are covered. Never emit more than four in a single message, and never drop the
remaining questions to fit — carry them into follow-up turns. Do not fall back to
one-at-a-time.

### Register the project document in the always-on context (shared, Create and Refine) — MANDATORY
**This step runs in every mode.** On Refine it matters especially: the init/context file
may have been regenerated (e.g. by the runner's `init`) and lost the pointer; this step
restores it. There is no state gate — `PROJECT.md` always exists by the time it runs, so
the step always runs; whether it appends anything depends on the checks below.

The goal is to make the project document discoverable on **every** code task, including
tasks run without any skill ("add a filter to the orders screen"). The runner reads a
project init/context file at every session start (a `CLAUDE.md`-style file, e.g.
`GIGACODE.md` / `CLAUDE.md` / `AGENTS.md` at the repo root). Add a pointer to
`PROJECT.md` there.

The step has two halves that run at different times. This is the one place their rules
are defined; the modes above only point here.
- **Detection** — applied during the analysis phase (brownfield step 5, greenfield 5g,
  Refine 4r), early enough that any question it raises still fits in the Clarification
  gate.
- **Append** — runs after the document is written. It asks nothing: the gate has closed,
  so it only acts on what detection settled.

**Detection (during the analysis phase)**
- Locate the init/context file the runner loads at startup. Detect it, do not assume the
  name.
- If you cannot confidently identify it, or several candidates exist (e.g. both
  `CLAUDE.md` and `AGENTS.md`), **ask the user** which file the runner reads at session
  start — in the gate batch, never as a separate turn later, never by guessing. If one
  candidate already contains a `docs/dev/BUSINESS.md` pointer registered by
  `business-baseline`, that is the file the runner reads — use it and do not ask.
- Determine whether the pointer already exists. It exists if the file contains a
  `## Project Context` heading, or a passage that both names `docs/dev/PROJECT.md` and
  tells the reader to consult it before working on the code. A bare mention of the path
  is NOT a pointer (a docs index, a human's note, a link from another block): it
  instructs no one, so the pointer is still missing. If you cannot tell whether an
  existing mention counts, ask in the gate rather than risking a duplicate.

**Append (after the write)** — exactly one outcome, and it is the one reported in the
handoff:
- *Pointer already present* → leave it; do not add a second one. Report `already
  present`.
- *No init/context file exists at all* → skip. Report `no init file found`.
- *The file question went unanswered* (the user declined it, or an ambiguous mention was
  never clarified) → skip. There is no `TBD` for a pointer, and a guess would write into
  the wrong file. Report `not registered (init file not confirmed)`.
- *Otherwise* → append the block below at the end of the file. Append its content
  verbatim — as real markdown, starting with the `## Project Context` heading. It is a
  section of the init file, not a quotation: do not wrap it in a blockquote or a code
  fence, and do not reflow, translate, or reword it. Report `added to <file>`.

```md
## Project Context
How this project is built — stack, architecture, module boundaries, conventions — is
documented in `docs/dev/PROJECT.md`. Before writing or changing code, first read
`docs/dev/PROJECT.md` to understand the stack, the architecture and its module
boundaries, and which patterns are canonical here; follow them instead of introducing
new ones. Its §9 Always/Never rules are binding: if a task seems to require breaking one,
ask — do not break it silently, and do not silently follow a rule that no longer fits.
`PROJECT.md` is machine-written — do not hand-edit it. If something you need is not
covered there, ask.
```

The block is fully English regardless of the document's language: it is an instruction
to the runner, not part of `PROJECT.md`. A `Business Context` block registered by
`business-baseline` may already be present; the two pointers coexist — leave that block
untouched, do not merge, reorder, or rewrite it.

### Secrets handling (shared)
When the analysis surfaces secrets or credentials:
- Do not copy secret values into the document. Record the fact neutrally and by
  location only — e.g. "test credentials present in `<file>`, confirmed intentional by
  the user." Because that is a user-confirmed judgement, the line carries `<!--i-->` in
  the document.
- Do not raise a false alarm. Ask whether they are intentional (Clarification loop)
  rather than labeling them a leak.
- Credentials the user confirms are intentional test fixtures do NOT go into §10 Known
  Gaps. Only genuine, user-confirmed concerns go there.

## Document shape

`PROJECT.md` is one flat document. Statements `sync` must not maintain carry `<!--i-->`.

```md
# <Project Name> — Project Document

> Living technical source of truth for developers. Machine-written (not hand-edited).
> Statements marked <!--i--> are maintained only by project-baseline (Refine) — human
> knowledge and normative rules; everything else is read from code and kept current by
> sync-project-doc. Documents understanding, not inventory.

## Metadata
- Created: <YYYY-MM-DD — today's real local date from the current environment, not a placeholder>
- Repository: <path / url>
- Last code re-scan: <YYYY-MM-DD @ commit sha — set on Create and each Refine by this skill; "n/a" on a greenfield run, which has no code to scan>
- Last synced: <YYYY-MM-DD — set by sync-project-doc when it last folded an increment in; "n/a" until first sync>
- Generated by: project-baseline (+ <N> subagents | greenfield)

## 1. Overview
<2–4 sentences: what this frontend app is, for whom, its core purpose. Purpose and
audience are almost always human-given — mark them <!--i-->. Never invent them.>

## 2. Stack & Tooling
<Key stack decisions, not a dump of package.json. The load-bearing choices a reader
must know, each in a few words, WITHOUT version numbers or config settings.>
- Framework / language: <the choice, not the version>
- Build / bundler: <name it, don't paste config>
- Styling:
- State approach:
- Testing / lint: <tools by name only>
- Notable libraries: <only the few that SHAPE the architecture, each with what it is
  FOR. No full dependency list, no versions.>
- Scripts & Env: <real dev/build/test commands; required env vars>

## 3. Architecture & Structure
- Entry point:
- Top-level folder layout:
- Module boundaries / layering: <the boundaries as they are, read from code>
- Why these boundaries / what they protect: <only if the user explained it; on its own
  line, not folded into the boundary fact above <!--i-->>
- Rendering model (SPA / SSR / SSG):

## 4. Routes & Screens
<State the routing approach and where it is defined; point to the router config rather
than mirroring every route. Add a small table ONLY for the few routes that carry
architectural weight — the table holds code-readable facts only. A route's "why it
matters" note is human-given: keep it in prose beside the table, on its own line marked
<!--i-->, never folded into a cell (see Marking).>

## 5. Component & Design System
- Design tokens / theme: <where they live and the few load-bearing facts — not every token>
- Shared / primitive components: <that a reusable layer exists and where; if the project
  keeps a DESIGN.md, point to its component registry rather than enumerating; otherwise
  just name where the layer lives>
- Composition patterns:
- Styling conventions:

## 6. State & Data Flow
- Client / UI state:
- Server state / data fetching:
- Caching / invalidation:
- Global stores / context:

## 7. Backend Integration (frontend view)
<The integration approach and where clients live; a small table only for the few
contracts that shape the frontend. Do not mirror every endpoint.>

## 8. Cross-Cutting Concerns
- Auth & session:
- Roles & permissions: <the roles as the code shows them (an enum, a guard, a route
  check) — inventoried from code, unmarked, so `sync` keeps them current. Omit the whole
  pair if the project has no roles.>
- What the roles mean: <what each role may do, plus any role the code does not show
  (e.g. a check that lives on the backend) — user-confirmed, on its own line <!--i-->.
  `TBD` if the user did not confirm; never inferred from the code. Whether the code list
  is complete is asked in the gate but never written here as a statement: it is a claim
  about the code, it goes stale, and the marker would lock `sync` out of fixing it.>
- i18n / localization:
- Error handling:
- Accessibility:
- Performance:

<Describe each cross-cutting fact ONCE, with its context inline. If something is a
confirmed-intentional fixture (e.g. a hardcoded dev JWT), say so right here where you
describe it and mark it <!--i-->; do not split a scary neutral mention here from a
reassurance in §10.>

## 9. Conventions & Patterns
- Naming:
- File / folder conventions:
<Naming and folder conventions above are descriptive — how things are done here. The two
lists below are normative: a runner obeys them. Keep preferences out of them.>
- **Always:** <what must be done in every task here: the canonical pattern when several
  exist, and mandatory steps a newcomer would otherwise miss (e.g. a build flag that must
  be toggled). Only hard rules — breaking one breaks something real. One rule per line,
  imperative. Every rule carries <!--i-->; Refine is the only writer.>
- **Never:** <hard prohibitions that no linter would catch, each with what it breaks. One
  rule per line, imperative, every rule <!--i--> — exactly as Always.>

## 10. Known Gaps & Tech Debt
<honest snapshot: unfinished areas, fragile spots, real TODOs. Only verifiable facts
(an explicit TODO/FIXME in code) or items the user confirmed via the Clarification gate
belong here; user-confirmed items carry <!--i-->. Do NOT record your own guesses or
classifications as gaps. Excludes anything the user confirmed intentional.>
```

## Rules

- Document understanding, not inventory. No full dependency lists, no version numbers,
  no exhaustive component/file enumerations; use one-line pointers (package.json, the
  code tree, or DESIGN.md when the project keeps one) for readable-but-bulky facts. Keep it short enough to read for
  onboarding.
- Write the document in Russian prose; keep technical terms in English and never Russify
  them — the reader must see the same word that appears in the code. English too, though
  not as terms: section headings and field labels from the document shape, the `<!--i-->`
  marker and `## Metadata` field names, and the init-file pointer block. Subagent findings
  are raw material, not document text: write the document yourself, in Russian, whatever
  language they came back in. Do not leave the language to the run — pin it, matching
  DESIGN.md.
- Mark per the Marking rule: `<!--i-->` means `sync` does not maintain the line. That
  marker is what protects human knowledge and normative rules from being overwritten by
  `sync`. A missed marker is a defect.
- §9 Always/Never is normative: a runner obeys it, so it holds hard rules only —
  breaking one breaks something real (a request bypasses retries, a build fails, data is
  corrupted). Preferences and taste stay descriptive, in Naming and File / folder
  conventions. Only two sources qualify: the user via the Clarification gate, or an
  explicit marker in the repo (CONTRIBUTING, a config, a comment stating the rule). Never
  derive a rule from observation — "no inline styles anywhere in the code" is not "never
  use inline styles"; that is an invented law, and it is worse than an empty list. Skip
  anything already enforced by lint/TS/CI: the tool catches it, and this list is for what
  no tool catches. Cap each list at 5–8 lines. Every line here is marked `<!--i-->` (a
  rule is never code-verifiable — see Marking). Sourcing governs what may become a rule,
  not whether it is marked.
- An §9 rule that turned out wrong — the user says it no longer holds, or the code has
  moved past it — is a conflict for Refine (8r), never something to quietly drop or
  rewrite. The half of this addressed to the task runner is not here: it lives in the
  pointer block, which is the text a runner reads first, before it opens the document.
- One owner per line: never mix a `sync`-maintainable fact and a human rationale in one
  line or table cell (see Marking). On Refine, split inherited mixed lines (7r). A mixed
  line is a defect.
- This skill writes at most two files: `docs/dev/PROJECT.md` (always), and a one-block
  pointer to `PROJECT.md` appended to the project's init/context file (unless the
  pointer is already there or no init file exists). Nothing else in the repo is
  modified. Whatever is written must persist to disk; content in the reply alone does
  not count. Create `docs/dev/` if needed.
- Register a pointer to `PROJECT.md` in the runner's init/context file per the
  registration step — in all modes, detection during analysis (so its question fits the
  gate), append after the write. Never guess the file; never duplicate an existing
  pointer; leave any `business-baseline` block untouched.
- `PROJECT.md` is machine-written. This skill and `sync-project-doc` are its only
  writers; it is not hand-edited.
- Analysis is read-only inspection of files (and git metadata) only. Neither the
  orchestrator nor any subagent may install dependencies, run build/dev/test/lint
  scripts, execute project code, or perform any state-mutating shell command. Subagents
  never write files or change code.
- User answers override code inferences. A stated fact is recorded as fact.
- The Clarification gate is mandatory, not reactive. If there are truly no open
  questions, say so rather than skipping silently.
- Never record a guess, suspicion, or your own classification as a Known Gap. Anything
  debatable is confirmed via the gate first; if unconfirmed, leave it out.
- Ask only within the allow-list (plus conflict confirmations in Refine, 8r); batch
  questions with options, at most four per turn.
- Never copy secret values into the document; record location and confirmed intent
  only. Never flag user-confirmed test fixtures as a leak or a gap.
- Greenfield disables the subagent fanout; fill from intent and mark unknowns `TBD`.
  Never fabricate.
- In Refine, never rewrite from scratch and never silently overwrite. Every conflict is
  confirmed with the user first; marked statements change only by re-asking.
- Reuse decisions already recorded; do not re-ask settled questions on a re-run.
- Do not run git write operations; reading the current commit sha for Metadata is fine.
- Do not write production code under any mode.

## Self-Review

Before reporting done, confirm:
1. The file exists on disk at `docs/dev/PROJECT.md` with the written content — not just
   assembled in the reply.
1a. Language: the document is Russian prose with technical terms kept in English, not
   Russified; section headings, field labels, `<!--i-->` markers and `## Metadata` field
   names untranslated; the init-file pointer block fully English. The whole document is
   one consistent language — not English prose pasted from subagent findings, and not a
   mix drifting per section.
2. Every statement `sync` cannot maintain (purpose, audience, why-a-module-exists,
   canonical choice, confirmed fixture, known gaps, every §9 rule) carries `<!--i-->`;
   nothing is left unmarked that `sync` would then overwrite — and, conversely, nothing
   `sync` could maintain is marked: each `<!--i-->` passed the filter "`sync` could NOT
   maintain this from code" (§9 rules always fail that filter and are always marked).
   Architectural/structural facts and wiring are left unmarked so `sync` can maintain
   them.
2a. One owner per line: no line/cell mixes a `sync`-maintainable fact with human
   rationale; in Refine, inherited mixed lines were split (7r).
3. Every section is filled from evidence or user input, or honestly marked `TBD` — no
   fabricated content, no invented purpose/audience/classification.
4. The document explains understanding, not inventory. Binary checks: (a) the
   component/design section does NOT list shared components by name — it states the
   layer exists and where (pointing to the DESIGN.md registry if the project keeps one); (b) the stack section contains NO
   version numbers anywhere; (c) no exhaustive dependency or file enumeration. Bulky
   readable facts are replaced with pointers; any confirmed-intentional fixture is
   described once with its status inline.
4a. The floor survived summarization: external services/integrations are named,
   intentional/security-relevant fixtures are recorded (by location + intent, marked
   `<!--i-->`), the roles the code shows are captured in §8 with their meaning either
   user-confirmed on its own `<!--i-->` line or left `TBD` (never inferred), the
   entry-point provider/bootstrap wiring is described (not just "renders the app"), and
   §9 Always/Never captures any user-confirmed or marker-backed mandatory steps and hard
   prohibitions — empty is a valid answer, and no rule was inferred from observation.
5. The Clarification gate ran: open questions were surfaced before the write (or it was
   stated there were none); declined document questions became `TBD`, not guesses (the
   init-file question is not one of them — its outcome is item 10).
6. §10 Known Gaps contains only verifiable facts or user-confirmed items.
7. `## Metadata` reflects this run for the fields this skill owns: `Created` (real
   date, set once on Create), `Last code re-scan` (this run's date/commit — `n/a` on
   greenfield), and `Generated by` (this run's mode / subagent count, updated on Refine
   if the fanout differs). `Last synced` was not touched (`n/a` on Create only).
8. In Refine: prior marked content reused and re-confirmed on conflict; nothing silently
   overwritten; marker ownership was re-checked — `<!--i-->` was removed from statements
   `sync` can now maintain from code and kept on statements still human-given or
   normative, so a formerly greenfield document is not left frozen; and Detection ran in
   4r, so a pointer lost to a regenerated init file was restored.
9. No production code or non-PROJECT.md file was modified — except the single pointer
   block appended to the init/context file — no dependencies installed, no build/test
   scripts or state-changing commands run, and no git writes performed.
10. A pointer to `PROJECT.md` was added to the runner's init/context file as real
   markdown (not blockquoted or fenced), or was already present and left alone, or was
   not registered — no init file existed, or the file question went unanswered — and the
   user was told. The file was detected during analysis and any doubt — which file, or
   whether an existing mention is a pointer — went through the gate, not a guess. Any
   existing `Business Context` block was left untouched.

## Handoff

Report concisely:

> "PROJECT.md <created | refined> in `docs/dev/` (<mode>, <N> subagents | greenfield)."
> "Sections filled: <list>. Marked items: <count>. Marked TBD: <list or none>."
> "Open clarifications resolved: <count>."
> "Project-document pointer: <added to `<init file>` | already present | not registered (init file not confirmed) | no init file found>."

If anything remains `TBD`, add:

> "Still TBD and worth a follow-up: <list>."