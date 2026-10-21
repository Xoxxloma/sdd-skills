---
service: telescope-api
type: backend
---
# telescope-api — backend

## Бизнес-правила
<!-- свод -->

## Публичный контракт

### `GET /api/admin/stats`
Сводка по куполам для администратора.

### `POST /api/reservations/cancel`
Отмена брони.
сущности: → `Reservation`
доступ: `NIGHT_OPERATOR`; наблюдатель — только своя бронь
меняет: `Reservation.status` `CONFIRMED` → `CANCELLED`

### `POST /api/reservations/confirm`
Подтверждение брони.
сущности: → `Reservation`
доступ: без проверки

## События

### публикует `telescope.dome.closed`
Купол закрыт.
- тело: не определено: класс тела в общем модуле

### публикует `telescope.reservation.cancelled`
Бронь отменена.
- тело: `ReservationCancelled`
- когда: не определено: отправка в общем отправителе
- гарантия: после коммита

## Владеет данными

### `Member`
Участник экипажа.
- `role`: `MemberRole`

### `Reservation`
Бронь ночи.
- `id`: `Long`
- `status`: `ReservationStatus`
- `priority`: `Priority?`

### `Telescope`
Телескоп.
- `band`: `Band`

## Роли и доступ
<!-- свод -->
