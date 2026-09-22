**Класс: потребляемые API**

- было_api = 128
- исчезло_api = 3 (`billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`, `billing · GET /projects/2/estimate`)
- появилось_api = 0

Проверка порога:
- исчезло_api ≥ 3? **Да** (3 ≥ 3)
- 3·исчезло_api > было_api? **Нет** (9 ≤ 128)

Первое условие не полностью сработало → гард не срабатывает.

Исчезнувшие ключи в отчёт: `billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`, `billing · GET /projects/2/estimate`.

**ГАРД: ПОВЕРХ**