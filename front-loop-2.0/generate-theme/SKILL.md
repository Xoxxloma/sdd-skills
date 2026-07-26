---
name: generate-theme
description: Use to create a project's design theme or design tokens when no project theme exists yet, or to fully redesign an existing theme the user is unhappy with. It runs a short interview about the product and the system they want, then generates real theme/token code in the project — a library theme if a UI library is present, otherwise tokens in the project's format (Tailwind config / CSS variables). It proposes values for the user to approve before writing. This is the one skill in the set that creates design values; everything else only documents or applies them. Trigger when design-baseline reports state B (library with no project theme) or state D (no system at all), or when the user wants to generate or regenerate a theme/token system. For changing a single existing value, use polish-frontend instead.---

# Generate Theme

## What this skill is (and is not)

Every other skill in this set documents or applies what exists. This one is the
exception: it **creates** design values — palette, spacing scale, typography,
radii — that do not exist yet. That makes it the only skill allowed to generate,
and it must stay disciplined: it generates from a short interview, proposes values,
and writes only after the user approves.

It does not touch `DESIGN.md` — after generation, `design-baseline` documents the
result. It does not change markup or fix a single existing value — that is
`polish-frontend`. Its deliverable is real theme/token code in the project.

## Modes

- **Create** — no project theme or tokens exist yet. This includes a project that
  has a UI library but no project theme on top of it (design-baseline state B), and
  a project with no library and no tokens at all (state D). In the first case you
  generate a theme *for that library*; in the second you generate standalone tokens.
- **Regenerate** — a project theme/tokens already exist but the user wants a
  fundamentally different one. Start from the current theme as context, then
  redesign.

Choosing between them:
- **Create vs Regenerate** is decided by whether a project theme/tokens already
  exist (none → Create; exist → Regenerate). An explicit user request to "redesign
  / rework / regenerate" forces Regenerate even when detection is ambiguous.
- **Whether this skill applies at all** is the whole-vs-pointwise question:
  "redesign the theme / I want a different look / I don't like the overall feel" →
  this skill. "Change this one value / make the radius bigger / darken the border" →
  not this skill; direct the user to `polish-frontend`. The axis is
  restructure-vs-retune, not the number of values: changing existing values (even
  several — "make it darker and rounder") stays `polish-frontend`; this skill is for
  restructuring the token SET (add/remove tokens, redesign the palette/scale) or a
  from-scratch system.

## Process

### Step 0 — Mode and target format
1. Determine whether this skill applies (whole-vs-pointwise). If the request is a
   single existing-value change, stop and point the user to `polish-frontend`.
   Otherwise determine the mode: Create if no project theme/tokens exist, Regenerate
   if they do — and Regenerate also when the user explicitly asks to redesign/rework
   the theme, even if detection is ambiguous.
2. Determine the output format from the project, not from preference — one
   principle: **write where the project's style already lives.**
   - A UI library is present → generate a theme in that library's own theme
     mechanism (e.g. MUI `createTheme`, Ant `ConfigProvider` theme).
   - No library → generate tokens in the format the project already uses: a
     Tailwind config/preset if Tailwind is present, otherwise neutral CSS custom
     properties.
   - If the format is genuinely ambiguous (e.g. no library and no Tailwind), ask
     the user which target they want; do not guess.
3. State the detected mode and target format and confirm with the user. Confirm the
   format before writing; if the right format only becomes clear after the
   interview, it is fine to settle it then rather than forcing it up front.

### Step 1 — Interview (5 fixed questions)
4. Ask these as one batch, with options where possible. In Regenerate, prefix with a
   zeroth input: "Here is the current theme — what don't you like, and which
   direction do you want?" Then the five:
   1. What is the product, in one line (what it does, the domain)?
   2. Who is the audience and what tone/personality should it convey?
   3. Light, dark, or both?
   4. Is there a brand color or existing brand constraint? (hex, or "none")
   5. Density and shape: compact vs roomy, sharp vs rounded?
   Keep it to these five. If the user volunteers more, use it; do not expand the
   interview into an interrogation.

### Step 2 — Propose values (approval gate)
5. From the interview, propose a coherent set of values: palette (with light/dark as
   chosen), spacing scale, typography (family + scale), radii, and elevation/shadow
   if relevant. Present them as a readable summary the user can judge.
6. **This is a mandatory approval gate. Do not write to the project until the user
   approves.** In Regenerate, present each proposed value **beside the current one**
   (old → new) so the change is visible, and never silently overwrite. When the user
   is adding a whole new dimension rather than changing existing values (e.g. light →
   light+dark), present the added part as new, not as an old → new diff.
7. Note the blast radius before writing: changing shared tokens (e.g. the primary
   color, the spacing step) affects everything that uses them. Say so plainly so the
   user approves with that in mind.
8. Incorporate the user's edits and re-confirm changed values. Approval is per the
   proposed set; if the user reworks it substantially, show the revised set again.
   Cap this at three proposal rounds: if there is still no agreement after three,
   stop guessing and ask the user for the concrete values they want, then apply
   those — do not keep generating new guesses indefinitely.

### Step 3 — Write to the project
9. Write the approved theme/tokens into the project in the chosen format and
   location. In Create, create the theme/token file (and only the wiring the format
   needs). In Regenerate, edit the existing theme/token file in place — do not
   create a duplicate or a new parallel theme. Any setup the format requires (e.g. a
   provider) should be noted to the user; only add it if the user confirms, since it
   touches app setup.
10. Run Self-Review, then hand off.

## Rules

- This skill generates values; that is its job. But it generates only from the
  interview, and writes only after the approval gate. Never write generated values
  to the project before the user has approved them.
- Output format is dictated by the project, by one principle: write where the
  project's style already lives (library theme mechanism, else project token
  format). Do not impose a format the project does not use; if ambiguous, ask.
- In Regenerate, never silently overwrite the existing theme. Show old → new for
  each value and get approval. Flag the blast radius of shared-token changes.
- Do not handle pointwise value changes; route those to `polish-frontend`. This
  skill only creates or fully regenerates a system.
- Do not touch `DESIGN.md`. After generation, `design-baseline` documents the new
  system. Tell the user to run it.
- Keep the interview to the five fixed questions; do not turn it into an open-ended
  questionnaire.
- Do not run build/test commands or perform git write operations. Writing the
  theme/token file(s) is the only mutation.
- Stay stack-agnostic in your own logic: detect the library/format from the project
  rather than assuming a specific one, so the skill works across projects.

## Self-Review

Before reporting done, confirm:
1. This skill applied (whole-system request, not pointwise — a pointwise request was
   redirected to `polish-frontend`), and the mode was right: Create when no project
   theme/tokens exist (including a library with no project theme), Regenerate when
   they exist or the user explicitly asked to redesign.
2. Output format matches where the project's style lives (library theme / Tailwind
   / CSS variables), confirmed with the user when ambiguous.
3. The interview was the five fixed questions (plus the Regenerate zeroth input), no
   more.
4. Values were proposed and **user-approved before any write**; in Regenerate, each
   was shown old → new (added dimensions shown as new) with no silent overwrite, and
   blast radius was flagged. If agreement took more than three rounds, the user was
   asked for concrete values instead of further guessing.
5. The approved theme/tokens were written to the project in the right file/format.
6. `DESIGN.md` was not touched; the user was told to run `design-baseline` to
   document the result.
7. No build/test run or git write was performed.

## Handoff

Report concisely:

> "Theme <created | regenerated> in <file/path> as <library theme | Tailwind config | CSS variables>."
> "Generated: <palette/typography/spacing summary>."
> "Shared-token changes affect: <blast-radius note, or none>."
> "Next: run `design-baseline` to document this system in DESIGN.md."