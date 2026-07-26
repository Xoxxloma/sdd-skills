---
name: polish-frontend
description: Use to bring a specific piece of frontend markup in line with the project's design system — re-layout a component, apply spacing/elevation/color from the theme, replace hardcoded values with tokens, or clean up generic "AI slop" on a target surface. It reads docs/dev/DESIGN.md (or detects the system directly) and pulls real values from the library/tokens rather than inventing them; anything outside the system is confirmed first. Can be invoked by an agent after building UI, or manually ("I don't like this card, redo it" / "add shadow here"). For creating or redesigning the whole theme/token set, use generate-theme; for documenting the system, use design-baseline.---

# Polish Frontend

## What this skill is (and is not)

This is the executor of the design set: it **changes markup**. The other design
skills only document (`design-baseline`) or generate the system's values
(`generate-theme`). Polish brings a target surface in line with the system.

The boundary that keeps it disciplined: you may generate **code** freely, but the
design **values** you apply (color, spacing, radius, elevation, type) come from the
system of record — the library's tokens or the project's tokens recorded in
`DESIGN.md`. You do not invent design values. When the desired result needs
something the system does not provide, you stop and ask rather than inventing it.

It can change the **value** of an existing token (e.g. make the border token
darker) when the user wants that value changed project-wide. It does **not
restructure** the system — adding or removing tokens or redesigning the palette is
`generate-theme` — and it does not write `DESIGN.md` (that is `design-baseline`).
Its deliverable is edited markup, plus, for a project-wide value change, the single
token definition behind it.

## Paths

- Source of truth: `docs/dev/DESIGN.md` if present. If it is absent, detect the
  system directly from the project (library theme / tokens / CSS variables). Keep
  this path consistent with the rest of the pipeline.

## Process

### Step 0 — Pin the target and the outcome
1. Identify what is being changed. It is one of two kinds:
   - **A surface** — a specific component/page/element ("this card").
   - **A property project-wide** — one design property everywhere ("make the border
     darker across the whole project", "inspect and fix the radius everywhere").
   And identify the desired outcome. If the request is vague ("I don't like it /
   change it somehow"), ask what specifically is wrong and what the goal is — do not
   guess a direction. Get one concrete target and one concrete outcome before
   editing.

### Step 1 — Load the source of truth
2. Read `docs/dev/DESIGN.md` if it exists, as a guide to the system. But the actual
   tokens you apply come from the **current** theme/tokens in code — `DESIGN.md` can
   lag the code, so when they diverge, trust the code (a token that exists in the
   theme but not in `DESIGN.md` is still real). If there is no system at all (no
   library, no tokens), you cannot align to one: you may still do the **structural**
   anti-pattern cleanup below (e.g. un-center, un-nest, fix easing), but anything
   that needs a *value* — a color, a contrast fix, a token — must wait. Tell the user
   to run `generate-theme` (and `design-baseline`) first.

### Step 2 — Plan against the system
3. For a **surface** target: decide which existing system components and tokens
   achieve the outcome (an elevation token for "add shadow", a spacing token for
   tightening, a palette token for recoloring). When the surface needs a component,
   consult the **Component Registry** in `DESIGN.md` first: if it lists a project
   component for this need, use that project component (e.g. number input →
   `NumberInput`, not the library's text field); if the registry has no entry for
   the need, use the library/system component. Either way, prefer existing system
   components over hand-rolled markup.
4. For a **project-wide property** target: first **inspect** how that property is
   sourced, then report before fixing — the source decides the mechanism:
   - **From a token** (components reference `theme.border` / `--border` / a Tailwind
     color): the fix is to change that one token's **value** in its definition; the
     effect propagates everywhere. Report it and flag the blast radius before
     editing: "border comes from token `X` — changing its value affects every
     surface using it; proceed?"
   - **Hardcoded** (ad-hoc values scattered across components, no token): the fix is
     a markup pass replacing them in place. Report the scope ("border is hardcoded
     in ~N places, no token") and offer to introduce a token if one should exist —
     but introducing a brand-new token is a system change; if the user wants that,
     route to `generate-theme` rather than inventing the token here.

### Step 3 — Boundary gates (ask before crossing)
5. **Value outside the system.** If the outcome needs a value the system does not
   provide (a shadow not in the elevation set, a color not in the palette, a radius
   off the scale), do not silently invent it. Present the nearest in-system option
   and ask whether to use it or to go custom outside the system — and only go custom
   on explicit confirmation.
6. **New entity.** If the outcome cannot be built by composing existing
   primitives/components and would require a new business entity/component, ask the
   user before creating it. Building from existing primitives needs no gate.

### Step 4 — Apply
7. Edit the target markup. Use system components and tokens; do not hardcode values
   that the system already provides. Where the target currently hardcodes such
   values, replace them with the token as part of the change.
8. When the target is a **surface**, remove the universal anti-patterns (see below)
   **within that surface only** — do not climb out to a parent or sibling to fix
   anti-patterns there; note those instead (Step 5). When the change is a
   **project-wide value change** (e.g. editing a token's value), anti-pattern
   cleanup does not apply — you are changing one value, not polishing a surface. Do
   not converge on generic defaults.

### Step 5 — Stay in scope
9. Change only the named target. Do not broaden into an unrequested restyle of other
   surfaces, a component-library swap, or a broad refactor. If you notice issues
   elsewhere, mention them — do not fix them unprompted.

### Step 6 — Finish
10. Run Self-Review, then hand off. A shared-token-value change had its blast radius
    flagged and confirmed earlier (Steps 2–3); it needs no `design-baseline` re-doc —
    DESIGN.md records token names, not values, so changing a value does not alter it.

## Universal anti-patterns (remove / avoid)

These are stack-independent "AI slop" tells. Avoid them regardless of the system:
- Gradient text, and purple/blue gradient backgrounds used as a default.
- Cards nested inside cards; everything boxed.
- Gray text on a colored background; weak or flat visual hierarchy.
- Defaulting to one ubiquitous font (e.g. Inter) with no intent.
- Decorative side-stripe borders; everything centered by reflex.
- Bounce/elastic easing by default; transitioning layout properties instead of
  transform/opacity.
- Contrast below WCAG AA for text.

Removing these applies when polishing a **surface**. Structural fixes (un-center,
un-nest, fix easing, use transform/opacity) need no tokens. Fixes that need a value
(recolor, contrast) take it from the system; with no system, they wait (Step 1).

## Rules

- You may generate markup, but design values come from the system of record. Never
  invent palette, spacing, radius, elevation, or type values; pull them from the
  library/tokens (or `DESIGN.md`).
- When a surface needs a component, consult the Component Registry in `DESIGN.md`:
  a listed need uses the project component; an unlisted need uses the library/system
  component. With no `DESIGN.md` (or no registry in it), use the library/system
  component as usual — do not search the codebase for a replacement.
- Going outside the system (a value it does not provide, or a new entity) requires
  explicit user confirmation first. Building from existing primitives does not.
- The token boundary: you MAY change the **value** of an existing token in its
  definition (the project-wide value-change case). You may NOT restructure the
  system — adding or removing tokens, or redesigning the palette/scale is
  `generate-theme`. "Change the value of the existing border token" = allowed;
  "create a border token / rework the palette" = route to `generate-theme`. The axis is
  retune-vs-restructure, not the count: changing existing values (even several at once —
  "make it darker and rounder") stays here; changing the SET of tokens goes to `generate-theme`.
- Before changing a shared token's value, inspect and report the source, flag the
  blast radius (it affects everything using the token), and confirm with the user.
  No `design-baseline` re-doc is needed after a value change — DESIGN.md records token
  names, not values.
- Read `DESIGN.md` if present as a guide, but apply values from the current theme/
  tokens in code; trust the code when the two diverge. With no system at all, do
  only the structural anti-pattern cleanup and point the user to `generate-theme`.
- Stay on the named target. No unrequested restyles, library swaps, or broad
  refactors. Surface issues elsewhere as notes, do not fix them unprompted.
- Do not write `DESIGN.md` (that is `design-baseline`).
- Stay stack-agnostic in your own logic: read the project's system rather than
  assuming a library; project-specific facts live in `DESIGN.md`, not in this skill.
- Do not run build/test commands or perform git write operations. Editing the target
  markup — and, for a project-wide value change, the single existing token's
  definition — is the only mutation.

## Self-Review

Before reporting done, confirm:
1. One concrete target and outcome were pinned; a vague request was clarified, not
   guessed.
2. Applied values came from the current theme/tokens in code (using `DESIGN.md` only
   as a guide); none were invented. Anything outside the system was user-confirmed
   first.
3. For a project-wide change: the source was inspected and reported (token vs
   hardcode); a token's value was changed only in its definition with blast radius
   flagged and confirmed; no new token was created here (that would route to
   `generate-theme`).
4. When a component was needed, the Component Registry was consulted: a listed need
   used the project component, an unlisted need used the library; with no registry,
   the library component was used without a codebase hunt.
5. A new entity, if any, was user-confirmed before creation; primitive composition
   was not gated.
6. Only the named target was changed — surface or the one property project-wide;
   anti-pattern cleanup ran only for a surface target, stayed within that surface,
   and did not climb to parents; no unrequested restyle, swap, or broad refactor
   leaked in.
7. Anti-pattern cleanup respected the system: structural fixes needed no tokens;
   value-requiring fixes used the system, and with no system present nothing was
   invented.
8. If a shared token value changed, blast radius was flagged and the user confirmed.
9. No build/test run or git write was performed.

## Handoff

Report concisely:

> "Polished <target>: <what changed, in terms of the system's tokens/components>."
> "Outside-system or new-entity changes: <what was confirmed, or none>."

If a shared token changed, add:

> "This changed a shared token (<name>) — it affects <blast radius>."