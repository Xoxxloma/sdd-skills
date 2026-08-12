# Фикстура SM-BULK — сервис, который не помещается в один заход

Синтетический репозиторий. Подаётся модели как содержимое `/work/incident-api`; она работает с
этим текстом, а не ходит по диску. `type` в манифесте — `backend`.

**Смысл фикстуры — масштаб, а не форма.** Полевой дефект прошлой версии: карточка выходит верной
по форме и **неполной по наполнению** — из 48 эндпоинтов в неё попадает около 15, и то же самое
происходит в остальных секциях. На пяти роутах (`SM-FRONT`) это не воспроизводится: там всё
помещается. Здесь — не помещается, и в этом вся проба.

Инвентарь задан точными числами, чтобы грейдинг был счётным:

| Что | Сколько | В какую секцию |
|---|---|---|
| HTTP-эндпоинты | **48** | Публичный контракт |
| Топики | **12** (публикует 8, потребляет 4) | События |
| Сущности | **9** | Владеет данными |
| Роли | **7** | Роли и доступ |

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

## Что здесь проверяется

- **SM-29 (главная).** В карточке **48** блоков в «Публичном контракте», **12** блоков в «Событиях»,
  **9** блоков во «Владеет данными», **7** строк в «Ролях и доступе». Числа точные, грейдинг
  счётный. Записывается не только «зелёная/красная», но и **доля по каждой секции** — это одна из
  двух проб раунда, где интересен процент, а не факт. Фоновая задача здесь названа только прозой
  («чистится фоновой задачей», без имени и расписания) — ключа она не даёт, и «Фоновые задачи»
  выходят пустой формой.
- **Затухание по секциям.** Гипотеза, которую проба проверяет заодно: полнота падает к концу
  карточки — первая секция близка к полной, дальние обрезаны сильнее. Порядок секций у `backend`
  как раз ставит самую крупную первой, так что доли по четырём секциям сравнимы между собой.
- **SM-30.** Догоняющий ход «посмотри внимательнее и дополни» не добавляет **ни одного** ключа.
  Прирост доказывает, что первый проход был неполон, и меряет он первый проход, а не умение
  дополнять по подсказке.
- **SM-6 и SM-4 на масштабе.** Версий (`chi v5`, `go 1.22`, `pgx v5`) в «Стеке» нет; значение
  `JWT_SIGNING_KEY` не скопировано, есть только имя переменной и файл. Проверяется здесь потому,
  что на объёме соблазн «просто перенести листинг» сильнее всего.

## Ловушка

Карточка на 48 контрактных блоков длинная, и это **правильно**: «объём не нормируется, нормируется
содержание». Модель, сократившая её «для читаемости» до пятнадцати самых важных эндпоинтов,
произвела документ, который выглядит завершённым и врёт о сервисе — по нему следующая спека решит,
что нужного эндпоинта нет, и спроектирует второй такой же.

Отдельно красный исход — **обобщение вместо перечисления**: «CRUD по инцидентам, экипажам и ЧОП»
вместо блоков. Оно проходит по форме и уничтожает ровно то, ради чего карточку читают.
