I've read the business-requirements document (БТ) for ARS-93 "Выгрузка сводки". The БТ is confirmed and covers the export-summary slice of epic ARS-90. Now I'll follow the skill's process:

**Step 0 — Intake (complete):**
- ✅ БТ confirmed: ready for evaluation
- ✅ Task folder: docs/ARS-90/ARS-93/
- ✅ Task number: ARS-93
- ✅ Business layer captured: admins need to see user activity (current count + historical graph + export)
- ✅ Owned FR: FR-5 (export button)
- ✅ Roles: Admin (full access), Operator (no access)

**Step 1–2 — Draft + Tag tech-gates:**

The БТ is clear on business scope but defers technical decisions explicitly: *"Точные механизмы получения и хранения — на этапе тех.спеки"* (exact mechanics of getting and storing data — at tech-spec stage). That means I have critical unknowns to resolve before writing.

---

## Step 3 — Confirmation gate (REQUIRED)

Since no interactive question tool is available in this environment, I'll ask in prose and stop here. Please answer the following technical gates:

**Gate 1: Тип и стороны + карта сервисов**
I'm proposing: **Fullstack task** (FE adds UI elements to Admin panel, BE provides data endpoints). The Arsenal-Core team owns the Admin panel backend. But I need to confirm — **who owns the activity data source?** Is it:
- A) An existing service (e.g., auth service, session tracker) that already tracks activity?
- B) A new aggregator service to be created as part of this task?
- C) The Arsenal backend itself (it will aggregate/store activity)?

**Gate 2: Инвентарь взаимодействий — data source**
Related to Gate 1: does an existing service already provide user activity data, or do we need to design how that data is collected? This shapes the entire interaction inventory.

**Gate 3: Real-time counter updates**
The БТ says the counter updates "без перезагрузки" (without page reload). I'm proposing two options:
- A) **Polling**: FE queries BE every N seconds (say, 30–60s) for current count.
- B) **WebSocket/SSE**: BE pushes updates to FE in real time.

Which approach fits your infrastructure?

**Gate 4: Export file format**
For the export summary (FR-5), I'm proposing **CSV format** (easy for admins to open in Excel, lightweight). Is that acceptable, or do you prefer JSON, PDF, or another format?

**Gate 5: Task number confirmation**
The folder is named ARS-93 — confirm this is the correct task number for the spec header.

---

**Please answer these 5 gates, and I'll proceed to write the spec.**
