<!-- service-map: часть 01 2026-10-19 -->
GET /api/nights/free-count — src/nights/nights.controller.ts
состояние: Reservation.status REQUESTED | CONFIRMED — src/reservations/reservation.entity.ts
  · REQUESTED — при создании брони — src/reservations/reservations.service.ts
сообщение: «бронь изменена» — подписчикам, telescope.reservation.events — src/reservations/outbox.ts
Reservation — src/reservations/reservation.entity.ts (@Entity)
⟹ эндпоинтов 1, из них с фактами 1
⟹ состояний 1 (значений 2), справочников 0, сообщений 1, ограничений 0
