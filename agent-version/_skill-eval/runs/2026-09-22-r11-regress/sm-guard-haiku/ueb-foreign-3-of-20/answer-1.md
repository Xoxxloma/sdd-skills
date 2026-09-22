## Расчёт гарда

**Класс: сущности**

- **было_c** = 20 (Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token, Role)
- **исчезло_c** = 3 (Order, Customer, Invoice)
- **появилось_c** = 0
- **опустело_c** = 0 (не применяется — сущности не имеют внутреннего тела)

**Проверка условий:**

1. `исчезло_c ≥ 3  и  3·исчезло_c > было_c`
   - 3 ≥ 3? ✓
   - 3·3 = 9 > 20? ✗ (не выполнено)
   - Условие в целом: **не выполнено**

2. `опустело_c ≥ 3  и  3·опустело_c > было_c`
   - 0 ≥ 3? ✗
   - Условие в целом: **не выполнено**

**Потери (для отчёта):** Order, Customer, Invoice

---

**ГАРД: ПОВЕРХ**