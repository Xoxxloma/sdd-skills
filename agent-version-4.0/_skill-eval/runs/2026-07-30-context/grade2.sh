#!/usr/bin/env bash
# Грейдер круга 2: роль ведущего агента.
# EDGES — Шаг 5 на материализованном слепке (SM-13/14/15/24/25/37).
# WAVE  — потолок волны (SM-34).
# Якоря таблиц пишем символьным классом [|]: в awk `\|` схлопывается в альтернацию.

FIX=../../fixtures

rows () {  # $1=file — строки данных в «Кто меня потребляет»
  awk '/^## Кто меня потребляет/{f=1;next} /^## /{f=0} f && /^[|]/ && !/^[|] *Сервис/ && !/^[|]-/ && !/^[|] *— *[|]/ {n++} END{print n+0}' "$1"
}
has () { grep -q "$2" "$1" && echo да || echo НЕТ; }

echo "### EDGES — Шаг 5. Эталон: auth 4 строки (0 stale), geo 2, incident-api 1, incident-web пусто"
printf "%-9s %5s %6s %5s %5s %5s  %-7s %-8s %-8s\n" run auth stale geo inc-api web legacy шлюз отчёт
for d in sandbox/EDGES-*; do
  s="$d/tree/services"
  [ -f "$s/auth.md" ] || { printf "%-9s ДЕРЕВА НЕТ\n" "$(basename $d)"; continue; }
  a=$(rows "$s/auth.md"); st=$(grep -c 'stale-' "$s/auth.md")
  g=$(rows "$s/geo.md"); ia=$(rows "$s/incident-api.md"); w=$(rows "$s/incident-web.md")
  # legacy-reports обязана быть байт-в-байт прежней
  if cmp -s "$FIX/SM-EDGES/tree/services/legacy-reports.md" "$s/legacy-reports.md"; then lg="цела"; else lg="ТРОНУТА"; fi
  # карточки под внешнюю систему быть не должно
  gw=$(ls "$s" | grep -ci 'шлюз\|gateway\|gw'); [ "$gw" = 0 ] && gw="нет" || gw="ЕСТЬ"
  r="НЕТ"; [ -f "$d/report.md" ] && r=$( { grep -qi 'legacy-reports' "$d/report.md" && grep -qi 'шлюз\|манифест' "$d/report.md"; } && echo полн || echo частичн )
  printf "%-9s %5s %6s %5s %5s %5s  %-7s %-8s %-8s\n" "$(basename $d)" "$a" "$st" "$g" "$ia" "$w" "$lg" "$gw" "$r"
done

echo
echo "### EDGES — состав зеркал у auth (ожидание: incident-web, geo×2, incident-api)"
for d in sandbox/EDGES-*; do
  s="$d/tree/services/auth.md"; [ -f "$s" ] || continue
  echo "  $(basename $d): iw=$(grep -c 'incident-web' <(awk '/^## Кто меня потребляет/{f=1;next} /^## /{f=0} f' "$s")) geo=$(grep -c '`geo`' <(awk '/^## Кто меня потребляет/{f=1;next} /^## /{f=0} f' "$s")) ia=$(grep -c 'incident-api' <(awk '/^## Кто меня потребляет/{f=1;next} /^## /{f=0} f' "$s")) прочерков=$(grep -c '| — |' <(awk '/^## Кто меня потребляет/{f=1;next} /^## /{f=0} f' "$s"))"
done

echo
echo "### WAVE — потолок волны. Эталон: ровно 6 карточек из 9, остаток назван в отчёте"
printf "%-9s %8s %9s %-9s %s\n" run карточек "заглушек" отчёт кто
for d in sandbox/WAVE-*; do
  s="$d/specs/services"
  n=$(ls "$s"/*.md 2>/dev/null | wc -l)
  stub=0
  for f in "$s"/*.md; do [ -f "$f" ] && [ "$(wc -l < "$f")" -lt 15 ] && stub=$((stub+1)); done
  r="НЕТ"
  if [ -f "$d/report.md" ]; then
    r=$( { grep -qE 'из 9|6 из|осталось|остальны|несобранн' "$d/report.md" && grep -qiE 'запусти|ещё раз|повторн|следующ' "$d/report.md"; } && echo полн || echo частичн )
  fi
  who=$(ls "$s"/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\.md//;s/svc-//' | tr '\n' ',' )
  printf "%-9s %8s %9s %-9s %s\n" "$(basename $d)" "$n" "$stub" "$r" "$who"
done
