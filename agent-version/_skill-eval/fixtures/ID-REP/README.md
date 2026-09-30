# ID-REP — реалистичная спека repairy (interaction-diagram 2.0.0)

REP-214 «Онлайн-оплата этапа ремонта заказчиком» — полная форма шаблона `technical-spec-doc` (шапка, §1–§8,
карточки со всеми полями и примерами JSON), ~330 строк. Сервисы — repairy-api / repairy-web из карточек `BR-REAL`.
Ловушки — те же классы, что в прод-логе SMSEC-5187:

| Карточка | Ловушка | Ожидание |
|---|---|---|
| INT-1 | «`repairy-web` (кабинет заказчика)» | участник `repairy-web`; `INT-1 · POST /projects/:pid/payments/online` |
| INT-2 | путь провайдера, 🔵 | `INT-2 · POST /v3/payments` |
| INT-3 | `Браузер заказчика ↔ ЮKassa (платёжная страница)`, пути нет | одна двусторонняя, подпись `INT-3` |
| INT-4 | `repairy-api ← ЮKassa (HTTP-уведомление)`; в «Авторизации» чужой `GET /v3/payments/{id}` | сплошная ЮKassa→repairy-api, `INT-4 · POST /webhooks/yookassa`, `GET` на стрелке нет |
| INT-5 | S3 PutObject, метода с путём нет | `INT-5` |
| INT-6 | `событие: … → repairy-telegram (через очередь BullMQ в Redis)` | асинхронная, `INT-6 · payment.succeeded` |
| INT-7 | та же пара, что INT-1, без скобки | тот же участник `repairy-web` |
| INT-8 | сторона `YooKassa` ≠ `ЮKassa`; путь «предположительно»; в «Триггере» свой эндпоинт возврата | отдельный участник `YooKassa`; `INT-8 · POST /v3/refunds` |
| INT-9 | направление «❓ не решено» | стрелки нет, INT-9 в отчёте |

Участники: repairy-web, repairy-api, ЮKassa, Браузер заказчика, S3-хранилище, repairy-telegram, YooKassa.
Вне §1.2 (отчёт обязан назвать): repairy-telegram, YooKassa. «Браузер заказчика» — человек/устройство.
Грейдер: `grade-id.mjs`, префикс папки пробы `rep-`.
