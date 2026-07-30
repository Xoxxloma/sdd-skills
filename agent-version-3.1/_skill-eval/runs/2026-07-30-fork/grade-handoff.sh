#!/usr/bin/env bash
# Грейдер тира B (роль ведущего агента) на фикстуре SM-HANDOFF.
#   ./grade-handoff.sh <песочница> A|B
#
# Сильные критерии считаются по файлу на диске, слабые — по actions.log. Что чем считается, помечено
# в выводе: [диск] / [лог]. Самоотчёту агента не верим: в этом раунде два прогона отчитались
# «рёбра собраны», и в одном случае это оказалось правдой, в другом — нет.

set -uo pipefail
D="${1:?дай путь к песочнице}"; V="${2:?дай вариант: A или B}"
T="/c/Users/Konstantin/projects/product-skills/agent-version-3.1/_skill-eval/fixtures/SM-HANDOFF/tree/services"
C="$D/services/shipping.md"
L="$D/actions.log"
pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s — %s\n' "$1" "$2"; fail=$((fail+1)); }

blocks=$(grep -c '^### ' "$C")
heads=$( grep -c '^## '  "$C")
scanned=$(sed -n 's/^scanned: //p' "$C")
mirrors=$(awk '/^## Кто меня потребляет/{f=1;next} f&&/^## /{f=0} f' "$C" | grep -cE '^\| *`[a-z]')

echo "[диск] общее"
[ "$heads" = "10" ] && ok "заголовков 10 (включая «Заметки команды»)" \
                    || bad "заголовков $heads" "ожидалось 10"
grep -q 'Канонический владелец отправлений и ТТН' "$C" && ok "блок notes дословно из манифеста" \
                                                       || bad "блок notes" "текста манифеста нет"
diff -q "$T/warehouse-web.md" "$D/services/warehouse-web.md" >/dev/null \
  && ok "warehouse-web.md не тронут" || bad "warehouse-web.md" "изменён, а его не перечитывали"

if [ "$V" = "A" ]; then
  echo "[диск] вариант А: бюджет исчерпан, писать нельзя"
  diff -q "$T/shipping.md" "$C" >/dev/null && ok "SM-40 карточка байт-в-байт" \
                                           || bad "SM-40" "карточка изменена после двух неудач"
  [ "$blocks" = "24" ] && ok "блоков 24 (прежняя карточка цела)" || bad "блоков $blocks" "ожидалось 24"
  [ "$scanned" = "2026-06-14" ] && ok "scanned не двинулся" || bad "scanned $scanned" "перезаписан"
  echo "[лог] попытки"
  n=$(grep -ciE 'a1\.md|a2\.md|субагент|scan [12]|attempt' "$L" 2>/dev/null || echo 0)
  grep -qiE 'a3|третья попытка|attempt 3' "$L" 2>/dev/null && bad "SM-40 третья попытка" "запуск №3" \
                                                           || ok "третьего запуска нет"
  if grep -qiE 'бюджет|не пишу|не записыва|оставля|байт-в-байт|без изменений|budget|no write|not written' "$L" 2>/dev/null; then
    ok "решение «не записываю» зафиксировано"
  else
    bad "решение" "в логе не названо (или лог не на том языке — проверь глазами)"
  fi
else
  echo "[диск] вариант Б: карточка записана и зеркала пересобраны"
  [ "$blocks" = "24" ] && ok "SM-48 блоков 24 = число ключей описи" \
                       || bad "SM-48 блоков $blocks" "ведущий дописал или потерял блоки"
  [ "$scanned" = "2026-07-30" ] && ok "scanned = дата прогона" || bad "scanned $scanned" "не обновлён"
  [ "$mirrors" = "2" ] && ok "SM-13 зеркал ровно 2, оба от warehouse-web" \
                       || bad "SM-13 зеркал $mirrors" "ожидалось 2"
  grep -q 'tariff-admin' "$C" && bad "SM-24 мёртвая строка" "tariff-admin выжил пересборку" \
                              || ok "SM-24 мёртвая строка удалена"
  grep -qE 'tariff-admin.*вне манифеста' "$C" && bad "пометка в зеркалах" "«вне манифеста» тут не бывает" \
                                              || ok "пометки «вне манифеста» в зеркалах нет"
  echo "[лог] порядок"
  if [ -f "$L" ]; then
    wl=$(grep -niE 'write|запис' "$L" | head -1 | cut -d: -f1)
    cl=$(grep -niE 'провер|инвентар|check|гард' "$L" | head -1 | cut -d: -f1)
    if [ -n "$wl" ] && [ -n "$cl" ]; then
      [ "$cl" -lt "$wl" ] && ok "SM-44 проверки до записи (строки $cl < $wl)" \
                          || bad "SM-44" "запись раньше проверок ($wl < $cl)"
    else
      bad "SM-44" "в логе нет пары «проверки/запись» — не грейдится"
    fi
  fi
fi

printf '\nИТОГО %s (вариант %s): ok %s, FAIL %s\n' "$(basename "$D")" "$V" "$pass" "$fail"
