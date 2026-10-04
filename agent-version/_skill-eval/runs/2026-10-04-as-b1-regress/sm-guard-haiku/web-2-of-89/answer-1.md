Считаю гард для класса «потребляемые API».

**Прежняя карточка**: 89 ключей
- `billing · GET /projects/0/estimate` через `billing · GET /projects/88/estimate`

**Черновик**: 87 ключей
- `billing · GET /projects/2/estimate` через `billing · GET /projects/88/estimate`

**Статистика:**
- было = 89
- исчезло = 2 (`billing · GET /projects/0/estimate`, `billing · GET /projects/1/estimate`)
- появилось = 0
- опустело = 0

**Проверка порогов:**
- `исчезло ≥ 3 и 3·исчезло > было`: 2 ≥ 3? Нет → условие не выполнено
- `опустело ≥ 3 и 3·опустело > было`: 0 ≥ 3? Нет → условие не выполнено

Ни один класс не срабатывает.

---

**ГАРД: ПОВЕРХ**

(В отчёт Шага 6 — потеря двух вызовов к `billing`: `/projects/0/estimate` и `/projects/1/estimate`.)