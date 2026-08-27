# Фикстура SM-HOP — поля лежат НЕ рядом с сущностью

Синтетический репозиторий. Подаётся модели как содержимое `/work/shipping-api`; она работает с этим
текстом, а не ходит по диску. `type` в манифесте — `backend`.

**Зачем она нужна.** `SM-NEUTRAL` кладёт поля сплошным блоком прямо под именем сущности
(`data class Shipment(val id: String, …)`), и на такой раскладке baseline даёт 5 из 5: переписать
готовый блок — механическая работа. Живая репа устроена иначе, и сам `card.template.md` это
называет главной причиной пустых карточек: «поля ответа, их типы, что значит `null` — файл DTO или
сущности, а не контроллер», «за фактом, лежащим в другом файле, надо зайти».

Здесь ровно эта раскладка. `domain/Entities.kt` объявляет шесть голых классов и не содержит ни
одного поля. Поля разложены по шести другим файлам: два DTO, две миграции, одна доменная запись,
один аудит-класс. Инвентарь **тот же, что у `SM-NEUTRAL`** (31/7/6/5, 12 фактов семантики, 45
полей) — значит доли сравнимы с ним напрямую, и различие между плечами ровно одно: надо ли делать
второй переход.

Решение «зайти ли за полями» принимается заново на **каждой** сущности — шесть раз, — и каждый раз
пропустить дёшево. Это тот же провал, что скилл уже описывает для эндпоинтов: на сорок восьмом
модель давно решает, что суть передана.

Инвентарь задан точными числами, чтобы грейдинг был счётным:

| Что | Сколько | В какую секцию |
|---|---|---|
| HTTP-эндпоинты | **31** | Публичный контракт |
| Топики | **7** (публикует 5, потребляет 2) | События |
| Сущности | **6** | Владеет данными |
| Поля сущностей | **45** (у всех 6), **ни одного в `Entities.kt`** | Владеет данными, строки `-` внутри блоков |
| Роли | **5** | Роли и доступ |
| Факты семантики | **12** (8 контрактных + 4 сущностных) | внутри блоков |

**Один буллет «Семантика» здесь = ровно один факт**, как в `SM-NEUTRAL`: чек-лист из 12 якорей
проверяется однозначно.

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

## `src/main/kotlin/http/dto/ShipmentDto.kt`

```kotlin
data class ShipmentDto(
    val id: String,
    val number: Long,
    val status: String,
    val carrierId: String,
    val vehicleId: String?,
    val originSlotId: String,
    val destinationAddress: String,
    val weightKg: Int,
    val declaredValue: BigDecimal?,
    val createdAt: Instant,
    val deliveredAt: Instant?,
)
```

Отдаётся всеми ручками `/api/shipments*` и повторяет сущность целиком.

## `src/main/kotlin/http/WaybillController.kt`

```kotlin
/**
 * ТТН — товарно-транспортная накладная. Генерируется заново при каждом запросе,
 * номер при этом не меняется: он присвоен отправлению один раз при создании.
 */
```

Семантика:
- `waybill`: документ собирается заново на каждый запрос, номер ТТН остаётся прежним.

## `src/main/kotlin/http/dto/CarrierDto.kt`

```kotlin
data class CarrierDto(
    val id: String,
    val inn: String,
    val name: String,
    val licenseNumber: String,
    val licenseValidUntil: LocalDate,
    val active: Boolean,
    val createdAt: Instant,
)
```

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

## `src/main/kotlin/domain/TariffRecord.kt`

```kotlin
class TariffRecord(
    val id: String,
    val carrierId: String,
    val route: String,
    val pricePerKg: BigDecimal,
    val minPrice: BigDecimal?,
    val validFrom: LocalDate,
    val validUntil: LocalDate?,
)
```

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

## `src/main/kotlin/db/migration/V4__vehicles.sql`

```sql
CREATE TABLE vehicles (
    id            uuid PRIMARY KEY,
    carrier_id    uuid NOT NULL REFERENCES carriers (id),
    plate         varchar(16) NOT NULL,
    model         varchar(64) NOT NULL,
    capacity_pallets integer NOT NULL,
    assigned_at   timestamptz NOT NULL,
    released_at   timestamptz
);
```

## `src/main/kotlin/db/migration/V7__warehouse_slots.sql`

```sql
CREATE TABLE warehouse_slots (
    id             uuid PRIMARY KEY,
    code           varchar(32) NOT NULL,
    warehouse_type varchar(16) NOT NULL,
    capacity_kg    integer,
    occupied_kg    integer NOT NULL DEFAULT 0,
    updated_at     timestamptz NOT NULL
);
```

## `src/main/kotlin/audit/AuditEntry.kt`

```kotlin
@Entity
@Table(name = "audit_entries")
class AuditEntry {
    @Id lateinit var id: String
    lateinit var actorId: String
    lateinit var action: String
    lateinit var objectType: String
    lateinit var objectId: String
    lateinit var at: Instant
    lateinit var payload: ByteArray
}
```

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

- **SM-29 (вторая фикстура).** 31 блок в «Публичном контракте» (**включая три служебных**), 7 блоков
  в «Событиях», 6 блоков во «Владеет данными», 5 строк в «Ролях и доступе». Числа точные.
  **Фоновая задача в этой фикстуре названа только прозой** («`AuditEntry` чистится фоновой джобой»),
  имени у неё нет — ключа она не даёт, и «Фоновые задачи» выходят пустой формой. Чтобы проба
  измеряла новую секцию, задаче нужно имя и расписание; пока их нет, здесь меряется только то, что
  скан не выдумал ключ из прозы.
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

- **SM-86 (главная здесь).** У всех **6** сущностей в «Владеет данными» есть строки полей — всего
  **45**. Ни одного поля нет в `domain/Entities.kt`: они лежат в `http/dto/ShipmentDto.kt` (11),
  `http/dto/CarrierDto.kt` (7), `domain/TariffRecord.kt` (7), миграциях `V4__vehicles.sql` (7) и
  `V7__warehouse_slots.sql` (6), `audit/AuditEntry.kt` (7). Записывается доля. Красный исход:
  шесть блоков с назначением и семантикой и без единого поля — форма безупречна, схемы нет.
- **Второй переход, а не полнота.** Ключи здесь доезжают и без него: имена сущностей стоят в
  `Entities.kt` открытым списком. Меряется ровно то, зашёл ли агент за полями в другой файл.
- **Раскладка имён разная намеренно.** В DTO поля в `camelCase`, в миграциях — в `snake_case`
  (`origin_slot_id`, `capacity_kg`). Карточка вправе писать любой вариант; грейдер сверяет имя без
  учёта разделителя, и требовать одну раскладку значит красить зелёный прогон в красное.
