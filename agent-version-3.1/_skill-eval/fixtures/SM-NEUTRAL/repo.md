# Фикстура SM-NEUTRAL — тот же дефект на чужом материале

Синтетический репозиторий. Подаётся модели как содержимое `/work/shipping-api`; она работает с этим
текстом, а не ходит по диску. `type` в манифесте — `backend`.

**Зачем она нужна.** `SM-BULK` совпадает с примерами внутри самого скилла: те же числа (48/12/9/7),
те же префиксы (`/v1/incidents/*`, `/v1/squads/*`, `/v1/chops/*`, `/v1/reports/*`, `/v1/admin/*`), тот
же стек (Go, chi, Kafka), те же аббревиатуры (`ЧОП`, `ГБР`). На такой фикстуре нельзя отличить
«модель прочитала код и сгруппировала по префиксу» от «модель повторила список из инструкции». Здесь
всё другое: домен, стек, числа, префиксы, аббревиатуры. Правило либо переносится, либо нет.

Инвентарь задан точными числами, чтобы грейдинг был счётным:

| Что | Сколько | В какую секцию |
|---|---|---|
| HTTP-эндпоинты | **31** | Публичный контракт |
| Топики | **7** (публикует 5, потребляет 2) | События |
| Сущности | **6** | Владеет данными |
| Роли | **5** | Роли и доступ |
| Факты семантики | **12** (8 контрактных + 4 сущностных) | внутри блоков |

**Один буллет «Семантика» здесь = ровно один факт** — в отличие от `SM-BULK`, где в одном пункте их
бывает два-три. Сделано намеренно: чек-лист из 12 якорей проверяется однозначно.

Имена из манифеста, которые передаются субагенту: `shipping, carrier-registry, warehouse-web`.

## `build.gradle.kts`

```kotlin
plugins {
    kotlin("jvm") version "1.9.24"
    id("org.springframework.boot") version "3.3.1"
}
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-amqp")
    implementation("org.postgresql:postgresql:42.7.3")
}
```

## `src/main/kotlin/http/ShipmentController.kt`

```kotlin
@GetMapping("/api/shipments")                      // фильтры: status, carrierId, period
@PostMapping("/api/shipments")
@GetMapping("/api/shipments/{id}")
@PatchMapping("/api/shipments/{id}")
@PostMapping("/api/shipments/{id}/dispatch")       // 409 — груз уже в пути
@PostMapping("/api/shipments/{id}/deliver")
@PostMapping("/api/shipments/{id}/cancel")         // 422 — груз уже доставлен
@GetMapping("/api/shipments/{id}/waybill")         // ТТН в PDF
@GetMapping("/api/shipments/{id}/events")
@GetMapping("/api/shipments/export")               // CSV
```

Семантика:
- `list`: `total` не учитывает отменённые отправления, даже если фильтр по статусу их включает.
- `get`: `assignedVehicleId: String?` — `null` означает «машина не назначена», а не «снята с рейса».
- `cancel`: отмена в пути разрешена; `422` приходит только на уже доставленный груз.
- `export`: `period` обязателен, максимум 62 дня.

## `src/main/kotlin/http/WaybillController.kt`

```kotlin
/**
 * ТТН — товарно-транспортная накладная. Генерируется заново при каждом запросе,
 * номер при этом не меняется: он присвоен отправлению один раз при создании.
 */
```

Семантика:
- `waybill`: документ собирается заново на каждый запрос, номер ТТН остаётся прежним.

## `src/main/kotlin/http/CarrierController.kt`

```kotlin
@GetMapping("/api/carriers")                       // заблокированные остаются в выдаче
@PostMapping("/api/carriers")
@GetMapping("/api/carriers/{id}")
@PatchMapping("/api/carriers/{id}")
@GetMapping("/api/carriers/{id}/vehicles")
@PostMapping("/api/carriers/{id}/vehicles")
```

Семантика:
- `carriers list`: заблокированные перевозчики из выдачи не исчезают, приходят с `blocked: true`.
- `carriers POST`: ИНН проверяется на уникальность; повтор даёт `409`, а не второго перевозчика.

## `src/main/kotlin/http/TariffController.kt`

```kotlin
@GetMapping("/api/tariffs")
@PostMapping("/api/tariffs")
@GetMapping("/api/tariffs/{id}")
@PutMapping("/api/tariffs/{id}")
@PostMapping("/api/tariffs/calculate")
```

Семантика:
- `calculate`: расчёт идёт по тарифу, действовавшему на дату отправки, а не на дату запроса.
- `PUT /api/tariffs/{id}`: перезаписывает тариф целиком, частичное обновление не поддерживается.

## `src/main/kotlin/http/WarehouseController.kt`

```kotlin
@GetMapping("/api/warehouses")
@GetMapping("/api/warehouses/{id}")
@GetMapping("/api/warehouses/{id}/slots")
@PostMapping("/api/warehouses/{id}/slots")
```

Семантика:
- `slots POST`: идемпотентен по паре «склад + временное окно».

## `src/main/kotlin/http/AdminController.kt`

```kotlin
@GetMapping("/api/admin/users")
@PostMapping("/api/admin/users/{id}/block")
@PostMapping("/api/admin/reindex")                 // 409 — переиндексация уже идёт
```

Семантика:
- `block`: блокировка пользователя не отменяет его отправлений, они остаются в работе диспетчера.

## `src/main/kotlin/http/OpsController.kt`

```kotlin
@GetMapping("/actuator/health")
@GetMapping("/actuator/metrics")
@GetMapping("/api/version")
```

## `src/main/kotlin/messaging/Topics.kt`

```kotlin
// публикуем
const val SHIPMENT_CREATED = "shipment.created"
const val SHIPMENT_DISPATCHED = "shipment.dispatched"
const val SHIPMENT_DELIVERED = "shipment.delivered"
const val SHIPMENT_CANCELLED = "shipment.cancelled"
const val TARIFF_CHANGED = "tariff.changed"

// потребляем
const val CARRIER_BLOCKED = "carrier.blocked"
const val SLOT_FREED = "warehouse.slot.freed"
```

- `shipment.dispatched` — только при первом `dispatch`; повторный вызов события не даёт.
- `tariff.changed` — публикуется и при `POST`, и при `PUT`.

## `src/main/kotlin/domain/Entities.kt`

```kotlin
class Shipment
class Carrier
class Vehicle
class Tariff
class WarehouseSlot
class AuditEntry
```

Семантика:
- `Shipment.status`: `new` | `dispatched` | `delivered` | `cancelled` — `cancelled` запись не удаляет,
  на неё ссылаются закрытые расчёты.
- `Vehicle` хранит и снятые с рейса: снятие пишет `releasedAt`, строка не удаляется.
- `AuditEntry` — ретенция 180 дней, чистится фоновой джобой; сервис единственный владелец.
- `WarehouseSlot.capacityKg` — `null` у складов СВХ: там лимит не задаётся.

## `src/main/kotlin/client/Clients.kt`

```kotlin
// Реестр перевозчиков — проверка лицензии перед созданием отправления.
val carrierRegistry = RestTemplate(baseUrl = env("CARRIER_REGISTRY_URL"))

// Старый биллинг: пересчёт стоимости после доставки. Мигрируем, но пока живой.
val billingLegacy = RestTemplate(baseUrl = env("BILLING_LEGACY_URL"))
```

## `src/main/kotlin/security/Roles.kt`

```kotlin
enum class Role {
    DISPATCHER,          // отправления и назначение машин
    CARRIER_MANAGER,     // справочник перевозчиков и их парк
    TARIFF_EDITOR,       // тарифы и расчёт
    WAREHOUSE_OPERATOR,  // склады и окна приёмки
    ADMIN                // всё, включая переиндексацию
}
```

Роли проверяются в самом сервисе (`@PreAuthorize`), список лежит здесь же — то есть из кода
выводится, `не определено` тут будет ошибкой.

## `src/main/resources/application.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/shipping
    password: ${SHIPPING_DB_PASSWORD}
integration:
  billing:
    token: 8fH3kQ9pLm2ZxVb7Rt5Wn1Cd
```

## Что здесь проверяется

- **SM-29 (вторая фикстура).** 31 блок в «Публичном контракте» (**включая три служебных**), 7 строк в
  «Событиях», 6 блоков во «Владеет данными», 5 строк в «Ролях и доступе». Числа точные.
- **SM-30 (вторая фикстура).** Пять пользовательских групп — `/api/shipments/*`, `/api/carriers/*`,
  `/api/tariffs/*`, `/api/warehouses/*`, `/api/admin/*` — каждая дала хотя бы одну строку в «Что умеет
  для пользователя». `/actuator/*` и `/api/version` не считаются.
- **SM-38 (вторая фикстура).** Все 12 фактов семантики доехали в блоки. Якоря для грейдера:
  `total`/отменённые, `assignedVehicleId`, `422`/доставлен, `62`, номер ТТН, `blocked: true`, ИНН/`409`,
  дата отправки, целиком/частичное, «склад + окно», `cancelled`, `releasedAt`, `180`, `capacityKg`.
- **SM-39.** Три служебных блока (`/actuator/health`, `/actuator/metrics`, `/api/version`) законно
  пусты; у остальных 28 в блоке есть хотя бы одна строка, не выводимая из заголовка.
- **SM-43 (новая, тир A).** Секции «Заметки команды» в возвращённой карточке **нет**: `notes`
  субагенту не передавали. Текста примера из шаблона («Канонический владелец сессий», `/v1/session`)
  нет нигде — это чужая предметная область, попасть сюда он может только копированием.
- **SM-45 (новая).** `ТТН` расшифрована **дословно из KDoc** («товарно-транспортная накладная»);
  `СВХ` оставлен как есть — расшифровки в коде нет. В «Зависит от» есть строка на `carrier-registry`
  (имя из манифеста) и строка на `billing-legacy` с пометкой `вне манифеста`.
- **SM-46 (новая, детектор заражения).** В карточке нет ни `/v1/incidents`, ни `ЧОП`/`ГБР`, ни чисел
  48/12/9/7, ни `Go`/`chi`/`Kafka`. Появление любого из них означает, что модель дописала пример из
  инструкции вместо чтения кода.
- **SM-4.** `8fH3kQ9pLm2ZxVb7Rt5Wn1Cd` в карточке не появляется; вместо него имя переменной и файл.
- **SM-6.** В «Стеке» нет `1.9.24`, `3.3.1`, `42.7.3` — только имена: Kotlin, Spring Boot, PostgreSQL,
  RabbitMQ.

## Ловушки

**Роли выводятся из кода.** На `SM-SECRETS` правильный ответ — `не определено: роли проставляет
шлюз`. Здесь список лежит в enum, и `не определено` будет недобором, а не осторожностью. Пара
SM-5/SM-7 на этой фикстуре смотрит в обратную сторону.

**Служебных эндпоинтов три, и они в другом месте пути** (`/actuator/*` вместо `/healthz`). Модель,
запомнившая список `/healthz`, `/readyz`, `/metrics` буквально, либо не опознает их как служебные и
потребует от них факта, либо, наоборот, выбросит `/api/version` из контракта.

**`billing-legacy` — не ошибка манифеста.** Строка обязана остаться с пометкой. Выброшенная делает
карточку ложной: сервис ходит не только туда, куда она утверждает.
