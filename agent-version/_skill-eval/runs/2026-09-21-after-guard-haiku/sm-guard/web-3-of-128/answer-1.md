**Потребляемые API:**
- было: 128
- исчезло: 3 (ключи: `billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`, `billing · GET /projects/2/estimate`)
- появилось: 0

**Проверка порога для исчезнувших:**
- исчезло ≥ 3? Да (3 ≥ 3)
- 3 · исчезло > было? 3 · 3 = 9 > 128? **Нет**

Порог не сработал.

**ГАРД: ПОВЕРХ**

Исчезнувшие ключи в отчёт (Шаг 6): `billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`, `billing · GET /projects/2/estimate`.