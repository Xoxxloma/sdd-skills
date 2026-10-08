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
# Вызов:  ./make.sh <куда> [--with-client | --big-spec] → <куда>/casedesk/
# --with-client: рядом лежит спека соседа с тем же operationId и клиентским генератором java.
# --big-spec: в openapi.yaml 100 операций (98 реализованы в семи модулях, две архивные — без реализации),
#   у каждой реализованной один факт в методе контроллера: условие → 403/404/409/422/423. Строки спеки
#   и факты собираются по big-spec-key.tsv рядом с make.sh — это и ключ ответов, в дерево он не едет.
#   Правда: контракт 218 (120 базы + 98), остальное как в базе.
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu
OUT="${1:-./out}"
VARIANT="${2:-}"
case "$VARIANT" in ''|--with-client|--big-spec) ;; *) echo "неизвестный вариант: $VARIANT" >&2; exit 2 ;; esac
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

# --- 1б. большая спека: openapi.yaml и контроллеры пишутся заново по big-spec-key.tsv -------------
# Модули большой спеки покрывают все пять модулей базы: их контроллеры и сервисы перезаписываются.
if [ "$VARIANT" = --big-spec ]; then
  KEY="$HERE/big-spec-key.tsv"
  [ -f "$KEY" ] || { echo "нет ключа большой спеки: $KEY" >&2; exit 1; }
  ROWS="$(grep -v '^#' "$KEY" | tr -d '\r')"
  BIG_MODS="checks:проверка findings:нарушение sanctions:санкция templates:шаблон groups:группа reports:отчёт notifications:уведомление"
  big_ru() { local y; for y in $BIG_MODS; do [ "${y%%:*}" != "$1" ] || printf '%s' "${y#*:}"; done; }
  big_summary() {  # <операция> <как модуль называет себя человеку>
    case "$1" in
      list) printf '%s' "Список — ${2}, постранично" ;;        create) printf '%s' "Создать — ${2}" ;;
      get) printf '%s' "Карточка — ${2}" ;;                     update) printf '%s' "Изменить — ${2}" ;;
      delete) printf '%s' "Удалить — ${2}" ;;                   export) printf '%s' "Выгрузить в файл — ${2}" ;;
      assign) printf '%s' "Назначить ответственного — ${2}" ;;  close) printf '%s' "Закрыть — ${2}" ;;
      reopen) printf '%s' "Открыть заново — ${2}" ;;            history) printf '%s' "История изменений — ${2}" ;;
      comment) printf '%s' "Комментарий — ${2}" ;;              attachments) printf '%s' "Вложения — ${2}" ;;
      approve) printf '%s' "Утвердить — ${2}" ;;                priority) printf '%s' "Сменить приоритет — ${2}" ;;
    esac
  }
  big_ok() {
    case "$1" in
      list) printf '%s' "'200': {description: страница списка}" ;;   create) printf '%s' "'201': {description: создано}" ;;
      get) printf '%s' "'200': {description: найдено}" ;;            update) printf '%s' "'200': {description: изменено}" ;;
      delete) printf '%s' "'204': {description: удалено}" ;;         export) printf '%s' "'202': {description: выгрузка поставлена в очередь}" ;;
      assign) printf '%s' "'200': {description: ответственный назначен}" ;; close) printf '%s' "'200': {description: закрыто}" ;;
      reopen) printf '%s' "'200': {description: открыто заново}" ;;  history) printf '%s' "'200': {description: записи истории}" ;;
      comment) printf '%s' "'201': {description: комментарий добавлен}" ;; attachments) printf '%s' "'200': {description: список вложений}" ;;
      approve) printf '%s' "'200': {description: утверждено}" ;;     priority) printf '%s' "'200': {description: приоритет изменён}" ;;
    esac
  }
  {
    printf '%s\n' "openapi: 3.0.3" "info:" "  title: casedesk — рабочее место инспектора, REST для внешних рабочих мест" "  version: 1.4.0" \
                  "servers:" "  - url: /" "paths:"
    prev=""
    while IFS=$'\t' read -r mod op verb path opid code kind anchor limit; do
      [ -n "$mod" ] || continue
      [ "$path" = "$prev" ] || printf '%s\n' "  ${path}:"
      prev="$path"
      printf '%s\n' "    $(printf '%s' "$verb" | tr '[:upper:]' '[:lower:]'):" "      tags: [${mod}]" "      operationId: ${opid}" \
                    "      summary: $(big_summary "$op" "$(big_ru "$mod")")"
      [ "$op" != list ] || printf '%s\n' "      parameters:" "        - {name: page, in: query, schema: {type: integer}}" "        - {name: size, in: query, schema: {type: integer}}"
      printf '%s\n' "      responses:" "        $(big_ok "$op")"
    done <<< "$ROWS"
    # объявлены, но не реализованы никем — как в базе
    printf '%s\n' "  /api/desk/archive/{id}:" \
                  "    get:" "      tags: [archive]" "      operationId: getArchiveDesk" "      summary: Карточка дела из архива" \
                  "      responses:" "        '200': {description: найдено}" \
                  "  /api/desk/archive/{id}/restore:" \
                  "    post:" "      tags: [archive]" "      operationId: restoreArchiveDesk" "      summary: Вернуть дело из архива" \
                  "      responses:" "        '200': {description: возвращено}"
  } > "$RES/openapi.yaml"

  # один факт на метод: условие из ключа → исключение с кодом; остальное — заглушки сервиса
  for x in $BIG_MODS; do
    mod="${x%%:*}"; M="$(cap "$mod")"
    W="$J/v2/$mod/web"; mkdir -p "$W"
    {
      printf '%s\n' "package ru.kontrol.casedesk.v2.${mod}.web;" "" \
                    "import java.util.List;" "import org.springframework.http.ResponseEntity;" \
                    "import org.springframework.web.bind.annotation.RestController;" \
                    "import ru.kontrol.casedesk.api.${M}DeskApi;" \
                    "import ru.kontrol.casedesk.api.model.${M}DeskDto;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskAccess;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskConflictException;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskForbiddenException;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskLockedException;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskNotFoundException;" \
                    "import ru.kontrol.casedesk.v2.common.desk.DeskValidationException;" "" \
                    "/**" " * Реализация интерфейса, который openapi-generator собирает из src/main/resources/openapi.yaml" \
                    " * (target/generated-sources). Пути и глаголы операций — там, здесь только поведение." " */" \
                    "@RestController" "public class ${M}DeskApiController implements ${M}DeskApi {" "" \
                    "  private final ${M}DeskService service;" "  private final DeskAccess access;" "" \
                    "  public ${M}DeskApiController(${M}DeskService service, DeskAccess access) {" \
                    "    this.service = service;" "    this.access = access;" "  }"
      while IFS=$'\t' read -r rmod op verb path opid code kind anchor limit; do
        [ "$rmod" = "$mod" ] || continue
        A="$anchor"; AC="$(cap "$anchor")"
        case "$op" in
          list) sig="ResponseEntity<List<${M}DeskDto>> ${opid}(Integer page, Integer size)"; ok="    return ResponseEntity.ok(service.page(page, size));" ;;
          create) sig="ResponseEntity<${M}DeskDto> ${opid}(${M}DeskDto body)"; ok="    return ResponseEntity.status(201).body(service.create(body));" ;;
          get) sig="ResponseEntity<${M}DeskDto> ${opid}(Long id)"; ok="    return ResponseEntity.ok(service.load(id));" ;;
          delete) sig="ResponseEntity<Void> ${opid}(Long id)"; ok="    service.delete(id);"$'\n'"    return ResponseEntity.noContent().build();" ;;
          export) sig="ResponseEntity<Void> ${opid}(Long id)"; ok="    service.enqueueExport(id);"$'\n'"    return ResponseEntity.accepted().build();" ;;
          history) sig="ResponseEntity<List<${M}DeskDto>> ${opid}(Long id)"; ok="    return ResponseEntity.ok(service.history(id));" ;;
          comment) sig="ResponseEntity<${M}DeskDto> ${opid}(Long id, ${M}DeskDto body)"; ok="    return ResponseEntity.status(201).body(service.update(id, body));" ;;
          attachments) sig="ResponseEntity<List<String>> ${opid}(Long id)"; ok="    return ResponseEntity.ok(service.attachments(id));" ;;
          *) sig="ResponseEntity<${M}DeskDto> ${opid}(Long id, ${M}DeskDto body)"; ok="    return ResponseEntity.ok(service.update(id, body));" ;;
        esac
        case "$kind" in
          P) cond="!access.allowed(\"${A}\")"; thr="DeskForbiddenException(\"нет права ${A}\")" ;;
          V) cond="body.get${AC}() == null"; thr="DeskValidationException(\"${A} обязателен\")" ;;
          N) cond="body.get${AC}() != null && body.get${AC}() > ${limit}"; thr="DeskValidationException(\"${A} больше ${limit}\")" ;;
          F) cond="service.load(id).get${AC}() == null"; thr="DeskNotFoundException(\"${A} не найден\")" ;;
          S) cond="service.load(id).get${AC}() != null"; thr="DeskConflictException(\"${A} уже заполнен\")" ;;
          L) cond="Boolean.TRUE.equals(service.load(id).get${AC}())"; thr="DeskLockedException(\"${A}: запись заблокирована\")" ;;
          NL) cond="service.load(id).get${AC}() >= ${limit}"; thr="DeskConflictException(\"${A} достиг ${limit}\")" ;;
          *) echo "неизвестный вид факта: $kind ($opid)" >&2; exit 1 ;;
        esac
        printf '%s\n' "" "  @Override" "  public ${sig} {" "    if (${cond}) {" "      throw new ${thr};" "    }" "$ok" "  }"
      done <<< "$ROWS"
      printf '%s\n' "}"
    } > "$W/${M}DeskApiController.java"
    {
      printf '%s\n' "package ru.kontrol.casedesk.v2.${mod}.web;" "" "import java.util.Collections;" "import java.util.List;" \
                    "import org.springframework.stereotype.Service;" "import ru.kontrol.casedesk.api.model.${M}DeskDto;" "" \
                    "@Service" "public class ${M}DeskService {" "" \
                    "  public List<${M}DeskDto> page(Integer page, Integer size) {" "    return Collections.emptyList();" "  }" "" \
                    "  public ${M}DeskDto load(Long id) {" "    return new ${M}DeskDto();" "  }" "" \
                    "  public ${M}DeskDto create(${M}DeskDto body) {" "    return body;" "  }" "" \
                    "  public ${M}DeskDto update(Long id, ${M}DeskDto body) {" "    return body;" "  }" "" \
                    "  public void delete(Long id) {" "  }" "" \
                    "  public void enqueueExport(Long id) {" "  }" "" \
                    "  public List<${M}DeskDto> history(Long id) {" "    return Collections.emptyList();" "  }" "" \
                    "  public List<String> attachments(Long id) {" "    return Collections.emptyList();" "  }" "}"
    } > "$W/${M}DeskService.java"
  done
  printf '%s\n' "package ru.kontrol.casedesk.v2.common.desk;" "" "import org.springframework.http.HttpStatus;" \
                "import org.springframework.web.bind.annotation.ResponseStatus;" "" \
                "@ResponseStatus(code = HttpStatus.valueOf(403))" \
                "public class DeskForbiddenException extends RuntimeException {" \
                "  public DeskForbiddenException(Object detail) {" "    super(String.valueOf(detail));" "  }" "}" > "$X/DeskForbiddenException.java"
  printf '%s\n' "package ru.kontrol.casedesk.v2.common.desk;" "" \
                "import org.springframework.security.core.Authentication;" \
                "import org.springframework.security.core.context.SecurityContextHolder;" \
                "import org.springframework.stereotype.Component;" "" \
                "/** Права рабочего места: строка права сверяется с полномочиями текущего пользователя. */" \
                "@Component" "public class DeskAccess {" "" \
                "  public boolean allowed(String authority) {" \
                "    Authentication auth = SecurityContextHolder.getContext().getAuthentication();" \
                "    return auth != null && auth.getAuthorities().stream().anyMatch(a -> authority.equals(a.getAuthority()));" \
                "  }" "}" > "$X/DeskAccess.java"
fi

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
[ "$VARIANT" != --big-spec ] || echo "  фактов-анкеров спеки:        $(printf '%s\n' "$ROWS" | awk -F'\t' 'NF { n++; k[$6]++ } END { printf "%d —", n; for (c = 400; c < 500; c++) if (c in k) printf " %d×%d", c, k[c] }') (ключ big-spec-key.tsv, в дерево не едет)"
echo "  сущности / задачи:           $(c '@Entity\b' "$R/src/main") / $(c '@Scheduled\(' "$R/src/main")"
echo "  топиков в боевом конфиге:    $(grep -coE 'kontrol\.[a-z]+\.[a-z]+\.v1' "$RES/application.yaml"); в тестовом: $(grep -coE 'kontrol\.[a-z]+\.[a-z]+\.v1' "$TR/application.yaml")"
