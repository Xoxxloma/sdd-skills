# Plan — orders-status-filter

## Summary
Добавить фильтр по статусу на экран заказов. Оператор выбирает статус, список
перезапрашивается с параметром `status`.

## User-facing outcome
После этого оператор может отфильтровать заказы по статусу.

## Scope and non-goals
- In scope: UI-фильтр на `/orders`, параметр запроса, состояние фильтра.
- Non-goals: изменение бэкенда (параметр уже поддержан).

## Touched files and responsibilities
- `src/features/orders/OrdersFilter.tsx` — новый контрол выбора статуса.
- `src/features/orders/useOrdersQuery.ts` — прокинуть `status` в react-query ключ.

## Milestones
### Milestone 1: Фильтр
**Definition of Done:** список реагирует на выбор статуса.
**Validation Gate:** `vitest run features/orders`
**Rollback Boundary:** удалить OrdersFilter, вернуть старый ключ запроса.
**Stop/Replan Rule:** если бэкенд не принимает `status` — стоп.
