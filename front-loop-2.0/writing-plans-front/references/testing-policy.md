# Testing policy (full) + Smells to avoid

Loaded on demand. The body of `SKILL.md` carries the four tiers in short form; this file
holds the rationale, the hard guardrails, and the smell list. Apply the tier per task and
write the matching `RED`/`GREEN` in the task block.

## Why test-first depends on contract maturity, not on "behavior-changing"

Whether a task gets a real RED/GREEN cycle depends on whether the contract exists before
the code, not on whether the task is loosely "behavior-changing". This keeps the SDD
test-first cycle honest where it is cheap and stable, without forcing it where it produces
churn.

- **Separable logic that already exists in the plan — test-first mandatory (real
  RED/GREEN).** Pure functions, formatters, parsers, validators, reducers, selectors,
  store slices, state machines, data transforms, and hooks whose own logic is being added.
  The contract precedes the code, so a failing test is cheap and stable. Backend units live
  here too: one endpoint, one middleware, one storage method, one migration.
- **A shared, reusable unit with a settled contract — test-after, light. Test-first
  optional.** A primitive whose public surface maps inputs to outputs (a basic input/
  select/button primitive, a small reusable helper). Write one or two checks through the
  public interface after the unit exists.
- **A feature unit whose contract emerges while you build it — no task-level RED/GREEN.**
  Test observable behavior through the public interface after it stabilizes, one check per
  real branch/interaction/validation, or defer to a milestone smoke check. Never assert
  against internal structure, layout, or copy.
- **Pure presentation or no-logic wiring — `N/A - no behavior change` with a one-line
  reason.** Styling, layout, spacing, static copy, token wiring with no logic, asset swaps.

Where a task gets real RED and GREEN, name them concretely: the exact runnable command for
this repository plus the expected failing signal or assertion. Do not name a specific test
framework or tool; use the project's existing runner so the skill stays stack-agnostic.

## Hard guardrails

- **Never create a unit solely to make something testable.** Extracting logic into a hook,
  util, or wrapper is a design-time decision justified only by reuse or an independent
  reason to change. It is never justified by size, line count, "this is long", or "so
  there's something to test". During execution this is broadening scope under a frozen
  architecture: stop and record it under `## Stop/Replan Triggers`, do not refactor silently.
- **Length is not a defect the plan reacts to.** The axis is cohesion and an independent
  reason to change, not lines and not "logic vs markup". A unit holding a lot of logic and
  a lot of presentation in one file is not by itself a problem and not a reason to split.
- **Test only the separable unit that already exists in the plan.** If logic is already its
  own unit, test it directly. If it lives inside a larger unit, test observable behavior
  through the public interface or mark `N/A`. The test step never initiates extraction.
- **A test must earn its place.** Only a real branch, interaction, or validation deserves a
  test. "Renders the markup" or "passes props down" is not behavior and gets no test.
- **End-to-end / cross-unit integration checks are never a task-level gate and are off by
  default.** Include one only as an optional milestone gate, chosen deliberately for a
  genuinely critical flow, and only when the repository already supports that kind of check.

## Smells to avoid

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
