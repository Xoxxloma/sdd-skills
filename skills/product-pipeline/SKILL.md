---
name: product-pipeline
description: Use to run the end-to-end product-skills pipeline (understand a large app → propose improvements → requirement → system requirements → implementation plan) as one guided flow, or to resume it from any stage. Coordinates the system-map, (optional) vision-audit + vision-to-backlog, propose-improvements, draft-requirement, system-requirements, and implementation-plan skills, stops for human review between stages, and maintains the traceability matrix.
version: 1.0.0
user-invocable: true
argument-hint: "[workspace-path] [--from map|vision|improve|requirement|sysreq|plan] [--imp IMP-NNN]"
---

Orchestrates the five stage skills with **human gates** between them. It does not re-implement them — it calls each in order and manages flow + traceability.

## Stage order
1. **system-map** → `product/system/`
1a. *(опц.)* **vision-audit** → `product/vision/vision-audit.md` (OPP-NNN)  ⟵ *gate: ревью стратегических разрывов*, затем **vision-to-backlog** → дополняет `product/backlog/improvements.md`
2. **propose-improvements** → `product/backlog/improvements.md`  ⟵ *gate: human picks which IMP to pursue*
3. **draft-requirement IMP-NNN** → `product/requirements/REQ-NNN.md`  ⟵ *gate: review*
4. **system-requirements REQ-NNN** → `product/system-requirements/SYS-NNN.md`  ⟵ *gate: review*
5. **implementation-plan SYS-NNN** → `product/plans/PLAN-NNN.md`

## Procedure
1. **Resolve state.** Read the workspace (default `./product/`). Detect how far it's gotten: map present? `product/vision/vision-audit.md` present? backlog present? which REQ/SYS/PLAN exist? Honor `--from` (`map|vision|improve|requirement|sysreq|plan`) to force a start stage and `--imp` to target one item.
2. **Run stages in order**, invoking the corresponding skill (`/system-map`, опц. `/vision-audit` → `/vision-to-backlog`, `/propose-improvements`, `/draft-requirement`, `/system-requirements`, `/implementation-plan`). Стратегическая стадия (`vision-audit`→`vision-to-backlog`) опциональна и питает **тот же** `improvements.md`, что и `propose-improvements` — обе дописывают один бэклог (последовательно, не параллельно), дальше цепочка `REQ→SYS→PLAN` не меняется. After each stage:
   - Print a short summary + the artifact path.
   - **Gate:** stop and ask the human to confirm/choose before the next stage — especially after `propose-improvements` (which IMP to take forward). Do not auto-pick improvements.
3. **Per-item chain.** Once an `IMP-NNN` is chosen, drive `REQ → SYS → PLAN` for it (same number throughout). You may run the chain for several chosen items.
4. **Traceability.** Maintain `product/traceability.md` — a matrix linking the chain:
   ```
   | IMP | REQ | SYS | PLAN | status |
   |-----|-----|-----|------|--------|
   | IMP-007 | REQ-007 | SYS-007 | PLAN-007 | plan-ready |
   ```
   Update the row after each stage.
5. **Resumable.** Re-running picks up where the artifacts left off; never redo a completed stage unless asked (`--from`).

## Notes
- This is a coordinator: keep your own output thin (status + next gate). The stage skills own the real work and formats.
- Respect the gates — the value of the pipeline is human-chosen scope between ideation and requirements.
- Same workspace contract and IDs as the stage skills (see the bundle README).
