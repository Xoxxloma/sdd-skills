#!/usr/bin/env bash
set -u
cd /c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval
R=runs/2026-08-28-gui
for f in GS-START GS-RESUME GS-CUT; do
  echo "=== ПОСЛЕ / $f ==="
  SKILL_SRC=/c/Users/Konstantin/projects/product-skills/agent-version/analyst-workspace \
    ./run-gui.sh "$f" "$R/after" 5 5
done
for f in GS-START GS-RESUME GS-CUT; do
  echo "=== ДО / $f ==="
  SKILL_SRC=/c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval/$R/_src-base/analyst-workspace \
    ./run-gui.sh "$f" "$R/base" 5 5
done
echo "ВСЕ ПРОГОНЫ ЗАВЕРШЕНЫ"
