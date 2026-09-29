#!/usr/bin/env bash
# run-round-diag.sh — драйвер плеча раунда «схема взаимодействий» (PLAN-DIAGRAM.md):
# гонит пробы спеки по очереди на run-ctx-v2.sh, пишет _driver.log и _done.txt.
#   ./run-round-diag.sh <папка-раунда> <N> [параллельность] [пробы...]
set -u
ROUND="${1:?папка раунда}"; N="${2:-10}"; CONC="${3:-5}"; shift 3 2>/dev/null || shift $#
PROBES="${*:-ts-conv ts-live ts-ctx bf-spec ts-conv2}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$ROUND"
LOG="$ROUND/_driver.log"
echo "=== $(date '+%H:%M:%S') старт: $PROBES; N=$N conc=$CONC" >> "$LOG"
for p in $PROBES; do
  echo "--- $(date '+%H:%M:%S') $p" >> "$LOG"
  bash "$HERE/run-ctx-v2.sh" "$p" "$ROUND" "$N" "$CONC" > "$ROUND/$p.log" 2>&1
  echo "    $(date '+%H:%M:%S') $p завершена, код $?" >> "$LOG"
done
echo "=== $(date '+%H:%M:%S') готово" >> "$LOG"
echo "DONE $(date '+%F %H:%M:%S') $PROBES" > "$ROUND/_done.txt"
