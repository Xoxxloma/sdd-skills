Ты — сканирующий субагент. Тебя запустил ведущий агент скилла `service-map` и передал всё, что
ниже. По диску ты ходишь только за формой карточки (путь ниже); других файлов не читаешь,
субагентов не запускаешь.

**Сервис:** `/work/incident-api`, тип `backend`.
**Имена всех сервисов из манифеста:** `incident-api`, `auth`, `geo`, `incident-web`
**Прежней карточки нет.**

## Форма карточки

Прочитай целиком файл `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\card.template.md` — там форма карточки, ветвление секций по типу, ключи и
правила содержания. Ответ начни строкой `шаблон прочитан, тип: <type>`.

## Три правила, которые важнее процедуры

**1. Не выводится из кода — пиши `не определено`.** Соблазн достроить по аналогии здесь особенно
силён: имя папки намекает, привычный фреймворк подсказывает. Но карточку через неделю прочитает
`technical-spec-doc` и понесёт аналитику как «в `services/auth.md` описано, что…». Догадка,
записанная как факт, к этому моменту уже неотличима от правды и стоит дороже честного пробела.

**2. Ты только читаешь чужие репозитории.** Ни одного изменения в папке сервиса — ни файла, ни
ветки. Пишешь только сюда, в репозиторий со спеками, и только те файлы, что перечислены выше. Если
целевая папка совпадает с текущей — остановись и скажи об этом: значит, тебя запустили не оттуда.

**3. Секреты не копируются.** Имя переменной и файл — да, значение — никогда. Ты читаешь `.env` и
конфиги, и токен, попавший в карточку, попадёт вместе с ней в коммит.

## Порядок работы

**Сначала опись, потом карточка. Это не совет, а обязательный порядок для субагента.**

Пусть он сперва выпишет **полный плоский список ключей** и посчитает их: все роуты, все эндпоинты,
все топики, все сущности, все роли, все экраны. Одна строка на ключ, без описаний. В конце — числа:
«эндпоинтов 48, топиков 12, сущностей 9, ролей 7». И только потом разворачивает карточку по этому
списку, проходя его подряд.

**В опись идут все ключи без единого исключения — служебные тоже.** Проверки живости и готовности,
метрики, версия сборки, фичефлаги — как бы они ни назывались в этом сервисе. Написать про них нечего
сверх заголовка, и это не повод не записать ключ: **ноль фактов — не ноль ключей**. Ниже названо
единственное место, где служебная группа что-то теряет, и теряет она там **строку возможности, а не
ключ описи**; вычесть их заодно и из описи — самый частый способ промахнуться, и промах этот
невидим: опись на три ключа короче сходится с контрактом на три блока короче, и обе выглядят полными.

**«Что умеет для пользователя» собирается по той же описи, а не по памяти.** Это единственная
секция, ключи которой не лежат в коде готовыми, и потому она недобирается сильнее всех: её пишут
первой, «в общих чертах», ещё до того как список эндпоинтов составлен.

Порядок обратный и механический:

1. **Разбей опись на группы по общему префиксу** — `/v1/incidents/*`, `/v1/squads/*`,
   `/v1/chops/*`, `/v1/reports/*`, `/v1/admin/*`; у фронта группа — раздел роутов. Префикс берётся
   из кода, придумывать группировку не надо.

   **Группировка — это способ выбрать строки возможностей, а не структура карточки.** В самой
   карточке её нет нигде: «Публичный контракт» остаётся плоским списком блоков `###`, по одному на
   эндпоинт, без заголовков-разделов над ними. Заголовок блока — механический ключ, по которому
   `archive-spec` находит, что переписать; сгруппировав контракт, ты уводишь ключ на уровень глубже
   и он перестаёт совпадать.
2. **Каждая группа даёт минимум одну строку** — кроме той, которой пользуется не человек, а
   инфраструктура: проверки живости, метрики, версия сборки. Больше исключений нет, и `/v1/admin/*`
   к ним не относится: это возможности администратора, а не техника, и теряют их чаще всего.

   **Речь только о строке в этой секции.** Сами эндпоинты никуда не деваются: в «Публичном
   контракте» они стоят наравне со всеми, по ним ходят балансировщик и мониторинг, и опись обязана
   сойтись с контрактом до последнего ключа. Здесь решается, попадёт ли ключ в **список
   возможностей**, а не остаётся ли он в карточке.
3. **Формулируй словами пользователя, а не кода:** «выгрузить отчёт по инцидентам за период», а не
   `GET /v1/incidents/export`. Соседние ключи про одно и то же сворачиваются в одну строку.

Непокрытая группа означает, что `business-requirements-doc` будет спрашивать аналитика про
возможность, которая в сервисе давно есть.

Почему именно так. Недобор — самый частый дефект этого шага, и он не про лень: когда карточка
пишется сразу, выбор «а это достаточно важно, чтобы писать?» принимается на **каждом** элементе, и
на сорок восьмом эндпоинте модель уже давно решает, что суть передана. Из сорока восьми доезжает
около пятнадцати, форма при этом безупречна, и отличить такую карточку от полной нельзя ничем.
Списку выбирать нечего: он составляется до того, как появляется соблазн сокращать, и дальше служит
чек-листом, по которому видно, что пропущено.

**Объём не нормируется.** Сорок восемь эндпоинтов дают сорок восемь блоков, и длинная карточка —
правильный результат, а не повод сжать. Обобщение вместо перечисления («CRUD по инцидентам,
экипажам и ЧОП») — худший исход шага: оно проходит по форме, выглядит опрятно и уничтожает ровно
то, ради чего карточку читают.

## Две секции, которые ты не заполняешь

- «Заметки команды» не выводи вообще — их вставляет ведущий агент из манифеста.
- «Кто меня потребляет» выведи ПУСТОЙ ФОРМОЙ: заголовок и строку `| — | | |`.

## Что вернуть

Опись и текст карточки, и ничего больше, начав ответ строкой `шаблон прочитан, тип: <type>`.
Файлов сервиса ты не пишешь.

---

# СОДЕРЖИМОЕ РЕПОЗИТОРИЯ `/work/incident-api`

## `go.mod`

```
module git.example/incident-api
go 1.22
require github.com/go-chi/chi/v5 v5.0.12
require github.com/jackc/pgx/v5 v5.6.0
require github.com/segmentio/kafka-go v0.4.47
```

## `internal/http/routes_incidents.go`

```go
r.Get("/v1/incidents", h.ListIncidents)                       // фильтры: status, type, period, chopId
r.Post("/v1/incidents", h.CreateIncident)
r.Get("/v1/incidents/{id}", h.GetIncident)
r.Patch("/v1/incidents/{id}", h.UpdateIncident)
r.Delete("/v1/incidents/{id}", h.SoftDeleteIncident)          // мягкое удаление, запись остаётся
r.Post("/v1/incidents/{id}/close", h.CloseIncident)           // идемпотентен; 409 — уже закрыт
r.Post("/v1/incidents/{id}/reopen", h.ReopenIncident)         // 422 — закрыт более 30 суток назад
r.Get("/v1/incidents/{id}/history", h.IncidentHistory)
r.Get("/v1/incidents/{id}/attachments", h.ListAttachments)
r.Post("/v1/incidents/{id}/attachments", h.AddAttachment)
r.Delete("/v1/incidents/{id}/attachments/{aid}", h.DropAttachment)
r.Get("/v1/incidents/export", h.ExportIncidents)              // CSV; period обязателен, максимум 31 день
```

Семантика, которую не вывести из имён:
- `ListIncidents`: `total` в ответе — оценка, а не точный счёт, если фильтр без периода.
- `GetIncident`: `assignedSquadId: string|null` — `null` означает «не назначен», а не «снят».
- `SoftDeleteIncident`: запись остаётся и продолжает попадать в `history`, но исчезает из списка.

## `internal/http/routes_squads.go`

```go
r.Get("/v1/squads", h.ListSquads)                             // фильтр available=true|false
r.Post("/v1/squads", h.CreateSquad)
r.Get("/v1/squads/{id}", h.GetSquad)
r.Patch("/v1/squads/{id}", h.UpdateSquad)
r.Post("/v1/squads/{id}/assign", h.AssignSquad)               // 409 — экипаж уже на выезде
r.Post("/v1/squads/{id}/release", h.ReleaseSquad)
r.Get("/v1/squads/{id}/shifts", h.ListShifts)
r.Post("/v1/squads/{id}/shifts", h.OpenShift)
r.Post("/v1/squads/{id}/shifts/{sid}/close", h.CloseShift)
```

Семантика:
- `GetSquad`: `status`: `free` | `enroute` | `onsite` | `offshift` — `offshift` ставит планировщик
  по расписанию смены, диспетчер этот переход не инициирует.
- `AssignSquad` идемпотентен по паре «экипаж + инцидент».

## `internal/http/routes_chops.go`

```go
r.Get("/v1/chops", h.ListChops)                               // неактивные остаются в выдаче
r.Post("/v1/chops", h.CreateChop)
r.Get("/v1/chops/{id}", h.GetChop)
r.Patch("/v1/chops/{id}", h.UpdateChop)
r.Get("/v1/chops/{id}/districts", h.ChopDistricts)
r.Post("/v1/chops/{id}/districts", h.AttachDistrict)
r.Delete("/v1/chops/{id}/districts/{did}", h.DetachDistrict)
```

Семантика:
- `ListChops`: `active: bool` — снятие флага не удаляет запись, на неё ссылаются закрытые инциденты.
- `DetachDistrict`: открепление не переписывает историю — закрытые инциденты сохраняют прежний ЧОП.

## `internal/http/routes_reports.go`

```go
r.Get("/v1/reports/coverage", h.CoverageReport)               // 422 — период длиннее 31 дня
r.Get("/v1/reports/response-time", h.ResponseTimeReport)
r.Get("/v1/reports/squad-load", h.SquadLoadReport)
r.Get("/v1/reports/chop-sla", h.ChopSlaReport)
r.Post("/v1/reports/schedule", h.ScheduleReport)              // регулярная выгрузка на почту
r.Delete("/v1/reports/schedule/{id}", h.DropSchedule)
```

Семантика:
- `CoverageReport`: `gapMinutes` и `coveredMinutes` в сумме равны длине периода; `chopId: string|null`
  — `null` означает «район не был закреплён», а не «нет данных».
- `ChopSlaReport`: SLA считается только по закрытым инцидентам; открытые в знаменатель не входят.

## `internal/http/routes_admin.go`

```go
r.Get("/v1/admin/users", h.ListUsers)
r.Post("/v1/admin/users", h.CreateUser)
r.Patch("/v1/admin/users/{id}", h.UpdateUser)
r.Post("/v1/admin/users/{id}/block", h.BlockUser)
r.Get("/v1/admin/audit", h.AuditLog)                          // только чтение, ретенция 400 дней
r.Get("/v1/admin/settings", h.GetSettings)
r.Put("/v1/admin/settings", h.PutSettings)
r.Post("/v1/admin/reindex", h.Reindex)                        // 409 — переиндексация уже идёт
```

Семантика:
- `BlockUser` не завершает активные сессии: их отзывает `auth` по событию `user.blocked`.
- `PutSettings` перезаписывает набор целиком; частичное обновление не поддерживается.

## `internal/http/routes_health.go`

```go
r.Get("/healthz", h.Healthz)
r.Get("/readyz", h.Readyz)
r.Get("/metrics", h.Metrics)
r.Get("/v1/version", h.Version)
r.Get("/v1/features", h.FeatureFlags)
r.Get("/v1/time", h.ServerTime)                               // источник времени для клиентов
```

## `internal/events/topics.go`

```go
// публикуем
const (
	TopicIncidentCreated   = "incident.created"
	TopicIncidentAssigned  = "incident.assigned"
	TopicIncidentClosed    = "incident.closed"
	TopicIncidentReopened  = "incident.reopened"
	TopicSquadStatus       = "squad.status.changed"
	TopicShiftOpened       = "squad.shift.opened"
	TopicShiftClosed       = "squad.shift.closed"
	TopicReportReady       = "report.ready"
)

// потребляем
const (
	TopicUserBlocked       = "user.blocked"        // блокировка пользователя в auth
	TopicChopDeactivated   = "geo.chop.deactivated"
	TopicDistrictChanged   = "geo.district.changed"
	TopicSessionRevoked    = "auth.session.revoked"
)
```

Когда публикуется:
- `incident.assigned` — при успешном `assign`, но не при повторном (идемпотентность).
- `report.ready` — только для регулярных выгрузок; синхронные отчёты события не дают.
- `squad.shift.closed` — и по кнопке диспетчера, и по расписанию планировщика.

## `internal/storage/models.go`

```go
type Incident struct{ ... }        // единственный источник правды по инцидентам
type IncidentHistoryEntry struct{ ... }
type Attachment struct{ ... }
type Squad struct{ ... }
type Shift struct{ ... }
type Assignment struct{ ... }
type ReportSchedule struct{ ... }
type AuditEntry struct{ ... }
type Settings struct{ ... }
```

Семантика:
- `Incident.status`: `new` | `assigned` | `onsite` | `closed` | `deleted` — `deleted` ставит мягкое
  удаление; переход из `closed` возможен только через `reopen` и только в течение 30 суток.
- `Assignment` хранит и снятые назначения: снятие пишет `releasedAt`, а не удаляет строку.
- `AuditEntry` — ретенция 400 дней, чистится фоновой задачей; сервис единственный владелец.
- `Settings` — одна строка на инсталляцию, версионируется полем `revision`.
- `Attachment.size` — в байтах; `null` у вложений, загруженных до 2025 года.

## `internal/auth/roles.go`

```go
const (
	RoleDispatcher     = "dispatcher"
	RoleShiftLead      = "shift_lead"
	RoleSecurityAnalyst = "security_analyst"
	RoleChopManager    = "chop_manager"
	RoleReportViewer   = "report_viewer"
	RoleAdmin          = "admin"
	RoleServiceAccount = "service_account"     // межсервисные вызовы, интерактивно не выдаётся
)
```

Что может каждая:
- `dispatcher` — инциденты и назначения экипажей;
- `shift_lead` — то же плюс смены и отчёт по нагрузке;
- `security_analyst` — только чтение аудита;
- `chop_manager` — справочник ЧОП и закрепление районов;
- `report_viewer` — только отчёты;
- `admin` — всё, включая настройки и переиндексацию;
- `service_account` — межсервисные вызовы, интерактивно не выдаётся.

## `.env.example`

```
DATABASE_URL=postgres://user:pass@localhost:5432/incidents
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092
JWT_SIGNING_KEY=8Hq2LmX9pR4tVzKw1NcBd7YsAe3GfUj0
```

