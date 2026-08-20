#!/usr/bin/env bash
# Грейдер круга 1 раунда «контекст ведущего агента».
# Считает по файлам на диске; самоотчёты агентов не учитываются.
# Запускать из runs/2026-07-30-context/.
#
# ВАЖНО про якорь таблиц: в awk-регексе `\|` схлопывается в альтернацию `|`,
# и `/^\|/` начинает матчить КАЖДУЮ строку. Из-за этого первая редакция грейдера
# дала 16 топиков вместо 12. Пишем `[|]` — символьным классом, а не escape.

SECRET='8Hq2LmX9pR4tVzKw1NcBd7YsAe3GfUj0'
VERS='React 18\|Router 6\|MUI 5\|chi v5\|go 1\.22\|pgx v5\|v5\.0\.12\|kafka-go v0\|18\.3\|6\.26'

blocks () { awk -v s="$2" '$0 ~ s {f=1;next} /^## /{f=0} f && /^### /{n++} END{print n+0}' "$1"; }
echoline () { [ -f "$1" ] && head -1 "$1" | grep -qi 'бриф прочитан' && echo да || echo НЕТ; }

echo "### SM-BULK — эталон 48 / 12 / 9 / 7"
printf "%-9s %5s %5s %5s %5s  %-4s %-5s %5s %6s %5s\n" run эндп топик сущн роли эхо опись верс секрет CRUD
for d in sandbox/BULK-*; do
  h="$d/head.md"; c="$d/card.md"
  [ -f "$c" ] || { printf "%-9s КАРТОЧКИ НЕТ\n" "$(basename $d)"; continue; }
  ep=$(blocks "$c" '^## Публичный контракт')
  en=$(blocks "$c" '^## Владеет данными')
  tp=$(awk '/^## События/{f=1;next} /^## /{f=0} f && /^[|] *(публикует|потребляет)/{n++} END{print n+0}' "$c")
  rl=$(awk '/^## Роли и доступ/{f=1;next} /^## /{f=0} f && /^[|]/ && !/^[|] *Роль/ && !/^[|]-/ && !/^[|] *— *[|]/{n++} END{print n+0}' "$c")
  inv=$( [ -f "$h" ] && [ "$(wc -l < "$h")" -gt 5 ] && echo да || echo НЕТ )
  printf "%-9s %5s %5s %5s %5s  %-4s %-5s %5s %6s %5s\n" "$(basename $d)" "$ep" "$tp" "$en" "$rl" \
    "$(echoline "$h")" "$inv" "$(grep -c "$VERS" "$c")" "$(grep -c "$SECRET" "$c")" "$(grep -ci CRUD "$c")"
done

echo
echo "### SM-FRONT — ветвление формы (SM-3), версии (SM-6)"
printf "%-9s %6s %7s %8s %9s  %-4s %5s\n" run экраны потребл состоян "чужие секции" эхо верс
for d in sandbox/FRONT-*; do
  c="$d/card.md"; h="$d/head.md"
  [ -f "$c" ] || { printf "%-9s КАРТОЧКИ НЕТ\n" "$(basename $d)"; continue; }
  bad=$(( $(grep -c '^## Публичный контракт' "$c") + $(grep -c '^## Владеет данными' "$c") ))
  printf "%-9s %6s %7s %8s %9s  %-4s %5s\n" "$(basename $d)" \
    "$(grep -c '^## Экраны' "$c")" "$(grep -c '^## Потребляемые API' "$c")" \
    "$(grep -c '^## Состояние и данные' "$c")" "$bad" "$(echoline "$h")" "$(grep -c "$VERS" "$c")"
done

echo
echo "### SM-10 — скелет секций одинаков между прогонами"
for d in sandbox/FRONT-* sandbox/BULK-*; do
  [ -f "$d/card.md" ] || continue
  echo "$(basename $d | sed 's/-[0-9]*$//') $(grep '^## ' "$d/card.md" | tr -d '\n' | tr '#' ' ')"
done | sort | uniq -c

echo
echo "### SM-31 — тонкий скан поверх толстой карточки (эталон тонкого чтения: 18 / 3)"
for d in sandbox/THIN-*; do
  h="$d/head.md"; c="$d/card.md"
  [ -f "$c" ] || { printf "%-9s КАРТОЧКИ НЕТ\n" "$(basename $d)"; continue; }
  printf "%-9s гард=%-4s эхо=%-4s контракт=%-3s сущностей=%s\n" "$(basename $d)" \
    "$(grep -qi 'ГАРД' "$h" && echo да || echo НЕТ)" "$(echoline "$h")" \
    "$(blocks "$c" '^## Публичный контракт')" "$(blocks "$c" '^## Владеет данными')"
done

echo
echo "### SM-11 — имя из манифеста (geo), а не из кода (geo-service)"
grep -l 'geo-service' sandbox/*/card.md 2>/dev/null || echo "  промахов нет"
