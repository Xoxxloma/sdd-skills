<!-- IMPLEMENTATION PLAN — the plan is self-contained: it carries the real FILE PATHS so
     implement-feature does not depend on a manifest. Paths are resolved ONCE here (manifest →
     argument/CWD → ask the human; never guess). Keep tasks atomic (one task = one session).
     Group behaviour (debounce, races, validation, state transitions) into hook/util tasks that
     can be unit-tested; render + ARIA wiring are separate tasks on top of ready hooks.
     The "проверка" column is [тест] for logic (hook/function) or [ручками] for render/visual.
     Remove this comment when filling in. -->

---
id: F-N
source: requirements.md
services: [<service names — same as requirements.md>]
targetRoot: <absolute root of the analyzed system's code; task paths are relative to it (or write absolute paths in the table)>
---

# F-N — План реализации

## Задачи

| T-id | Задача | Файл(ы) | Закрывает | Проверка | Зависит от | Статус |
|------|--------|---------|-----------|----------|------------|--------|
| T-1  | Каркас + типы + доступная разметка | `<path/to/Component.tsx>` | R-1, R-2 | [ручками] | — | todo |
| T-2  | <поведение в хуке/чистой функции> | `<path/to/useXxx.ts>` | R-3 | [тест] | T-1 | todo |
| T-3  | <проводка хука в компонент / ARIA> | `<path/to/Component.tsx>` | R-4 | [ручками] | T-2 | todo |

<!-- Пути конкретные (создаём/меняем именно их). Статус: todo | doing | done.
     Поведенческие R-id → отдельная задача с [тест]; визуальные → [ручками]. -->

## Чек-лист ручной приёмки

<!-- По одному пункту на каждый ВИЗУАЛЬНЫЙ R-id: что открыть и что должно быть видно. -->
- [ ] R-<n>: <что открыть> → <что увидеть>

## Журнал решений

<!-- Заполняется по ходу implement-feature: краткие заметки о принятых решениях/отклонениях. -->
