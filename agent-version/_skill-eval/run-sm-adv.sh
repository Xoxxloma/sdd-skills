#!/usr/bin/env bash
# run-sm-adv.sh <плечо> <N> [параллельность] — пробы SM-ADV на реальном коде: обёртка над
# runs/2026-08-24-sm-real/run.sh. Сам run.sh не правится: в папку раунда кладётся его копия с двумя
# подменами — засев fixtures/SM-ADV/seed.sh (обёртка над SM-REAL/seed.sh) и промпт из SM_ADV_PROMPT.
#
#   ROUND_DIR=runs/<дата>-adv-<проба> SM_ADV_PROMPT=fixtures/SM-ADV/prompts/<…>.md ./run-sm-adv.sh rescan 3 3
#
# Переменные засева (см. fixtures/SM-ADV/seed.sh): SM_ADV_DROP, SM_ADV_PENDING, SM_ADV_CLONES, SM_ADV_MANIFEST;
# от SM-REAL: SM_REAL_PATCH, SM_RESCAN_CARDS, SM_KEYED_HINT, SM_KEYED_ARGS, SM_MODEL, SKILL_SRC.
# ROUND_DIR обязан лежать прямо в runs/: копия run.sh ищет стенд как ../../ от себя.
# Рецепты плеч — fixtures/SM-ADV/README.md.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$HERE/runs/2026-08-24-sm-real"
: "${ROUND_DIR:?ROUND_DIR обязателен: runs/<дата>-adv-<проба>}"
ROUND="$(mkdir -p "$ROUND_DIR" && cd "$ROUND_DIR" && pwd)"
case "$ROUND" in "$HERE"/runs/*) ;; *) echo "ROUND_DIR должен лежать в $HERE/runs/" >&2; exit 1 ;; esac
[ -d "$ROUND/stand" ] || cp -r "$BASE/stand" "$ROUND/stand"
sed -e 's#^FIX="\$EVAL/fixtures/SM-REAL"$#FIX="$EVAL/fixtures/SM-ADV"#' \
    -e 's#^\[ -f "\$PROMPT" \] || {#PROMPT="${SM_ADV_PROMPT:-$PROMPT}"; [ -f "$PROMPT" ] || {#' \
    "$BASE/run.sh" > "$ROUND/_run-adv.sh"
grep -q 'fixtures/SM-ADV' "$ROUND/_run-adv.sh" && grep -q 'SM_ADV_PROMPT' "$ROUND/_run-adv.sh" \
  || { echo "подмена в копии run.sh не сработала — run.sh изменился, поправь sed в $0" >&2; exit 1; }
chmod +x "$ROUND/_run-adv.sh"
{
  echo "проба SM-ADV; засев: fixtures/SM-ADV/seed.sh"
  for v in SM_ADV_PROMPT SM_ADV_DROP SM_ADV_PENDING SM_ADV_CLONES SM_ADV_MANIFEST SM_REAL_PATCH SM_RESCAN_CARDS SM_KEYED_HINT SM_KEYED_ARGS; do
    eval "x=\${$v:-}"; [ -n "$x" ] && echo "$v=$x"
  done
} > "$ROUND/_settings-adv.txt"
cat "$ROUND/_settings-adv.txt"
ROUND_DIR="$ROUND" exec bash "$ROUND/_run-adv.sh" "$@"
