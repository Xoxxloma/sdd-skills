## Расчёт гарда

### Класс: сущности
- **было**: 19 (Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token)
- **появилось**: 0
- **исчезло**: 19

Проверка порога:
- исчезло ≥ 3? → 19 ≥ 3 ✓
- 3·исчезло > было? → 3·19 = 57 > 19 ✓

**Срабатывает.**

### Класс: контракт
- **было**: 13
- **появилось**: 0 (все 13 ключей совпадают)
- **исчезло**: 0

Проверка порога:
- исчезло ≥ 3? → 0 ≥ 3 ✗
- (опустело не применимо — нет блоков)

**Не срабатывает.**

---

**ГАРД: В КАРМАН** — сущности: было 19, исчезло 19 (57 > 19). Исчезло: Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token. Вопрос: урезан сервис или скан не дочитал модули?