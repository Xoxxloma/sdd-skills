#!/usr/bin/env bash
# assemble.sh — склейка карточки из файлов частей, без модели.
#
#   bash assemble.sh <папка частей> <S> <дата> <черновик-выход> <опись-выход>
#
# В папке: head.md (каркас карточки по шаблону: шапка, секции головы, в ключевых секциях — строка
# `<!-- части -->`), part-01.md … part-<S>.md и part-NN.opis.md, при желании head.opis.md. Первая
# строка каждого файла — `<!-- service-map: <голова|часть NN> <дата> -->`; номер части сверяется числом
# (`часть 1` и `часть 01` — одна часть); файла нет, номер или дата чужие — отказ, ничего не пишется. В каждой секции с `<!-- части -->` блоки `###` и строки таблиц всех частей
# сливаются: дубль ключа — один блок, строки тела без повторов; сортировка по ключу (контракт — по
# пути, затем по глаголу; «События» — потребляет, затем публикует; «Бизнес-правила» — объекты,
# сообщения, ограничения); заглушки частей (`—`, `не определено…`) остаются, только если блоков нет
# ни у одной части. Опись — списки частей подряд, итоги `⟹` суммируются.
# Заголовок блока в контракте, «Событиях», задачах и данных пишется ключом шаблона: без строки запроса,
# аргументов операции, слов между направлением и топиком и пометки в скобках — два написания одного
# ключа дают один блок.
# Ключ контракта, записанный вызовом (`query night(id: ID!)`, `Dome.Close(Req)`), — тот же ключ, что без
# скобок, если у другой части он стоит без скобок: один блок. У частей есть блоки в секции, которой в
# каркасе головы нет или в ней нет метки, — отказ с именем виновного: молча блоки не выбрасываются.
# Секцию, которую пишет голова («Зависит от», «Роли и доступ», «Бизнес-правила»), у части отбрасывает
# со строкой в выводе.
set -u
DIR="${1:?папка частей}"; S="${2:?число частей}"; DATE="${3:?дата}"; OUT="${4:?черновик}"; OPIS="${5:?опись}"
export LC_ALL=C
fail() { echo "ОТКАЗ: $*"; exit 3; }
fresh() {  # fresh <файл> <кто> [<кто — регэксп>]
  [ -f "$1" ] || fail "нет файла $1"
  head -n1 "$1" | tr -d '\r' | grep -q "^<!-- service-map: ${3:-$2} $DATE -->" || fail "$1 — первая строка не «<!-- service-map: $2 $DATE -->» (чужой прогон?)"
}
fresh "$DIR/head.md" "голова"
PARTS=""
for i in $(seq 1 "$S"); do
  n=$(printf '%02d' "$i")
  fresh "$DIR/part-$n.md" "часть $n" "часть 0*$i"; fresh "$DIR/part-$n.opis.md" "часть $n" "часть 0*$i"
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
  # Ключ по шаблону, как бы его ни записала часть: у контракта — метод и путь без строки запроса либо
  # тип операции и имя без аргументов; у «Событий» — направление и топик: текст в бэктиках, а без них —
  # последнее слово после снятой пометки в скобках; слова между направлением и топиком в ключ не входят.
  function canon(sec, h,   k, d, t) {
    k = norm(h)
    if (sec ~ /^Публичный контракт/) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) sub(/\?.*$/, "", k); else if (k ~ /^(query|mutation|subscription|rpc) /) sub(/[ ]*\(.*\)$/, "", k) }
    if (sec ~ /^События/) {
      d = k; sub(/ .*/, "", d)
      if (d ~ /^(публикует|потребляет)$/ && k ~ / /) {
        if (match(h, /`[^`]+`/)) t = substr(h, RSTART + 1, RLENGTH - 2)
        else { t = k; sub(/[ ]*\([^)]*\)$/, "", t); sub(/.* /, "", t) }
        k = d " " t
      }
    }
    return k
  }
  function header(sec, k,   d) {
    if (sec ~ /^События/ && k ~ /^(публикует|потребляет) /) { d = k; sub(/ .*/, "", d); return "### " d " `" substr(k, length(d) + 2) "`" }
    return "### `" k "`"
  }
  function flush() {
    if (key != "" && tail != "") txt = txt "\001" tail
    if (key != "") { sub(/(\001)+$/, "", txt); print "B\t" sec "\t" skey(sec, key) "\t" key "\t" txt "\t" pn }
    key = ""; txt = ""; tail = ""; rowout()
  }
  function rowout(   n, c, k) {                            # отложенная строка таблицы — данные
    if (pend == "") return
    n = split(pend, c, "|"); k = norm(c[2])
    if (psec ~ /^Потребляемые API/) k = k " :: " norm(c[3])
    if (k != "" && k != "—" && k != "— :: ") print "R\t" psec "\t" k "\t" k "\t" pend "\t" pn
    pend = ""
  }
  { gsub(/\t/, " ") }
  FNR == 1 { flush(); sec = ""; pn = FILENAME; sub(/.*part-/, "", pn); sub(/\.md$/, "", pn); next }   # строка свежести
  { sub(/\r$/, "") }
  /^## / { flush(); sec = substr($0, 4); sub(/[ \t]+$/, "", sec); next }
  sec == "" { next }
  # Заголовок блока в контракте, «Событиях», задачах и данных пишется ключом; хвост « — …» после него
  # становится строкой назначения, если её нет. У «Бизнес-правил» фраза после « — » — часть формы.
  /^### / {
    flush(); h = substr($0, 5); p = index(h, " — "); tl = ""; if (p > 0) { tl = substr(h, p + 5); h = substr(h, 1, p - 1) }
    if (sec ~ /^(Публичный контракт|События|Фоновые задачи|Владеет данными)/) { key = canon(sec, h); txt = header(sec, key); tail = tl }
    else { key = norm(h); txt = $0 }
    next
  }
  key != "" {
    if (tail != "" && $0 !~ /^[ \t]*$/) { if ($0 ~ /^(- |— |сущности:)/) txt = txt "\001" tail; tail = "" }
    l = $0; if (sec ~ /^Публичный контракт/) sub(/^- сущности:/, "сущности:", l)
    txt = txt "\001" l; next
  }
  /^\|/ {
    if ($0 ~ /^\|[ \t:|-]*$/) { pend = ""; next }          # разделитель: отложенная строка была заголовком
    rowout(); pend = $0; psec = sec; next
  }
  { rowout() }
  /^(—|не определено)/ { print "P\t" sec "\t\t\t" $0; next }
  END { flush() }
' $PARTS > "$TMP/rec.raw"

# 1а. Ключ контракта вызовом и он же без скобок — один ключ (точное совпадение старше: две перегрузки
# с разными аргументами остаются двумя ключами).
awk -F'\t' -v OFS='\t' -v NEAR="$TMP/near" '
  function bare(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
  FNR == NR { if ($1 == "B") have[$2 SUBSEP $4] = 1; next }
  $1 == "B" && $2 ~ /^Публичный (контракт|API)/ { b = bare($4); if (b != $4 && (($2 SUBSEP b) in have)) { print $2 ": " b " ~ " $4 >> NEAR; $4 = b; $3 = b } }
  { print }
' "$TMP/rec.raw" "$TMP/rec.raw" > "$TMP/rec"
: >> "$TMP/near"

# 1б. Каждой секции с блоками или строками частей нужна метка в каркасе головы.
awk '{ sub(/\r$/, "") } /^## / { sec = substr($0, 4); sub(/[ \t]+$/, "", sec); print "H\t" sec; next }
     { l = $0; gsub(/^[ \t]+|[ \t]+$/, "", l); if (l == "<!-- части -->") print "M\t" sec }' "$DIR/head.md" > "$TMP/frame"
awk -F'\t' '
  FILENAME == ARGV[1] { if ($1 == "M") mark[$2] = 1; else hs[$2] = 1; next }
  ($1 == "B" || $1 == "R") && !($2 in mark) { if (!(($2 SUBSEP $6) in seen)) { seen[$2 SUBSEP $6] = 1; who[$2] = who[$2] (who[$2] == "" ? "" : ", ") $6 } }
  END {
    for (s in who) {
      if (s ~ /^(Публичный (контракт|API)|Владеет данными|События|Фоновые задачи|Потребляемые API)/) print "HEAD\t" s "\t" who[s]
      else if (s in hs) print "DROP\t" s "\t" who[s]
      else print "PART\t" s "\t" who[s]
    }
  }' "$TMP/frame" "$TMP/rec" | sort > "$TMP/unplaced"
u="$(grep '^HEAD	' "$TMP/unplaced" | head -n1)"
[ -n "$u" ] && fail "голова — в каркасе нет строки «<!-- части -->» в секции «$(printf '%s' "$u" | cut -f2)»: блоки частей $(printf '%s' "$u" | cut -f3) вставить некуда"
u="$(grep '^PART	' "$TMP/unplaced" | head -n1)"
[ -n "$u" ] && fail "часть $(printf '%s' "$u" | cut -f3) — секция «$(printf '%s' "$u" | cut -f2)» не из шаблона: её блоки вставить некуда"

sort -t"$(printf '\t')" -k1,1 -k2,2 -k3,3 -s "$TMP/rec" > "$TMP/rec.s"

# 2. Слияние дублей. Блок без дубля выходит как есть. Дубль ключа — один блок: заголовок, назначение и
# строка `сущности:` от первого; строки `- ` и `— ` всех блоков без повторов, сначала `- `, потом `— `,
# как в шаблоне; строка с отступом едет со своей строкой. В «Владеет данными» перечень полей один:
# первым идёт блок, у которого больше полей с типом, у остальных имя, которое уже есть, вычёркивается.
awk -F'\t' '
  function units(txt, U,   n, L, i, m) {
    n = split(txt, L, "\001"); m = 0
    for (i = 2; i <= n; i++) if (m > 0 && L[i] ~ /^[ \t]/) U[m] = U[m] "\001" L[i]; else U[++m] = L[i]
    return m
  }
  # Строка поля: перечень имён до «:» или « — » (в бэктиках с `?` и пометкой в скобках либо голые через
  # запятую). Имена — в NM[1..], исходные куски — в IT[1..], остаток строки — в RST; не перечень — 0.
  function fields(u,   s, p, q, n, i, t, nm) {
    s = u; sub(/\001.*/, "", s); sub(/^- /, "", s)
    p = index(s, ":"); q = index(s, " — "); if (q > 0 && (p == 0 || q < p)) p = q
    RST = (p > 0) ? substr(s, p) : ""; TYPED = (p > 0 && substr(s, p, 1) == ":"); if (p > 0) s = substr(s, 1, p - 1)
    n = split(s, IT, /[,\/]/)
    for (i = 1; i <= n; i++) {
      t = IT[i]; gsub(/^[ \t]+|[ \t]+$/, "", t); IT[i] = t
      nm = t; sub(/[ \t]*\([^)]*\)$/, "", nm); gsub(/`/, "", nm); sub(/\?$/, "", nm)
      if (nm !~ /^[A-Za-z_][A-Za-z0-9_]*$/) return 0
      NM[i] = nm
    }
    return n
  }
  function typed(txt,   m, U, i, c) { m = units(txt, U); c = 0; for (i = 1; i <= m; i++) if (U[i] ~ /^- / && fields(U[i]) && TYPED) c++; return c }
  function take(txt, first,   m, U, i, u, n, j, keep, nk, tail) {
    m = units(txt, U)
    for (i = 1; i <= m; i++) {
      u = U[i]
      if (u ~ /^(- )?сущности:/) { if (!ent) { ent = 1; pre[++npre] = u }; continue }
      if (u in have) continue
      if (u ~ /^- /) {
        n = (psec ~ /^Владеет данными/) ? fields(u) : 0
        if (n && !first) {
          keep = ""; nk = 0
          for (j = 1; j <= n; j++) if (!(NM[j] in fld)) { keep = keep (nk++ ? ", " : "") IT[j] }
          if (nk == 0) continue
          if (nk < n) { j = index(u, "\001"); tail = j ? substr(u, j) : ""; u = "- " keep RST tail }
        }
        for (j = 1; j <= n; j++) fld[NM[j]] = 1
        have[u] = 1; dash[++ndash] = u
      } else if (u ~ /^— /) { have[u] = 1; sem[++nsem] = u }
      else if (first) pre[++npre] = u
    }
  }
  function out(   s, i, b, best, c) {
    if (pk == "") return
    if (nb > 1) {
      b = 1
      if (psec ~ /^Владеет данными/) { best = -1; for (i = 1; i <= nb; i++) { c = typed(blk[i]); if (c > best) { best = c; b = i } } }
      ent = 0; npre = ndash = nsem = 0; delete have; delete fld
      s = blk[b]; sub(/\001.*/, "", s); take(blk[b], 1)
      for (i = 1; i <= nb; i++) if (i != b) take(blk[i], 0)
      for (i = 1; i <= npre; i++) s = s "\001" pre[i]
      for (i = 1; i <= ndash; i++) s = s "\001" dash[i]
      for (i = 1; i <= nsem; i++) s = s "\001" sem[i]
      btxt = s
    }
    print psec "\t" btxt "\001"
    pk = ""
  }
  {
    t = $1; sec = $2; k = $4; txt = $5
    if (t == "P") { ph[sec] = ph[sec] (ph[sec] == "" ? "" : "\001") txt; next }
    if (t == pt && sec == psec && k == pk) {
      dup[sec] = dup[sec] (dup[sec] == "" ? "" : "; ") k
      if (t == "B") blk[++nb] = txt
      next
    }
    out(); pt = t; psec = sec; pk = k; btxt = txt; nb = 1; blk[1] = txt
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
  { l = $0; gsub(/^[ \t]+|[ \t]+$/, "", l) }
  l == "<!-- части -->" {
    s = c[sec]; if (s == "") { print "—"; next }
    gsub(/\001/, "\n", s); sub(/\n+$/, "", s); print s; next
  }
  { print }
' "$TMP/merged" "$DIR/head.md" > "$OUT.tmp" || fail "каркас не собрался"

# Между блоками ### — пустая строка, как в шаблоне.
awk 'prev != "" && /^### / { print "" } { print; prev = $0 }' "$OUT.tmp" | cat -s > "$OUT"; rm -f "$OUT.tmp"

# 4. Опись: списки подряд, итоги ⟹ суммируются по одинаковой форме строки. Строки «Бизнес-правил» частей
# (`состояние:` … с подстроками, итог `⟹ состояний`) — сырьё головы: написала голова такие строки в свою
# опись — в склеенную опись идут её строки, а не сырьё.
RULES=0; [ -f "$DIR/head.opis.md" ] && grep -q -E '^(состояние|сообщение|ограничение):' "$DIR/head.opis.md" && RULES=1
raw() {  # raw <файл> <0|1> — опись; 1 — без строк «Бизнес-правил»
  tr -d '\r' < "$1" | awk -v drop="$2" '
    drop == 1 && /^(состояние|справочник|сообщение|ограничение):/ { skip = 1; next }
    skip && /^[ \t]/ { next }
    { skip = 0 }
    drop == 1 && /^⟹ состояний/ { next }
    { print }'
}
{
  for f in "$DIR/head.opis.md" "$DIR"/part-*.opis.md; do
    [ -f "$f" ] || continue
    d=$RULES; [ "$f" = "$DIR/head.opis.md" ] && d=0
    raw "$f" "$d" | tail -n +2 | grep -v '^⟹'
    echo
  done
  # echo после каждого файла: опись без перевода строки в конце иначе склеит свой итог с первой строкой следующей
  for f in "$DIR/head.opis.md" "$DIR"/part-*.opis.md; do [ -f "$f" ] || continue; d=$RULES; [ "$f" = "$DIR/head.opis.md" ] && d=0; raw "$f" "$d"; echo; done | grep '^⟹' | awk '
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
[ -s "$TMP/near" ] && { echo "из них один ключ вызовом и без скобок:"; sed 's/^/  /' "$TMP/near"; }
grep '^DROP	' "$TMP/unplaced" | while IFS="$(printf '\t')" read -r _ s w; do echo "отброшено: секция «$s» у частей $w — её пишет голова"; done
echo "опись: $OPIS ($(grep -c ' — ' "$OPIS") строк с источником)"
