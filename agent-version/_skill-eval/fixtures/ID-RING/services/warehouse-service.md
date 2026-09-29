# warehouse-service

Владелец: команда склада.

## Эндпоинты
- `POST /internal/slots` — бронь слота приёмки
- `DELETE /internal/slots/{slotId}` — снятие брони

## События
- публикует `warehouse.item-accepted`
