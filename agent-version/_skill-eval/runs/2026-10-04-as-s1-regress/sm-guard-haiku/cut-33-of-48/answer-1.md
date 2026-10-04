## контракт

| Метрика | Значение |
|---|---|
| было | 48 |
| исчезло | 33 |
| появилось | 0 |
| опустело | 0 |

**Проверка порога:**
- исчезло ≥ 3? 33 ≥ 3 — ✓
- 3 × 33 > 48? 99 > 48 — ✓

Оба условия выполнены.

**Исчезнувшие ключи (33):**
GET /api/v1/items/list-2 … -5, POST /api/v1/items/create-2 … -5, PATCH /api/v1/items/update-2 … -5, DELETE /api/v1/items/remove-2 … -5, GET /api/v1/items/export-2 … -5, POST /api/v1/items/search-2 … -5, PATCH /api/v1/items/count-2 … -5, DELETE /api/v1/items/bulk-2 … -5

**ГАРД: В _pending**

Сервис продвигается в `services/_pending/svc.md`. Вопрос: сокращение контракта на 69 % (с 48 до 15 вызовов) — урезали сервис или скан дочитал только часть модуля?