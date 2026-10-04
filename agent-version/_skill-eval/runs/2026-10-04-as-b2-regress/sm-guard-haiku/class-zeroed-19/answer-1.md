## Расчёт гарда

### Сущности
- **Было:** 19
- **Исчезло:** 19 (Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token)
- **Появилось:** 0
- **Проверка:** исчезло ≥ 3? **19 ≥ 3** ✓ И 3·19 > 19? **57 > 19** ✓

### Контракт
- **Было:** 13
- **Исчезло:** 0
- **Появилось:** 0
- **Проверка:** исчезло ≥ 3? 0 ≥ 3 ✗

---

У класса сущностей срабатывает условие: исчезло ≥ 3 и 3·исчезло > было.

ГАРД: В _pending