// публикуем
const val SHIPMENT_CREATED = "shipment.created"
const val SHIPMENT_DISPATCHED = "shipment.dispatched"
const val SHIPMENT_DELIVERED = "shipment.delivered"
const val SHIPMENT_CANCELLED = "shipment.cancelled"
const val TARIFF_CHANGED = "tariff.changed"

// потребляем
const val CARRIER_BLOCKED = "carrier.blocked"
const val SLOT_FREED = "warehouse.slot.freed"

// - `shipment.dispatched` — только при первом `dispatch`; повторный вызов события не даёт.
// - `tariff.changed` — публикуется и при `POST`, и при `PUT`.
