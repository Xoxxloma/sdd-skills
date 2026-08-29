#!/usr/bin/env bash
set -u
cd /c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval
R=runs/2026-08-28-gui
NEW=/c/Users/Konstantin/projects/product-skills/agent-version/analyst-workspace
BASE=/c/Users/Konstantin/projects/product-skills/agent-version/_skill-eval/$R/_src-base/analyst-workspace
echo "=== ПОСЛЕ+ГЕЙТ / GS-CUT (побочка гейта) ==="; SKILL_SRC=$NEW ./run-gui.sh GS-CUT "$R/after-fix2" 5 5
echo "=== ПОСЛЕ+ГЕЙТ / GS-START (побочка гейта) ==="; SKILL_SRC=$NEW ./run-gui.sh GS-START "$R/after-fix2" 5 5
echo "=== ПОСЛЕ+ГЕЙТ / GS-RESUME добор до N=10 ==="; SKILL_SRC=$NEW ./run-gui.sh GS-RESUME "$R/after-fix2-b" 5 5
echo "=== ДО / GS-RESUME добор до N=10 ==="; SKILL_SRC=$BASE ./run-gui.sh GS-RESUME "$R/base-b" 5 5
echo "ВСЕ 20 ПРОГОНОВ ЗАВЕРШЕНЫ"
