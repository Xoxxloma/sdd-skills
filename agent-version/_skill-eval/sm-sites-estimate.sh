#!/usr/bin/env bash
# sm-sites-estimate.sh — оценка Э1 плана PLAN-SM-CROSSCUT без модели: сколько мест значений перечислений
# придётся закрыть каждой части. Стенд, в скилл не идёт. Стек — Java (перечисления `enum Имя { A, B }`).
#
#   bash sm-sites-estimate.sh <карточка services/<name>.md> <корни через запятую> [<plan.tsv>]
#
# Имена типов полей «Владеет данными» берутся из готовой карточки; объявление и значения — из кода (*.java);
# места считает svod.sh скилла по синтетической описи из строк `перечисление:` (строк привязки нет, поэтому
# все места «не закрыты» — это и есть объём). С plan.tsv места раскладываются по частям плана (путь —
# ближайшая папка или файл части), без него — по папкам первого уровня под корнем.
# Роли и отправители не считаются: их списка без новой описи нет.
set -u
CARD="${1:?карточка}"; ROOTS="${2:?корни через запятую}"; PLAN="${3:-}"
[ -f "$CARD" ] || { echo "НЕТ ФАЙЛА: $CARD"; exit 2; }
HERE="$(cd "$(dirname "$0")" && pwd)"
SVOD="$HERE/../service-map-2.0/reference/svod.sh"
[ -f "$SVOD" ] || { echo "НЕТ ФАЙЛА: $SVOD"; exit 2; }
export LC_ALL=C
T="$(mktemp -d)"; [ -n "${EST_KEEP:-}" ] && echo "временная папка: $T" || trap 'rm -rf "$T"' EXIT
tr -d '\r' < "$CARD" > "$T/card.md"

# 1. Имена типов полей (не сущности).
awk '
  /^## / { s = $0; next }
  s ~ /^## Владеет данными/ && /^### / { h = $0; sub(/^### /, "", h); gsub(/`/, "", h); sub(/ .*/, "", h); ent[h] = 1; next }
  s ~ /^## Владеет данными/ && /^- / { l = substr($0, 3); p = index(l, ":"); if (!p) next; t = substr(l, p + 1); gsub(/[`?]/, "", t); sub(/^[ \t]+/, "", t); sub(/[ \t].*/, "", t); sub(/\[\]$/, "", t)
    if (match(t, /<[A-Za-z_][A-Za-z0-9_]*>$/)) t = substr(t, RSTART + 1, RLENGTH - 2); if (t ~ /^[A-Z][A-Za-z0-9_]*$/) c[t] = 1 }
  END { for (t in c) if (!(t in ent)) print t }' "$T/card.md" | sort -u > "$T/types"
echo "типов полей (не сущности): $(wc -l < "$T/types" | tr -d ' ')"
[ -s "$T/types" ] || exit 0

# 2. Объявления enum и значения: от «enum Имя {» до первой «;» или «}».
IFS=',' read -r -a RR <<< "$ROOTS"
alt="$(paste -sd'|' "$T/types")"
grep -rlE --include='*.java' "\\benum[[:space:]]+($alt)\\b" "${RR[@]}" 2>/dev/null | grep -v -E '/src/test/|/test/' > "$T/declfiles"
: > "$T/opis.md"
while IFS= read -r f; do
  tr -d '\r' < "$f" | awk -v f="$f" -v tf="$T/types" '
    BEGIN { while ((getline t < tf) > 0) want[t] = 1 }
    function done_(   b, n, x, i, v, vals) {
      if (buf !~ /[;}]/ || index(buf, "{") == 0) return
      b = substr(buf, index(buf, "{") + 1); sub(/[;}].*/, "", b)
      gsub(/\([^)]*\)/, "", b); n = split(b, x, ","); vals = ""
      for (i = 1; i <= n; i++) { v = x[i]; gsub(/@[A-Za-z_.]+/, "", v); gsub(/[ \t]/, "", v); if (v ~ /^[A-Z][A-Z0-9_]*$/) vals = vals (vals == "" ? "" : " | ") v }
      if (vals != "") print "перечисление: " nm " " vals " — " f
      on = 0; buf = ""
    }
    on { buf = buf " " $0; done_(); next }
    match($0, /enum[ \t]+[A-Za-z_][A-Za-z0-9_]*/) { n = substr($0, RSTART, RLENGTH); sub(/^enum[ \t]+/, "", n); if (!(n in want)) next
      on = 1; nm = n; buf = substr($0, RSTART + RLENGTH); done_() }' >> "$T/opis.md"
done < "$T/declfiles"
echo "перечислений объявлено и разобрано: $(grep -c '^перечисление:' "$T/opis.md")"

# 3. Места — svod.sh (без строк привязки все места открыты).
printf '%s\n' "${RR[@]}" | awk '{ print "корень\t" $0 }' > "$T/plan.tsv"
bash "$SVOD" "$T/opis.md" "$T/card.md" "$T/svod" "$T/plan.tsv" | grep -E '^(места|шумные)'
awk -F'\t' '$1 == "MESTO" { s = $2; p = index(s, " — "); f = substr(s, p + 5); m = s; sub(/^[^:]*: строки /, "", m); sub(/ .*/, "", m); n = split(m, x, ","); print f "\t" n }' "$T/svod/svod.items" > "$T/sites"

# 4. По частям плана либо по папкам первого уровня.
if [ -n "$PLAN" ] && [ -f "$PLAN" ]; then
  tr -d '\r' < "$PLAN" | awk -F'\t' 'FNR == NR { if ($1 == "путь") { pp[++np] = $2; pk[np] = $3; pn[np] = $4 }; next }
    { f = $1; best = 0; who = "остаток"
      for (i = 1; i <= np; i++) { p = pp[i]; ok = (pk[i] == "файлы") ? (f == p || substr(f, length(f) - length(p) + 1) == p) : (index(f, p "/") > 0)
        if (ok && length(p) > best) { best = length(p); who = "часть " pn[i] } }
      n[who] += $2; fl[who]++ }
    END { for (w in n) printf "%s\tстрок кода %d, пар «файл — значение» %d\n", w, n[w], fl[w] }' - "$T/sites" | sort
else
  awk -F'\t' -v roots="$ROOTS" 'BEGIN { nr = split(roots, R, ",") }
    { f = $1; g = f; for (i = 1; i <= nr; i++) if (index(f, R[i] "/") == 1) { g = substr(f, length(R[i]) + 2); break }
      sub(/\/.*/, "", g); n[g] += $2; fl[g]++ }
    END { for (w in n) printf "%s\tстрок кода %d, пар «файл — значение» %d\n", w, n[w], fl[w] }' "$T/sites" | sort
fi
