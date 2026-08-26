Обнаружилась проблема — было 34 папки, но 5 из них сквозные (0 ключей). Доменных 29 + legacy = **30 кусков**. Это больше 8, нужен гейт. 

По инструкции скилла, предложу два варианта (дробный и укрупненный):

**Вариант A (30 кусков)** — каждый домен отдельно:
- address, analytics, billing, cargo, claim, contract, customs, depot, dock, driver, geozone, incident, invoice, legacy, notify, order, partner, permit, report, route, scheduler, shipment, slot, tariff, telemetry, template, trailer, vehicle, warehouse, waybill

**Вариант B (10 кусков)** — группировка по связности:
- **opscore-shipment** (shipment центральный, 360 файлов, 34 сущности)
- **opscore-billing** (billing, invoice, tariff — 73+48+36 = 157 файлов, финансовый кластер)
- **opscore-orders** (order, claim, waybill — 37+27+32 = 96 файлов, заказы)
- **opscore-logistics** (route, vehicle, driver, warehouse, depot, dock, slot, trailer — 38+35+34+30+27+28+28+27 = 247 файлов, логистика)
- **opscore-catalog** (cargo, customs, contract, partner, permit — 32+29+28+29+27 = 145 файлов, справочники)
- **opscore-telemetry** (telemetry, analytics, report — 28+40+46 = 114 файлов, аналитика)
- **opscore-notify** (notify, template — 44+35 = 79 файлов, уведомления)
- **opscore-address** (address, geozone — 29+27 = 56 файлов, адреса)
- **opscore-incident** (incident — 31 файл)
- **opscore-scheduler** (scheduler — 11 файлов, задачи)

**Сквозные, ни в один кусок не входят:** common, constants, configurations, exceptions, integration (0 ключей).

---

Какой вариант выбрать?
- **A: взять 30 кусков** — максимум подробности, каждый домен отдельно
- **B: укрупнить до 10 кусков** — по смыслу кластеров логистической системы
- **C: поправлю сам**
- **D: не записывать** — оставить монолит как есть
