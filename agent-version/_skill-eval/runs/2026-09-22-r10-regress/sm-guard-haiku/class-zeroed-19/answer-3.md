Считаю гард по правилу для каждого класса:

### Класс **сущности**
- было: 19
- исчезло: 19
- появилось: 0
- Проверка: исчезло ≥ 3? **Да** (19 ≥ 3). 3·исчезло > было? **Да** (57 > 19).
- **Пороговое условие сработало** ✗

### Класс **контракт**
- было: 13
- исчезло: 0
- появилось: 0
- опустело: 0
- Проверка: исчезло ≥ 3? Нет (0 < 3). опустело ≥ 3? Нет (0 < 3).
- Пороговое условие не сработало ✓

### Прочие классы
(задачи, топики, экраны, потребляемые API, роли, зависит от) — все нулевые, пороги не срабатывают.

---

Исчезнувшие из сущностей (19): Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token.

**Строка отчёта (Шаг 6):**  
`ГАРД: сущности — было 19, исчезло 19 (3·19 = 57 > 19). Исчезло: Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token.`

---

**ГАРД: В _pending**