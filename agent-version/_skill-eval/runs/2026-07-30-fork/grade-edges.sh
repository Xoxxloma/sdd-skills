#!/usr/bin/env bash
# Грейдер SM-EDGES: Шаг 5 на материализованном слепке. Считается ТОЛЬКО по файлам песочницы.
#   ./grade-edges.sh <песочница>
set -uo pipefail
D="${1:?дай путь к песочнице}"
T=/c/Users/Konstantin/projects/product-skills/agent-version-3.1/_skill-eval/fixtures/SM-EDGES/tree/services
pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s — %s\n' "$1" "$2"; fail=$((fail+1)); }

mir() { awk '/^## Кто меня потребляет/{f=1;next} f&&/^## /{f=0} f' "$D/services/$1.md" \
        | grep -E '^[|]' | grep -vE '^[|] *(Сервис|-+)' | grep -vE '^[|] *— *[|]'; }
cnt() { mir "$1" | grep -c . ; }

echo "SM-13 / SM-14 рёбра собраны и симметричны"
for pair in auth:4 geo:2 incident-api:1; do
  s=${pair%%:*}; want=${pair##*:}; got=$(cnt "$s")
  [ "$got" = "$want" ] && ok "$s: зеркал $want" || bad "$s: зеркал $got" "ожидалось $want"
done
[ "$(cnt incident-web)" = "0" ] && ok "incident-web: зеркал нет (форма прочерка)" \
                                || bad "incident-web: зеркал $(cnt incident-web)" "его никто не вызывает"

echo "SM-37 длинная секция не обрезана: ни одной строки stale-*"
n=$(grep -c 'stale-' "$D/services/auth.md")
[ "$n" = "0" ] && ok "устаревшие 15 строк удалены" || bad "stale-* осталось $n" "секция не пересобрана целиком"

echo "SM-25 безвызовное ребро зеркалится с прочерком, обе строки"
n=$(mir auth | grep -c '`geo`')
[ "$n" = "2" ] && ok "geo → auth дало 2 строки" || bad "geo → auth дало $n" "ожидалось 2 (в «Зависит от» две строки)"
mir auth | grep '`geo`' | grep -qE '\| *(—|-) *\|' && ok "вызов в зеркале — прочерк" \
                                                   || bad "вызов у geo" "выдуман метод и путь"

echo "SM-15 зеркалить некуда — не зеркалим"
ls "$D/services/" | grep -qi 'шлюз\|gateway' && bad "карточка под API-шлюз" "создана" || ok "карточки под API-шлюз нет"

echo "SM-24 мёртвая карточка не в графе"
diff -q "$T/legacy-reports.md" "$D/services/legacy-reports.md" >/dev/null \
  && ok "legacy-reports.md байт-в-байт" || bad "legacy-reports.md" "изменена, хотя её нет в манифесте"
for s in auth geo incident-api incident-web; do
  mir "$s" | grep -q 'legacy-reports' && bad "$s" "ребро мёртвой карточки зеркалено" || true
done
ok "рёбра legacy-reports зеркал не породили"

echo "манифест не тронут"
diff -q "$T/manifest.yaml" "$D/services/manifest.yaml" >/dev/null \
  && ok "manifest.yaml байт-в-байт" || bad "manifest.yaml" "изменён"

printf '\nИТОГО %s: ok %s, FAIL %s\n' "$(basename "$D")" "$pass" "$fail"
