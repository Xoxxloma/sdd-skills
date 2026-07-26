---
name: writing-plans-front
description: Use when there is an approved design or feature spec and the next job is to produce a compact, resumable, execution-ready frontend implementation plan pack before touching code. Input may be a worded request, a description/spec file, or a full-feature spec whose frontend slice must be carved out.
---

# Writing Plans

## Goal

Turn an approved design into a compact, execution-ready implementation plan pack that
another agent can follow and resume with minimal reinterpretation.

The plan is not a second spec. It captures the execution delta plus control scaffolding:
touched files, milestones, order, validation, rollback boundaries, and handoff.

For non-trivial or autonomous execution, the plan pack should include companion files
beside the main plan: `docs/dev/plans/<feature>/plan-status.md` and
`docs/dev/plans/<feature>/plan-test-plan.md`.

## Planning Workflow

1. Read the approved input first — a worded request, a short description, a file
   (`intent.md` or any spec), or a full-feature spec covering more than the frontend. When
   the input spans more than the frontend, carve out only the frontend slice and plan that;
   record the non-frontend parts under scope/non-goals.
2. Run a scope check. If the remaining frontend work still covers multiple independent
   subsystems, split it into separate plans before continuing.
3. Inspect only the files, prompts, docs, and configs likely to change.
4. Map touched files and artifacts before writing tasks. Note what each is responsible for
   and keep the decomposition aligned with existing repository boundaries.
5. Identify contradictions, ambiguous terms, and unresolved assumptions before writing
   tasks. Only normalize naming or clerical inconsistencies. If a change would affect API,
   business rules, auth, or other product-visible behavior — or the design is too thin to
   plan without making product-visible architectural decisions the design doesn't settle
   (module boundaries, shared-state shape, a data contract, a route structure) — do not
   decide it silently: record it under `Spec gaps, open questions, and allowed
   normalizations`, or as a `Frozen implementation decisions` entry, for the user to review.
   For a request that already fully determines the work, this never triggers.
6. Choose the artifact set. Write the full plan pack (main + status + test-plan) for any
   plan that meets at least one of:
   - spans multiple milestones, or
   - touches API/auth/persistence/background work, or
   - touches more than one frontend surface: multiple components, multiple views/pages/
     routes, shared client state or stores, client-side data fetching, form or
     input-validation logic, navigation/route guards, or a design-system change, or
   - is intended for autonomous execution.

   Frontend scope counts exactly like backend scope. "It's just UI" is not a reason to drop
   the companions. When in doubt, write the full pack. Only skip the companions for a
   genuinely trivial single-surface change (one isolated component, or one copy/style tweak
   with no shared state and no interaction logic).

   The lightweight path trims the ARTIFACTS, not the ROLE. Even for a trivial change you
   still: (1) write the plan to disk as `docs/dev/plans/<feature>/plan.md` — a real file,
   never a chat-only plan; (2) show it to the user for review before anything is built;
   (3) hand off to `executing-plans-front`. This skill plans and writes; it never
   implements the change itself and never skips the disk write because the task is small.
   - main plan: `docs/dev/plans/<feature>/plan.md`
   - status companion: `docs/dev/plans/<feature>/plan-status.md`
   - test plan companion: `docs/dev/plans/<feature>/plan-test-plan.md`
7. Freeze one architecture and dependency path for execution. Resolve `A or B` choices into
   a single selected option, or surface them as blocking questions before finalizing.
8. Break the work into atomic, resumable tasks in strict execution order. Prefer one
   independently verifiable behavior unit per task: one endpoint, one middleware, one
   storage method, one migration, one config surface, one component, one view, one route,
   one store slice, or one integration check.
9. Group tasks into milestones. For each milestone define a goal, definition of done,
   validation gate, rollback boundary, and stop/replan rule.
10. Validate task dependencies before finalizing. No task may depend on an artifact,
    contract, provider abstraction, component, or helper created later in the sequence.
11. Cross-check the file inventory. Every file, directory, command entry point, or test
    artifact referenced anywhere in the plan pack must appear in the touched-files inventory
    or in an explicit external-prerequisites section.
12. Separate behavioral validation from compile/lint/build checks. For externally visible
    behavior, include happy-path and key negative-case checks, not just build success.
13. If repository-navigation helper readiness is known during planning, record that advisory
    note explicitly and tell execution to re-check it on activation.
14. Prefer delta-from-spec planning: do not restate architecture, requirements, or examples
    already covered well in the design.
15. Determine the feature folder.
    - **If the user references a folder or feature name** (e.g. "plan the intent in
      `pdf-feature`"), check `docs/dev/plans/<that-name>/` on disk:
      - it exists and contains `intent.md` → this is an intent input: use that folder as
        `<feature>`, read `intent.md` as the approved spec. Do not propose a new name.
      - the folder exists but has no `intent.md`, or the named folder does not exist → do
        not invent a new name or assume an intent; ask the user whether to create the plan
        in that exact folder or whether they meant a different one. Only check the folder the
        user named — never scan `docs/dev/plans/` to guess a similar one.
    - **Otherwise** (a worded description, no folder reference), propose a feature folder
      name in kebab-case, derived from the work item (not the artifact type), show it to the
      user, and let them correct it before writing.
16. Create `docs/dev/plans/<feature>/` if needed, and save the main plan as
    `docs/dev/plans/<feature>/plan.md` (beside `intent.md` when the input was an intent).
    Save the companions inside the same folder when the plan is non-trivial.
17. The feature name names the folder only and must not carry artifact-type suffixes such as
    `-implementation`, `-plan`, `-design`, `-spec`, `-status`, or `-test-plan`. Inside the
    folder the files are always `plan.md`, `plan-status.md`, and `plan-test-plan.md`.
18. Run the self-review checklist below.
19. Ensure `User-facing outcome` is captured — ask the user, in plain language, what a user
    will be able to do after this ships ("after this, a user can ..."). Ask this **once**:
    if the design or an earlier clarification already made it clear, use that and do NOT
    re-ask. Record it as the `User-facing outcome` field. Do not invent it from the tasks;
    if the user declines, mark it `TBD`.
20. Ask the user to review the written plan pack before any implementation starts.
21. Only after explicit user approval, hand off to `executing-plans-front`.

## Default Output Shape

Use this shape unless the task clearly needs less.

Main plan:

1. Summary
2. User-facing outcome (one line: "after this, a user can ..."; captured once via step 19; or `TBD`)
3. Reference to approved spec or design plan
4. Frozen implementation decisions
5. Spec gaps, open questions, and allowed normalizations
6. Scope and non-goals
7. Touched files and responsibilities
8. Explicit design deviations, if any
9. Milestones with definitions of done
10. Ordered atomic tasks
11. Validation strategy and milestone gates
12. Rollback boundaries and compatibility notes
13. Known pitfalls and unknowns

For section 9 (Milestones), use this repeated shape unless the task is truly trivial:

```md
### Milestone N: <Title>

**Goal:** concise delivery target

**Definition of Done:**
- observable completion signal(s)

**Validation Gate:**
~~~bash
exact runnable command(s)
~~~

**Rollback Boundary:** what can be safely reverted at this boundary

**Stop/Replan Rule:** what discovery or failure forces the plan to stop and be revised
```

For section 10 (Ordered atomic tasks), when the plan spans multiple milestones or is meant
for autonomous execution, do not use a bare numbered checklist. Use a repeated task block:

```md
### Task X.Y: <Short Title>

**Files:** `path/to/file`

**Outcome:** one independently verifiable result

**Prerequisite:** exact earlier task id, milestone, or `None`

**RED:** exact failing test or validation command and the expected failure signal

**GREEN:** smallest implementation change that should make the RED check pass

**Verification:** exact passing command or manual check
```

For documentation-only or config-only tasks, keep the same shape and mark `RED`/`GREEN` as
`N/A - no behavior change`, with a short reason.

**Testing policy — test-first by contract maturity, not by "behavior-changing".** Decide
the tier per task and write the matching `RED`/`GREEN`. Full rationale, hard guardrails, and
the smell list are in [`references/testing-policy.md`](references/testing-policy.md) — read
it when classifying tasks.

- **Separable logic already in the plan** (pure functions, parsers, validators, reducers,
  selectors, store slices, state machines, data transforms, hooks whose own logic is added;
  backend units — one endpoint/middleware/storage method/migration) → **test-first,
  mandatory** (real RED/GREEN). Name the exact repository command + expected failing signal.
- **Shared reusable unit with a settled contract** (a basic primitive, a small helper) →
  **test-after, light**; one or two checks through the public interface. Test-first optional.
- **Feature unit whose contract emerges while building** → **no task-level RED/GREEN**; test
  observable behavior through the public interface after it stabilizes, or a milestone smoke.
- **Pure presentation / no-logic wiring** → `N/A - no behavior change` with a one-line reason.

Key guardrails (full list in the reference): never create a unit solely to make it testable;
length is never a reason to split or extract; a test must earn its place (a real branch/
interaction/validation, never "renders markup"); end-to-end checks are off by default and
never a task-level gate; name the repository's own command, never a specific framework.

## Companion shapes (non-trivial plans)

Status companion — use these exact headings so execution can resume deterministically:

```
## Current Milestone
## Milestone Status
## Current Task
## Next Task
## Stop/Replan Triggers
## Decisions and Assumptions
## Last Completed Command and Validation
## Blockers
## Execution Log
```

Each `## Execution Log` entry starts with an actual local timestamp `YYYY-MM-DD HH:MM TZ`
(e.g. `2026-04-01 14:37 MSK`), generated from the environment (`date '+%Y-%m-%d %H:%M %Z'`
or `Get-Date`), not invented. No ISO-8601 UTC (`...T...Z`), no `XX` fragments, no fake `00:00`.

Test plan companion: validation assumptions/prerequisites/exact commands; server or
dev-server run command and required env; step-level checks; milestone gates; key negative
cases; manual or environment-dependent checks.

Optional sections: migration notes (only if existing users/data/configs/contracts are
affected); rollback notes (only if the task changes persistent behavior or deployment state).

## Rules

- Do not write production code. Do not include full file skeletons or long code blocks; use
  short command snippets only for validation or naming an exact setup step.
- Prefer minimal-diff plans over idealized redesigns. Inspect only the repo context needed
  for file-accurate steps. Exact file/artifact paths always.
- Use `docs/dev/plans/<feature>/` — one subfolder per feature. Never write into the flat
  `docs/dev/plans/` root, and do not improvise alternate roots. Files are exactly `plan.md`,
  `plan-status.md`, `plan-test-plan.md` — one shared base name, no dates, no artifact-type
  suffixes in the folder name. If given an intent, reuse its folder; otherwise derive
  `<feature>` from the feature slug and let the user correct it before writing.
- Every task is actionable without reinterpretation and names its exact file, outcome,
  prerequisite, and verification. Every prerequisite is satisfied by an earlier task,
  milestone, or explicit external prerequisite. Every milestone states DoD, validation gate,
  rollback boundary, and stop/replan rule.
- Apply the Testing policy above (and its reference) to choose test-first / test-after /
  `N/A` per task. Do not leave the executor to invent the RED/GREEN sequence, and do not let
  the executor invent extractions, hooks, or utils the plan did not call for.
- Freeze one architecture and dependency path — no `or`/`either`/fallback library choices in
  the final plan. If the design and repo evidence disagree on placement or boundaries, call
  out the conflict instead of picking one silently. Record intentional deviations from the
  design in an explicit `Design deviations` section.
- Do not silently change product behavior under the label of `normalization`. Surface
  assumptions, term normalization, and unknowns explicitly.
- Compile/lint/build checks are partial signals, not behavioral proof. For API/auth/
  persistence/contract/user-visible behavior include behavioral validation. Every validation
  step must be runnable as written, with prerequisites and expected result stated. Manual,
  browser-driven, or external-provider checks cannot be the only gate for a milestone meant
  for autonomous execution.
- The frontend touched-files inventory must include the real surfaces a UI change spans:
  components, styles/style modules, stores/client state, route definitions, shared types,
  test files, and stories/fixtures where used.
- Omit irrelevant sections instead of filling them with boilerplate. If the project is small
  or greenfield, keep the plan short and linear, but not underspecified.
- You may delegate a focused planning pass to whatever planning-capable subagent the runner
  provides. If the user explicitly asks for `/write-plan`, honor that as a manual fallback.
- Writing the plan pack is the only deliverable. Do not write production code, scaffold or
  stub components, or start executing any task, even when the work looks small or visual.
  Frontend tasks are the most common place this goes wrong — treat the urge to "just build
  the component" as a signal to stop and finish the plan.
- All files in the chosen artifact set must be written to disk before you ask the user to
  review. If companions are called for, the main plan alone is not a complete deliverable.
- Do not invoke implementation skills or start coding until the user has reviewed and
  approved the written plan pack.

## Self-Review

After writing the plan, review it once before handing off:

1. Spec coverage: each major requirement or constraint maps to a task, milestone gate, or
   test-plan check.
2. Decision freeze: architecture, library, and package-layout choices are one path — no `or`
   branches; contract discipline held (no `normalization` silently changed behavior).
3. Inventory + dependency order: every referenced file/command/test/helper appears in touched
   files or external prerequisites; every task precondition points to something earlier.
4. Atomicity and resumability: a fresh agent can identify the current milestone, next task,
   stop rule, and verification without rereading chat. Every multi-milestone/autonomous task
   has `Files`, `Outcome`, `Prerequisite`, `Verification`; every milestone has `Stop/Replan
   Rule`.
5. Testing realism per the tiered policy: separable logic with a pre-existing contract has
   explicit `RED`/`GREEN`; emergent-contract units use a behavior-through-interface check or
   milestone smoke or `N/A`; presentation is `N/A` — neither blanket RED/GREEN nor blanket
   `N/A`. No task creates a hook/util/wrapper justified only by testability or length; no
   task uses line count as a reason to split. Tests target the separable unit or observable
   behavior through the public interface, not internal structure or copy. End-to-end checks
   are not task-level or default gates. No specific framework/tool is hard-named.
6. Frontend pack completeness: a multi-component/multi-view/multi-route feature has the full
   pack (main + status + test-plan) on disk, not a main-plan-only artifact.
7. Compactness + no placeholders: cut repeated spec material and boilerplate; remove `TODO`/
   `TBD`/implied decisions/vague verbs that hide real work; naming is consistent across the
   pack. Rollback notes tie to milestone boundaries or state changes, not a global reset.

## Execution Handoff

After saving the plan pack and finishing self-review, ask the user to review it:

> "Implementation plan written to `<plan path>`."
> "If used, companion files are at `<status path>` and `<test plan path>`."
> "Please review them and tell me if you want any changes before we start executing."

Wait for the user's response. If they request changes, update the plan and re-run
self-review. After explicit approval, hand off to `executing-plans-front` for inline
execution in the current session with bounded batches.
