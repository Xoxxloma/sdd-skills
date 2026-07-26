---
name: design-baseline
description: Use to produce or improve docs/dev/DESIGN.md — the project's living design source of truth for frontend work. It detects the project's design system of record — a UI library, a project token system (Tailwind/CSS variables), or neither — and maps how typography, color, spacing, components, and conventions come from that system (not from the agent's taste), plus the human-supplied design context (audience, tone, brand). When no system exists, it points to generate-theme instead of inventing one. Trigger when the user wants to create, bootstrap, or refresh a DESIGN.md / design baseline for a frontend project, whether it uses a component library, its own tokens, or neither.
---

# Design Baseline

## Goal

Produce `docs/dev/DESIGN.md`: the living design document for this project. Its job
is not to bring design taste from outside — most projects here sit on an existing
UI library (MUI, Ant, an internal design system) or a project token system
(Tailwind/CSS variables), and that system is the source of truth for typography,
color, spacing, and components. DESIGN.md captures *which* system, *how* the project
uses and customizes it, and the project design context that cannot be read from code
(audience, tone, brand). When no system exists at all, this skill does not invent
one — it points to `generate-theme`. `polish-frontend` then reads this document to
bring markup in line with the system instead of improvising.

This skill never writes production code. Its deliverable is `DESIGN.md`; it also adds a
one-block pointer to `DESIGN.md` in the project's init/context file (Step 4) and touches
nothing else.

**Language: write the DESIGN.md document in Russian prose, but keep all technical terms
in English — do not translate them.** Russian for descriptions, explanations, and
captured context; English (verbatim, untranslated) for: CSS/design properties
(`spacing`, `gap`, `margin`, `padding`, `border`, `radius`, `shadow`, `elevation`,
`typography`, etc.), token and theme-variant names, component names, file paths, and
library terms. Never Russify a technical term (not `отступ` for `margin`, not `тень` for
`shadow`) — the reader must see the same word that appears in the code/theme. Headings
may stay as the English anchors shown in the document shape. The one exception to the
Russian-prose rule is the pointer block written into the init/context file in Step 4 —
that whole block stays in English, because it is an instruction to the runner, not part
of DESIGN.md.

This is a documentation task, not a redesign. You map what already exists and ask
for what code cannot tell you. You do not invent token scales, type ramps, or color
systems — those belong to the system of record (the library or the project tokens),
and when no system exists you point to `generate-theme` rather than inventing one.

## Paths

Base docs directory: `docs/dev/`
- Living design document: `docs/dev/DESIGN.md` (beside `PROJECT.md` if that exists;
  DESIGN.md is independent and does not require the rest of the pipeline)

Keep this base path identical to the one used by `polish-frontend` and the rest of
the pipeline. If you change it, change it in both skills.

## Modes

- **Create** — `docs/dev/DESIGN.md` does not exist. Build it from scratch.
- **Refine** — it already exists. Improve it: fill gaps, correct drift, add newly
  adopted system features (library or token). Confirm every conflict with the user
  before overwriting (see Refine rules). Do not rewrite from scratch.

## Process

### Step 0 — Detect mode, then classify the source of truth
1. Check whether `docs/dev/DESIGN.md` exists → Create or Refine.
2. Detect the design system of record, in this order:
   - A UI library in `package.json` + component imports (e.g. `@mui/material`,
     `antd`, an internal `@company/ui`), its major version (read from
     `package.json`; if it is a range or not pinned there, record the range or
     `unknown` — do not crawl the lock file or node_modules to resolve it), and
     where its theme lives.
   - A project token system: theme file, design-token module, CSS custom
     properties, Tailwind config/preset with custom values.
3. Classify into one of four states and confirm with the user before writing — never
   assume:

   - **A. Library with a project theme/tokens** → source of truth = that theme.
     Confirm: "I see MUI 5 themed in `src/theme.ts` — is that the system of record?"
     Document it (the main case).
   - **B. Library on bare defaults (no project theme/tokens)** → source of truth =
     the library's default theme. Document it as "library defaults, no project
     customization." Do not invent custom tokens. (If the user actually wants to
     start project tokens, that is creation, not documentation — point them to
     `generate-theme`, then this skill documents the result afterward.)
   - **C. No library, but a project token system exists** (Tailwind/CSS-vars/theme
     file) → source of truth = those project tokens. Extract and document them
     exactly as you would a library.
   - **D. Neither a library nor any token system** → there is nothing to fix as the
     source of truth. Do NOT invent one and do NOT write design-domain values.
     Tell the user plainly: "No UI library and no token system found — create a
     theme first with `generate-theme`, then run design-baseline to document it."
     You may still record Metadata, the components actually used in the project (if
     any), and the design context, with the design domains left as `TBD — no token
     system yet (see generate-theme)`.

   If several libraries appear, ask which is canonical and which are legacy.

   **State confirmation is the first of two mandatory gates.** Do not proceed to
   Step 1 or write anything until the user has confirmed which state (A–D) applies
   and what the system of record is. Never treat the classification as self-evident
   and skip the confirmation — the entire document's source of truth depends on it.
   State the detected state and ask the user to confirm or correct it. This gate is
   separate from the design-context gate in Step 2; passing this one does NOT satisfy
   that one. Both must run.

### Step 1 — Map the system of record (the core of DESIGN.md)
4. In states A, B, and C, record how each design domain is sourced from the
   confirmed system of record (library theme, library defaults, or project tokens)
   — as references to it, never as your own values. In state D, skip this step and
   leave the domains as `TBD` per Step 0. The domains:
   - Typography: where type styles/variants come from (theme variants / token
     names), not a font ramp you made up.
   - Color: the palette / token names, not hex values you picked.
   - Spacing: the system's spacing function/scale (e.g. 8px step via the theme),
     not a scale you invented.
   - Components: which library/system components are in use, and the project's
     wrappers around them. Critically, build the **component registry** (see below):
     the project's shared components that REPLACE a library/default for a given need
     (e.g. number input → `NumberInput`, not the library's text field). This is the
     map any consumer can consult to prefer a project component over a library one.
   - Customization: how the project overrides or extends the system (theme
     overrides, token
     files, styled wrappers, Tailwind preset).
   - Local conventions layered on top (naming, file layout, how new UI is composed).
5. Where the project hardcodes values that the system of record already provides
   (ad-hoc hex instead of a palette token, magic spacing instead of the scale),
   note it as drift in `## Known Drift`, but do not "fix" it here — that is
   `polish-frontend`'s job. "The system" means whichever applies: library theme,
   library defaults, or project tokens. In state B, drift is values that bypass the
   library's default theme. In state C, drift is hardcoded values that bypass the
   project's own tokens/CSS variables. In state D there is no system to drift from,
   so this is `N/A`.

### Step 2 — Capture design context (second mandatory gate; ask, do not infer)
6. **Run a mandatory clarification pass before writing — this is a separate gate
   from the Step 0 state confirmation, and it always runs even after state is
   confirmed.** Some things cannot be read
   from code and must come from the user: target audience and usage context, product
   tone/personality, brand constraints, and which surfaces matter most. Batch these
   as questions with options where possible. Code tells you what was built, not who
   it is for — never infer this; ask. If the user declines a question, mark that
   field `TBD` rather than guessing.

### Step 3 — Write
7. Assemble the document and **write it to `docs/dev/DESIGN.md` on disk now** (create
   `docs/dev/` if missing). Producing the content only in the reply does not count —
   the file must be created.

### Step 4 — Register the design system in the always-on context
8. **This step runs in both Create and Refine.** On Refine it matters especially: the
   init/context file may have been regenerated (e.g. by the runner's `init`) and lost
   the pointer, so re-checking here restores it. **Only in states A, B, and C (a real
   system of record exists). In state D, skip this step entirely** — there is no system
   yet, so a pointer would send UI tasks to an empty DESIGN.md; do not register
   anything, just note it in the handoff.
   In A/B/C, make the design system discoverable on **every** UI task, including tasks
   run without any skill ("generate a form"). The runner reads a project init/context
   file at every session start (a `CLAUDE.md`-style file, e.g. `GIGACODE.md` /
   `CLAUDE.md` / `AGENTS.md` at the repo root). Add a pointer to `DESIGN.md` there.
   - **Locate the init/context file** the runner loads at startup. Detect it, do not
     assume the name.
   - **If you cannot confidently identify which file it is, or several candidates exist**
     (e.g. both `CLAUDE.md` and `AGENTS.md` are present), **ASK the user** which file the
     runner reads at session start — do not guess and do not write into the wrong file.
   - **Check whether the pointer already exists** by searching the file for the substring
     `docs/dev/DESIGN.md`. If that path already appears anywhere in the file, a pointer
     is already present — leave it, do not add a second one.
   - **Otherwise append this block at the end of the file**, verbatim (keep it in
     English; do not translate):

     > ## Design System
     > The project's design system is documented in `docs/dev/DESIGN.md`. Before creating
     > or changing any markup, component, or styles, first read `docs/dev/DESIGN.md` and
     > take values (color, spacing, radius, shadow, typography) and components from there;
     > do not invent design values. If the system lacks what you need, ask or propose the
     > nearest system value.

   - **If no init/context file exists at all**, skip and tell the user in the handoff
     that a design-system pointer could not be registered (no init file found).
9. Run Self-Review, then hand off.

### Refine specifics
- Read the existing `DESIGN.md` first and reuse decisions already recorded (do not
  re-ask settled context).
- Apply purely additive improvements (a newly adopted system feature, a filled
  `TBD`) and list them.
- For any value that conflicts with what DESIGN.md already states, ask the user
  before overwriting — every conflict, no silent rewrite.
- If something recorded in DESIGN.md no longer exists in the code (a component
  removed, a token deleted), treat that as a conflict too: confirm with the user
  before removing the line, never delete silently.
- Run Step 4 as well: re-check the init/context file for the `docs/dev/DESIGN.md`
  pointer and restore it if it was lost (e.g. the file was regenerated). In state D, no
  pointer.

## Document shape

```md
# <Project> — Design Document

> Living design source of truth. The project's UI library OR token system is the
> system of record for typography, color, spacing, and components. This document
> maps how the project uses it, plus design context that code cannot provide.

## Metadata
- Created: <YYYY-MM-DD — use today's real local date, e.g. via `date '+%Y-%m-%d'`, not a placeholder>
- System of record: <library name+version | library defaults | project tokens | NONE>
- Theme / tokens location: <path, or "none">
- Analyzed at commit: <current commit sha, read from git; or "n/a" if not a git repo>

## System of Record
- State: <A library+theme | B library defaults | C project tokens | D none>
- Library / version (if any):
- Theme / token source (or "none — see generate-theme"):
- Provider / setup location (or `N/A` for token/CSS-variable systems with no provider):
- How the project customizes or extends it (overrides / token files / wrappers / preset):

## Design Domains (sourced from the system of record)
- Typography: <where type comes from — variants/token names, not invented values>
- Color: <palette / token names>
- Spacing: <spacing scale/function of the system>
- Visual details (radius, elevation, borders): <system tokens>
- Motion: <system transitions/tokens, or "none provided">
  <In state D, every domain above is `TBD — no token system yet (see generate-theme)`.>

## Components
- Library / system components in use:
- Project wrappers / composed components:
- Patterns for composing new UI (state A/B: from library primitives; state C: from
  existing project patterns applying tokens; state D: whatever components exist, if any):

### Component Registry (deviations — project component preferred over the library)
<Only the needs where the project deliberately uses its OWN shared component instead
of the library/default. Not a full catalog — just the overrides. Anything not listed
defaults to the library. Keep it small.>

| Need | Use this project component | Instead of |
|------|----------------------------|------------|
| Number input | `NumberInput` | library text field |

## Design Context (from the user, not the code)
- Target audience & usage context:
- Tone / product personality:
- Brand constraints:
- Priority surfaces:

## Conventions
- Naming / file layout for UI:
- How new components are added:
- Rule for non-standard elements: prefer what the system already gives you —
  in states A/B build from library components; in state C build from existing
  project patterns and apply the project's tokens (do not hardcode). Before creating
  a new business entity, ask the user first.

## Known Drift
<hardcoded values that bypass the system of record (ad-hoc hex instead of a palette
token, magic spacing instead of the scale), as facts to inform later polish. Not
fixed here. `N/A` in state D.>
```

## Rules

- Write the DESIGN.md document in Russian prose, but keep all technical terms in English
  and never translate them: CSS/design properties (`spacing`, `gap`, `margin`, `border`,
  `radius`, `shadow`, etc.), token/variant names, component names, paths, library terms.
  The Step 4 pointer block is the only fully-English exception.
- This skill's file writes are exactly two: `docs/dev/DESIGN.md`, and a one-block
  design-system pointer appended to the project's init/context file (Step 4, states
  A/B/C only). Nothing else in the repo is modified. Both must persist to disk; content
  in the reply alone does not count. Create `docs/dev/` if needed.
- The system of record (library theme, library defaults, or project tokens) is the
  source of truth. Never invent type ramps, color systems, or spacing scales; record
  references to its tokens instead.
- Detect the system, classify into states A–D, then confirm with the user. Never
  assume which library or theme is canonical when more than one is present.
- In state D (no library and no token system), do not invent a system and do not
  write design-domain values. Point the user to `generate-theme` to create one
  first, then document the result on a later run. Leave domains as `TBD`.
- The Component Registry records only deviations — needs where the project uses its
  own shared component instead of the library/default. Do not list the whole
  component catalog; keep it to the overrides. When a new shared replacement
  component appears later, it is added to the registry on a `design-baseline` Refine
  run (this skill owns and is the only writer of the registry; other skills only
  read it).
- Design context (audience, tone, brand) cannot be inferred from code. Ask via the
  mandatory clarification pass; declined questions become `TBD`, never guesses.
- Stay library-agnostic in your own logic: put library-specific facts (MUI vs Ant,
  etc.) into DESIGN.md as project data, so the skill itself works on any project.
- Do not write production code, do not run build/test commands, do not perform git
  write operations. Reading files and the commit sha is fine.
- In Refine, never rewrite from scratch and never silently overwrite; confirm every
  conflict with the user.
- In states A/B/C only, after writing DESIGN.md, register a pointer to it in the
  runner's init/context file (the `CLAUDE.md`-style file read at every session start) so
  UI tasks find the design system even without a skill. In state D, do not register a
  pointer (no system exists yet). Detect the file, don't assume its name; if unsure which
  file it is, ask the user. Check for an existing pointer by searching for the substring
  `docs/dev/DESIGN.md` and don't duplicate it if found; if no init file exists, skip and
  say so.

## Self-Review

Before reporting done, confirm:
1. `docs/dev/DESIGN.md` exists on disk with the written content: Russian prose with
   technical terms kept in English (properties, token/component names, paths — not
   Russified). The Step 4 init-file pointer block stays fully English.
2. Both mandatory gates ran before any writing: (a) state A–D and system of record
   were detected and user-confirmed, and (b) the design-context pass ran — neither
   was skipped or merged into the other.
3. In states A/B/C, typography/color/spacing are recorded as references to that
   system, with no invented scales. In state D, domains are `TBD` and the user was
   pointed to `generate-theme` — nothing was invented.
4. Design context was asked, not inferred; unanswered items are `TBD`.
5. The skill stayed library-agnostic — all library-specific facts live in the
   document, not hardcoded in the workflow.
6. No production code, build/test run, or git write was performed.
7. In Refine: prior context reused, and every conflict — including removals of
   things no longer in the code — was user-confirmed, with nothing silently
   overwritten or deleted.
8. In states A/B/C: a pointer to DESIGN.md was added to the runner's init/context file
   (detected, or the user was asked which file; not duplicated — checked via the
   `docs/dev/DESIGN.md` substring), or no init file existed and the user was told. In
   state D: no pointer was registered.

## Handoff

Report concisely:

> "DESIGN.md <created | refined> in `docs/dev/` — system of record: <library+version | library defaults | project tokens | none>."
> "Context captured: <filled / TBD list>."
> "Design-system pointer: <added to `<init file>` | already present | asked user which file | no init file found | N/A — no system yet (state D)>."

If state D (no system found), add:

> "No library or token system found — design domains are TBD. Create a theme with `generate-theme` first, then re-run design-baseline to document it."

If anything else is `TBD`, add:

> "Still TBD and worth a follow-up: <list>."