night_operator — src/security/roles.ts
состояние: Reservation.status REQUESTED | CONFIRMED — src/reservations/reservation.entity.ts
сообщение: «бронь подтверждена» — подписчикам, telescope.reservation.events — src/reservations/outbox.ts

GET /api/nights/free-count — src/nights/nights.controller.ts
Reservation — src/reservations/reservation.entity.ts (@Entity)

GET /api/nights/free-count?telescopeId= — src/nights/nights.controller.ts
  · ответ кэшируется на минуту — src/nights/nights.controller.ts

⟹ состояний 1 (значений 2), справочников 0, сообщений 1, ограничений 0
⟹ эндпоинтов 2, из них с фактами 2
