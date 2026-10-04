#!/usr/bin/env bash
# check.sh — счёты Шага 4 и гарда по файлам, без чтения их моделью.
#
#   bash check.sh <опись> <черновик> [<прежняя карточка>]
#
# Печатает: состав черновика по секциям; ключи описи и строки без файла-источника; сверку
# «опись → черновик» поключево (нет в черновике, нет в описи, факт в описи — пустой блок);
# при третьем аргументе — гард по классам и маршрут. Списки обрезаются на 40 именах.
# Только чтение; пишет лишь в stdout. Формат карточки — reference/card.template.md.
set -u
OPIS="${1:?опись}"; DRAFT="${2:?черновик}"; PREV="${3:-}"
for f in "$OPIS" "$DRAFT" ${PREV:+"$PREV"}; do [ -f "$f" ] || { echo "НЕТ ФАЙЛА: $f"; exit 2; }; done
export LC_ALL=C

# Разбор карточки в строки «класс<TAB>ключ<TAB>строк-тела». Классы — как в гарде SKILL.md:
# контракт, сущности, задачи, топики (блоки ###), экраны, роли, зависит, потребляет (таблицы),
# бизнес (блоки «Бизнес-правил» — в гард не идут, в сверку идут).
parse_card() {
  awk '
    function norm(s,   v) {
      gsub(/`/, "", s); gsub(/\r/, "", s)
      sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); gsub(/[ \t]+/, " ", s)
      v = s; sub(/ .*/, "", v)
      if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) s = toupper(v) substr(s, length(v) + 1)
      if (s ~ /^(сообщение|ограничение) /) { gsub(/«|»/, "", s); gsub(/[ 	]+/, " ", s); sub(/[ 	]+$/, "", s) }
      return s
    }
    function cls(sec) {
      if (sec ~ /^## Публичный (контракт|API)/) return "контракт"
      if (sec ~ /^## Владеет данными/) return "сущности"
      if (sec ~ /^## Фоновые задачи/) return "задачи"
      if (sec ~ /^## События/) return "топики"
      if (sec ~ /^## Бизнес-правила/) return "бизнес"
      if (sec ~ /^## Экраны/) return "экраны"
      if (sec ~ /^## Роли и доступ/) return "роли"
      if (sec ~ /^## Зависит от/) return "зависит"
      if (sec ~ /^## Потребляемые API/) return "потребляет"
      return ""
    }
    function flush() { if (key != "") print c "\t" key "\t" body; key = ""; body = 0 }
    { sub(/\r$/, "") }
    /^## / { flush(); sec = $0; c = cls(sec); hdr = 0; next }
    /^### / {
      flush()
      if (c == "" || c == "экраны" || c == "роли" || c == "зависит" || c == "потребляет") next
      h = substr($0, 5)
      p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1)
      key = norm(h); body = 0; next
    }
    /^- / { if (key != "") body++; next }
    /^\|/ {
      if (c != "экраны" && c != "роли" && c != "зависит" && c != "потребляет") next
      if ($0 ~ /^\|[ \t:|-]*$/) { hdr = 1; next }       # строка-разделитель |---|
      if (!hdr) next                                    # строка заголовка таблицы
      n = split($0, cell, "|")
      k = norm(cell[2]); if (c == "потребляет") k = k " :: " norm(cell[3])
      if (c == "роли") { p = index(k, " — "); if (p > 0) k = substr(k, 1, p - 1) }   # область в скобках — часть ключа
      if (k == "" || k == "—" || k == "— :: ") next
      print c "\t" k "\t0"
      next
    }
    END { flush() }
  ' "$1"
}

# Ключи описи: «ключ<TAB>фактов<TAB>есть-файл». Ключ — строка без отступа с « — » (до него);
# строки «состояние:/справочник:/сообщение:/ограничение:» дают ключи «Бизнес-правил».
parse_opis() {
  awk '
    function norm(s,   v) {
      gsub(/`/, "", s); gsub(/\r/, "", s)
      sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); gsub(/[ \t]+/, " ", s)
      v = s; sub(/ .*/, "", v)
      if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) s = toupper(v) substr(s, length(v) + 1)
      if (s ~ /^(сообщение|ограничение) /) { gsub(/«|»/, "", s); gsub(/[ 	]+/, " ", s); sub(/[ 	]+$/, "", s) }
      return s
    }
    function flush() { if (key != "") print key "\t" facts "\t" src; key = "" }
    { sub(/\r$/, "") }
    /^[ \t]+/ {                                         # второй уровень
      if (key == "") next
      t = $0; sub(/^[ \t]+/, "", t)
      if (t ~ /^·/) facts++
      next
    }
    /^(#|⟹|\(|>|-|```)/ || /^$/ { flush(); next }
    {
      flush()
      line = $0; sub(/[ \t]+$/, "", line); p = index(line, " — ")
      if (p == 0) {                                     # строка без « — »: ключ без файла-источника,
        if (line ~ /:$/) next                           # кроме подписи раздела вида «Эндпоинты:»
        head = line; rest = ""; src = 0
      } else {
        head = substr(line, 1, p - 1); rest = substr(line, p + 5)
        src = (rest ~ /[^ ]\.[A-Za-z0-9]+([ ,)(+]|$)/ || rest ~ /\//) ? 1 : 0
      }
      if (head ~ /^состояние:/) {
        h = head; sub(/^состояние:[ ]*/, "", h); sub(/[. ].*/, "", h)
        key = "объект " norm(h)
      } else if (head ~ /^справочник:/) {
        next
      } else if (head ~ /^сообщение:/) {
        h = head; sub(/^сообщение:[ ]*/, "", h); key = norm("сообщение " h)
      } else if (head ~ /^ограничение:/) {
        h = head; sub(/^ограничение:[ ]*/, "", h); key = norm("ограничение " h)
      } else {
        key = norm(head)
      }
      facts = 0
    }
    END { flush() }
  ' "$1"
}

TMP="$(mktemp -d 2>/dev/null || echo "/tmp/check.$$")"; mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
parse_card "$DRAFT" > "$TMP/draft"
parse_opis "$OPIS" | awk -F'\t' '!seen[$1]++' > "$TMP/opis"

# Ключ блока «Бизнес-правил» в карточке приводится к ключу описи: `Имя` → «объект Имя»,
# «сообщение «вид»» и «ограничение «условие»» — как есть.
awk -F'\t' 'BEGIN{OFS="\t"} $1=="бизнес" { k=$2; if (k !~ /^(сообщение|ограничение) /) k="объект " k; $2=k } {print}' \
  "$TMP/draft" > "$TMP/draft.k"

list() {  # list <файл со строками> — печать до 40 имён через «; »
  awk 'NR<=40{printf "%s%s", (NR>1?"; ":""), $0} END{if (NR>40) printf "; …и ещё %d", NR-40; print ""}' "$1"
}

echo "== ЧЕРНОВИК $(basename "$DRAFT")"
awk -F'\t' '
  { n[$1]++; if ($3 > 0) b[$1]++ }
  $1=="бизнес" { if ($2 ~ /^сообщение /) bm++; else if ($2 ~ /^ограничение /) br++; else bo++ }
  $1=="топики" { if ($2 ~ /^потребляет/) tp++; else if ($2 ~ /^публикует/) tu++ }
  END {
    split("контракт сущности задачи", L, " ")
    for (i = 1; i <= 3; i++) printf "%s %d (с телом %d, пустых %d)\n", L[i], n[L[i]], b[L[i]], n[L[i]] - b[L[i]]
    printf "топики %d (потребляет %d, публикует %d)\n", n["топики"], tp, tu
    printf "бизнес-правила: объектов %d, сообщений %d, ограничений %d\n", bo, bm, br
    printf "строк таблиц: экраны %d, роли %d, зависит от %d, потребляемые API %d\n", n["экраны"], n["роли"], n["зависит"], n["потребляет"]
  }' "$TMP/draft.k"
# Границы секций — номера строк: проверка внутри секции делается грепом с -n по всему файлу.
printf 'границы секций: '
awk 'BEGIN { BINMODE = 3 } { sub(/\r$/, "") } /^## / { if (s != "") printf "%s %d–%d; ", s, a, NR - 1; s = substr($0, 4); a = NR } END { if (s != "") printf "%s %d–%d\n", s, a, NR; else print "нет" }' "$DRAFT"
# Ключ контракта — метод и путь; у GraphQL — тип операции и имя; у gRPC — сервис и метод.
awk -F'\t' '$1 == "контракт" && $2 !~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / && $2 !~ /^(query|mutation|subscription) / && $2 !~ /^[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*$/ { print $2 }' \
  "$TMP/draft.k" > "$TMP/nometh"
printf 'ключи контракта без метода: %d' "$(wc -l < "$TMP/nometh")"; [ -s "$TMP/nometh" ] && { printf ' — '; list "$TMP/nometh"; } || echo

echo "== ОПИСЬ $(basename "$OPIS")"
awk -F'\t' '{ n++; if ($3 == 0) ns++; if ($1 ~ /^объект /) o++; else if ($1 ~ /^сообщение /) m++; else if ($1 ~ /^ограничение /) r++ }
  END { printf "ключей %d (из них строк «Бизнес-правил»: объектов %d, сообщений %d, ограничений %d)\n", n, o, m, r }' "$TMP/opis"
awk -F'\t' '$3 == 0 { print $1 }' "$TMP/opis" > "$TMP/nosrc"
printf 'строк без файла-источника: %d' "$(wc -l < "$TMP/nosrc")"; [ -s "$TMP/nosrc" ] && { printf ' — '; list "$TMP/nosrc"; } || echo
echo "итоги описи:"; grep -E '^⟹' "$OPIS" | sed 's/\r$//; s/^/  /'

# Сверка поключево. Ключ описи найден, если совпал с ключом черновика целиком или своим хвостом после
# последней точки (роли: «UserRole.OWNER» ↔ «OWNER»).
echo "== СВЕРКА ОПИСЬ → ЧЕРНОВИК"
awk -F'\t' '
  FILENAME == ARGV[1] { d[$2] = $3; cl[$2] = $1; if ($1 == "потребляет") { split($2, pp, " :: "); alt[pp[2]] = $2 }; next }
  {
    k = $1; hit = (k in d) ? k : ""
    if (hit == "" && (k in alt)) hit = alt[k]
    if (hit == "") { t = k; sub(/.*\./, "", t); if (t in d) hit = t }
    if (hit == "") { print "MISS\t" k; print "CLS\tбез пары"; next }
    used[hit] = 1; print "CLS\t" cl[hit]
    if ($2 > 0 && d[hit] == 0 && cl[hit] != "экраны" && cl[hit] != "роли" && cl[hit] != "зависит" && cl[hit] != "потребляет") print "EMPTY\t" k
  }
  END { for (k in d) if (!(k in used) && cl[k] != "зависит" && cl[k] != "потребляет") print "EXTRA\t" cl[k] ": " k }
' "$TMP/draft.k" "$TMP/opis" > "$TMP/join"
for t in MISS EXTRA EMPTY; do grep "^$t	" "$TMP/join" | cut -f2- | sort > "$TMP/$t"; done
printf 'нет в черновике: %d' "$(wc -l < "$TMP/MISS")"; [ -s "$TMP/MISS" ] && { printf ' — '; list "$TMP/MISS"; } || echo
printf 'нет в описи: %d' "$(wc -l < "$TMP/EXTRA")"; [ -s "$TMP/EXTRA" ] && { printf ' — '; list "$TMP/EXTRA"; } || echo
printf 'факт в описи, пустой блок: %d' "$(wc -l < "$TMP/EMPTY")"; [ -s "$TMP/EMPTY" ] && { printf ' — '; list "$TMP/EMPTY"; } || echo
printf 'опись по классам (класс — по паре в черновике): '
grep "^CLS	" "$TMP/join" | cut -f2 | sort | uniq -c | awk '{n=$1; $1=""; sub(/^ /,""); printf "%s%s %d", (NR>1?", ":""), $0, n} END{print ""}'

# Группы для «Полноты возможностей»: HTTP — по первым двум сегментам пути (параметр сегментом не
# считается), GraphQL и gRPC — по ключу целиком; каждая фоновая задача и каждый потребляемый топик —
# своя группа.
awk -F'\t' '
  $1 == "контракт" { k = $2; sub(/^[A-Z]+ /, "", k)
    if (k ~ /^\//) { n = split(k, s, "/"); g = "/" s[2]; if (n > 2 && s[3] !~ /^[:{]/) g = g "/" s[3]; gc[g]++ } else gc[$2]++ }
  $1 == "задачи" { gc["задача " $2]++ }
  $1 == "топики" && $2 ~ /^потребляет/ { gc[$2]++ }
  END { for (g in gc) print g " (" gc[g] ")" }' "$TMP/draft.k" | sort > "$TMP/groups"
printf 'группы черновика для «Что умеет» (%d): ' "$(wc -l < "$TMP/groups")"; list "$TMP/groups"

[ -n "$PREV" ] || exit 0

echo "== ГАРД (прежняя $(basename "$PREV"))"
parse_card "$PREV" > "$TMP/prev"
ROUTE=ПОВЕРХ
for c in контракт сущности задачи топики экраны потребляет роли зависит; do
  awk -F'\t' -v c="$c" '$1==c {print $2 "\t" $3}' "$TMP/prev" | sort -u -t'	' -k1,1 > "$TMP/p.$c"
  awk -F'\t' -v c="$c" '$1==c {print $2 "\t" $3}' "$TMP/draft" | sort -u -t'	' -k1,1 > "$TMP/d.$c"
  was=$(wc -l < "$TMP/p.$c"); [ "$was" -eq 0 ] && [ ! -s "$TMP/d.$c" ] && continue
  cut -f1 "$TMP/p.$c" > "$TMP/pk"; cut -f1 "$TMP/d.$c" > "$TMP/dk"
  comm -23 "$TMP/pk" "$TMP/dk" > "$TMP/gone"; comm -13 "$TMP/pk" "$TMP/dk" > "$TMP/new"
  join -t'	' "$TMP/p.$c" "$TMP/d.$c" | awk -F'\t' '$2 > 0 && $3 == 0 {print $1}' > "$TMP/emptied"
  g=$(wc -l < "$TMP/gone"); a=$(wc -l < "$TMP/new"); e=$(wc -l < "$TMP/emptied")
  name=$c; [ "$c" = зависит ] && name="зависит от"; [ "$c" = потребляет ] && name="потребляемые API"
  printf '%s: было %d, исчезло %d, появилось %d, опустело %d\n' "$name" "$was" "$g" "$a" "$e"
  [ "$g" -gt 0 ] && { printf '  исчезли: '; list "$TMP/gone"; }
  [ "$e" -gt 0 ] && { printf '  опустели: '; list "$TMP/emptied"; }
  [ "$a" -gt 0 ] && [ "$g" -gt 0 ] && { printf '  появились: '; list "$TMP/new"; }
  if { [ "$g" -ge 3 ] && [ $((3 * g)) -gt "$was" ]; } || { [ "$e" -ge 3 ] && [ $((3 * e)) -gt "$was" ]; }; then
    ROUTE="В _pending"; echo "  ⇒ правило маршрута сработало на классе «$name»"
  fi
done
echo "МАРШРУТ: $ROUTE"
