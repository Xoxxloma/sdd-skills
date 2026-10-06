#!/usr/bin/env bash
# check.sh — счёты Шага 4 и гарда по файлам, без чтения их моделью.
#
#   bash check.sh <опись> <черновик> [<прежняя карточка>]
#   CHECK_LISTS=<файл> — полный перечень исправляемого, без справки и пустоты без факта.
#   CHECK_REPORT=<файл> — полный TSV: категория, класс, ключ, источник, карточка, строка, описание.
#   CHECK_DECLARATIONS=<manifest> — включить независимую сверку объявлений в тот же отчёт.
#   CHECK_CROSS_SECTIONS=1 — сверить явные ссылки полной карточки (не отдельной части).
#   <черновик>.conflicts.tsv — диагностика последней склейки, включается в полный отчёт.
#
# Печатает: состав черновика по секциям; ключи описи и строки без файла-источника; сверку
# «опись → черновик» поключево (нет в черновике, нет в описи, факт в описи — пустой блок);
# при третьем аргументе — гард по классам и маршрут. Списки обрезаются на 40 именах.
# Только чтение; пишет лишь в stdout. Формат карточки — reference/card.template.md.
set -u
OPIS="${1:?опись}"; DRAFT="${2:?черновик}"; PREV="${3:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
    function flush() {
      if (key != "") print c "\t" key "\t" body "\t" keyline "\t" sec "\t" semantic "\t" fields "\t" service "\t" unchecked
      key = ""; body = semantic = fields = service = unchecked = 0
    }
    function fact(t) {
      t = norm(t)
      if (t == key || t ~ /^(\()?(фактов нет|не проверено)/ || t ~ /^не определено([ .:—]|$)/ || t ~ /^(сущности|назначение):/ || t ~ /^ошибки: стандартные (ответы|ошибки)/ || t ~ /^возвращает [A-Za-z_][A-Za-z0-9_]*(Dto|DTO|Response|Result)[.]?$/) return
      if (c == "сущности" && t ~ /^[A-Za-z_][A-Za-z0-9_]*:/) {
        fields++
        if (t !~ /( означает | значит |по умолчанию|только |уникал|обязательн| — )/) return
      }
      semantic++
    }
    { sub(/\r$/, "") }
    /^## / { flush(); sec = $0; c = cls(sec); hdr = 0; next }
    /^### / {
      flush()
      if (c == "" || c == "экраны" || c == "роли" || c == "зависит" || c == "потребляет") next
      h = substr($0, 5)
      p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1)
      key = norm(h); keyline = NR; body = semantic = fields = service = unchecked = 0; next
    }
    /^(\()?не проверено|^- (\()?не проверено/ { if (key != "") unchecked = 1 }
    /фактов нет — служебный/ { if (key != "") service = 1 }
    /^- / {
      if (key == "") next
      body++; fact(substr($0, 3)); next
    }
    # Older cards use an em dash for entity semantics. Keep the historical guard
    # body count unchanged, but do not report an existing fact as lost.
    /^— / { if (key != "") fact(substr($0, length("— ") + 1)); next }
    /^\|/ {
      if (c != "экраны" && c != "роли" && c != "зависит" && c != "потребляет") next
      if ($0 ~ /^\|[ \t:|-]*$/) { hdr = 1; next }       # строка-разделитель |---|
      if (!hdr) next                                    # строка заголовка таблицы
      n = split($0, cell, "|")
      k = norm(cell[2]); if (c == "потребляет") k = k " :: " norm(cell[3])
      if (c == "роли") { p = index(k, " — "); if (p > 0) k = substr(k, 1, p - 1) }   # область в скобках — часть ключа
      if (k == "" || k == "—" || k == "— :: ") next
      print c "\t" k "\t0\t" NR "\t" sec
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
    function kind(s) {
      if (s ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|query|mutation|subscription|rpc) / || s ~ /^[A-Za-z_][A-Za-z0-9_]*[.\/][A-Za-z_][A-Za-z0-9_]*\(/) return "контракт"
      if (s ~ /^(потребляет|публикует) /) return "топики"
      return ""
    }
    function flush() { if (key != "") print key "\t" facts "\t" src "\t" kc "\t" rest "\t" keyline "\t" service "\t" factnosrc; key = "" }
    { sub(/\r$/, "") }
    /^[ \t]+/ {                                         # второй уровень
      if (key == "") next
      t = $0; sub(/^[ \t]+/, "", t)
      if (t ~ /фактов нет — служебный/) service = 1
      if (t ~ /^(·|•|-) /) {
        facts++
        if (t !~ / — .*([^ ]\.[A-Za-z0-9]+([ ,)(+]|$)|\/)/) factnosrc++
      }
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
      kc = kind(key); if (key ~ /^(объект|сообщение|ограничение) /) kc = "бизнес"
      if (head ~ /^(роль|Роль):/) kc = "роли"
      if (head ~ /^(сущность|задача|экран|зависит):/) {
        kc = head ~ /^сущность:/ ? "сущности" : head ~ /^задача:/ ? "задачи" : head ~ /^экран:/ ? "экраны" : "зависит"
        sub(/^[^:]+:[ ]*/, "", key)
      }
      keyline = NR; facts = service = factnosrc = 0
    }
    END { flush() }
  ' "$1"
}

TMP="$(mktemp -d 2>/dev/null || echo "/tmp/check.$$")"; mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
parse_card "$DRAFT" > "$TMP/draft"
# Повтор ключа в описи — один ключ (так бывает после склейки частей): и точный, и «вызовом и без скобок».
parse_opis "$OPIS" > "$TMP/opis.raw"
# Идентичность GraphQL — тип и имя операции. Другие сигнатуры сохраняются.
awk -F'\t' 'BEGIN {OFS="\t"}
  { k=$1; if ($4=="контракт" && k ~ /^(query|mutation|subscription) /) sub(/\(.*\)$/, "", k)
    id=$4 SUBSEP k
    if (!(id in facts)) {order[++n]=id; key[id]=k; facts[id]=0; cls[id]=$4; src[id]=$3; path[id]=$5; line[id]=$6; service[id]=0; factnosrc[id]=0}
    if ($2>facts[id]) facts[id]=$2
    if ($7>service[id]) service[id]=$7
    if ($8>factnosrc[id]) factnosrc[id]=$8
    if ($3>src[id]) {src[id]=$3; path[id]=$5}
  }
  END {for(i=1;i<=n;i++) {id=order[i]; print key[id], facts[id], src[id], cls[id], path[id], line[id], service[id], factnosrc[id]}}
' "$TMP/opis.raw" > "$TMP/opis"

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
awk -F'\t' '$1 == "контракт" && $5 !~ /^## Публичный API/ && $2 !~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / && $2 !~ /^(query|mutation|subscription) / && $2 !~ /^(rpc )?[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*(\(.*\))?$/ { print $2 }' \
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
# Направленная сверка даёт добор и справку; самостоятельного запрета записи здесь нет.
echo "== СВЕРКА ОПИСЬ → ЧЕРНОВИК"
printf 'категория\tкласс\tключ\tисточник\tфайл карточки\tстрока\tописание\n' > "$TMP/report"
: > "$TMP/join"
awk -v legacy="$TMP/join" -v cardfile="$DRAFT" -f "$HERE/check-report.awk" "$TMP/draft.k" "$TMP/opis" >> "$TMP/report" || exit 3
awk -v cardfile="$DRAFT" -f "$HERE/check-facts.awk" "$DRAFT" "$OPIS" >> "$TMP/report" || exit 3
if [ "${CHECK_CROSS_SECTIONS:-0}" = 1 ]; then
  awk -v cardfile="$DRAFT" -f "$HERE/check-links.awk" "$DRAFT" >> "$TMP/report" || exit 3
fi
if [ -e "$DRAFT.conflicts.tsv" ]; then
  if awk -F'\t' '
    NR==1 {if($0!="категория\tкласс\tключ\tисточник\tфайл карточки\tстрока\tописание") bad=1; next}
    NF!=7 || $1!="добор-факт" || $2=="" || $3=="" || $7=="" {bad=1}
    END {exit bad || NR==0}
  ' "$DRAFT.conflicts.tsv"; then
    awk 'NR>1' "$DRAFT.conflicts.tsv" >> "$TMP/report" || exit 3
  else
    awk -v OFS="\t" -v source="$DRAFT.conflicts.tsv" -v cardfile="$DRAFT" 'BEGIN {
      print "не-проверено","неизвестен","склейка частей",source,cardfile,0,"Диагностика склейки повреждена; согласованность частей не проверена"
    }' >> "$TMP/report"
  fi
fi
if [ -n "${CHECK_DECLARATIONS:-}" ]; then
  if command -v node >/dev/null 2>&1 && node "$HERE/contracts.mjs" compare "$CHECK_DECLARATIONS" "$DRAFT" "$TMP/contracts.tsv" >"$TMP/contracts.out" 2>"$TMP/contracts.err"; then
    awk 'NR>1' "$TMP/contracts.tsv" >> "$TMP/report" || exit 3
  else
    awk -v OFS="\t" -v manifest="$CHECK_DECLARATIONS" -v cardfile="$DRAFT" 'BEGIN {
      gsub(/[\t\r\n]/," ",manifest);gsub(/[\t\r\n]/," ",cardfile)
      print "не-проверено","контракт","независимая сверка объявлений",manifest,cardfile,0,"Независимая сверка не выполнена: Node.js, manifest или разбор недоступны; отсутствие операций не установлено"
    }' >> "$TMP/report"
  fi
fi
# Status notes are diagnostics, never extra inventory keys.
awk -v OFS="\t" -v cardfile="$DRAFT" '
  /^> (не проверено|объявлено без реализации|пропущено частью):/ {
    line=$0; category=line ~ /^> пропущено частью:/ ? "добор-ключ" : "не-проверено"
    sub(/^> [^:]+:[ ]*/, "", line); n=split(line, p, " — "); k=p[1]
    gsub(/`/, "", k); source=n>1 ? p[n] : ""
    if(source !~ /\// && source !~ /[.][A-Za-z0-9]+/) source=""
    c=k ~ /^(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|query|mutation|subscription|rpc) / ? "контракт" : k ~ /^(потребляет|публикует) / ? "топики" : "неизвестен"
    description=$0; gsub(/[\t\r\n]/, " ", k); gsub(/[\t\r\n]/, " ", source); gsub(/[\t\r\n]/, " ", description)
    print category,c,k,source,cardfile,0,description
  }
' "$OPIS" >> "$TMP/report" || exit 3
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
printf 'опись по классам (класс — по паре в черновике): '
grep "^CLS	" "$TMP/join" | cut -f2 | sort | uniq -c | awk '{n=$1; $1=""; sub(/^ /,""); printf "%s%s %d", (NR>1?", ":""), $0, n} END{print ""}'
printf 'уникальные ключи карточки: '
awk -F'\t' '$1=="CARD" {printf "%s%s %d", (n++ ? ", " : ""), $2, $3} END {print ""}' "$TMP/join"
printf 'уникальные контракты по протоколам: '
awk -F'\t' '$1=="PROTO" {printf "%s%s %d", (n++ ? ", " : ""), $2, $3} END {print ""}' "$TMP/join"
awk -F'\t' '$1=="CARD" && $2=="контракт" {printf "доставка тела: контракт %d, с фактами %d, пустых %d, служебных %d, оцениваемых %d\n", $3, $4, $3-$4, $5, $3-$5}' "$TMP/join"

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
case "$DRAFT" in
  */.work/*) SEARCH_DIR="${DRAFT%%/.work/*}" ;;
  .work/*) SEARCH_DIR=. ;;
  *) SEARCH_DIR="$(dirname "$DRAFT")" ;;
esac
MAN="$SEARCH_DIR/manifest.yaml"
while [ ! -f "$MAN" ] && [ "$SEARCH_DIR" != / ] && [ "$SEARCH_DIR" != . ]; do
  SEARCH_DIR="$(dirname "$SEARCH_DIR")"; MAN="$SEARCH_DIR/manifest.yaml"
done
if [ -f "$MAN" ]; then
  sed 's/\r$//' "$MAN" | awk '/^[ \t-]*name:[ \t]*/ { s = $0; sub(/^[ \t-]*name:[ \t]*/, "", s); gsub(/["'\'' \t]/, "", s); if (s != "") print s }' > "$TMP/mnames"
else : > "$TMP/mnames"; fi
echo "== КАНДИДАТЫ ПРОВЕРОК (решаешь ты; номер строки черновика)"
awk -v report="$TMP/report" -v cardfile="$DRAFT" -v names="$TMP/mnames" -v man="$([ -s "$TMP/mnames" ] && echo "$MAN" || echo нет)" '
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
  function addn(k, n, s,   label) {
    c[k]++; if (c[k] <= 15) L[k] = L[k] sprintf("\n    %d: %s", n, cut(s, 160))
    label = k
    if (k == "br_hdr") label = "заголовок бизнес-правила"
    if (k == "br_code") label = "код в бизнес-правилах"
    if (k == "purpose") label = "код в назначении"
    if (k == "can") label = "код в возможности"
    if (k == "ver") label = "возможная версия в стеке"
    if (k == "glued") label = "несколько ключей в ячейке таблицы"
    if (k == "names") label = "имя не из манифеста"
    if (k == "tail") label = "хвост-файл"
    if (k == "noent") label = "нет строки сущности:"
    if (k == "order") label = "порядок блоков"
    reportkey = (k == "noent" ? key(s) : context); gsub(/[\t\r\n]/, " ", reportkey)
    print "проверить-форму\t" reportclass(sec) "\t" reportkey "\t\t" cardfile "\t" n "\tкандидат: " label " — проверить по источнику" >> report
  }
  function reportclass(s) {
    if (s ~ /^Публичный (контракт|API)/) return "контракт"
    if (s ~ /^Владеет данными/) return "сущности"
    if (s ~ /^Фоновые задачи/) return "задачи"
    if (s ~ /^События/) return "топики"
    if (s ~ /^Бизнес-правила/) return "бизнес"
    if (s ~ /^Экраны/) return "экраны"
    if (s ~ /^Роли и доступ/) return "роли"
    if (s ~ /^Зависит от/) return "зависит"
    if (s ~ /^Потребляемые API/) return "потребляет"
    return "неизвестен"
  }
  function cell(s, i,   a) { split(s, a, "|"); s = a[i]; gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function show(label, k) { printf "%s: %d%s\n", label, c[k], L[k] }
  function key(h,   p) { h = substr(h, 5); gsub(/`/, "", h); p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1); return h }
  function okey(s, h,   v, r) {
    if (s ~ /^Публичный (контракт|API)/) { v = h; sub(/ .*/, "", v); if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) { r = substr(h, length(v) + 2); return r "\002" toupper(v) } }
    if (s ~ /^Бизнес-правила/) return (h ~ /^сообщение/ ? "2" : h ~ /^ограничение/ ? "3" : "1") h
    return h
  }
  { sub(/\r$/, ""); line = $0 }
  /^<!-- service-map: ограничения -->$/ { quality=1; next }
  /^<!-- \/service-map: ограничения -->$/ { quality=0; next }
  quality { next }
  /^```/ { fence = !fence; next }
  fence { next }
  /^## / { sec = substr(line, 4); sub(/[ \t]+$/, "", sec); hdr = 0; prevk = ""; inr = 0; blk = ""; context = ""; next }
  /^### / {
    if (blk != "" && !hasent) addn("noent", blkn, blk)
    blk = ""; hasent = 0
    if (sec ~ /^События/) ev++
    context = key(line); k = okey(sec, context)
    if (sec !~ /^Бизнес-правила/ && prevk != "" && k < prevk && !(sec in badord)) { badord[sec] = NR; ordn++; add("order", line) }
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
    context = first
    split(line, rc, "|"); if (sec ~ /^Что умеет/ && codey(rc[2])) add("can", line)
    if (sec ~ /^(Экраны|Роли и доступ|Зависит от|Потребляемые API)/ && first ~ /, /) add("glued", line)
    if (sec ~ /^(Зависит от|Потребляемые API)/ && first != "" && first != "—" && !(first in have) && line !~ /вне манифеста/) add("names", line)
  }
  sec ~ /^Стек/ && (tolower(line) ~ /(kafka|rabbit|nats|amqp|sqs|pubsub|pub\/sub)/ || line ~ /(Брокер|брокер|БРОКЕР)/) { broker = 1 }
  line ~ /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]*\.[a-z]+[`)]*[ \t]*$/ { add("tail", line) }
  line ~ secre { strip_l = line; gsub(/`[^`]*`/, "", strip_l); if (match(strip_l, secre "[A-Za-z0-9+/=_-]*")) { sec_n++; rs = RSTART; rl = RLENGTH; print "проверить-форму\t" reportclass(sec) "\t" context "\t\t" cardfile "\t" NR "\tкандидат: похожая на секрет строка — проверить по источнику" >> report; if (sec_n <= 15) secl = secl sprintf("\n    %d: %s (%d знаков)", NR, cut(substr(strip_l, rs, rl), 16), rl) } }
  END {
    if (blk != "" && !hasent) addn("noent", blkn, blk)
    for (i = 1; i <= nr; i++) {
      ok = 0; t = rh[i] " " rt[i]
      for (n in have) if (index(t, n) > 0) ok = 1
      for (n in roles) if (n != "" && index(t, n) > 0) ok = 1
      if (!ok) { c["sw"]++; print "проверить-форму\tбизнес\t" key(rh[i]) "\t\t" cardfile "\t" rn[i] "\tкандидат: ограничение без подтвержденного переключателя" >> report; if (c["sw"] <= 15) L["sw"] = L["sw"] sprintf("\n    %d: %s", rn[i], cut(rh[i], 160)) }
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

# Полные данные сохраняются после кандидатов И гарда; stdout — только обзор.
save_report() {
if [ -n "${CHECK_REPORT:-}" ]; then
  cp "$TMP/report" "$CHECK_REPORT" || { echo "НЕ СОХРАНЕН ОТЧЕТ: $CHECK_REPORT"; exit 3; }
  echo "полный отчет: $CHECK_REPORT"
fi
if [ -n "${CHECK_LISTS:-}" ]; then
  awk -F'\t' 'NR>1 && $1 ~ /^(добор-ключ|добор-факт|проверить-форму)$/ {print $1 ": " $2 ": " $3 " — " $7 " (источник: " $4 "; строка: " $6 ")"}' "$TMP/report" > "$CHECK_LISTS" || exit 3
  echo "перечень добора: $CHECK_LISTS"
fi
}

[ -n "$PREV" ] || { save_report; exit 0; }

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
  awk -v OFS="\t" -v c="$c" -v cardfile="$DRAFT" '{gsub(/[\t\r\n]/," "); print "не-проверено",c,$0,"",cardfile,0,"Ключ прежней карточки исчез: проверить удаление по коду; гард учитывается отдельно"}' "$TMP/gone" >> "$TMP/report"
  awk -v OFS="\t" -v c="$c" -v cardfile="$DRAFT" '{gsub(/[\t\r\n]/," "); print "пустой-блок",c,$0,"",cardfile,0,"Прежний блок потерял строки тела; гард учитывается отдельно"}' "$TMP/emptied" >> "$TMP/report"
  if { [ "$g" -ge 3 ] && [ $((3 * g)) -gt "$was" ]; } || { [ "$e" -ge 3 ] && [ $((3 * e)) -gt "$was" ]; }; then
    ROUTE="В _pending"; echo "  ⇒ правило маршрута сработало на классе «$name»"
  fi
done
echo "МАРШРУТ: $ROUTE"
save_report
