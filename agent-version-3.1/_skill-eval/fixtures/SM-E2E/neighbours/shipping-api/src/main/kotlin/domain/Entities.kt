class Shipment
class Carrier
class Vehicle
class Tariff
class WarehouseSlot
class AuditEntry

// - `Shipment.status`: `new` | `dispatched` | `delivered` | `cancelled` — `cancelled` запись не удаляет,
// на неё ссылаются закрытые расчёты.
// - `Vehicle` хранит и снятые с рейса: снятие пишет `releasedAt`, строка не удаляется.
// - `AuditEntry` — ретенция 180 дней, чистится фоновой джобой; сервис единственный владелец.
// - `WarehouseSlot.capacityKg` — `null` у складов СВХ: там лимит не задаётся.
