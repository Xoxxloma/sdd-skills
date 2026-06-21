---
name: draft-requirement
description: Use to turn a chosen improvement item (IMP-NNN from the backlog) into a proper business or technical requirement (BR/TR) — context, goal, scope, users, success metrics, constraints. Third stage of the product-skills pipeline; reads product/backlog and product/system, writes product/requirements/REQ-NNN.md. Pick "business" framing for user/value-driven changes, "technical" for internal/engineering-driven ones.
version: 1.0.0
user-invocable: true
argument-hint: "IMP-NNN [--type business|technical] [workspace-path]"
---

Expands one backlog item into a reviewable **requirement** document (business or technical).

## Inputs / outputs
- Input: an `IMP-NNN` id (required). Reads its entry in `product/backlog/improvements.md` + the referenced service cards / `system-map.md` for context.
- Output: `product/requirements/REQ-NNN.md` (**same number** as the IMP — `IMP-007 → REQ-007`).
- Template: `reference/template.md` in this skill — follow it.

## Procedure
1. **Read the source.** Load the `IMP-NNN` item and the parts of the system map it references. If the id isn't found, list available IMP ids and stop.
2. **Choose framing.** `--type` if given; else infer: user/value-facing → `business`; internal/engineering/cross-cutting → `technical`. State which and why in one line.
3. **Right-size.** A requirement covers ONE coherent change. If the IMP is actually an epic, note the split and write the requirement for the first slice (or ask which slice).
4. **Fill the template** (`reference/template.md`). Be concrete and testable:
   - **Success metrics** must be measurable (e.g. "p95 of /orders < 300ms", "WCAG AA contrast on the dashboard", "0 unhandled rejections in payment flow").
   - **Scope in/out** must be explicit — what this does NOT touch.
   - Mark unknowns in **Open questions** instead of guessing.
   - Keep `Affected services` accurate (from the map) — feeds later stages.
5. **Write** `product/requirements/REQ-NNN.md` with frontmatter (id, type, status, source IMP, services). Update `product/traceability.md` (add/refresh the `IMP-NNN → REQ-NNN` row) if it exists; create it if not.
6. **Report** a 3-line summary. End with: **Next:** `/system-requirements REQ-NNN`.

## Notes
- Requirements describe **what & why**, not how (the how is the implementation plan).
- Structure fields cleanly — they map to a Jira Epic later (title, description, acceptance at the system-requirements stage).
