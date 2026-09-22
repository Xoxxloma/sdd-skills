Сервис `svc`, тип `backend`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику. Ключи уже нормализованы.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (30):
  GET /api/v1/items/list
  POST /api/v1/items/create
  PATCH /api/v1/items/update
  DELETE /api/v1/items/remove
  GET /api/v1/items/export
  POST /api/v1/items/search
  PATCH /api/v1/items/count
  DELETE /api/v1/items/bulk
  GET /api/v1/items/list-1
  POST /api/v1/items/create-1
  PATCH /api/v1/items/update-1
  DELETE /api/v1/items/remove-1
  GET /api/v1/items/export-1
  POST /api/v1/items/search-1
  PATCH /api/v1/items/count-1
  DELETE /api/v1/items/bulk-1
  GET /api/v1/items/list-2
  POST /api/v1/items/create-2
  PATCH /api/v1/items/update-2
  DELETE /api/v1/items/remove-2
  GET /api/v1/items/export-2
  POST /api/v1/items/search-2
  PATCH /api/v1/items/count-2
  DELETE /api/v1/items/bulk-2
  GET /api/v1/items/list-3
  POST /api/v1/items/create-3
  PATCH /api/v1/items/update-3
  DELETE /api/v1/items/remove-3
  GET /api/v1/items/export-3
  POST /api/v1/items/search-3

бизнес-правила (22):
  `Order` — статус
  `Customer` — этап
  `Invoice` — вид
  `Payment` — статус
  `Shipment` — этап
  `Carrier` — вид
  `Warehouse` — статус
  `Slot` — этап
  `Tariff` — вид
  `Zone` — статус
  `Route` — этап
  `Driver` — вид
  `Vehicle` — статус
  `Contract` — этап
  `Claim` — вид
  `Refund` — статус
  `Audit` — этап
  `Session` — вид
  `Token` — статус
  `Role` — этап
  `Order` — вид
  `Customer` — статус

## ЧЕРНОВИК
контракт (30):
  GET /api/v1/items/list
  POST /api/v1/items/create
  PATCH /api/v1/items/update
  DELETE /api/v1/items/remove
  GET /api/v1/items/export
  POST /api/v1/items/search
  PATCH /api/v1/items/count
  DELETE /api/v1/items/bulk
  GET /api/v1/items/list-1
  POST /api/v1/items/create-1
  PATCH /api/v1/items/update-1
  DELETE /api/v1/items/remove-1
  GET /api/v1/items/export-1
  POST /api/v1/items/search-1
  PATCH /api/v1/items/count-1
  DELETE /api/v1/items/bulk-1
  GET /api/v1/items/list-2
  POST /api/v1/items/create-2
  PATCH /api/v1/items/update-2
  DELETE /api/v1/items/remove-2
  GET /api/v1/items/export-2
  POST /api/v1/items/search-2
  PATCH /api/v1/items/count-2
  DELETE /api/v1/items/bulk-2
  GET /api/v1/items/list-3
  POST /api/v1/items/create-3
  PATCH /api/v1/items/update-3
  DELETE /api/v1/items/remove-3
  GET /api/v1/items/export-3
  POST /api/v1/items/search-3

бизнес-правила (14):
  `Tariff` — (по шаблону) вид
  `Zone` — (по шаблону) статус
  `Route` — (по шаблону) этап
  `Driver` — (по шаблону) вид
  `Vehicle` — (по шаблону) статус
  `Contract` — (по шаблону) этап
  `Claim` — (по шаблону) вид
  `Refund` — (по шаблону) статус
  `Audit` — (по шаблону) этап
  `Session` — (по шаблону) вид
  `Token` — (по шаблону) статус
  `Role` — (по шаблону) этап
  `Order` — (по шаблону) вид
  `Customer` — (по шаблону) статус
