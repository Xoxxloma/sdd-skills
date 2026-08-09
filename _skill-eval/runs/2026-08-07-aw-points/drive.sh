#!/usr/bin/env bash
# Раунд aw-points: остальные точки приёмки в маршруте оркестратора.
#
#   ./runs/2026-08-07-aw-points/drive.sh <суффикс-плеча> <N> [параллельность]
#
# Запускать ИЗ каталога _skill-eval. Суффикс задаёт папку: <проба>-<суффикс>.
# Пилот — `./drive.sh pilot 1 1`, полный круг — `./drive.sh arm 15 5`.
#
# Плечо одно на каждую пробу: сравнивать не с чем. Точка 1 (БТ) уже закрыта раундом
# aw-review, и мерить здесь надо не «стало ли лучше», а «срабатывает ли вообще».

set -u
SUF="${1:-arm}"
N="${2:-15}"
CONC="${3:-5}"

R=runs/2026-08-07-aw-points
S=../agent-version-3.2/analyst-workspace/SKILL.md

for p in spec stages children readybt; do
  case "$p" in
    spec)     SEED=$R/seed-spec ;;
    stages)   SEED=$R/seed-stages ;;
    children) SEED=$R/seed-children ;;
    readybt)  SEED=$R/seed-epicbt ;;
  esac
  echo "=== проба $p ==="
  ./run-trigger.sh "$S" "$R/prompt-$p.txt" "$R/$p-$SUF" "$N" "$CONC" "$SEED"
done

echo
echo "готово. дальше:"
echo "  cd $R && node extract.mjs $(for p in spec stages children readybt; do printf '%s ' "$p-$SUF"; done)"
echo "  node grade-points.mjs $(for p in spec stages children readybt; do printf '%s ' "$p-$SUF"; done)"
