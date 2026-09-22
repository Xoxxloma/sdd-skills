Считаю по правилу гарда.

**Класс: сущности**
- было = 20
- прежняя: {Order, Customer, Invoice, Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token, Role}
- черновик: {Payment, Shipment, Carrier, Warehouse, Slot, Tariff, Zone, Route, Driver, Vehicle, Contract, Claim, Refund, Audit, Session, Token, Role} — 17 ключей
- исчезло = {Order, Customer, Invoice} = 3
- появилось = 0

Проверка порога: исчезло_c ≥ 3 → 3 ≥ 3 ✓; 3·исчезло_c > было_c → 3·3=9 > 20? Нет.

Условие «исчезло» не срабатывает (9 не больше 20). Опустевших блоков нет данных — сущности здесь не блоки с телом, а строки списка (первая колонка/заголовок), опустение не считается для этого класса по представленным данным.

Появилось ≈ исчезло? Появилось = 0, исчезло = 3 — не похоже на переименование (появления нет вовсе).

Других классов в данных нет — учитываю только «сущности».

Итог: порог не превышен ни по одному классу.

ГАРД: ПОВЕРХ