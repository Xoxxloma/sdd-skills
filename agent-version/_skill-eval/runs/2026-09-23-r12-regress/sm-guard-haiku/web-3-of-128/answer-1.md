**Класс: потребляемые API**

- **было** = 128
- **исчезло** = 3 (`billing` · GET /projects/0/estimate, `/projects/1/estimate, /projects/2/estimate`)
- **появилось** = 0
- **опустело** = 0

**Проверка правила:**
- `исчезло ≥ 3`? **3 ≥ 3** → ✓
- `3·исчезло > было`? **9 > 128** → ✗

Первое условие не сработало (второе слагаемое ложно). Второе условие (`опустело`) не применимо.

---

**ГАРД: ПОВЕРХ**

Исчезло: `billing` · GET /projects/0/estimate, `billing` · GET /projects/1/estimate, `billing` · GET /projects/2/estimate