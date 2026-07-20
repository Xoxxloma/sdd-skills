---
name: business-requirements-doc
description: >-
  Gathers business requirements and writes ONE Markdown spec (BRD→SRS) in Russian.
  It MAY read the repo as evidence, but nothing enters the spec until the user
  confirms it: every gate is put to the user and confirmed before writing, and
  anything unconfirmed becomes TBD. The mandatory first question is the linked
  Jira/SberTrack task key (SMSEC-1234); without it the spec is not written.
  Use whenever someone wants to write a ТЗ / BRD /
  SRS, formalize a request, or describe a task, feature, change, or integration for
  developers.
---

# Business Requirements Interview (BRD → SRS)

## TL;DR — 5 правил, которые держи в голове всегда (ниже — только справка)

1. **Первый ход = ТОЛЬКО вопросы.** Веди с ключа задачи Jira/SberTrack (`SMSEC-1234`).
   Файл в первом ходе не пишешь ни при каких условиях.
2. **Пиши файл, ТОЛЬКО когда реестр гейтов чист:** Gate 0 = ✅ и каждый гейт = ✅ либо
   явный ⏭️. Ни одного ❓. (Реестр — Step 3.5.)
3. **Уже спросил и пользователь ответил → НЕ переспрашивай отвеченное. Иди к реестру и
   пиши.** Повторный опрос уже отвеченных гейтов — ошибка и потеря раунда. «Спрашивай
   ещё» относится только к пунктам, которые НЕ закрыты.
4. **Ничего не выдумывай.** Заказчик, приоритет, сроки, ценность, процесс — если
   пользователь не сказал, это ❓ (спроси), а не догадка и не `TBD`. Репозиторий и любая
   база знаний (CLAUDE.md, GIGACODE.md, `services/*.md`) — это **улика**, а не ответ
   пользователя.
5. **Никакого дизайна в спеке — пиши только словами пользователя.** Ни эндпоинтов, ни
   имён сервисов/DTO/таблиц/статусов, если только пользователь не назвал их сам. Всплыло
   кодовое имя (`client-cabinet`, `reports`, `*Dto`, `MinIO`) — это база знаний, не
   пользователь: замени бизнес-фразой. Внутреннего имени сервиса у тебя нет. Один `.md`.

Остальная часть скилла разворачивает эти правила. Если правило ниже кажется противоречащим
этому списку — прав список.

## Gate 0 (FIRST, blocking) = ключ задачи Jira/SberTrack

**Прежде всего остального** скилл обязан получить от пользователя **ключ связанной
задачи в Jira/SberTrack** в формате `SMSEC-1234` (буквенный код проекта в верхнем
регистре, дефис, число — например `SMSEC-1234`, `ARS-57`). Это **самый первый вопрос**
и **жёсткий блокер**:

- Если в брифе пользователя ключа нет — твой **первый ответ начинается именно с
  требования ввести ключ задачи** (до всех остальных вопросов по гейтам). Ты можешь
  задать остальные вопросы в том же ответе, но **без ключа задачи скилл не переходит к
  записи спеки** ни при каких условиях.
- Ключ должен соответствовать шаблону `^[A-Z][A-Z0-9]+-\d+$`. Если пользователь дал
  что-то непохожее (свободный текст, ссылку без ключа, «нет задачи») — переспроси и
  попроси именно ключ вида `SMSEC-1234`. Не выдумывай ключ, не подставляй плейсхолдер,
  не помечай его `TBD` — при отсутствии ключа это **всегда ❓ (спроси)**.
- Ключ — это **Gate 0** в реестре гейтов (Step 3.5). Пока Gate 0 не заполнен реальным
  ключом от пользователя, файл спеки писать нельзя.

## Turn 1 = questions only. No file.

Your **first reply is ONLY questions** about the gates, and it **must lead with the
Gate 0 request for the Jira/SberTrack task key** (`SMSEC-1234`). In turn 1 you do NOT
call any file-writing tool, do NOT produce or save the spec, and do NOT run background
work that ends in a document or a plan. Producing or saving anything in your first reply
is a hard violation — the spec file may appear only from your **second** reply, after
the user has answered your questions **and provided a valid task key**.

If you cannot answer a gate, that gate is a **question you ask the user** — never a
value you fill and never a `TBD` you assign yourself. You may write `TBD` for a gate
**only** after the user has replied about that specific gate and chosen to leave it
open. No user reply on a gate ⇒ it stays an open question, not `TBD`.

**Having answers in context does NOT cancel the questions.** If the surrounding
repo or a project-context file (CLAUDE.md, GIGACODE.md, BUSINESS.md,
`services/*.md`, `feature-map.md`, any auto-loaded knowledge base) already appears
to answer a gate, that is still only **evidence** — it does not count as a user
reply. You must still put that gate to the user as a **hypothesis** (`proposed`)
and let them confirm or correct it. Never fill a gate from ambient context.

## Goal

Produce ONE Markdown file — a business-requirements spec **in Russian**, structured
per the template below — in which **every line was stated or explicitly confirmed by
the user.** You may read the repo as evidence to form proposals, but the repo never
speaks for the user: each gate is confirmed with the user before it is written.

The spec combines the **BRD level** ("why / what") with **SRS-level functional
detail** (what the system must do, as requirements — not a design).

## The contract (read before anything)

- **The user is the source of truth; the repo is only evidence.** Reading code can
  produce *proposals*; it can never put content into the spec by itself.
- **Project-context files and knowledge bases are evidence, not the user.** Any
  ambient or auto-loaded doc — CLAUDE.md, GIGACODE.md, BUSINESS.md,
  `services/*.md`, `feature-map.md`, system-overview, API descriptions — is treated
  exactly like the repo: it may seed a *proposal*, but no gate is ever considered
  answered on its basis. This holds even when the whole repository is a knowledge
  base full of service/API/functional detail: that detail is `proposed ·
  unconfirmed` until the user confirms it, not spec content.
- **Every gate (1–14) is put to the user before writing — no exceptions.**
  For each gate you present your current understanding (from the user's brief, from
  code, or unknown) and the user confirms, corrects, or answers. A gate is **filled**
  only when the user states or confirms it, and becomes **`TBD`** only when the user
  *explicitly* leaves it open — never from silence or your own inference.
- **User answers override code inferences, always.**
- **Nothing unconfirmed goes in as fact.** An explicitly-deferred gate is `TBD`; a
  vague confirmation is `⚠️`. You never assert a code-derived conclusion the user
  hasn't signed off, and you never invent a `TBD` for a gate the user didn't address.
- **Output is ONE new requirements `.md` — a spec, not a plan or design.** You may
  *read* the repo, but you write nothing into it: no code, no plan, no edits to
  existing files, no extra files, and never into `docs/dev/…` or a sibling skill's
  location (Step 4 says where it goes).

## Process — do these in order

### Step 0 — Intake
Read the user's brief and any local file path(s) they named. Map what is already
explicit onto the 14 gates (see "The gates to cover").

### Step 1 — Analyze the repo (optional, read-only, to form proposals)
If a codebase is present and relevant, you MAY read it (read-only) to form *draft
proposals* for gates the brief doesn't answer — e.g. who the users are, what the
current process is, which integrations exist. Keep it light and time-boxed; this is
evidence-gathering, not writing. Everything you infer here is **proposed ·
unconfirmed** — it is NOT spec content yet, and you write nothing. You may skip this
step and simply ask the user.

**Default this step OFF when the context is already saturated.** If a project
knowledge base or context file is already loaded (GIGACODE.md, BUSINESS.md,
`services/*.md`, `feature-map.md`, etc.), do NOT go read more of the repo — you
already have enough to form proposals. Reading more only pulls in more
confirmed-looking detail and biases you toward writing SRS/functional content
straight away. Instead: mark everything the context suggests as `proposed ·
unconfirmed` and go directly to the confirmation gate (Step 3). The richer the
ambient context, the *more* you must interview, not less.

### Step 2 — Tag every gate
For each of the 14 gates set a state:
- **user-stated** — the user already said it in the brief/file;
- **proposed** — you inferred it from code (unconfirmed);
- **unknown** — no information yet.

### Step 3 — Confirmation gate (MANDATORY, before writing)
**Спрашивай через интерактивный инструмент вопросов** (tappable-опции; напр.
`ask-user-question` / `ask_user_input`), а не только прозой — слабые/reasoning-модели сами
к нему не тянутся, поэтому это явная инструкция. Веди короткой прозаической рамкой, затем
вызов; инструмент сам ограничивает число вопросов за ход — шли самые важные гейты первыми,
остальные следующими ходами. Инструмент недоступен в окружении — спрашивай прозой.
Свободные значения (ключ задачи, заказчик, контакт, срок) проси ТЕКСТОМ, а не вариантом из
списка (см. блок «Укажу в чате» ниже).
Put **every** gate to the user and get confirmation. Batch by section (Контекст /
Цель и ценность / Границы / Функционал / Ограничения / Приложения) — not one gate at
a time. For each gate show your current understanding **and its source**, and ask to
confirm / correct / answer:
- **user-stated** → «Я так понял: … — верно?»
- **proposed (from code)** → «Из кода похоже, что …; это только гипотеза — подтвердите
  или поправьте.»
- **unknown** → a direct question.

Do not proceed to writing until **every gate has been put to the user and the user
has responded to it** — either answering it or explicitly leaving it open. Batch the
questions; if the user's reply skips some gates, do **one** short follow-up to pin
those down (an answer, or an explicit «пока не знаю / потом / пропускаем») rather than
re-pressing gates already answered. A gate becomes `TBD` **only** when the user
explicitly leaves it open — never from silence or your own inference. User answers
override anything you inferred from code.

**Открытые вопросы — это не финал, а сигнал «спроси ещё».** Твоя задача — по возможности
закрыть все вопросы **до** записи файла, а не оформить их в «Открытые вопросы» и
закончить. Правило:
- **Каждый будущий `TBD` и каждый `⚠️` — это отдельный вопрос, который ты обязан задать
  пользователю напрямую.** Нельзя оставить пункт открытым «по умолчанию»: открытым он
  становится только если ты его прямо спросил и пользователь **явно** отказался
  отвечать («не знаю / потом / пропускаем»).
- Если после первого раунда ответов остаются незакрытые пункты — **не пиши файл с
  ними**, а задай эти пункты одним компактным батчем и дождись ответа. Повторяй, пока
  каждый пункт не станет либо ✅ (ответ), либо явным ⏭️ (пользователь сознательно
  отложил).
- Расплывчатый ответ (`⚠️`) сначала **переспроси один раз**, чтобы получить конкретику;
  оставляй `⚠️` в файле только если пользователь подтвердил, что точнее сформулировать
  сейчас не может.
- Записывать файл с открытыми вопросами допустимо **только** когда каждый из них — это
  осознанный ⏭️ пользователя, а не то, что ты просто не дошёл спросить.

**«Укажу в чате» — это НЕ ответ, а обещание ответить.** Если ты предлагаешь варианты
ответа (например через инструмент вопросов) и пользователь выбирает вариант вида «Я
знаю, укажу в чате» / «отвечу в чате» / «напишу отдельно» / «уточню сам» — это **не
заполняет гейт** и **не является ⏭️**. Такой выбор означает ровно одно: **конкретное
значение будет дальше в чате, и его нужно дождаться.**
- Пометь гейт как **❓ (ожидает значения)**, а не ✅ и не ⏭️.
- **Не двигайся дальше и не пиши файл** — дождись, пока пользователь пришлёт само
  значение текстом. Пока значения нет, гейт закрытым не считается.
- Если пользователь выбрал «укажу в чате», но так и не прислал значение в том же
  сообщении — переспроси прямо: «Вы отметили, что укажете [гейт] в чате — напишите,
  пожалуйста, значение.»
- Не превращай «укажу в чате» в `TBD`: `TBD`/⏭️ — это осознанный отказ отвечать
  («не знаю / потом / пропускаем»), а «укажу в чате» — это намерение ответить сейчас.
- Лучше вообще не предлагать «укажу в чате» как самостоятельный вариант ответа: если
  вопрос требует свободного значения (заказчик, контакт, срок, ключ задачи и т.п.),
  проси его текстом, а не выбором из вариантов.

**Но «спрашивай ещё» ≠ «спрашивай бесконечно».** Отвеченный гейт закрыт (✅) — второй раз
его не задавай. Цель опроса — довести КАЖДЫЙ гейт до ✅ или явного ⏭️ и **перейти к записи**,
а не крутить интервью. Как только новых незакрытых пунктов не осталось — прекрати
спрашивать, выведи реестр (Step 3.5) и пиши файл. Если пользователь в этом ходе прислал
ответы на ранее заданные гейты — это сигнал ПИСАТЬ, а не повод переспросить их заново.

### Step 3.5 — Gate ledger (HARD STOP before writing)
Before you write **anything**, emit a compact ledger of **Gate 0 + all 14 mandatory
gates** and their status. Use exactly one marker per gate:
- **✅ answered** — the user stated or explicitly confirmed it;
- **⏭️ deferred** — the user was asked and *explicitly* chose to leave it open
  («не знаю / потом / пропускаем»);
- **❓ open** — not yet answered by the user (includes anything you only know from
  the repo / knowledge base — that is NOT an answer).

```
Реестр гейтов (перед записью):
0. Ключ задачи Jira/SberTrack (SMSEC-1234) — ✅|❓   ← Gate 0 не может быть ⏭️
1. Тип (новый/доработка) — ✅|⏭️|❓
2. Бизнес-процесс — …
… (все 14)
```

**The gate that decides whether you may write:**
- **Gate 0 (ключ задачи) особый: он не может быть ⏭️.** Он либо ✅ (пользователь дал
  валидный ключ вида `SMSEC-1234`), либо ❓. Если Gate 0 = ❓ — **DO NOT write the file**,
  переспроси ключ и останови ход.
- If **any** gate is **❓** → **DO NOT write the file, do NOT produce the spec.**
  Ask the remaining questions (one short batched follow-up) and stop your turn.
- You may write the spec **only** when Gate 0 is **✅** and every other gate is
  **✅ or ⏭️** — and even then, every **⏭️** becomes `TBD` and forces «Статус
  готовности: Требуются уточнения».

**Never fabricate a business gate to escape a ❓.** Заказчик, стейкхолдер, контакт,
приоритет, сроки, ценность, риски — если пользователь их не назвал, это **❓ (спроси)**,
а НЕ значение и НЕ правдоподобная догадка. Fabricating an answer and marking «готово,
открытых вопросов нет» is the single worst failure of this skill.

### Step 4 — Write the spec
Write ONE `.md` using the template, in Russian, with **only confirmed content**:
- confirmed → fill the field;
- the user **explicitly** left it open (не знаю / потом / пропускаем) → `TBD`;
- confirmed but vague (not verifiable) → keep it and add `⚠️ Требует уточнения: …`.

Save it as one new Markdown file in a **task-scoped folder under `docs/`**:

- **Путь:** `docs/<TASK-KEY>/business_requirements.md`, где `<TASK-KEY>` —
  ключ задачи из Gate 0 (например `docs/SMSEC-1234/business_requirements.md`).
- Создай подпапку `docs/<TASK-KEY>/`, если её ещё нет. Имя файла строго
  `business_requirements.md`.
- Ключ уже провалидирован в Gate 0 (`^[A-Z][A-Z0-9]+-\d+$`), поэтому подставляется в
  путь как есть; никакого другого имени/расположения не выдумывай.
- Пиши **только этот один файл**. Не редактируй существующие файлы репозитория, не
  пиши в `docs/dev/…` или в папку соседнего скилла, не создавай других файлов.

Mirror every `TBD` and `⚠️` into «Открытые вопросы». Set «Статус готовности» by
whether that block is empty. **Show the spec in chat AND save the file**, then give
its path.

### Step 5 — Self-Review (before handoff)
Check, and fix anything that fails:
0. **Gate 0 satisfied:** спека содержит реальный ключ задачи Jira/SberTrack от
   пользователя (формат `SMSEC-1234`) в шапке. Ключ не выдуман, не плейсхолдер, не
   `TBD`. Если ключа нет — файл писать было нельзя; вернись к вопросу.
1. Every filled field traces to a user statement or an explicit user confirmation —
   nothing rests on an unconfirmed code inference.
2. **No authored design (HARD BAN, scan §3.3 and §4 token by token).** Unless the
   **user** named it out loud, NONE of the following may appear anywhere in the
   spec — delete it or replace with a business-level phrase / `TBD`:
   - пути и методы эндпоинтов (`POST /passport/report`, `GET /...`, любые URL);
   - имена DTO / классов / моделей / сущностей (`PassportView`, `ReportDto`,
     `ReportCriteria`, `PassportSearchCriteria`, `*Dto`, `*View`, `*Criteria`);
   - имена сервисов / микросервисов (`passport-gateway`, `reports`, `core` …);
   - инфраструктура (MinIO, S3, Kafka, топики, БД, брокеры);
   - внутренние статусы / поля / коды (`IN_PROGRESS`, `READY`, `actorId`, id-поля);
   - имена файлов, таблиц, библиотек, capability-ID из базы знаний (`F7` и т.п.).
   These are knowledge-base facts, NOT user-confirmed content. If the business
   requirement genuinely needs one, it stays a **hypothesis** to confirm, not text
   in the spec. §3.3 says only *that* an integration/дозависимость is затронута —
   at the level of a requirement, never the API design.
   **Список выше — примеры, не исчерпывающий.** Позитивный тест по каждому токену: для
   любого технического существительного в черновике (имя сервиса, путь, поле, статус,
   хранилище, DTO, capability-ID) спроси «пользователь произнёс это сам?» — если нет,
   удали или замени бизнес-фразой. Так ловятся и имена, которых нет в списке.
3. The Step 3.5 ledger showed **no ❓** at write time; every mandatory gate is
   ✅ or ⏭️. No business gate (заказчик, стейкхолдер, контакт, приоритет, сроки,
   ценность, риски) was filled with a fabricated or "правдоподобная" value — each
   traces to a user statement; the rest are `TBD` from an explicit ⏭️.
4. Business goal is a user story; both In-/Out-of-scope present; each FR-* has a
   Given-When-Then.
5. Output is exactly one `.md`, saved at
   `docs/<TASK-KEY>/business_requirements.md` (ключ = Gate 0); никакие
   существующие файлы репозитория не изменены; no other file, plan, or code was produced.
6. «Статус готовности» matches whether «Открытые вопросы» is empty.
7. **Каждый оставшийся `TBD`/`⚠️` — это пункт, который был прямо задан пользователю и
   явно им отложен (⏭️), а не тот, что ты не успел спросить.** Если находишь открытый
   пункт, по которому пользователя не спрашивали — не оставляй его в файле как есть:
   вернись и задай вопрос (см. Step 3), затем перезапиши файл.

### Step 6 — Handoff
Report concisely: the file path and the «Статус готовности».

**Если в файле остались открытые вопросы (TBD/⚠️) — не заканчивай пассивно.** Не просто
перечисляй их — **задай их пользователю прямо здесь, в хендоффе**, как конкретные
вопросы, ожидающие ответа, и предложи дописать файл, как только он ответит. Финальный
ход при статусе «Требуются уточнения» всегда заканчивается **вопросами к пользователю**,
а не сообщением «готово, но есть открытые пункты». Молча оставить открытые вопросы и
завершить работу — это ошибка скилла: открытый вопрос всегда сопровождается просьбой на
него ответить.

## The gates to cover

These are the **exact questions the BRD file must answer.** Gates 1–14 are
**MANDATORY** — each must be answered by the user or explicitly deferred by the user
before you write (see Step 3.5). The "nice-to-have" items are optional. Bracket =
the spec section the answer lands in.

**Обязательно (mandatory — all 14 + Gate 0):**
0. **Ключ связанной задачи Jira/SberTrack** — обязательный самый первый вопрос,
   формат `SMSEC-1234` (`^[A-Z][A-Z0-9]+-\d+$`). Жёсткий блокер: без реального ключа
   от пользователя спека не пишется. Нельзя выдумать, подставить плейсхолдер или
   пометить `TBD`. → шапка спеки. См. «Gate 0» в начале скилла.
1. **Тип: новый функционал или доработка существующего** — если доработка, то
   **чего именно**. → §1.0
2. **Описание бизнес-процесса** — как процесс идёт (по подтверждению). → §4.1
3. **Ролевая модель функционала** (в свободном формате). → §5.3
4. **Бизнес-ценность** — фин. эффект / улучшение UX / качество данных. → §2.2
5. **Цель доработки** — «Я как [роль] должен иметь возможность [цель]». → §2.1
6. **Риски + меры митигации** — есть ли риски (качество данных, влияние на
   другие процессы / системы-потребители); если есть — как снижаем. → §2.3
7. **Приоритет** — High / Medium / Low. → §5.1
8. **Требуемые дедлайны + обоснование**. → §5.2
9. **Точное описание проектируемого функционала** — **гейт-запрет на неконкретные
   описания**: расплывчатую формулировку не принимаем, просим конкретику
   (что именно делает система для пользователя, на бизнес-уровне). → §4.1 / §3
10. **Проблематика** — какую проблему решает доработка. → §1.1
11. **Чёткий критерий приёмки** — «когда считаем, что готово». → §4.2
12. **Кто конечный потребитель функционала**. → §1.2
13. **Архитектурные изменения** — новая интеграция / зависимости от других
    систем (на уровне требования, не решение). → §3.3
14. **Заказчик (стейкхолдер) + контакт эксперта** для консультации. → §1.3

**Было бы хорошо (nice-to-have, необязательно — спрашивать, но не блокировать):**
- Пожелания по UX доработки (в свободном формате). → §4.1 / §6
- Приложенная схема процесса. → §6
- Дополнительные файлы / выгрузки / переписки. → §6

> Границы (что входит / что НЕ входит, §3.1/§3.2) — не отдельный вопрос, а часть
> гейта 9: конкретное описание обязано включать, что делаем и что явно НЕ делаем.

## Output template (fill in RUSSIAN — keep these sections, but do not invent to fill them)

Only confirmed content is filled; unconfirmed gates are `TBD`; vague ones get `⚠️`.
**Секции держи, но пустую секцию НЕ добивай выдумкой.** Нет подтверждённого контента —
пиши `TBD` или «не применимо», не сочиняй, лишь бы заполнить. Это относится и к
«правдоподобным» деталям, которых пользователь не называл: лишняя роль в ролевой модели,
состав полей/колонок выгрузки, размещение кнопки в UI, дополнительные шаги процесса — всё
это фабрикация, а не «нейтральное дополнение». Каждая строка спеки прослеживается к словам
пользователя.

```markdown
# Бизнес-требования: [название задачи]

> **Задача Jira/SberTrack:** [SMSEC-1234] — обязательно, задаётся первым вопросом (Gate 0).
>
> **Статус готовности:** [Готово к оценке | Требуются уточнения]
> — Механически, без суждения: в блоке «Открытые вопросы» ниже есть хоть один пункт
>   (TBD / ⚠️)? → «Требуются уточнения». Пусто → «Готово к оценке». Никогда не пиши
>   «Готово», рассуждая, что пункт «не блокирует» — решает наличие пункта, не его важность.
>
> **Открытые вопросы (требуют уточнения перед оценкой):**
> 1. [Гейт и что по нему не подтверждено]
> 2. …
>
> *(Если открытых вопросов нет — «Все ключевые данные подтверждены, спецификация готова к оценке».)*

## 1. Введение и контекст
> Во всех строках §1–§6 систему называй ТОЛЬКО словами пользователя («личный кабинет»,
> «механизм генерации файлов»), НИКОГДА кодовым именем из базы знаний (`client-cabinet`,
> `reports`, `*Dto`, `MinIO`). Внутреннего имени сервиса у тебя нет.
### 1.0. Тип изменения
[Новый функционал | Доработка существующего — если доработка, укажите чего именно.]
### 1.1. Описание проблемы (Problem Statement)
[Проблема, а не решение.]
### 1.2. Конечные потребители (End Users)
[Кто пользуется результатом.]
### 1.3. Заказчик и стейкхолдеры (Stakeholder / Sponsor)
[Кто заказчик, кто принимает результат, и контакт эксперта для консультации.]

## 2. Бизнес-требования (цели и ценность)
### 2.1. Бизнес-цель
Я как [роль] должен иметь возможность [цель], чтобы [ценность].
### 2.2. Ценность для бизнеса
[Выгода — по возможности с метрикой.]
### 2.3. Бизнес-риски и меры по снижению (Mitigation)
| Риск | Вероятность / влияние | Меры по снижению |
|------|-----------------------|------------------|
| ...  | ...                   | ...              |

## 3. Объём проекта (Scope)
### 3.1. Входит в проект (In-scope)
- [Что делаем.]
### 3.2. Не входит в проект (Out-of-scope)
- [Что явно НЕ делаем.]
### 3.3. Архитектурные изменения и интеграции
[Только то, что подтвердил пользователь: ЧТО затронуто (новая интеграция /
зависимость от другой системы) — на уровне требования. НЕ проектируй решение:
никаких эндпоинтов, DTO/классов, имён сервисов, инфраструктуры, статусов и полей
(см. запрет в Self-Review §2). Не подтверждено пользователем — TBD.]

## 4. Функциональные требования
### 4.1. Описание функционала / бизнес-процесса
[Процесс так, как подтвердил пользователь: шаги, ветвления, исключения — только
подтверждённые (не додумывай). Нумеруй требования (FR-1, FR-2, …).]
### 4.2. Критерии приёмки (Acceptance Criteria)
- **[FR-1]** Дано [условие], когда [действие], тогда [результат].

## 5. Ограничения и атрибуты качества
### 5.1. Приоритет
[High / Medium / Low — с обоснованием.]
### 5.2. Сроки и обоснование
[Дедлайн и почему.]
### 5.3. Ролевая модель
| Роль | Права / доступные действия |
|------|----------------------------|
| ...  | ...                        |

## 6. Приложения (опционально)
- [Пожелания по UX доработки (в свободном формате), если пользователь дал.]
- [Схема бизнес-процесса, если приложена.]
- [Дополнительные файлы / выгрузки / переписки, которые дал пользователь.]
```

## Formatting rules

- **Business goal** always as a user story: «Я как [роль] должен иметь
  возможность [цель], чтобы [ценность].»
- **Acceptance criteria** in Given-When-Then («Дано–Когда–Тогда»); verifiable.
- **Functional requirements** numbered (FR-1…) and linked to their acceptance
  criteria by the same number. They describe required behavior, not a build plan.
- **Scope** = two explicit lists; Out-of-scope matters as much as In-scope.
- **Priority** only from High / Medium / Low.
- Confirmed content is written plainly; `TBD` for unconfirmed gates; `⚠️ Требует
  уточнения` for vague confirmations. No unconfirmed inference is ever stated as fact.

## Example (analyze → confirm every gate → write)

**User:** «Собери требования по фиче: в списке паспортов добавить выгрузку в Excel
найденных по фильтру; использовать существующие механизмы выгрузки.»

**Agent** first asks for the linked task key (Gate 0): «Сначала укажите ключ задачи в
Jira/SberTrack (например `SMSEC-1234`) — без него спека не оформляется.» Then it may
read the repo read-only to form proposals and runs the confirmation gate — batched by
section — presenting each gate with its source, e.g.:
«По коду похоже, что выгрузка может опираться на существующий отчётный механизм
(асинхронная генерация → скачивание). Это **гипотеза из кода** — подтвердите, что
опираемся на него, или нет? Также уточните: кто конечные пользователи и заказчик;
какие колонки; какой приоритет и срок?»

**Only after the user confirms** does the agent write the spec. Confirmed items are
filled; whatever the user **explicitly left open** (e.g. exact mechanism, columns,
priority) is `TBD` in «Открытые вопросы». The spec names **no** service, endpoint,
DTO, or file that the user didn't confirm — those stayed proposals and never entered
the document.
