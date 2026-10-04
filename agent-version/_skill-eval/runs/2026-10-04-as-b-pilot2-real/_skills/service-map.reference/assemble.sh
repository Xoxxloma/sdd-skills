#!/usr/bin/env bash
# assemble.sh — склейка карточки из файлов частей, без модели.
#
#   bash assemble.sh <папка частей> <S> <дата> <черновик-выход> <опись-выход>
#
# В папке: head.md (каркас карточки по шаблону: шапка, секции головы, в ключевых секциях — строка
# `<!-- части -->`), part-01.md … part-<S>.md и part-NN.opis.md, при желании head.opis.md. Первая
# строка каждого файла — `<!-- service-map: <голова|часть NN> <дата> -->`; файла нет или дата чужая —
# отказ, ничего не пишется. В каждой секции с `<!-- части -->` блоки `###` и строки таблиц всех частей
# сливаются: дубль ключа — один блок, строки тела без повторов; сортировка по ключу (контракт — по
# пути, затем по глаголу; «События» — потребляет, затем публикует; «Бизнес-правила» — объекты,
# сообщения, ограничения); заглушки частей (`—`, `не определено…`) остаются, только если блоков нет
# ни у одной части. Опись — списки частей подряд, итоги `⟹` суммируются.
set -u
DIR="${1:?папка частей}"; S="${2:?число частей}"; DATE="${3:?дата}"; OUT="${4:?черновик}"; OPIS="${5:?опись}"
export LC_ALL=C
fail() { echo "ОТКАЗ: $*"; exit 3; }
fresh() {  # fresh <файл> <кто>
  [ -f "$1" ] || fail "нет файла $1"
  head -n1 "$1" | tr -d '\r' | grep -q "^<!-- service-map: $2 $DATE -->" || fail "$1 — первая строка не «<!-- service-map: $2 $DATE -->» (чужой прогон?)"
}
fresh "$DIR/head.md" "голова"
PARTS=""
for i in $(seq 1 "$S"); do
  n=$(printf '%02d' "$i")
  fresh "$DIR/part-$n.md" "часть $n"; fresh "$DIR/part-$n.opis.md" "часть $n"
  PARTS="$PARTS $DIR/part-$n.md"
done
[ -f "$DIR/head.opis.md" ] && fresh "$DIR/head.opis.md" "голова"
TMP="$(mktemp -d 2>/dev/null || echo "/tmp/assemble.$$")"; mkdir -p "$TMP"; trap 'rm -rf "$TMP"' EXIT

# 1. Записи частей: тип<TAB>секция<TAB>ключ-сортировки<TAB>ключ<TAB>текст (\001 вместо перевода строки).
# shellcheck disable=SC2086
awk '
  function norm(s,   v) {
    gsub(/`/, "", s); gsub(/«|»/, "", s); sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); gsub(/[ \t]+/, " ", s)
    v = s; sub(/ .*/, "", v)
    if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) s = toupper(v) substr(s, length(v) + 1)
    return s
  }
  function skey(sec, k,   v, rest) {
    if (sec ~ /^Публичный (контракт|API)/) {
      v = k; sub(/ .*/, "", v)
      if (v ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) { rest = substr(k, length(v) + 2); return rest "\002" v }
      return k
    }
    if (sec ~ /^Бизнес-правила/) {
      if (k ~ /^сообщение/) return "2" k
      if (k ~ /^ограничение/) return "3" k
      return "1" k
    }
    return k
  }
  function flush() {
    if (key != "") { sub(/(\001)+$/, "", txt); print "B\t" sec "\t" skey(sec, key) "\t" key "\t" txt }
    key = ""; txt = ""; rowout()
  }
  function rowout(   n, c, k) {                            # отложенная строка таблицы — данные
    if (pend == "") return
    n = split(pend, c, "|"); k = norm(c[2])
    if (psec ~ /^Потребляемые API/) k = k " :: " norm(c[3])
    if (k != "" && k != "—" && k != "— :: ") print "R\t" psec "\t" k "\t" k "\t" pend
    pend = ""
  }
  { gsub(/\t/, " ") }
  FNR == 1 { flush(); sec = ""; next }                       # строка свежести
  { sub(/\r$/, "") }
  /^## / { flush(); sec = substr($0, 4); sub(/[ \t]+$/, "", sec); next }
  sec == "" { next }
  /^### / {
    flush(); h = substr($0, 5); p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1)
    key = norm(h); txt = $0; next
  }
  key != "" { txt = txt "\001" $0; next }
  /^\|/ {
    if ($0 ~ /^\|[ \t:|-]*$/) { pend = ""; next }          # разделитель: отложенная строка была заголовком
    rowout(); pend = $0; psec = sec; next
  }
  { rowout() }
  /^(—|не определено)/ { print "P\t" sec "\t\t\t" $0; next }
  END { flush() }
' $PARTS > "$TMP/rec"

sort -t"$(printf '\t')" -k1,1 -k2,2 -k3,3 -s "$TMP/rec" > "$TMP/rec.s"

# 2. Слияние дублей: блок — заголовок и не-«- » строки от первого, строки «- » без повторов по порядку.
awk -F'\t' '
  function out() {
    if (pk == "") return
    if (pt == "B") { n = split(btxt, L, "\001"); s = ""
      for (i = 1; i <= n; i++) s = s (i > 1 ? "\001" : "") L[i]
      print psec "\t" s "\001" } else print psec "\t" btxt "\001"
    pk = ""
  }
  {
    t = $1; sec = $2; k = $4; txt = $5
    if (t == "P") { ph[sec] = ph[sec] (ph[sec] == "" ? "" : "\001") txt; next }
    if (t == pt && sec == psec && k == pk) {
      dup[sec] = dup[sec] (dup[sec] == "" ? "" : "; ") k
      if (t == "B") { n = split(txt, L, "\001")
        for (i = 2; i <= n; i++) if (L[i] ~ /^- / && !((pk SUBSEP L[i]) in have)) { have[pk SUBSEP L[i]] = 1; btxt = btxt "\001" L[i] } }
      next
    }
    out(); pt = t; psec = sec; pk = k; btxt = txt
    if (t == "B") { n = split(txt, L, "\001"); for (i = 2; i <= n; i++) if (L[i] ~ /^- /) have[k SUBSEP L[i]] = 1 }
    has[sec] = 1
  }
  END {
    out()
    for (s in ph) if (!(s in has)) print s "\t" ph[s]
    for (s in dup) print "#DUP\t" s ": " dup[s] > "/dev/stderr"
  }
' "$TMP/rec.s" > "$TMP/merged" 2> "$TMP/dups"

# 3. Каркас головы: строка `<!-- части -->` заменяется слитым содержимым своей секции.
awk -F'\t' '
  FNR == NR { c[$1] = c[$1] $2; next }
  FNR == 1 { next }
  { sub(/\r$/, "") }
  /^## / { sec = substr($0, 4); sub(/[ \t]+$/, "", sec) }
  $0 == "<!-- части -->" {
    s = c[sec]; if (s == "") { print "—"; next }
    gsub(/\001/, "\n", s); sub(/\n+$/, "", s); print s; next
  }
  { print }
' "$TMP/merged" "$DIR/head.md" > "$OUT.tmp" || fail "каркас не собрался"

# Между блоками ### — пустая строка, как в шаблоне.
awk 'prev != "" && /^### / { print "" } { print; prev = $0 }' "$OUT.tmp" | cat -s > "$OUT"; rm -f "$OUT.tmp"

# 4. Опись: списки подряд, итоги ⟹ суммируются по одинаковой форме строки.
{
  for f in "$DIR/head.opis.md" "$DIR"/part-*.opis.md; do
    [ -f "$f" ] || continue
    tail -n +2 "$f" | tr -d '\r' | grep -v '^⟹'
    echo
  done
  { [ -f "$DIR/head.opis.md" ] && cat "$DIR/head.opis.md"; cat "$DIR"/part-*.opis.md; } | tr -d '\r' | grep '^⟹' | awk '
    { form = $0; gsub(/[0-9]+/, "#", form); n = 0; line = $0
      while (match(line, /[0-9]+/)) { n++; sum[form, n] += substr(line, RSTART, RLENGTH); line = substr(line, RSTART + RLENGTH) }
      if (!(form in seen)) { seen[form] = 1; order[++m] = form; cnt[form] = n } }
    END { for (i = 1; i <= m; i++) { f = order[i]; s = ""; j = 0; rest = f
      while ((p = index(rest, "#")) > 0) { j++; s = s substr(rest, 1, p - 1) sum[f, j]; rest = substr(rest, p + 1) }
      print s rest } }'
} > "$OPIS"

echo "собрано: $OUT"
awk '/^## /{s=$0} /^### /{n[s]++} END{for (k in n) printf "  %s — блоков %d\n", k, n[k]}' "$OUT" | sort
[ -s "$TMP/dups" ] && { echo "дубли ключей склеены:"; sed 's/^#DUP\t/  /' "$TMP/dups"; }
echo "опись: $OPIS ($(grep -c ' — ' "$OPIS") строк с источником)"
