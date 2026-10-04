**контракт:**
- было = 48
- исчезло = 33 (DELETE /api/v1/items/bulk-1, GET /api/v1/items/list-2, POST /api/v1/items/create-2, PATCH /api/v1/items/update-2, DELETE /api/v1/items/remove-2, GET /api/v1/items/export-2, POST /api/v1/items/search-2, PATCH /api/v1/items/count-2, DELETE /api/v1/items/bulk-2, GET /api/v1/items/list-3 до DELETE /api/v1/items/bulk-5)
- появилось = 0
- опустело = 0

**Проверка порога:**
- исчезло ≥ 3? да (33 ≥ 3)
- 3·исчезло > было? да (99 > 48)

Первое условие срабатывает.

---

**ГАРД: В _pending**