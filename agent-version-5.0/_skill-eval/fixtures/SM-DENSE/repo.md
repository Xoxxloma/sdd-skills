## `build.gradle.kts`

```kotlin
plugins {
    kotlin("jvm") version "1.9.24"
    id("org.springframework.boot") version "3.3.1"
}
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-amqp")
    implementation("org.postgresql:postgresql:42.7.3")
}
```

## `src/main/resources/application.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://db:5432/shipping
    password: ${SHIPPING_DB_PASSWORD}
  rabbitmq:
    host: mq
carrier-registry:
  base-url: ${CARRIER_REGISTRY_URL}
billing-legacy:
  base-url: ${BILLING_LEGACY_URL}
```

## `src/main/kotlin/http/ShipmentController.kt`

```kotlin
@RestController
class ShipmentController(
    private val shipments: ShipmentService,
    private val export: ExportService,
    private val waybills: WaybillService,
) {
    @GetMapping("/api/shipments")
    fun list(@RequestParam filter: ShipmentFilter): ShipmentPageDto = shipments.list(filter)

    @PostMapping("/api/shipments")
    fun create(@RequestBody body: CreateShipmentRequest): ShipmentDto = shipments.create(body)

    @GetMapping("/api/shipments/{id}")
    fun get(@PathVariable id: String): ShipmentDto = shipments.get(id)

    @PatchMapping("/api/shipments/{id}")
    fun patch(@PathVariable id: String, @RequestBody body: PatchShipmentRequest): ShipmentDto =
        shipments.patch(id, body)

    @PostMapping("/api/shipments/{id}/dispatch")
    fun dispatch(@PathVariable id: String): ShipmentDto = shipments.dispatch(id)

    @PostMapping("/api/shipments/{id}/deliver")
    fun deliver(@PathVariable id: String): ShipmentDto = shipments.deliver(id)

    @PostMapping("/api/shipments/{id}/cancel")
    fun cancel(@PathVariable id: String): ShipmentDto = shipments.cancel(id)

    @GetMapping("/api/shipments/{id}/waybill")
    fun waybill(@PathVariable id: String): ByteArray = waybills.render(id)

    @GetMapping("/api/shipments/export")
    fun export(@RequestParam period: PeriodParam): ByteArray = export.csv(period)
}
```

## `src/main/kotlin/http/dto/ShipmentDto.kt`

```kotlin
data class ShipmentDto(
    val id: String,
    val status: ShipmentStatus,
    val carrierId: String,
    val assignedVehicleId: String?,
    val waybillNumber: String,
    val createdAt: Instant,
)

data class ShipmentPageDto(
    val items: List<ShipmentDto>,
    val total: Int,
)

enum class ShipmentStatus { NEW, DISPATCHED, DELIVERED, CANCELLED }
```

## `src/main/kotlin/domain/ShipmentService.kt`

```kotlin
@Service
class ShipmentService(
    private val repo: ShipmentRepository,
    private val publisher: ShipmentEventPublisher,
    private val vehicles: VehicleRepository,
) {
    fun get(id: String): ShipmentDto = repo.findOrThrow(id).toDto()

    fun dispatch(id: String): ShipmentDto {
        val s = repo.findOrThrow(id)
        if (s.status == ShipmentStatus.DISPATCHED) throw AlreadyDispatchedException(id)
        s.status = ShipmentStatus.DISPATCHED
        publisher.dispatched(s)
        return repo.save(s).toDto()
    }

    fun cancel(id: String): ShipmentDto {
        val s = repo.findOrThrow(id)
        if (s.status == ShipmentStatus.DELIVERED) throw AlreadyDeliveredException(id)
        s.status = ShipmentStatus.CANCELLED
        publisher.cancelled(s)
        return repo.save(s).toDto()
    }

    private fun Shipment.toDto() = ShipmentDto(
        id = id,
        status = status,
        carrierId = carrierId,
        assignedVehicleId = vehicles.currentFor(id)?.id,
        waybillNumber = waybillNumber,
        createdAt = createdAt,
    )
}
```

## `src/main/kotlin/domain/VehicleRepository.kt`

```kotlin
@Repository
interface VehicleRepository : JpaRepository<Vehicle, String> {

    // машина, закреплённая за отправлением ПРЯМО СЕЙЧАС.
    // снятая с рейса сюда не попадает — у неё проставлен releasedAt.
    @Query("select v from Vehicle v where v.shipmentId = :sid and v.releasedAt is null")
    fun currentFor(sid: String): Vehicle?
}
```

## `src/main/kotlin/domain/ShipmentRepository.kt`

```kotlin
@Repository
interface ShipmentRepository : JpaRepository<Shipment, String> {

    @Query(
        """
        select count(s) from Shipment s
        where (:carrierId is null or s.carrierId = :carrierId)
          and s.status <> 'CANCELLED'
        """
    )
    fun countForPage(carrierId: String?): Int
}
```

## `src/main/kotlin/domain/model/Shipment.kt`

```kotlin
@Entity
@Table(name = "shipment")
class Shipment(
    @Id val id: String,
    @Enumerated(EnumType.STRING) var status: ShipmentStatus,
    val carrierId: String,
    val waybillNumber: String,
    val dispatchDate: LocalDate,
    @CreationTimestamp val createdAt: Instant,
)

@Entity
@Table(name = "settlement_record")
class SettlementRecord(
    @Id val id: String,
    @ManyToOne @JoinColumn(name = "shipment_id") val shipment: Shipment,
    val closedAt: Instant,
)
```

## `src/main/kotlin/domain/model/Vehicle.kt`

```kotlin
@Entity
@Table(name = "vehicle")
class Vehicle(
    @Id val id: String,
    val carrierId: String,
    var shipmentId: String?,
    var releasedAt: Instant?,
)
```

## `src/main/kotlin/domain/model/WarehouseSlot.kt`

```kotlin
@Entity
@Table(name = "warehouse_slot")
class WarehouseSlot(
    @Id val id: String,
    val warehouseId: String,
    val windowStart: Instant,
    val capacityKg: Int?,
)
```

## `src/main/kotlin/domain/model/AuditEntry.kt`

```kotlin
@Entity
@Table(name = "audit_entry")
class AuditEntry(
    @Id val id: String,
    val actor: String,
    val action: String,
    @CreationTimestamp val at: Instant,
)
```

## `src/main/kotlin/jobs/AuditRetentionJob.kt`

```kotlin
@Component
class AuditRetentionJob(private val repo: AuditEntryRepository) {

    private val retention = Duration.ofDays(180)

    @Scheduled(cron = "0 0 3 * * *")
    fun purge() = repo.deleteOlderThan(Instant.now().minus(retention))
}
```

## `src/main/kotlin/http/GlobalExceptionHandler.kt`

```kotlin
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(AlreadyDeliveredException::class)
    fun onDelivered(e: AlreadyDeliveredException) =
        ResponseEntity.status(422).body(ErrorBody("shipment_already_delivered", e.message))

    @ExceptionHandler(AlreadyDispatchedException::class)
    fun onDispatched(e: AlreadyDispatchedException) =
        ResponseEntity.status(409).body(ErrorBody("shipment_already_dispatched", e.message))

    @ExceptionHandler(DuplicateInnException::class)
    fun onDuplicateInn(e: DuplicateInnException) =
        ResponseEntity.status(409).body(ErrorBody("carrier_inn_taken", e.message))

    @ExceptionHandler(PeriodTooLongException::class)
    fun onPeriod(e: PeriodTooLongException) =
        ResponseEntity.status(400).body(ErrorBody("period_too_long", e.message))
}
```

## `src/main/kotlin/domain/ExportService.kt`

```kotlin
@Service
class ExportService(private val repo: ShipmentRepository) {

    fun csv(period: PeriodParam): ByteArray {
        val days = ChronoUnit.DAYS.between(period.from, period.to)
        if (days > MAX_PERIOD_DAYS) throw PeriodTooLongException(days)
        return render(repo.inPeriod(period))
    }

    companion object {
        const val MAX_PERIOD_DAYS = 62L
    }
}
```

## `src/main/kotlin/domain/WaybillService.kt`

```kotlin
@Service
class WaybillService(private val repo: ShipmentRepository, private val pdf: PdfRenderer) {

    // ТТН — товарно-транспортная накладная.
    fun render(id: String): ByteArray {
        val s = repo.findOrThrow(id)
        return pdf.build(s.waybillNumber, s)
    }
}
```

## `src/main/kotlin/domain/WaybillNumberAllocator.kt`

```kotlin
@Component
class WaybillNumberAllocator(private val seq: SequenceRepository) {

    // вызывается ровно один раз — из ShipmentService.create, при заведении отправления.
    // повторной выдачи нет: номер лежит в колонке waybill_number и дальше только читается.
    fun allocate(): String = "TTN-" + seq.next("waybill")
}
```

## `src/main/kotlin/http/CarrierController.kt`

```kotlin
@RestController
class CarrierController(private val carriers: CarrierService) {

    @GetMapping("/api/carriers")
    fun list(): List<CarrierDto> = carriers.all()

    @PostMapping("/api/carriers")
    fun create(@RequestBody body: CreateCarrierRequest): CarrierDto = carriers.create(body)

    @GetMapping("/api/carriers/{id}")
    fun get(@PathVariable id: String): CarrierDto = carriers.get(id)

    @PatchMapping("/api/carriers/{id}")
    fun patch(@PathVariable id: String, @RequestBody body: PatchCarrierRequest): CarrierDto =
        carriers.patch(id, body)
}
```

## `src/main/kotlin/http/dto/CarrierDto.kt`

```kotlin
data class CarrierDto(
    val id: String,
    val name: String,
    val inn: String,
    val blocked: Boolean,
)
```

## `src/main/kotlin/domain/CarrierService.kt`

```kotlin
@Service
class CarrierService(private val repo: CarrierRepository, private val registry: CarrierRegistryClient) {

    fun all(): List<CarrierDto> = repo.findAll().map { it.toDto() }

    fun create(body: CreateCarrierRequest): CarrierDto {
        registry.checkLicence(body.inn)
        return try {
            repo.save(Carrier(body)).toDto()
        } catch (e: DataIntegrityViolationException) {
            throw DuplicateInnException(body.inn)
        }
    }
}
```

## `src/main/kotlin/http/TariffController.kt`

```kotlin
@RestController
class TariffController(private val tariffs: TariffService, private val calc: TariffCalculator) {

    @GetMapping("/api/tariffs")
    fun list(): List<TariffDto> = tariffs.all()

    @PostMapping("/api/tariffs")
    fun create(@RequestBody body: TariffBody): TariffDto = tariffs.create(body)

    @GetMapping("/api/tariffs/{id}")
    fun get(@PathVariable id: String): TariffDto = tariffs.get(id)

    @PutMapping("/api/tariffs/{id}")
    fun replace(@PathVariable id: String, @RequestBody body: TariffBody): TariffDto =
        tariffs.replace(id, body)

    @PostMapping("/api/tariffs/calculate")
    fun calculate(@RequestBody body: CalcRequest): CalcResultDto = calc.calculate(body)
}
```

## `src/main/kotlin/domain/TariffService.kt`

```kotlin
@Service
class TariffService(private val repo: TariffRepository, private val publisher: TariffEventPublisher) {

    fun replace(id: String, body: TariffBody): TariffDto {
        val existing = repo.findOrThrow(id)
        // все поля перезаписываются значениями из тела; отсутствующее в теле поле
        // получает значение по умолчанию, а не сохраняет прежнее
        val replaced = Tariff(id = existing.id, body = body)
        publisher.changed(replaced)
        return repo.save(replaced).toDto()
    }
}
```

## `src/main/kotlin/domain/TariffCalculator.kt`

```kotlin
@Service
class TariffCalculator(private val repo: TariffRepository, private val shipments: ShipmentRepository) {

    fun calculate(body: CalcRequest): CalcResultDto {
        val shipment = shipments.findOrThrow(body.shipmentId)
        val tariff = repo.effectiveOn(shipment.dispatchDate)
        return CalcResultDto(tariff.id, tariff.apply(body.weightKg))
    }
}
```

## `src/main/kotlin/http/WarehouseController.kt`

```kotlin
@RestController
class WarehouseController(private val warehouses: WarehouseService) {

    @GetMapping("/api/warehouses")
    fun list(): List<WarehouseDto> = warehouses.all()

    @GetMapping("/api/warehouses/{id}")
    fun get(@PathVariable id: String): WarehouseDto = warehouses.get(id)

    @GetMapping("/api/warehouses/{id}/slots")
    fun slots(@PathVariable id: String): List<SlotDto> = warehouses.slots(id)

    @PostMapping("/api/warehouses/{id}/slots")
    fun reserve(@PathVariable id: String, @RequestBody body: SlotBody): SlotDto =
        warehouses.reserve(id, body)
}
```

## `src/main/resources/db/migration/V7__slots_and_carriers.sql`

```sql
alter table warehouse_slot
    add constraint uq_slot_window unique (warehouse_id, window_start);

alter table carrier
    add constraint uq_carrier_inn unique (inn);

comment on column warehouse_slot.capacity_kg is
    'null для складов временного хранения (СВХ): лимит не задаётся';
```

## `src/main/kotlin/domain/WarehouseService.kt`

```kotlin
@Service
class WarehouseService(private val slots: WarehouseSlotRepository) {

    fun reserve(warehouseId: String, body: SlotBody): SlotDto =
        slots.findByWarehouseIdAndWindowStart(warehouseId, body.windowStart)?.toDto()
            ?: slots.save(WarehouseSlot(warehouseId, body)).toDto()
}
```

## `src/main/kotlin/events/ShipmentEventPublisher.kt`

```kotlin
@Component
class ShipmentEventPublisher(private val amqp: RabbitTemplate) {

    fun created(s: Shipment) = amqp.convertAndSend("shipment.created", s.id)
    fun dispatched(s: Shipment) = amqp.convertAndSend("shipment.dispatched", s.id)
    fun delivered(s: Shipment) = amqp.convertAndSend("shipment.delivered", s.id)
    fun cancelled(s: Shipment) = amqp.convertAndSend("shipment.cancelled", s.id)
}
```

## `src/main/kotlin/events/CarrierBlockedListener.kt`

```kotlin
@Component
class CarrierBlockedListener(private val repo: CarrierRepository) {

    @RabbitListener(queues = ["carrier.blocked"])
    fun onBlocked(carrierId: String) {
        // перевозчик помечается флагом и продолжает отдаваться в списке —
        // из выдачи /api/carriers он не пропадает
        repo.markBlocked(carrierId)
    }
}
```

## `src/main/kotlin/security/Roles.kt`

```kotlin
enum class Role { ADMIN, CARRIER_MANAGER, DISPATCHER, TARIFF_EDITOR, WAREHOUSE_OPERATOR }
```

## `src/main/kotlin/http/AdminController.kt`

```kotlin
@RestController
@PreAuthorize("hasRole('ADMIN')")
class AdminController(private val admin: AdminService) {

    @GetMapping("/api/admin/users")
    fun users(): List<UserDto> = admin.users()

    @PostMapping("/api/admin/users/{id}/block")
    fun block(@PathVariable id: String): UserDto = admin.block(id)
}
```

## `src/main/kotlin/http/ServiceController.kt`

```kotlin
@RestController
class ServiceController {
    @GetMapping("/actuator/health") fun health() = mapOf("status" to "UP")
    @GetMapping("/actuator/metrics") fun metrics() = registry.scrape()
    @GetMapping("/api/version") fun version() = mapOf("build" to buildProperties.version)
}
```

## `src/main/kotlin/clients/BillingLegacyClient.kt`

```kotlin
@Component
class BillingLegacyClient(@Value("\${billing-legacy.base-url}") private val baseUrl: String) {

    fun recalculate(shipmentId: String) = http.post("$baseUrl/legacy/recalc/$shipmentId")
}
```
