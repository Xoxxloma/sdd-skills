---
name: executing-plans-front
description: Use when there is an approved implementation plan or plan pack and execution should stay inline in the current session rather than being delegated task by task.
---

# Executing Plans

## Goal

Execute an approved implementation plan or plan pack inline while preserving narrow scope and incremental validation.

## Process

1. Start only after the written implementation plan or plan pack has been explicitly approved by the user. If no approved plan file exists on disk, do not start: return to `writing-plans-front` to produce and get approval for the plan pack first. Execution never substitutes for writing the plan.
2. Read the approved implementation plan first.
3. A plan pack lives in one feature folder `docs/dev/plans/<feature>/`. The files are always `plan.md`, `plan-status.md`, and `plan-test-plan.md`. Do not compute a base name.
4. If `plan-status.md` exists, read it before choosing the next task and treat it as the source of truth for resume state.
5. If `plan-test-plan.md` exists, read it before choosing validation commands.
6. Before choosing repository-navigation commands, check whether `Serena` or `code-index` is ready in the current environment.
7. If the approved plan or status companion names a current task, resume there. Otherwise start from the first unfinished task in the main plan.
8. Work through the plan in order and keep each implementation batch small and reviewable.
9. Follow the `RED` and `GREEN` fields exactly as the plan wrote them. Where `RED` names a real check, run it and confirm it fails for the expected reason before editing production code. Where they do not name a real check — `N/A`, blank, or a note instead of a command — take the check from `Verification` instead. If `Verification` is missing too, stop rather than invent one. If the written checks look wrong against what you find in the code, that is a stop/replan condition, not a judgement call.
10. Validate after meaningful changes, using the test plan when present.
11. If the plan defines milestones, run that milestone's `Validation Gate` from the main plan at its boundary, before starting the next milestone, and record the outcome under `## Milestone Status`. On a passing gate, proceed. On a failing gate, do not proceed: consult that milestone's `Stop/Replan Rule`, record what triggered it under `## Stop/Replan Triggers`, and stop. If the failure calls for reverting, revert no further than that milestone's `Rollback Boundary` as written in the main plan.
12. After each completed task or validation attempt, update the status companion immediately before moving on.
13. Hand off to review before declaring completion.
14. After review confirms the increment is done, remind the user to update the living project document by running `sync-project-doc`. This is a reminder, not an automatic action: do not edit `docs/dev/PROJECT.md` from this skill. If the user declines or skips it, proceed without forcing the sync.

## Rules

- Do not broaden scope beyond the approved plan.
- Reuse existing repository patterns aggressively.
- Treat missing validation as incomplete work.
- Do not treat tests as a final cleanup pass after implementation.
- When writing or changing tests, adding mocks, or considering test-only production helpers, stay within the plan: do not add mocks or production helpers that exist only to make a test pass, and do not assert against internal structure, layout, or copy.
- Use this skill for inline execution of an approved plan in the current session.
- When a status companion exists, treat it as an active control document rather than a passive note.
- Keep the status companion headings stable. Update `## Current Milestone`, `## Milestone Status`, `## Current Task`, `## Next Task`, `## Last Completed Command and Validation`, and `## Blockers`, then append a new entry under `## Execution Log`.
- Maintain `## Decisions and Assumptions` and `## Stop/Replan Triggers` as live control content, not just the log. When execution makes a decision or resolves an assumption (a normalization applied, a small choice the plan left open, an approach settled during a task), record it under `## Decisions and Assumptions` so a fresh agent sees why the work went the way it did. When a stop/replan condition is hit or newly foreseen, record it under `## Stop/Replan Triggers`. These headings are updated in place like the others; only `## Execution Log` is append-only.
- A decision or assumption belongs in `## Decisions and Assumptions`; it is not an alternative to stopping. If execution would change product-visible behavior or drift from the approved plan, that is a stop/replan condition (record it under `## Stop/Replan Triggers` and stop), not a decision to log and continue past. Do not use the decisions log to wave through scope the plan did not approve.
- Record each append-only `## Execution Log` entry with an actual local timestamp formatted as `YYYY-MM-DD HH:MM TZ`, then the completed task id, next task id, last command run, last validation result, and any blocker. The log entry is a terse trail — completed/next/command/validation/blocker only; substantive decisions and stop conditions live under their own headings above, not buried in the log. Generate the timestamp from the current environment instead of inventing it, and never use `T...Z`, placeholder fragments such as `XX`, or fake `00:00` defaults. Do not rewrite or collapse earlier log entries.
- If the main plan references a status companion but the file is missing, create `plan-status.md` beside `plan.md` with the canonical headings from `writing-plans-front` before starting implementation.
- If a repository-navigation helper is ready, record that decision and use it first for symbol lookup and file discovery before broad text-search fallback.
- If neither `Serena` nor `code-index` is ready, record the fallback decision and use repository-local tools such as `rg`.
- The Testing policy lives in `writing-plans-front` and was applied when the plan was written. Do not keep a second copy of it here and do not re-apply it to a task; a task whose `RED` and `GREEN` are `N/A` was classified that way deliberately, and reclassifying it is drift, not diligence.
- Never extract logic into a hook, util, or wrapper just to make it testable, and never split a unit because of its length. Extraction is a frozen-architecture decision: if it seems warranted, stop and record it under `## Stop/Replan Triggers` instead of refactoring. Test only the separable unit that already exists in the plan.
- Do not assert against internal structure, layout, or copy. Only a real branch, interaction, or validation earns a test; "renders markup" or "passes props down" does not.
- For frontend tasks, prefer runnable non-interactive validation expressed in the project's own tooling: its test runner, type check, lint, and production build. Name the exact repository command rather than a framework. An end-to-end or integration smoke check is optional and off by default. A manual browser look may supplement a gate but cannot be the only validation for a milestone executed inline as part of an autonomous plan.
- Do not broaden a frontend task into an unrequested restyle, component-library swap, or broad refactor. Keep each batch to the single surface the task names.
- After review confirms completion, point the user to `sync-project-doc` to fold the increment into `docs/dev/PROJECT.md`. Never modify `PROJECT.md` directly from this skill, and never block completion on the sync; it is a manual follow-up the user owns.
