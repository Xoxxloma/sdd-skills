#!/usr/bin/env bash
# svod.sh — свод сквозных фактов (роли, переходы состояний, отправки) по описи, без модели.
#
#   bash svod.sh <опись> <черновик> <папка вывода> [<plan.tsv>] [<корни через запятую>]
#
# Факты о ролях, состояниях и отправках лежат в местах использования, а не у объявления. Их пишут части
# строками под своими входами (`доступ:`, `меняет:`, `шлёт:`) и строками без отступа (`перечисление:`,
# `место:`, `правило доступа:`, `отправитель:`); формы строк — в брифах читающего и части. Скрипт:
#  1. Перечисления — без модели: имена типов полей «Владеет данными» подставляются в шаблон разведчика
#     (строка плана «шаблон перечисления <регэксп с <ИМЯ>> <маска>») и ищутся грепом по корням. Найдено
#     объявление, а строки `перечисление:` нет — пункт ENUM хозяину файла объявления.
#  2. Места — грепом по значениям: `Тип.ЗНАЧЕНИЕ`, затем `'ЗНАЧЕНИЕ'`, затем слово целиком (до первой формы,
#     давшей места вне файла объявления и тестов); у отправителя — вызов `.метод(`. Место (файл + значение)
#     закрыто строкой `доступ:`/`меняет:`/`шлёт:`/`место:` с этим файлом и этим значением; у `место:` вид —
#     из списка, строка кода — в пределах ±2 от места. Незакрытое — пункт MESTO хозяину файла. Значение,
#     которое голым словом стоит в 40 файлах и больше, — «шумное»: строка в отчёт, сверки нет.
#  3. Свод — svod.tsv и svod.md в папке вывода: роль → входы; Сущность.поле.значение → входы-переходы с
#     доступом того же входа; токен отправки (метод отправителя сводится к топику) → входы-поводы. Поле —
#     состояние, если у него есть переход; перечисление — набор ролей, если его значения стоят в `доступ:`;
#     иначе справочник. Правило доступа по шаблону пути раздаёт роль подходящим ручкам.
#  4. Черновик: у блока «публикует» строка `- когда:` дописывается входами из свода (входа в строке ещё нет).
#  5. svod.items — пункты для check.sh: `ENUM|MESTO<TAB>текст — файл`, `SENDER<TAB>ключ блока`.
# Без корней (нет плана со строками «корень» и пятого аргумента) мест нет — только свод и `когда:`.
set -u
OPIS="${1:?опись}"; DRAFT="${2:?черновик}"; OUTD="${3:?папка вывода}"; PLAN="${4:-}"; ROOTS_ARG="${5:-}"
for f in "$OPIS" "$DRAFT"; do [ -f "$f" ] || { echo "НЕТ ФАЙЛА: $f"; exit 2; }; done
[ -z "$PLAN" ] || [ -f "$PLAN" ] || PLAN=""
mkdir -p "$OUTD" || { echo "папка вывода не создаётся: $OUTD"; exit 2; }
export LC_ALL=C
K_AWK="$(cat "$(dirname "$0")/keys.awk" 2>/dev/null)"
[ -n "$K_AWK" ] || { echo "НЕТ ФАЙЛА: $(dirname "$0")/keys.awk — скилл установлен не целиком"; exit 2; }
TMP="$(mktemp -d 2>/dev/null || echo "/tmp/svod.$$")"; mkdir -p "$TMP"; trap 'rm -rf "$TMP"' EXIT
OS="$(uname -s 2>/dev/null)"

# Путь к одному виду (как в check.sh) и тест — по приметам plan.sh.
NP_AWK='
function np(p) {
  gsub(/`/, "", p); gsub(/\\/, "/", p); gsub(/\/\/+/, "/", p)
  sub(/^[ \t]+/, "", p); sub(/[ \t]+$/, "", p); sub(/^\.\//, "", p); sub(/\/$/, "", p)
  sub(/^(\.\.\.|…)\/*/, "", p); sub(/:[0-9]+(-[0-9]+)?$/, "", p); sub(/#L[0-9].*$/, "", p)
  if (os ~ /^(MINGW|MSYS|CYGWIN)/ && p ~ /^\/[A-Za-z]\//) p = toupper(substr(p, 2, 1)) ":" substr(p, 3)
  if (p ~ /^[A-Za-z]:/) p = toupper(substr(p, 1, 1)) substr(p, 2)
  return p
}
function isabs(p) { return p ~ /^(\/|[A-Za-z]:)/ }
function same(p, q) { if (p == q) return 1; if (!isabs(p) && length(q) > length(p) && substr(q, length(q) - length(p)) == "/" p) return 1; if (!isabs(q) && length(p) > length(q) && substr(p, length(p) - length(q)) == "/" q) return 1; return 0 }
function istest(rel,   s) {
  s = "/" tolower(rel)
  if (s ~ /^\/(test|tests)\// || s ~ /\/src\/test\// || s ~ /\/__tests__\//) return 1
  return (s ~ /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/ || s ~ /_test\.(go|py)$/)
}
# Файл источника — последний кусок после « — », если похож на путь; строка кода — после «:».
function srcfile(l,   p, t) {
  t = l; while ((p = index(t, " — ")) > 0) t = substr(t, p + 5)
  if (t == l) return ""
  gsub(/`/, "", t); sub(/[ \t]+$/, "", t)
  return (t ~ /\// || t ~ /\.[A-Za-z0-9]+(:[0-9]+(-[0-9]+)?)?$/) ? t : ""
}
function srcline(t,   m) { if (match(t, /:[0-9]+(-[0-9]+)?$/)) { m = substr(t, RSTART + 1); sub(/-.*/, "", m); return m + 0 }; return 0 }
# Текст строки без файла-хвоста: всё до последнего « — ».
function body(l,   p, q) { q = 0; while ((p = index(substr(l, q + 1), " — ")) > 0) q += p + 4; return q > 0 ? substr(l, 1, q - 5) : l }
'

# 1. Карточка: поля «Владеет данными», имена сущностей, блоки входов с назначением, строки-метки «Событий».
#    F<TAB>Сущность<TAB>поле<TAB>тип  ·  E<TAB>Сущность  ·  B<TAB>класс<TAB>ключ<TAB>назначение
awk "$K_AWK"'
  function scls(s) {
    if (s ~ /^## Публичный (контракт|API)/) return "контракт"
    if (s ~ /^## События/) return "топики"
    if (s ~ /^## Фоновые задачи/) return "задачи"
    if (s ~ /^## Владеет данными/) return "сущности"
    return ""
  }
  function flush() { if (key != "" && c != "сущности") print "B\t" c "\t" key "\t" purp; key = ""; purp = "" }
  { sub(/\r$/, "") }
  /^```/ { fence = !fence; next }
  fence { next }
  /^## / { flush(); sec = $0; c = scls(sec); next }
  /^### / {
    flush(); if (c == "") next
    h = substr($0, 5); p = index(h, " — "); if (p > 0) h = substr(h, 1, p - 1)
    key = k_canon(c, h); if (key == "") { gsub(/`/, "", h); key = h }
    if (c == "сущности") print "E\t" key
    ent = (c == "сущности") ? key : ""
    next
  }
  c == "сущности" && ent != "" && /^- / {
    l = substr($0, 3); p = index(l, ":"); if (p == 0) next
    f = substr(l, 1, p - 1); t = substr(l, p + 1); q = index(t, " — "); if (q > 0) t = substr(t, 1, q - 1)
    gsub(/`/, "", f); gsub(/[ \t]+/, "", f); sub(/\?$/, "", f)
    gsub(/^[ \t]+|[ \t]+$/, "", t)
    # Тип поля: имя типа (`Тип`, `Тип?`, `List<Тип>`, `Тип (A | B)`) и значения, если они записаны через `|`
    # (в скобках за именем типа либо сам тип — union значений).
    tn = t; gsub(/`/, "", tn); sub(/^[ \t]+/, "", tn); sub(/[ \t(].*/, "", tn); sub(/\?$/, "", tn); sub(/\[\]$/, "", tn)
    if (match(tn, /<[A-Za-z_][A-Za-z0-9_]*>$/)) tn = substr(tn, RSTART + 1, RLENGTH - 2)
    if (tn !~ /^[A-Z][A-Za-z0-9_]*$/) tn = ""
    vs = ""
    if (t ~ /\|/) { vs = t; if (tn != "" && index(vs, "(") > 0) { vs = substr(vs, index(vs, "(") + 1); sub(/\).*$/, "", vs) }
      gsub(/[`"\047\\?]/, "", vs); gsub(/\|/, " ", vs); gsub(/[ \t]+/, " ", vs); sub(/^ /, "", vs); sub(/ $/, "", vs) }
    if (f ~ /^[A-Za-z_][A-Za-z0-9_]*$/) print "F\t" ent "\t" f "\t" t "\t" tn "\t" vs
    next
  }
  key != "" && purp == "" && $0 !~ /^[ \t]*$/ && $0 !~ /^(- |— |сущности:|доступ:|меняет:|шлёт:)/ { purp = $0 }
  END { flush() }
' "$DRAFT" > "$TMP/card"

# 2. Опись: ключи входов и строки привязки под ними, строки без отступа нового вида.
#    A<TAB>вид<TAB>вход<TAB>текст<TAB>файл<TAB>строка   (вид: доступ|меняет|шлёт)
#    P<TAB>Тип<TAB>значения через пробел<TAB>файл     M<TAB>Тип.ЗНАЧЕНИЕ<TAB>вид<TAB>файл<TAB>строка
#    R<TAB>шаблон пути<TAB>роли через пробел<TAB>файл    O<TAB>метод<TAB>топик<TAB>файл
#    N<TAB>Сущность<TAB>файл
awk -v os="$OS" "$K_AWK$NP_AWK"'
  function tr(s) { gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  { sub(/\r$/, "") }
  /^[ \t]+·/ && sp != "" { l = $0; sub(/^[ \t]+·[ \t]*/, "", l); f = srcfile(l); if (f != "") l = body(l); print "SF\t" sp "\t" tr(l); next }
  /^[ \t]+(доступ|меняет|шлёт):/ {
    if (parent == "") next
    l = $0; sub(/^[ \t]+/, "", l); v = l; sub(/:.*/, "", v); t = substr(l, length(v) + 2)
    f = srcfile(t); if (f != "") t = body(t)
    print "A\t" v "\t" parent "\t" tr(t) "\t" f "\t" srcline(f)
    next
  }
  /^[ \t]/ || /^(#|⟹|\(|>|-|```|<!--)/ || /^$/ { next }
  { sp = "" }
  # Пара дат, задающая состояние: «состояние: <Сущность> <поле начала> | <поле конца> — <файл>»; факты `·` под ней.
  /^состояние:/ {
    parent = ""; l = substr($0, length("состояние:") + 1); b = tr(body(l)); e = b; sub(/[ \t].*/, "", e); rest = substr(b, length(e) + 1)
    if (index(e, ".") > 0) { rest = substr(e, index(e, ".") + 1) rest; e = substr(e, 1, index(e, ".") - 1) }   # «Сущность.поле | поле»
    fs_ = tr(rest); gsub(/[ \t]*\|[ \t]*/, " | ", fs_)
    if (e != "") { print "S\t" e "\t" fs_ "\t" srcfile(l); sp = e }
    next
  }
  /^перечисление:/ {
    parent = ""; l = substr($0, length("перечисление:") + 1); f = srcfile(l); b = tr(body(l))
    tp = b; sub(/[ \t].*/, "", tp); vs = substr(b, length(tp) + 1); gsub(/[|,]/, " ", vs); gsub(/[ \t]+/, " ", vs); vs = tr(vs)
    if (tp != "") print "P\t" tp "\t" vs "\t" f
    next
  }
  /^место:/ {
    parent = ""; l = substr($0, length("место:") + 1); f = srcfile(l); b = body(l)
    n = split(b, x, " — "); tok = tr(x[1]); kind = (n >= 2) ? tr(x[2]) : ""
    print "M\t" tok "\t" kind "\t" f "\t" srcline(f)
    next
  }
  /^правило доступа:/ {
    parent = ""; l = substr($0, length("правило доступа:") + 1); f = srcfile(l); b = tr(body(l))
    p = index(b, "→"); if (p == 0) next
    pat = tr(substr(b, 1, p - 1)); rs = tr(substr(b, p + 3)); gsub(/,/, " ", rs); gsub(/[ \t]+/, " ", rs)
    print "R\t" pat "\t" rs "\t" f
    next
  }
  /^отправитель:/ {
    parent = ""; l = substr($0, length("отправитель:") + 1); f = srcfile(l); b = tr(body(l))
    p = index(b, "→"); if (p == 0) next
    m = tr(substr(b, 1, p - 1)); sub(/\(.*$/, "", m); tp = tr(substr(b, p + 3)); sub(/[ \t].*/, "", tp)
    print "O\t" m "\t" tp "\t" f
    next
  }
  /^(зависит|справочник|сообщение|ограничение|роль|Роль):/ { parent = ""; next }
  {
    p = index($0, " — "); h = (p > 0) ? substr($0, 1, p - 1) : $0
    parent = k_opis(h)
    if (p > 0 && $0 ~ /\((@|[A-Za-z]+[ )])/ && h ~ /^[A-Za-z_][A-Za-z0-9_]*$/) { f = substr($0, p + 5); sub(/[ \t]*\(.*$/, "", f); print "N\t" h "\t" f }
  }
' "$OPIS" > "$TMP/opis"

# 3. Корни, шаблоны перечислений, тесты.
ROOTS="$ROOTS_ARG"
if [ -z "$ROOTS" ] && [ -n "$PLAN" ]; then ROOTS="$(tr -d '\r' < "$PLAN" | awk -F'\t' '$1 == "корень" { printf "%s%s", (n++ ? "," : ""), $2 }')"; fi
: > "$TMP/templates"; [ -n "$PLAN" ] && tr -d '\r' < "$PLAN" | awk -F'\t' '$1 == "шаблон" && $2 ~ /^перечислени/ { print $3 "\t" $4 }' > "$TMP/templates"
CODE_INC=(--include='*.java' --include='*.kt' --include='*.kts' --include='*.scala' --include='*.groovy' --include='*.ts' --include='*.tsx'
  --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.py' --include='*.go' --include='*.rb' --include='*.php'
  --include='*.cs' --include='*.rs' --include='*.ex' --include='*.exs')
CONF_INC=(--include='*.yaml' --include='*.yml' --include='*.properties')
GREP_X=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=__pycache__)
IFS=',' read -r -a RR <<< "$ROOTS"
RLIST=(); for r in "${RR[@]}"; do r="${r#"${r%%[![:space:]]*}"}"; r="${r%"${r##*[![:space:]]}"}"; [ -d "$r" ] && RLIST+=("$r"); done
: > "$TMP/roots"; [ "${#RLIST[@]}" -gt 0 ] && printf '%s\n' "${RLIST[@]}" > "$TMP/roots"
# Вывод grep -rn «путь:строка:текст» → путь<TAB>строка<TAB>текст; путь с диском `C:` разбирается.
# Тесты и сборочные папки в корне сервиса отбрасываются.
gparse() {
  awk -v os="$OS" -v rf="$TMP/roots" "$NP_AWK"'
    BEGIN { while ((getline r < rf) > 0) { if (r != "") root[++nr] = np(r) } }
    { d = ""; l = $0; if (l ~ /^[A-Za-z]:/) { d = substr(l, 1, 2); l = substr(l, 3) }
      p = index(l, ":"); if (p == 0) next; f = d substr(l, 1, p - 1); l = substr(l, p + 1)
      p = index(l, ":"); if (p == 0) next; n = substr(l, 1, p - 1); t = substr(l, p + 1)
      if (n !~ /^[0-9]+$/) next
      f = np(f); rel = f
      for (i = 1; i <= nr; i++) if (index(f, root[i] "/") == 1) { rel = substr(f, length(root[i]) + 2); break }
      if (istest(rel) || rel ~ /^(target|build|dist)\//) next
      print f "\t" n "\t" t }'
}
HAVE_ROOTS=0; [ -s "$TMP/roots" ] && HAVE_ROOTS=1

# 4. Перечисления по шаблону: имена типов полей (кроме сущностей) и типов строк `перечисление:`.
: > "$TMP/decl"; DECL_NOTE=""
awk -F'\t' '
  $1 == "E" { ent[$2] = 1; next }
  $1 == "F" { if ($5 != "") cand[$5] = 1; next }
  END { for (t in cand) if (!(t in ent)) print t }' "$TMP/card" > "$TMP/cand0"
awk -F'\t' '$1 == "P" { print $2 }' "$TMP/opis" >> "$TMP/cand0"
sort -u "$TMP/cand0" > "$TMP/cand"
if [ "$HAVE_ROOTS" = 1 ] && [ -s "$TMP/templates" ] && [ -s "$TMP/cand" ]; then
  alt="($(paste -sd'|' "$TMP/cand"))"
  while IFS="$(printf '\t')" read -r re glob; do
    [ -n "$re" ] || continue
    re="${re//<ИМЯ>/$alt}"; inc=(); [ -n "$glob" ] && inc=(--include="$glob")
    grep -rEn "${GREP_X[@]}" ${inc[@]+"${inc[@]}"} -e "$re" "${RLIST[@]}" 2>/dev/null | gparse
  done < "$TMP/templates" | awk -F'\t' -v cf="$TMP/cand" '
    BEGIN { while ((getline c < cf) > 0) cand[c] = 1 }
    { n = split($3, w, /[^A-Za-z0-9_]+/); for (i = 1; i <= n; i++) if (w[i] in cand) { print w[i] "\t" $1; break } }' | sort -u > "$TMP/decl"
  [ -s "$TMP/decl" ] || DECL_NOTE="шаблон перечислений не нашёл ни одного объявления"
  # Тип из `перечисление:`, которого шаблон не нашёл, — шаблон разведчика его не видит (узок или тип из библиотеки).
  NODECL="$(awk -F'\t' -v df="$TMP/decl" 'BEGIN { while ((getline l < df) > 0) { split(l, a, "\t"); d[a[1]] = 1 } } $1 == "P" && !($2 in d) { printf "%s%s", (n++ ? ", " : ""), $2 }' "$TMP/opis")"
elif [ "$HAVE_ROOTS" = 1 ] && [ ! -s "$TMP/templates" ]; then DECL_NOTE="шаблона перечислений в плане нет — сверка перечислений не проверялась"
elif [ "$HAVE_ROOTS" = 0 ]; then DECL_NOTE="корней нет — мест и сверки перечислений нет"
fi

# 5. Значения и места. Пары «тип значение» — из `перечисление:`, из полей-union карточки и роли из `доступ:`
#    (тип «роль»); у отправителя — метод (тип «отправитель»).
awk -F'\t' '
  function addv(t, v, d) { if (v == "" || ((t, v) in seen)) return; seen[t, v] = 1; print t "\t" v "\t" d }
  $1 == "P" { n = split($3, x, " "); for (i = 1; i <= n; i++) { v = x[i]; gsub(/[`"\047]/, "", v); if (v ~ /^[A-Za-z0-9_.-]+$/) addv($2, v, $4) } ; tv[$2] = 1; next }
  # значения из карточки: у типа с именем — значения этого типа, у union без имени — значения поля
  $1 == "F" && $6 != "" { n = split($6, x, " "); for (i = 1; i <= n; i++) { v = x[i]; if (v ~ /^[A-Za-z0-9_.-]+$/) addv(($5 != "" ? $5 : $2 "." $3), v, "") } ; next }
  $1 == "A" && $2 == "доступ" { r = $4; p = index(r, ";"); if (p > 0) r = substr(r, 1, p - 1)
      if (r ~ /^(без проверки|не определено)/) next
      n = split(r, x, ","); for (i = 1; i <= n; i++) { v = x[i]; sub(/[ \t]*\(.*$/, "", v); gsub(/[`"\047 \t]/, "", v); if (v ~ /^[A-Za-z0-9_.:-]+$/) rv[v] = 1 } ; next }
  $1 == "O" { addv("отправитель", $2, $4); next }
  END { for (v in rv) addv("роль", v, "") }
' "$TMP/opis" | sort -u > "$TMP/pairs"
# Объявление типа — из шаблона; у union — файл сущности по описи.
awk -F'\t' -v df="$TMP/decl" -v of="$TMP/opis" '
  BEGIN { while ((getline l < df) > 0) { split(l, a, "\t"); decl[a[1]] = (a[1] in decl) ? decl[a[1]] "|" a[2] : a[2] }
          while ((getline l < of) > 0) { split(l, a, "\t"); if (a[1] == "N") efile[a[2]] = a[3]; if (a[1] == "P" && a[4] != "" && !(a[2] in decl)) pdecl[a[2]] = a[4] } }
  { t = $1; d = $3
    if (t in decl) d = decl[t]; else if (d == "" && (t in pdecl)) d = pdecl[t]
    if (d == "" && t ~ /\./) { e = t; sub(/\..*/, "", e); if (e in efile) d = efile[e] }
    print t "\t" $2 "\t" d "\t" ((t in decl) ? 1 : 0) }' "$TMP/pairs" > "$TMP/pairs2"

: > "$TMP/hits"; : > "$TMP/noisy"
if [ "$HAVE_ROOTS" = 1 ] && [ -s "$TMP/pairs2" ]; then
  # форма 1 — Тип.ЗНАЧЕНИЕ (тип объявлен по шаблону или в `перечисление:`); 2 — в кавычках; 3 — словом;
  # отправитель — .метод(
  pass() {  # pass <форма> <файл пар> → места «тип значение файл строка»
    local form="$1" pf="$2"
    awk -F'\t' -v form="$form" '
      function esc(s) { gsub(/\./, "\\.", s); return s }
      $1 == "отправитель" { if (form == 1) print "\\.(" esc($2) ")[ \t]*\\("; next }
      form == 1 && $1 !~ /\./ && $1 != "роль" { print "(^|[^A-Za-z0-9_])" esc($1) "\\." esc($2) "([^A-Za-z0-9_]|$)" }
      form == 2 { print "[\"\047]" esc($2) "[\"\047]" }
      form == 3 { print "(^|[^A-Za-z0-9_.])" esc($2) "([^A-Za-z0-9_]|$)" }' "$pf" | sort -u > "$TMP/pat$form"
    [ -s "$TMP/pat$form" ] || return 0
    if [ "$form" = 1 ]; then grep -rEn "${GREP_X[@]}" "${CODE_INC[@]}" -f "$TMP/pat$form" "${RLIST[@]}" 2>/dev/null
    else grep -rEn "${GREP_X[@]}" "${CODE_INC[@]}" "${CONF_INC[@]}" -f "$TMP/pat$form" "${RLIST[@]}" 2>/dev/null; fi | gparse |
    awk -F'\t' -v form="$form" -v pf="$pf" -v os="$OS" "$NP_AWK"'
      BEGIN { while ((getline l < pf) > 0) { split(l, a, "\t"); n = split(a[3], dd, "|"); key = a[1] SUBSEP a[2]
                if (a[1] == "отправитель") snd[a[2]] = 1
                else if (form == 1) { if (a[1] !~ /\./ && a[1] != "роль") t1[a[1] "." a[2]] = key }
                else { tv[a[2]] = tv[a[2]] (tv[a[2]] == "" ? "" : "\002") key }
                for (i = 1; i <= n; i++) if (dd[i] != "") { nd_[key]++; dfile[key, nd_[key]] = np(dd[i]) } } }
      # Файл объявления (абсолютный из шаблона либо относительный из описи) — по хвосту пути.
      function isdecl(key, f,   i) { for (i = 1; i <= nd_[key]; i++) if (same(dfile[key, i], f)) return 1; return 0 }
      function emit(key, f, n,   q) { if (isdecl(key, f)) return; split(key, q, SUBSEP); print q[1] "\t" q[2] "\t" f "\t" n }
      { f = $1; t = $3
        if (form == 1) {
          m = split(t, w, /[^A-Za-z0-9_.]+/)
          for (i = 1; i <= m; i++) { x = w[i]; while (x != "") { if (x in t1) { emit(t1[x], f, $2); break }; if (index(x, ".") == 0) break; sub(/^[^.]*\./, "", x) } }
          s = t; while (match(s, /\.[A-Za-z_][A-Za-z0-9_]*[ \t]*\(/)) { x = substr(s, RSTART + 1, RLENGTH - 1); sub(/[ \t]*\($/, "", x); if (x in snd) emit("отправитель" SUBSEP x, f, $2); s = substr(s, RSTART + RLENGTH) }
        } else {
          m = split(t, w, /[^A-Za-z0-9_.-]+/)
          for (i = 1; i <= m; i++) if (w[i] in tv) {
            # форма 2 — только значение в кавычках на этой строке, а не любое слово рядом
            if (form == 2 && index(t, "\"" w[i] "\"") == 0 && index(t, "\047" w[i] "\047") == 0) continue
            k = split(tv[w[i]], kk, "\002"); for (j = 1; j <= k; j++) emit(kk[j], f, $2) }
        } }'
  }
  cp "$TMP/pairs2" "$TMP/left"
  for form in 1 2 3; do
    pass "$form" "$TMP/left" | sort -u > "$TMP/h$form"
    if [ "$form" = 3 ]; then   # шумные: значение словом в 40 файлах и больше
      awk -F'\t' '{ if (!(($1, $2, $3) in s)) { s[$1, $2, $3] = 1; n[$1 "\t" $2]++ } } END { for (k in n) if (n[k] >= 40) print k "\t" n[k] }' "$TMP/h3" > "$TMP/noisy"
      awk -F'\t' 'FILENAME == ARGV[1] { z[$1, $2] = 1; next } !(($1, $2) in z)' "$TMP/noisy" "$TMP/h3" > "$TMP/h3.k"; mv "$TMP/h3.k" "$TMP/h3"
    fi
    cat "$TMP/h$form" >> "$TMP/hits"
    awk -F'\t' 'FILENAME == ARGV[1] { h[$1, $2] = 1; next } !(($1, $2) in h)' "$TMP/h$form" "$TMP/left" > "$TMP/left2"; mv "$TMP/left2" "$TMP/left"
  done
fi

# 6. Закрытие мест: строка описи с тем же файлом и тем же значением; `место:` — вид из списка и строка ±2.
awk -F'\t' -v os="$OS" -v of="$TMP/opis" "$NP_AWK"'
  function words(s, W,   n, i, w) { n = split(s, w, /[^A-Za-z0-9_.-]+/); for (i = 1; i <= n; i++) { W[w[i]] = 1; while (index(w[i], ".") > 0) { sub(/^[^.]*\./, "", w[i]); W[w[i]] = 1 } } }
  BEGIN {
    while ((getline l < of) > 0) {
      split(l, a, "\t")
      if (a[1] == "A" && a[5] != "") { nc++; cf[nc] = np(a[5]); delete W; words(a[4], W); for (w in W) ctok[nc, w] = 1; ck[nc] = "строка"; cl[nc] = 0 }
      if (a[1] == "M" && a[4] != "") { nc++; cf[nc] = np(a[4]); delete W; words(a[2], W); for (w in W) ctok[nc, w] = 1
        ck[nc] = (a[3] ~ /^(переход|проверка|отправка|чтение|сравнение)$/) ? "место" : "вид"; cl[nc] = a[5] + 0 }
    }
  }
  { t = $1; v = $2; f = $3; n = $4 + 0; k = t SUBSEP v SUBSEP f
    if (!(k in seen)) { seen[k] = 1; ko[++nk] = k; lines[k] = n } else lines[k] = lines[k] ", " n
    ln[k, n] = 1 }
  END {
    for (i = 1; i <= nk; i++) {
      split(ko[i], q, SUBSEP); t = q[1]; v = q[2]; f = q[3]; ok = 0; why = ""
      for (j = 1; j <= nc && !ok; j++) {
        if (!same(cf[j], f) || !((j, v) in ctok)) continue
        if (ck[j] == "строка") ok = 1
        else if (ck[j] == "вид") why = "вид места не из списка"
        else { for (d = -2; d <= 2; d++) if ((ko[i], cl[j] + d) in ln) ok = 1; if (!ok) why = "строка " cl[j] ": значения там нет" }
      }
      print (ok ? "closed" : "open") "\t" t "\t" v "\t" f "\t" lines[ko[i]] "\t" why
    }
  }' "$TMP/hits" > "$TMP/sites"

# 7. Свод: доступ, переходы, отправки по входам; правило доступа — ручкам по шаблону пути.
: > "$OUTD/svod.keys"
awk -F'\t' -v cf="$TMP/card" -v outt="$OUTD/svod.tsv" -v outm="$OUTD/svod.md" -v outk="$OUTD/svod.keys" -v itf="$TMP/items" -v kf="$TMP/kogda" "$K_AWK"'
  function tr(s) { gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function look(k) { if (k in bcls) return k; if (k_bare(k) in bcls) return k_bare(k); return k }
  function show(k,   c) { c = bcls[k]; if (c == "задачи") return "задача `" k "`"; return "`" k "`" }
  function glob2re(p,   r, i, ch) {
    r = ""; for (i = 1; i <= length(p); i++) { ch = substr(p, i, 1)
      if (ch == "*" && substr(p, i + 1, 1) == "*") { r = r ".*"; i++ } else if (ch == "*") r = r "[^/]*"
      else if (ch ~ /[.?+()|\[\]{}^$\\]/) r = r "\\" ch; else r = r ch }
    return "^" r "/?$" }
  function pathmatch(re, path,   s) { s = path; while (s != "") { if (s ~ re) return 1; if (index(substr(s, 2), "/") == 0) return 0; s = substr(s, index(substr(s, 2), "/") + 1) } return 0 }
  BEGIN {
    while ((getline l < cf) > 0) { split(l, a, "\t")
      if (a[1] == "B") { bcls[a[3]] = a[2]; bpur[a[3]] = a[4]; if (a[2] == "контракт") ck[++nck] = a[3]; if (a[2] == "топики" && a[3] ~ /^публикует /) { t = a[3]; sub(/^публикует /, "", t); pub[t] = 1 } }
      if (a[1] == "F") { ftn[a[2] "." a[3]] = a[5]; fvs[a[2] "." a[3]] = a[6] } }
  }
  $1 == "A" { e = look($3); n++; V[n] = $2; IN[n] = e; T[n] = $4; FL[n] = $5
    if ($2 == "доступ") acc[e] = (acc[e] == "" ? "" : acc[e] "; ") $4
    next }
  $1 == "P" { pv[$2] = $3; next }
  $1 == "S" { if (!($2 in ds)) dso[++nds] = $2; ds[$2] = $3; next }
  $1 == "SF" { dsf[$2] = dsf[$2] "\001" $3; next }
  $1 == "R" { nr++; RP[nr] = $2; RR[nr] = $3; RF[nr] = $4; next }
  $1 == "O" { snd[$2] = $3; next }
  END {
    print "вид\tобъект\tзначение\tиз\tвход\tназначение\tусловие\tфайл" > outt
    # правила доступа по шаблону пути — ручкам контракта
    for (i = 1; i <= nr; i++) { re = glob2re(RP[i]); hit = 0
      for (j = 1; j <= nck; j++) { k = ck[j]; if (k !~ /^[A-Z]+ \//) continue; p = k; sub(/^[A-Z]+ /, "", p)
        if (pathmatch(re, p)) { hit++; m = split(RR[i], rr, " "); for (q = 1; q <= m; q++) { role[rr[q]] = 1; rin[rr[q], k] = "из конфига " RP[i]; if (!((rr[q], k) in rseen)) { rseen[rr[q], k] = 1; ro[rr[q]] = ro[rr[q]] "\001" k } }
          acc[k] = (acc[k] == "" ? "" : acc[k] "; ") RR[i] " (из конфига)" } }
      if (!hit) print "RULE\tправило доступа «" RP[i] "» не подошло ни к одной ручке — " RF[i] > itf }
    for (i = 1; i <= n; i++) {
      e = IN[i]; t = T[i]
      if (V[i] == "доступ") {
        r = t; c = ""; p = index(r, ";"); if (p > 0) { c = tr(substr(r, p + 1)); r = substr(r, 1, p - 1) }
        if (r ~ /^[ \t]*без проверки/) { role["без входа"] = 1; if (!(("без входа", e) in rseen)) { rseen["без входа", e] = 1; ro["без входа"] = ro["без входа"] "\001" e } ; continue }
        if (r ~ /^[ \t]*не определено/) continue
        m = split(r, x, ","); for (q = 1; q <= m; q++) { v = tr(x[q]); if (v == "") continue
          role[v] = 1; rin[v, e] = c; if (!((v, e) in rseen)) { rseen[v, e] = 1; ro[v] = ro[v] "\001" e }
          print "роль\t" v "\t\t\t" e "\t" bpur[e] "\t" c "\t" FL[i] > outt }
      } else if (V[i] == "меняет") {
        if (tr(t) == "нет") continue
        p = index(t, "→"); if (p == 0) continue
        lhs = tr(substr(t, 1, p - 1)); rhs = tr(substr(t, p + 3)); c = ""; q = index(rhs, " — "); if (q > 0) { c = tr(substr(rhs, q + 5)); rhs = substr(rhs, 1, q - 1) }
        to = rhs; sub(/[ \t].*/, "", to); to = tr(to); fe = lhs; sub(/[ \t].*/, "", fe); from = tr(substr(lhs, length(fe) + 1)); if (from == fe) from = ""
        if (fe !~ /\./ || to == "") continue
        st[fe] = 1; tk = fe SUBSEP to; if (!(tk in trs)) tro[fe] = tro[fe] "\001" to
        trs[tk] = trs[tk] "\001" e "\002" from "\002" c
        print "переход\t" fe "\t" to "\t" from "\t" e "\t" bpur[e] "\t" c "\t" FL[i] > outt
      } else if (V[i] == "шлёт") {
        if (tr(t) == "нет") continue
        tok = tr(t); q = index(tok, " — "); c = ""; if (q > 0) { c = tr(substr(tok, q + 5)); tok = substr(tok, 1, q - 1) }
        sub(/[ \t].*/, "", tok); sub(/\(.*$/, "", tok); tok = tr(tok); if (tok in snd) tok = snd[tok]
        if (!(tok in sk)) { sk[tok] = 1; so[++ns] = tok }
        if (!((tok, e) in sseen)) { sseen[tok, e] = 1; sndin[tok] = sndin[tok] "\001" e "\002" c }
        print "отправка\t" tok "\t\t\t" e "\t" bpur[e] "\t" c "\t" FL[i] > outt
      }
    }
    # md: роли, состояния (все значения поля — из перечисления), отправки
    print "# Свод сквозных фактов\n\nСобран скриптом по описи. Состав строк секций «Роли и доступ» и «Бизнес-правила» — отсюда; слова — твои.\n" > outm
    print "## Роли\n" > outm
    nrole = 0; for (r in role) rl[++nrole] = r
    for (i = 2; i <= nrole; i++) { sx = rl[i]; for (j = i - 1; j >= 1 && rl[j] > sx; j--) rl[j + 1] = rl[j]; rl[j + 1] = sx }
    for (i = 1; i <= nrole; i++) { r = rl[i]; print "### `" r "`" > outm; print "роль\t" r > outk; m = split(ro[r], ee, "\001")
      for (j = 2; j <= m; j++) print "- " show(ee[j]) (bpur[ee[j]] != "" ? " — " bpur[ee[j]] : "") (rin[r, ee[j]] != "" ? " — " rin[r, ee[j]] : "") > outm
      print "" > outm }
    print "## Состояния\n" > outm
    nfe = 0; for (fe in st) fl[++nfe] = fe
    for (i = 2; i <= nfe; i++) { sx = fl[i]; for (j = i - 1; j >= 1 && fl[j] > sx; j--) fl[j + 1] = fl[j]; fl[j + 1] = sx }
    for (ii = 1; ii <= nfe; ii++) { fe = fl[ii]; tp = ftn[fe]
      vals = (tp != "" && (tp in pv)) ? pv[tp] : fvs[fe]
      print "### `" fe "`" (tp != "" ? " (тип `" tp "`)" : "") "\n" > outm
      nv = split(vals, VV, " "); delete vseen
      for (j = 1; j <= nv; j++) vseen[VV[j]] = 1
      m = split(tro[fe], tt, "\001"); for (j = 2; j <= m; j++) if (!(tt[j] in vseen)) VV[++nv] = tt[j]
      en = fe; sub(/\..*/, "", en)
      for (j = 1; j <= nv; j++) { v = VV[j]; print "#### `" v "`" > outm; print "объект\t" en "\t" v > outk
        if (!((fe, v) in trs)) { print "- переходов нет\n" > outm; continue }
        q = split(trs[fe, v], ee, "\001")
        for (z = 2; z <= q; z++) { split(ee[z], w, "\002"); print "- " show(w[1]) (bpur[w[1]] != "" ? " — " bpur[w[1]] : "") (w[2] != "" ? " — из `" w[2] "`" : "") (acc[w[1]] != "" ? " — доступ: " acc[w[1]] : "") (w[3] != "" ? " — условие: " w[3] : "") > outm }
        print "" > outm } }
    if (nds > 0) {
      print "## Состояния по датам\n" > outm
      for (i = 1; i <= nds; i++) { e = dso[i]; print "### `" e "` (поля " ds[e] ")" > outm; print "объект\t" e "\t" > outk
        m = split(dsf[e], ee, "\001"); for (j = 2; j <= m; j++) print "- " ee[j] > outm
        if (m < 2) print "- фактов нет" > outm
        print "" > outm }
    }
    print "## Отправки\n" > outm
    for (i = 1; i <= ns; i++) { tok = so[i]; print "### `" tok "`" > outm; print "сообщение\t" tok > outk; m = split(sndin[tok], ee, "\001")
      for (j = 2; j <= m; j++) { split(ee[j], w, "\002"); print "- " show(w[1]) (bpur[w[1]] != "" ? " — " bpur[w[1]] : "") (w[2] != "" ? " — повод: " w[2] : "") > outm; print tok "\t" show(w[1]) > kf }
      print "" > outm }
    # публикуемый топик без единой отправки и без отправителя — пункт SENDER
    for (t in pub) if (!(t in sk)) { hs = 0; for (m2 in snd) if (snd[m2] == t) hs = 1; if (!hs) print "SENDER\tпубликует " t > itf }
    printf "свод: ролей %d, полей-состояний %d, отправок %d\n", nrole, length_st(), ns
  }
  function length_st(   k, c) { c = 0; for (k in st) c++; return c }
' "$TMP/opis" | tee "$TMP/sum"
: >> "$TMP/items"; : >> "$TMP/kogda"

# 8. Пункты: перечисление без строки — хозяину файла объявления; незакрытое место — хозяину файла места.
awk -F'\t' -v df="$TMP/decl" -v of="$TMP/opis" -v cf="$TMP/card" '
  BEGIN { while ((getline l < of) > 0) { split(l, a, "\t"); if (a[1] == "P") have[a[2]] = 1 }
          while ((getline l < cf) > 0) { split(l, a, "\t"); if (a[1] == "F" && a[5] != "") { t = a[5]; uses[t] = uses[t] (uses[t] == "" ? "" : ", ") a[2] "." a[3] } } }
  FILENAME == df { if (!($1 in have)) print "ENUM\tперечисление " $1 (uses[$1] != "" ? " (поля " uses[$1] ")" : "") ": нет строки «перечисление:» — " $2; next }
  $1 == "open" { print "MESTO\t" ($2 == "отправитель" ? "вызов отправителя ." $3 "()" : ($2 == "роль" ? "роль " $3 : $2 "." $3)) ": строки " $5 (($6 != "") ? " (" $6 ")" : "") " — " $4 }
' "$TMP/decl" "$TMP/sites" >> "$TMP/items"
cp "$TMP/items" "$OUTD/svod.items"

# 9. Черновик: у блока «публикует <топик>» строка `- когда:` — входы из свода, которых в ней ещё нет.
if [ -s "$TMP/kogda" ]; then
  awk -v kf="$TMP/kogda" "$K_AWK"'
    BEGIN { while ((getline l < kf) > 0) { split(l, a, "\t"); w[a[1]] = w[a[1]] "\001" a[2] } }
    function fill(   m, i, add, x, s) {
      if (top == "" || !(top in w)) return
      m = split(w[top], x, "\001"); add = ""
      for (i = 2; i <= m; i++) { s = x[i]; if (index(kline, s) == 0 && index(add, s) == 0) add = add (add == "" ? "" : ", ") s }
      if (add == "") return
      if (kn == 0) { ins[blockend] = ins[blockend] "\n- когда: " add; filled++ }
      else { if (L[kn] ~ /^- когда:[ \t]*(не определено.*)?$/) L[kn] = "- когда: " add; else L[kn] = L[kn] "; " add; filled++ }
    }
    { sub(/\r$/, ""); L[NR] = $0 }
    /^## / { fill(); sec = $0; top = ""; next }
    /^### / { fill(); top = ""; kn = 0; kline = ""
      if (sec ~ /^## События/) { h = substr($0, 5); k = k_canon("топики", h); if (k ~ /^публикует /) { top = k; sub(/^публикует /, "", top); blockend = NR } }
      next }
    top != "" && /^- когда:/ { kn = NR; kline = $0 }
    top != "" && $0 !~ /^[ \t]*$/ { blockend = NR }
    END { fill()
      for (i = 1; i <= NR; i++) { print L[i]; if (i in ins) print substr(ins[i], 2) }
      printf "когда: дописано у %d блоков публикации\n", filled + 0 > "/dev/stderr" }
  ' "$DRAFT" > "$TMP/draft.new" 2> "$TMP/kogda.sum" && cat "$TMP/draft.new" > "$DRAFT"
  cat "$TMP/kogda.sum"
fi

# Итог.
nd=$(wc -l < "$TMP/decl" | tr -d ' '); ne=$(grep -c '^ENUM	' "$TMP/items")
echo "перечисления: по шаблону объявлено ${nd}, без строки «перечисление:» ${ne}${DECL_NOTE:+ — $DECL_NOTE}"
[ -n "${NODECL:-}" ] && echo "перечисления описи без объявления по шаблону (шаблон узок или тип из библиотеки): $NODECL"
awk -F'\t' '{ n++; f[$4] = 1; if ($1 == "closed") c++; else o++ } END { nf = 0; for (k in f) nf++; printf "места: %d в файлах %d, закрыто %d, не закрыто %d\n", n + 0, nf, c + 0, o + 0 }' "$TMP/sites"
[ -s "$TMP/noisy" ] && { printf 'шумные значения (словом в 40 файлах и больше — сверки нет): '; awk -F'\t' '{ printf "%s%s.%s (%d)", (NR > 1 ? "; " : ""), $1, $2, $3 } END { print "" }' "$TMP/noisy"; }
grep -c '^SENDER	' "$TMP/items" | awk '{ if ($1 > 0) print "публикуемых топиков без отправки и отправителя: " $1 }'
grep '^RULE	' "$TMP/items" | cut -f2
echo "свод: $OUTD/svod.md; пункты: $OUTD/svod.items ($(grep -c -v '^RULE	' "$TMP/items" | tr -d ' '))"
