---
name: business-baseline
description: Use to produce or improve docs/dev/BUSINESS.md — the project's living business document, written for an analyst / product owner / non-developer. It answers WHAT THE PROJECT DOES: the stable core (product, domain, users and roles, key business entities), the capabilities (what the product can do today, inventoried from the code), and the business scenarios (how those capabilities are used — from the user, never reconstructed from code). The core and scenarios come from a short interview grounded in the inventoried capabilities. Trigger when the user wants to create, bootstrap, or refresh a BUSINESS.md / business baseline. For the technical "what it is built from", use project-baseline (PROJECT.md).
---

# Business Baseline

## What this skill is (and is not)

`PROJECT.md` tells a developer what the system is built from (architecture, stack,
structure). `BUSINESS.md` tells an analyst / product owner / non-developer **what
the project does** — in business language, with no technical detail.

This skill establishes that document. It is a documentation task: it inventories the
**capabilities** from the code and asks for the business meaning and **scenarios**
that code cannot reveal. It does not invent product purpose. It writes `BUSINESS.md`,
and it also registers a one-block pointer to `BUSINESS.md` in the project's init/context
file (Step 4) so product tasks find it even without a skill. It touches nothing else.

**BUSINESS.md is an optional loop participant.** Creating it is independent of the rest of
the pipeline — you can establish `BUSINESS.md` with no `PROJECT.md` and no plans. But once
it exists, `sync-project-doc` keeps its `## Capabilities` section current after each
feature; nothing else in `BUSINESS.md` is loop-maintained. So: standalone to *create*,
in-loop to *maintain (Capabilities only)*.

Two registers, never mixed: this document speaks the user's/analyst's language
("the map groups nearby points when zoomed out"), never the developer's ("a
clustering layer via canvas"). Technical phrasing belongs in `PROJECT.md`.

## Language

**Write the BUSINESS.md document in Russian prose.** It is deliberately non-technical,
so it is almost entirely plain Russian business prose; keep in English (verbatim) only
the unavoidable proper nouns or code-level names that must appear as-is — a system
name, a product/module name, an entity's code identifier if one is genuinely needed.
Never invent English where Russian reads naturally. The document-shape section headings
(`## Product`, `## Users & Roles`, `## Capabilities`, …) stay as the English anchors
shown in the shape. The one full exception is the Step 4 init-file pointer block, which
stays fully English because it is an instruction to the runner, not part of BUSINESS.md.
This keeps BUSINESS.md in the same register as PROJECT.md and DESIGN.md; do not leave the
language to the run — pin it.

## Paths

Base docs directory: `docs/dev/`
- Living business document: `docs/dev/BUSINESS.md` (beside `PROJECT.md` if that exists).

Keep this base path identical to the rest of the pipeline.

## Modes

- **Create** — `docs/dev/BUSINESS.md` does not exist. Build it from scratch.
- **Refine** — it already exists. Improve it: fill gaps, correct drift, add
  capabilities shipped since. Confirm every conflict with the user before
  overwriting; do not rewrite from scratch.

The document has parts of different natures, and the skill must respect them:
- **Core** (product, domain, users, entities) — stable, changes rarely.
- **Capabilities** (what the product can do) — living, grows with every feature; kept
  current by `sync-project-doc`.
- **Business scenarios** (how capabilities are used) — semi-stable, from the user;
  change less often and are updated by the user, not auto-derived.

## Process

### Step 0 — Mode
1. Check whether `docs/dev/BUSINESS.md` exists → Create or Refine.

### Step 1 — Inventory capabilities (from the code)
2. Inventory what the product can do today by reading the code at a behavioral
   level: screens/flows the user can reach, actions they can take, user-facing
   capabilities. Express each as a capability in plain language ("user can filter
   orders by status"), not as components or routes. Capabilities are the one thing
   you read from the code — they are physically present (a screen, a button, a
   form) and safe to inventory.
3. **Do not reconstruct business scenarios from the code.** What a capability is
   *for* — which business process it serves, who uses it when and why, how
   capabilities chain into a flow — is NOT in the code. The component tree shows a
   form with a submit button; it does not show "a manager filters overdue orders
   each morning to call clients." Inventory the capabilities; leave the scenarios to
   Step 2. Guessing scenarios from the tree is invention, not documentation.
4. Identify the key business entities as they appear in the domain (e.g. "order",
   "limit", "client"). What each *means* to the business is confirmed in Step 2, not
   guessed here.
4a. **Run the Detection half of Step 4 here** (locate the init/context file, determine
   whether a pointer already exists): it must happen now, while the clarification pass is
   still open, because the append in Step 4 asks nothing. Any question it raises goes
   into the Step 2 batch.

### Step 2 — Capture the core and scenarios (mandatory clarification gate; ask, do not infer)
5. **Run a mandatory clarification pass before writing.** The core and the business
   scenarios cannot be read from code and must come from the user. Come prepared:
   use the capabilities inventoried in Step 1 as the basis for grounded questions —
   not to guess scenarios, but to ask better ("I found these capabilities: filter
   orders, export, flag for follow-up — what business scenario do these serve, and
   who does it?"). Ask, batched with options where possible — but at most 4 questions per
   turn (the interface accepts no more than that in one message); if more are open, ask the
   four most important first and continue in the next turn(s):
   - What is the product and what problem does it solve?
   - Who are the users, and what roles do they have?
   - **For the inventoried capabilities — what business scenarios/flows do they serve
     (who does what, when, why)?** Drive these questions from the capability list.
   - What do the key business entities mean in the business (confirm/correct the ones
     from Step 1)?
   - What is in scope vs explicitly out of scope?
   - Which file the runner reads at session start, if Step 1 could not identify it
     confidently (see Step 4).
   Code shows what was built, not why, for whom, or in what scenario — never infer
   purpose, audience, entity meaning, or scenarios. If the user declines a question,
   mark that field `TBD`, not a guess. That applies to the document's fields: the
   init-file question has no field to mark, so `TBD` does not apply to it — its outcomes
   are defined in Step 4 (skip the append, report it).

### Step 3 — Write
6. Assemble the document and **write it to `docs/dev/BUSINESS.md` on disk now**
   (create `docs/dev/` if missing). Content only in the reply does not count — the
   file must be created. On Create, set `Last synced: n/a` in `## Metadata` — it is
   `sync-project-doc`'s field, stamped only when it first updates Capabilities; this
   skill never moves it (on Refine, leave any existing value as `sync` last set it).

### Step 4 — Register the business document in the always-on context
7. **This step runs in both Create and Refine** (Refine restores a pointer lost to a
   regenerated init file). There is no state gate — `BUSINESS.md` always exists after
   Step 3, so the step always runs; whether it appends anything depends on the checks.

   The full shared procedure is the same one `project-baseline` uses — see
   [`project-baseline/references/register-pointer.md`](../project-baseline/references/register-pointer.md).
   The business-specific essentials, kept here so this skill is self-contained:

   **Detection (during Step 1)** — locate the init/context file the runner loads at
   startup (`CLAUDE.md`-style: `GIGACODE.md` / `CLAUDE.md` / `AGENTS.md`); detect it, do
   not assume the name. If unsure or several candidates exist, **ask in the Step 2 batch**
   — unless one candidate already holds a `## Project Context` pointer registered by
   `project-baseline`, which identifies the runner's file (use it, do not ask). A pointer
   already exists if the file has a `## Business Context` heading, or a passage that both
   names `docs/dev/BUSINESS.md` and tells the reader to consult it. A bare mention of the
   path is NOT a pointer.

   **Append (after the write)** — exactly one outcome, reported in the handoff:
   - *Pointer already present* → leave it. Report `already present`.
   - *No init/context file* → skip. Report `no init file found`.
   - *File question unanswered* → skip (no `TBD` for a pointer; a guess writes the wrong
     file). Report `not registered (init file not confirmed)`.
   - *Otherwise* → append the block below verbatim at the end of the file, as real
     markdown starting with the `## Business Context` heading — not blockquoted, not
     fenced, not reworded. Report `added to <file>`. Leave any `## Project Context` block
     untouched; the two coexist.

     ```md
     ## Business Context
     What the product does, who uses it, and what its capabilities mean is documented in
     `docs/dev/BUSINESS.md`. Before adding or changing product behavior, features, or
     user-facing flows, first read `docs/dev/BUSINESS.md` to understand the product, its
     users and roles, and the business meaning of the entities involved; do not invent
     product purpose or scenarios. If something you need is not covered there, ask.
     ```
8. Run Self-Review, then hand off.

### Refine specifics
- Read the existing `BUSINESS.md` first and reuse decisions already recorded (do not
  re-ask settled core questions).
- Apply purely additive improvements (a newly shipped capability, a filled `TBD`)
  and list them.
- For any value that conflicts with what the document already states, ask the user
  before overwriting — every conflict, no silent rewrite. If a capability recorded
  before no longer exists in the code, treat its removal as a conflict too: confirm
  before deleting.
- Run Step 4 as well: it restores the `BUSINESS.md` pointer if the init file lost it.
- Leave `Last synced` in `## Metadata` as `sync-project-doc` last set it. But if the
  document predates this convention and has no `Last synced` line, add `Last synced: n/a`
  so the doc matches its shape; do not backfill a real date, only `n/a`.

## Document shape

```md
# <Project> — Business Document

> Living business source of truth, for analysts / product / non-developers. Answers
> WHAT THE PROJECT DOES. Core is stable; Capabilities are living and kept current by
> sync-project-doc; Business Scenarios come from the user. No technical detail — that
> is PROJECT.md.

## Metadata
- Created: <YYYY-MM-DD — use today's real local date, not a placeholder>
- Audience: analyst / product / non-developer
- Last code re-scan: <YYYY-MM-DD @ commit sha — set by this skill on Create and each Refine; "n/a" if not a git repo>
- Last synced: <YYYY-MM-DD — set by sync-project-doc when it last updated Capabilities; "n/a" until first sync>

## Product
<What the product is and the problem it solves, in 2–4 plain sentences.>

## Users & Roles
<Who uses it and the roles they have, with what each role can broadly do.>

## Business Entities
<The key domain concepts and what each MEANS to the business — not the data model.>
| Entity | What it means to the business |
|--------|-------------------------------|

## Capabilities
<What the product can do today, as user-facing capabilities in plain language —
inventoried from the code. This is the living part — kept current by
sync-project-doc after each feature. Every row corresponds to something actually
present: a screen, a route, a button, a form (for rows sync adds later — a shipped
plan's stated outcome). A capability you cannot point at is invented; leave it out.>
| Capability | For which user/role | Notes |
|------------|---------------------|-------|

## Business Scenarios
<How the capabilities are used in the business — who does what, when, why; flows
that chain capabilities. From the user, NOT reconstructed from code. A row exists only
if the user described that scenario: put a verbatim fragment of their words in `Purpose`.
Nothing to quote → no rows at all, and the only allowed row is `| TBD | TBD | TBD | TBD |`.
A plausible scenario assembled from screens is invention, and an analyst cannot tell it
from a real one.>
| Scenario | Role | Capabilities involved | Purpose |
|----------|------|-----------------------|---------|

## Scope
- In scope:
- Explicitly out of scope:
```

## Rules

- This skill writes at most two files: `docs/dev/BUSINESS.md` (always), and a one-block
  pointer to `BUSINESS.md` appended to the project's init/context file (unless the
  pointer is already there or no init file exists). Nothing else in the repo is
  modified. Whatever is written must persist to disk. Create `docs/dev/` if needed.
- Register a pointer to `BUSINESS.md` per Step 4 (shared procedure:
  `project-baseline/references/register-pointer.md`) — detect the file during Step 1 (so
  any question fits the Step 2 gate), append after the write. Don't duplicate an existing
  pointer; if no init file exists or the file question is unanswered, skip and say so —
  never guess. Runs in both Create and Refine. Leave any `project-baseline` pointer block
  untouched.
- Write the document in Russian prose (it is non-technical, so almost entirely plain
  Russian); keep in English only unavoidable proper nouns / code-level names. Section
  headings stay as the English anchors from the document shape. The Step 4 init-file
  pointer block is the one fully-English exception. Do not leave the language to the run —
  pin it, matching PROJECT.md and DESIGN.md.
- Business meaning (purpose, audience, entity meaning, scope, scenarios) cannot be
  inferred from code. Ask via the mandatory clarification gate; declined questions
  become `TBD`, never guesses. Batch questions with options, at most four per turn.
- Capabilities are the only part read from code, and only at a behavioral level —
  capabilities, not components/routes. Business scenarios are NEVER reconstructed
  from the code; they come from the user, grounded in the inventoried capabilities.
  Never describe implementation here.
- Keep the business register throughout: plain user/analyst language, no technical
  terms. Technical phrasing belongs in `PROJECT.md`, not here.
- Do not run build/test commands or perform git write operations. Reading files and
  the commit sha is fine.
- Stay project-agnostic in your own logic; project-specific facts live in the
  document, not in this skill.
- In Refine, never rewrite from scratch and never silently overwrite; confirm every
  conflict — including removals of capabilities no longer present — with the user.

## Self-Review

Before reporting done, confirm:
1. `docs/dev/BUSINESS.md` exists on disk with the written content.
1a. Language: the document is Russian prose (English only for unavoidable proper
   nouns / code-level names); section headings untranslated; the
   Step 4 init-file pointer block is fully English. One consistent language, no drift.
2. The mandatory clarification gate ran: the core (product, users, entity meaning,
   scope) AND the business scenarios came from the user, not inference; declined
   items are `TBD`.
3. Capabilities describe user-facing actions in plain language, and every row corresponds
   to something actually present in the code — nothing was added that you cannot point at.
   Scenarios were NOT reconstructed from the code: each row carries a verbatim fragment of
   the user's words, or the section holds `TBD` only.
4. The whole document stays in the business register — no developer language leaked
   in.
5. `## Metadata` reflects this run for the fields this skill owns (real date, commit).
   `Last synced` is `sync-project-doc`'s field — `n/a` on Create, and left as `sync` set
   it on Refine; this skill did not move it.
6. No build/test run or git write was performed.
7. A pointer to `BUSINESS.md` was added to the runner's init/context file as real
   markdown (not blockquoted or fenced), or was already present and left alone, or was
   not registered — no init file existed, or the file question went unanswered — and the
   user was told. The file was detected in Step 1 and any doubt went through the Step 2
   gate, not a guess. Any existing `Project Context` block was left untouched.
8. In Refine: prior core reused; every conflict, including removals, was
   user-confirmed; nothing silently overwritten; Detection ran in Step 1, so a pointer
   lost to a regenerated init file was restored.

## Handoff

Report concisely:

> "BUSINESS.md <created | refined> in `docs/dev/`."
> "Core captured: <product/users/entities/scope — filled or TBD>. Capabilities: <N inventoried>. Scenarios: <N captured, or TBD>."
> "Business-document pointer: <added to `<init file>` | already present | not registered (init file not confirmed) | no init file found>."

If anything is `TBD`, add:

> "Still TBD and worth a follow-up: <list>."
