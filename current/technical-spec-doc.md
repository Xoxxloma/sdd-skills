---
name: technical-spec-doc
description: >-
  Turns a confirmed business-requirements doc (the output of business-requirements-doc,
  a ТЗ / BRD / SRS) into ONE Markdown technical specification in Russian that two AI
  coding agents — one frontend, one backend — can implement against with minimal
  friction at integration and release. The spec is organized around INTERACTIONS
  (the new/changed contracts crossing service or FE/BE boundaries), not siloed
  BE/FE chapters. There is NO code access (analytical repo, code is spread across
  services): NEW interactions are fully designed by the skill; anything about an
  EXISTING service is either confirmed by the analyst (written as fact, marked
  "подтверждено аналитиком, не по коду") or stays an assumption to validate — never
  invented. Use whenever someone wants a technical spec / тех.спека / ТЗ на разработку /
  dev design / implementation spec, wants to turn business requirements into something
  developers or AI agents can build, or wants to describe a new or changed interaction
  (contract, API, integration) between services or between frontend and backend.
  Trigger even if they just hand over a business-requirements doc and say "теперь
  сделай тех.спеку" or "распиши это для разработки". This skill REQUIRES a confirmed
  business-requirements document as input — if none is provided (only a vague brief or
  idea), it stops and asks for the БТ instead of proceeding.
---

# Technical Specification Interview (BRD → Tech Spec)

## TL;DR — 5 правил, которые держи в голове всегда (ниже — только справка)

1. **Нет подтверждённого БТ → не работай:** единственный ответ — просьба дать БТ. Если БТ
   есть, первый ход всё равно = ТОЛЬКО вопросы по тех-гейтам; файл не пишешь.
2. **Пиши спеку, ТОЛЬКО когда реестр (10 гейтов + номер задачи) чист:** каждый = ✅ либо
   ⏭️, ни одного ❓. (Реестр — Step 3.5.)
3. **Уже спросил и аналитик ответил → НЕ переспрашивай отвеченное. Иди к реестру и пиши.**
   Повторный опрос закрытых гейтов — ошибка и лишний раунд. Каскад «спроси ещё» относится
   только к НОВЫМ вопросам, которые породили ответы аналитика, не к уже отвеченным.
4. **Кардинальный грех — выдать непроверенное о существующем сервисе за факт.** Новое (🟢)
   проектируй конкретно (путь, схема, JSON-пример). Про существующее — только
   🟡 подтверждено аналитиком (факт) или 🟡 к валидации. Никогда не выдумывай эндпоинт/поле
   чужого сервиса и не пиши его как установленный факт.
5. **Помечай провенанс везде** (🟢/🟡/❓; ⚠️ для расплывчатого) и **ставь статус
   механически:** есть хоть один 🟡 к валидации / TBD / ⚠️ → «Требуются уточнения», без
   суждения «блокирует ли». **Заполни КАЖДУЮ секцию шаблона** (нерелевантная → «не применимо:
   причина», не пропускай молча) и пиши лаконично — один факт = одна строка. На выходе —
   один файл `technical_specification.md` рядом с БТ.

Остальная часть скилла разворачивает эти правила. Если правило ниже кажется противоречащим
этому списку — прав список.

This skill is the sibling and inverse of `business-requirements-doc`. That skill
gathers business *why/what* and is **banned from authoring design**. This skill takes
the confirmed business doc and produces exactly the design that skill refused to
write: contracts, data shapes, conceptual migrations, UI states, rollout order.

But there is no repository to read (the code lives in many separate services this
skill cannot see). So the source of truth splits by provenance, and getting that split
right is the whole job (see "The provenance contract").

## Precondition (entry guard): no business-requirements doc → no spec.

**This skill runs only on top of a confirmed business-requirements document.** Before
anything else — before the turn-1 questions, before any drafting — verify that a
business-requirements artifact is actually present. It counts as present if the user:
attached / named a path to a business-requirements `.md` (the output of
`business-requirements-doc`), or pasted content that is clearly a business-requirements
doc (has the problem / users / value / roles / FR-* + acceptance-criteria structure).

If no such document is present — the user gave only a vague brief, a one-liner, a feature
idea, or nothing — **STOP. Do not interview, do not draft, do not write a file.** Reply
only that a technical spec must be built on a confirmed business-requirements document,
and ask them to provide the БТ (or to run `business-requirements-doc` first to produce
one). That is your entire turn.

Do **not** offer to proceed "without the БТ, using your brief as the business layer" —
that is exactly the shortcut this guard exists to prevent. A tech spec without a БТ has no
business truth to trace to and no acceptance criteria to satisfy; producing one anyway
manufactures the very fiction this skill is built to avoid. No БТ, no spec — full stop.

## Turn 1 = questions only. No file.

Your **first reply is ONLY questions** about the tech-gates. In turn 1 you do NOT call
any file-writing tool, do NOT produce or save the spec, do NOT emit a draft. Producing
or saving anything in your first reply is a hard violation — the spec file may appear
only from your **second** reply, after the analyst has answered.

The business-requirements doc is a **confirmed input** — its business content (problem,
users, value, priority, roles, acceptance criteria) was already validated with the
user and you carry it forward as truth; you do NOT re-interview those business gates.
What you interview is the **technical** layer on top: the interactions, contracts,
ownership of existing systems, data, and rollout. Those are new decisions and every one
is gated.

If you cannot answer a tech-gate, that gate is a **question you ask the analyst** —
never a value you invent and never a `TBD` you assign yourself. A gate becomes `TBD`
only after the analyst was asked and explicitly left it open.

## Goal

Produce ONE Markdown file — a technical specification **in Russian**, organized around
**interactions**, such that a frontend agent and a backend agent can each implement
their side against the same canonical contracts and meet in the middle without
after-the-fact stitching, and release without surprises.

"Minimal friction" is the success metric. Concretely that means: one canonical contract
per interaction with **real request/response JSON examples**, shared field
names/enums/null-semantics, an explicit map from backend responses to frontend states
(value / loading / "—" / error / empty), an error catalog, authorization at each
boundary, conceptual data changes, and a rollout order with backward-compatibility and
pre-configuration. Ambiguity is what causes friction; examples and explicit mappings
kill ambiguity.

The spec is **stack-agnostic**. Use HTTP/JSON as the lingua franca for contracts unless
the interaction is clearly something else (event/message/RPC), describe data as
conceptual entities + fields + types, and describe migrations conceptually (add
table/column/index …) with the note that exact DDL and migration-tool syntax are
finalized in the owning service. Do not assume a specific framework, ORM, or DB.

## The provenance contract (read before anything)

Every statement **about the design or about an existing system** carries a marker: three
provenance states (🟢 / 🟡 / ❓) plus ⚠️ as an orthogonal quality flag. Business content
carried over from the confirmed БТ needs no marker — it is already truth. Mark the rest
explicitly so a reader (human or agent) instantly knows what is safe to build verbatim
vs. what to validate.

**Дерево решений (примени к каждому утверждению):** это НОВОЕ, чего ещё нет? → 🟢,
проектируй конкретно. Это про СУЩЕСТВУЮЩИЙ сервис? → аналитик подтвердил? да →
🟡 подтверждено аналитиком (пиши фактом); нет → 🟡 к валидации (в «Открытые вопросы»).
Развилку никто не выбрал? → ❓. Подтверждено, но расплывчато? → добавь ⚠️.

- 🟢 **НОВОЕ (designed)** — a new interaction, contract, entity, field, state, or UI
  element that does not yet exist. **You design it fully and concretely** — path,
  method, request/response schema, JSON examples, enums, states. This is the deliverable
  and the point of the skill: be precise. Nobody can contradict a new contract; both
  sides simply adopt it. Concreteness here is *correct*, not a violation.

- 🟡 **ДОПУЩЕНИЕ о существующем** — anything about an already-living service (reuse an
  existing endpoint, read another service's table, rely on the auth/security service).
  You cannot verify it — there is no code. Two sub-states:
  - **подтверждено аналитиком** — the analyst confirmed it on the interview. Write it as
    fact, tagged `🟡 подтверждено аналитиком (не по коду; валидировать при интеграции)`.
    It is trustworthy for planning but was not read from source, so integration must
    still verify it.
  - **к валидации** — not confirmed by the analyst. It stays an open assumption, mirrored
    into «Открытые вопросы», never asserted as fact.

- ❓ **ОТКРЫТОЕ решение** — an architectural fork nobody has chosen yet (sync vs async,
  which service owns the feature, where the cache lives). Ask it; if unresolved it is a
  `TBD` in «Открытые вопросы».

- ⚠️ **РАСПЛЫВЧАТО (quality flag, not a provenance state)** — something confirmed but too
  vaguely to build against (e.g. «обновлять примерно раз в минуту» without a number).
  Keep it, tag `⚠️ Требует уточнения: …`, mirror into «Открытые вопросы». It is orthogonal
  to 🟢/🟡/❓ — any of them can *also* be ⚠️ when underspecified.

**The cardinal sin of this skill (its inverse of the parent's ban):** presenting an
unverified claim about an existing system as established fact. The parent skill's crime
was *authoring design*; yours is *inventing reality about services you cannot see*.
Designing a new contract precisely = good and expected. Asserting that an existing
service "already exposes GET /sessions/active returning {count}" without analyst
confirmation = the worst failure. Design freely in 🟢; never invent in 🟡.

**И даже как «гипотезу» или «предварительный пример» не выписывай конкретный путь, метод
или JSON существующего сервиса** (`GET /sessions/active`, `{ "count": 42 }` и т.п.):
правдоподобная конкретика, даже с пометкой «к валидации», ниже по потоку затвердевает в
мнимый факт. Для 🟡 существующего — описывай словами и ставь `к валидации`, поле пути
оставляй пустым или «к валидации». Конкретные request/response-примеры и JSON — ТОЛЬКО
для 🟢 нового.

- **The business-requirements doc is confirmed truth for business content; the analyst
  is the source of truth for facts about existing systems** (the user running this skill
  is assumed to be that analyst — «пользователь» and «аналитик» here are the same person).
  You do not re-litigate the business; you do gate every technical decision and every
  existing-system assumption.
- **Analyst answers override your proposals, always.**
- **Output is ONE new `.md` spec.** You write no code, no repo edits, no extra files.

## Process — do these in order

### Step 0 — Intake
Read the business-requirements doc the user provides (or names a path to). Extract the
confirmed business layer (problem, end users, value, priority, roles, FR-* + acceptance
criteria) — you will carry it into the spec and trace to it, not re-ask it. Note any
`TBD`/`⚠️` already in the business doc: those propagate into your open questions.

Also capture two things for output (Step 4): the **directory of the БТ file** — the spec is
saved there, next to the БТ — and a **candidate task number**, normally the **name of that
folder** (the БТ's folder is named by the task number); if the folder name isn't obviously
the number, try the БТ filename/title/header (e.g. `ARS-123`, «Задача №…»). This candidate is
only a pre-fill: the task number is **always** asked and confirmed by the analyst in Step 3,
never assumed from the derivation alone. It goes into the spec header.

If no business-requirements doc is present, the entry guard above already applies: stop
and ask for it — do not fall back to the user's brief. This step assumes the guard has
passed and a real БТ is in hand.

### Step 1 — Draft the design (to form proposals, not to write)
From the business doc, draft proposals for each tech-gate: the interaction inventory,
the contract shape of each new interaction, the conceptual data changes, states, rollout.
Everything here is a **proposal** until confirmed. New pieces are provisional 🟢 designs;
every touch of an existing service is a provisional 🟡 assumption you must put to the
analyst. You write nothing yet.

### Step 2 — Tag every tech-gate
For each of the 10 tech-gates set a state. A gate may carry **more than one** tag when it
mixes concerns (e.g. gate 3 «владение и допущения» or gate 5 «ошибки и состояния» can hold
both 🟢-new pieces and 🟡-existing ones) — tag each decision inside the gate, not the gate as
one lump:
- **designed** — a 🟢 new-thing proposal you will confirm the shape of;
- **assumption** — a 🟡 claim about an existing system, needs analyst confirmation;
- **fork** — a ❓ decision no one has made;
- **unknown** — no information yet.

### Step 3 — Confirmation gate (MANDATORY, before writing)

**Ask via the interactive question tool — do not wait to be told.** Reasoning models tend
not to reach for it on their own, so this is an explicit instruction: put the gate
questions to the analyst using the interactive question tool (tappable options; e.g.
`ask-user-question` / `ask_user_input`), not prose alone. Lead with a short prose frame,
then the tool call. That tool caps at a few questions per turn and ends your turn, so ask
the most decision-critical gates first (❓ forks with discrete options; 🟡 confirm /
correct / defer) and iterate over the next turns for the rest; genuinely open-ended gates
with no discrete options may be asked in prose. If the tool is unavailable in this
environment, ask in prose. Using the tool is still «Turn 1 = questions only» — the tool
call *is* the question, not a file.

Put **every** tech-gate to the analyst, batched by section (ориентировочно: Обзор/стороны /
Взаимодействия / Backend / Frontend / Данные / Нефункц. / Релиз / Трассировка). A full batch
in one turn is impossible through the question tool (it caps at a few questions and ends the
turn) — that's fine and expected: send the most decision-critical gates first, the rest over
the following turns. «Batched by section» means *group related gates*, not «ask all at once».
For each, show your proposal **and its provenance**
and ask to confirm / correct / decide:
- **designed (🟢)** → «Спроектировал так: …; годится или поправить?»
- **assumption (🟡)** → «Предполагаю, что существующий сервис … — подтвердите как
  аналитик (тогда пишу фактом с пометкой «подтверждено аналитиком»), поправьте, или
  оставляем к валидации.»
- **fork (❓)** → present the options and ask them to choose.
- **unknown** → a direct question.

Because the analysts here **know the technical details of neighbouring services** (that
is a given for this repo), push 🟡 assumptions to resolution: a confirmed 🟡 becomes fact;
only genuinely unknown ones stay to-validate.

**Keep asking until the answers stop opening new questions (cascade rule).** When the
analyst picks «иное / other» or gives a decision of their own, that answer often creates a
*new* decision point — a new fork, a new assumption, a missing contract detail. You must
put that new question to the analyst **in the same interview**, before writing. Do **not**
record it as an open item and end your turn: writing a question *you* surfaced as `TBD`/❓
**without asking it** is the silence→open error — it is only legitimately open once the
analyst was actually asked and chose to defer. So: don't re-press gates already answered,
but **do** loop on every new question the analyst's own answers raise (one more tool call),
until each is either resolved or explicitly deferred by the analyst. Only then go to the
ledger. This is what saves a wasted refinement round.

**Каскад ≠ вечное интервью.** Отвеченный гейт закрыт — второй раз его не задавай. Каскад
добавляет только те вопросы, которые **породил ответ аналитика** (новая развилка, новое
допущение). Как только каждый гейт ✅/⏭️ и новых вопросов ответы больше не открывают —
**прекрати спрашивать, выведи реестр (Step 3.5) и пиши спеку.** Если аналитик в этом ходе
прислал ответы на ранее заданные тех-гейты — это сигнал ПЕРЕХОДИТЬ К ЗАПИСИ, а не заново
их переспрашивать.

**Last item of the gate — ALWAYS ask the task number (for the header).** Ask it every time,
**even when you already derived it** from the БТ's folder name. Deriving it is only for
pre-filling the question — you must still put it to the analyst and get an answer, never
assume it silently. Phrase it as a confirmable default («Номер задачи — `ARS-123` (из папки
БТ)? Подтвердите или укажите верный»); if nothing was derivable, ask it open («Укажите номер
задачи»). Use the question tool, as with the other gates. This is a required question, not a
placement input — the file goes into the БТ's folder regardless (Step 4).

### Step 3.5 — Gate ledger (HARD STOP before writing)
Before you write anything, emit a compact ledger of all **10 tech-gates plus the task
number (item 11)** and their status. One marker per gate:
- **✅ решено** — designed-and-confirmed 🟢, or an existing-system fact 🟡 confirmed by the
  analyst;
- **⏭️ отложено** — the analyst **was actually asked** and explicitly left it open (→ `TBD`),
  or a 🟡 assumption the analyst explicitly parked as «к валидации». A question *you* raised
  from the analyst's own answer but have **not yet asked** is NOT ⏭️ — it is ❓;
- **❓ открыто** — not yet put to / answered by the analyst — including any new question
  spawned by the analyst's own answers that you haven't asked yet, and anything you only
  know from the repo / knowledge base.

```
Реестр тех-гейтов (перед записью):
1. Тип и стороны (FE/BE/fullstack) + карта сервисов и владельцев — ✅|⏭️|❓
2. Инвентарь взаимодействий — …
… (все 10)
11. Номер задачи (для шапки) — ✅ отвечен аналитиком | ❓ ещё не спрошен
```

> Пункт 11 — не «гейт дизайна», но трекается наравне: ✅ только если аналитик **явно
> ответил** на вопрос о номере (выведенное значение без ответа — это ещё ❓).

**The gate that decides whether you may write:**
- If **any** gate is **❓** → **DO NOT write the file.** Ask the remaining and any
  newly-spawned questions (via the question tool) and stop your turn.
- Write the spec **only** when every gate is **✅ or ⏭️** — and every **⏭️** becomes a `TBD`
  / 🟡-к-валидации and forces «Статус готовности: Требуются уточнения».
- The **task number** must be **explicitly answered by the analyst** before writing — always
  asked, even if you derived it (a derived value is only the question's default, not an
  answer). It fills the header line. Placement is unaffected: the file always goes into the
  БТ's folder (Step 4).

**Never fabricate to escape a ❓.** A contract detail, an owner, a rollout constraint, an
existing-service capability — if unknown, it is ❓ (ask) or 🟡-к-валидации, never a
plausible-looking invention marked "done".

### Step 4 — Write the spec
Write ONE `.md` using the template, in Russian:
- 🟢 confirmed new design → fill concretely (schemas, JSON examples, states);
- 🟡 analyst-confirmed existing fact → write plainly, tagged `🟡 подтверждено аналитиком
  (не по коду)`;
- 🟡 unconfirmed / ❓ deferred → `TBD` in-place **prefixed with its emoji** (🟡-к-валидации
  or ❓) so the kind is visible where it sits, and mirrored into «Открытые вопросы»;
- confirmed but vague → keep it and add `⚠️ Требует уточнения: …`.

**Naming and placement:** the file is always named exactly **`technical_specification.md`**
(fixed name, no task number in the filename). It is saved **in the same directory as the
source БТ file** — that directory is the task's folder, already named by the task number,
so the spec lands right next to the БТ inside the task-number folder. Do not rename the file
per task and do not create a new folder — the БТ's folder is the destination. (The task
number lives in the folder name and in the spec header, not in the filename.) Never edit the
business-requirements doc or any repo/code file (you may, on a later refinement pass, update
*your own* previously-produced tech spec — see «Refinement pass»). Mirror every `TBD`,
🟡-к-валидации, and `⚠️` into «Открытые вопросы». Set «Статус готовности» by whether that
block is empty. **Show the spec in chat AND save the file**, then give its path.

### Step 5 — Self-Review (before handoff)
Check, and fix anything that fails:
1. **Provenance is marked everywhere.** Every existing-system statement carries 🟡 (either
   "подтверждено аналитиком" or "к валидации"). No unverified claim about a service you
   cannot see is written as plain fact. Scan §2/§3/§4 token by token: any endpoint, table,
   field, status, or behaviour attributed to an *existing* service that is neither 🟢-new
   nor analyst-confirmed 🟡 is a cardinal-sin violation → downgrade to 🟡-к-валидации or
   delete.
2. **Every interaction is a usable contract.** Each 🟢 interaction has: direction/boundary,
   trigger, request + response schema, **at least one real JSON example**, enums with
   values, null-semantics, error cases, and the FE-state it maps to. A contract an agent
   cannot code against is not done.
3. **Both sides meet.** For every fullstack interaction, the Backend responsibility and the
   Frontend responsibility reference the *same* contract (same fields, same enums). No
   field named differently on the two sides.
4. **Rollout is safe.** Deploy order stated (if FE depends on a new BE contract, BE ships
   first), backward-compatibility addressed, feature flags / pre-configuration (roles,
   config) listed as pre-release steps.
5. **Traceability holds.** Every FR-* from the business doc maps to at least one interaction
   (or, for a pure FE-only change with no contract, to a UI behaviour in §4) and to at least
   one test case; every interaction traces back to an FR-* (or is flagged as design-only).
6. The Step 3.5 ledger showed **no ❓** at write time.
7. Output is exactly one `.md`; nothing else besides the spec itself (which a refinement
   pass may edit) was created or edited — no repo/code files, no extra documents.
8. «Статус готовности» matches whether «Открытые вопросы» is empty.

### Step 6 — Handoff
Report concisely: the file path, «Статус готовности», and the list of open items the
analyst still needs to resolve (❓ forks and 🟡-к-валидации assumptions).

## Refinement pass (closing the gaps later)

An accepted-but-incomplete БТ (or unresolved forks) legitimately leaves `TBD` /
🟡-к-валидации / ❓ in the first spec — that is expected, not a failure. The spec is meant
to be iterated: the analyst comes back with answers and you close the gaps.

When the user returns to fill open questions (they answer some «Открытые вопросы», confirm
a 🟡 assumption, or resolve a ❓ fork):

- The entry guard and "turn-1 = questions only" rule are for the **initial** run and do
  **not** re-apply here — the БТ and a spec already exist. Go ahead and update.
- **Update your own previously-produced tech spec in place** (edit that `.md`; do not
  spawn a second parallel spec unless the user asks). Apply only what the user actually
  answered:
  - answered ❓ fork → replace the `TBD` with the chosen design (🟢 if new);
  - confirmed 🟡 assumption → flip «к валидации» → «подтверждено аналитиком (не по коду)»
    and write it as fact;
  - still deferred → it stays `TBD` / 🟡-к-валидации.
- **Never let a refinement invent.** An unanswered gap stays open; do not quietly fill it
  because the document now "looks" nearly complete. The cardinal sin applies on every
  pass.
- After editing, **re-run Step 3.5 (ledger), Step 5 (self-review), and recompute «Статус
  готовности»** — if «Открытые вопросы» is now empty, flip it to «Готово к разработке»;
  otherwise keep «Требуются уточнения» with the shrunken list. Re-show the updated spec and
  its path.

If the *business-requirements doc itself* changed (new FR-*, changed scope), treat that as
a refinement too: re-derive the affected interactions and traceability, and surface any FR
that now lacks an interaction or test case.

## The tech-gates to cover

Gates 1–10 are **MANDATORY** — each answered by the analyst or explicitly deferred before
you write (Step 3.5). Bracket = the spec section it lands in.

1. **Тип и стороны** — FE-only / BE-only / fullstack, и **карта затронутых сервисов**
   (какие сервисы участвуют и кто их владелец/команда). → §1, §6
2. **Инвентарь взаимодействий** — список новых/изменённых границ (что с чем начинает
   общаться и как: FE↔BE, сервис↔сервис, событие). Это ядро. Для чисто фронтовой задачи
   без контрактов пустой инвентарь («новых/изменённых взаимодействий нет») — это валидный
   подтверждённый ответ (✅), а не открытый вопрос. → §2
3. **Владение и допущения о существующем** — по каждому существующему сервису/эндпоинту/
   таблице, которых касаемся: что именно, подтверждает ли аналитик (🟡 факт) или к
   валидации. → §1.2, §2, §3, §8
4. **Контракт каждого взаимодействия** — запрос/ответ, типы полей, enum'ы, семантика null,
   **пример JSON**. Для 🟢 — проектируем полностью; для 🟡 существующего — по подтверждению
   аналитика. → §2
5. **Ошибки и состояния** — каталог ошибок (код + тело) и маппинг «ответ ↔ состояние UI»
   (значение / загрузка / прочерк «—» / ошибка / пусто). → §2, §4
6. **Авторизация на границе** — кто вправе вызвать/видеть, где enforced, негативные случаи.
   → §2, §3, §5.3
7. **Данные и хранение** — новые/изменённые сущности и поля (концептуально), нужны ли
   миграции (тоже концептуально; точный DDL — 🟡 по реальной схеме владеющего сервиса). → §3
8. **Синхронность/производительность** — sync/async, кэш (где, TTL), частота опроса,
   таймауты, ожидаемая нагрузка. → §5.1
9. **Порядок выката и совместимость** — очередность деплоя сторон, обратная совместимость,
   фиче-флаги, преднастройка (роли в security-сервисе, конфиги) до релиза. → §6
10. **Трассировка приёмки** — связка FR-* из БТ → взаимодействие → тест-кейс. → §7

> UX-пожелания, схемы, доп. выгрузки из БТ — переносятся в §4/§8, если были; не блокируют.

## Output template (fill in RUSSIAN — keep these sections, but do not invent to fill them)

Only confirmed content is filled; unconfirmed → `TBD`/🟡-к-валидации; vague → `⚠️`.
**Каждая секция шаблона обязана присутствовать** — заполни подтверждённым/спроектированным
контентом ЛИБО пометь «не применимо: причина». Молчаливый пропуск секции = дефект (как тихий TBD).
**Секции держи, но пустую секцию НЕ добивай выдумкой.** Нет подтверждённого/спроектированного
контента — пиши `TBD`/🟡-к-валидации, не сочиняй правдоподобное, лишь бы заполнить. Особенно:
не выписывай конкретные эндпоинты/поля/таймауты существующих сервисов как «предварительные» —
это про 🟡, значит словами и «к валидации».
Provenance markers (🟢 / 🟡 / ❓, plus ⚠️ for vague) appear inline next to the relevant statements.

````markdown
# Техническая спецификация: [название задачи]

> **Задача:** [номер задачи — напр. ARS-123]
> **Источник (БТ):** [файл/название бизнес-требований, на которых основана спека]
>
> **Статус готовности:** [Готово к разработке | Требуются уточнения]
> — Механически, без суждения: есть хоть один открытый ТЕХНИЧЕСКИЙ пункт (TBD / 🟡 к валидации / ⚠️)? → «Требуются уточнения». Ноль таких пунктов → «Готово к разработке». 🟡 к валидации ВСЕГДА даёт «Требуются уточнения» — не рассуждай, что он «не блокирует начало работ». (Единственное исключение — унаследованные из БТ бизнес-пробелы в §8: они статус тех-спеки не меняют.)
>
> **Легенда происхождения:**
> 🟢 НОВОЕ — спроектировано в этом документе, реализуется как есть.
> 🟡 подтверждено аналитиком — факт о существующей системе со слов аналитика (не по коду; валидировать при интеграции).
> 🟡 к валидации — допущение о существующей системе, не подтверждено — уточнить.
> ❓ — открытое архитектурное решение.
> ⚠️ — подтверждено, но расплывчато: требует уточнения перед разработкой.
>
> **Открытые вопросы (решить до / во время разработки):**
> 1. [Гейт и что не решено — ❓ или 🟡 к валидации]
> 2. …
>
> *(Если открытых нет — «Все технические решения приняты, спецификация готова к разработке».)*

## 1. Обзор изменения
### 1.1. Тип и стороны
[FE-only | BE-only | Fullstack. Кратко — что меняется на уровне взаимодействия.]
### 1.2. Затронутые сервисы и владельцы
| Сервис | Роль в задаче | Владелец/команда | Происхождение |
|--------|---------------|------------------|---------------|
| ...    | новый вызов / изменение / потребитель | ... | 🟢 / 🟡 подтв. аналитиком / 🟡 к валидации |
### 1.3. Связь с бизнес-требованиями
[1–2 предложения: какую бизнес-цель из БТ реализует это изменение. Ссылка на FR-* — в §7.]

## 2. Взаимодействия (ядро)
> Одна карточка на каждое новое/изменённое взаимодействие. Это общий контракт, к которому
> независимо пишут фронт и бэк. Для 🟢 — проектируется полностью; для 🟡 существующего —
> по подтверждению аналитика.
> Если задача чисто фронтовая и новых/изменённых контрактов нет — §2 фиксирует это явно
> («новых/изменённых взаимодействий нет»), и центр тяжести спеки смещается в §4.

### INT-1. [краткое имя взаимодействия] — [🟢 / 🟡]
- **Граница/направление:** [FE → BE | Сервис A → Сервис B | событие …]
- **Триггер:** [что инициирует вызов]
- **Контракт (запрос):** [метод + путь (концептуально, стеко-агностично) / имя события; поля запроса: имя, тип, обязательность]
- **Контракт (ответ):** [поля ответа: имя, тип, семантика; enum'ы с перечислением значений; семантика null]
- **Пример запроса:** [если тела нет (GET и т.п.) — указать параметры/заголовки или «тело отсутствует»; иначе JSON ниже]
  ```json
  { ... }
  ```
- **Пример ответа (успех):**
  ```json
  { ... }
  ```
- **Ошибки:** [коды + тело + когда возникают — см. «Каталог ошибок» в конце §2]
- **Состояния UI по ответу (если есть фронт):** значение → …; загрузка → …; пусто/«—» → …; ошибка → …
- **Авторизация:** [кто вправе; где проверяется; негативный случай]
- **Происхождение:** [🟢 новое / 🟡 подтверждено аналитиком (не по коду) / 🟡 к валидации / ❓]
- **Трассировка:** [FR-* из БТ]

### INT-2. …

### Каталог ошибок (сводно) — последний подраздел §2, после всех INT-карточек
| Код | Тело/сообщение | Когда | Состояние UI |
|-----|----------------|-------|--------------|
| ... | ...            | ...   | ...          |

## 3. Backend — ответственность
> Что каждый бэк-сервис обязан сделать относительно контрактов из §2. Без выдумок о чужих
> сервисах: существующее — только 🟡-подтверждённое или к валидации.
### 3.1. По сервисам
[Сервис → какие взаимодействия из §2 он реализует/отдаёт/потребляет; новая логика (🟢);
опора на существующее (🟡 с пометкой происхождения).]
### 3.2. Данные и хранение
[Новые/изменённые сущности и поля — концептуально (имя, тип, назначение). Индексы под типовые
запросы; TTL/retention «живых» записей — если релевантно. Нужны ли миграции — да/нет, что
меняется; точный DDL — 🟡 по реальной схеме владеющего сервиса. **Новых сущностей нет — напиши
это ЯВНО** (пустой ответ ≠ подтверждение). Не подтверждено — TBD.]
### 3.3. Авторизация/доступ на бэке
[Где и как enforced доступ к данным/эндпоинтам; роли; негативные случаи.]

## 4. Frontend — ответственность
> Что фронт обязан сделать относительно тех же контрактов §2.
### 4.1. Где и что меняется в UI
[Экран/элемент/компонент — стеко-агностично; какие взаимодействия §2 он вызывает.]
### 4.2. Пользовательские сценарии
[Основной поток + ветвления и исключения, как в БТ; отсылка к FR-*.]
### 4.3. Состояния (именованные — обязательно, если есть FE)
> Стабильные идентификаторы для `switch/case` на фронте (camelCase/snake_case), не «когда
> пусто». Различай `zero` (валидный 0) / `empty` (null/нет данных) / `error_source` (источник
> недоступен) — их нельзя схлопывать. Нерелевантное состояние — «не применимо: причина».

| Имя состояния | Условие | Что видит пользователь |
|---------------|---------|------------------------|
| `loading` | первый запрос / после инвалидации | спиннер/скелетон |
| `value` | 2xx, значение ≠ null и ≠ 0 | значение |
| `zero` | 2xx, значение = 0 (валидный ноль) | «0» (не «—») |
| `empty` | 2xx, null / пустой список | «—» / «нет данных» |
| `error_source` | 5xx / таймаут / сеть | сообщение об ошибке + retry |
| `error_forbidden` | 403 | «нет доступа» |

### 4.3.1. Loading и таймауты (обязательно, если есть FE)
- **Таймаут cold-path** (первый запрос) и **warm-path** (последующие) — **разные** значения.
- **Polling** (если есть): интервал + jitter (да/нет, зачем).
- Что показывать при таймауте / 5xx / сетевой ошибке — состояния из §4.3.
### 4.4. Доступ по ролям в UI
[Что видно/скрыто по ролям; отсылка к ролевой модели из БТ.]

## 5. Нефункциональные требования
### 5.1. Синхронность, кэш, производительность
[sync/async; кэш — где и TTL; частота опроса/обновления; таймауты; ожидаемая нагрузка.]
### 5.2. Надёжность/деградация
[Поведение при недоступности источника/зависимости — как это видит пользователь и система.]
### 5.3. Безопасность/доступ (сводно)
[Итоговая матрица «кто что может» по границам, если полезно.]

## 6. Релиз и интеграция
### 6.1. Порядок выката
[Очередность деплоя сторон/сервисов и почему (напр., BE с новым контрактом — раньше FE).]
### 6.2. Обратная совместимость
[Ломается ли что-то у текущих потребителей; как избегаем.]
### 6.3. Фиче-флаги
[Флаги — какие, где проверяются, кто/когда переключает. Флагов нет — напиши явно «релизим атомарно».]
### 6.4. План отката (обязательно, если задача деплоится — иначе «не применимо: причина»)
- **Откат только BE** (FE на старой версии): что видит FE (404/5xx)? допустимо или нужен синхронный откат FE?
- **Откат только FE**: BE отдаёт новое, FE игнорирует / прячет виджет? что с локальным стейтом?
- **Откат DDL** (down-миграция): что с данными между up и down? возможен ли без потери?
### 6.5. Преднастройка до релиза (чек-лист — каждый пункт: заполни или «не применимо: причина»)
- [ ] Роли в security-сервисе
- [ ] DDL-миграция в репо владеющего сервиса
- [ ] Конфиги по окружениям (dev/staging/prod)
- [ ] Сервисные аккаунты для межсервисных вызовов
- [ ] Фиче-флаги заведены
- [ ] Алерты/мониторинг на ключевые ошибки (5xx, таймауты)

## 7. Трассировка приёмки
| FR из БТ | Взаимодействие(я) | Тест-кейс (Дано–Когда–Тогда) |
|----------|-------------------|------------------------------|
| FR-1     | INT-1             | Дано …, когда …, тогда …     |
| ...      | ...               | ...                          |

## 8. Допущения и открытые вопросы
- **🟡 Подтверждено аналитиком (не по коду):** [список — валидировать при интеграции].
- **🟡 К валидации:** [неподтверждённые допущения о существующих системах].
- **❓ Открытые решения:** [незакрытые архитектурные развилки].
- **⚠️ Требует уточнения:** [подтверждено, но расплывчато].
- **Унаследовано из БТ (бизнес-пробелы):** [TBD/⚠️, пришедшие из бизнес-требований — закрываются на стороне БТ; перечисляются здесь, но сами по себе НЕ переводят тех-спеку в «Требуются уточнения», если все технические решения приняты].
- **Приложения из БТ:** [UX-пожелания, схемы, файлы — если были].
````

## Formatting rules

- **Interactions are the spine.** Everything else (Backend, Frontend) describes
  responsibility *relative to* the contracts in §2. Never let BE and FE drift into two
  disconnected chapters with different field names.
- **Every 🟢 interaction ships a real JSON example.** Prose describes; examples remove
  doubt. An agent codes to the example.
- **Every existing-system statement is tagged 🟡** — "подтверждено аналитиком" (fact) or
  "к валидации" (open). No bare assertions about services you can't see.
- **Contracts are stack-agnostic.** HTTP/JSON by default; conceptual entities/fields/types
  for data; conceptual migrations with exact DDL deferred to the owning service.
- **Пиши лаконично — один подтверждённый факт = одна строка.** НЕ пиши: вводные обороты
  («важно понимать», «в рамках задачи»), объяснение общеизвестного (что такое HTTP-код, кэш,
  зачем индекс), пересказ §2 в §3 → ставь ссылку «реализует INT-1», JSON с полями «для
  наглядности» (только минимальный валидный пример). Односложное «кэш в BE» не разворачивай
  в абзац про стратегию инвалидации.
- **Traceability is bidirectional:** FR → interaction → test case, and back.
- **Priority/roles/acceptance semantics** come from the business doc — carry them, don't
  reinvent.
- 🟢 designs are written plainly and precisely; 🟡-к-валидации and ❓ become `TBD` and land
  in «Открытые вопросы»; vague-but-confirmed gets `⚠️`.

## Example (BT in → confirm tech-gates → write)

**User:** hands over `business-requirements-<...>.md` (e.g. the "online users indicator"
BRD) and says «сделай тех.спеку под разработку».

**Agent** reads the business doc (carries problem/users/value/priority/roles/FR forward),
drafts the design, then runs the confirmation gate **through the interactive question
tool** (prose frame + tappable options), presenting each tech-gate with provenance, e.g.:
«Спроектировал новое взаимодействие INT-1 (🟢): фронт периодически запрашивает у бэка
Арсенала число активных сессий; предлагаю ответ `{ "count": <int|null> }`, где `null` →
прочерк «—». Дальше 🟡: подсчёт активных сессий отдаёт сервис аутентификации — подтвердите
как аналитик, что такая возможность у него есть (тогда пишу фактом с пометкой «подтверждено
аналитиком»), или оставляем к валидации? И развилка ❓: кэш на 30с живёт в бэке Арсенала или
в сервисе аутентификации? Плюс порядок выката и преднастройка роли «Администратор» — до
релиза?»

If the analyst answers a fork with «иное» — say, «кэш кладём в отдельный сервис-агрегатор» —
that spawns a new question (какой сервис им владеет? он существует или новый?). The agent
asks *that* in the same interview (one more tool call) instead of writing it down as open
and stopping — closing the cascade before the ledger, so no extra refinement round is needed.

**Only after the analyst confirms** does the agent write the spec. INT-1 is designed
concretely with a JSON example (🟢). The auth-service capability is written as fact only if
the analyst confirmed it (🟡 подтверждено аналитиком); otherwise it stays 🟡-к-валидации in
«Открытые вопросы». No endpoint, table, or field of an existing service is asserted as
verified fact without that confirmation — those stayed assumptions, never smuggled in as
truth.