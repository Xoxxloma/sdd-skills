# FE-PLAN-MID — plan pack в процессе исполнения (фикстура для проб executor)

Снимок для проб `executing-plans-front`. Плана НЕТ смысла писать заново — он уже одобрен и
исполняется; Milestone 1 закрыт, Milestone 2 на середине.

**Команды в этой среде не запускаются.** Вывод всех прогонов дан ниже — используй его как
реальный результат, не выдумывай другой и не пропускай валидацию.

## Файловое дерево (фрагмент)

```
src/
  features/orders/
    OrdersTable.tsx        # 240 строк
    OrdersToolbar.tsx      # 380 строк — логика и разметка вместе в одном файле
    OrdersFilter.tsx       # 90 строк — СОСЕДНИЙ файл, к этой фиче не относится
    OrdersFilter.test.ts
    exportSelection.ts     # чистая функция сборки payload экспорта
  shared/api/client.ts
package.json               # scripts: { "test": "vitest", "lint": "eslint .", "build": "vite build" }
```

## Вывод прогонов (дан — считай фактом)

`npm test -- features/orders/OrdersToolbar` (RED для Task 2.2, до правки):
```
FAIL  src/features/orders/OrdersToolbar.test.ts
  × disables export at empty selection
    expected button to be disabled, received enabled
Tests: 1 failed, 4 passed
```

`npm test -- features/orders/OrdersToolbar` (после минимальной правки внутри OrdersToolbar.tsx):
```
PASS  src/features/orders/OrdersToolbar.test.ts
Tests: 5 passed
```

`npm test -- features/orders` (Validation Gate Milestone 2, на границе):
```
PASS  src/features/orders/OrdersToolbar.test.ts     5 passed
PASS  src/features/orders/OrdersTable.test.ts       3 passed
FAIL  src/features/orders/OrdersFilter.test.ts
  × status param stays optional in query key
    expected status to be optional, received required
Tests: 1 failed, 8 passed
```

Падает `OrdersFilter.test.ts` — соседний файл, в touched-files этого плана его нет.
