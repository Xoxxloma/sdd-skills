**Контракт (класс с блоками `### Публичный контракт`)**

- было_контракт = 48
- исчезло_контракт = 32 (варианты -2, -3, -4, -5 по всем 8 операциям: 8 × 4 = 32)
- появилось_контракт = 0

Проверка порога: `исчезло ≥ 3 и 3·исчезло > было`
- 32 ≥ 3 ✓
- 3 × 32 = 96 > 48 ✓

**Оба условия выполнены.**

---

**ГАРД: В _pending**

Исчезло 32 ключа из 48 (все варианты -2 через -5). Исчезнувшие: DELETE /api/v1/items/remove-2, DELETE /api/v1/items/remove-3, DELETE /api/v1/items/remove-4, DELETE /api/v1/items/remove-5, GET /api/v1/items/list-2, GET /api/v1/items/list-3, GET /api/v1/items/list-4, GET /api/v1/items/list-5, POST /api/v1/items/create-2, POST /api/v1/items/create-3, POST /api/v1/items/create-4, POST /api/v1/items/create-5, PATCH /api/v1/items/update-2, PATCH /api/v1/items/update-3, PATCH /api/v1/items/update-4, PATCH /api/v1/items/update-5, GET /api/v1/items/export-2, GET /api/v1/items/export-3, GET /api/v1/items/export-4, GET /api/v1/items/export-5, POST /api/v1/items/search-2, POST /api/v1/items/search-3, POST /api/v1/items/search-4, POST /api/v1/items/search-5, PATCH /api/v1/items/count-2, PATCH /api/v1/items/count-3, PATCH /api/v1/items/count-4, PATCH /api/v1/items/count-5, DELETE /api/v1/items/bulk-2, DELETE /api/v1/items/bulk-3, DELETE /api/v1/items/bulk-4, DELETE /api/v1/items/bulk-5. Урезали сервис или скан не дочитал?