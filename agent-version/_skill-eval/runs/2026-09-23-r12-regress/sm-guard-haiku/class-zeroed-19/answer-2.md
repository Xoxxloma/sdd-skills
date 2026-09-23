Посчитаю гард по классам:

**Класс: сущности**
- было: 19
- исчезло: 19 (Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token)
- появилось: 0
- опустело: 0 (ключи исчезли, не опустели)

Проверка порога:
- исчезло ≥ 3? **ДА** (19 ≥ 3)
- 3 × исчезло > было? **ДА** (57 > 19)

→ Условие сработало ✓

**Класс: контракт**
- было: 13
- исчезло: 0
- появилось: 0
- опустело: 0

Проверка порога: оба условия не сработали.

---

**ГАРД: В _pending**

Потеряны все 19 сущностей раздела «Владеет данными» (Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token). Контракт не изменился. Вопрос человеку: урезали сервис (и это планово) или скан не дочитал модули?