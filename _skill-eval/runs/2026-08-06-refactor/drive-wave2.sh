#!/usr/bin/env bash
# Вторая волна регресса. Сетапы выбраны по инвентарю проб:
#   br1  — тонкий бриф, ключа нет: BR-1 (верно НЕ писать, вести с ключа)
#   br3  — полный бриф первым сообщением: BR-3
#   br4  — тот же минус четыре гейта: BR-4
#   bs1  — четыре пробы с одного артефакта: BS-1 (форма §4.5), BS-2 (анти-рационализация),
#          BS-4 (разрез в хендоффе), Q-6 (слайсы названы словами)
#   q1   — качество вопросов turn-1: Q-1
#   q2   — присланное не переспрашивают: Q-2
#
# br1/br3/br4 обязательны: правило turn-1 переписано сильнее всего остального.
# bs1 обязателен: снимает четыре пробы за один пул.

set -u
cd "$(dirname "$0")/../../.." || exit 1
ROOT="_skill-eval/runs/2026-08-06-refactor"
N="${1:-10}"

for setup in br1 br3 br4 bs1 q2 q1; do
  for arm in A B; do
    echo "############ $setup / вариант-$arm ############"
    bash _skill-eval/run-pool.sh \
      "$ROOT/_arms/variant-$arm.md" \
      "_skill-eval/fixtures/${setup}-prompt.txt" \
      "$ROOT/$setup-$arm" \
      "$N" 5
  done
done

echo
echo "=========== ИТОГ ВТОРОЙ ВОЛНЫ ==========="
for setup in br1 br3 br4 bs1 q2 q1; do
  for arm in A B; do
    d="$ROOT/$setup-$arm"
    printf "%-6s вариант-%s: ответов %s, БТ на диске %s\n" "$setup" "$arm" \
      "$(find "$d" -name answer.md -size +0 2>/dev/null | wc -l)" \
      "$(find "$d" -name business_requirements.md 2>/dev/null | wc -l)"
  done
done
