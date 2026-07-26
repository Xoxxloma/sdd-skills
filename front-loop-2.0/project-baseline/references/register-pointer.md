# Регистрация указателя в always-on контексте (общий шаг)

Один источник правды для **обоих** baseline-скиллов. `project-baseline` подставляет
`PROJECT.md` / `## Project Context`; `business-baseline` — `BUSINESS.md` /
`## Business Context`. Логика идентична — расхождению взяться неоткуда.

**Зачем.** Сделать документ обнаружимым на **каждой** задаче, включая запуск без скилла
(«добавь фильтр на экран заказов»). Раннер читает init/context-файл проекта на старте
сессии (`CLAUDE.md`-подобный: `GIGACODE.md` / `CLAUDE.md` / `AGENTS.md` в корне). Кладём
туда указатель на документ.

Шаг из двух половин, они срабатывают в разное время:
- **Detection** — в фазе анализа (brownfield / greenfield / Refine), достаточно рано,
  чтобы любой вопрос попал в Clarification-гейт.
- **Append** — после записи документа. Ничего не спрашивает: гейт закрыт, действует по
  тому, что уже решил Detection.

## Detection (в фазе анализа)

- Найди init/context-файл, который раннер грузит на старте. **Детекть, не предполагай имя.**
- Если уверенно не опознаётся или кандидатов несколько (напр. и `CLAUDE.md`, и
  `AGENTS.md`) — **спроси пользователя** в общем гейте (не отдельным ходом, не гадать).
  Если один кандидат уже содержит указатель второго документа (`project-baseline` ищет
  блок `## Business Context`, и наоборот) — это и есть файл раннера, используй его, не
  спрашивай.
- Определи, есть ли уже указатель. Он есть, если файл содержит заголовок
  `## <Project|Business> Context` **или** пассаж, который и называет путь
  (`docs/dev/<DOC>`), и велит прочесть его перед работой. Голое упоминание пути —
  **не** указатель (индекс доков, заметка человека, ссылка из другого блока): он никому
  не инструктирует. Не можешь понять, считается ли упоминание, — спроси в гейте, чтобы не
  задвоить.

## Append (после записи) — ровно один исход, он же уходит в хендофф

- *Указатель уже есть* → оставь, второй не добавляй. Report `already present`.
- *Init-файла нет вовсе* → пропусти. Report `no init file found`.
- *Вопрос о файле остался без ответа* (пользователь отказался, или неоднозначное
  упоминание не прояснили) → пропусти. Для указателя нет `TBD`, а догадка запишет не в
  тот файл. Report `not registered (init file not confirmed)`.
- *Иначе* → допиши блок ниже в конец файла. Дословно, как реальный markdown, начиная с
  заголовка `## <...> Context`. Это секция init-файла, не цитата: не оборачивай в
  blockquote/фенс, не переводи, не переформулируй. Report `added to <file>`.

Блок — **полностью английский**, независимо от языка документа: это инструкция раннеру,
не часть `<DOC>`. Соседний блок другого baseline (если есть) — **не трогать**, не
сливать, не переупорядочивать.

### Блок для `project-baseline`

```md
## Project Context
How this project is built — stack, architecture, module boundaries, conventions — is
documented in `docs/dev/PROJECT.md`. Before writing or changing code, first read
`docs/dev/PROJECT.md` to understand the stack, the architecture and its module
boundaries, and which patterns are canonical here; follow them instead of introducing
new ones. Its §9 Always/Never rules are binding: if a task seems to require breaking one,
ask — do not break it silently, and do not silently follow a rule that no longer fits.
`PROJECT.md` is machine-written — do not hand-edit it. If something you need is not
covered there, ask.
```

### Блок для `business-baseline`

```md
## Business Context
What the product does, who uses it, and what its capabilities mean is documented in
`docs/dev/BUSINESS.md`. Before adding or changing product behavior, features, or
user-facing flows, first read `docs/dev/BUSINESS.md` to understand the product, its
users and roles, and the business meaning of the entities involved; do not invent
product purpose or scenarios. If something you need is not covered there, ask.
```

## Важное

- Шаг **выполняется в каждом режиме** (Create и Refine). На Refine особенно: init-файл
  мог быть перегенерирован (напр. командой `init`) и потерять указатель — этот шаг его
  восстанавливает. Состояние-гейта нет: документ к этому моменту всегда существует, шаг
  всегда запускается; допишет ли что-то — решают проверки выше.
