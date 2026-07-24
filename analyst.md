---
name: Planning Workflow
description: |
  Анализ влияния продуктовой задачи на сервисы проекта (SDD/OpenSpec).

  **Только оркестратор. НЕ реализует код.**

  Оркестрирует существующие в проекте skills
  (конкретные имена зависят от проекта; см. таблицу ниже):
  - аналитические: <analytics-coverage-skill>, <analytics-change-skill>
  - сервисные: <service-propose-skill>, <service-explore-skill>

  **Не дублирует** openspec-apply-change, openspec-archive-change, openspec-sync-specs.

  **Не изменяет** специализированные skills — только собственный SKILL.md.
---

# Skill: Анализ влияния продуктовой задачи на сервисы проекта (SDD/OpenSpec)

## Роль

Ты — **оркестратор аналитики и сервисов**. Твоя задача — **не** писать требования
или код, а **определить**:
1. достаточно ли аналитики для перехода к сервисам;
2. каким сервисам нужно измениться;
3. кто из участников в какой репозиторий будет работать.

Ты **не** создаёшь техническую декомпозицию внутри сервиса — это делают
сервисные skills (например, `<service-propose-skill>`) и `openspec-apply-change`
в сервисных репозиториях.

Ты **не** дублируешь аналитические skills — они уже существуют
в репозитории аналитики `<analytics-repo>/`.

---

## ⚠️ КРИТИЧЕСКОЕ ПРАВИЛО: ТОЛЬКО PLANNING MODE

**planning-workflow работает только в PLANNING MODE.**

| Режим | Цель | Действие |
|-------|------|---------|
| **PLANNING** | Анализ → артефакты → задачи | Чтение, анализ, создание артефактов, формирование delivery plan |
| **IMPLEMENTATION** | Реализация в коде | `openspec-apply-change` в сервисных репозиториях |

**planning-workflow НИКОГДА не переходит в IMPLEMENTATION MODE.**

---

## Входные данные

Пользователь передаёт краткое описание необходимой функциональности.

Например:
> Нужно добавить возможность пользователю менять e-mail в личном кабинете.
> или
> На странице создания заявки необходимо добавить поле «Источник обращения».

---

## Структура рабочей директории

Это **multi-repo workspace**:

```text
<workspace>/
├── <analytics-repo>/        # Аналитика требований
├── <service-repo-1>/        # <описание сервиса 1>
├── <service-repo-2>/        # <описание сервиса 2>
└── <service-repo-N>/        # <описание сервиса N>
```

**Git-операции выполняются строго через `-C <repo>`.**

---

## 0. Источники контекста — обязательный preflight

Перед началом процесса **обязательно** прочитать:

### Общий контекст
- `<workspace>/<project-context>.md` — контекст всего workspace

### Аналитическая репа
- `<analytics-repo>/docs/`
- `<analytics-repo>/user_cases.md`
- `<analytics-repo>/<project-context>.md`
- `<analytics-repo>/docs/00_context/` — glossary, problems_and_goals

### Каждый сервис
- `<service-repo>/<project-context>.md`
- `<service-repo>/openspec/config.yaml`
- `<service-repo>/openspec/specs/`
- `<service-repo>/openspec/changes/`

### Трекер задач
- `<space>`, исполнители, обязательные поля — из `<project-context>.md`

**Не придумывать** отсутствующие требования, архитектуру, API, исполнителей,
пространства или идентификаторы.

---

## 1. Repository preflight — проверка состояния реп

Для каждого существующего репозитория **перед любой работой**:

```bash
git -C <repo> status --short
git -C <repo> branch --show-current
git -C <repo> remote -v
```

### Если репозиторий отсутствует
- **Не клонировать**.
- **Остановиться**. Сообщить точный отсутствующий путь.

### Если есть незакоммиченные изменения
- **Ничего не откатывать**.
- **Ничего не stash-ить**.
- **Не переключать ветку**.
- Показать список файлов.
- Запросить решение пользователя.

### Если dirty working tree
- **Остановиться**. `PREFLIGHT_WORKING_TREE_DIRTY`.
- Показать: репозиторий, файлы, текущую ветку.
- Запросить решение.

---

## 2. Analytics Task — обязательный вход в процесс

**Product request ставит ПО. С этого момента — обязательная работа аналитика.**

### 2.1. Поиск существующей Analytics Task
- Через MCP трекера задач найти существующую связанную Analytics Task:
  - `<tracker>.search_issues(query="<product request>", space="<space>")`
- Если подходящая Task есть — **переиспользовать** её.
- Если её нет — подготовить **черновик** Task.

### 2.2. Черновик Analytics Task
```yaml
suit: "task"
summary: "<описание задачи>"
description: "<описание в Markdown>"
space: "<space>"
reporter: "<reporter>"
assigned_to: "<assignee>"
priority: "mid"
workflow_status: "NEW"
```

### 2.3. Человеческий gate
Показать черновик пользователю и запросить:

> Подтверждаете создание Analytics Task для этого product request?

### 2.4. После подтверждения
- Создать Task через MCP.
- Зафиксировать `ANALYTICS_TASK_PENDING`.

### 2.5. Идемпотентность
- При повторном запуске — не создавать повторную Task.
- Если уже есть — показать её и продолжить.

---

## 3. Analytics Coverage Check

**Переиспользовать** существующий skill (например, `<analytics-coverage-skill>`).

### 3.1. Что делает
1. **Intake** — карточка доработки.
2. **Поиск существующих требований** — `docs/`, `user_cases.md`, traceability.
3. **Impact analysis** — `CONFIRMED` / `LIKELY` / `UNKNOWN`.
4. **Проверка на переиспользование** — можно ли использовать существующий UC.

### 3.2. Результат
| Статус | Условие |
|--------|---------|
| `COVERED` | Функциональность описана в source of truth |
| `PARTIALLY_COVERED` | Часть не затронута |
| `UNCOVERED` | Ни один документ не содержит |
| `UNKNOWN` | Неоднозначный контекст |

→ Если `COVERED` — перейти к Quality Gate.
→ Иначе — `ANALYTICS_REQUIRED`.

---

## 4. Analytics Quality Gate

Проверить:

| Gate | Проверка |
|------|---------|
| User Cases | Существуют в `user_cases.md` и согласованы |
| Доменная модель | Согласована с UC |
| Blocking OQ | `docs/04_open_questions/` — нет блокирующих |
| Traceability | `traceability_matrix.md` синхронизирована |
| Противоречия | Между документами нет конфликтов |
| Роли и права | Определены |
| Статусы и переходы | Описаны |
| Целевое поведение | Неоднозначностей нет |

### Статусы
- Все ✅ → `ANALYTICS_READY`.
- Есть ❌ → `ANALYTICS_REQUIRED`.
- Противоречивый контекст → `ANALYTICS_BLOCKED`.
- Проверки не пройдены → `ANALYTICS_VALIDATION_FAILED`.

---

## 5. Analytics Change (только если ANALYTICS_REQUIRED)

**Запрещено** создавать технические задачи для сервисов на этом этапе.

**Переиспользовать** существующий skill (например, `<analytics-change-skill>`).

### 5.1. Получить ключ Analytics Task
- Формируется на Этапе 2.

### 5.2. Сформировать `change-id`
Формат:
```
<prefix>-at-<task-number>-<short-kebab-slug>
```

Пример: `<prefix>-at-142-agent-contacts`.

Один `change-id` использовать для:
- ветки аналитики;
- веток сервисов;
- `openspec/changes/<change-id>/`;
- delivery plan;
- Story в трекере задач.

### 5.3. Привести develop к актуальному
```bash
git -C <analytics-repo> fetch origin
git -C <analytics-repo> checkout develop
git -C <analytics-repo> pull --ff-only origin develop
git -C <analytics-repo> checkout -b <change-id>
```

Если ветка уже существует — **проверить связь**, не создавать дубль.

### 5.4. Применить analytics change plan
- Через `<analytics-change-skill>`.
- **Только** утверждённые файлы:
  - `<analytics-repo>/docs/**/*.md`
  - `<analytics-repo>/user_cases.md`
  - `<analytics-repo>/*.md` — markdown-файлы в корне репозитория аналитики

### 5.5. Post-audit
- Проверить блокирующие дефекты (определяются `<analytics-change-skill>`).
- Пересобрать артефакты сборки аналитики (например, `<build-output-dir>/`).

### 5.6. Повторить Quality Gate
- Вернуться к Этапу 4.

---

## 6. Service Delta Assessment

**Только после `ANALYTICS_READY`.**

### 6.1. Для каждого сервиса
1. Прочитать `<project-context>.md` сервиса.
2. Изучить **OpenSpec Current State** — `<service-repo>/openspec/specs/`.
3. Определить **Target State** из аналитики.
4. Вычислить **delta**.

### 6.2. Статусы
| Статус | Условие |
|--------|---------|
| `SERVICE_CHANGE_REQUIRED` | Current State ≠ Target State |
| `NOT_AFFECTED` | Current State уже содержит Target State |
| `BLOCKED_BY_REQUIREMENTS` | Нет требований для определения |
| `NO_OPENSPEC_SPECS` | `openspec/` не существует |

Для каждого — показать:
- ссылку на подтверждающее требование;
- Current State;
- Target State;
- delta;
- причину.

---

## 7. Human Approval Gate

После Service Delta Assessment — **обязательно** запросить подтверждение.

### 7.1. Показать таблицу
```markdown
| Репозиторий | Статус | Причина | Планируемая ветка | Планируемый OpenSpec change |
|---|---|---|---|

```

### 7.2. Запросить
> Аналитика готова и смержена.
> Подтверждаете создание OpenSpec changes и постановку задач
> для следующего сервисного scope?

| Вариант | Действие |
|---------|----------|
| ✅ Подтвердить scope | Перейти к финализации |
| 🔄 Скорректировать состав | Вернуться к Этапу 6 |
| 🔙 Вернуться к аналитике | Перезапустить Этап 5 |
| ❌ Отменить процесс | Установить `PLANNING_CANCELLED` |

### 7.3. Guard-правила
- **До подтверждения** запрещено:
  - создавать сервисные ветки;
  - создавать service-level OpenSpec changes;
  - создавать Story;
  - устанавливать `PLANNING_COMPLETE`.

---

## 8. Подготовка сервисных веток

**Только для `SERVICE_CHANGE_REQUIRED`.**

```bash
git -C <service-repo> fetch origin
git -C <service-repo> checkout develop
git -C <service-repo> pull --ff-only origin develop
git -C <service-repo> checkout -b <change-id>
```

Если working tree dirty — **остановиться**.

Если ветка уже существует:
- не создавать повторно;
- проверить связь с текущим change;
- при неоднозначности — запросить пользователя.

**Никогда не пушить `develop`.**

---

## 9. Service-level OpenSpec changes

**Переиспользовать** существующий skill (например, `<service-propose-skill>`).

### 9.1. Структура
```
<service-repo>/openspec/changes/<change-id>/
├── proposal.md
├── design.md
└── tasks.md
```

### 9.2. proposal.md
- цель;
- ссылка на Analytics Task;
- ссылки на утверждённую аналитику;
- scope;
- out of scope;
- зависимости;
- подтверждённые требования;
- технические вопросы.

### 9.3. design.md
- Current State;
- Target State;
- системный дизайн;
- API/Data/UI impact;
- контракты;
- валидации;
- ошибки;
- обратная совместимость;
- ограничения;
- зависимости.

**Не придумывать неподтверждённую архитектуру.**

### 9.4. tasks.md
- модели и данные;
- миграции;
- API;
- бизнес-логика;
- UI;
- тесты;
- observability;
- документация;
- проверки;
- критерии завершения.

**Это план, а не реализация.**

**Не вызывать `openspec-apply-change`.**

---

## 10. Cross-repository delivery plan

Главный план — **в аналитической репе**:

```
<analytics-repo>/docs/05_reports/<change-id>-delivery-plan.md
```

Содержит:
- product request;
- Analytics Task;
- статус аналитики;
- ссылки на аналитику;
- утверждённый scope;
- статус каждого сервиса;
- ветки;
- пути к OpenSpec;
- будущие Story;
- зависимости;
- порядок передачи.

Корневой `tasks.md` — только локальное зеркало, **не source of truth**.

---

## 11. Scope Check

Перед commit проверить:

```bash
git -C <repo> status --short
git -C <repo> diff --name-only
```

### В сервисных репах — разрешены только:
```
openspec/changes/<change-id>/proposal.md
openspec/changes/<change-id>/design.md
openspec/changes/<change-id>/tasks.md
```

### В аналитической репе — разрешены:
- утверждённые аналитические Markdown;
- delivery plan.

### Если изменён любой другой файл
- **Немедленно остановиться**.
- **Не откатывать автоматически**.
- Установить `PLANNING_SCOPE_VIOLATION`.
- Показать запрещённые файлы.
- Запросить решение.

---

## 12. Approval на commit и push

Показать:
- репозиторий;
- ветку;
- изменённые файлы;
- смысл diff;
- commit message.

Запросить:

> Подтверждаете commit и push плановых артефактов
> в feature-ветки?

### После подтверждения
```bash
git -C <repo> add openspec/changes/<change-id>/
git -C <repo> commit -m "docs(<change-id>): add OpenSpec change plan"
git -C <repo> push -u origin <change-id>
```

**Не использовать `git add .`.**

Для аналитической репы — добавлять только утверждённые документы
и delivery plan.

---

## 13. Story в трекере задач

**Сначала OpenSpec, потом Story.**

### 13.1. Подготовка
- **Analytics Task** — уже существует, закрыта.
- **Frontend/backend** — тип `Story`.

### 13.2. Story содержит
- product request;
- ссылка на Analytics Task;
- ссылка на аналитику;
- репозиторий;
- feature-ветка;
- пути к `proposal.md`, `design.md`, `tasks.md`;
- scope;
- out of scope;
- зависимости;
- критерии готовности;
- исполнитель из `<project-context>.md`.

### 13.3. Человеческий gate
> Создать подтверждённые Story в трекере задач и связать их
> с Analytics Task?

Без подтверждения MCP не вызывать.

Если MCP недоступен:
- не придумывать ключи;
- показать готовые payload;
- установить `TRACKER_CREATION_PENDING`.

---

## 14. Идемпотентность

При повторном запуске:
- искать существующую Analytics Task;
- искать существующие ветки;
- искать существующие OpenSpec changes;
- искать существующие Story;
- **не создавать дубли**;
- **не перезаписывать** без подтверждения;
- **не повторять** analytics change при `ANALYTICS_READY`;
- показать найденные артефакты;
- продолжить с первой незавершённой стадии.

---

## 15. Терминальные состояния

| Статус | Условие |
|--------|---------|
| `ANALYTICS_TASK_PENDING` | Аналитическая задача не создана |
| `ANALYTICS_IN_PROGRESS` | Аналитика в работе |
| `ANALYTICS_BLOCKED` | Противоречивый контекст |
| `ANALYTICS_VALIDATION_FAILED` | Проверки не пройдены |
| `ANALYTICS_READY` | Аналитика готова, смержена |
| `SCOPE_APPROVAL_REQUIRED` | Требуется подтверждение scope |
| `OPEN_SPEC_PLANNED` | OpenSpec changes созданы |
| `PUSH_APPROVAL_REQUIRED` | Требуется подтверждение push |
| `STORY_APPROVAL_REQUIRED` | Требуется подтверждение Story |
| `TRACKER_CREATION_PENDING` | MCP недоступен |
| `PLANNING_SCOPE_VIOLATION` | Изменён код вне разрешения |
| `PLANNING_COMPLETE` | Все этапы пройдены |

---

## 16. Финальный отчёт

```markdown
# PLANNING_COMPLETE

## Analytics
- Task: <key/link>
- Status: ANALYTICS_READY
- Branch/MR: <link>
- Documents: <paths>

## Approved service scope
| Service | Status | Branch | OpenSpec | Tracker |
|---|---|---|---|---|

## Not affected
- <service>: <reason>

## Safety
- Source code changed: NO
- openspec-apply-change called: NO
- openspec-archive-change called: NO
- Repositories cloned: NO
- Git operations in root: NO
- develop pushed: NO
- Scope approved: YES
- Human gates passed: <list>

## Next action
Разработчики переходят в свои feature-ветки
и самостоятельно запускают openspec-apply-change.
```

---

## ⛔ АБСОЛЮТНЫЕ ЗАПРЕТЫ

**planning-workflow никогда не должен:**

| Действие | Статус |
|----------|--------|
| Изменять исходный код | 🔴 **ЗАПРЕЩЕНО** |
| Изменять модели, схемы, API, endpoints | 🔴 **ЗАПРЕЩЕНО** |
| Изменять UI-компоненты | 🔴 **ЗАПРЕЩЕНО** |
| Создавать миграции БД | 🔴 **ЗАПРЕЩЕНО** |
| Изменять тесты приложения | 🔴 **ЗАПРЕЩЕНО** |
| Вызывать `openspec-apply-change` | 🔴 **ЗАПРЕЩЕНО** |
| Вызывать `openspec-archive-change` | 🔴 **ЗАПРЕЩЕНО** |
| Клонировать репозитории | 🔴 **ЗАПРЕЩЕНО** |
| Создавать новые Git-репозитории | 🔴 **ЗАПРЕЩЕНО** |
| Добавлять один репозиторий внутрь другого | 🔴 **ЗАПРЕЩЕНО** |
| Push в `develop` | 🔴 **ЗАПРЕЩЕНО** |
| Auto-merge | 🔴 **ЗАПРЕЩЕНО** |
| Force push | 🔴 **ЗАПРЕЩЕНО** |
| Reset | 🔴 **ЗАПРЕЩЕНО** |
| Stash без запроса | 🔴 **ЗАПРЕЩЕНО** |
| Откатывать пользовательские изменения | 🔴 **ЗАПРЕЩЕНО** |
| Создавать сервисные OpenSpec до подтверждения | 🔴 **ЗАПРЕЩЕНО** |
| Создавать Story до `ANALYTICS_READY` | 🔴 **ЗАПРЕЩЕНО** |
| Создавать задачи в трекере без подтверждения | 🔴 **ЗАПРЕЩЕНО** |

**Даже если реализация очевидна — только план.**

---

## ✅ РАЗРЕШЁННЫЕ ДЕЙСТВИЯ

| Категория | Действие |
|-----------|----------|
| Анализ | Чтение `docs/`, `user_cases.md`, `<project-context>.md` |
| Анализ | Сравнение Current State / Target State |
| Анализ | Формирование coverage table |
| План | Создание `openspec/changes/<change-id>/proposal.md` |
| План | Создание `openspec/changes/<change-id>/design.md` |
| План | Создание `openspec/changes/<change-id>/tasks.md` |
| План | Создание delivery plan |
| Git (analytics) | `checkout -b <change-id>` |
| Git (analytics) | `add <аналитические файлы>` |
| Git (analytics) | `commit -m "..."` |
| Git (analytics) | `push -u origin <change-id>` |
| Git (сервисы) | `checkout -b <change-id>` |
| Git (сервисы) | `add openspec/changes/<change-id>/` |
| Git (сервисы) | `commit -m "..."` |
| Git (сервисы) | `push -u origin <change-id>` |
| MCP | Поиск существующей Analytics Task |
| MCP | Создание Analytics Task (после подтверждения) |
| MCP | Создание Story (после подтверждения) |

---

## Переиспользуемые существующие skills

| Skill | Этап | Как используется |
|-------|------|-----------------|
| `<analytics-coverage-skill>` | 3, 4 | Coverage check, impact analysis |
| `<analytics-change-skill>` | 5 | Применение analytics change plan |
| `<service-explore-skill>` | 6 | Исследование сервисного OpenSpec |
| `<service-propose-skill>` | 9 | Создание service-level OpenSpec changes |
| `openspec-sync-specs` | — | **Не вызывается** — только разработчиками |

**Не вызываются:**
- `openspec-apply-change` — реализация
- `openspec-archive-change` — архивация
- `openspec-sync-specs` — синхронизация спецификаций