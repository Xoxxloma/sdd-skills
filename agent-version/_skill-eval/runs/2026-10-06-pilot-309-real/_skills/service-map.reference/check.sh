#!/usr/bin/env bash
# check.sh — счёты Шага 4 и гарда по файлам, без чтения их моделью.
#
#   bash check.sh <опись> <черновик> [<прежняя карточка>]
#   CHECK_LISTS=<файл> — туда пишется перечень добора целиком, без обрезки на 40 именах.
#   CHECK_PLAN=<plan.tsv> — файл плана от plan.sh (пятый аргумент): вердикт маркерного гейта и сверка
#     «пометки файла ↔ ключи описи».
#   CHECK_PARTS=<папка частей> — нарезанный сервис: гейт ещё и по каждой части, перечень добора по авторам.
#   CHECK_PREFIX=<префикс> — общий префикс пути от разведчика: ключи REST без него — в перечень добора.
#
# Печатает: состав черновика по секциям и ключи карточки по классам (для маркерного гейта); ключи
# описи и строки без файла-источника; сверку «опись → черновик» поключево — справку и перечень
# добора, запись карточки она не останавливает; при третьем аргументе — гард по классам и маршрут.
# Списки в выводе обрезаются на 40 именах.
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
title() {  # title <вид пункта перечня добора> — заголовок раздела перечня
  case "$1" in
    ADD) echo 'ключ описи с источником — блока в карточке нет' ;;
    NOSRC) echo 'блок в карточке есть, у ключа описи нет файла-источника — назвать файл либо убрать ключ из обоих файлов' ;;
    EMPTY) echo 'факт в описи — блок пуст' ;;
    DUP) echo 'один ключ двумя блоками' ;;
    nometh) echo 'ключ контракта без метода' ;;
    NOPFX) echo 'ключ REST без общего префикса — поправь путь; вне префикса — только с источником, где ручка зарегистрирована' ;;
    MARKFILE) echo 'в файле пометок больше, чем ключей описи с этим источником — найди недостающие ключи в файле' ;;
  esac
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
# Ключи карточки по классам — число для маркерного гейта, мимо описи. Повтор ключа не считается;
# ключ контракта вызовом («query task(id)») при том же ключе без скобок — тот же ключ, а перегрузки
# с разными аргументами без голого ключа — разные.
count_keys() {  # count_keys <разбор карточки> → строки «класс<TAB>число»
  awk -F'\t' '
    function nop(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
    $1 ~ /^(контракт|сущности|задачи|топики|экраны)$/ { cl[++m] = $1; ky[m] = $2; have[$1 SUBSEP $2] = 1 }
    END {
      for (i = 1; i <= m; i++) {
        k = ky[i]; if (cl[i] == "контракт" && nop(k) != k && ((cl[i] SUBSEP nop(k)) in have)) continue
        if ((cl[i] SUBSEP k) in seen) continue
        seen[cl[i] SUBSEP k] = 1; n[cl[i]]++
      }
      split("контракт сущности задачи топики экраны", L, " ")
      for (i = 1; i <= 5; i++) print L[i] "\t" n[L[i]] + 0
    }' "$1"
}
count_keys "$TMP/draft.k" > "$TMP/cardn"
awk -F'\t' '{ printf "%s%s %d", (NR > 1 ? ", " : "ключи карточки по классам: "), $1, $2 } END { print "" }' "$TMP/cardn"
# Папка частей (нарезанный сервис): ключи карточки каждой части — для её маркерного гейта; кто автор
# блока и ключа описи — для перечня добора по авторам. Голова — автор своих секций.
: > "$TMP/partn"; : > "$TMP/own.card"; : > "$TMP/own.opis"
if [ -n "${CHECK_PARTS:-}" ]; then
  [ -d "$CHECK_PARTS" ] || { echo "НЕТ ПАПКИ ЧАСТЕЙ: $CHECK_PARTS"; exit 2; }
  for f in "$CHECK_PARTS"/part-*.md "$CHECK_PARTS"/head.md; do
    case "$f" in *.opis.md) continue ;; esac
    [ -f "$f" ] || continue
    a=$(basename "$f" .md); a=${a#part-}; [ "$a" = head ] && a=голова
    parse_card "$f" | awk -F'\t' 'BEGIN{OFS="\t"} $1=="бизнес" { k=$2; if (k !~ /^(сообщение|ограничение) /) k="объект " k; $2=k } {print}' > "$TMP/pc"
    awk -F'\t' -v a="$a" '{ print $2 "\t" a }' "$TMP/pc" >> "$TMP/own.card"
    [ "$a" = голова ] || count_keys "$TMP/pc" | awk -v a="$a" '{ print a "\t" $0 }' >> "$TMP/partn"
    o="${f%.md}.opis.md"
    [ -f "$o" ] && parse_opis "$o" | awk -F'\t' -v a="$a" '{ print $1 "\t" a }' >> "$TMP/own.opis"
  done
fi
# Границы секций — номера строк: проверка внутри секции делается грепом с -n по всему файлу.
printf 'границы секций: '
awk 'BEGIN { BINMODE = 3 } { sub(/\r$/, "") } /^## / { if (s != "") printf "%s %d–%d; ", s, a, NR - 1; s = substr($0, 4); a = NR } END { if (s != "") printf "%s %d–%d\n", s, a, NR; else print "нет" }' "$DRAFT"
# Ключ контракта — метод и путь; у GraphQL — тип операции и имя; у gRPC — сервис и метод.
awk -F'\t' '$1 == "контракт" && $2 !~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / && $2 !~ /^(query|mutation|subscription) / && $2 !~ /^[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*$/ { print $2 }' \
  "$TMP/draft.k" > "$TMP/nometh"
printf 'ключи контракта без метода: %d' "$(wc -l < "$TMP/nometh")"; [ -s "$TMP/nometh" ] && { printf ' — '; list "$TMP/nometh"; } || echo
# Общий префикс от разведчика стоит в каждом пути ключа REST; ключ без него — форма записи либо ручка
# вне префикса, и тогда это видно по коду регистрации. Решает читающий по источнику, а не ты.
: > "$TMP/NOPFX"
PFX="${CHECK_PREFIX:-}"; PFX="${PFX%/}"
if [ -n "$PFX" ]; then
  awk -F'\t' -v p="$PFX" '$1 == "контракт" && $2 ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / { s = $2; sub(/^[A-Z]+ /, "", s); if (s != p && index(s, p "/") != 1) print $2 }' \
    "$TMP/draft.k" | sort -u > "$TMP/NOPFX"
  printf 'ключи REST без общего префикса %s: %d' "$PFX" "$(wc -l < "$TMP/NOPFX")"; [ -s "$TMP/NOPFX" ] && { printf ' — '; list "$TMP/NOPFX"; } || echo
fi

echo "== ОПИСЬ $(basename "$OPIS")"
awk -F'\t' '{ n++; if ($3 == 0) ns++; if ($1 ~ /^объект /) o++; else if ($1 ~ /^сообщение /) m++; else if ($1 ~ /^ограничение /) r++ }
  END { printf "ключей %d (из них строк «Бизнес-правил»: объектов %d, сообщений %d, ограничений %d)\n", n, o, m, r }' "$TMP/opis"
awk -F'\t' '$3 == 0 { print $1 }' "$TMP/opis" > "$TMP/nosrc"
printf 'строк без файла-источника: %d' "$(wc -l < "$TMP/nosrc")"; [ -s "$TMP/nosrc" ] && { printf ' — '; list "$TMP/nosrc"; } || echo
echo "итоги описи:"; grep -E '^⟹' "$OPIS" | sed 's/\r$//; s/^/  /'

# Маркеры по плану: вердикт гейта — ключи карточки против пометок `ключ` по сервису, а с папкой частей и
# по каждой части; сверка по файлам — сколько ключей описи ссылается на файл с пометками (путь описи
# сравнивается с путём плана по хвосту). Ключей в описи меньше пометок файла — добор той части, которой
# файл отдан; запись это не останавливает. Итог гейта уходит в «ИСХОД».
: > "$TMP/MARKFILE"; : > "$TMP/markgate"
if [ -n "${CHECK_PLAN:-}" ]; then
  echo "== МАРКЕРЫ по $(basename "$CHECK_PLAN")"
  if [ ! -s "$CHECK_PLAN" ]; then echo "плана нет или он пуст — вердикта маркеров нет"
  else
    awk -F'\t' -v cardn="$TMP/cardn" -v partn="$TMP/partn" -v parts="${CHECK_PARTS:+1}" -v deff="$TMP/MARKFILE" -v gatef="$TMP/markgate" '
      BEGIN {
        while ((getline l < cardn) > 0) { split(l, a, "\t"); card[a[1]] = a[2] + 0 }
        while ((getline l < partn) > 0) { split(l, a, "\t"); pcard[a[1], a[2]] = a[3] + 0; haspart[a[1]] = 1 }
      }
      function verdict(who, gw, c, g, e) {
        if (2 * g < e) { printf "маркеры %s%s: в карточке %d, пометок %d — НЕ ПРОЙДЕН: меньше половины\n", who, c, g, e; bad = bad (bad == "" ? "" : "; ") gw c " " g " из " e }
        else if (g > 2 * e) printf "маркеры %s%s: в карточке %d, пометок %d — пройден; маркер видит %d из %d по карточке — внешней сверки по классу нет\n", who, c, g, e, e, g
        else printf "маркеры %s%s: в карточке %d, пометок %d — пройден\n", who, c, g, e
      }
      FILENAME == ARGV[1] {
        sub(/\r$/, "")
        if ($1 == "итог") { if (!($2 in want)) cls[++nc] = $2; want[$2] += $3 }
        if ($1 == "часть") { if (!(($2, $3) in pwant)) pl[++np] = $2 SUBSEP $3; pwant[$2, $3] += $4 }
        if ($1 == "файл") { if (!($2 in fn)) { fo[++nf] = $2; own[$2] = $5 }; fn[$2] += $4 }
        next
      }
      { sub(/\r$/, "") }
      /^[ \t]/ || /^(#|⟹|\(|>|-|```|<!--)/ || /^$/ { next }
      {
        p = index($0, " — "); if (p == 0) next
        rest = substr($0, p + 5); gsub(/[+,;]/, " ", rest); n = split(rest, w, " ")
        delete seen
        for (i = 1; i <= n; i++) {
          t = w[i]; gsub(/[`()]/, "", t); gsub(/\\/, "/", t); sub(/^\.\//, "", t)
          if (t !~ /\// && t !~ /\.[A-Za-z0-9]+$/) continue
          if (!(t in seen)) { seen[t] = 1; tok[t]++ }
        }
      }
      END {
        for (i = 1; i <= nc; i++) {
          c = cls[i]
          if (!(c in card)) { printf "маркеры %s: в карточке такого класса нет — сверки нет\n", c; continue }
          verdict("", "", c, card[c], want[c])
        }
        if (parts) for (i = 1; i <= np; i++) {
          split(pl[i], q, SUBSEP); nn = q[1]; c = q[2]
          if (!(nn in haspart)) { printf "маркеры части %s, %s: файла части нет — сверки нет\n", nn, c; continue }
          if (!((nn, c) in pcard)) { printf "маркеры части %s, %s: в карточке такого класса нет — сверки нет\n", nn, c; continue }
          verdict("части " nn ", ", "часть " nn ", ", c, pcard[nn, c], pwant[nn, c])
        }
        gate = (nc == 0 && !(parts && np)) ? "пометок-ключей в плане нет — гейта нет" : (bad == "" ? "пройден" : "НЕ ПРОЙДЕН — " bad)
        print "МАРКЕРНЫЙ ГЕЙТ: " gate; print gate > gatef
        nd = 0
        for (i = 1; i <= nf; i++) {
          f = fo[i]; m = 0
          for (t in tok) if (f == t || (length(f) > length(t) && substr(f, length(f) - length(t)) == "/" t)) m += tok[t]
          if (m < fn[f]) { nd++; line[nd] = f " (часть " own[f] "): пометок " fn[f] ", ключей " m; print line[nd] > deff }
        }
        printf "по файлам: файлов с пометками %d, ключей в описи меньше пометок — %d\n", nf, nd
        for (i = 1; i <= nd && i <= 15; i++) print "    " line[i]
        if (nd > 15) printf "    …и ещё %d\n", nd - 15
      }
' "$CHECK_PLAN" "$OPIS"
  fi
fi

# Сверка поключево. Ключ описи найден, если совпал с ключом черновика целиком или своим хвостом после
# последней точки (роли: «UserRole.OWNER» ↔ «OWNER»). Оставшиеся без пары сводятся ещё раз — без хвоста
# параметров запроса («…/filter?field=name» ↔ «…/filter») и, у ключей контракта без HTTP-глагола, без
# хвоста-вызова («query goal(id: ID!)», «Svc.Assign(Req)» ↔ то же без скобок; скобка после пробела,
# как у роли «FOREMAN (на проект)», — не вызов). Точное совпадение
# всегда старше: «?action=list» и «?action=delete», «format(a)» и «format(a, b)» не сливаются.
# Сверка запись не останавливает: опись пишет тот же субагент, и её расхождение с карточкой — чаще
# форма записи, чем пропуск в коде. В перечень добора идёт то, что можно исправить по коду: ключ описи
# с источником без блока, блок при ключе описи без источника, факт описи при пустом блоке, один ключ
# двумя блоками, ключ контракта без метода. Блок без ключа в описи и строка описи без источника и без
# блока — справка.
echo "== СВЕРКА ОПИСЬ → ЧЕРНОВИК"
awk -F'\t' '
  function noq(k) { sub(/\?[A-Za-z_][^=?\/ ]*=.*$/, "", k); return k }
  function nop(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
  FILENAME == ARGV[1] { d[$2] = $3; cl[$2] = $1; dk[++nd] = $2; if ($1 == "потребляет") { split($2, pp, " :: "); alt[pp[2]] = $2 }; next }
  { ok[++m] = $1; fc[m] = $2; sc[m] = $3 }
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
      if (hit == "") { print "MISS\t" k; if (sc[i] == 1) print "MISSRC\t" k; print "CLS\tбез пары"; continue }
      print "CLS\t" cl[hit]
      if (sc[i] == 0) print "NOSRCPAIR\t" k
      if (fc[i] > 0 && d[hit] == 0 && cl[hit] != "экраны" && cl[hit] != "роли" && cl[hit] != "зависит" && cl[hit] != "потребляет") print "EMPTY\t" k
      if (fc[i] == 0 && d[hit] == 0 && (cl[hit] == "контракт" || cl[hit] == "задачи" || cl[hit] == "топики")) print "NOFACT\t" cl[hit] ": " k
    }
    for (k in d) if (!(k in used) && cl[k] != "зависит" && cl[k] != "потребляет") print "EXTRA\t" cl[k] ": " k
  }
' "$TMP/draft.k" "$TMP/opis" > "$TMP/join"
for t in MISS MISSRC NOSRCPAIR EXTRA EMPTY DUP NOFACT; do grep "^$t	" "$TMP/join" | cut -f2- | sort > "$TMP/$t"; done
printf 'нет в черновике: %d' "$(wc -l < "$TMP/MISS")"; [ -s "$TMP/MISS" ] && { printf ' — '; list "$TMP/MISS"; } || echo
printf 'нет в описи: %d' "$(wc -l < "$TMP/EXTRA")"; [ -s "$TMP/EXTRA" ] && { printf ' — '; list "$TMP/EXTRA"; } || echo
printf 'факт в описи, пустой блок: %d' "$(wc -l < "$TMP/EMPTY")"; [ -s "$TMP/EMPTY" ] && { printf ' — '; list "$TMP/EMPTY"; } || echo
# «Бизнес-правила» сверяются своими проверками — в перечень ключей добора их строки не идут.
bm=$(grep -c -E '^(объект|сообщение|ограничение) ' "$TMP/MISS"); be=$(grep -c '^бизнес: ' "$TMP/EXTRA")
printf 'вне ключей — «Бизнес-правила»: нет в черновике %d, нет в описи %d\n' "$bm" "$be"
printf 'один ключ дважды — с хвостом в скобках и без: %d' "$(wc -l < "$TMP/DUP")"; [ -s "$TMP/DUP" ] && { printf ' — '; list "$TMP/DUP"; } || echo
printf 'ключи без единого факта и в описи, и в карточке: %d' "$(wc -l < "$TMP/NOFACT")"; [ -s "$TMP/NOFACT" ] && { printf ' — '; list "$TMP/NOFACT"; } || echo
grep -v -E '^(объект|сообщение|ограничение) ' "$TMP/MISSRC" > "$TMP/ADD"
grep -v -E '^(объект|сообщение|ограничение) ' "$TMP/NOSRCPAIR" > "$TMP/NOSRC"
printf 'перечень добора: ключ описи с источником без блока %d, ключ с блоком без источника %d, факт в описи — блок пуст %d, один ключ дважды %d\n' \
  "$(wc -l < "$TMP/ADD")" "$(wc -l < "$TMP/NOSRC")" "$(wc -l < "$TMP/EMPTY")" "$(wc -l < "$TMP/DUP")"
if [ -n "${CHECK_LISTS:-}" ]; then
  L="ADD NOSRC EMPTY DUP nometh"; [ -n "$PFX" ] && L="$L NOPFX"; [ -n "${CHECK_PLAN:-}" ] && L="$L MARKFILE"
  { for t in $L; do echo "## $(title "$t")"; cat "$TMP/$t"; echo; done; } > "$CHECK_LISTS" && echo "перечень добора целиком: $CHECK_LISTS"
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

ROUTE=""
if [ -n "$PREV" ]; then
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
fi

# Исход — гейты сводит скрипт, а не ведущий: маркеры (по сервису и частям), доставка тела контракта
# (тело меньше чем у половины блоков — не доехало), гард. «Гейт не пройден» — добор, пока бюджет
# есть; без бюджета — по SKILL.md. Перечень добора — по авторам: часть, голова; у одиночного — читающий.
echo "== ИСХОД"
MG="$(cat "$TMP/markgate" 2>/dev/null)"; [ -n "$MG" ] || MG="плана нет — сверки маркеров нет"
echo "маркеры: $MG"
set -- $(awk -F'\t' '$1 == "контракт" { n++; if ($3 > 0) b++ } END { print n + 0, b + 0 }' "$TMP/draft.k")
NB=$1; BB=$2; BF=""
if [ "$NB" -eq 0 ]; then echo "доставка тела: блоков контракта нет — сверки нет"
elif [ $((2 * BB)) -lt "$NB" ]; then BF="тело у $BB из $NB блоков контракта"; echo "доставка тела: НЕ ПРОЙДЕН — $BF, меньше половины"
else echo "доставка тела: пройден — тело у $BB из $NB блоков контракта"; fi
echo "гард: ${ROUTE:-прежней карточки нет}"
FAIL=""
case "$MG" in "НЕ ПРОЙДЕН"*) FAIL="маркеры: ${MG#НЕ ПРОЙДЕН — }" ;; esac
[ -n "$BF" ] && FAIL="${FAIL:+$FAIL; }$BF"
if [ -n "$FAIL" ]; then echo "ИСХОД: гейт не пройден — $FAIL"
elif [ "$ROUTE" = "В _pending" ]; then echo "ИСХОД: в _pending — гард"
elif [ -n "$ROUTE" ]; then echo "ИСХОД: записать поверх"
else echo "ИСХОД: записать"; fi
{ for t in ADD NOSRC EMPTY DUP nometh NOPFX MARKFILE; do awk -v t="$t" '{ print t "\t" $0 }' "$TMP/$t"; done; } > "$TMP/items"
awk -F'\t' -v parts="${CHECK_PARTS:+1}" -v oo="$TMP/own.opis" -v oc="$TMP/own.card" '
  function nop(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
  function look(arr, k) { if (k in arr) return arr[k]; if (nop(k) in arr) return arr[nop(k)]; return "" }
  BEGIN {
    while ((getline l < oo) > 0) { split(l, x, "\t"); if (!((x[1], x[2]) in so)) { so[x[1], x[2]] = 1; op[x[1]] = op[x[1]] (op[x[1]] == "" ? "" : ",") x[2] } }
    while ((getline l < oc) > 0) { split(l, x, "\t"); if (!((x[1], x[2]) in sc)) { sc[x[1], x[2]] = 1; cp[x[1]] = cp[x[1]] (cp[x[1]] == "" ? "" : ",") x[2] } }
  }
  {
    t = $1; k = $2
    if (!parts) a = "читающий"
    else if (t == "MARKFILE") { a = k; sub(/.*\(часть /, "", a); sub(/\).*/, "", a) }
    else if (t == "DUP") { split(k, d, " ~ "); a = look(cp, d[1]); b = look(cp, d[2]); a = a (a != "" && b != "" ? "," : "") b }
    else if (t == "ADD" || t == "NOSRC" || t == "EMPTY") { a = look(op, k); if (a == "") a = look(cp, k) }
    else { a = look(cp, k); if (a == "") a = look(op, k) }
    if (a == "") a = "без хозяина"
    n = split(a, as, ","); delete done
    for (i = 1; i <= n; i++) if (!(as[i] in done)) { done[as[i]] = 1; print as[i] "\t" t "\t" k }
  }' "$TMP/items" > "$TMP/routed"
if [ -s "$TMP/routed" ]; then
  cut -f1 "$TMP/routed" | sort -u > "$TMP/authors"
  while IFS= read -r a; do
    n=$(awk -F'\t' -v a="$a" '$1 == a' "$TMP/routed" | wc -l | tr -d ' ')
    label="$a"; case "$a" in [0-9]*) label="часть $a" ;; esac
    file=""
    if [ -n "${CHECK_LISTS:-}" ]; then
      if [ -z "${CHECK_PARTS:-}" ]; then file="$CHECK_LISTS"
      else
        id="$a"; case "$a" in голова) id=head ;; "без хозяина") id=none ;; esac
        file="${CHECK_LISTS%.md}-$id.md"
        { for t in ADD NOSRC EMPTY DUP nometh NOPFX MARKFILE; do
            awk -F'\t' -v a="$a" -v t="$t" '$1 == a && $2 == t { print $3 }' "$TMP/routed" > "$TMP/one"
            [ -s "$TMP/one" ] && { echo "## $(title "$t")"; cat "$TMP/one"; echo; }
          done; } > "$file"
      fi
    fi
    echo "ДОБОР $label: $n${file:+ — $file}"
  done < "$TMP/authors"
else echo "ДОБОР: пусто"; fi
