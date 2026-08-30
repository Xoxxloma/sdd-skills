#!/usr/bin/env bash
# Генератор фикстуры NRS-TAIL — ОДНО приложение, у которого контракт объявлен В КОДЕ, один
# пакет съедает четверть репы, а весь остальной вес разложен по длинному хвосту.
#
# Зачем ещё одна фикстура при живой RS-HUB. RS-HUB прячет контракт ВНЕ кода (openapi.yaml,
# генератор интерфейсов) и ставит звезду из двадцати одинаковых пакетов ядра. Оба этих факта
# прогон научился ловить. Не мерилось другое: репа, где аннотации маршрутов В КОДЕ ЕСТЬ —
# и именно поэтому счёт кажется тривиальным, а промахивается на наивной регулярке; и хвост из
# крошечных пакетов, который нельзя слепить в один кусок «по смыслу», потому что смысла у них
# тринадцать разных.
#
# Пять ловушек:
#   1. РЕГУЛЯРКА ШИРЕ ПРАВДЫ. Маршрутов ровно 139. Но в репозиториях расставлены 47 `@Query`
#      (Spring Data JPA), и привычная «одна регулярка на все точки входа» вида
#      `@(Get|Post|Put|Delete)Mapping|@Query` даёт 186. Завышение на треть выглядит аккуратно.
#      Обратная ошибка тоже подложена: класс-уровневый `@RequestMapping` стоит на 14 контроллерах
#      из 48, поэтому «посчитаем контроллеры по `@RequestMapping`» даёт 14 вместо 139.
#   2. КУСОК, КОТОРЫЙ НЕ ВЛЕЗАЕТ. Пакет `exchange` — 560 java-файлов (27 % репы) и НОЛЬ
#      эндпоинтов. Его поверхность — 18 топиков Kafka, объявленных в `application.yaml`;
#      в коде имён топиков нет вовсе, а обработчиков всего 6. Счёт классов даёт 6 вместо 18.
#   3. ДВОЙНАЯ АННОТАЦИЯ. `@Entity` и `@Table` стоят на одних и тех же 88 классах. Регулярка
#      `@Entity|@Table` даёт ровно 176 — вдвое, и число выглядит правдоподобно.
#   4. СЛОЙ — НЕ КУСОК. Шесть пакетов (`common`, `exceptions`, `constants`, `configuration`,
#      `security`, `baseclass`, суммарно 90 файлов) не держат НИ ОДНОГО ключа ни одного класса.
#      Соблазн собрать из них `cargonet-shared` — разрез по слоям.
#   5. ХВОСТ НЕ СКЛЕИВАЕТСЯ. Двенадцать пакетов по 6–7 файлов держат 1–2 ключа каждый, всего 18.
#      Общего смысла у них нет: пломбы, паллеты, весовая, геозоны, разрешения, заправки,
#      страховки, штрих-коды, чек-листы, приёмки, повреждения, календарь.
#
# Приманка на археологию (`CHANGELOG.md`, релиз в README) положена намеренно: скилл не имеет
# права судить о жизненном цикле чужой репы, и это надо мерить, а не декларировать.
#
# Вызов:  ./make.sh <куда>      →  <куда>/cargonet/, <куда>/weather-api/ и <куда>/specs/
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu
OUT="${1:-./out}"
R="$OUT/cargonet"
J="$R/src/main/java/ru/cargonet"
rm -rf "$OUT"
mkdir -p "$R/src/main/resources" "$J/v2" "$J/legacy" "$OUT/specs/services"
mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"

# --- сборка: ОДИН pom.xml, ОДИН деплой, никаких генераторов контракта ----------------
cat > "$R/pom.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>ru.cargonet</groupId>
  <artifactId>cargonet</artifactId>
  <version>4.19.0</version>
  <packaging>jar</packaging>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.kafka</groupId><artifactId>spring-kafka</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
  </dependencies>
  <build><plugins>
    <plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin>
  </plugins></build>
</project>
EOF

# --- приманка на археологию ----------------------------------------------------------
cat > "$R/README.md" <<'EOF'
# КаргоНет — платформа грузоперевозок

Продакшн-ветка: `release/4.19.0`. Сборка одна, деплой один: `mvn spring-boot:run`.
Что менялось от релиза к релизу — в `CHANGELOG.md`.
EOF
cat > "$R/CHANGELOG.md" <<'EOF'
## 4.19.0
- CN-8814 Перерасчёт тарифа при смене плеча посреди рейса
- CN-8790 Приёмка на терминале без бумажной накладной

## 4.12.0
- CN-8102 Взаиморасчёты с перевозчиком по факту выгрузки
- CN-8044 Экспорт таможенной декларации

## 3.0.0
- CN-5510 Переезд обмена сообщениями на Kafka

## 1.0.0
- CN-12 Первая накладная
EOF

cat > "$J/CargonetApplication.java" <<'EOF'
package ru.cargonet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CargonetApplication {
  public static void main(String[] args) {
    SpringApplication.run(CargonetApplication.class, args);
  }
}
EOF

# --- СОБЫТИЯ: 18 топиков в конфиге, в коде имён топиков нет --------------------------
TOPICS="consignment.created consignment.updated consignment.cancelled consignment.delivered
waybill.issued waybill.voided crew.assigned crew.released vehicle.dispatched vehicle.returned
customs.declared customs.cleared tariff.published settlement.posted settlement.reversed
claim.registered terminal.slot.booked telemetry.batch.received"
{
  echo "spring:"
  echo "  application:"
  echo "    name: cargonet"
  echo "  kafka:"
  echo "    bootstrap-servers: kafka:9092"
  echo "    consumer:"
  echo "      group-id: cargonet-exchange"
  echo "cargonet:"
  echo "  exchange:"
  echo "    topics:"
  for t in $TOPICS; do echo "      - $t"; done
} > "$R/src/main/resources/application.yaml"

# =====================================================================================
# ПАКЕТЫ
# =====================================================================================
# <пакет> <@Entity> <эндпоинтов> <@Query> <@Scheduled> <прочих файлов (первый — сервис-якорь)>
PKGS="
consignment  30 30 9 0 49
tariffbook   12 16 5 0 59
settlement   11 14 5 0 53
crew          9 10 4 0 51
analytics     0 14 3 0 58
dispatcher    0  0 2 7 35
terminal      2  5 2 0 38
vehicle       2  5 2 0 38
route         2  5 2 0 33
waybill       2  5 2 0 31
customs       1  5 2 0 32
warehouse     1  5 2 0 27
partner       1  4 2 0 29
claim         1  4 2 0 26
carrier       1  0 1 0 27
depot         1  0 1 0 23
contract      1  0 1 0 23
notification  0  0 0 0 21
document      0  0 0 0 22
audit         0  0 0 0 19
reference     0  0 0 0 19
seal          1  1 0 0 1
pallet        1  1 0 0 2
weighbridge   1  1 0 0 1
geozone       1  1 0 0 1
permit        0  1 0 0 1
fueling       0  0 0 1 1
insurance     0  0 0 1 1
barcode       2  0 0 0 1
checklist     2  0 0 0 1
handover      1  0 0 0 1
damage        1  0 0 0 1
calendar      1  0 0 0 1
"

# Класс-уровневый `@RequestMapping` стоит ровно на 13 пакетах + один контроллер в legacy = 14.
RM14="consignment tariffbook settlement crew analytics terminal vehicle route waybill customs warehouse partner claim"

# ЗВЕЗДА: <откуда> <куда> <сколько файлов-ссылок>.
# Через `consignment` проходит 384 ссылки из 549 — 70 %. Хвост между собой связан слабо.
LINKS="
consignment tariffbook 18
consignment settlement 16
consignment crew 14
consignment analytics 12
consignment dispatcher 10
consignment terminal 12
consignment vehicle 12
consignment route 11
consignment waybill 10
consignment customs 9
consignment warehouse 9
consignment partner 8
consignment claim 8
consignment carrier 8
consignment depot 7
consignment contract 7
consignment notification 6
consignment document 6
consignment audit 5
consignment reference 5
consignment exchange 10
tariffbook consignment 14
settlement consignment 13
crew consignment 11
analytics consignment 9
dispatcher consignment 8
terminal consignment 9
vehicle consignment 9
route consignment 8
waybill consignment 8
customs consignment 7
warehouse consignment 7
partner consignment 6
claim consignment 6
carrier consignment 6
depot consignment 5
contract consignment 5
notification consignment 4
document consignment 4
audit consignment 3
reference consignment 3
exchange consignment 12
seal consignment 2
pallet consignment 2
weighbridge consignment 2
geozone consignment 2
permit consignment 2
fueling consignment 2
insurance consignment 2
barcode consignment 2
checklist consignment 2
handover consignment 2
damage consignment 2
calendar consignment 2
tariffbook settlement 12
tariffbook analytics 4
settlement tariffbook 10
settlement analytics 4
crew dispatcher 9
crew vehicle 3
dispatcher crew 8
vehicle route 7
route vehicle 8
terminal warehouse 7
warehouse terminal 6
customs waybill 6
waybill customs 5
partner contract 6
contract partner 5
carrier vehicle 5
depot terminal 5
claim damage 4
analytics settlement 6
notification document 5
document audit 4
audit reference 3
reference notification 3
exchange notification 4
exchange document 4
seal pallet 2
geozone route 2
permit customs 2
insurance claim 2
fueling vehicle 2
weighbridge warehouse 2
barcode pallet 2
checklist crew 2
handover crew 2
calendar dispatcher 2
damage claim 2
"

# --- сущности: @Entity и @Table на ОДНОМ И ТОМ ЖЕ классе ------------------------------
emit_entities() {
  d="$1"; n="$2"; D="${d^}"
  [ "$n" -gt 0 ] || return 0
  b="$J/v2/$d/entity"; mkdir -p "$b"
  i=0
  while [ "$i" -lt "$n" ]; do
    {
      printf '%s\n' "package ru.cargonet.v2.$d.entity;" ""
      printf '%s\n' "import javax.persistence.Column;" \
                    "import javax.persistence.Entity;" \
                    "import javax.persistence.Id;" \
                    "import javax.persistence.Table;" ""
      printf '%s\n' "@Entity" \
                    "@Table(name = \"${d}_$i\")" \
                    "public class ${D}${i}Entity {" \
                    "" \
                    "  @Id" \
                    "  @Column(name = \"id\")" \
                    "  private String id;" \
                    "" \
                    "  @Column(name = \"note\")" \
                    "  private String note;" \
                    "" \
                    "  public String getId() {" \
                    "    return id;" \
                    "  }" \
                    "" \
                    "  public void setNote(String value) {" \
                    "    this.note = value == null ? \"\" : value.trim();" \
                    "  }" \
                    "}"
    } > "$b/${D}${i}Entity.java"
    i=$(( i + 1 ))
  done
}

# --- контроллеры: контракт объявлен АННОТАЦИЯМИ, до 4 маршрутов на класс ---------------
emit_controllers() {
  d="$1"; ep="$2"; rm="$3"; D="${d^}"
  [ "$ep" -gt 0 ] || return 0
  b="$J/v2/$d/controller"; mkdir -p "$b"
  left="$ep"; c=0; k=0
  while [ "$left" -gt 0 ]; do
    take=4; [ "$left" -lt 4 ] && take="$left"
    {
      printf '%s\n' "package ru.cargonet.v2.$d.controller;" ""
      printf '%s\n' "import java.util.Collections;" \
                    "import java.util.Map;" \
                    "import java.util.concurrent.ConcurrentHashMap;" \
                    "import org.springframework.web.bind.annotation.DeleteMapping;" \
                    "import org.springframework.web.bind.annotation.GetMapping;" \
                    "import org.springframework.web.bind.annotation.PathVariable;" \
                    "import org.springframework.web.bind.annotation.PostMapping;" \
                    "import org.springframework.web.bind.annotation.PutMapping;" \
                    "import org.springframework.web.bind.annotation.RequestBody;" \
                    "import org.springframework.web.bind.annotation.RequestMapping;" \
                    "import org.springframework.web.bind.annotation.RestController;" ""
      printf '%s\n' "@RestController"
      if [ "$rm" = 1 ] && [ "$c" = 0 ]; then printf '%s\n' "@RequestMapping(\"/api/v2/$d\")"; fi
      printf '%s\n' "public class ${D}Controller$c {" "" \
                    "  private final Map<String, Object> store = new ConcurrentHashMap<>();"
      m=0
      while [ "$m" -lt "$take" ]; do
        case $(( k % 4 )) in
          0) printf '\n'; printf '%s\n' "  @GetMapping(\"/api/v2/$d/$k/{id}\")" \
               "  public Object read$k(@PathVariable String id) {" \
               "    Object row = store.get(id);" \
               "    if (row == null) {" \
               "      throw new IllegalStateException(\"$d/$k not found: \" + id);" \
               "    }" \
               "    return row;" \
               "  }" ;;
          1) printf '\n'; printf '%s\n' "  @PostMapping(\"/api/v2/$d/$k\")" \
               "  public Object create$k(@RequestBody Map<String, Object> body) {" \
               "    String key = String.valueOf(body.get(\"id\"));" \
               "    store.put(key, body);" \
               "    return Collections.singletonMap(\"id\", key);" \
               "  }" ;;
          2) printf '\n'; printf '%s\n' "  @PutMapping(\"/api/v2/$d/$k/{id}\")" \
               "  public Object update$k(@PathVariable String id, @RequestBody Map<String, Object> body) {" \
               "    store.put(id, body);" \
               "    return body;" \
               "  }" ;;
          3) printf '\n'; printf '%s\n' "  @DeleteMapping(\"/api/v2/$d/$k/{id}\")" \
               "  public Object drop$k(@PathVariable String id) {" \
               "    Object was = store.remove(id);" \
               "    return Collections.singletonMap(\"removed\", was != null);" \
               "  }" ;;
        esac
        m=$(( m + 1 )); k=$(( k + 1 ))
      done
      printf '%s\n' "}"
    } > "$b/${D}Controller$c.java"
    left=$(( left - take )); c=$(( c + 1 ))
  done
}

# --- репозитории с @Query: ловушка на «одна регулярка на все точки входа» --------------
emit_queries() {
  d="$1"; n="$2"; D="${d^}"
  [ "$n" -gt 0 ] || return 0
  b="$J/v2/$d/repository"; mkdir -p "$b"
  i=0
  while [ "$i" -lt "$n" ]; do
    {
      printf '%s\n' "package ru.cargonet.v2.$d.repository;" ""
      printf '%s\n' "import java.util.List;" \
                    "import org.springframework.data.jpa.repository.JpaRepository;" \
                    "import org.springframework.data.jpa.repository.Query;" \
                    "import org.springframework.data.repository.query.Param;" ""
      printf '%s\n' "public interface ${D}Repository$i extends JpaRepository<Object, String> {" "" \
                    "  @Query(\"select e from ${D}${i}Entity e where e.note = :note order by e.id\")" \
                    "  List<Object> findByNote(@Param(\"note\") String note);" \
                    "}"
    } > "$b/${D}Repository$i.java"
    i=$(( i + 1 ))
  done
}

# --- фоновые задачи -------------------------------------------------------------------
emit_jobs() {
  d="$1"; n="$2"; D="${d^}"
  [ "$n" -gt 0 ] || return 0
  b="$J/v2/$d/job"; mkdir -p "$b"
  i=0
  while [ "$i" -lt "$n" ]; do
    {
      printf '%s\n' "package ru.cargonet.v2.$d.job;" ""
      printf '%s\n' "import org.springframework.scheduling.annotation.Scheduled;" \
                    "import org.springframework.stereotype.Component;" ""
      printf '%s\n' "@Component" \
                    "public class ${D}Job$i {" "" \
                    "  @Scheduled(cron = \"0 $i/15 * * * *\")" \
                    "  public void run() {" \
                    "    long started = System.currentTimeMillis();" \
                    "    sweep();" \
                    "    report(System.currentTimeMillis() - started);" \
                    "  }" "" \
                    "  private void sweep() {" \
                    "  }" "" \
                    "  private void report(long millis) {" \
                    "  }" \
                    "}"
    } > "$b/${D}Job$i.java"
    i=$(( i + 1 ))
  done
}

# --- прочие файлы: первый — сервис-якорь, на него ссылаются соседи ---------------------
emit_filler() {
  d="$1"; n="$2"; D="${d^}"
  [ "$n" -gt 0 ] || return 0
  b="$J/v2/$d"; mkdir -p "$b/service" "$b/dto" "$b/mapper"
  {
    printf '%s\n' "package ru.cargonet.v2.$d.service;" ""
    printf '%s\n' "public class ${D}Service {" "" \
                  "  public Object resolve(String id) {" \
                  "    if (id == null || id.isEmpty()) {" \
                  "      return null;" \
                  "    }" \
                  "    return id.trim();" \
                  "  }" \
                  "}"
  } > "$b/service/${D}Service.java"
  i=1
  while [ "$i" -lt "$n" ]; do
    case $(( i % 3 )) in
      1) {
           printf '%s\n' "package ru.cargonet.v2.$d.service;" ""
           printf '%s\n' "public class ${D}Handler$i {" "" \
                         "  public String describe(String id) {" \
                         "    StringBuilder sb = new StringBuilder(\"$d:\");" \
                         "    sb.append(id == null ? \"-\" : id);" \
                         "    return sb.toString();" \
                         "  }" \
                         "}"
         } > "$b/service/${D}Handler$i.java" ;;
      2) {
           printf '%s\n' "package ru.cargonet.v2.$d.dto;" ""
           printf '%s\n' "public class ${D}Dto$i {" "" \
                         "  private String id;" \
                         "  private String note;" "" \
                         "  public String getId() {" \
                         "    return id;" \
                         "  }" "" \
                         "  public void setId(String value) {" \
                         "    this.id = value;" \
                         "  }" "" \
                         "  public String getNote() {" \
                         "    return note;" \
                         "  }" \
                         "}"
         } > "$b/dto/${D}Dto$i.java" ;;
      0) {
           printf '%s\n' "package ru.cargonet.v2.$d.mapper;" ""
           printf '%s\n' "public final class ${D}Mapper$i {" "" \
                         "  private ${D}Mapper$i() {" \
                         "  }" "" \
                         "  public static String key(String prefix, String id) {" \
                         "    if (prefix == null) {" \
                         "      return id;" \
                         "    }" \
                         "    return prefix + \"/\" + id;" \
                         "  }" \
                         "}"
         } > "$b/mapper/${D}Mapper$i.java" ;;
    esac
    i=$(( i + 1 ))
  done
}

# --- ссылки: ровно один `import ru.cargonet.v2.<пакет>` на файл ------------------------
emit_links() {
  d="$1"; D="${d^}"
  echo "$LINKS" | while read -r a b n; do
    [ "${a:-}" = "$d" ] || continue
    B="${b^}"
    p="$J/v2/$d/link"; mkdir -p "$p"
    j=0
    while [ "$j" -lt "$n" ]; do
      {
        printf '%s\n' "package ru.cargonet.v2.$d.link;" ""
        printf '%s\n' "import ru.cargonet.v2.$b.service.${B}Service;" ""
        printf '%s\n' "public class ${D}To${B}$j {" "" \
                      "  private final ${B}Service target;" "" \
                      "  public ${D}To${B}$j(${B}Service target) {" \
                      "    this.target = target;" \
                      "  }" "" \
                      "  public Object apply(String id) {" \
                      "    Object value = target.resolve(id);" \
                      "    return value == null ? \"$d/$b\" : value;" \
                      "  }" \
                      "}"
      } > "$p/${D}To${B}$j.java"
      j=$(( j + 1 ))
    done
  done
}

echo "$PKGS" | while read -r d ent ep q sch fil; do
  [ -n "${d:-}" ] || continue
  rm=0
  case " $RM14 " in *" $d "*) rm=1 ;; esac
  emit_entities "$d" "$ent"
  emit_controllers "$d" "$ep" "$rm"
  emit_queries "$d" "$q"
  emit_jobs "$d" "$sch"
  emit_filler "$d" "$fil"
  emit_links "$d"
done

# =====================================================================================
# EXCHANGE: 560 файлов, НОЛЬ эндпоинтов, поверхность — 18 топиков и 6 обработчиков
# =====================================================================================
X="$J/v2/exchange"
mkdir -p "$X/handler" "$X/codec" "$X/envelope" "$X/service"
{
  printf '%s\n' "package ru.cargonet.v2.exchange.service;" ""
  printf '%s\n' "public class ExchangeService {" "" \
                "  public Object resolve(String id) {" \
                "    if (id == null || id.isEmpty()) {" \
                "      return null;" \
                "    }" \
                "    return id.trim();" \
                "  }" \
                "}"
} > "$X/service/ExchangeService.java"

i=0
while [ "$i" -lt 6 ]; do
  {
    printf '%s\n' "package ru.cargonet.v2.exchange.handler;" ""
    printf '%s\n' "import org.springframework.stereotype.Component;" ""
    printf '%s\n' "/**" \
                  " * Разбирает пачку топиков сразу: какой именно пришёл — видно только из заголовка" \
                  " * сообщения. Имена топиков объявлены в src/main/resources/application.yaml," \
                  " * в коде их нет." \
                  " */" \
                  "@Component" \
                  "public class ExchangeMessageHandler$i {" "" \
                  "  public void handle(String topic, byte[] payload) {" \
                  "    if (payload == null || payload.length == 0) {" \
                  "      return;" \
                  "    }" \
                  "    dispatch(topic, payload);" \
                  "  }" "" \
                  "  private void dispatch(String topic, byte[] payload) {" \
                  "  }" \
                  "}"
  } > "$X/handler/ExchangeMessageHandler$i.java"
  i=$(( i + 1 ))
done

i=1
while [ "$i" -lt 534 ]; do
  case $(( i % 2 )) in
    1) {
         printf '%s\n' "package ru.cargonet.v2.exchange.codec;" ""
         printf '%s\n' "public final class ExchangeCodec$i {" "" \
                       "  private ExchangeCodec$i() {" \
                       "  }" "" \
                       "  public static byte[] encode(String payload) {" \
                       "    if (payload == null) {" \
                       "      return new byte[0];" \
                       "    }" \
                       "    return payload.getBytes(java.nio.charset.StandardCharsets.UTF_8);" \
                       "  }" \
                       "}"
       } > "$X/codec/ExchangeCodec$i.java" ;;
    0) {
         printf '%s\n' "package ru.cargonet.v2.exchange.envelope;" ""
         printf '%s\n' "public class ExchangeEnvelope$i {" "" \
                       "  private String key;" \
                       "  private byte[] body;" "" \
                       "  public String getKey() {" \
                       "    return key;" \
                       "  }" "" \
                       "  public byte[] getBody() {" \
                       "    return body == null ? new byte[0] : body;" \
                       "  }" \
                       "}"
       } > "$X/envelope/ExchangeEnvelope$i.java" ;;
  esac
  i=$(( i + 1 ))
done
emit_links exchange

# =====================================================================================
# СКВОЗНЫЕ: шесть пакетов, ноль ключей ЛЮБОГО класса, 15 файлов в каждом
# =====================================================================================
for d in common exceptions constants configuration security baseclass; do
  D="${d^}"
  b="$J/v2/$d"; mkdir -p "$b"
  i=0
  while [ "$i" -lt 15 ]; do
    case "$d" in
      exceptions) {
          printf '%s\n' "package ru.cargonet.v2.exceptions;" ""
          printf '%s\n' "public class CargonetException$i extends RuntimeException {" "" \
                        "  public CargonetException$i(String message) {" \
                        "    super(message);" \
                        "  }" "" \
                        "  public String code() {" \
                        "    return \"CN-$i\";" \
                        "  }" \
                        "}"
        } > "$b/CargonetException$i.java" ;;
      constants) {
          printf '%s\n' "package ru.cargonet.v2.constants;" ""
          printf '%s\n' "public final class Codes$i {" "" \
                        "  public static final String PREFIX = \"cn.$i\";" \
                        "  public static final int LIMIT = $(( 10 + i ));" "" \
                        "  private Codes$i() {" \
                        "  }" \
                        "}"
        } > "$b/Codes$i.java" ;;
      configuration) {
          printf '%s\n' "package ru.cargonet.v2.configuration;" ""
          printf '%s\n' "import org.springframework.context.annotation.Bean;" \
                        "import org.springframework.context.annotation.Configuration;" ""
          printf '%s\n' "@Configuration" \
                        "public class BeanConfig$i {" "" \
                        "  @Bean" \
                        "  public String beanName$i() {" \
                        "    return \"cn-bean-$i\";" \
                        "  }" \
                        "}"
        } > "$b/BeanConfig$i.java" ;;
      security) {
          printf '%s\n' "package ru.cargonet.v2.security;" ""
          printf '%s\n' "public class TokenFilter$i {" "" \
                        "  public boolean allows(String token) {" \
                        "    if (token == null || token.isEmpty()) {" \
                        "      return false;" \
                        "    }" \
                        "    return token.length() > $(( 8 + i ));" \
                        "  }" \
                        "}"
        } > "$b/TokenFilter$i.java" ;;
      baseclass) {
          printf '%s\n' "package ru.cargonet.v2.baseclass;" ""
          printf '%s\n' "public abstract class BaseUnit$i {" "" \
                        "  protected abstract String name();" "" \
                        "  public String label() {" \
                        "    return \"unit:\" + name();" \
                        "  }" \
                        "}"
        } > "$b/BaseUnit$i.java" ;;
      *) {
          printf '%s\n' "package ru.cargonet.v2.common;" ""
          printf '%s\n' "public final class StringUtil$i {" "" \
                        "  private StringUtil$i() {" \
                        "  }" "" \
                        "  public static String pad(String value) {" \
                        "    if (value == null) {" \
                        "      return \"\";" \
                        "    }" \
                        "    return value.trim();" \
                        "  }" \
                        "}"
        } > "$b/StringUtil$i.java" ;;
    esac
    i=$(( i + 1 ))
  done
done

# =====================================================================================
# LEGACY: 12 эндпоинтов старого поколения, один класс-уровневый @RequestMapping
# =====================================================================================
i=0
for n in Health Status Version Ping Metrics Info; do
  {
    printf '%s\n' "package ru.cargonet.legacy;" ""
    printf '%s\n' "import java.util.Collections;" \
                  "import org.springframework.web.bind.annotation.GetMapping;" \
                  "import org.springframework.web.bind.annotation.PostMapping;" \
                  "import org.springframework.web.bind.annotation.RequestMapping;" \
                  "import org.springframework.web.bind.annotation.RestController;" ""
    printf '%s\n' "@RestController"
    if [ "$i" = 0 ]; then printf '%s\n' "@RequestMapping(\"/legacy\")"; fi
    printf '%s\n' "public class ${n}Controller {" "" \
                  "  @GetMapping(\"/legacy/$n\")" \
                  "  public Object read() {" \
                  "    return Collections.singletonMap(\"$n\", \"ok\");" \
                  "  }" "" \
                  "  @PostMapping(\"/legacy/$n\")" \
                  "  public Object write() {" \
                  "    return Collections.singletonMap(\"$n\", \"accepted\");" \
                  "  }" \
                  "}"
  } > "$J/legacy/${n}Controller.java"
  i=$(( i + 1 ))
done
for n in LegacyPayload LegacyClock; do
  {
    printf '%s\n' "package ru.cargonet.legacy;" ""
    printf '%s\n' "public final class $n {" "" \
                  "  private $n() {" \
                  "  }" "" \
                  "  public static String stamp(String value) {" \
                  "    return value == null ? \"\" : value;" \
                  "  }" \
                  "}"
  } > "$J/legacy/$n.java"
done

# =====================================================================================
# Соседняя маленькая репа: своя .git, В МАНИФЕСТ НЕ ВХОДИТ
# =====================================================================================
W="$OUT/weather-api"
mkdir -p "$W/.git" "$W/internal"
echo "ref: refs/heads/main" > "$W/.git/HEAD"
echo "module weather-api" > "$W/go.mod"
i=0
while [ "$i" -lt 29 ]; do
  {
    printf '%s\n' "package internal" ""
    printf '%s\n' "func Forecast$i(city string) string {" \
                  "	if city == \"\" {" \
                  "		return \"unknown\"" \
                  "	}" \
                  "	return city" \
                  "}"
  } > "$W/internal/forecast$i.go"
  i=$(( i + 1 ))
done

# --- спек-репа: манифест ЕСТЬ, в нём ОДНА строка -------------------------------------
cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: cargonet
    path: ../cargonet
    type: backend
EOF

# =====================================================================================
# правда, посчитанная по факту, а не по замыслу
# =====================================================================================
echo "NRS-TAIL собрана в $OUT"
printf '  java-файлов:        %s\n' "$(find "$J" -name '*.java' | wc -l)"
printf '  пакетов в v2/:      %s\n' "$(find "$J/v2" -mindepth 1 -maxdepth 1 -type d | wc -l)"
printf '  эндпоинты:          %s\n' "$(grep -rhoE '@(Get|Post|Put|Delete)Mapping' "$J" | wc -l)"
printf '  наивно +@Query:     %s\n' "$(grep -rhoE '@(Get|Post|Put|Delete)Mapping|@Query' "$J" | wc -l)"
printf '  наивно @RequestMapping: %s\n' "$(grep -rhoE '@RequestMapping' "$J" | wc -l)"
printf '  сущности:           %s (наивно @Entity|@Table: %s)\n' \
  "$(grep -rhoE '@Entity' "$J" | wc -l)" "$(grep -rhoE '@Entity|@Table' "$J" | wc -l)"
printf '  задачи:             %s\n' "$(grep -rhoE '@Scheduled' "$J" | wc -l)"
printf '  события:            %s топиков, %s обработчиков\n' \
  "$(grep -cE '^      - ' "$R/src/main/resources/application.yaml")" \
  "$(find "$X/handler" -name '*.java' | wc -l)"
printf '  файлов в exchange:  %s\n' "$(find "$X" -name '*.java' | wc -l)"
printf '  ссылок между пакетами: %s\n' "$(grep -rhoE '^import ru\.cargonet\.v2\.' "$J" | wc -l)"
