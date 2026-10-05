#!/usr/bin/env bash
# check.sh — счёты Шага 4 и гарда по файлам, без чтения их моделью.
#
#   bash check.sh <опись> <черновик> [<прежняя карточка>]
#   CHECK_LISTS=<файл> — туда же пишутся списки сверки целиком, без обрезки на 40 именах.
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
    /^(#|⟹|\(|>|-|```|<!--)/ || /^$/ { flush(); next }
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
        h = head; sub(/^(роль|Роль):[ ]*/, "", h); key = norm(h)   # «роль: OWNER» ↔ строка таблицы «OWNER»
      }
      facts = 0
    }
    END { flush() }
  ' "$1"
}

TMP="$(mktemp -d 2>/dev/null || echo "/tmp/check.$$")"; mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
parse_card "$DRAFT" > "$TMP/draft"
# Повтор ключа в описи — один ключ (так бывает после склейки частей): и точный, и «вызовом и без скобок».
parse_opis "$OPIS" > "$TMP/opis.raw"
awk -F'\t' '
  function bare(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
  FNR == NR { have[$1] = 1; next }
  { k = $1; b = bare(k); if (b != k && (b in have)) k = b
    if (!(k in f)) { order[++n] = k; f[k] = $2; s[k] = $3 } else if ($2 > f[k]) f[k] = $2 }
  END { for (i = 1; i <= n; i++) print order[i] "\t" f[order[i]] "\t" s[order[i]] }
' "$TMP/opis.raw" "$TMP/opis.raw" > "$TMP/opis"

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
# последней точки (роли: «UserRole.OWNER» ↔ «OWNER»). Оставшиеся без пары сводятся ещё раз — без хвоста
# параметров запроса («…/filter?field=name» ↔ «…/filter») и, у ключей контракта без HTTP-глагола, без
# хвоста-вызова («query goal(id: ID!)», «Svc.Assign(Req)» ↔ то же без скобок; скобка после пробела,
# как у роли «FOREMAN (на проект)», — не вызов). Точное совпадение
# всегда старше: «?action=list» и «?action=delete», «format(a)» и «format(a, b)» не сливаются.
# ГЕЙТ КЛЮЧЕЙ считает только разницу ключей: нет в черновике, нет в описи, один ключ дважды, ключ без
# файла-источника. Блоки «Бизнес-правил» ключами не считаются — их расхождение печатается отдельно.
echo "== СВЕРКА ОПИСЬ → ЧЕРНОВИК"
awk -F'\t' '
  function noq(k) { sub(/\?[A-Za-z_][^=?\/ ]*=.*$/, "", k); return k }
  function nop(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
  FILENAME == ARGV[1] { d[$2] = $3; cl[$2] = $1; dk[++nd] = $2; if ($1 == "потребляет") { split($2, pp, " :: "); alt[pp[2]] = $2 }; next }
  { ok[++m] = $1; fc[m] = $2 }
  END {
    for (i = 1; i <= m; i++) {
      k = ok[i]; hit = (k in d) ? k : ""
      if (hit == "" && (k in alt)) hit = alt[k]
      if (hit == "") { t = k; sub(/.*\./, "", t); if (t in d) hit = t }
      oh[i] = hit; if (hit != "") used[hit] = 1
    }
    for (j = 1; j <= nd; j++) if (!(dk[j] in used)) { q = noq(dk[j]); if (!(q in byq)) byq[q] = dk[j] }
    for (i = 1; i <= m; i++) if (oh[i] == "") { q = noq(ok[i]); if ((q in byq) && !(byq[q] in used)) { oh[i] = byq[q]; used[byq[q]] = 1 } }
    for (j = 1; j <= nd; j++) if (!(dk[j] in used) && cl[dk[j]] == "контракт") { q = nop(dk[j]); if (!(q in byp)) byp[q] = dk[j] }
    for (i = 1; i <= m; i++) if (oh[i] == "") { q = nop(ok[i]); if ((q in byp) && !(byp[q] in used)) { oh[i] = byp[q]; used[byp[q]] = 1 } }
    # один ключ контракта двумя блоками: с хвостом в скобках и без него
    for (j = 1; j <= nd; j++) { k = dk[j]; q = nop(k); if (cl[k] == "контракт" && q != k && (q in d) && cl[q] == "контракт") print "DUP\t" q " ~ " k }
    for (i = 1; i <= m; i++) {
      k = ok[i]; hit = oh[i]
      if (hit == "") { print "MISS\t" k; print "CLS\tбез пары"; continue }
      print "CLS\t" cl[hit]
      if (fc[i] > 0 && d[hit] == 0 && cl[hit] != "экраны" && cl[hit] != "роли" && cl[hit] != "зависит" && cl[hit] != "потребляет") print "EMPTY\t" k
      if (fc[i] == 0 && d[hit] == 0 && (cl[hit] == "контракт" || cl[hit] == "задачи" || cl[hit] == "топики")) print "NOFACT\t" cl[hit] ": " k
    }
    for (k in d) if (!(k in used) && cl[k] != "зависит" && cl[k] != "потребляет") print "EXTRA\t" cl[k] ": " k
  }
' "$TMP/draft.k" "$TMP/opis" > "$TMP/join"
for t in MISS EXTRA EMPTY DUP NOFACT; do grep "^$t	" "$TMP/join" | cut -f2- | sort > "$TMP/$t"; done
printf 'нет в черновике: %d' "$(wc -l < "$TMP/MISS")"; [ -s "$TMP/MISS" ] && { printf ' — '; list "$TMP/MISS"; } || echo
printf 'нет в описи: %d' "$(wc -l < "$TMP/EXTRA")"; [ -s "$TMP/EXTRA" ] && { printf ' — '; list "$TMP/EXTRA"; } || echo
printf 'факт в описи, пустой блок: %d' "$(wc -l < "$TMP/EMPTY")"; [ -s "$TMP/EMPTY" ] && { printf ' — '; list "$TMP/EMPTY"; } || echo
# Гейт ключей: только разница ключей. «Бизнес-правила» и факты в него не идут.
bm=$(grep -c -E '^(объект|сообщение|ограничение) ' "$TMP/MISS"); be=$(grep -c '^бизнес: ' "$TMP/EXTRA")
km=$(( $(wc -l < "$TMP/MISS") - bm )); ke=$(( $(wc -l < "$TMP/EXTRA") - be )); kd=$(( $(wc -l < "$TMP/DUP") + 0 )); ks=$(( $(wc -l < "$TMP/nosrc") + 0 ))
printf 'вне ключей — «Бизнес-правила»: нет в черновике %d, нет в описи %d\n' "$bm" "$be"
printf 'один ключ дважды — с хвостом в скобках и без: %d' "$kd"; [ -s "$TMP/DUP" ] && { printf ' — '; list "$TMP/DUP"; } || echo
printf 'ключи без единого факта и в описи, и в карточке: %d' "$(wc -l < "$TMP/NOFACT")"; [ -s "$TMP/NOFACT" ] && { printf ' — '; list "$TMP/NOFACT"; } || echo
if [ $(( km + ke + kd + ks )) -eq 0 ]; then echo 'ГЕЙТ КЛЮЧЕЙ: пройден'
else printf 'ГЕЙТ КЛЮЧЕЙ: НЕ ПРОЙДЕН — нет в черновике %d, нет в описи %d, дважды %d, без файла-источника %d\n' "$km" "$ke" "$kd" "$ks"; fi
if [ -n "${CHECK_LISTS:-}" ]; then
  { for t in 'MISS:нет в черновике' 'EXTRA:нет в описи' 'DUP:один ключ дважды' 'EMPTY:факт в описи, пустой блок' 'NOFACT:ключи без единого факта' 'nosrc:строки описи без файла-источника'; do
      echo "## ${t#*:}"; cat "$TMP/${t%%:*}"; echo; done; } > "$CHECK_LISTS" && echo "списки целиком: $CHECK_LISTS"
fi
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

# Кандидаты проверок Шага 4, привязанных к секциям: номер строки черновика и начало строки, до 15 на
# проверку. Это не вердикты — решает ведущий; но читать секции ему больше незачем.
MAN="$(dirname "$(dirname "$DRAFT")")/manifest.yaml"; [ -f "$MAN" ] || MAN="$(dirname "$DRAFT")/manifest.yaml"
if [ -f "$MAN" ]; then
  sed 's/\r$//' "$MAN" | awk '/^[ \t-]*name:[ \t]*/ { s = $0; sub(/^[ \t-]*name:[ \t]*/, "", s); gsub(/["'\'' \t]/, "", s); if (s != "") print s }' > "$TMP/mnames"
else : > "$TMP/mnames"; fi
echo "== КАНДИДАТЫ ПРОВЕРОК (решаешь ты; номер строки черновика)"
awk -v names="$TMP/mnames" -v man="$([ -s "$TMP/mnames" ] && echo "$MAN" || echo нет)" '
  BEGIN {
    BINMODE = 3; while ((getline n < names) > 0) have[n] = 1
    secre = ""; for (i = 0; i < 21; i++) secre = secre "[A-Za-z0-9+/=_-]"   # без {21,}: mawk его не знает
  }
  function strip(s) { gsub(/`[^`]*`/, "", s); return s }
  function codey(s,   t) {
    t = strip(s)
    return (t ~ / \/[a-z]/ || t ~ /(^|[^A-Za-z0-9_])(GET|POST|PUT|PATCH|DELETE)([^A-Za-z0-9_]|$)/ || \
            t ~ /(^|[^A-Za-z0-9_])[a-z]+[A-Z][A-Za-z]*/ || t ~ /(^|[^A-Za-z0-9_])[a-z]+\.[a-z-]+\.[a-z-]+/)
  }
  function add(k, s) { addn(k, NR, s) }
  # Обрезка по байтам (LC_ALL=C) не рвёт букву: недописанная многобайтная буква с конца снимается.
  function cut(s, n,   c, need) {
    if (length(s) <= n) return s
    s = substr(s, 1, n)
    if (match(s, /[\300-\367][\200-\277]*$/)) {
      c = substr(s, RSTART, 1); need = (c >= "\360") ? 4 : (c >= "\340") ? 3 : 2
      if (RLENGTH < need) s = substr(s, 1, RSTART - 1)
    }
    return s "…"
  }
  function addn(k, n, s) { c[k]++; if (c[k] <= 15) L[k] = L[k] sprintf("\n    %d: %s", n, cut(s, 160)) }
  function cell(s, i,   a) { split(s, a, "|"); s = a[i]; gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function show(label, k) { printf "%s: %d%s\n", label, c[k], L[k] }
  function key(h,   p) { h = substr(h, 5); gsub(/`/, "", h); p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1); return h }
  function okey(s, h,   v, r) {
    if (s ~ /^Публичный (контракт|API)/) { v = h; sub(/ .*/, "", v); if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) { r = substr(h, length(v) + 2); return r "\002" toupper(v) } }
    if (s ~ /^Бизнес-правила/) return (h ~ /^сообщение/ ? "2" : h ~ /^ограничение/ ? "3" : "1") h
    return h
  }
  { sub(/\r$/, ""); line = $0 }
  /^```/ { fence = !fence; next }
  fence { next }
  /^## / { sec = substr(line, 4); sub(/[ \t]+$/, "", sec); hdr = 0; prevk = ""; inr = 0; blk = ""; next }
  /^### / {
    if (blk != "" && !hasent) addn("noent", blkn, blk)
    blk = ""; hasent = 0
    if (sec ~ /^События/) ev++
    k = okey(sec, key(line))
    if (sec !~ /^Бизнес-правила/ && prevk != "" && k < prevk && !(sec in badord)) { badord[sec] = NR; ordn++ }
    prevk = k
    if (sec ~ /^Бизнес-правила/) {
      if (line !~ /^### (`[^`]+`|сообщение «|ограничение «)/) add("br_hdr", line)
      inr = (line ~ /^### ограничение/); if (inr) { nr++; rh[nr] = line; rn[nr] = NR }
    }
    if (sec ~ /^Публичный (контракт|API)/ && tolower(key(line)) !~ /(health|metrics|ready|live|version|docs|swagger|openapi)/) { blk = line; blkn = NR }
    next
  }
  sec ~ /^Публичный (контракт|API)/ && line ~ /^сущности:/ { hasent = 1 }
  sec ~ /^Бизнес-правила/ { if (codey(line)) add("br_code", line); if (inr) rt[nr] = rt[nr] " " line }
  sec ~ /^Назначение/ && line != "" { if (codey(line) || line ~ /`/) add("purpose", line) }
  sec ~ /^Стек/ && line ~ /[0-9]/ && line !~ /^\|[ \t:|-]*$/ { add("ver", line) }
  sec ~ /^Роли и доступ/ && line ~ /^\|/ && line !~ /^\|[ \t:|-]*$/ { r = cell(line, 2); p = index(r, " — "); if (p > 0) r = substr(r, 1, p - 1); if (r != "" && r != "—") roles[r] = 1 }
  line ~ /^\|/ {
    if (line ~ /^\|[ \t:|-]*$/) { hdr = 1; next }
    if (!hdr) next
    first = cell(line, 2)
    split(line, rc, "|"); if (sec ~ /^Что умеет/ && codey(rc[2])) add("can", line)
    if (sec ~ /^(Экраны|Роли и доступ|Зависит от|Потребляемые API)/ && first ~ /, /) add("glued", line)
    if (sec ~ /^(Зависит от|Потребляемые API)/ && first != "" && first != "—" && !(first in have) && line !~ /вне манифеста/) add("names", line)
  }
  sec ~ /^Стек/ && (tolower(line) ~ /(kafka|rabbit|nats|amqp|sqs|pubsub|pub\/sub)/ || line ~ /(Брокер|брокер|БРОКЕР)/) { broker = 1 }
  line ~ /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]*\.[a-z]+[`)]*[ \t]*$/ { add("tail", line) }
  line ~ secre { strip_l = line; gsub(/`[^`]*`/, "", strip_l); if (match(strip_l, secre "[A-Za-z0-9+/=_-]*")) { sec_n++; rs = RSTART; rl = RLENGTH; if (sec_n <= 15) secl = secl sprintf("\n    %d: %s (%d знаков)", NR, cut(substr(strip_l, rs, rl), 16), rl) } }
  END {
    if (blk != "" && !hasent) addn("noent", blkn, blk)
    for (i = 1; i <= nr; i++) {
      ok = 0; t = rh[i] " " rt[i]
      for (n in have) if (index(t, n) > 0) ok = 1
      for (n in roles) if (n != "" && index(t, n) > 0) ok = 1
      if (!ok) { c["sw"]++; if (c["sw"] <= 15) L["sw"] = L["sw"] sprintf("\n    %d: %s", rn[i], cut(rh[i], 160)) }
    }
    show("«Бизнес-правила», заголовков не по форме", "br_hdr")
    show("«Бизнес-правила», строк с кодом вне бэктиков", "br_code")
    show("«Бизнес-правила», ограничений без переключателя из манифеста или ролей", "sw")
    show("«Назначение», строк с кодом или бэктиками", "purpose")
    show("«Что умеет», колонка «Возможность», строк с кодом", "can")
    show("«Стек», строк с цифрами (версия?)", "ver")
    show("таблицы, слипшихся ячеек ключа", "glued")
    printf "«Зависит от» / «Потребляемые API», имён не из манифеста (сервис ли — решаешь ты; манифест: %s): %d%s\n", man, c["names"], L["names"]
    show("строк, кончающихся путём к файлу (хвост-файл)", "tail")
    printf "похожих на секрет строк: %d%s\n", sec_n + 0, secl
    printf "«События»: блоков %d; брокер в «Стеке»: %s\n", ev + 0, (broker ? "да" : "нет")
    show("«Публичный контракт», блоков без строки «сущности:» (служебные не считаются)", "noent")
    if (ordn == 0) print "порядок блоков: соблюдён"
    else { printf "порядок блоков нарушен:"; for (s in badord) printf " %s (строка %d);", s, badord[s]; print "" }
  }
' "$DRAFT"

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
