Сервис `svc`, тип `backend`. Прежняя карточка: есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику, **без нормализации — как стоят в файлах**.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (96):
  `GET /api/v1/items/list`
  `POST /api/v1/items/create`
  `PATCH /api/v1/items/update`
  `DELETE /api/v1/items/remove`
  `GET /api/v1/items/export`
  `POST /api/v1/items/search`
  `PATCH /api/v1/items/count`
  `DELETE /api/v1/items/bulk`
  `GET /api/v1/items/list-1`
  `POST /api/v1/items/create-1`
  `PATCH /api/v1/items/update-1`
  `DELETE /api/v1/items/remove-1`
  `GET /api/v1/items/export-1`
  `POST /api/v1/items/search-1`
  `PATCH /api/v1/items/count-1`
  `DELETE /api/v1/items/bulk-1`
  `GET /api/v1/items/list-2`
  `POST /api/v1/items/create-2`
  `PATCH /api/v1/items/update-2`
  `DELETE /api/v1/items/remove-2`
  `GET /api/v1/items/export-2`
  `POST /api/v1/items/search-2`
  `PATCH /api/v1/items/count-2`
  `DELETE /api/v1/items/bulk-2`
  `GET /api/v1/items/list-3`
  `POST /api/v1/items/create-3`
  `PATCH /api/v1/items/update-3`
  `DELETE /api/v1/items/remove-3`
  `GET /api/v1/items/export-3`
  `POST /api/v1/items/search-3`
  `PATCH /api/v1/items/count-3`
  `DELETE /api/v1/items/bulk-3`
  `GET /api/v1/items/list-4`
  `POST /api/v1/items/create-4`
  `PATCH /api/v1/items/update-4`
  `DELETE /api/v1/items/remove-4`
  `GET /api/v1/items/export-4`
  `POST /api/v1/items/search-4`
  `PATCH /api/v1/items/count-4`
  `DELETE /api/v1/items/bulk-4`
  `GET /api/v1/items/list-5`
  `POST /api/v1/items/create-5`
  `PATCH /api/v1/items/update-5`
  `DELETE /api/v1/items/remove-5`
  `GET /api/v1/items/export-5`
  `POST /api/v1/items/search-5`
  `PATCH /api/v1/items/count-5`
  `DELETE /api/v1/items/bulk-5`
  `GET /api/v1/items/list-6`
  `POST /api/v1/items/create-6`
  `PATCH /api/v1/items/update-6`
  `DELETE /api/v1/items/remove-6`
  `GET /api/v1/items/export-6`
  `POST /api/v1/items/search-6`
  `PATCH /api/v1/items/count-6`
  `DELETE /api/v1/items/bulk-6`
  `GET /api/v1/items/list-7`
  `POST /api/v1/items/create-7`
  `PATCH /api/v1/items/update-7`
  `DELETE /api/v1/items/remove-7`
  `GET /api/v1/items/export-7`
  `POST /api/v1/items/search-7`
  `PATCH /api/v1/items/count-7`
  `DELETE /api/v1/items/bulk-7`
  `GET /api/v1/items/list-8`
  `POST /api/v1/items/create-8`
  `PATCH /api/v1/items/update-8`
  `DELETE /api/v1/items/remove-8`
  `GET /api/v1/items/export-8`
  `POST /api/v1/items/search-8`
  `PATCH /api/v1/items/count-8`
  `DELETE /api/v1/items/bulk-8`
  `GET /api/v1/items/list-9`
  `POST /api/v1/items/create-9`
  `PATCH /api/v1/items/update-9`
  `DELETE /api/v1/items/remove-9`
  `GET /api/v1/items/export-9`
  `POST /api/v1/items/search-9`
  `PATCH /api/v1/items/count-9`
  `DELETE /api/v1/items/bulk-9`
  `GET /api/v1/items/list-10`
  `POST /api/v1/items/create-10`
  `PATCH /api/v1/items/update-10`
  `DELETE /api/v1/items/remove-10`
  `GET /api/v1/items/export-10`
  `POST /api/v1/items/search-10`
  `PATCH /api/v1/items/count-10`
  `DELETE /api/v1/items/bulk-10`
  `GET /api/v1/items/list-11`
  `POST /api/v1/items/create-11`
  `PATCH /api/v1/items/update-11`
  `DELETE /api/v1/items/remove-11`
  `GET /api/v1/items/export-11`
  `POST /api/v1/items/search-11`
  `PATCH /api/v1/items/count-11`
  `DELETE /api/v1/items/bulk-11`

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
контракт (96):
  `GET /api/v1/items/list`
  `POST /api/v1/items/create`
  `PATCH /api/v1/items/update`
  `DELETE /api/v1/items/remove`
  `GET /api/v1/items/export`
  `POST /api/v1/items/search`
  `PATCH /api/v1/items/count`
  `DELETE /api/v1/items/bulk`
  `GET /api/v1/items/list-1`
  `POST /api/v1/items/create-1`
  `PATCH /api/v1/items/update-1`
  `DELETE /api/v1/items/remove-1`
  `GET /api/v1/items/export-1`
  `POST /api/v1/items/search-1`
  `PATCH /api/v1/items/count-1`
  `DELETE /api/v1/items/bulk-1`
  `GET /api/v1/items/list-2`
  `POST /api/v1/items/create-2`
  `PATCH /api/v1/items/update-2`
  `DELETE /api/v1/items/remove-2`
  `GET /api/v1/items/export-2`
  `POST /api/v1/items/search-2`
  `PATCH /api/v1/items/count-2`
  `DELETE /api/v1/items/bulk-2`
  `GET /api/v1/items/list-3`
  `POST /api/v1/items/create-3`
  `PATCH /api/v1/items/update-3`
  `DELETE /api/v1/items/remove-3`
  `GET /api/v1/items/export-3`
  `POST /api/v1/items/search-3`
  `PATCH /api/v1/items/count-3`
  `DELETE /api/v1/items/bulk-3`
  `GET /api/v1/items/list-4`
  `POST /api/v1/items/create-4`
  `PATCH /api/v1/items/update-4`
  `DELETE /api/v1/items/remove-4`
  `GET /api/v1/items/export-4`
  `POST /api/v1/items/search-4`
  `PATCH /api/v1/items/count-4`
  `DELETE /api/v1/items/bulk-4`
  `GET /api/v1/items/list-5`
  `POST /api/v1/items/create-5`
  `PATCH /api/v1/items/update-5`
  `DELETE /api/v1/items/remove-5`
  `GET /api/v1/items/export-5`
  `POST /api/v1/items/search-5`
  `PATCH /api/v1/items/count-5`
  `DELETE /api/v1/items/bulk-5`
  `GET /api/v1/items/list-6`
  `POST /api/v1/items/create-6`
  `PATCH /api/v1/items/update-6`
  `DELETE /api/v1/items/remove-6`
  `GET /api/v1/items/export-6`
  `POST /api/v1/items/search-6`
  `PATCH /api/v1/items/count-6`
  `DELETE /api/v1/items/bulk-6`
  `GET /api/v1/items/list-7`
  `POST /api/v1/items/create-7`
  `PATCH /api/v1/items/update-7`
  `DELETE /api/v1/items/remove-7`
  `GET /api/v1/items/export-7`
  `POST /api/v1/items/search-7`
  `PATCH /api/v1/items/count-7`
  `DELETE /api/v1/items/bulk-7`
  `GET /api/v1/items/list-8`
  `POST /api/v1/items/create-8`
  `PATCH /api/v1/items/update-8`
  `DELETE /api/v1/items/remove-8`
  `GET /api/v1/items/export-8`
  `POST /api/v1/items/search-8`
  `PATCH /api/v1/items/count-8`
  `DELETE /api/v1/items/bulk-8`
  `GET /api/v1/items/list-9`
  `POST /api/v1/items/create-9`
  `PATCH /api/v1/items/update-9`
  `DELETE /api/v1/items/remove-9`
  `GET /api/v1/items/export-9`
  `POST /api/v1/items/search-9`
  `PATCH /api/v1/items/count-9`
  `DELETE /api/v1/items/bulk-9`
  `GET /api/v1/items/list-10`
  `POST /api/v1/items/create-10`
  `PATCH /api/v1/items/update-10`
  `DELETE /api/v1/items/remove-10`
  `GET /api/v1/items/export-10`
  `POST /api/v1/items/search-10`
  `PATCH /api/v1/items/count-10`
  `DELETE /api/v1/items/bulk-10`
  `GET /api/v1/items/list-11`
  `POST /api/v1/items/create-11`
  `PATCH /api/v1/items/update-11`
  `DELETE /api/v1/items/remove-11`
  `GET /api/v1/items/export-11`
  `POST /api/v1/items/search-11`
  `PATCH /api/v1/items/count-11`
  `DELETE /api/v1/items/bulk-11`

бизнес-правила (2):
  `Order` — вид
  `Customer` — статус
