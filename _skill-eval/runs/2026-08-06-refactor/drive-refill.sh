#!/usr/bin/env bash
# Добор после отказа API. Раннер идемпотентен: песочница с непустым answer.md пропускается,
# а отравленные ответы уже переименованы в `_api-failure.txt`, поэтому перегоняются ровно те
# прогоны, которых не хватает.
#
# Параллельность снижена до 3: круг упёрся в лимит на десяти одновременных процессах.
# `q2` не добирается сознательно — разбор проб назвал его лишним для этой правки
# (мишень Q-2 — TL;DR 3 и Step 2, обе не тронуты; ту же развилку острее меряет BR-4).

set -u
cd "$(dirname "$0")/../../.." || exit 1
ROOT="_skill-eval/runs/2026-08-06-refactor"

for setup in br3 bs9 bs1 q1; do
  for arm in A B; do
    have=$(find "$ROOT/$setup-$arm" -name answer.md -size +0 2>/dev/null | wc -l)
    if [ "$have" -ge 10 ]; then echo "### $setup-$arm уже полон ($have) — пропуск"; continue; fi
    echo "############ добор $setup / вариант-$arm (было $have) ############"
    bash _skill-eval/run-pool.sh \
      "$ROOT/_arms/variant-$arm.md" \
      "_skill-eval/fixtures/${setup}-prompt.txt" \
      "$ROOT/$setup-$arm" \
      10 3
  done
done

echo
echo "=========== ИТОГ ДОБОРА ==========="
for setup in br1 br2 br3 br4 bs1 bs6 bs9 q1; do
  for arm in A B; do
    d="$ROOT/$setup-$arm"
    printf "%-6s вариант-%s: ответов %2s, отказов API %2s\n" "$setup" "$arm" \
      "$(find "$d" -name answer.md -size +0 2>/dev/null | wc -l)" \
      "$(find "$d" -name _api-failure.txt 2>/dev/null | wc -l)"
  done
done
