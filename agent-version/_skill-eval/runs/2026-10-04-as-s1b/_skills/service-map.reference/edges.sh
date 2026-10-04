#!/usr/bin/env bash
# edges.sh — Шаг 5 без модели: обратные рёбра слепка.
#
#   bash edges.sh <папка services> <manifest.yaml>
#
# Источники — карточки `services/<name>.md`, у которых есть строка в манифесте (`_pending/` не
# смотрится вовсе): строки их «Потребляемые API» (| сервис | вызов | зачем |) и «Зависит от»
# (| сервис | зачем |). Зеркало — копия строки с заменой первой колонки на имя источника:
#   потребляемый вызов → | `<источник>` | <вызов> | <зачем> |
#   зависимость        → | `<источник>` | — | <зачем> |
# Цель — сервис из первой колонки, если у него есть карточка слепка; иначе строка пропускается
# (внешняя система, сосед вне манифеста). Секция «Кто меня потребляет» каждой карточки слепка
# пересобирается целиком: заголовок таблицы, разделитель, зеркала по возрастанию (источник, вызов);
# зеркал нет — пустая форма `| — | | |`. Пишет только эти секции; печатает итог по карточкам.
set -u
SVC="${1:?папка services}"; MAN="${2:?manifest.yaml}"
[ -d "$SVC" ] && [ -f "$MAN" ] || { echo "НЕТ ПАПКИ ИЛИ МАНИФЕСТА"; exit 2; }
export LC_ALL=C
TMP="$(mktemp -d 2>/dev/null || echo "/tmp/edges.$$")"; mkdir -p "$TMP"; trap 'rm -rf "$TMP"' EXIT

# Имена слепка: строки манифеста `name:`, у которых есть карточка.
sed 's/\r$//' "$MAN" | awk '/^[ \t-]*name:[ \t]*/ { s = $0; sub(/^[ \t-]*name:[ \t]*/, "", s); gsub(/["'\'' \t]/, "", s); if (s != "") print s }' \
  | while read -r n; do [ -f "$SVC/$n.md" ] && echo "$n"; done | sort -u > "$TMP/names"
[ -s "$TMP/names" ] || { echo "карточек слепка нет — Шага 5 нет"; exit 0; }

# Зеркала: цель<TAB>ключ-сортировки<TAB>строка.
while read -r src; do
  awk -v src="$src" -v names="$TMP/names" '
    BEGIN { while ((getline n < names) > 0) have[n] = 1 }
    function cell(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    function bare(s) { s = cell(s); gsub(/`/, "", s); return s }
    { sub(/\r$/, "") }
    /^## / { sec = $0; hdr = 0; pend = ""; next }
    sec !~ /^## (Потребляемые API|Зависит от)/ { next }
    /^\|/ {
      if ($0 ~ /^\|[ \t:|-]*$/) { hdr = 1; next }       # разделитель: всё выше было заголовком
      if (!hdr) next
      n = split($0, c, "|")
      t = bare(c[2]); if (t == "" || t == "—") next
      if (!(t in have) || t == src) { skipped++; next }
      if (sec ~ /Потребляемые API/) { call = cell(c[3]); why = cell(c[4]) } else { call = "—"; why = cell(c[3]) }
      if (call == "") call = "—"
      printf "%s\t%s\t| `%s` | %s | %s |\n", t, src "\001" bare(call), src, call, why
    }
    END { if (skipped) printf "%s\t\t#SKIP %d\n", src, skipped }
  ' "$SVC/$src.md"
done < "$TMP/names" > "$TMP/mirrors"

grep -v '#SKIP' "$TMP/mirrors" | sort -t"$(printf '\t')" -k1,1 -k2,2 > "$TMP/m.sorted"

# Пересборка секции у каждой карточки слепка.
while read -r tgt; do
  f="$SVC/$tgt.md"
  grep -q '^## Кто меня потребляет' "$f" || { echo "  $tgt — секции «Кто меня потребляет» нет, не тронута"; continue; }
  awk -F'\t' -v t="$tgt" '$1 == t { print $3 }' "$TMP/m.sorted" > "$TMP/rows"
  awk -v rows="$TMP/rows" '
    BEGIN { n = 0; while ((getline r < rows) > 0) R[++n] = r }
    { sub(/\r$/, "") }
    /^## Кто меня потребляет/ {
      print; print "| Сервис | Что вызывает | Зачем |"; print "|---|---|---|"
      if (n == 0) print "| — | | |"; else for (i = 1; i <= n; i++) print R[i]
      print ""; skip = 1; next
    }
    skip && /^## / { skip = 0 }
    skip { next }
    { print }
  ' "$f" > "$TMP/card" && mv "$TMP/card" "$f"
  echo "  $tgt — зеркал $(wc -l < "$TMP/rows" | tr -d ' ')"
done < "$TMP/names"
grep '#SKIP' "$TMP/mirrors" | awk -F'\t' '{ sub(/#SKIP /, "", $3); printf "  %s — строк в сервисы без карточки слепка: %s\n", $1, $3 }'
echo "Шаг 5: карточек слепка $(wc -l < "$TMP/names" | tr -d ' '), зеркал всего $(grep -vc '#SKIP' "$TMP/mirrors")"
