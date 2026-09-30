# ID-DIR — направления и имена сторон (interaction-diagram 2.0.0)

Спека DIR-7 руками, 7 карточек. Проверяет то, чего нет в ID-DIAG / ID-RING:

| Карточка | Ловушка | Ожидание |
|---|---|---|
| INT-1 | сторона «UI (страница «Отчёты»)» | участник `UI` (имя до ` (`) |
| INT-2 | та же сторона как «UI», заголовок без эмодзи | тот же участник `UI`; `INT-2 · POST /v1/reports/{id}/file` |
| INT-3 | `UI (браузер) ↔ MinIO (S3)`, пути в контракте нет | одна двусторонняя `UI`↔`MinIO`, подпись `INT-3` |
| INT-4 | `reports-api ← av-scanner (колбэк)` | сплошная от av-scanner к reports-api |
| INT-5 | `событие: reports-api → notify (через Kafka)` | асинхронная, `INT-5 · report.ready` |
| INT-6 | путь «предположительно `POST /scan`» | на стрелке `POST /scan` |
| INT-7 | направление «❓ не решено» | стрелки нет, INT-7 в отчёте |

Участники по порядку: UI, reports-api, MinIO, av-scanner, notify. Вне §1.2: UI, MinIO (сервисы — отчёт обязан назвать).
Грейдер: `grade-id.mjs`, префикс папки пробы `dir-`.
