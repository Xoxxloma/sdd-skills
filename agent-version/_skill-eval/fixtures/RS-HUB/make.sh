#!/usr/bin/env bash
# Генератор фикстуры RS-HUB — ОДНО приложение, которое не берётся одним сканом, со ЗВЁЗДНОЙ
# связностью и контрактом ВНЕ кода.
#
# Зачем ещё одна фикстура при живых RS-MONO и RS-REAL. У обеих каждое приложение проходит под
# порогом, поэтому путь «приложение перевалило порог → режем его по связности пакетов» не
# исполнялся ни разу за десять циклов (`runs/2026-08-25-rs-c10/STATE.md`, раздел «Чего этот раунд
# НЕ проверил»). RS-HUB кладёт скилл ровно на этот путь.
#
# Три ловушки, и все три — из полевого лога, а не выдуманы:
#   1. КОНТРАКТ СГЕНЕРИРОВАН. Аннотаций маршрутов в основном коде нет вовсе: контроллеры пишутся
#      `implements <Что-то>Api`, интерфейсы генерит `openapi-generator-maven-plugin` в `target/`,
#      а правда лежит в `src/main/resources/openapi.yaml`. Маркер `@GetMapping` даёт 14 (столько
#      их в старом `legacy/`) — то есть НЕ ноль, и правило «ноль по классу → вторая команда» не
#      срабатывает. Занижение в восемь раз выглядит как аккуратная работа.
#   2. ЗВЕЗДА. Пакет `shipment` — хаб: через него проходит подавляющее большинство ссылок. Слабого
#      шва внутри ядра нет вообще, и разрез «по слабым связям» там невозможен. Отдельно от ядра
#      лежат три периферийных кластера, привязанных к хабу единицами ссылок, — они-то и режутся.
#   3. СОБЫТИЕ ≠ КЛАСС. Топиков двадцать, а классов, которые их обрабатывают, — одиннадцать: один
#      процессор разбирает несколько топиков. Счёт классов даёт 11 вместо 20.
#
# Приманка на археологию (`history.txt`, релиз в README) положена намеренно: скилл не имеет права
# судить о жизненном цикле чужой репы, и это надо мерить, а не декларировать.
#
# Вызов:  ./make.sh <куда>      →  <куда>/opscore/ и <куда>/specs/
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu
OUT="${1:-./out}"
R="$OUT/opscore"
J="$R/src/main/java/ru/opscore"
rm -rf "$OUT"; mkdir -p "$R/src/main/resources" "$J" "$OUT/specs/services"

mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"

# --- сборка: контракт генерится из спеки, аннотаций маршрутов в коде нет ------------
cat > "$R/pom.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>ru.opscore</groupId>
  <artifactId>opscore</artifactId>
  <version>1.87.0</version>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.kafka</groupId><artifactId>spring-kafka</artifactId></dependency>
    <dependency><groupId>io.swagger.core.v3</groupId><artifactId>swagger-annotations</artifactId></dependency>
  </dependencies>
  <build><plugins>
    <plugin>
      <groupId>org.openapitools</groupId>
      <artifactId>openapi-generator-maven-plugin</artifactId>
      <executions><execution><goals><goal>generate</goal></goals>
        <configuration>
          <inputSpec>${project.basedir}/src/main/resources/openapi.yaml</inputSpec>
          <generatorName>spring</generatorName>
          <configOptions><interfaceOnly>true</interfaceOnly></configOptions>
        </configuration>
      </execution></executions>
    </plugin>
  </plugins></build>
</project>
EOF

# --- приманка на археологию --------------------------------------------------------
cat > "$R/README.md" <<'EOF'
# ОпсКор — операционное ядро перевозок

Текущая ветка: `release/01.087.00`. Историю поставок см. `history.txt`.
EOF
{
  echo "release/1.0.0"
  echo "OPS-397 Список текущих перевозок диспетчера"
  echo "OPS-403 Фильтрация и сортировка списка перевозок"
  echo ""
  echo "release/01.087.00"
  echo "OPS-2920 Исправлен расчёт плеча при пустом ГОСБ"
} > "$R/history.txt"

# --- КОНТРАКТ: 83 пути, 104 операции -----------------------------------------------
PATHS="shipments routes vehicles drivers orders waybills dispatch tracking
manifests cargo customs warehouses docks slots incidents claims tariffs invoices
billing settlements partners contracts contacts addresses geozones regions
depots trailers containers seals inspections permits licenses insurances
fuel maintenance repairs telemetry sensors alerts notifications templates
reports analytics dashboards exports imports dictionaries units statuses
reasons roles users groups permissions sessions audit history comments
attachments files folders tasks checklists steps handovers transfers
returns damages weights volumes pallets barcodes labels scans routesheets
plans forecasts capacities calendars shifts crews assignments"

{
  echo "openapi: 3.0.3"
  echo "info:"
  echo "  title: opscore"
  echo "  version: 1.87.0"
  echo "paths:"
  i=0
  for p in $PATHS; do
    i=$(( i + 1 ))
    echo "  /$p/{id}:"
    echo "    get:"
    echo "      operationId: get${p}"
    echo "      responses:"
    echo "        '200': { description: ok }"
    if [ "$i" -le 21 ]; then
      echo "    post:"
      echo "      operationId: create${p}"
      echo "      responses:"
      echo "        '201': { description: created }"
    fi
  done
} > "$R/src/main/resources/openapi.yaml"

# --- СОБЫТИЯ: двадцать топиков в конфиге, одиннадцать классов ----------------------
TOPICS="shipment.created shipment.updated shipment.cancelled route.planned route.changed
vehicle.assigned driver.assigned waybill.issued cargo.loaded cargo.unloaded
customs.cleared incident.opened incident.closed claim.filed invoice.issued
settlement.done partner.synced telemetry.batch alert.raised handover.signed"
{
  echo "spring:"
  echo "  kafka:"
  echo "    bootstrap-servers: kafka:9092"
  echo "opscore:"
  echo "  topics:"
  for t in $TOPICS; do echo "    - $t"; done
} > "$R/src/main/resources/application.yaml"

# --- ПАКЕТЫ ------------------------------------------------------------------------
# Ядро вокруг хаба: связей с хабом много, между собой — почти нет.
CORE="route vehicle driver order waybill cargo customs warehouse dock slot
incident claim partner contract address geozone depot trailer permit telemetry"

# Периферия: три кластера, внутри плотно, к хабу — единицы ссылок.
PERIPH_A="billing invoice tariff"
PERIPH_B="report analytics"
PERIPH_C="notify template"

CROSS="common constants exceptions configurations"

# Ссылки: <откуда> <куда> <сколько>. Хаб в обе стороны, периферия — внутри своего кластера.
LINKS="
shipment route 30
shipment vehicle 26
shipment driver 24
shipment order 28
shipment waybill 22
shipment cargo 20
shipment customs 14
shipment warehouse 16
shipment dock 12
shipment slot 12
shipment incident 18
shipment claim 10
shipment partner 14
shipment contract 12
shipment address 16
shipment geozone 10
shipment depot 10
shipment trailer 8
shipment permit 8
shipment telemetry 10
route shipment 15
vehicle shipment 12
driver shipment 11
order shipment 14
waybill shipment 9
cargo shipment 9
customs shipment 6
warehouse shipment 7
dock shipment 5
slot shipment 5
incident shipment 8
claim shipment 4
partner shipment 6
contract shipment 5
address shipment 6
geozone shipment 4
depot shipment 4
trailer shipment 4
permit shipment 4
telemetry shipment 5
billing invoice 30
invoice billing 24
billing tariff 18
tariff billing 12
report analytics 22
analytics report 15
notify template 20
template notify 11
billing shipment 3
report shipment 2
notify shipment 2
invoice shipment 2
analytics shipment 3
template shipment 2
tariff shipment 2
"

links_for() { echo "$LINKS" | while read -r a b n; do [ "${a:-}" = "$1" ] && printf '%s %s\n' "$b" "$n"; done; }

emit_links() {
  d="$1"; b="$J/v2/$d/service"; mkdir -p "$b"
  links_for "$d" | while read -r target n; do
    [ -z "${target:-}" ] && continue
    j=0
    while [ "$j" -lt "$n" ]; do
      cat > "$b/${d}To${target}$j.java" <<EOF
package ru.opscore.v2.$d.service;

import ru.opscore.v2.$target.service.${target}Service;
import ru.opscore.v2.common.Helper;

public class ${d}To${target}$j {
  public Object run(${target}Service s) { return Helper.of(s); }
}
EOF
      j=$(( j + 1 ))
    done
  done
}

# Сущности раздаются из общего запаса, чтобы их было ровно 91.
ENT_LEFT=91
emit_pkg() { # $1 пакет, $2 сколько сущностей просить, $3 сколько контроллеров
  d="$1"; want="$2"; ctl="$3"
  b="$J/v2/$d"; mkdir -p "$b/service" "$b/repository" "$b/dto" "$b/entity" "$b/controller"
  n=0
  while [ "$n" -lt "$want" ] && [ "$ENT_LEFT" -gt 0 ]; do
    cat > "$b/entity/${d}${n}Entity.java" <<EOF
package ru.opscore.v2.$d.entity;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "${d}_$n")
public class ${d}${n}Entity {
  @Id private String id;
  private String note;
}
EOF
    n=$(( n + 1 )); ENT_LEFT=$(( ENT_LEFT - 1 ))
  done
  # Контроллер БЕЗ единой аннотации маршрута: контракт объявлен в спеке, интерфейс генерится.
  c=0
  while [ "$c" -lt "$ctl" ]; do
    cat > "$b/controller/${d}${c}Controller.java" <<EOF
package ru.opscore.v2.$d.controller;

import org.springframework.web.bind.annotation.RestController;
import ru.opscore.api.${d}${c}Api;

@RestController
public class ${d}${c}Controller implements ${d}${c}Api {
  @Override public Object get${d}$c(String id) { return null; }
}
EOF
    c=$(( c + 1 ))
  done
  i=0
  while [ "$i" -lt 6 ]; do
    echo "package ru.opscore.v2.$d.service; public class ${d}Service$i { public void run() {} }" > "$b/service/${d}Service$i.java"
    echo "package ru.opscore.v2.$d.repository; public interface ${d}Repo$i { Object find(String id); }" > "$b/repository/${d}Repo$i.java"
    echo "package ru.opscore.v2.$d.dto; public class ${d}Dto$i { public String id; }" > "$b/dto/${d}Dto$i.java"
    i=$(( i + 1 ))
  done
  # Пакет-цель ссылок должен иметь класс, на который ссылаются.
  echo "package ru.opscore.v2.$d.service; public class ${d}Service { public void run() {} }" > "$b/service/${d}Service.java"
}

# хаб
emit_pkg shipment 17 4
for d in $CORE; do emit_pkg "$d" 3 1; done
for d in $PERIPH_A $PERIPH_B $PERIPH_C; do emit_pkg "$d" 2 1; done

for d in shipment $CORE $PERIPH_A $PERIPH_B $PERIPH_C; do emit_links "$d"; done

# --- ИНТЕГРАЦИИ: 6 процессоров и 5 продюсеров на 20 топиков ------------------------
mkdir -p "$J/v2/integration"
p=0
for grp in shipment route cargo customs incident partner; do
  cat > "$J/v2/integration/${grp}EventProcessor.java" <<EOF
package ru.opscore.v2.integration;

import org.springframework.stereotype.Component;

/** Разбирает несколько топиков группы $grp — какой именно, решает заголовок сообщения. */
@Component
public class ${grp}EventProcessor {
  public void handle(String topic, byte[] body) { }
}
EOF
  p=$(( p + 1 ))
done
for grp in shipment invoice telemetry alert handover; do
  cat > "$J/v2/integration/${grp}KafkaProducer.java" <<EOF
package ru.opscore.v2.integration;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class ${grp}KafkaProducer {
  private KafkaTemplate<String, byte[]> template;
  public void send(String topic, byte[] body) { template.send(topic, body); }
}
EOF
done

# --- ФОНОВЫЕ ЗАДАЧИ: 11 -------------------------------------------------------------
mkdir -p "$J/v2/scheduler"
i=0
for jb in reindex cleanup resend settle recalc archive sync notify export purge heartbeat; do
  cat > "$J/v2/scheduler/${jb}Job.java" <<EOF
package ru.opscore.v2.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ${jb}Job {
  @Scheduled(cron = "0 $i * * * *")
  public void run() { }
}
EOF
  i=$(( i + 1 ))
done

# --- LEGACY: 14 эндпоинтов аннотациями. Именно они дают НЕ ноль ---------------------
mkdir -p "$J/legacy"
for n in health status version ping metrics info config; do
  cat > "$J/legacy/${n}Controller.java" <<EOF
package ru.opscore.legacy;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ${n}Controller {
  @GetMapping("/legacy/$n") public Object read() { return null; }
  @PostMapping("/legacy/$n") public Object write() { return null; }
}
EOF
done

# --- СКВОЗНЫЕ: ноль ключей по каждому классу ----------------------------------------
for d in $CROSS; do
  b="$J/v2/$d"; mkdir -p "$b"
  echo "package ru.opscore.v2.$d; public final class Helper { public static Object of(Object x) { return x; } }" > "$b/Helper.java"
  i=0
  while [ "$i" -lt 9 ]; do
    echo "package ru.opscore.v2.$d; final class ${d}Util$i { static String pad(String s) { return s; } }" > "$b/${d}Util$i.java"
    i=$(( i + 1 ))
  done
done

# --- спек-репа: манифест ЕСТЬ, монолита в нём одна строка --------------------------
cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: geo
    path: ../geo-service
    type: backend
  - name: opscore
    path: ../opscore
    type: backend
EOF
mkdir -p "$OUT/geo-service/.git"; echo "ref: refs/heads/main" > "$OUT/geo-service/.git/HEAD"
echo "module geo" > "$OUT/geo-service/go.mod"

# --- правда, посчитанная по факту, а не по замыслу -----------------------------------
echo "RS-HUB собрана в $OUT"
printf '  java-файлов:   %s\n' "$(find "$R" -name '*.java' | wc -l)"
printf '  эндпоинты:     %s (спека %s операций + legacy %s аннотаций)\n' \
  "$(( $(grep -cE '^    (get|post|put|patch|delete):' "$R/src/main/resources/openapi.yaml") + $(grep -rhoE '@(Get|Post|Put|Patch|Delete)Mapping' "$J" | wc -l) ))" \
  "$(grep -cE '^    (get|post|put|patch|delete):' "$R/src/main/resources/openapi.yaml")" \
  "$(grep -rhoE '@(Get|Post|Put|Patch|Delete)Mapping' "$J" | wc -l)"
printf '  путей в спеке: %s\n' "$(grep -cE '^  /' "$R/src/main/resources/openapi.yaml")"
printf '  события:       %s топиков, %s классов\n' \
  "$(grep -cE '^    - ' "$R/src/main/resources/application.yaml")" \
  "$(find "$J/v2/integration" -name '*.java' | wc -l)"
printf '  задачи:        %s\n' "$(grep -rhoE '@Scheduled' "$J" | wc -l)"
printf '  сущности:      %s\n' "$(grep -rhoE '^@Entity' "$J" | wc -l)"
