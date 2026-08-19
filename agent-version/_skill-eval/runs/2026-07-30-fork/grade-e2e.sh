#!/usr/bin/env bash
# Грейдер SM-E2E: сквозной прогон, обе роли живые. Считается по файлу на диске.
#   ./grade-e2e.sh <песочница>
# Содержательная часть карточки грейдится тем же grade-neutral.sh: инвентарь у фикстуры тот же.
set -uo pipefail
D="${1:?дай путь к песочнице}"
S="$D/specs/services"
C="$S/shipping.md"
HERE="$(dirname "$0")"
pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s — %s\n' "$1" "$2"; fail=$((fail+1)); }

echo "стык: карточка вообще записана"
[ -f "$C" ] || { bad "services/shipping.md" "не создана — прогон не дошёл до записи"; printf '\nИТОГО %s: ok %s, FAIL %s\n' "$(basename "$D")" "$pass" "$fail"; exit 0; }
ok "services/shipping.md на диске"

echo "лишних файлов в services/ нет"
extra=$(ls "$S" | grep -v '^manifest.yaml$' | grep -v '^shipping.md$' | tr '\n' ' ')
[ -z "$extra" ] && ok "только манифест и shipping.md" || bad "лишние файлы: $extra" "прогон писал не туда"

echo "шапка"
grep -q '^service: shipping' "$C" && ok "service" || bad "service" "нет во фронтматтере"
grep -q '^type: backend'     "$C" && ok "type"    || bad "type" "нет или не backend"
grep -q '^repo: \.\./shipping-api' "$C" && ok "repo относительный" || bad "repo" "нет или абсолютный"
grep -q '^scanned: 2026-07-30' "$C" && ok "scanned = дата прогона" || bad "scanned" "не дата прогона: $(sed -n 's/^scanned: //p' "$C")"
[ "$(grep -c '^description:' "$C")" = "1" ] && ok "description одной строкой" || bad "description" "нет или не одна"

echo "«Заметки команды» вставил ведущий, дословно из notes"
n=$(grep -c '^## Заметки команды' "$C")
[ "$n" = "1" ] && ok "блок ровно один" || bad "блоков notes: $n" "ожидался ровно один"
grep -q 'Канонический владелец отправлений и ТТН' "$C" && ok "первая строка notes дословно" || bad "notes" "текста манифеста нет"
grep -q 'billing-legacy, мигрируем в 2027' "$C" && ok "вторая строка notes дословно" || bad "notes" "вторая строка потеряна"

echo "«Кто меня потребляет»: зеркалить не от чего — карточки warehouse-web в слепке нет"
mir=$(awk '/^## Кто меня потребляет/{f=1;next} f&&/^## /{f=0} f' "$C" | grep -cE '^[|] *`?[a-z]')
[ "$mir" = "0" ] && ok "секция пустой формой" || bad "зеркал $mir" "источника нет — выдумано"

echo "манифест не тронут"
grep -q 'name: shipping' "$S/manifest.yaml" && ok "манифест на месте" || bad "манифест" "испорчен"

echo "чужой репозиторий не изменён"
if [ -d "$D/shipping-api" ]; then
  n=$(find "$D/shipping-api" -newermt '2026-07-30 19:40' -type f | grep -v '/\.git/' | wc -l)
  [ "$n" = "0" ] && ok "в ../shipping-api ничего не записано" || bad "файлов изменено: $n" "скилл только читает"
fi

printf '\nИТОГО %s: ok %s, FAIL %s\n' "$(basename "$D")" "$pass" "$fail"
echo "--- содержание карточки (тот же грейдер, что у тира A) ---"
bash "$HERE/grade-neutral.sh" "$C" | tail -1
