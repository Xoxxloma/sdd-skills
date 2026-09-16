# Фикстура SM-SWITCH — чужой рубильник, булевы поля, справочник и пять видов писем

Синтетический репозиторий. Подаётся модели как содержимое `/work/navigator-api`; она работает с
этим текстом, а не ходит по диску. `type` в манифесте — `backend`.

**Зачем она нужна.** Два полевых фрагмента «Бизнес-правил» 2026-09-16 показали ровно четыре
провала, которые ни одна фикстура не воспроизводит: (1) флаг чужого сервиса записан как состояние
своей сущности, (2) текст ошибки в ответе записан как исходящее сообщение, (3) блок объекта
составлен из строк на поле, а не на значение, (4) пять видов писем свёрнуты в один блок.
Здесь все четыре ловушки лежат в одном маленьком сервисе, и у каждой есть однозначно правильный
ответ по `card.template.md`.

Сервис — прокси над `consolidate`: отдаёт инциденты диспетчеру, ведёт назначения нарядов и
подписки на рассылки. Работает только пока `consolidate` не выключил интеграцию флагом.

Инвентарь задан точными числами, чтобы грейдинг был счётным:

| Что | Сколько | В какую секцию |
|---|---|---|
| HTTP-эндпоинты | **10** (из них 1 служебный `/actuator/health`) | Публичный контракт |
| Топики | **2** (публикует 1, потребляет 1) | События |
| Фоновые задачи | **2** | Фоновые задачи |
| Сущности | **2** (`Assignment`, `Subscription`) | Владеет данными |
| Роли | **3** | Роли и доступ |
| **Объекты «Бизнес-правил»** | **1** — `Assignment`, **3 значения** `status` | Бизнес-правила |
| **Сообщения «Бизнес-правил»** | **6** — 4 письма, 1 SMS, 1 топик | Бизнес-правила |
| **Ограничения «Бизнес-правил»** | **1** — флаг интеграции у `consolidate` | Бизнес-правила |

Имена из манифеста, которые передаются субагенту: `navigator, consolidate, dispatch-web`.

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

## Что здесь проверяется

- **BR-1, чужой флаг — не состояние.** `SwitchStatus.status` — булево поле ответа `consolidate`.
  Блока объекта с заголовком `SwitchStatus` (или «состояние — флаг…») в «Бизнес-правилах» **нет**.
  Вместо него **один блок `ограничение «…»`**: условием управляет `consolidate`, пока оно действует —
  все запросы навигатора отвергаются с сообщением «Интеграция с АС Навигатор отключена».
- **BR-2, ошибка в ответе — не сообщение.** Блока `сообщение «Интеграция с АС Навигатор
  отключена»` **нет**; `SYSTEM_ERROR` в «Бизнес-правилах» не встречается (его место — «Публичный
  контракт»).
- **BR-3, строка на значение, не на поле.** Блок `Assignment` содержит ровно три строки-состояния
  с токенами `NEW`, `ACCEPTED`, `CLOSED`: кто переводит (диспетчер / старший наряда / диспетчер,
  админ или система по событию `consolidate`), условие (одно незакрытое на инцидент; только из
  NEW и только свой наряд; только принятое, с причиной), что происходит (письмо и SMS; топик и
  письмо; при системном закрытии письма нет), что нельзя (закрытое не открывается). Строк вида
  «`patrolId` — табельный номер…», «`closedBy` — …» в блоке **нет**: это перечень полей, он в
  «Владеет данными».
- **BR-4, справочник — не состояние.** `Priority` (`LOW`/`NORMAL`/`HIGH`) ни на одно правило не
  влияет — строк на его значения в блоке `Assignment` **нет**. Булевы `byEmail`/`bySms` у
  `Subscription` — не перечисление: блока `Subscription` **нет**.
- **BR-5, письма по видам.** Сообщений **6**, каждое своим блоком: «назначен наряд на инцидент»,
  «назначение закрыто», «ежедневная сводка назначений», «еженедельная сводка назначений»,
  SMS старшему наряда, топик `navigator.assignment.closed`. Один блок «письма подписчикам» на
  четыре шаблона — потерянные виды.
- **BR-6, форма сообщения.** Заголовок словами, токен (`assignment-created`, `navigator.assignment.closed`)
  в строке, не в заголовке. В строках: повод, кто получает и кто нет (старший наряда письмо не
  получает; при системном закрытии не шлётся; пустая сводка не шлётся), задержка (SMS: повтор
  через 1 и 5 минут).
- **BR-7, кодовый регистр.** В строках «Бизнес-правил» нет `checkApiIsAvailable`, путей
  `/admin/navigator`, `/sendsmsac/`, имён классов и методов, `templates/`.
- **Опись.** Итоговая строка `⟹ состояний 1 (значений 3), сообщений 6, ограничений 1`.

## Ловушки

**Флаг перевёрнут.** `status=true` у `consolidate` значит «отключено», и комментарий это называет.
Правильная строка ограничения говорит об условии словами («пока интеграция отключена»), а не о
значении поля: `true`/`false` в «Бизнес-правилах» — признак, что чужое поле записали как состояние.

**Текст ошибки видит пользователь.** «Интеграция с АС Навигатор отключена» уходит в UI через 503, и
соблазн назвать это «сообщением человеку» велик. Но это ответ на запрос, а не отправка: у него нет
ни получателя по подписке, ни повода, ни задержки.

**Сообщений шесть, а модуль отправки один.** Четыре метода `sendXxx` в одном классе — четыре вида.
Свёртка в «уведомления подписчикам» проходит гейт по топикам (топик один и он есть) и ловится
только счётом строк `сообщение:` в описи.

**`Priority` выглядит как состояние.** Перечисление, `@Enumerated`, три значения — но комментарий
говорит «на правила не влияет», и ни одно условие в сервисе его не читает. Три строки на него в
блоке `Assignment` — пустышки.

**Служебный эндпоинт один и он не в контроллере.** `/actuator/health` даёт стартер; в «Публичном
контракте» он есть служебным блоком, в «Что умеет» — нет.
