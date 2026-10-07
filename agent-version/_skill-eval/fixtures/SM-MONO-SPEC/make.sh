#!/usr/bin/env bash
# Генератор фикстуры SM-MONO-SPEC — монолит SM-MONO-DGS (casedesk) плюс то, на чём service-map-2.0
# споткнулся в проме 2026-10-05 и чего в прежних деревьях нет вместе:
#
#   1. REST ИЗ ФАЙЛА СПЕЦИФИКАЦИИ. `src/main/resources/openapi.yaml` описывает 30 операций
#      `/api/desk/…`. Интерфейсы `*DeskApi` генерит openapi-generator-maven-plugin в target/ —
#      в исходниках их нет. Контроллеры пяти модулей написаны `implements <Модуль>DeskApi` с
#      `@Override` и БЕЗ аннотаций маршрутов: счёт по `@GetMapping` их не видит (остаются 16 REST базы).
#   2. ОБЪЯВЛЕНО, НО НЕ РЕАЛИЗОВАНО. Две операции из 30 (`/api/desk/archive/…`) в коде не реализованы
#      никем: в карточке их быть не должно.
#   3. КЛЮЧ В ДВУХ МЕСТАХ. Операция объявлена в `resources/`, а реализована в папке модуля: при
#      нарезке её берёт один хозяин по правилам скилла — в карточке один блок, без дублей.
#   4. ТЕСТОВЫЙ КОНФИГ. `src/test/resources/application.yaml` называет четыре топика
#      `kontrol.test.*.v1` той же формой, что боевой конфиг: в карточке их быть не должно.
#
# Правда: контракт 148 (120 базы + 28 реализованных операций спецификации), сущности 60, задачи 10,
# топики 12. База собирается генератором SM-MONO-DGS как есть.
#
# Вызов:  ./make.sh <куда> [--with-client] → <куда>/casedesk/
# --with-client: рядом лежит спека соседа с тем же operationId и клиентским генератором java.
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu
OUT="${1:-./out}"
VARIANT="${2:-}"
case "$VARIANT" in ''|--with-client) ;; *) echo "неизвестный вариант: $VARIANT" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$HERE/../SM-MONO-DGS/make.sh"
[ -f "$BASE" ] || { echo "нет генератора базы: $BASE" >&2; exit 1; }
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"

# --- база: дерево SM-MONO-DGS ---------------------------------------------------------------
# bash 3.2 (macOS) не знает ${x^}, а переменную перед не-ASCII символом читает с лишним байтом —
# генератор базы запускается копией с двумя подстановками; на bash 4+ — как есть.
if [ "${BASH_VERSINFO[0]}" -ge 4 ]; then
  bash "$BASE" "$OUT" > /dev/null
else
  T="$(mktemp)"
  perl -pe 's/\$\{(\w+)\^\}/\$(cap "\$$1")/g; s/\$([A-Za-z_]\w*)(?=[\x80-\xFF])/\${$1}/g' "$BASE" \
    | awk '!done && /^set -eu/ { print; print "cap() { printf \"%s%s\" \"$(printf \"%s\" \"${1:0:1}\" | tr \"[:lower:]\" \"[:upper:]\")\" \"${1:1}\"; }"; done = 1; next } { print }' > "$T"
  bash "$T" "$OUT" > /dev/null; rm -f "$T"
fi
R="$OUT/casedesk"
J="$R/src/main/java/ru/kontrol/casedesk"
RES="$R/src/main/resources"
[ -d "$J/v2" ] || { echo "база не собралась: нет $J/v2" >&2; exit 1; }

cap() { printf '%s%s' "$(printf '%s' "${1:0:1}" | tr '[:lower:]' '[:upper:]')" "${1:1}"; }

# модуль : число операций (первые N из шести шаблонов) : как модуль называет себя человеку
MODS="checks:6:проверка findings:6:нарушение sanctions:6:санкция templates:5:шаблон groups:5:группа"

# --- 1. openapi.yaml: 28 реализованных операций + 2 без реализации ---------------------------
{
  printf '%s\n' "openapi: 3.0.3" "info:" "  title: casedesk — рабочее место инспектора, REST для внешних рабочих мест" "  version: 1.4.0" \
                "servers:" "  - url: /" "paths:"
  for m in $MODS; do
    mod="${m%%:*}"; rest="${m#*:}"; n="${rest%%:*}"; ru="${rest#*:}"; M="$(cap "$mod")"
    printf '%s\n' "  /api/desk/${mod}:" \
                  "    get:" "      tags: [${mod}]" "      operationId: list${M}Desk" "      summary: Список — ${ru}, постранично" \
                  "      parameters:" "        - {name: page, in: query, schema: {type: integer}}" "        - {name: size, in: query, schema: {type: integer}}" \
                  "      responses:" "        '200': {description: страница списка}" \
                  "    post:" "      tags: [${mod}]" "      operationId: create${M}Desk" "      summary: Создать — ${ru}" \
                  "      responses:" "        '201': {description: создано}" "        '422': {description: нет обязательного поля title}"
    printf '%s\n' "  /api/desk/${mod}/{id}:" \
                  "    get:" "      tags: [${mod}]" "      operationId: get${M}Desk" "      summary: Карточка — ${ru}" \
                  "      responses:" "        '200': {description: найдено}" "        '404': {description: нет такой записи}" \
                  "    put:" "      tags: [${mod}]" "      operationId: update${M}Desk" "      summary: Изменить — ${ru}" \
                  "      responses:" "        '200': {description: изменено}" "        '409': {description: запись изменена другим инспектором}"
    if [ "$n" -ge 5 ]; then
      printf '%s\n' "    delete:" "      tags: [${mod}]" "      operationId: delete${M}Desk" "      summary: Удалить — ${ru}" \
                    "      responses:" "        '204': {description: удалено}" "        '423': {description: запись закрыта, удалять нельзя}"
    fi
    if [ "$n" -ge 6 ]; then
      printf '%s\n' "  /api/desk/${mod}/{id}/export:" \
                    "    post:" "      tags: [${mod}]" "      operationId: export${M}Desk" "      summary: Выгрузить в файл — ${ru}" \
                    "      responses:" "        '202': {description: выгрузка поставлена в очередь}"
    fi
  done
  # объявлены, но не реализованы никем: контроллера ArchiveDeskApi в коде нет
  printf '%s\n' "  /api/desk/archive/{id}:" \
                "    get:" "      tags: [archive]" "      operationId: getArchiveDesk" "      summary: Карточка дела из архива" \
                "      responses:" "        '200': {description: найдено}" \
                "  /api/desk/archive/{id}/restore:" \
                "    post:" "      tags: [archive]" "      operationId: restoreArchiveDesk" "      summary: Вернуть дело из архива" \
                "      responses:" "        '200': {description: возвращено}"
} > "$RES/openapi.yaml"

# --- 2. контроллеры: implements <Модуль>DeskApi, без аннотаций маршрутов ----------------------
for m in $MODS; do
  mod="${m%%:*}"; rest="${m#*:}"; n="${rest%%:*}"; M="$(cap "$mod")"
  W="$J/v2/$mod/web"; mkdir -p "$W"
  {
    printf '%s\n' "package ru.kontrol.casedesk.v2.${mod}.web;" "" \
                  "import java.util.List;" "import org.springframework.http.ResponseEntity;" \
                  "import org.springframework.web.bind.annotation.RestController;" \
                  "import ru.kontrol.casedesk.api.${M}DeskApi;" \
                  "import ru.kontrol.casedesk.api.model.${M}DeskDto;" "" \
                  "/**" " * Реализация интерфейса, который openapi-generator собирает из src/main/resources/openapi.yaml" \
                  " * (target/generated-sources). Пути и глаголы операций — там, здесь только поведение." " */" \
                  "@RestController" "public class ${M}DeskApiController implements ${M}DeskApi {" "" \
                  "  private static final int MAX_PAGE = 200;" \
                  "  private final ${M}DeskService service;" "" \
                  "  public ${M}DeskApiController(${M}DeskService service) {" "    this.service = service;" "  }" ""
    printf '%s\n' "  @Override" "  public ResponseEntity<List<${M}DeskDto>> list${M}Desk(Integer page, Integer size) {" \
                  "    int limit = size == null ? 50 : Math.min(size, MAX_PAGE);" \
                  "    return ResponseEntity.ok(service.page(page == null ? 0 : page, limit));" "  }" ""
    printf '%s\n' "  @Override" "  public ResponseEntity<${M}DeskDto> create${M}Desk(${M}DeskDto body) {" \
                  "    if (body.getTitle() == null || body.getTitle().isBlank()) {" \
                  "      throw new DeskValidationException(\"title обязателен\");" "    }" \
                  "    return ResponseEntity.status(201).body(service.create(body));" "  }" ""
    printf '%s\n' "  @Override" "  public ResponseEntity<${M}DeskDto> get${M}Desk(Long id) {" \
                  "    return service.find(id).map(ResponseEntity::ok).orElseThrow(() -> new DeskNotFoundException(id));" "  }" ""
    printf '%s\n' "  @Override" "  public ResponseEntity<${M}DeskDto> update${M}Desk(Long id, ${M}DeskDto body) {" \
                  "    ${M}DeskDto current = service.find(id).orElseThrow(() -> new DeskNotFoundException(id));" \
                  "    if (!current.getVersion().equals(body.getVersion())) {" \
                  "      throw new DeskConflictException(\"запись изменена другим инспектором\");" "    }" \
                  "    return ResponseEntity.ok(service.update(id, body));" "  }" ""
    if [ "$n" -ge 5 ]; then
      printf '%s\n' "  @Override" "  public ResponseEntity<Void> delete${M}Desk(Long id) {" \
                    "    if (service.isClosed(id)) {" "      throw new DeskLockedException(\"запись закрыта, удалять нельзя\");" "    }" \
                    "    service.delete(id);" "    return ResponseEntity.noContent().build();" "  }" ""
    fi
    if [ "$n" -ge 6 ]; then
      printf '%s\n' "  @Override" "  public ResponseEntity<Void> export${M}Desk(Long id) {" \
                    "    service.enqueueExport(id);" "    return ResponseEntity.accepted().build();" "  }" ""
    fi
    printf '%s\n' "}"
  } > "$W/${M}DeskApiController.java"
  {
    printf '%s\n' "package ru.kontrol.casedesk.v2.${mod}.web;" "" "import java.util.Collections;" "import java.util.List;" "import java.util.Optional;" \
                  "import org.springframework.stereotype.Service;" "import ru.kontrol.casedesk.api.model.${M}DeskDto;" "" \
                  "@Service" "public class ${M}DeskService {" "" \
                  "  public List<${M}DeskDto> page(int page, int size) {" "    return Collections.emptyList();" "  }" "" \
                  "  public Optional<${M}DeskDto> find(Long id) {" "    return Optional.empty();" "  }" "" \
                  "  public ${M}DeskDto create(${M}DeskDto body) {" "    return body;" "  }" "" \
                  "  public ${M}DeskDto update(Long id, ${M}DeskDto body) {" "    return body;" "  }" "" \
                  "  public boolean isClosed(Long id) {" "    return false;" "  }" "" \
                  "  public void delete(Long id) {" "  }" "" \
                  "  public void enqueueExport(Long id) {" "  }" "}"
  } > "$W/${M}DeskService.java"
done
# общие исключения рабочего места — без пометок-ключей
X="$J/v2/common/desk"; mkdir -p "$X"
for e in Validation:422 NotFound:404 Conflict:409 Locked:423; do
  name="${e%%:*}"; code="${e#*:}"
  printf '%s\n' "package ru.kontrol.casedesk.v2.common.desk;" "" "import org.springframework.http.HttpStatus;" \
                "import org.springframework.web.bind.annotation.ResponseStatus;" "" \
                "@ResponseStatus(code = HttpStatus.valueOf(${code}))" \
                "public class Desk${name}Exception extends RuntimeException {" \
                "  public Desk${name}Exception(Object detail) {" "    super(String.valueOf(detail));" "  }" "}" > "$X/Desk${name}Exception.java"
done

# --- 3. pom.xml: генератор интерфейсов из спецификации ---------------------------------------
awk '{ print } /graphql-dgs-codegen-maven-plugin/ {
  print "    <plugin><groupId>org.openapitools</groupId><artifactId>openapi-generator-maven-plugin</artifactId>"
  print "      <configuration><inputSpec>${project.basedir}/src/main/resources/openapi.yaml</inputSpec><generatorName>spring</generatorName>"
  print "        <apiPackage>ru.kontrol.casedesk.api</apiPackage><modelPackage>ru.kontrol.casedesk.api.model</modelPackage>"
  print "        <configOptions><interfaceOnly>true</interfaceOnly></configOptions></configuration></plugin>"
}' "$R/pom.xml" > "$R/pom.xml.tmp" && mv "$R/pom.xml.tmp" "$R/pom.xml"

# Клиентская спека рядом с серверной: расширение, часть имён операций и путей совпадают.
if [ "$VARIANT" = --with-client ]; then
  cat > "$RES/neighbour.yaml" <<'EOF'
openapi: 3.0.3
info:
  title: neighbour — удалённый каталог
  version: 1.0.0
paths:
  /api/desk/groups:
    get:
      operationId: listGroupsDesk
      responses:
        '200': {description: группы соседа}
    post:
      operationId: createGroupsDesk
      responses:
        '201': {description: группа соседа создана}
  /api/desk/groups/{id}:
    get:
      operationId: getGroupsDesk
      responses:
        '200': {description: группа соседа}
    put:
      operationId: updateGroupsDesk
      responses:
        '200': {description: группа соседа обновлена}
  /api/neighbour/limits/{id}:
    get:
      operationId: getNeighbourLimit
      responses:
        '200': {description: лимит соседа}
    delete:
      operationId: deleteNeighbourLimit
      responses:
        '204': {description: лимит соседа удалён}
EOF
  awk '{ print } /graphql-dgs-codegen-maven-plugin/ {
    print "    <plugin><groupId>org.openapitools</groupId><artifactId>openapi-generator-maven-plugin</artifactId>"
    print "      <configuration><inputSpec>${project.basedir}/src/main/resources/neighbour.yaml</inputSpec><generatorName>java</generatorName>"
    print "        <apiPackage>ru.kontrol.neighbour.client.api</apiPackage><library>resttemplate</library></configuration></plugin>"
  }' "$R/pom.xml" > "$R/pom.xml.tmp" && mv "$R/pom.xml.tmp" "$R/pom.xml"
  mkdir -p "$J/integration"
  cat > "$J/integration/NeighbourGateway.java" <<'EOF'
package ru.kontrol.casedesk.integration;

import org.springframework.stereotype.Service;
import ru.kontrol.neighbour.client.api.DefaultApi;

@Service
public class NeighbourGateway {
  private final DefaultApi client;
  public NeighbourGateway(DefaultApi client) { this.client = client; }
  public Object groups() { return client.listGroupsDesk(); }
  public Object limit(Long id) { return client.getNeighbourLimit(id); }
}
EOF
fi

# --- 4. тесты: конфиг с четырьмя топиками той же формы, что боевой ----------------------------
TR="$R/src/test/resources"; TJ="$R/src/test/java/ru/kontrol/casedesk"; mkdir -p "$TR" "$TJ"
printf '%s\n' "spring:" "  datasource:" "    url: jdbc:h2:mem:casedesk" \
              "casedesk:" "  kafka:" "    bootstrap-servers: localhost:9092" "    consumers:" \
              "      intake:" "        group-id: casedesk-test" "        topics:" \
              "          - kontrol.test.intake.v1" "          - kontrol.test.reopen.v1" \
              "    producers:" "      case-status:" "        topic: kontrol.test.status.v1" \
              "      finding:" "        topic: kontrol.test.finding.v1" > "$TR/application.yaml"
printf '%s\n' "package ru.kontrol.casedesk;" "" "import org.junit.jupiter.api.Test;" \
              "import org.springframework.boot.test.context.SpringBootTest;" "" \
              "@SpringBootTest" "class CasedeskApplicationTests {" "" "  @Test" "  void contextLoads() {" "  }" "}" > "$TJ/CasedeskApplicationTests.java"

# --- числа по собранному дереву --------------------------------------------------------------
c() { grep -rhoE "$1" "$2" --include="${3:-*.java}" 2>/dev/null | wc -l | tr -d ' '; }
ops=$(grep -cE '^      operationId:' "$RES/openapi.yaml")
impl=$(grep -rhA1 '@Override' "$J"/v2/*/web/*DeskApiController.java | grep -cE 'Desk\(')
echo "SM-MONO-SPEC собрана: $R"
echo "  java-файлов:                 $(find "$R/src/main" -name '*.java' | wc -l | tr -d ' ') (+ $(find "$R/src/test" -name '*.java' | wc -l | tr -d ' ') в src/test)"
echo "  операций в openapi.yaml:     $ops, из них реализовано $impl, без реализации $((ops - impl))"
echo "  REST по аннотациям:          $(c '@(Get|Post|Put|Patch|Delete)Mapping\(' "$R/src/main")"
echo "  DGS корневых операций:       $(( $(c '@Dgs(Query|Mutation|Subscription)\b' "$R/src/main") + $(c '@DgsData\(parentType\s*=\s*"(Query|Mutation|Subscription)"' "$R/src/main") ))"
echo "  контракт всего:              $(( impl + $(c '@(Get|Post|Put|Patch|Delete)Mapping\(' "$R/src/main") + $(c '@Dgs(Query|Mutation|Subscription)\b' "$R/src/main") + $(c '@DgsData\(parentType\s*=\s*"(Query|Mutation|Subscription)"' "$R/src/main") ))"
[ "$VARIANT" != --with-client ] || echo "  операций клиентской спеки:   $(grep -cE '^      operationId:' "$RES/neighbour.yaml") (не контракт)"
echo "  сущности / задачи:           $(c '@Entity\b' "$R/src/main") / $(c '@Scheduled\(' "$R/src/main")"
echo "  топиков в боевом конфиге:    $(grep -coE 'kontrol\.[a-z]+\.[a-z]+\.v1' "$RES/application.yaml"); в тестовом: $(grep -coE 'kontrol\.[a-z]+\.[a-z]+\.v1' "$TR/application.yaml")"
