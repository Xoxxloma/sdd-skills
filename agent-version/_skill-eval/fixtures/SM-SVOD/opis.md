POST /api/reservations/cancel — src/main/java/obs/reservation/ReservationController.java
  сущности: → Reservation — src/main/java/obs/reservation/Reservation.java
  доступ: NIGHT_OPERATOR; наблюдатель — только своя бронь — src/main/java/obs/reservation/ReservationController.java
  меняет: Reservation.status CONFIRMED → CANCELLED — если ночь ещё не началась — src/main/java/obs/reservation/ReservationService.java
  шлёт: publishCancelled — при отмене брони — src/main/java/obs/reservation/ReservationService.java
POST /api/reservations/confirm — src/main/java/obs/reservation/ReservationController.java
  доступ: без проверки — src/main/java/obs/reservation/ReservationController.java
  меняет: Reservation.status REQUESTED → CONFIRMED — src/main/java/obs/reservation/ReservationService.java
  шлёт: нет
GET /api/admin/stats — src/main/java/obs/admin/AdminController.java
  доступ: не определено: правило в общем конфиге — src/main/java/obs/admin/AdminController.java
  меняет: нет
  шлёт: нет
Reservation — src/main/java/obs/reservation/Reservation.java (@Entity)
Member — src/main/java/obs/crew/Member.java (@Entity)
Telescope — py/telescope.py (Model)
перечисление: ReservationStatus REQUESTED | CONFIRMED | CANCELLED | WAITLISTED — src/main/java/obs/reservation/ReservationStatus.java
перечисление: MemberRole CURATOR | PARTICIPANT — src/main/java/obs/crew/MemberRole.java
место: ReservationStatus.CANCELLED — сравнение — повторная отмена отклоняется — src/main/java/obs/reservation/ReservationService.java:9
место: ReservationStatus.REQUESTED — переход — начальное значение — src/main/java/obs/reservation/Reservation.java:40
правило доступа: /admin/** → ADMIN — src/main/java/obs/config/SecurityConfig.java:6
отправитель: publishCancelled → telescope.reservation.cancelled — src/main/java/obs/reservation/ReservationProducer.java
⟹ эндпоинтов 3, из них с фактами 0
⟹ сущностей 3
