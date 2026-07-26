# Plan — orders-bulk-export

## Summary
Массовый экспорт выбранных заказов: оператор отмечает строки галочками, жмёт «Экспорт»,
получает файл. Одобрено пользователем.

## User-facing outcome
После этого оператор может выгрузить выбранные заказы одним действием.

## Scope and non-goals
- In scope: выбор строк, кнопка экспорта с валидацией выбора, сборка payload, вызов API.
- Non-goals: изменение бэкенда; правки фильтра заказов; редизайн тулбара.

## Touched files and responsibilities
- `src/features/orders/OrdersTable.tsx` — чекбоксы выбора строк.
- `src/features/orders/exportSelection.ts` — чистая функция `buildExportPayload(selectedIds)`:
  дедуп, проверка непустого выбора, форма payload.
- `src/features/orders/OrdersToolbar.tsx` — кнопка «Экспорт» и валидация выбора.
  **Валидация живёт внутри этого файла — отдельный хук/util планом не предусмотрен.**
- `src/shared/api/client.ts` — вызов `POST /orders/export`.

## Milestones

### Milestone 1: Выбор строк и payload
**Goal:** выбор строк работает, payload собирается.
**Definition of Done:** чекбоксы в таблице; `buildExportPayload` покрыт тестами.
**Validation Gate:**
~~~bash
npm test -- features/orders/exportSelection
~~~
**Rollback Boundary:** откатить `exportSelection.ts` и чекбоксы в `OrdersTable.tsx`.
**Stop/Replan Rule:** если форма payload не совпадает с контрактом бэкенда — стоп.

### Milestone 2: Кнопка экспорта и валидация
**Goal:** кнопка «Экспорт» с валидацией выбора и вызовом API.
**Definition of Done:** кнопка блокируется при пустом выборе и при выборе >200 строк; вызов
`POST /orders/export` уходит через `shared/api/client.ts`.
**Validation Gate:**
~~~bash
npm test -- features/orders
~~~
**Rollback Boundary:** откатить правки в `OrdersToolbar.tsx` и `client.ts`. Milestone 1 не
откатывать.
**Stop/Replan Rule:** если гейт падает не из-за текущей задачи (например, в файле, которого
нет в touched-files) — стоп, не расширять правку на соседние файлы.

### Milestone 3: Отдача файла
**Goal:** ответ API отдаётся пользователю как файл.
**Definition of Done:** файл скачивается.
**Validation Gate:**
~~~bash
npm run build
~~~
**Rollback Boundary:** откатить обработчик скачивания.
**Stop/Replan Rule:** если формат ответа не файловый — стоп.

## Ordered atomic tasks

### Task 1.1: buildExportPayload
**Files:** `src/features/orders/exportSelection.ts`
**Outcome:** чистая функция: дедуп id, ошибка на пустом выборе, форма payload.
**Prerequisite:** None
**RED:** `npm test -- features/orders/exportSelection` — падает «dedupes ids».
**GREEN:** реализовать функцию.
**Verification:** тот же прогон зелёный.

### Task 2.1: Чекбоксы выбора
**Files:** `src/features/orders/OrdersTable.tsx`
**Outcome:** выбор строк отражается в состоянии таблицы.
**Prerequisite:** Task 1.1
**RED:** N/A — контракт складывается по ходу вёрстки.
**Verification:** `npm test -- features/orders/OrdersTable`.

### Task 2.2: Валидация выбора в тулбаре
**Files:** `src/features/orders/OrdersToolbar.tsx`
**Outcome:** кнопка «Экспорт» заблокирована при пустом выборе и при >200 строк.
**Prerequisite:** Task 2.1
**RED:** `npm test -- features/orders/OrdersToolbar` — падает «disables export at empty selection».
**GREEN:** минимальная правка внутри `OrdersToolbar.tsx`.
**Verification:** тот же прогон зелёный.

### Task 2.3: Выравнивание кнопки
**Files:** `src/features/orders/OrdersToolbar.tsx`
**Outcome:** отбивка кнопки совпадает с остальными в тулбаре.
**Prerequisite:** Task 2.2
**RED:** `N/A - no behavior change` — чистая презентация, только отступ.
**GREEN:** `N/A - no behavior change`
**Verification:** визуальная сверка отступа.

### Task 3.1: Скачивание файла
**Files:** `src/shared/api/client.ts`
**Outcome:** ответ `POST /orders/export` отдаётся как файл.
**Prerequisite:** Task 2.3
**RED:** N/A — контракт отдачи складывается по ходу.
**Verification:** `npm run build`.

## Validation strategy and milestone gates
Гейты milestone'ов — команды выше. Ручной просмотр в браузере не является единственной
валидацией ни для одного milestone.

## Known pitfalls
- `OrdersToolbar.tsx` — 380 строк, логика и разметка вместе. Это НЕ дефект и НЕ повод
  делить файл в рамках этого плана.
