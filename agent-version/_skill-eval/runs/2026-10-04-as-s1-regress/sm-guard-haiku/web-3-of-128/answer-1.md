**потребляемые API:**
- было: 128
- исчезло: 3 (`billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`, `billing · GET /projects/2/estimate`)
- появилось: 0

**Проверка порога:**
- Условие 1: (3 ≥ 3 и 3·3 > 128) → (true и 9 > 128) → **false**
- Условие 2: (0 ≥ 3 и ...) → **false**

Оба условия ложны. Исчезло 3 из 128 — ниже порога.

**Отчёт для Шага 6:** исчезло 3 ключа из потребляемых API (`billing · GET /projects/{0,1,2}/estimate`).

ГАРД: ПОВЕРХ