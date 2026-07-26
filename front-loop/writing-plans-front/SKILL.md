---
name: writing-plans-front
description: Use when there is an approved design or feature spec and the next job is to produce a compact, resumable, execution-ready frontend implementation plan pack before touching code. Input may be a worded request, a description/spec file, or a full-feature spec whose frontend slice must be carved out.
---

# Writing Plans

## Goal

Turn an approved design into a compact, execution-ready implementation plan pack that another agent can follow and resume with minimal reinterpretation.

The plan is not a second spec. It should capture the execution delta plus control scaffolding: touched files, milestones, order, validation, rollback boundaries, and handoff.

For non-trivial or autonomous execution, the plan pack should usually include companion files beside the main plan:

- `docs/dev/plans/<feature>/plan-status.md`
- `docs/dev/plans/<feature>/plan-test-plan.md`

## Planning Workflow

1. Read the approved input first. It may be a worded request, a short description, a file (`intent.md` or any spec/description doc), or a full-feature spec that covers more than the frontend. When the input spans more than the frontend, carve out only the frontend slice and plan that; record the non-frontend parts under scope/non-goals instead of planning them here.
2. Run a scope check. If the remaining frontend work still covers multiple independent subsystems, split it into separate plans before continuing.
3. Inspect only the files, prompts, docs, and configs that are likely to change.
4. Map touched files and artifacts before writing tasks. Note what each one is responsible for and keep the decomposition aligned with existing repository boundaries.
5. Identify contradictions, ambiguous terms, and unresolved assumptions in the design before writing tasks. Only normalize naming or clerical inconsistencies. If a change would affect API, business rules, auth behavior, or other product-visible behavior, surface it as a spec gap or open question instead of silently deciding it. The same applies when the design is too thin to plan from: if building the plan would force you to make product-visible architectural decisions the design doesn't settle (module boundaries, shared-state shape, a data contract, a route structure), do not decide them silently — record each under `Spec gaps, open questions, and allowed normalizations`, or as a `Frozen implementation decisions` entry, for the user to review. For a request that already fully determines the work, this never triggers — plan as normal.
6. Choose the artifact set. Write the full plan pack (main + status + test-plan) for any plan that meets at least one of:
   - spans multiple milestones, or
   - touches API/auth/persistence/background work, or
   - touches more than one frontend surface: multiple components, multiple views/pages/routes, shared client state or stores, client-side data fetching, form or input-validation logic, navigation/route guards, or a design-system / styling-system change, or
   - is intended for autonomous execution.

   Frontend scope counts exactly like backend scope here. A multi-component or multi-view feature is a plan-pack task, not a single-file plan, and "it's just UI" is not a reason to drop the companions. When in doubt, write the full pack. Only skip the companions for a genuinely trivial single-surface change, such as one isolated component or one copy/style tweak with no shared state and no interaction logic.

   The lightweight path trims the ARTIFACTS, not the ROLE. Even for a genuinely
   trivial change you still: (1) write the plan to disk as `docs/dev/plans/<feature>/plan.md`
   — a shorter plan, companions omitted, but a real file, never a plan left only in
   chat; (2) show it to the user for review before anything is built; (3) hand off to
   `executing-plans-front` for implementation. This skill plans and writes; it never
   implements the change itself, and never skips the disk write just because the task
   is small. "Trivial" means fewer files, not less discipline — a chat-only plan or
   self-execution is a role violation regardless of task size.
   - main plan: `docs/dev/plans/<feature>/plan.md`
   - status companion: `docs/dev/plans/<feature>/plan-status.md`
   - test plan companion: `docs/dev/plans/<feature>/plan-test-plan.md`
7. Freeze one architecture and dependency path for execution. Resolve `A or B` choices into a single selected option, or surface them as blocking questions before finalizing the plan.
8. Break the work into atomic, resumable tasks in strict execution order. Prefer one independently verifiable behavior unit per task: one endpoint, one middleware, one storage method, one migration, one config surface, one component, one view, one route, one store slice, or one integration check.
9. Group tasks into milestones. For each milestone define a goal, definition of done, validation gate, rollback boundary, and stop/replan rule.
10. Validate task dependencies before finalizing the plan. No task may depend on an artifact, contract, provider abstraction, component, or helper that is only created later in the sequence.
11. Cross-check the file inventory. Every file, directory, command entry point, or test artifact referenced anywhere in the plan pack must appear in the touched-files inventory or in an explicit external-prerequisites section.
12. Separate behavioral validation from compile/lint/build checks. For externally visible behavior, include happy-path and key negative-case checks instead of treating build success as proof.
13. If repository-navigation helper readiness is already known during planning, record that advisory note explicitly in the plan pack and tell execution to re-check it on activation.
14. Prefer delta-from-spec planning: do not restate architecture, requirements, or examples already covered well in the design.
15. Determine the feature folder.
    - **If the user references a folder or feature name** (e.g. "plan the intent in
      `pdf-feature`", or gives a path), check `docs/dev/plans/<that-name>/` on disk:
      - it exists and contains `intent.md` → this is an intent input: use that folder as
        `<feature>` and read `intent.md` as the approved spec/design. Do not propose a
        new name.
      - the folder exists but has no `intent.md`, or the named folder does not exist →
        do not silently invent a new name or assume an intent; ask the user whether to
        create the plan in that exact folder (worded input, no intent) or whether they
        meant a different folder. Only check the folder the user named — never scan
        `docs/dev/plans/` to guess a similar one.
    - **Otherwise** (a worded description or a bare idea with no folder reference),
      propose a feature folder name in kebab-case, derived from the work item itself
      (not the artifact type), show it to the user, and let them correct it before
      writing anything; use the agreed name as `<feature>`.
16. Create the folder `docs/dev/plans/<feature>/` if it does not already exist, and save
    the main plan as `docs/dev/plans/<feature>/plan.md` (beside `intent.md` when the
    input was an intent). Save the companions inside the same folder when the plan is
    non-trivial.
17. The feature name names the folder only and must not carry artifact-type
    suffixes such as `-implementation`, `-plan`, `-design`, `-spec`, `-status`, or
    `-test-plan`. Inside the folder the files are always `plan.md`,
    `plan-status.md`, and `plan-test-plan.md` — one shared base name `plan` in one
    feature folder.
18. Run the self-review checklist from `Self-Review`.
19. Ensure the `User-facing outcome` is captured — ask the user, in plain
    user-facing language, what a user will be able to do after this feature ships
    ("after this, a user can ..."). Ask this **once**: if the design or your earlier
    clarification already made the user-facing outcome clear, use that and do NOT
    re-ask a reworded version of the same question. Record it as the `User-facing
    outcome` field in the plan (this is the single source for that field — do not
    prompt again while filling the shape). Do not invent it from the tasks; if the
    user declines, mark it `TBD`.
20. Ask the user to review the written plan pack before any implementation starts.
21. Only after explicit user approval, hand off to `executing-plans-front` for
    implementation.

## Default Output Shape

Use this shape unless the task clearly needs less.

Main plan:

1. Summary
2. User-facing outcome (one line, plain language: "after this, a user can ..."; captured once via the step-19 ask — do not prompt again here; or `TBD`)
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

For section 9 (Milestones), use this repeated milestone shape unless the task is truly trivial:

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

For section 10 (Ordered atomic tasks):

- When `Ordered atomic tasks` spans multiple milestones or is meant for autonomous execution, do not use a bare numbered checklist.
- Use a repeated task block for each atomic task with this minimum shape:

```md
### Task X.Y: <Short Title>

**Files:** `path/to/file`

**Outcome:** one independently verifiable result

**Prerequisite:** exact earlier task id, milestone, or `None`

**RED:** exact failing test or validation command and the expected failure signal

**GREEN:** smallest implementation change that should make the RED check pass

**Verification:** exact passing command or manual check
```

- For documentation-only, config-only, or other non-behavior-changing tasks, keep the same block shape and mark `RED` / `GREEN` as `N/A - no behavior change`, with a short reason.

**Testing policy: test-first by contract maturity, not by "behavior-changing":**

Whether a task gets a real RED/GREEN test-first cycle depends on whether the contract exists before the code, not on whether the task is loosely "behavior-changing". Decide per task and write the matching RED/GREEN in the task block. This keeps the SDD test-first cycle honest where it is cheap and stable, without forcing it where it produces churn.

- **Separable logic that already exists in the plan — test-first is mandatory (real RED/GREEN).** Pure functions, formatters, parsers, validators, reducers, selectors, store slices, state machines, data transforms, and hooks whose own logic is being added. The contract precedes the code, so a failing test is cheap and stable. Backend units live here too: one endpoint, one middleware, one storage method, one migration.
- **A shared, reusable unit with a settled contract — test-after, light. Test-first optional.** A primitive whose public surface maps inputs to outputs (a basic input/select/button primitive, a small reusable helper). Write one or two checks through the public interface after the unit exists.
- **A feature unit whose contract emerges while you build it — no task-level RED/GREEN.** Test observable behavior through the public interface after it stabilizes, with one check per real branch/interaction/validation, or defer it to a milestone smoke check. Never assert against internal structure, layout, or copy.
- **Pure presentation or no-logic wiring — `N/A - no behavior change` with a one-line reason.** Styling, layout, spacing, static copy, token wiring with no logic, asset swaps.

Hard guardrails for this policy:

- **Never create a unit solely to make something testable.** Extracting logic into a hook, util, or wrapper is a design-time decision justified only by reuse or an independent reason to change (its own concern or lifecycle). It is never justified by size, by line count, by "this is long", or by "so there's something to test". During execution this is broadening scope under a frozen architecture: stop and record it under `## Stop/Replan Triggers`, do not refactor silently.
- **Length is not a defect the plan reacts to.** The axis is cohesion and an independent reason to change, not lines and not "logic vs markup". A unit holding a lot of logic and a lot of presentation in one file is not by itself a problem and is not a reason to split.
- **Test only the separable unit that already exists in the plan.** If logic is already its own unit, test it directly. If it lives inside a larger unit, test observable behavior through the public interface or mark `N/A`. The test step never initiates extraction.
- **A test must earn its place.** Only a real branch, interaction, or validation deserves a test. "Renders the markup" or "passes props down" is not behavior and gets no test.
- **End-to-end / cross-unit integration checks are never a task-level gate and are off by default.** Include one only as an optional milestone gate, chosen deliberately for a genuinely critical flow, and only when the repository already supports that kind of check.

Where a task gets real RED and GREEN checks, name them concretely, never just "write tests": the exact runnable command for this repository plus the expected failing signal or assertion. Do not name a specific test framework or tool in the plan; use the project's existing runner and conventions so the skill stays stack-agnostic.

Status companion for non-trivial plans:

Use the exact section headings below for the status companion so execution skills can resume deterministically:

## Current Milestone

## Milestone Status

## Current Task

## Next Task

## Stop/Replan Triggers

## Decisions and Assumptions

## Last Completed Command and Validation

## Blockers

## Execution Log

Each appended execution-log entry should start with an actual local timestamp formatted as `YYYY-MM-DD HH:MM TZ`, for example `2026-04-01 14:37 MSK`.
Generate the timestamp from the current environment using your shell's own date command (e.g. `date '+%Y-%m-%d %H:%M %Z'` on Unix shells, `Get-Date` in PowerShell), instead of inventing it from memory.
Do not use ISO-8601 UTC forms such as `2026-04-01T00:00:00Z`, do not use placeholder fragments such as `XX`, and do not default to `00:00` unless that is the real local time.

Test plan companion for non-trivial plans:

- Validation assumptions, prerequisites, and exact commands
- Server or dev-server run command and required env
- Step-level checks
- Milestone gates
- Key negative cases
- Manual or environment-dependent checks

Optional sections:

- Migration notes, only if existing users, data, configs, or external contracts are affected
- Rollback notes, only if the task changes persistent behavior or deployment state

## Rules

- Do not write production code.
- Do not include full file skeletons or long code blocks.
- Use short command snippets only for validation or naming an exact setup step.
- Prefer minimal-diff plans over idealized redesigns.
- Inspect only the repo context needed to make file-accurate steps.
- Exact file or artifact paths always.
- Use `docs/dev/plans/` as the default plans root, with one subfolder per feature: `docs/dev/plans/<feature>/`. Do not write plan files directly into the flat `docs/dev/plans/` root, and do not improvise alternate roots such as `docs/plans/`.
- If given an intent (`intent.md` under `docs/dev/plans/<feature>/`), reuse that folder as `<feature>` and do not propose a new name; write `plan.md` beside the intent. Otherwise derive `<feature>` from the feature or domain slug only, in kebab-case, propose it to the user, and let them correct it before writing. Do not bake artifact-type suffixes such as `-implementation`, `-plan`, `-design`, `-spec`, `-status`, or `-test-plan` into the folder name.
- Inside a feature folder the files are exactly `plan.md`, and when companions exist `plan-status.md` and `plan-test-plan.md` — one shared base name `plan`. Do not mix bases or put a date in the file names.
- For `plan-status.md`, use the exact heading names from `Default Output Shape`. Do not rename them or replace them with synonyms.
- In `## Execution Log`, append entries only. Each entry should start with an actual local timestamp formatted as `YYYY-MM-DD HH:MM TZ`, then record the completed task id, next task id, last command run, last validation result, and any blocker.
- In `## Current Task` and `## Next Task`, prefer exact task ids from the main plan so execution skills can resume without guesswork.
- Every task must be actionable without reinterpretation.
- Each task should name the exact file or artifact, the intended outcome, any prerequisite dependency, and a direct verification method.
- Every prerequisite named by a task must be satisfied by an earlier task, milestone, or explicit external prerequisite.
- When `Ordered atomic tasks` spans multiple milestones or is meant for autonomous execution, do not use a bare numbered checklist.
- Use a repeated task block for each atomic task with this minimum shape:
  - `Files`
  - `Outcome`
  - `Prerequisite`
  - `RED`
  - `GREEN`
  - `Verification`
- Apply the Testing policy above to choose test-first, test-after, or `N/A` per task. For a task that adds separable logic whose contract precedes the code, require an explicit test-first cycle: RED test, verify RED, GREEN code, verify GREEN, then refactor when needed. For a unit whose contract emerges during implementation, do not mandate task-level test-first; specify a behavior-through-interface check after it stabilizes, or a milestone smoke, or `N/A`.
- Do not leave the executor to invent the RED/GREEN sequence on the fly, and do not let the executor invent extractions, hooks, or utils that the plan did not call for.
- Each milestone must state its definition of done, validation gate, rollback boundary, and stop/replan rule.
- If repository-navigation helper readiness is already known during planning, record it as advisory context only. Do not assume it will still be available later; execution must re-check on activation.
- Do not silently change product behavior under the label of `normalization`.
- If the design or request is too thin to plan without making product-visible architectural decisions yourself, surface those under `Spec gaps, open questions, and allowed normalizations` or `Frozen implementation decisions` for user review — never bake them in silently. A fully-specified small change needs none of this.
- Do not leave competing architectures, dependency choices, or package layouts in the final plan. Freeze one path or stop for user input.
- If the design and repository evidence disagree on file placement, ownership, or architecture boundaries, call out the conflict explicitly instead of picking one silently.
- If the final plan intentionally deviates from the approved design, record that in an explicit `Design deviations` section with rationale.
- Every artifact referenced later in the plan pack must appear in the touched-files inventory or in an explicit external-prerequisites section.
- Compile, lint, and build checks are partial signals, not behavioral proof.
- For API, auth, persistence, contract, or user-visible behavior, include behavioral validation beyond compile or build success.
- Manual, browser-driven, or external-provider checks cannot be the only validation gate for a milestone intended for autonomous execution.
- Every validation step must be runnable as written, with any prerequisites and expected result stated explicitly.
- Tests are not a postscript. If behavior changes depend on tests for confidence, plan those tests alongside the relevant implementation tasks even if final end-to-end checks happen later.
- Surface assumptions, term normalization, and remaining unknowns explicitly.
- Omit irrelevant sections instead of filling them with boilerplate.
- If the project is small or greenfield, keep the plan short and linear, but not underspecified.
- You may delegate a focused planning pass to a subagent; use whatever planning-capable subagent the runner provides rather than depending on a specific agent name.
- If the user explicitly asks for `/write-plan`, honor that as a manual fallback.
- Do not invoke implementation skills or start coding until the user has reviewed and approved the written implementation plan pack.
- Writing the plan pack is the only deliverable of this skill. While in `writing-plans-front` do not write production code, do not scaffold or stub components, and do not start executing any task, even when the work looks small or visual. Frontend tasks are the most common place this goes wrong, so treat the urge to "just build the component" as a signal to stop and finish the plan.
- All files in the chosen artifact set must be written to disk before you ask the user to review. If the planning workflow calls for companions, the main plan alone is not a complete deliverable, and you may not hand off until `...-status.md` and `...-test-plan.md` also exist on disk.
- For frontend milestones, prefer runnable, non-interactive validation gates expressed in the project's own tooling: its test runner, its type check, its lint, and its production build. Name the exact repository command, not a specific framework. An end-to-end or integration smoke check is optional and off by default per the Testing policy. A manual "open the page and look" check may supplement a gate but cannot be the only gate for a milestone intended for autonomous execution, matching the manual-validation rule above.
- The frontend touched-files inventory must include the real surfaces a UI change spans: components, styles or style modules, stores or client state, route definitions, shared types, test files, and stories or fixtures where used.

## Smells To Avoid

- Repeating the entire spec structure instead of planning the execution delta
- Turning plan steps into pseudocode or implementation prose
- Adding low-value sections because the template asks for them
- Inventing details instead of surfacing uncertainty
- Mixing multiple status names, enum values, or terms from the spec without normalizing them
- Vague tasks such as `add validation`, `handle edge cases`, or `write tests` without saying what is being verified
- Tasks that call for a real test-first cycle but mention tests only generically instead of naming the RED and GREEN checks
- Bundling multiple independently verifiable changes into one step
- Silent product-contract changes hidden inside `normalization`
- Locking in file placement or module boundaries without reconciling them with the approved design and repo evidence
- Referencing files, commands, or entry points later in the plan that never appeared in the touched-files inventory
- Using `or`, `either`, or fallback library choices inside the final implementation plan instead of freezing one path
- Dependency order that asks the executor to build consumers before their providers, contracts, components, or helpers exist
- Compile-only validation for auth, API, persistence, migrations, or ownership-sensitive behavior
- Manual OAuth/browser testing as the only milestone gate for an autonomous plan
- Coverage claims without a runnable command that actually measures coverage
- Saying tests happen `later` while earlier tasks already rely on those tests for real confidence
- Multi-step plans with no current milestone, milestone status, or resume protocol
- Bare numbered task checklists in multi-milestone plans where the executor must infer files, prerequisites, or verification
- Milestones that omit `Stop/Replan Rule`
- Dropping the status and test-plan companions for a multi-component or multi-view feature because it "is just UI"
- Extracting logic into a hook, util, or wrapper only so there is something to test, producing a farm of single-use hooks
- Using component length or line count as a reason to split, extract, or add tests
- Mandating task-level test-first on a unit whose contract only emerges while it is being built
- Asserting against DOM structure, layout, or copy instead of observable behavior through the public interface
- Marking every UI task `N/A` to dodge testing real logic, or the reverse, forcing tests onto pure presentation
- Making an end-to-end check a task-level gate, or a default milestone gate, instead of an opt-in for a critical flow
- Naming a specific test framework, runner, or tool in the plan instead of the repository's own command
- Treating UI work as inherently untestable and falling back to a manual browser look as the only validation
- Starting to build or scaffold components inline during planning instead of writing the plan pack first

## Self-Review

After writing the plan, review it once yourself before handing it off:

1. Spec coverage: can you point from each major requirement or constraint in the design to a task, milestone gate, or test-plan check?
2. Decision freeze: make sure architecture choices, library choices, and package layout are frozen to one execution path. Replace `or` branches with one selected option or escalate to the user.
3. Contract discipline: make sure `normalization` did not silently change business behavior, API semantics, or validation rules from the approved design.
4. Inventory completeness: verify that every referenced file, command entry point, test file, and helper artifact appears in touched files or explicit external prerequisites.
5. Dependency order: verify every task precondition points to something that already exists earlier in the plan.
6. Placeholder and vagueness scan: remove `TODO`, `TBD`, implied decisions, and vague verbs that hide real work.
7. Naming consistency: make sure types, flags, enums, endpoints, components, and file names are consistent across the whole plan pack.
8. Atomicity and resumability: confirm a fresh agent can identify the current milestone, next task, stop rule, and direct verification path without rereading chat history.
9. Validation realism: confirm that every milestone gate is runnable and deterministic enough for the intended execution mode.
10. Test realism: confirm that externally visible behavior has behavioral checks, not just compile or build checks.
11. Rollback sanity: confirm rollback notes are tied to milestone boundaries or state changes, not a hand-wavy global reset.
12. Compactness check: cut repeated spec material, duplicated validation sections, and any boilerplate that does not change execution clarity.
13. Reject the plan if any multi-milestone or autonomous task omits `Files`, `Outcome`, `Prerequisite`, or `Verification`.
14. Reject the plan if any task that adds separable logic with a pre-existing contract omits explicit `RED` and `GREEN`. Do not require task-level `RED`/`GREEN` for a unit whose contract emerges during implementation; that unit uses a behavior-through-interface check after it stabilizes, a milestone smoke, or `N/A`.
15. Reject the plan if any milestone omits `Stop/Replan Rule`.
16. Reject the plan if the feature folder name bakes in artifact-type suffixes, if plan files were written into the flat `docs/dev/plans/` root instead of a `docs/dev/plans/<feature>/` subfolder, or if the main plan, status companion, and test-plan companion are not `plan.md` / `plan-status.md` / `plan-test-plan.md` inside one feature folder.
17. Frontend pack completeness: if the feature touches multiple components, views, routes, or shared client state, confirm the full plan pack (main, status, and test-plan) was written and saved to disk, not only the main plan, and that testing decisions follow the tiered Testing policy (logic units test-first, settled-contract primitives tested after through the public interface, emergent-contract units tested through the public interface or by smoke, presentation `N/A`) rather than either blanket RED/GREEN or blanket `N/A`.
18. Reject the plan if a multi-component, multi-view, or multi-route frontend feature was written as a main-plan-only artifact without its status and test-plan companions.
19. Anti-extraction and length check: confirm no task creates a hook, util, or wrapper whose only justification is testability or length, and that no task uses line count as a reason to split. Any extraction must be justified by reuse or an independent reason to change, named in the plan, not improvised by the executor.
20. Test-scope and tooling check: confirm tests target the separable unit that already exists or observable behavior through the public interface, not internal structure or copy; confirm end-to-end checks are not task-level gates and not default milestone gates; and confirm no specific test framework or tool is hard-named instead of the repository's own command.

## Execution Handoff

After saving the plan pack and finishing self-review, ask the user to review it before implementation:

> "Implementation plan written to `<plan path>`."
> "If used, companion files are at `<status path>` and `<test plan path>`."
> "Please review them and tell me if you want any changes before we start executing."

Wait for the user's response. If they request changes, update the plan and re-run self-review. After explicit approval, hand off to `executing-plans-front` for inline execution in the current session with bounded batches.
