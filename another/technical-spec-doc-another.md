---
name: technical-spec-doc
description: "Генерация системных требований на основании БТ: техническая спецификация с контрактами FE/BE, примерами JSON, состояниями интерфейса и планом релиза; большие задачи режет на подзадачи. Работает только поверх готового БТ. Используй: тех.спека, ТЗ на разработку, «распиши БТ для разработки»."
version: 2.0.0
allowed-tools: Read,Write,Edit,Glob,Grep,AskUserQuestion,Bash(git:*)
---

# Technical Specification Interview (BRD → Tech Spec)

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

**Для дочерней спеки барьер двойной.** Если прогон запускается на подзадачу эпика,
нужны **и** БТ, **и** `decomposition.md` родителя — без карты разреза контракты швов
брать неоткуда, и спека неминуемо переизобретёт их по-своему. Нет карты → останови ход
и попроси её (или сначала прогони зонтичный проход). Дополнительно проверь, что ключ
подзадачи присутствует в §2.0 карты: **спека для ключа, которого нет в карте, не
пишется** — либо карта устарела (сначала обнови зонтичную), либо это подзадача другого
эпика.

Do **not** offer to proceed "without the БТ, using your brief as the business layer" —
that is exactly the shortcut this guard exists to prevent. A tech spec without a БТ has no
business truth to trace to and no acceptance criteria to satisfy; producing one anyway
manufactures the very fiction this skill is built to avoid. No БТ, no spec — full stop.

## Turn 1 = questions only. No file. Questions = tool calls, not prose.

Your **first reply is ONLY questions** about the tech-gates. In turn 1 you do NOT call
any file-writing tool, do NOT produce or save the spec, do NOT emit a draft. Producing
or saving anything in your first reply is a hard violation — the spec file may appear
only from your **second** reply, after the analyst has answered.

**«Questions» означает вызовы инструмента вопросов, а не список прозой.** Именованный
анти-паттерн — **«свалка вопросов»**: вывалить все тех-гейты одним текстовым списком
(«вот 15 вопросов, ответьте») и закончить ход. Нарушение того же ранга, что запись
файла в первом ходе. Интервью многоходовое по построению: один ход = один вызов тула
(≤4 вопроса, самые критичные развилки первыми) → дождись ответов → следующий батч.
Задавать >5 вопросов в одном сообщении без вызова тула запрещено. Если ты уже
перечислил все гейты в размышлениях — это план интервью, а не сообщение аналитику:
наружу выходит только первый батч.

**Правильный первый ход (образец):** короткая проза-рамка («Прочитал БТ; спроектировал
INT-1; три развилки») + **вызов тула** с 3–4 вопросами по самым критичным ❓/🟡.
**Неправильный:** нумерованный список всех гейтов текстом и «ответьте на вопросы».

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

- **The business-requirements doc is confirmed truth for business content; the analyst
  is the source of truth for facts about existing systems** (the user running this skill
  is assumed to be that analyst — «пользователь» and «аналитик» here are the same person).
  You do not re-litigate the business; you do gate every technical decision and every
  existing-system assumption.
- **Analyst answers override your proposals, always.**
- **Output is ONE new `.md` spec.** You write no code, no repo edits, no extra files.

## Дисциплина опроса — как задавать вопросы (self-contained)

> Эти правила дублируют общий файл `.claude/rules/brd-questions.md` и действуют **даже
> если он не подгрузился в окружении**. Логика тех-гейтов (Step 3 / Step 3.5) остаётся
> выше по приоритету.

1. **Инструмент по умолчанию — интерактивный вопрос.** Гейты с закрытым набором и
   **архитектурные развилки (❓, ≥2 варианта)** задавай через тул вопросов (tappable
   options), а не прозой — включая гейт 2.5 («один инкремент» / «N подзадач по
   предложенным границам» / «отложить»); состав и границы подзадач после выбора —
   свободным текстом. Genuinely open-ended гейты без дискретных опций — можно прозой.
   Тул завершает ход — это и есть «Turn 1 = questions only», вызов тула *и есть* вопрос.
2. **Свободные значения — без засеянных смысловых вариантов:** описание технического
   решения, схемы данных/контрактов и JSON-примеры, конкретные числа НФТ (нагрузка/rps,
   SLA, TTL, таймауты), формулировки тест-кейсов готовыми опциями не оформляй.
   Genuinely open-ended (схема, JSON) — можно прозой рядом с вызовом тула (искл. (а)
   Правила 8); дискретные свободные значения (числа НФТ, номер задачи) — тулом через
   «Other».
3. **Блокирующее предусловие вместо Gate 0 — наличие подтверждённого БТ** (см. entry
   guard выше). Нет БТ (только бриф/идея) → останови ход, текстом попроси предоставить БТ.
   Не предлагай «сделать без БТ по брифу».
4. **Батчами по несколько вопросов** (тул кап на ~несколько вопросов и завершает ход —
   это нормально: шли самые критичные развилки первыми, остальное — следующими ходами).
   Поле `header` каждого вопроса — **≤ 12 символов** (сокращай заголовки, чтобы не ловить
   ошибку валидации и не тратить ходы).
5. **Легальный «отложить».** «Пока не знаю / отложить» = ⏭️. «Укажу в чате» ЗАПРЕЩЁН как
   опция — это ❓ (жди значения). **«Отложить» + дописанное конкретное значение = ответ
   (✅ этим значением), не ⏭️.**
6. **Каскад (усиление Step 3 cascade rule).** Новый вопрос, который породил ответ аналитика
   (особенно «иное / Other»), задавай **в том же опросе** (ещё один вызов тула), а не
   записывай как ❓/TBD и заканчивай ход. Гейт становится ⏭️ только если аналитика реально
   спросили и он явно отложил.
7. **Контекст / база знаний ≠ ответ.** Любое утверждение о существующем сервисе —
   гипотеза (🟡/❓), вынеси на подтверждение аналитика; не фиксируй как факт по контексту.
8. **Строгий режим — дефолт для ЛЮБОЙ модели: каждый гейт-вопрос — вызовом тула**
   (проза сопровождает вызов, но не заменяет его). «Thinking» у модели — не основание
   ослаблять режим: способность рассуждать ≠ дисциплина тянуться к тулу. Свободные
   значения принимай через free-text «Other» (нейтральный дефолт-кандидат + «Пока не
   знаю / отложить», **без засеянных смысловых вариантов**); «укажу в чате» запрещён
   как опция, «Other»-обещание без значения = ❓. Исключения: (а) genuinely open-ended
   вопрос без дискретных опций (описание решения, JSON-схема) — можно прозой рядом с
   вызовом; (б) аналитик явно попросил «спрашивай текстом» — но серия батчей и запрет
   свалки вопросов сохраняются.
9. **Пункт 11 (номер задачи) — всегда через тул как подтверждаемый дефолт** («Номер
   `ARS-123` (из папки БТ)? Подтвердите / укажите верный») или текстом, если вывести
   неоткуда. Выведенное значение — только пред-заполнение, не ответ.

## Малый контекст (окно < ~150k токенов)

Если модель работает с небольшим окном контекста (например, ~130k) или контекст
заметно исчерпан к середине опроса — включается экономный режим:

1. **Полный текст спеки — только в файл.** В чат выводи шапку, реестр тех-гейтов,
   таблицы Step 5.0/5.0.1/5.1 и «Открытые вопросы» — не весь документ. Это
   переопределяет «Show the spec in chat» из Step 4; барьеры действуют без изменений.
2. **Эталоны не подгружать.** Раздел «Reference examples» (few-shot из
   `docs/<KEY>/`) в этом режиме пропускается, если аналитик явно не попросил сверку.
3. **Каждый прогон — отдельная сессия.** Зонтичный и каждый дочерний — в свежем
   окне (это и так порядок работы при декомпозиции; здесь он обязателен). Сбор БТ
   и тех. спеку в одной сессии не совмещать.
4. **Обрыв посреди опроса — через реестр.** Контекст на исходе, гейты не закрыты:
   выведи реестр тех-гейтов (Step 3.5) в чат, останови ход, предложи продолжить в
   новой сессии. Вход для продолжения: БТ (+ `decomposition.md` для дочерней) +
   этот реестр. Файл при обрыве не пишется (реестр содержит ❓).

## Process — do these in order

### Step 0 — Intake
Read the business-requirements doc the user provides (or names a path to). Extract the
confirmed business layer (problem, end users, value, priority, roles, FR-* + acceptance
criteria) — you will carry it into the spec and trace to it, not re-ask it. Note any
`TBD`/`⚠️` already in the business doc: those propagate into your open questions.

Also capture two things for output (Step 4): the **directory of the БТ file** — the spec is
saved there or in a child folder under it (Step 4 decides) — and a **candidate task number**,
normally the **name of that folder** (the БТ's folder is named by the task number); if the
folder name isn't obviously the number, try the БТ filename/title/header (e.g. `ARS-123`,
«Задача №…»). **Для дочернего прогона** кандидат — ключ **своей** подзадачи (его называет
аналитик), а имя папки эпика становится значением строки «Родитель» в шапке. This candidate is
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

**Архитектурные развилки — обязательно явно.** Если у задачи есть ≥ 2 правдоподобных
архитектурных подхода (например: «источник = внешний сервис X» против «источник =
собственная таблица в Postgres»; «кэш живёт в BE Арсенала» против «кэш в upstream-
сервисе»; «sync HTTP» против «async через Kafka»), **скилл обязан** представить оба
подхода аналитику с плюсами/минусами и получить явный выбор. Не выбирай
«первый попавшийся» вариант, даже если он кажется проще. Источник истины — аналитик,
не ты. Для каждого подхода зафиксируй в §1.2 / §3.1 / §8:
- что выбрано (✅ или ❓);
- какие альтернативы рассмотрены и почему отвергнуты;
- какова **обратная стоимость** выбора (если передумаем после старта разработки —
  что придётся менять: DDL? контракт? схема кэша? фиче-флаги?).

Это правило — страховка от тихой подмены: скилл не должен выбрать «Судир» как источник
данных и пройти мимо сравнения с «собственная таблица», даже если первый вариант
выглядит очевидным.

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

**Last item of the gate — ALWAYS ask the task number (for the header).** Ask it every time,
**even when you already derived it** from the БТ's folder name. Deriving it is only for
pre-filling the question — you must still put it to the analyst and get an answer, never
assume it silently. Phrase it as a confirmable default («Номер задачи — `ARS-123` (из папки
БТ)? Подтвердите или укажите верный»); if nothing was derivable, ask it open («Укажите номер
задачи»). Use the question tool, as with the other gates. This is a required question, not a
placement input — the file goes into the БТ's folder regardless (Step 4).

### Step 3.5 — Gate ledger (HARD STOP before writing)
Before you write anything, emit a compact ledger of all **10 tech-gates plus the
conditional gate 2.5 and the task number (item 11)** and their status. One marker per
gate (2.5 may additionally be **н/п**, when the inventory holds a single seam):
- **✅ решено** — designed-and-confirmed 🟢, or an existing-system fact 🟡 confirmed by the
  analyst;
- **⏭️ отложено** — the analyst **was actually asked** and explicitly left it open (→ `TBD`),
  or a 🟡 assumption the analyst explicitly parked as «к валидации». A question *you* raised
  from the analyst's own answer but have **not yet asked** is NOT ⏭️ — it is ❓;
- **❓ открыто** — not yet put to / answered by the analyst — including any new question
  spawned by the analyst's own answers that you haven't asked yet, and anything you only
  know from the repo / knowledge base.

**Реестр строится строго по канонической нумерации ниже — 1–10 (+ условный 2.5) +
пункт 11, в том же порядке и с теми же названиями, что в разделе «The tech-gates to
cover».** Не
переименовывай гейты, не заводи собственную нумерацию и не «сдвигай» её под ответы
аналитика: самодельная нумерация приводит к тому, что один гейт молча подменяется
другим фактом (например, «частота опроса» встаёт на место «контракта», а сам контракт
уезжает в ✅ неспрошенным) и в итоге **фабрикуется**. Каждая строка реестра = ровно один
канонический гейт. Гейт, который смешивает 🟢-новое и 🟡-существующее (напр. 3 или 5),
закрывается ✅ **только когда закрыты все его части** — если подтверждена одна сторона,
а вторая не спрошена, гейт остаётся ❓ по второй (нельзя молча записать её `TBD`).

```
Реестр тех-гейтов (перед записью):
1.  Тип и стороны + карта сервисов/владельцев   — ✅|⏭️|❓
2.  Инвентарь взаимодействий                    — ✅|⏭️|❓
2.5 Декомпозиция (один инкремент / N подзадач)  — ✅|⏭️|❓|н/п (один шов)
3.  Владение и допущения о существующем         — ✅|⏭️|❓
4.  Контракт каждого взаимодействия (JSON, null)— ✅|⏭️|❓
5.  Ошибки и состояния (каталог + маппинг на UI)— ✅|⏭️|❓
6.  Авторизация на границе                       — ✅|⏭️|❓
7.  Данные и хранение (сущности, миграции)       — ✅|⏭️|❓
8.  Синхронность/производительность (кэш/таймауты/нагрузка) — ✅|⏭️|❓
9.  Порядок выката и совместимость (фиче-флаги, преднастройка) — ✅|⏭️|❓
10. Трассировка приёмки (FR→INT→тест)            — ✅|⏭️|❓
11. Номер задачи (для шапки)                     — ✅ отвечен аналитиком | ❓ ещё не спрошен
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

### Step 3.9 — Черновик (git) — перед записью файла

Номер задачи уже подтверждён аналитиком (пункт 11), поэтому имя выводится однозначно:
**`spec/<KEY>`** — для одиночной и зонтичной спеки это ключ задачи/эпика, для дочерней —
ключ подзадачи (`spec/SMSEC-1236`).

**Про создание черновика не спрашивай.** Действие безопасное, обратимое и невидимое для
других. Создай сам и сообщи одной фразой нетехническим языком (словарь формулировок — в Step 6).

**База ветки:** `git fetch origin`, затем от `origin/main`. Исключение — дочерняя спека,
когда `decomposition.md` ещё не попал в общую версию: тогда база — ветка зонтичной
(`spec/<PARENT-KEY>`), и это указывается в отчёте, потому что порядок слияния становится
значимым.

**Предусловия. При любом из них черновик не создаётся — сообщи и пиши на месте:**
- не git-репозиторий или нет `origin` → git-часть пропускается молча;
- незакоммиченные чужие изменения в рабочем дереве → не переключайся;
- ветка с таким именем уже есть → **переключись** на неё (это refinement-проход).

**Жёстко:** спека никогда не пишется, находясь на `main`; **git никогда не блокирует
запись файла** — не удалось создать черновик, пиши в текущей ветке и скажи об этом.
Барьеры этого скилла — только содержательные (5.0, 5.0.1, 5.1, 5.2).

### Step 4 — Write the spec
Write ONE `.md` using the template, in Russian:
- 🟢 confirmed new design → fill concretely (schemas, JSON examples, states);
- 🟡 analyst-confirmed existing fact → write plainly, tagged `🟡 подтверждено аналитиком
  (не по коду)`;
- 🟡 unconfirmed / ❓ deferred → `TBD` in-place **prefixed with its emoji** (🟡-к-валидации
  or ❓) so the kind is visible where it sits, and mirrored into «Открытые вопросы»;
- confirmed but vague → keep it and add `⚠️ Требует уточнения: …`.

**Naming and placement — три ветки, выбор по результату гейта 2.5:**

1. **Разреза нет** (гейт 2.5 = «один инкремент» или н/п) — как раньше: файл называется
   ровно **`technical_specification.md`** и кладётся **в папку исходного БТ**.
   ```
   docs/SMSEC-700/{business_requirements.md, technical_specification.md}
   ```
2. **Зонтичный прогон** (разрез подтверждён) — файл называется **`decomposition.md`** и
   кладётся в папку БТ, рядом с ним. Имя другое не случайно: по нему видно, что это
   **не документ для разработки**, а карта разреза. `technical_specification.md` на
   этом уровне не появляется.
3. **Дочерний прогон** (одна подзадача) — файл называется `technical_specification.md`
   и кладётся во **вложенную папку своего ключа** внутри папки эпика:
   ```
   docs/SMSEC-1234/
     business_requirements.md
     decomposition.md
     SMSEC-1236/technical_specification.md
   ```

**Папки.** В режиме дочерней спеки создай **ровно одну** папку — свою,
`<PARENT-KEY>/<свой ключ>/`. Не создавай папки для других подзадач, даже если знаешь
их ключи из карты: соседнюю папку создаст свой прогон. Пустых папок «на будущее» в
структуре не бывает. В остальных режимах папку по-прежнему не создавай — назначение
уже существует.

**Инварианты структуры (проверь перед записью):**
- `business_requirements.md` — ровно один, на верхнем уровне эпика; у дочерних папок
  своего БТ нет, они ссылаются на `../business_requirements.md`;
- есть `decomposition.md` → на этом же уровне нет `technical_specification.md`;
- **глубина максимум два уровня.** Если дочерняя спека сама просится на разрез — это
  сигнал, что разрез первого уровня сделан неверно. Скажи это вслух аналитику и
  вернись к гейту 2.5 родителя, не создавай третий уровень.

**Дочерняя спека самодостаточна.** Контракты швов из `decomposition.md` **копируются в
неё дословно** с пометкой «унаследовано из `../decomposition.md`, не переопределять» —
не заменяются ссылкой. Разработчик по ссылке не пойдёт, а агенту отдают ровно один
файл. Источник истины при расхождении — зонтичная (проверка побуквенного совпадения —
Step 5.2).

Never edit the
business-requirements doc or any repo/code file (you may, on a later refinement pass, update
*your own* previously-produced tech spec — see «Refinement pass»). Mirror every `TBD`,
🟡-к-валидации, and `⚠️` into «Открытые вопросы». Set «Статус готовности» = «Готово к
разработке» **только если выполнены все три условия одновременно**: (а) блок «Открытые
вопросы» пуст, (б) Step 5.1 score ≥ 9/12, (в) Step 5.0 пройден (все обязательные секции
присутствуют или явно «не применимо»). Если хоть одно не выполнено — «Требуются
уточнения». Пустого блока «Открытых вопросов» **недостаточно** для «Готово». **Show the
spec in chat AND save the file**, then give its path (в малом контексте показ в чате
сокращается — см. «Малый контекст»).

### Step 5 — Self-Review (before handoff)
Three passes — first a **structural-completeness** check (Step 5.0), then a
quantitative score (Step 5.1), then the qualitative checks (Step 5.2). Both 5.0 and
5.1 are HARD CHECKS and both must be **materialized in chat** (like the Step 3.5
ledger) — not done «в уме» and self-reported. Step 5.0: any missing mandatory section
blocks the write. Step 5.1: if score < 9 / 12 — go back, fill the gaps, re-score. Step
5.2 catches what the score can't (provenance drift, contract–FE inconsistency, etc.).

#### Step 5.0.1 — Объём (HARD CHECK — предъяви счёт)

Спеку, которую никто не дочитает, не читают вовсе. Объём — такой же барьер, как
реестр гейтов, и считается **в строках итогового `.md`**, включая таблицы и JSON.

```
Лимит = 200 + 40 × (число INT-карточек), потолок 450 строк.
decomposition.md — жёстко ≤ 80 строк.
Абсолютный потолок для любого файла — 1000 строк, без исключений.
```

Предъяви в чате строку: `Объём: 274 / 280 строк ✅ (INT-карточек: 2)`. Превысил —
режь и пересчитывай, файл не пиши.

**Потолки на элементы** — иначе слоп размазывается тонким слоем и общий лимит
обходится:

| Элемент | Лимит |
|---|---|
| одна INT-карточка вместе с JSON | ≤ 40 строк |
| §1 целиком | ≤ 15 строк |
| таблица состояний §4.3 | ≤ 12 строк |
| §8 «Допущения и открытые вопросы» | ≤ 20 строк |
| любой буллет | 1 строка, вложенных абзацев нет |

**Слоп-лист (запрещено):**
- вводные обороты: «необходимо отметить», «важно понимать», «в рамках данной задачи»,
  «как известно»;
- объяснение общеизвестного: что такое HTTP-код, зачем нужен индекс, как работает кэш;
- пересказ §2 в §3 — вместо этого ссылка: «реализует INT-1»;
- JSON с полями «для наглядности» — только минимальный валидный пример;
- **один подтверждённый факт = одна строка.** Односложное «кэш в BE» не
  разворачивается в абзац про стратегию инвалидации (это же запрещает Step 5.2 п.13 —
  здесь у запрета появляется измеримое следствие).

**Обход лимита запрещён.** Сокращать разрешено **только слоп, не факты**. Резать
обязательные секции (§6.4 откат, §6.5 преднастройка, §4.3.1 таймауты, JSON-примеры),
чтобы пролезть в лимит, нельзя. Упёрся в потолок 450 — это **не повод писать мельче,
а сигнал вернуться к гейту 2.5 и резать задачу**: лимит объёма работает как триггер
декомпозиции.

#### Step 5.0 — Структурная полнота (HARD CHECK — до score)
Пройди по шаблону вывода и убедись, что **каждая обязательная секция физически
присутствует** в черновике. Это зеркало правила «ни один гейт не остаётся неспрошенным»,
но для секций: молчаливо выкинуть обязательный раздел шаблона — такое же нарушение, как
тихий `TBD`. Обязательны: §1.1, §1.2, §1.3, §2 (**с ≥ 1 JSON-примером на каждую 🟢-карточку
INT**), «Каталог ошибок» в §2, §3.1, §3.2, §3.3, §4.1, §4.2, §4.3 (именованные состояния),
**§4.3.1 (если есть FE)**, §5.1, §5.2, §5.3, §6.1, §6.2, §6.3, **§6.4 (план отката)**,
**§6.5 (чек-лист преднастройки)**, §7, §8.

- Отсутствующая обязательная секция = **❓ (файл писать нельзя)**. Единственная легальная
  альтернатива содержимому — явная пометка внутри секции **«не применимо: <причина>»**
  (молчаливый пропуск запрещён так же, как тихий TBD).
- **§2.0 «Карта подзадач» обязательна, если разрез состоялся** (гейт 2.5 = N подзадач)
  — и только в зонтичной `decomposition.md`. В дочерней спеке §2.0 нет, но обязаны быть
  заполнены строки шапки `Тип:` и `Родитель:`.
- **§6.4 (откат) и §6.5 (преднастройка) не могут быть «не применимо», если есть что
  катить.** План отката и чек-лист преднастройки обязательны всегда, когда задача
  деплоится. Для §6.5 пройди по всем строкам чек-листа (роли, DDL, конфиги, сервисные
  аккаунты, внешние доступы, фиче-флаги, **алерты/мониторинг**, документация, **тестовые
  данные**, **план коммуникации**) — каждая либо заполнена, либо «не применимо: <причина>».

Предъяви в чате компактный список: `§X — ✅ есть | 🚫 не применимо: причина | ❓ отсутствует`.
Пока есть хоть одна ❓ — вернись в Step 4 и допиши, файл не пиши.

#### Step 5.1 — Quality Score Checklist (HARD CHECK — предъяви таблицу)
Перед записью файла **выведи заполненную таблицу в чат** (материализованный артефакт, как
реестр гейтов в Step 3.5, — а не самоотчёт «посчитал в уме») и посчитай score. Если
**score < 9 из 12** — вернись, допиши пропущенные пункты, пересчитай и снова предъяви
таблицу. **Не предъявив заполненную таблицу со счётом ≥ 9/12, файл не пиши** — это
основной барьер: именно его пропуск позволяет уехать в «Готово» с неполной спекой.

| # | Проверка | ✅/❌ |
|---|----------|-------|
| 1 | Схема БД (новые/изменённые сущности + индексы) — или явное «новых сущностей нет» | ☐ |
| 2 | Все AC-* из БТ покрыты тест-кейсами в §7 (а не только FR-*) | ☐ |
| 3 | Состояния UI в §4.3 именованные, **≥ 4**; каждое имя — валидный идентификатор для `switch/case` (camelCase/snake_case, без `=`, пробелов и выражений; `value=0` → `zero`) | ☐ |
| 4 | §4.3.1 присутствует при наличии FE: **cold-path И warm-path** таймауты (разные значения) + fallback; §5.1 его **НЕ заменяет** | ☐ |
| 5 | План отката для каждой стороны (BE / FE / DDL) — §6.4 | ☐ |
| 6 | Преднастройка (роли, DDL, конфиги, сервисные аккаунты) — чек-лист §6.5 | ☐ |
| 7 | Ссылки на конкретные модули существующего (🟡 с пометкой происхождения) | ☐ |
| 8 | HTTP-коды + null-семантика для каждого состояния (в §2 и §4.3) | ☐ |
| 9 | Прокси-путь / namespace / где живёт новая ручка — явно указан | ☐ |
| 10 | Различение «0» vs «null / нет данных» vs «источник недоступен» — три состояния | ☐ |
| 11 | KPI / приоритет / срок (или явное «не зафиксировано в БТ → унаследовано как TBD») | ☐ |
| 12 | Обращение к prior art (если в `docs/<другие задачи>/` есть релевантные спеки) | ☐ |

**Score = число ✅ из 12.** Если score < 9 — вернись к Step 3 / Step 4 и допиши
недостающее; затем пересчитай. Это **HARD CHECK** перед записью файла.

Зачем нужен score: skill-only версии в среднем набирали 5–6 / 12 (отсутствовали
схема БД, AC-трассировка, named states, rollback, pre-config). Версии с подробной
проработкой — 11–12 / 12. Чек-лист формализует эту разницу.

#### Step 5.2 — Qualitative checks
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
8. «Статус готовности» согласован с **тройным условием** из Step 4 — «Готово к
   разработке» только если ((«Открытые вопросы» пусты) И (Step 5.1 score ≥ 9/12) И
   (Step 5.0 пройден, все секции присутствуют)). Пустого блока «Открытых вопросов»
   **недостаточно**.
9. **Согласованность между секциями (consistency check).** Одни и те же сущности описаны
   одинаково везде: путь + метод каждого контракта **идентичны** в §2 / §3 / §7; имена
   полей и enum'ы совпадают между Backend (§3) и Frontend (§4) — ни одно поле не названо
   по-разному на двух сторонах; модель авторизации (кто/где проверяет, какой токен) не
   дрейфует между §2 / §3.3 / §5.3; преднастройка / сервисные аккаунты не «не требуется» в
   одном месте и «обязательно до релиза» в другом. Нашёл расхождение — приведи к одному
   описанию, не оставляй два разных в одной спеке.
10. **Гигиена контрактов.** Перечитай каждый путь / enum / имя поля на очевидные опечатки;
   один и тот же путь пишется **побуквенно одинаково** во всех секциях (§2/§3/§7).
   🟡-«подтверждено аналитиком» пути записаны ровно так, как назвал аналитик, — при
   сомнении в написании (легко посадить опечатку в чужой путь) переспроси, а не фиксируй
   как факт.
11. **Ни один релевантный anti-omission prompt не списан молча.** Sub-вопросы гейтов 4–10
   (дискретные состояния, HTTP-код при ошибке, jitter, TTL, индексы, cold/warm timeout,
   403 vs 404, аудит, порядок отката и т.д.) нельзя самому решить «нерелевантно» и
   пропустить. Каждый релевантный пункт либо **задан аналитику** (✅/⏭️), либо помечен в
   спеке явным **«не применимо: <причина>»**. Молчаливый пропуск sub-вопроса = такой же
   дефект, как тихий `TBD`: нашёл — вернись к Step 3 и задай (или пометь «не применимо»).
12. **Декомпозиция: владение и целостность.** Если разрез состоялся —
   (а) **каждый FR-* из БТ имеет ровно одну подзадачу-владельца** в §2.0; бесхозный
   FR или FR у двух владельцев = дефект карты, вернись к гейту 2.5;
   (б) ни одна сущность не имеет двух писателей без зафиксированной политики
   конфликта и признака происхождения записи;
   (в) контракт шва в дочерней спеке совпадает с зонтичной **побуквенно** — путь,
   метод, имена полей, enum'ы. Расхождение правится в пользу зонтичной;
   (г) в дочерней спеке заполнены `Тип:` и `Родитель:`, а унаследованные контракты
   помечены «не переопределять».
13. **Подтверждение не раздуто в ассерченный факт.** Односложный ответ аналитика («да»,
   «кэш в BE», «≈30с») — это подтверждение **ровно того, что он сказал**, а не мандат
   дописать вокруг него абзац деталей (конкретный TTL, стратегию инвалидации, набор
   индексов, список Out-of-scope), которые аналитик не называл. 🟢-новое проектируй
   концертно — это работа скилла; но 🟡-существующее и додуманные детали, которых не было
   в ответе, — это **гипотеза** (🟡-к-валидации / ❓), а не факт. Один подтверждённый факт =
   одна строка, а не абзац домысла вокруг него.

### Step 6 — Handoff
Report concisely: the file path, «Статус готовности», and the list of open items the
analyst still needs to resolve (❓ forks and 🟡-к-валидации assumptions).

**Сохранение и публикация — нетехническим языком.** Словарь (встроен — работает и без
`.claude/rules/brd-questions.md`): ветка → «черновик»; коммит → «сохранил версию»;
push → «выложить в общий репозиторий, команда увидит»; pull request → «отправить на
согласование»; `main` → «общая версия». Эвфемизм не подменяет последствие: формулировка
называет, кто увидит результат («обновить ветку», «синхронизировать» — запрещены).
Техническая деталь — строкой ниже, курсивом.

1. **Сохрани версию сразу, без вопроса.** `git add` — **только явным путём своего
   файла**, никогда `-A` и никогда `.`. Сообщение фиксированного формата:
   ```
   SMSEC-1236: тех. спека — Готово к разработке (Score 11/12, 218 строк)
   SMSEC-1234: карта подзадач — 4 подзадачи (62 строки)
   ```
   Score и число строк берутся из Step 5.1 и 5.0.1 — соврать в коммите, не соврав в
   предъявленных таблицах, нельзя.
2. **Сообщи результат:** путь, статус готовности, фразу о том, что документ пока виден
   только пользователю. Строка про черновик — ниже, курсивом: `*черновик: spec/SMSEC-1236*`.
   Для дочерней спеки, собранной поверх несмерженной зонтичной, добавь, что документ
   опирается на ещё не опубликованную карту подзадач.
3. **Единственный git-вопрос — про публикацию** (через тул): «Выложить документ в общий
   репозиторий? После этого его увидит команда» / «Пока оставить только у себя». При
   статусе «Требуются уточнения» добавь предупреждение о числе открытых вопросов. Отказ —
   нормальный исход.
4. **После публикации** предложи отправить на согласование; создавай только по
   подтверждению, при «Требуются уточнения» — черновиком (draft). Если правка меняет
   **контракт шва**, скажи об этом прямо: её обязаны просмотреть все команды-потребители
   этого контракта по §2.0 карты — это breaking change, а не обычная правка.
5. **Запрещено:** `--force`, `--no-verify`, коммит напрямую в `main`, автомерж,
   добавление в коммит чужих файлов.

Эти шаги идут **после** содержательного отчёта и никогда не заменяют перечень открытых
вопросов к аналитику.

## Refinement pass (closing the gaps later)

An accepted-but-incomplete БТ (or unresolved forks) legitimately leaves `TBD` /
🟡-к-валидации / ❓ in the first spec — that is expected, not a failure. The spec is meant
to be iterated: the analyst comes back with answers and you close the gaps.

When the user returns to fill open questions (they answer some «Открытые вопросы», confirm
a 🟡 assumption, or resolve a ❓ fork):

- The entry guard and "turn-1 = questions only" rule are for the **initial** run and do
  **not** re-apply here — the БТ and a spec already exist. Go ahead and update.
- **Черновик не создавай заново** — ветка `spec/<KEY>` уже существует, переключись на
  неё и сохрани новую версию поверх (Step 3.9). Если правка меняет **контракт шва**,
  скажи это прямо в отчёте: такую правку обязаны просмотреть все команды-потребители
  контракта по §2.0 карты, а задачи-потребители возвращаются в переоценку.
- **Правка контракта шва в дочерней спеке в одиночку недопустима.** Сначала правится
  зонтичная `decomposition.md`, затем все дочерние, которые к этому шву прицеплены —
  иначе побуквенное совпадение (Step 5.2 п.12в) разъедется.
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
you write (Step 3.5). Gate 2.5 is **conditional**: mandatory when the interaction
inventory holds ≥ 2 independent seams, not asked at all when there is a single contract.
Bracket = the spec section it lands in.

1. **Тип и стороны** — FE-only / BE-only / fullstack, и **карта затронутых сервисов**
   (какие сервисы участвуют и кто их владелец/команда). → §1, §6
2. **Инвентарь взаимодействий** — список новых/изменённых границ (что с чем начинает
   общаться и как: FE↔BE, сервис↔сервис, событие). Это ядро. Для чисто фронтовой задачи
   без контрактов пустой инвентарь («новых/изменённых взаимодействий нет») — это валидный
   подтверждённый ответ (✅), а не открытый вопрос. → §2
2.5. **Декомпозиция** *(условный гейт — применяется, только когда в инвентаре ≥ 2
   независимых шва; при одном контракте не задаётся вовсе)*. Один это поставляемый
   инкремент или N подзадач. → §2.0, `decomposition.md`

   **Момент разреза — именно здесь, после гейта 2 и до гейта 3.** Инвентарь
   взаимодействий — это и есть список швов, по которым можно резать. Раньше резать
   нечем (контрактов ещё нет), позже — больно (общая сущность уже спроектирована
   внутри одной спеки).

   #### Gate 2.5 — anti-omission prompt

   Предложи разрез и прогони по нему **пять критериев атомарности**. Разрез валиден,
   только если выполняется **каждый**:
   1. **Шов = именованный контракт.** Между подзадачами лежит зафиксированный
      API / событие / схема. Не можешь назвать контракт — разреза нет.
   2. **Один владелец на запись.** Ровно одна подзадача создаёт сущность и владеет
      миграцией; остальные читают. Две подзадачи, пишущие в одну сущность,
      независимыми не являются никогда.
   3. **Самостоятельная выкатываемость.** Каждая едет в прод в одиночку (под флагом),
      ничего не ломая. Если B бесполезна до A — это допустимо, но это **порядок**, и
      он фиксируется явно.
   4. **Свой непустой набор AC-*.** Подзадача без собственных критериев приёмки — не
      подзадача, а технический шаг чужой.
   5. **Тестируемость на заглушке.** Подзадачу можно проверить, замокав соседа. Не
      можешь — шов не контракт, а протечка.

   **Ловушка «разреза по фичам».** Деление по пользовательским функциям («интеграция /
   ручное редактирование / отчёт») выглядит независимым, но обычно валится по
   критерию 2: все части трогают одну сущность. Честный разрез почти всегда требует
   **отдельной подзадачи-фундамента**, которая владеет сущностью и контрактом, а
   остальные становятся её писателями и читателями.

   **Две оси разреза — предложи обе (через тул, это архитектурная развилка ❓).**
   Прежде чем фиксировать границы, покажи аналитику обе стратегии с плюсами/минусами
   и получи явный выбор:
   - **По швам контрактов** (техническая независимость): фундамент + писатели/читатели
     вокруг него. Плюс: параллельная разработка, чистые контракты с первого дня.
     Минус: пользователь видит ценность только после сборки нескольких частей.
   - **Вертикальный срез ценности** (тонкий MVP): минимальный сквозной путь через все
     слои (урезанный фид → урезанный отчёт), полнота и удобства — следующими
     итерациями. Плюс: раннее подтверждение, что фича вообще нужна. Минус: контракты
     пересматриваются при расширении, больше доработок.
   - Частый правильный ответ — **комбинация**: фундамент (#0) + тонкий вертикальный
     срез первым инкрементом, остальное следом. Критерии атомарности выше действуют
     при любой оси. Выбранную ось и почему зафиксируй в §2.0 (строка «Ось разреза»).

   **Правило двух писателей.** Если ≥ 2 подзадачи пишут в одну сущность — обязательно
   спроси про **политику конфликта** (кто побеждает при расхождении) и про **признак
   происхождения** записи. Без этого подзадачи не независимы.

   **Обратная петля в БТ.** Политика конфликта — вопрос **бизнесовый**, а не
   техническая развилка. Не прячь его в §8: задай аналитику, и если ответа нет —
   останови ход и отправь вопрос владельцу продукта через обновление БТ. Тех. спека
   ждёт; выдумывать правило разрешения конфликта запрещено.

   При подтверждённом разрезе предупреди: дочерние спеки пишутся **отдельными
   прогонами скилла**, по одному на подзадачу, а не одним файлом.

3. **Владение и допущения о существующем** — по каждому существующему сервису/эндпоинту/
   таблице, которых касаемся: что именно, подтверждает ли аналитик (🟡 факт) или к
   валидации. → §1.2, §2, §3, §8
4. **Контракт каждого взаимодействия** — запрос/ответ, типы полей, enum'ы, семантика null,
   **пример JSON**. Для 🟢 — проектируем полностью; для 🟡 существующего — по подтверждению
   аналитика. → §2

   #### Gate 4 — anti-omission prompt
   При подтверждении контракта спроси (каждый пункт — отдельный вопрос аналитику,
   не объединяй в один):
   - Какие **дискретные состояния** данных возможны (значение / пусто / null / ошибка)?
     Зафиксируй их явно: `null` для «не знаю» и `0` для «точно ноль» — это **разные**
     значения. FE не должен уметь их случайно схлопнуть.
   - Какой **HTTP-код** при ошибке источника данных: 200+`null` или 503? Это меняет
     семантику для FE (ошибка vs валидное пустое значение).
   - Есть ли **jitter** на polling? Зачем именно (защита от thundering herd)?
   - Какой **TTL** у полей с временной меткой (`asOf` / `updatedAt`)? Через сколько
     клиент должен считать значение «устаревшим» и запросить заново?
   - **Контракт для существующего** (🟡): какой путь/метод сейчас? аналитик назвал —
     зафиксируй как факт с пометкой `подтверждено аналитиком (не по коду)`.

5. **Ошибки и состояния** — каталог ошибок (код + тело) и маппинг «ответ ↔ состояние UI»
   (значение / загрузка / прочерк «—» / ошибка / пусто). → §2, §4

   #### Gate 5 — anti-omission prompt
   При подтверждении каталога ошибок и маппинга на UI спроси:
   - Какие **HTTP-коды** мы различаем (4xx vs 5xx vs 200+payload-with-error)?
     200+error-in-body — это **другой** контракт, чем 503. FE должен различать их явно.
   - Какие **семейства ошибок** есть (сетевая / авторизация / бизнес-логика / 5xx upstream
     / таймаут)? По каждой семье — отдельный UX-сигнал и отдельная строка в каталоге.
   - Какие **именованные состояния UI** соответствуют успешному ответу (значение /
     пусто / «—» / устарело)? Каждое состояние — отдельная запись, не «прочерк когда
     ничего нет» (см. §4.3 — состояния должны быть стабильными идентификаторами).
   - Что видит пользователь при **долгом ответе** (>2 сек, >10 сек)? Это отдельное
     состояние, не ошибка.

6. **Авторизация на границе** — кто вправе вызвать/видеть, где enforced, негативные случаи.
   → §2, §3, §5.3

   #### Gate 6 — anti-omission prompt
   При подтверждении авторизации спроси:
   - На какой **границе** проверяется доступ (gateway / owning-сервис / репозиторий)?
     Если на нескольких — какая авторитетная?
   - Какие **роли** имеют доступ? Что делает каждая роль? (Сверься с ролевой моделью из БТ.)
   - Как обрабатывается **403**: показываем ошибку «нет доступа» или скрываем факт
     существования объекта (404)? Разные системы по-разному; зафиксируй.
   - Есть ли **аудит** просмотра чувствительных данных (кто, когда, какой объект)?
     Если да — где и в каком объёме.

7. **Данные и хранение** — новые/изменённые сущности и поля (концептуально), нужны ли
   миграции (тоже концептуально; точный DDL — 🟡 по реальной схеме владеющего сервиса). → §3

   #### Gate 7 — anti-omission prompt
   При подтверждении схемы данных спроси:
   - Какие **индексы** нужны для типовых запросов (по каким полям, в каком порядке)?
     Это влияет на миграцию и производительность.
   - Какой **TTL** у «живых» записей? Что происходит по истечении TTL (cron / job /
     lazy-expire)?
   - Какова **политика retention** для terminated / expired записей (храним N дней для
     аудита, удаляем сразу, переносим в архив)?
   - Какие **горячие пути** обновления (heartbeat / login / logout / cron)? Это влияет
     на нагрузку и lock-стратегию.
   - Если новых сущностей **нет** — подтверди это ЯВНО: «новых сущностей не создаём».
     Пустой ответ ≠ подтверждение. Молчаливое «ну вроде ничего нового» — это ❓.

8. **Синхронность/производительность** — sync/async, кэш (где, TTL), частота опроса,
   таймауты, ожидаемая нагрузка. → §5.1

   #### Gate 8 — anti-omission prompt
   При подтверждении sync/async и таймаутов спроси:
   - **Timeout первого запроса** (cold path) и **последующих** (warm path) — это
     **разные** значения? Зафиксируй оба.
   - Что показывать при **timeout** vs при **ошибке сети** vs при **5xx upstream** —
     это три разных состояния или одно? Зафиксируй явно.
   - Если есть **polling** — какой интервал? С **jitter** или без? Зачем именно?
   - Если есть **кэш** — где живёт, какой TTL, что инвалидирует (явный TTL / событие
     / ручной сброс)?
   - Какова **ожидаемая нагрузка** (rps, объём данных, число пользователей) — нужно
     для оценки, потребуются ли индексы / партиционирование / шардирование?

9. **Порядок выката и совместимость** — очередность деплоя сторон, обратная совместимость,
   фиче-флаги, преднастройка (роли в security-сервисе, конфиги) до релиза. → §6

   #### Gate 9 — anti-omission prompt
   При подтверждении rollout спроси:
   - Какая сторона выкатывается **первой** (обычно BE с новым контрактом — раньше FE)?
     Зафиксируй порядок и обоснование.
   - Что происходит с **существующими потребителями** контракта при выкатке? Это
     additive change или breaking change? Как сохраняем обратную совместимость?
   - Какие **фиче-флаги** нужны для поэтапного включения? Кто и когда их переключает?
   - Какая **преднастройка** обязательна ДО релиза (роли в security-сервисе, DDL-миграции,
     конфиги, сервисные аккаунты)? Перечисли как чек-лист (см. §6.5).
   - Что произойдёт при **откате** — отдельно для BE, FE и DDL-миграции (см. §6.4).

10. **Трассировка приёмки** — связка FR-* из БТ → взаимодействие → тест-кейс. → §7

    #### Gate 10 — anti-omission prompt
    Каждый **AC-* из БТ** (не только FR-*) должен быть покрыт минимум одним
    тест-кейсом. Если в БТ есть, например, AC-4 «точность ≤ 1 %» — в §7 должен быть
    **тест-кейс, проверяющий именно это**, а не только «FR-1 отображение».
    Если какой-то AC-* из БТ не покрыт тест-кейсом — это **дефект §7** и явный ❓,
    а не «приёмка по FR-* достаточна».

> UX-пожелания, схемы, доп. выгрузки из БТ — переносятся в §4/§8, если были; не блокируют.

## Output template (fill in RUSSIAN, keep this structure exactly)

Only confirmed content is filled; unconfirmed → `TBD`/🟡-к-валидации; vague → `⚠️`.
Provenance markers (🟢 / 🟡 / ❓, plus ⚠️ for vague) appear inline next to the relevant statements.

````markdown
# Техническая спецификация: [название задачи]

> **Задача:** [номер задачи — напр. ARS-123]
> **Источник (БТ):** [файл/название бизнес-требований; для дочерней — `../business_requirements.md`]
> **Тип:** [одиночная (для разработки) | зонтичная — НЕ для разработки, разработка по дочерним спекам | дочерняя (для разработки)]
> **Родитель:** [для дочерней — `../decomposition.md`; иначе строку опустить]
>
> **Статус готовности:** [Готово к разработке | Требуются уточнения]
> — «Готово к разработке» ставится только если ОДНОВРЕМЕННО: нет открытых ТЕХНИЧЕСКИХ вопросов (TBD / 🟡 к валидации / ⚠️), Quality Score ≥ 9/12 (Step 5.1), и присутствуют все обязательные секции (Step 5.0, в т.ч. §6.4 план отката и §6.5 преднастройка). Иначе — «Требуются уточнения». Унаследованные из БТ бизнес-пробелы перечисляются отдельно (§8, «Унаследовано из БТ») и сами по себе статус не блокируют.
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

## 2.0. Карта подзадач
> Только в зонтичной `decomposition.md`, когда гейт 2.5 дал разрез. В одиночной и
> дочерней спеке этой секции нет. Каждый FR-* из БТ обязан иметь ровно одного владельца.

| # | Подзадача | Ключ | Владение | Контракт шва | FR-* | Зависит от |
|---|-----------|------|----------|--------------|------|------------|
| 0 | [фундамент] | [ключ или ❓ «не заведена»] | владеет сущностью и миграцией | INT-1, INT-2 | FR-1 | — |
| 1 | ...       | ...  | пишет через INT-2 | INT-2 | FR-2 | #0 |

**Ось разреза:** [по швам контрактов / вертикальный срез ценности / комбинация — и почему; альтернатива отвергнута потому что …].
**Порядок выката:** [#0 первым, далее параллельно / иное — с обоснованием].
**Политика конфликта** *(если ≥2 писателя в одну сущность)*: [кто побеждает, признак происхождения записи].

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
[Новые/изменённые сущности и поля — концептуально (имя, тип, назначение). Нужны ли миграции —
да/нет, что меняется концептуально; точный DDL/синтаксис инструмента миграций — 🟡 по реальной
схеме владеющего сервиса. Не подтверждено — TBD.]
### 3.3. Авторизация/доступ на бэке
[Где и как enforced доступ к данным/эндпоинтам; роли; негативные случаи.]

## 4. Frontend — ответственность
> Что фронт обязан сделать относительно тех же контрактов §2.
### 4.1. Где и что меняется в UI
[Экран/элемент/компонент — стеко-агностично; какие взаимодействия §2 он вызывает.]
### 4.2. Пользовательские сценарии
[Основной поток + ветвления и исключения, как в БТ; отсылка к FR-*.]
### 4.3. Состояния (обязательно — именованные)
> Состояния должны быть **стабильными идентификаторами** (camelCase / snake_case),
> которые разработчик сможет использовать в `switch`/`case` на FE. Не «когда число
> недоступно», а `state: 'stale'`. Минимум — 4 состояния; добавляй по необходимости.

| Имя состояния | Условие | Отображение (что видит пользователь) | Когда появляется |
|---------------|---------|--------------------------------------|------------------|
| `loading`     | первый запрос в сессии / после invalidate | скелетон / спиннер / «—» | cold path |
| `value`       | ответ 2xx, `value !== null`, `value !== 0` | значение | успех с ненулевым значением |
| `zero`        | ответ 2xx, `value === 0` (валидное «ничего нет») | `0` (не «—», не пусто) | успех с нулём |
| `empty`       | ответ 2xx, `value === null` или пустой список | «—» или «нет данных» | источник говорит «пусто» |
| `stale`       | есть кэш, но `now - updatedAt > TTL` или ошибка источника при наличии кэша | последнее значение + ⚠ | источник недоступен, кэш есть |
| `error_source` | 5xx / таймаут / сеть, кэша нет | сообщение об ошибке + кнопка retry | источник полностью недоступен |
| `error_no_token` | 401 | «авторизуйтесь» | сессия истекла |
| `error_forbidden` | 403 | «нет доступа» | роль не подходит |
| `error_validation` | 400 / 422 | ошибки по полям | данные невалидны |

> Если для задачи релевантны не все состояния — оставь релевантные, нерелевантные
> пометь как «не применимо» с обоснованием (например, для чисто числового виджета
> состояние `zero` обязательно, `empty` для списка может быть не применимо).

### 4.3.1. Loading и таймауты (обязательно, если есть FE)
> Этот подраздел — обязательный. Без него FE-разработчик не знает, как долго ждать
> и что показывать во время ожидания.

- **Timeout первого запроса (cold path):** X секунд; при истечении → состояние `error_source` (или `stale`, если есть кэш).
- **Timeout последующих запросов (warm path):** Y секунд (обычно меньше cold); поведение при истечении аналогично.
- **Polling interval (если применимо):** N секунд + jitter ±M секунд (зачем — зафиксируй).
- **Что показывать во время загрузки:**
  - cold start → скелетон / спиннер / блок «Загрузка…» (выбери и зафиксируй);
  - refresh в фоне → незаметный refetch, без спиннера;
  - повторная загрузка после ошибки → кнопка retry.
- **Что показывать при таймауте vs при 5xx vs при сетевой ошибке** — см. §4.3 (это
  могут быть разные состояния или одно, но явно зафиксируй).

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
[Флаги — какие, где проверяются, кто и когда переключает. Если фиче-флагов нет —
зафиксируй явно «фиче-флагов нет, релизим атомарно с FE/BE».]
### 6.4. План отката (обязательно — для каждой стороны отдельно)
> Без плана отката релиз небезопасен. Этот подраздел обязателен; пропуск — ❓.

- **Откат только BE (FE продолжает работать со старой версией):**
  - Что происходит: FE получает 404/5xx на новый контракт? Откатывается на старый?
  - Допустимо ли это или требуется синхронный откат FE?
- **Откат только FE (BE продолжает обслуживать):**
  - Что происходит: BE продолжает отдавать новые данные, FE их игнорирует? Или
    FE уходит в режим «не показывать виджет»?
  - Если FE хранит локальный стейт — что с ним (очистить / сохранить)?
- **Откат DDL-миграции (down-migration):**
  - Что произойдёт с данными, созданными между up и down?
  - Возможен ли down без потери данных? Если нет — какова процедура (backup
    перед up, ручной перенос)?
- **Откат фиче-флага** (если есть): как быстро отключаем, что видит пользователь.

### 6.5. Преднастройка до релиза (обязательно — чек-лист)
> Все пункты — обязательны к проверке перед релизом. Если пункт не применим —
> зафиксируй явно «не применимо» с обоснованием, не молчи.

- [ ] **Роли** добавлены в `role_templates` / security-сервис (например, «Администратор
      сессий», «Читатель метрик»)
- [ ] **DDL-миграция** создана в репозитории владеющего сервиса и проверена на тестовых
      стендах
- [ ] **Конфиги** прописаны в нужных окружениях (dev / staging / prod) — `application.yml`,
      переменные окружения, секреты
- [ ] **Сервисные аккаунты** A → B настроены (если есть межсервисные вызовы): кто
      выдаёт, где регистрируется, какой scope
- [ ] **Доступы к внешним системам** (API-ключи, whitelist IP) — получены и прописаны
- [ ] **Фиче-флаги** заведены в системе флагов (если есть)
- [ ] **Алерты / мониторинг** — дашборды, алерты на ключевые ошибки (5xx, таймауты,
      ошибки источника)
- [ ] **Документация / runbook** обновлены (если есть отдельный runbook для сервиса)
- [ ] **Тестовые данные** для стенда созданы (пользователи с нужными ролями,
      сущности в БД)
- [ ] **План коммуникации** — кому сообщаем о выкатке, кто на связи в случае отката

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

## Reference examples (few-shot)

Этот раздел — навигатор по эталонным спекам, на которые можно опираться при
проработке новой задачи. Few-shot примеры помогают скиллу увидеть «как должно
выглядеть в хорошем случае», а не выдумывать структуру с нуля.

**Где искать эталоны:**
- В репозитории Арсенала уже есть пара **БТ + тех. спека**, прошедших через оба
  скилла. Например: `docs/SMSEC-666/` (БТ `business_requirements.md` + тех. спека
  `technical_specification.md`). Используй их как образец заполнения, формата
  именованных состояний, уровня детализации §2 и §7.
- Если задача попадает в уже освоенную область (виджеты, метрики, ПФО), ищи
  релевантные спеки в `docs/<TASK-KEY>*/technical_specification.md` и сверяйся
  с ними по структуре.

**Как использовать эталон:**
- Не копируй содержимое (контракты, роли, FR-*) — это про **другую** задачу и
  может противоречить новой БТ.
- Копируй **уровень детализации и формат**: как оформлены именованные состояния,
  как выглядит JSON-пример, как заполнены §6.4 (откат) и §6.5 (преднастройка),
  как выглядит строка трассировки в §7.
- Если в эталоне чего-то нет (например, §4.3.1 Loading), а в новой задаче FE
  есть — это сигнал, что эталон устарел, и в новой спеке раздел должен быть.

**Обратная связь:** если при работе со скиллом получился особенно качественный
результат (10+ / 12 по Quality Score Checklist), предложи пользователю сохранить
его как новый эталон в `docs/<TASK-KEY>/technical_specification.md` для будущих
few-shot обращений.

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