#!/usr/bin/env bash
set -u
cd /c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval
R=runs/2026-08-28-gui
NEW=/c/Users/Konstantin/projects/product-skills/agent-version/analyst-workspace
BASE=/c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval/$R/_src-base/analyst-workspace
for f in GS-NOCUT GS-FND GS-REWORK; do
  echo "=== ПОСЛЕ / $f ==="; SKILL_SRC=$NEW  ./run-gui.sh "$f" "$R/after-silent" 5 5
  echo "=== ДО / $f ===";    SKILL_SRC=$BASE ./run-gui.sh "$f" "$R/base-silent"  5 5
done
echo "ВСЕ 30 ПРОГОНОВ ЗАВЕРШЕНЫ"
