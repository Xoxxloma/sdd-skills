# Plan — nav-restructure (фикстура FE-MEANING)

Исполненный план, который меняет **смысл** человеческой строки в `PROJECT.md`. Используется
с `FE-PLAN-DONE/PROJECT.md` и `FE-PLAN-DONE/BUSINESS.md` как живыми документами.

## Summary
Перенести определения роутов из центрального `src/app/router.tsx` в сами фичи: каждая фича
экспортирует свой `routes.ts`, роутер собирает их из фич. Внешнее поведение приложения не
меняется — те же пути, те же экраны.

## User-facing outcome
Нет изменений для пользователя — чисто внутренняя перестройка.

## Scope and non-goals
- In scope: `app/router.tsx` собирает роуты из фич; `features/*/routes.ts` в каждой фиче.
- Non-goals: новые экраны; изменение путей; изменение гардов.

## Touched files and responsibilities
- `src/app/router.tsx` — теперь собирает роуты из фич, сам их не объявляет.
- `src/features/orders/routes.ts`, `src/features/limits/routes.ts`,
  `src/features/auth/routes.ts` — НОВЫЕ: каждая фича объявляет свои роуты.

## Итог перестройки (для sync)
- Роутинг больше не централизован в `app/router.tsx` — фичи владеют своими роутами.
- Появилась конвенция: **каждая новая фича обязана экспортировать `routes.ts`**, иначе её
  экраны не попадут в роутер. Раньше такого требования не было.
- Границы модулей: `features/` теперь содержит роут-код, которого там раньше не было.

## Milestones
### Milestone 1: Перенос роутов
**Definition of Done:** все роуты объявлены в фичах, `router.tsx` только собирает.
**Validation Gate:** `npm test -- app/router`
**Rollback Boundary:** вернуть объявления в `router.tsx`.
**Stop/Replan Rule:** если гард `/admin/*` ломается — стоп.
