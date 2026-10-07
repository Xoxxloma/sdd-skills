#!/usr/bin/env bash
# Проверка дерева и области счётчика; моделей не запускает.
set -eu
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/sm-spec.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT
bash "$HERE/make.sh" "$OUT/base" > "$OUT/base.out"
bash "$HERE/make.sh" "$OUT/client" --with-client > "$OUT/client.out"
R="$OUT/client/casedesk"
cmp "$OUT/base/casedesk/src/main/resources/openapi.yaml" "$R/src/main/resources/openapi.yaml"
grep -q '<inputSpec>.*openapi.yaml</inputSpec><generatorName>spring</generatorName>' "$R/pom.xml"
grep -q '<inputSpec>.*neighbour.yaml</inputSpec><generatorName>java</generatorName>' "$R/pom.xml"
# Как счётчик с дополнительным полем области: path = точный серверный файл, маска = *.yaml.
server=$(grep -cE '^\s+operationId:' "$R/src/main/resources/openapi.yaml")
client=$(grep -cE '^\s+operationId:' "$R/src/main/resources/neighbour.yaml")
broad=$(grep -hE '^\s+operationId:' "$R/src/main/resources/"*.yaml | wc -l | tr -d ' ')
impl=$(grep -rhA1 '@Override' "$R/src/main/java/ru/kontrol/casedesk/v2/"*/web/*DeskApiController.java | grep -cE 'Desk\(')
[ "$server" = 30 ] && [ "$client" = 6 ] && [ "$broad" = 36 ] && [ "$impl" = 28 ]
grep -q 'operationId: listGroupsDesk' "$R/src/main/resources/openapi.yaml"
grep -q 'operationId: listGroupsDesk' "$R/src/main/resources/neighbour.yaml"
! grep -rhE '@(Get|Post|Put|Patch|Delete)Mapping' "$R/src/main/java/ru/kontrol/casedesk/v2/"*/web/*DeskApiController.java | grep -q .
! grep -rhE '(getNeighbourLimit|deleteNeighbourLimit)\(' "$R/src/main/java/ru/kontrol/casedesk/v2/"*/web/*DeskApiController.java | grep -q .
grep -q 'контракт всего: *148' "$OUT/base.out"
grep -q 'контракт всего: *148' "$OUT/client.out"
echo "SM-MONO-SPEC: server=$server, implemented=$impl, client=$client, scoped=$server, broad=$broad — OK"
