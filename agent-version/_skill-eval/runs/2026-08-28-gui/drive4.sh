#!/usr/bin/env bash
set -u
cd /c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval
R=runs/2026-08-28-gui
NEW=/c/Users/Konstantin/projects/product-skills/agent-version/analyst-workspace
BASE=/c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval/$R/_src-base/analyst-workspace
for f in GS-FND2 GS-GATE GS-BUG; do
  echo "=== ПОСЛЕ / $f ==="; SKILL_SRC=$NEW  ./run-gui.sh "$f" "$R/after-h2" 5 5
  echo "=== ДО / $f ===";    SKILL_SRC=$BASE ./run-gui.sh "$f" "$R/base-h2"  5 5
done
echo "ВСЕ 30 ПРОГОНОВ ЗАВЕРШЕНЫ"
