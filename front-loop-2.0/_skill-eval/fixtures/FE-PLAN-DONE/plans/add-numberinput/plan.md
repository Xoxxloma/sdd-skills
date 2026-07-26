# Plan — add-numberinput

## Summary
Добавить переиспользуемый компонент числового ввода `NumberInput` в `shared/ui/` и заменить
им сырые числовые поля на экране лимитов. `NumberInput` — общий примитив: маска, шаг,
min/max, форматирование.

## User-facing outcome
После этого оператор вводит числа в поля лимитов единообразно, с валидацией на месте.

## Scope and non-goals
- In scope: новый общий компонент `shared/ui/NumberInput.tsx`; применение на экране лимитов.
- Non-goals: изменение бэкенда; редизайн темы.

## Touched files and responsibilities
- `src/shared/ui/NumberInput.tsx` — НОВЫЙ общий компонент: числовой ввод, заменяет сырой
  `<input type="number">` / библиотечное текстовое поле для чисел во всём проекте.
- `src/features/limits/LimitForm.tsx` — использовать `NumberInput` вместо сырых полей.

## Milestones
### Milestone 1: NumberInput
**Definition of Done:** `NumberInput` в `shared/ui`, применён на экране лимитов.
**Validation Gate:** `vitest run shared/ui/NumberInput`
**Rollback Boundary:** удалить компонент, вернуть сырые поля.
**Stop/Replan Rule:** если нужен новый дизайн-токен — стоп (route to generate-theme).
