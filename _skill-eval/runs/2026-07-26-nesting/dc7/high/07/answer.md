# Turn 1: Technical gates (questions only) — ARS-93 Выгрузка сводки

## Context

This is a **Режим B child node** of the ARS-90 epic. The architecture includes:

- **Foundation #0** (`docs/ARS-90/_foundation/technical_specification.md`): Provides shared INT-0 contract with activity data
- **Three slices:**
  - ARS-91 (Counter): displays current active users
  - ARS-92 (Modal): displays activity graph with period selector
  - **ARS-93 (Export):** adds export button to modal [THIS TASK]

All three inherit the INT-0 contract:
- `current` (int | null): current active user count
- `series` (array): points `{ts: string (ISO8601), value: int}`
- `status` (enum): `ok` | `empty` | `source_down`

---

## Critical Design Question: Export Mechanism

The task (FR-5) requires: "In the modal window there is a button to export activity summary for the selected period to a file."

**Acceptance criteria:** Given modal with period selected, when admin clicks export, they get a file with activity summary for that period.

I propose the following design and ask for confirmation:

### Proposal: FE-Only Export (No New BE Interaction)

- **Mechanism:** Export is a 🟢 **FE-only operation**
- **Data source:** Modal already fetches the activity data via the inherited INT-0 contract (for the period selected)
- **Export action:** Button formats the fetched `series` data as CSV and triggers browser download
- **File name:** `activity_<period>_<timestamp>.csv` (e.g., `activity_week_2026-07-22.csv`)
- **CSV format:** 
  ```
  timestamp,active_users
  2026-07-22T10:00:00Z,40
  2026-07-22T11:00:00Z,45
  ```
- **Error handling:** If data not yet loaded → button is disabled; if INT-0 returns `status="source_down"` → button shows error state

In this design:
- §2 contains **only INT-0** (inherited, marked 🟡 depends-on #0)
- §4.1–4.2 describe the export button and user flow
- §4.3 includes state `exported` or similar for post-download feedback

---

## Alternative: Be Endpoint Export

If instead the export should be a **new BE endpoint** (e.g., `POST /activity/export`):
- BE generates the file server-side (allows complex formatting, reports, etc.)
- FE triggers the call with period parameters
- This becomes a 🟢 **new INT-1 interaction** with its own request/response contract

---

## Questions for the Analyst

1. **Export mechanism:**
   - **Option A (Proposal):** FE-only — format INT-0 data locally, browser downloads CSV
   - **Option B (Alternative):** New BE endpoint — server generates and returns file
   - Which one?

2. **File format:** CSV, JSON, or other?

3. **Confirm task number:** **ARS-93** ✓

---

## Hold

I am pausing here per the skill's **Turn 1 = questions only** rule. Once you confirm (or correct) these gates, I will proceed to answer the remaining tech-gates and write the full technical specification in Turn 2.
