# product-skills

Набор переиспользуемых скиллов для конвейера **«понять большое приложение → предложить улучшения → оформить требования → системные требования → план реализации»**. Работает на любом большом приложении (в т.ч. из множества микросервисов), провайдер-независим, рассчитан на перенос в отдельный контур.

## Что внутри (`skills/`)

| Скилл | Делает | Вход → Выход |
|---|---|---|
| **product-skills** | Точка входа/диспетчер: карта команд, «где ты сейчас» по состоянию `product/`, подсказка следующего шага; при `--init` создаёт `product/manifest.yaml`. Стадии не исполняет. | — |
| **system-map** | Понимание всей системы: по агенту на сервис параллельно → карточки + синтез + граф зависимостей + каталог возможностей. Кэшируется, обновляется инкрементально. | `manifest.yaml` → `system/` |
| **propose-improvements** | Бэклог «малых рычажных» улучшений по линзам (UX/UI, надёжность, перф, observability, DX). Для фронтов запускает **impeccable**. | `system/` → `backlog/improvements.md` (IMP-NNN) |
| **vision-audit** | *(опц., стратегия)* Аудит сверху вниз: соответствие видению (R/Y/G) + классификация SDLC-исходов + исследование возможностей (веб/конкуренты). | `vision/` + `system/` → `vision/vision-audit.md` (OPP-NNN) |
| **vision-to-backlog** | Мост: переносит выжившие OPP-NNN в общий бэклог как IMP (та же нумерация, линза `strategy`). | `vision/vision-audit.md` → `backlog/improvements.md` |
| **draft-requirement** | Разворачивает выбранный IMP в бизнес/тех-требование (BR/TR). | IMP-NNN → `requirements/REQ-NNN.md` |
| **system-requirements** | Из REQ — системные требования: функц. (EARS) + нефункц. + интерфейсы/данные + критерии приёмки (Gherkin). | REQ-NNN → `system-requirements/SYS-NNN.md` |
| **implementation-plan** | Из SYS — план: файлы/сервисы, контракты+миграции, тесты, rollout, риски, разбивка задач (Jira-ready). | SYS-NNN → `plans/PLAN-NNN.md` |
| **product-pipeline** | Оркестратор: гонит цепочку / возобновляет с любой стадии, ведёт `traceability.md`, останавливается на ревью. | — |
| **impeccable** | Сторонний скилл аудита/дизайна UI (Apache-2.0). Используется `propose-improvements` для UI-линзы. | — |

## Быстрый старт (правильный запуск)

### 0. Пререквизиты
- AI-харнесс с поддержкой скиллов: **Claude Code** (и совместимые — Cursor/Gemini/Codex и т.п., у каждого свой каталог скиллов).
- **Node.js ≥ 18** — нужен только для скриптов/CLI **impeccable**; остальные скиллы работают без него.
- **WebSearch** — опционально, только для `vision-audit` (исследование возможностей); без него запускать с `--no-web` (деградация на анализ по `COMPETITORS.md`). Новых зависимостей не добавляет.
- Доступ на **чтение** к папкам сервисов, которые будем анализировать.

### 1. Установить скиллы
Скопировать содержимое `skills/` в каталог скиллов среды:
```
cp -r skills/*  <harness>/.claude/skills/        # Claude Code
# для других сред — соответствующий каталог: .agents/skills, .cursor/…, .gemini/… и т.д.
```

### 2. Проверить, что подхватились
В харнессе должны стать доступны команды:
`/product-skills`, `/system-map`, `/propose-improvements`, `/vision-audit`, `/vision-to-backlog`, `/draft-requirement`, `/system-requirements`, `/implementation-plan`, `/product-pipeline`, `/impeccable`.
(В Claude Code — открыть список скиллов или просто начать вызывать `/product-skills` для ориентации. После копирования может потребоваться перезапуск/`/skills` reload.)

### 3. Описать сервисы — `product/manifest.yaml`
Проще всего — `/product-skills --init`: создаст `product/manifest.yaml` из образца, останется вписать пути. Либо вручную (образец — **`skills/product-skills/reference/manifest.example.yaml`**):
```yaml
services:
  - { name: orders,   path: /abs/path/orders,   type: backend }
  - { name: payments, path: /abs/path/payments, type: backend }
  - { name: web,      path: /abs/path/web,       type: frontend }
```
Если manifest не создать — `system-map` при первом запуске сам спросит папки сервисов.

### 4. Запустить
**Весь конвейер** (с остановками на ревью между стадиями):
```
/product-pipeline
```
**Или по стадиям** (рекомендуется для контроля):
```
/system-map                     # карта системы            → product/system/
/vision-audit --lite --no-web   # (опц.) стратег. аудит    → product/vision/vision-audit.md (OPP-NNN)
/vision-to-backlog              # (опц.) OPP → бэклог      → product/backlog/improvements.md (IMP, линза strategy)
/propose-improvements           # бэклог идей              → product/backlog/improvements.md
/draft-requirement IMP-007      # требование (BR/TR)       → product/requirements/REQ-007.md
/system-requirements REQ-007    # системные требования     → product/system-requirements/SYS-007.md
/implementation-plan SYS-007    # план реализации          → product/plans/PLAN-007.md
```
Все артефакты пишутся в `./product/` (или передайте свой путь первым аргументом скилла).

> **Только чтение исходников.** Скиллы читают код сервисов и пишут исключительно в рабочий каталог `product/` — ничего в анализируемых репозиториях не меняют.
>
> **impeccable** обычно ставится онлайн (`npx impeccable skills install`); здесь вложен **офлайн-копией** для закрытого контура (обновление при сети — `npx impeccable skills update`). CLI-детектор анти-паттернов требует `npx impeccable …`; в полностью закрытом контуре работает анализ по reference-инструкциям, CLI — опционально.

## Рабочий стол артефактов (контракт между стадиями)

Все стадии читают артефакт предыдущей и пишут свой — в один рабочий каталог (по умолчанию `./product/`, можно передать путь):

```
product/
  manifest.yaml              # сервис: name → path (+ type: backend|frontend|fullstack|lib, repo?)
  system/
    system-map.md            # синтез: каталог возможностей, сквозные сценарии
    services/<svc>.md        # карточка на сервис
    dependency-graph.mmd     # mermaid
  backlog/improvements.md    # IMP-001… (тактика из propose-improvements + стратегия из vision-to-backlog, линза strategy)
  vision/                    # (опц.) стратегическая стадия
    VISION.md  SDLC_REFERENCE.md  COMPETITORS.md   # входы (шаблоны — в skills/vision-audit/reference/)
    vision-audit.md          # Part A/B + OPP-NNN + таблица OPP→IMP
  requirements/REQ-NNN.md
  system-requirements/SYS-NNN.md
  plans/PLAN-NNN.md
  traceability.md            # матрица IMP ↔ REQ ↔ SYS ↔ PLAN
  .cache/map-state.json      # хэш/commit на сервис → инкрементальное обновление
```

### Сквозные ID и трассируемость
Цепочка тянется по номеру: `IMP-007 → REQ-007 → SYS-007 → PLAN-007`. Это позволяет позже механически экспортировать в Jira (`REQ→Epic`, `SYS-функц.→Story`, критерии приёмки→AC, `PLAN`-задачи→Sub-tasks). `traceability.md` — единый индекс связей.

## Памятка по стадиям
`system-map` → `propose-improvements` → (выбор IMP) → `draft-requirement` → `system-requirements` → `implementation-plan`. Сквозной номер сохраняется: `IMP-007 → REQ-007 → SYS-007 → PLAN-007`. Оркестратор `product-pipeline` гонит это с гейтами и ведёт `traceability.md`.

> **(Опц.) Стратегическая ветка.** После `system-map` можно запустить `vision-audit` → `vision-to-backlog`: аудит сверху вниз (соответствие видению + разрывы SDLC) даёт возможности `OPP-NNN`, а мост заносит их в **тот же** `improvements.md` как `IMP` (линза `strategy`, продолжая нумерацию). Так стратегические идеи (сверху вниз) и тактические из `propose-improvements` (снизу вверх) сходятся в один бэклог и дальше идут по общей цепочке `REQ→SYS→PLAN`. Связь возможности с бэклогом видна в поле `Evidence` каждого IMP (ссылка на `OPP-NNN`).
