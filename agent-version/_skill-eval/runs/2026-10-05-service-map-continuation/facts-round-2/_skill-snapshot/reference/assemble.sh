#!/usr/bin/env bash
# assemble.sh — склейка карточки из файлов частей, без модели.
#
#   bash assemble.sh <папка частей> <S> <дата> <черновик-выход> <опись-выход> [run-id]
# Новый свод business.md/business.opis.md вставляется только по отдельной метке головы;
# в этом режиме run-id обязателен и проверяется во всех входных файлах.
# <черновик>.conflicts.tsv всегда обновляется; полный семиколоночный отчёт кандидатов
# несогласованности подхватывается check.sh и не является самостоятельным гейтом.
#
# В папке: head.md (каркас карточки по шаблону: шапка, секции головы, в ключевых секциях — строка
# `<!-- части -->`), part-01.md … part-<S>.md и part-NN.opis.md, при желании head.opis.md. Первая
# строка каждого файла — `<!-- service-map: <голова|часть NN> <дата> -->`; файла нет или дата чужая —
# отказ, ничего не пишется. В каждой секции с `<!-- части -->` блоки `###` и строки таблиц всех частей
# сливаются: дубль ключа — один блок, строки тела без повторов; сортировка по ключу (контракт — по
# пути, затем по глаголу; «События» — потребляет, затем публикует; «Бизнес-правила» — объекты,
# сообщения, ограничения); заглушки частей (`—`, `не определено…`) остаются, только если блоков нет
# ни у одной части. Опись — списки частей подряд, итоги `⟹` суммируются.
# Ключ контракта, записанный вызовом (`query task(id: ID!)`, `Svc.Assign(Req)`), — тот же ключ, что без
# скобок, если у другой части он стоит без скобок: один блок. У частей есть блоки в секции, которой в
# каркасе головы нет или в ней нет метки, — отказ с именем виновного: молча блоки не выбрасываются.
# Секцию, которую пишет голова («Зависит от», «Роли и доступ»), у части отбрасывает со строкой в выводе.
set -u
DIR="${1:?папка частей}"; S="${2:?число частей}"; DATE="${3:?дата}"; OUT="${4:?черновик}"; OPIS="${5:?опись}"
RUN="${6:-}"
export LC_ALL=C
fail() { echo "ОТКАЗ: $*"; exit 3; }
fresh() {  # fresh <файл> <кто>
  [ -f "$1" ] || fail "нет файла $1"
  local stamp="<!-- service-map: $2 $DATE${RUN:+ $RUN} -->"
  [ "$(head -n1 "$1" | tr -d '\r')" = "$stamp" ] || fail "$1 — первая строка не «$stamp» (чужой прогон?)"
}
[ -z "$RUN" ] || case "$RUN" in *[!A-Za-z0-9_-]*) fail "недопустимый run-id" ;; esac
fresh "$DIR/head.md" "голова"
SUMMARY=$(awk '/^## / {sec=$0} /^[ \t]*<!-- свод бизнес-правил -->[ \t]*$/ {if(sec!="## Бизнес-правила") bad=1; n++} END {if(bad) print -1; else print n+0}' "$DIR/head.md")
case "$SUMMARY" in 0|1) ;; *) fail "метка свода должна стоять один раз внутри «Бизнес-правил»" ;; esac
if [ "$SUMMARY" -eq 1 ]; then
  [ -n "$RUN" ] || fail "для свода нужен run-id"
  fresh "$DIR/business.md" "бизнес"; fresh "$DIR/business.opis.md" "бизнес"
  awk 'FNR==1 {next} /^## / {if($0!="## Бизнес-правила") bad=1; else n++} END {exit bad || n!=1}' "$DIR/business.md" || fail "свод содержит чужие секции или не содержит «Бизнес-правил»"
  awk '/^## / {sec=$0} sec=="## Бизнес-правила" && !/^## / && !/^[ \t]*$/ && !/^[ \t]*<!-- свод бизнес-правил -->[ \t]*$/ {bad=1} END {exit bad}' "$DIR/head.md" || fail "два автора бизнес-правил: голова и свод"
elif [ -e "$DIR/business.md" ] || [ -e "$DIR/business.opis.md" ]; then
  fail "файлы свода есть, а отдельной метки в голове нет"
fi
PARTS=""
for i in $(seq 1 "$S"); do
  n=$(printf '%02d' "$i")
  fresh "$DIR/part-$n.md" "часть $n"; fresh "$DIR/part-$n.opis.md" "часть $n"
  PARTS="$PARTS $DIR/part-$n.md"
done
if [ "$SUMMARY" -eq 1 ]; then
  for i in $(seq 1 "$S"); do
    n=$(printf '%02d' "$i")
    awk '/^## / {sec=$0} sec=="## Бизнес-правила" && /^### / {bad=1} END {exit bad}' "$DIR/part-$n.md" || fail "два автора бизнес-правил: часть $n и свод"
  done
fi
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
    if (key != "") { sub(/(\001)+$/, "", txt); print "B\t" sec "\t" skey(sec, key) "\t" key "\t" txt "\t" pn }
    key = ""; txt = ""; rowout()
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
      if (s ~ /^(Публичный (контракт|API)|Владеет данными|События|Фоновые задачи|Бизнес-правила|Потребляемые API)/) print "HEAD\t" s "\t" who[s]
      else if (s in hs) print "DROP\t" s "\t" who[s]
      else print "PART\t" s "\t" who[s]
    }
  }' "$TMP/frame" "$TMP/rec" | sort > "$TMP/unplaced"
u="$(grep '^HEAD	' "$TMP/unplaced" | head -n1)"
[ -n "$u" ] && fail "голова — в каркасе нет строки «<!-- части -->» в секции «$(printf '%s' "$u" | cut -f2)»: блоки частей $(printf '%s' "$u" | cut -f3) вставить некуда"
u="$(grep '^PART	' "$TMP/unplaced" | head -n1)"
[ -n "$u" ] && fail "часть $(printf '%s' "$u" | cut -f3) — секция «$(printf '%s' "$u" | cut -f2)» не из шаблона: её блоки вставить некуда"

sort -t"$(printf '\t')" -k1,1 -k2,2 -k3,3 -s "$TMP/rec" > "$TMP/rec.s"

# 2. Слияние дублей: блок — заголовок и не-«- » строки от первого, строки «- » без повторов по порядку.
awk -F'\t' -v conflicts="$TMP/conflicts" '
  function fact(s) { return s ~ /^- / && s !~ /^- (\()?(фактов нет|не проверено|не определено)/ && s !~ /^- (назначение|сущности):/ }
  function out() {
    if (pk == "") return
    if (pt == "B") { n = split(btxt, L, "\001"); s = ""
      anyfact=0; for(i=2;i<=n;i++) if(fact(L[i])) anyfact=1
      for (i = 1; i <= n; i++) {
        if(anyfact && L[i] ~ /^(\()?фактов нет|^- (\()?фактов нет/) continue
        s = s (s!="" ? "\001" : "") L[i]
      }
      print psec "\t" s "\001" } else print psec "\t" btxt "\001"
    pk = ""
  }
  {
    t = $1; sec = $2; k = $4; txt = $5
    if (t == "P") { ph[sec] = ph[sec] (ph[sec] == "" ? "" : "\001") txt; next }
    if (t == pt && sec == psec && k == pk) {
      dup[sec] = dup[sec] (dup[sec] == "" ? "" : "; ") k
      if (t == "B") {
        n = split(txt, L, "\001"); split(btxt, old, "\001")
        evidence=btxt; gsub(/\001/, " / ", evidence)
        newer=txt; gsub(/\001/, " / ", newer)
        if(txt!=btxt) print sec "\t" k "\t" author ", " $6 "\tразные блоки: проверить совместимость фактов; " evidence " / " newer >> conflicts
        heading=L[1]; oldheading=old[1]; gsub(/«|»|`/, "", heading); gsub(/«|»|`/, "", oldheading)
        if(heading!=oldheading) {
          print sec "\t" k "\t" author ", " $6 "\tразные назначения: " old[1] " / " L[1] >> conflicts
          btxt = btxt "\001> Не согласовано между частями " author " и " $6 ": " L[1]
        }
        for (i = 2; i <= n; i++) if(L[i]!="" && !((sec SUBSEP pk SUBSEP L[i]) in have)) {
          have[sec SUBSEP pk SUBSEP L[i]]=1
          if(L[i] !~ /^- / && L[i] !~ /^(\()?фактов нет/) {
            print sec "\t" k "\t" author ", " $6 "\tразные описания/схемы: " L[i] >> conflicts
            btxt=btxt "\001> Не согласовано между частями " author " и " $6 ": " L[i]
          } else btxt = btxt "\001" L[i]
        }
      } else if(t=="R" && txt!=btxt) {
        print sec "\t" k "\t" author ", " $6 "\tразные строки таблицы: " btxt " / " txt >> conflicts
        btxt=btxt "\001" txt
      }
      next
    }
    out(); pt = t; psec = sec; pk = k; btxt = txt; author=$6
    if (t == "B") { n = split(txt, L, "\001"); for (i = 2; i <= n; i++) have[sec SUBSEP k SUBSEP L[i]] = 1 }
    has[sec] = 1
  }
  END {
    out()
    for (s in ph) if (!(s in has)) print s "\t" ph[s]
    for (s in dup) print "#DUP\t" s ": " dup[s] > "/dev/stderr"
  }
' "$TMP/rec.s" > "$TMP/merged" 2> "$TMP/dups"
if [ "$SUMMARY" -eq 1 ]; then
  awk 'FNR==1 {next} /^## Бизнес-правила$/ {next} {printf "%s\001", $0} END {print ""}' "$DIR/business.md" | awk '{print "Бизнес-правила\t" $0}' >> "$TMP/merged"
fi

# 3. Каркас головы: строка `<!-- части -->` заменяется слитым содержимым своей секции.
awk -F'\t' '
  FNR == NR { c[$1] = c[$1] $2; next }
  FNR == 1 { next }
  { sub(/\r$/, "") }
  /^## / { sec = substr($0, 4); sub(/[ \t]+$/, "", sec) }
  { l = $0; gsub(/^[ \t]+|[ \t]+$/, "", l) }
  l == "<!-- части -->" || l == "<!-- свод бизнес-правил -->" {
    s = c[sec]; if (s == "") { print "—"; next }
    gsub(/\001/, "\n", s); sub(/\n+$/, "", s); print s; next
  }
  { print }
' "$TMP/merged" "$DIR/head.md" > "$OUT.tmp" || fail "каркас не собрался"

# Между блоками ### — пустая строка, как в шаблоне.
awk 'prev != "" && /^### / { print "" } { print; prev = $0 }' "$OUT.tmp" | cat -s > "$OUT"; rm -f "$OUT.tmp"

# 4. Опись: списки подряд, итоги ⟹ суммируются по одинаковой форме строки.
{
  for f in "$DIR/head.opis.md" "$DIR/business.opis.md" "$DIR"/part-*.opis.md; do
    [ -f "$f" ] || continue
    tail -n +2 "$f" | tr -d '\r' | grep -v '^⟹'
    echo
  done
  # echo после каждого файла: опись без перевода строки в конце иначе склеит свой итог с первой строкой следующей
  for f in "$DIR/head.opis.md" "$DIR/business.opis.md" "$DIR"/part-*.opis.md; do [ -f "$f" ] || continue; cat "$f"; echo; done | tr -d '\r' | grep '^⟹' | awk '
    { form = $0; gsub(/[0-9]+/, "#", form); n = 0; line = $0
      while (match(line, /[0-9]+/)) { n++; sum[form, n] += substr(line, RSTART, RLENGTH); line = substr(line, RSTART + RLENGTH) }
      if (!(form in seen)) { seen[form] = 1; order[++m] = form; cnt[form] = n } }
    END { for (i = 1; i <= m; i++) { f = order[i]; s = ""; j = 0; rest = f
      while ((p = index(rest, "#")) > 0) { j++; s = s substr(rest, 1, p - 1) sum[f, j]; rest = substr(rest, p + 1) }
      print s rest } }'
} > "$OPIS"
printf 'категория\tкласс\tключ\tисточник\tфайл карточки\tстрока\tописание\n' > "$TMP/conflicts.tsv"
if [ -f "$TMP/conflicts" ]; then
  awk -F'\t' -v OFS='\t' -v cardfile="$OUT" -v partsdir="$DIR" '
    function cls(s) {
      if(s ~ /^Публичный (контракт|API)/) return "контракт"
      if(s=="Владеет данными") return "сущности"
      if(s=="События") return "топики"
      if(s=="Фоновые задачи") return "задачи"
      if(s=="Бизнес-правила") return "бизнес"
      if(s=="Потребляемые API") return "потребляет"
      return "неизвестен"
    }
    {
      n=split($3,authors,/, /); source=""
      for(i=1;i<=n;i++) source=source (source!=""?" + ":"") partsdir "/part-" authors[i] ".md"
      print "добор-факт",cls($1),$2,source,cardfile,0,"кандидат несогласованности частей " $3 ": " $4
    }
  ' "$TMP/conflicts" >> "$TMP/conflicts.tsv" || fail "не подготовлена диагностика конфликтов"
fi
cp "$TMP/conflicts.tsv" "$OUT.conflicts.tsv" || fail "не сохранена диагностика конфликтов"
[ -f "$TMP/conflicts" ] && echo "конфликты частей: $OUT.conflicts.tsv"

echo "собрано: $OUT"
awk '/^## /{s=$0} /^### /{n[s]++} END{for (k in n) printf "  %s — блоков %d\n", k, n[k]}' "$OUT" | sort
[ -s "$TMP/dups" ] && { echo "дубли ключей склеены:"; sed 's/^#DUP\t/  /' "$TMP/dups"; }
[ -s "$TMP/near" ] && { echo "из них один ключ вызовом и без скобок:"; sed 's/^/  /' "$TMP/near"; }
grep '^DROP	' "$TMP/unplaced" | while IFS="$(printf '\t')" read -r _ s w; do echo "отброшено: секция «$s» у частей $w — её пишет голова"; done
echo "опись: $OPIS ($(grep -c ' — ' "$OPIS") строк с источником)"
