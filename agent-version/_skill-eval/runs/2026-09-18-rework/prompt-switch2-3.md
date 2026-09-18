Ты — сканирующий субагент. Тебя запустил ведущий агент скилла `service-map` и передал всё, что
ниже. По диску ты ходишь только за формой карточки (путь ниже); других файлов не читаешь,
субагентов не запускаешь.

**Сервис:** `/work/navigator-api`, тип `backend`.
**Имена всех сервисов из манифеста:** navigator, consolidate, dispatch-web
**Прежней карточки нет.**

## Форма карточки

Прочитай целиком файл `/Users/macbook/Documents/Projects/sdd-skills/agent-version/service-map/reference/card.template.md` — там форма карточки, ветвление секций по типу, ключи и правила
содержания. Ответ начни строкой `шаблон прочитан, тип: backend`.

## Три правила, которые важнее процедуры

**1. Не выводится из кода — пиши `не определено`.** Догадка, записанная как факт, через неделю
вернётся аналитику в виде «в `services/auth.md` описано, что…» и будет неотличима от правды.

**2. Ты только читаешь чужие репозитории.** Ни одного изменения в папке сервиса.

**3. Секреты не копируются.** Имя переменной и файл — да, значение — никогда.

## Порядок работы

**Сначала опись, потом карточка. Это не совет, а обязательный порядок для субагента.**

**И это две разные части ответа, под своими заголовками: `## ОПИСЬ`, затем `## КАРТОЧКА`.** У них
разная форма строки, и смешивать их нельзя: строка описи кончается на файл-источник
(`· факт — путь/Файл.kt`), строка карточки кончается на самом факте — хвоста `— файл` у неё нет
ни в одной секции. Опись существует ради сверки и в файл не попадает; карточка попадает в файл
как есть. Одна строка карточки с хвостом-файлом — это строка описи, попавшая не в ту часть.

Пусть он сперва выпишет **полный плоский список ключей** и посчитает их: все роуты, все эндпоинты,
все операции, все топики (в обе стороны — потребляемые и публикуемые считаются отдельно), все
фоновые задачи, все сущности, все роли, все экраны. И только потом разворачивает карточку по этому
списку, проходя его подряд.

**Ключ — это операция, а не маршрут, и там, где маршрут один, в этом вся разница между полной
описью и пустой.** У GraphQL весь сервис висит на одном `POST /graphql`, у gRPC — на одном пути
сервиса: роут один, а ключей столько, сколько объявлено `query`, `mutation`, `subscription`, `rpc`.
Сам `POST /graphql` в опись ключом не идёт — это транспорт. Опись на один ключ — не «маленький
сервис», а несобранная опись, и с карточкой на один блок она сходится идеально.

**Классы ключей перечислены полностью, и неэндпоинтные из них теряются первыми.** Ключ, не
объявленный аннотацией роута, приходится искать в конфиге планировщика и в папках слушателей, а
модель туда не идёт, пока список классов не назван явно. Тот же список стоит в таблице ключей
шаблона — оба файла обязаны считать одно и то же.

**Опись двухуровневая, и у каждой строки обоих уровней стоит файл, из которого она взята:**

```
GET /api/shipments — http/ShipmentController.kt
  сущности: → Shipment, проекция ShipmentDto без internalNotes — http/dto/ShipmentDto.kt
  · total не считает отменённые — domain/ShipmentRepository.kt (status <> 'CANCELLED')
  · items: ShipmentDto — http/dto/ShipmentDto.kt
POST /api/carriers — http/CarrierController.kt
  сущности: ← CreateCarrierRequest · → Carrier целиком — domain/Carrier.kt
  · повтор ИНН даёт 409 — http/GlobalExceptionHandler.kt + миграция V7 (uq_carrier_inn)
/actuator/health — http/ServiceController.kt
  (фактов нет — служебный)
GET /api/tariffs — http/TariffController.kt
  (фактов нет)
потребляет partner.disabled — messaging/PartnerDisabledListener.kt
  · группа crm-partner, offset коммитится после записи — resources/application.yaml
  · повтор безопасен: снятие с маршрута идемпотентно по partnerId — messaging/PartnerHandler.kt
публикует route.assigned — messaging/RouteProducer.kt
  · тело: routeId, partnerId, assignedAt — messaging/dto/RouteAssignedEvent.kt
  · шлётся после коммита транзакции, при ретрае возможен дубль — messaging/RouteProducer.kt
rotateAccessKeys — jobs/RotateKeysJob.kt
  · 0 3 * * * — resources/application.yaml (jobs.rotate.cron)
  · помечает ключи старше 90 дней истёкшими, самих записей не удаляет — jobs/RotateKeysJob.kt
состояние: Shipment.status NEW | ASSIGNED | DELIVERED | CANCELLED — domain/Shipment.kt
состояние: Carrier.disabledAt (дата отключения) — domain/Carrier.kt
справочник: Carrier.vehicleType TRUCK | VAN — domain/Carrier.kt
сообщение: «маршрут назначен» — партнёру, событие route.assigned — messaging/RouteProducer.kt
сообщение: «груз не доставлен» — письмо диспетчеру — notify/DeliveryFailedMailer.kt
⟹ эндпоинтов 27, из них с фактами 18
⟹ топиков 6, из них с фактами 5
⟹ фоновых задач 3, из них с фактами 3
⟹ состояний 2 (значений 5), справочников 1, сообщений 2, ограничений 0
```

**Четыре строки описи, из которых собираются «Бизнес-правила» (только `backend` и `fullstack`).**
Форма блоков — в шаблоне; здесь только что собирать.

- `состояние:` — поле-перечисление или пара дат «принято / удалено» у **своей** сущности из
  «Владеет данными», с перечнем значений и файлом. Булево поле — не перечисление. Чужая сущность
  («на чтение», view, «схема <имя>») строки не получает и в «Владеет данными» не стоит.
- `справочник:` — перечисление той же формы, от значений которого не зависит ни одно правило
  (тип вложения, тип упаковки). Блока в секции не даёт.
- `сообщение:` — вид исходящего человеку или соседу, с получателем и файлом отправки. Вид —
  каждое имя в коде: шаблон письма, метод `sendXxx`, значение перечисления, публикуемый топик;
  семь имён — семь строк. Ответ на запрос, включая ошибку, сообщением не является.
- `ограничение:` — условие, при котором сервис отказывает или меняет поведение целиком, и его
  хозяин: сосед из манифеста, внешняя система по имени или роль этого сервиса через настройку.
  Валидация входа, свой конфиг без роли, блокировка записи, доступность инфраструктуры —
  не ограничение.

Итог — строкой `⟹ состояний N (значений K), справочников S, сообщений M, ограничений L`.

**В строке блока из кода — только токен.** Путь, HTTP-глагол, код ошибки и HTTP-статус (их место —
«Публичный контракт»), поле со значением (`byEmail=true` — это «подписчики с включённым e-mail»,
`closedBy = "system"` — «закрыто системой»), тело события, ключ конфига — словами или никак.
Заголовок сообщения — словами, у топика тоже: «назначение закрыто» — соседям, а
`navigator.assignment.closed` — в конце строки. Значение, у которого перехода в коде нет, —
строка `не определено`, а не придуманное правило: одна и та же фраза на нескольких значениях
хуже пустой.

**У каждого ключа контракта в описи стоит строка `сущности:` — чем ручка оперирует.** Слева от `→`
вход, справа выход, имена — из списка сущностей этого же сервиса; ответ, не совпадающий ни с одной,
так и пишется: `→ не сущность, агрегат по X и Y`. Проекция называется проекцией, с перечнем того,
чего в ней нет. У служебных ключей строки нет.

**В счёт «ключей с фактами» она не идёт** — как и назначение. Иначе ею заменят факты: писать её
дёшево, и она всегда верна.

Зачем: без неё карточка говорит, что ручка делает, и молчит о том, ЧЕМ. «Список сотрудников»
читается как `Employee`, которой в схеме нет, — на деле это `User` с фильтром по роли, и автор
следующей спеки заведёт вторую таблицу. Поля при этом не дублируются: они лежат в «Владеет
данными» один раз, а в блоке стоит только отличие ответа от сущности.

**Два числа обязательны — сколько ключей всего и у скольких из них есть хотя бы один факт.**
Первое ловит недобор ключей, второе — недобор содержания; без второго карточка на 27 пустых блоков
проходит все проверки.

**И считаются они по каждому классу ключей отдельно, а не одной суммой.** Общий итог маскирует
класс, доехавший нулём: 27 эндпоинтов с фактами и 6 пустых топиков дают «33, из них с фактами 27»
— число выглядит здоровым, а вся асинхронная половина сервиса не описана. Класс, которого в сервисе
нет, строкой `⟹ … 0` не пишется вовсе.

**Считается именно «ключей с фактами», а не «фактов».** Ключи объективны — либо под ключом стоит
хоть одна строка `·`, либо нет. Считая факты, выгодно дробить один факт на три строки; считая
ключи — невыгодно.

**Строку `(фактов нет)` пиши, а не пропускай ключ.** Пусто бывает законно — служебные эндпоинты,
тривиальные геттеры. Но именно из этих строк собирается список, который ты назовёшь человеку в
отчёте (Шаг 6): он один решает, какая секция ему нужна плотнее.

**Файл-источник — это не оформление, а сам механизм, и он работает в обе стороны.**

- **Против пустоты.** Факт, которого не видно в файле эндпоинта, лежит в другом: поля ответа — в
  DTO, код ошибки — в обработчике исключений, триггер события — в продюсере, ограничение и
  уникальность — в миграции, срок хранения — в джобе. Назвать файл, не открыв его, нельзя.
- **Против выдумки.** Ключ без файла-источника — выдуманный ключ, и сверка описи с карточкой его
  не ловит: он попадает в оба списка, и числа сходятся идеально.

**Не знаешь файла — не пиши строку.**

**В опись идут все ключи без единого исключения — служебные тоже.** Проверки живости и готовности,
метрики, версия сборки, фичефлаги — как бы они ни назывались в этом сервисе. Написать про них нечего
сверх заголовка, и это не повод не записать ключ: **ноль фактов — не ноль ключей**. Ниже названо
единственное место, где служебная группа что-то теряет, и теряет она там **строку возможности, а не
ключ описи**. Вычтя их и из описи, ты не заметишь промаха: опись на три ключа короче сходится с
контрактом на три блока короче.

**«Что умеет для пользователя» собирается по той же описи, а не по памяти.** Ключи этой секции не
лежат в коде готовыми, и потому она недобирается сильнее всех: её пишут первой, «в общих чертах».

Порядок обратный и механический:

1. **Разбей опись на группы по общему префиксу** — `/v1/incidents/*`, `/v1/squads/*`,
   `/v1/chops/*`, `/v1/reports/*`, `/v1/admin/*`; у фронта группа — раздел роутов. Префикс берётся
   из кода, придумывать группировку не надо. У GraphQL и gRPC общего префикса пути нет вовсе, и
   группа берётся по сущности в имени операции (`incident*`, `squad*`) или по типу схемы;
   сгруппировав их по пути, ты получишь одну группу на весь сервис и одну строку возможностей
   вместо двенадцати.

   **Группировка — это способ выбрать строки возможностей, а не структура карточки.** «Публичный
   контракт» остаётся плоским списком блоков `###`, без заголовков-разделов: сгруппировав его, ты
   уводишь ключ на уровень глубже, и он перестаёт совпадать.
2. **Каждая группа даёт минимум одну строку** — кроме той, которой пользуется не человек, а
   инфраструктура: проверки живости, метрики, версия сборки. Больше исключений нет, и `/v1/admin/*`
   к ним не относится: это возможности администратора, а не техника, и теряют их чаще всего.

   **Речь только о строке в этой секции.** В «Публичном контракте» эти эндпоинты стоят наравне со
   всеми, и опись обязана сойтись с ним до последнего ключа.
3. **Формулируй словами пользователя, а не кода:** «выгрузить отчёт по инцидентам за период», а не
   `GET /v1/incidents/export`. Соседние ключи про одно и то же сворачиваются в одну строку.
4. **Ограничение, которое пользователь видит сам, — своя строка, правило прямо в колонке
   «Возможность»:** «отозвать сессию — только свою», «продлить можно только неистёкшую сессию».
   Ограничение, оставшееся только в блоке контракта, до `business-requirements-doc` не доходит: он
   этот блок не открывает. Строка целиком — слова пользователя, в обеих колонках.

**Неэндпоинтные ключи тоже дают возможности, и группируются они не по префиксу.** Каждая фоновая
задача и каждый потребляемый топик — своя группа: это поведение, которое пользователь видит, ничего
не нажимая. Правило то же — строка есть, когда результат виден человеку («просроченные заявки
закрываются автоматически»), и строки нет, когда его видит только инфраструктура (переиндексация
кэша, прогрев). **Публикация события возможностью не бывает** — это интерфейс для соседа.

Непокрытая группа означает, что `business-requirements-doc` будет спрашивать аналитика про
возможность, которая в сервисе давно есть. С задачами это дороже: про ночной пересчёт аналитик не
спросит и сам.

Почему именно так. Когда карточка пишется сразу, выбор «а это достаточно важно?» принимается на
**каждом** элементе, и на сорок восьмом эндпоинте модель давно решила, что суть передана. Списку
выбирать нечего: он составляется до того, как появляется соблазн сокращать.

**Объём не нормируется.** Сорок восемь эндпоинтов дают сорок восемь блоков, и длинная карточка —
правильный результат, а не повод сжать. Обобщение вместо перечисления («CRUD по инцидентам,
экипажам и ЧОП») — худший исход шага: оно проходит по форме, выглядит опрятно и уничтожает ровно
то, ради чего карточку читают.

**Бюджет: на один сервис — не больше двух прогонов субагента за прогон скилла.** Первый и, если
понадобился, ещё один. Второй — единственный, и он один **на все причины**: пустой ответ, отказ,
ответ без описи, разошедшиеся на Шаге 4 числа, пустое тело больше чем у половины блоков. Какая бы
ни сработала первой, вторая попытка после неё израсходована. Исключение одно — второй добор по
строкам с кодом в «Бизнес-правилах», число 4 гейта на Шаге 4.

**Пустой ответ, отказ или ответ без описи — перезапусти этого субагента один раз**, тем же промптом,
без изменений. Пустые ответы случаются регулярно и без причины в самом сервисе. Изменённый промпт
тут не нужен: возвращать нечего, а изменив его, ты превратишь случайный сбой в другой прогон.

**Числа на Шаге 4 не сошлись — это не перезапуск, а добор:** тот же промпт **плюс список ключей**,
которые субагент не развернул. Без списка он ответит тем же: он уже один раз решил, что суть передана.

**Вторая попытка не помогла — прекрати.** Третьей не делай ни по какой причине. Оставь прежнюю
карточку, если она была, **байт-в-байт**, и назови сервис в отчёте с числами: «опись 48, доехало 42,
не развёрнуты …». Карточки не было — её и не будет в этом прогоне, следующий подберёт сервис сам
(Шаг 2.2).

**«Байт-в-байт» включает `scanned`.** Не подтягивай дату к сегодняшней: `scanned` означает «сервис
прочитан в этот день», а прочтения не состоялось. Человек читает таблицу дат в отчёте и решает по
ней, что перечитывать, — сервис с сегодняшним числом он не тронет ещё месяц. В отчёте он идёт
**с прежней датой** и отдельной строкой про неудачу.

И ни в каком случае **не выдумывай карточку за него**. Молча пропущенный сервис выглядит как
проанализированный, и это худший исход из возможных.


## Две секции, которые ты не заполняешь

- «Заметки команды» не выводи вообще — их вставляет ведущий агент из манифеста.
- «Кто меня потребляет» выведи ПУСТОЙ ФОРМОЙ: заголовок и строку `| — | | |`.

## Что вернуть

Ответ из двух частей под заголовками `## ОПИСЬ` и `## КАРТОЧКА`, и ничего больше, начав строкой
`шаблон прочитан, тип: backend`. В файл у ведущего идёт только часть `## КАРТОЧКА`; опись — для
сверки. Файлов сервиса ты не пишешь.

---

# СОДЕРЖИМОЕ РЕПОЗИТОРИЯ `/work/navigator-api`

## `build.gradle`

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.3.2'
}
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-mail'
    implementation 'org.springframework.boot:spring-boot-starter-thymeleaf'
    implementation 'org.springframework.kafka:spring-kafka'
    runtimeOnly 'org.postgresql:postgresql:42.7.3'
}
```

## `src/main/java/ru/summary/navigator/http/NavigatorController.java`

```java
@RestController
@RequestMapping("/api/v1/navigator")
public class NavigatorController {
    private final SwitchGuard switchGuard;
    private final ConsolidateClient consolidate;
    private final AssignmentService assignments;

    /** Лента инцидентов для диспетчера. Фильтры: status, districtId, period. */
    @GetMapping("/incidents")
    @PreAuthorize("hasAnyRole('DISPATCHER','ADMIN')")
    public Page<IncidentDto> incidents(IncidentFilter f, Pageable p) {
        switchGuard.checkApiIsAvailable();
        return consolidate.incidents(f, p);
    }

    @GetMapping("/incidents/{id}")
    @PreAuthorize("hasAnyRole('DISPATCHER','PATROL','ADMIN')")
    public IncidentDto incident(@PathVariable long id) {
        switchGuard.checkApiIsAvailable();
        return consolidate.incident(id);                 // 404 — инцидента нет в consolidate
    }

    /** Назначить наряд на инцидент. 409 — у инцидента уже есть незакрытое назначение. */
    @PostMapping("/incidents/{id}/assign")
    @PreAuthorize("hasRole('DISPATCHER')")
    public AssignmentDto assign(@PathVariable long id, @RequestBody AssignRequest r) {
        switchGuard.checkApiIsAvailable();
        return assignments.assign(id, r.patrolId(), r.priority(), currentUser());
    }

    /** Наряд подтверждает, что принял назначение. 409 — назначение не в статусе NEW. */
    @PostMapping("/assignments/{id}/accept")
    @PreAuthorize("hasRole('PATROL')")
    public AssignmentDto accept(@PathVariable long id) {
        switchGuard.checkApiIsAvailable();
        return assignments.accept(id, currentUser());
    }

    /** Закрыть назначение вручную. 409 — назначение ещё не принято нарядом. */
    @PostMapping("/assignments/{id}/close")
    @PreAuthorize("hasAnyRole('DISPATCHER','ADMIN')")
    public AssignmentDto close(@PathVariable long id, @RequestBody CloseRequest r) {
        switchGuard.checkApiIsAvailable();
        return assignments.close(id, r.reason(), currentUser());
    }

    @GetMapping("/assignments")                          // фильтры: status, patrolId
    @PreAuthorize("hasAnyRole('DISPATCHER','ADMIN')")
    public List<AssignmentDto> assignments(AssignmentFilter f) {
        switchGuard.checkApiIsAvailable();
        return assignments.list(f);
    }
}
```

## `src/main/java/ru/summary/navigator/http/SubscriptionController.java`

```java
@RestController
@RequestMapping("/api/v1/navigator/subscriptions")
public class SubscriptionController {
    private final SwitchGuard switchGuard;
    private final SubscriptionRepository subscriptions;

    /** Свои подписки. Админ видит все, если передан employeeId. */
    @GetMapping
    @PreAuthorize("hasAnyRole('DISPATCHER','PATROL','ADMIN')")
    public List<SubscriptionDto> list(@RequestParam Optional<String> employeeId) { switchGuard.checkApiIsAvailable(); /* … */ }

    /** Подписаться на категорию: e-mail и/или SMS. 422 — не выбран ни один канал. */
    @PostMapping
    @PreAuthorize("hasAnyRole('DISPATCHER','PATROL','ADMIN')")
    public SubscriptionDto create(@RequestBody SubscriptionRequest r) { switchGuard.checkApiIsAvailable(); /* … */ }

    /** Отписаться. Чужую подписку может снять только админ. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('DISPATCHER','PATROL','ADMIN')")
    public void delete(@PathVariable long id) { switchGuard.checkApiIsAvailable(); /* … */ }
}
```

## `src/main/java/ru/summary/navigator/http/dto/AssignmentDto.java`

```java
public record AssignmentDto(
        long id,
        long incidentId,                 // инцидент в consolidate
        String patrolId,                 // табельный номер старшего наряда
        AssignmentStatus status,
        Priority priority,
        Instant createdAt,
        Instant acceptedAt,              // null, пока наряд не подтвердил
        Instant closedAt,                // null у незакрытых
        String closedBy,                 // табельный номер закрывшего; "system" — закрыто по событию consolidate
        String closeReason               // null, если закрыто автоматически
) {}

public record AssignRequest(String patrolId, Priority priority) {}
public record CloseRequest(String reason) {}
```

## `src/main/java/ru/summary/navigator/http/dto/SubscriptionDto.java`

```java
public record SubscriptionDto(
        long id,
        String employeeId,
        String category,                 // категория инцидентов из справочника consolidate, свободная строка
        boolean byEmail,
        boolean bySms,
        Instant createdAt
) {}

public record SubscriptionRequest(String category, boolean byEmail, boolean bySms) {}
```

## `src/main/java/ru/summary/navigator/integration/SwitchGuard.java`

```java
/**
 * Рубильник интеграции. Флаг ведёт consolidate на своей админке; навигатор его только читает.
 * Кэш на switch.cache-ttl, чтобы не дёргать consolidate на каждый запрос.
 */
@Component
public class SwitchGuard {
    private final ConsolidateClient consolidate;

    public void checkApiIsAvailable() {
        SwitchStatus s = consolidate.navigatorSwitch();   // GET /admin/navigator у consolidate
        if (s.status()) {                                 // true — интеграция ОТКЛЮЧЕНА
            throw new NavigatorIntegrationException(
                    "Интеграция с АС Навигатор отключена", ErrorCode.SYSTEM_ERROR);
        }
    }
}

/** Ответ consolidate. status=true означает «отключено» — так исторически сложилось на их стороне. */
public record SwitchStatus(boolean status, Instant changedAt) {}
```

## `src/main/java/ru/summary/navigator/integration/ConsolidateClient.java`

```java
@Component
public class ConsolidateClient {
    @Value("${consolidate.url}") String baseUrl;

    public Page<IncidentDto> incidents(IncidentFilter f, Pageable p) { /* GET {baseUrl}/api/v1/incidents */ }
    public IncidentDto incident(long id)                             { /* GET {baseUrl}/api/v1/incidents/{id} */ }
    @Cacheable(value = "navigatorSwitch")
    public SwitchStatus navigatorSwitch()                            { /* GET {baseUrl}/admin/navigator */ }
}
```

## `src/main/java/ru/summary/navigator/integration/DepartmentView.java`

```java
package ru.summary.navigator.integration;

/** Подразделения ведёт consolidate. Навигатор читает их из его схемы, только на чтение: для подписи в письме. */
@Entity
@Immutable
@Table(schema = "consolidate", name = "v_department")
public class DepartmentView {
    @Id
    private Long id;
    private String title;
    @Enumerated(EnumType.STRING)
    private DepartmentKind kind; // BRANCH | HQ
}

enum DepartmentKind { BRANCH, HQ }
```

## `src/main/java/ru/summary/navigator/service/AssignmentLimits.java`

```java
package ru.summary.navigator.service;

/** Свой лимит из конфигурации и проверка длины комментария. Ни ролью, ни соседом не управляется. */
@Component
public class AssignmentLimits {
    @Value("${navigator.assignments.max-open-per-patrol:5}")
    private int maxOpenPerPatrol;

    public void check(int openNowForPatrol, String closeReason) {
        if (closeReason != null && closeReason.length() > 500) {
            throw new ValidationException("REASON_TOO_LONG", "Причина закрытия длиннее 500 символов");
        }
        if (openNowForPatrol >= maxOpenPerPatrol) {
            throw new ValidationException("PATROL_LIMIT", "У наряда уже " + maxOpenPerPatrol + " открытых назначений");
        }
    }
}
```

## `src/main/java/ru/summary/navigator/domain/Assignment.java`

```java
@Entity @Table(name = "assignment")
public class Assignment {
    @Id @GeneratedValue Long id;
    long incidentId;
    String patrolId;
    @Enumerated(EnumType.STRING) AssignmentStatus status;
    @Enumerated(EnumType.STRING) Priority priority;
    Instant createdAt;
    Instant acceptedAt;
    Instant closedAt;
    String closedBy;
    String closeReason;
}

/** Жизненный цикл назначения. */
public enum AssignmentStatus {
    NEW,        // создано диспетчером, наряд ещё не подтвердил
    ACCEPTED,   // наряд подтвердил; с этого момента можно закрывать
    CLOSED      // закрыто диспетчером/админом с причиной либо системой по закрытию инцидента
}

/** Приоритет проставляется при назначении и дальше не меняется; на правила не влияет — только сортировка в ленте. */
public enum Priority { LOW, NORMAL, HIGH }
```

## `src/main/java/ru/summary/navigator/domain/Subscription.java`

```java
@Entity @Table(name = "subscription")
public class Subscription {
    @Id @GeneratedValue Long id;
    String employeeId;
    String category;
    boolean byEmail;
    boolean bySms;
    Instant createdAt;
}
```

## `src/main/java/ru/summary/navigator/service/AssignmentService.java`

```java
@Service
public class AssignmentService {
    private final AssignmentRepository repo;
    private final SubscriberMailer mailer;
    private final SmsSender sms;
    private final AssignmentProducer producer;

    /** Диспетчер назначает наряд. У инцидента может быть только одно незакрытое назначение. */
    public AssignmentDto assign(long incidentId, String patrolId, Priority priority, User by) {
        if (repo.existsByIncidentIdAndStatusNot(incidentId, AssignmentStatus.CLOSED))
            throw new ConflictException("У инцидента уже есть незакрытое назначение");
        Assignment a = new Assignment(incidentId, patrolId, priority, AssignmentStatus.NEW, now());
        repo.save(a);
        mailer.sendAssignmentCreated(a);          // подписчикам категории инцидента
        sms.sendAssignedSms(a);                    // старшему наряда
        return toDto(a);
    }

    /** Наряд подтверждает назначение. Только из NEW и только свой наряд. */
    public AssignmentDto accept(long id, User by) {
        Assignment a = repo.get(id);
        if (a.status != AssignmentStatus.NEW) throw new ConflictException("Назначение уже принято или закрыто");
        if (!a.patrolId.equals(by.employeeId())) throw new ForbiddenException("Подтвердить может только старший назначенного наряда");
        a.status = AssignmentStatus.ACCEPTED; a.acceptedAt = now();
        return toDto(a);
    }

    /** Закрыть вручную: только принятое, с причиной. Закрытое обратно не открывается. */
    public AssignmentDto close(long id, String reason, User by) {
        Assignment a = repo.get(id);
        if (a.status != AssignmentStatus.ACCEPTED) throw new ConflictException("Закрыть можно только принятое назначение");
        a.status = AssignmentStatus.CLOSED; a.closedAt = now(); a.closedBy = by.employeeId(); a.closeReason = reason;
        producer.assignmentClosed(a);
        mailer.sendAssignmentClosed(a);
        return toDto(a);
    }

    /** По событию consolidate «инцидент закрыт» — закрыть все его назначения, в любом статусе, без причины. */
    public void closeByIncident(long incidentId) {
        for (Assignment a : repo.findByIncidentIdAndStatusNot(incidentId, AssignmentStatus.CLOSED)) {
            a.status = AssignmentStatus.CLOSED; a.closedAt = now(); a.closedBy = "system"; a.closeReason = null;
            producer.assignmentClosed(a);
        }
    }
}
```

## `src/main/java/ru/summary/navigator/notify/SubscriberMailer.java`

```java
/**
 * Письма подписчикам. Шаблоны Thymeleaf в templates/mail/*.html.
 * Получатели — подписки категории инцидента с byEmail=true. Нет ни одной — письмо не отправляется.
 * Старший наряда письма не получает: ему уходит SMS.
 */
@Component
public class SubscriberMailer {
    private final JavaMailSender mail;
    private final SubscriptionRepository subscriptions;

    /** «Назначен наряд на инцидент» — сразу при назначении. */
    public void sendAssignmentCreated(Assignment a) { send("assignment-created", recipients(a), a); }

    /** «Назначение закрыто» — при ручном закрытии; при закрытии по событию consolidate не шлётся. */
    public void sendAssignmentClosed(Assignment a) { send("assignment-closed", recipients(a), a); }

    /** «Ежедневная сводка назначений» — за прошедшие сутки, всем подписчикам с byEmail. Пустая сводка не шлётся. */
    public void sendDailyDigest(List<Assignment> perDay) { /* … */ }

    /** «Еженедельная сводка назначений» — за неделю, только по закрытым. Пустая не шлётся. */
    public void sendWeeklyDigest(List<Assignment> perWeek) { /* … */ }

    private List<String> recipients(Assignment a) {
        return subscriptions.findByCategoryAndByEmailTrue(a.category()).stream()
                .map(Subscription::employeeId).map(this::emailOf)
                .filter(e -> !e.equals(emailOf(a.patrolId)))   // старший наряда исключается
                .toList();
    }
}
```

## `src/main/java/ru/summary/navigator/notify/SmsSender.java`

```java
/**
 * SMS через шлюз Sowa (POST {sms.url}/sendsmsac/). Одна попытка сразу, повтор через 1 и 5 минут.
 * Получатель — старший назначенного наряда, независимо от подписок.
 */
@Component
public class SmsSender {
    /** «Вам назначен инцидент №… приоритет …» — при назначении. */
    public void sendAssignedSms(Assignment a) { /* … */ }
}
```

## `src/main/java/ru/summary/navigator/messaging/AssignmentProducer.java`

```java
@Component
public class AssignmentProducer {
    @Value("${topics.assignment-closed}") String topic;   // navigator.assignment.closed

    /** Публикуется при любом закрытии назначения — ручном и системном. Тело: id, incidentId, patrolId, closedBy, closedAt. */
    public void assignmentClosed(Assignment a) { kafka.send(topic, a.id.toString(), toEvent(a)); }
}
```

## `src/main/java/ru/summary/navigator/messaging/IncidentClosedListener.java`

```java
@Component
public class IncidentClosedListener {
    /** consolidate.incident.closed — инцидент закрыт на стороне consolidate. */
    @KafkaListener(topics = "${topics.incident-closed}", groupId = "navigator")
    public void onIncidentClosed(IncidentClosedEvent e) { assignments.closeByIncident(e.incidentId()); }
}
```

## `src/main/java/ru/summary/navigator/scheduler/DigestJobs.java`

```java
@Component
public class DigestJobs {
    @Scheduled(cron = "0 0 8 * * *")          // ежедневно 08:00
    public void dailyDigest()  { mailer.sendDailyDigest(repo.createdSince(now().minus(1, DAYS))); }

    @Scheduled(cron = "0 0 9 * * MON")        // понедельник 09:00
    public void weeklyDigest() { mailer.sendWeeklyDigest(repo.closedSince(now().minus(7, DAYS))); }
}
```

## `src/main/java/ru/summary/navigator/security/Roles.java`

```java
public enum Role {
    DISPATCHER,   // диспетчер: лента, назначение, закрытие, свои подписки
    PATROL,       // старший наряда: карточка инцидента, подтверждение, свои подписки
    ADMIN         // всё, что диспетчер, плюс чужие подписки
}
```

## `src/main/java/ru/summary/navigator/http/ErrorHandler.java`

```java
@RestControllerAdvice
public class ErrorHandler {
    @ExceptionHandler(NavigatorIntegrationException.class)   // 503 { code: SYSTEM_ERROR, message }
    @ExceptionHandler(ConflictException.class)               // 409 { code: CONFLICT, message }
    @ExceptionHandler(ForbiddenException.class)              // 403 { code: FORBIDDEN, message }
}
```

## `src/main/resources/application.yml`

```yaml
consolidate:
  url: ${CONSOLIDATE_URL}
switch:
  cache-ttl: 30s
topics:
  assignment-closed: navigator.assignment.closed
  incident-closed: consolidate.incident.closed
sms:
  url: ${SOWA_URL}
  token: ${SOWA_TOKEN}
  retry: [1m, 5m]
```

