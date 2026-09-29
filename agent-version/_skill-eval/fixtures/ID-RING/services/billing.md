# billing

Владелец: команда биллинга.

## Эндпоинты
- `POST /v1/refunds/create` — создание возврата денег (внутренний)
- `GET /v1/refunds/{id}` — статус возврата

## События
- слушает `warehouse.item-accepted`
