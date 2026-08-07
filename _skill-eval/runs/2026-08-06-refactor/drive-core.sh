#!/usr/bin/env bash
# Ядро регресса: три сетапа, каждый на обоих плечах. Пулы идут последовательно, чтобы не
# держать три десятка процессов разом; внутри пула параллельность 5.
#
# Сетапы выбраны как заведомо задетые правкой (какие ещё нужны — скажет анализ проб):
#   br2  — запрет дизайна и выдуманные роли (BR-2) + односоставный разрез (BS-3)
#   bs6  — §4.5 на слитной форме (BS-6) + утечка процедуры в документ (BS-8)
#   bs9  — «Статус готовности» числом (BS-9) + путь записи (BS-10)

set -u
cd "$(dirname "$0")/../../.." || exit 1
ROOT="_skill-eval/runs/2026-08-06-refactor"
N="${1:-10}"

for setup in br2 bs6 bs9; do
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
echo "=========== ИТОГ ПО ДИСКУ ==========="
for setup in br2 bs6 bs9; do
  for arm in A B; do
    d="$ROOT/$setup-$arm"
    printf "%-8s вариант-%s: ответов %s, БТ на диске %s\n" "$setup" "$arm" \
      "$(find "$d" -name answer.md -size +0 2>/dev/null | wc -l)" \
      "$(find "$d" -name business_requirements.md 2>/dev/null | wc -l)"
  done
done
