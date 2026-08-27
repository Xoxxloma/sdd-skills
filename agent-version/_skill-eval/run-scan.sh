#!/usr/bin/env bash
# run-scan.sh <промпт.md> <каталог-плеча> <N> [параллельность] — пул прогонов ТИРА A.
#
# Отличие от `run-pool.sh`: субагент скилла целиком НЕ читает. Он получает бриф, форму карточки
# путём и содержимое репозитория — ровно то, что ему передаёт ведущий на Шаге 3. Промпт целиком
# собирает `make-sm86-prompt.sh` из указанной версии SKILL.md, поэтому плечи `before`/`after`
# отличаются ровно правкой скилла.
#
# Guard'ы взяты у `run-pool.sh` дословно: отказ раннера обязан выпадать в «не измерено», а не в
# «провалено», и по размеру файла он не виден.
set -u
PROMPT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"; N="$3"; CONC="${4:-5}"
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }
mkdir -p "$OUT"

run_one() {
  local i="$1" sb="$OUT/run-$1"
  mkdir -p "$sb"
  if [ -s "$sb/answer.md" ]; then echo "  run-$i — уже есть, пропуск"; return 0; fi
  # Промпт подаётся stdin, а не аргументом: на Windows длина командной строки ограничена ~32 КБ,
  # и промпт SM-BULK (33 КБ) в неё не влез — пять прогонов упали с rc=126 «Argument list too long»,
  # причём в answer.md при этом не было ничего, то есть по размеру отказ виден не был.
  ( cd "$sb" && timeout 900 claude -p --model haiku --permission-mode bypassPermissions < "$PROMPT" ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?
  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/answer.md" 2>/dev/null; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"; echo "  run-$i — ОТКАЗ API, в счёт не идёт"; return 0
  fi
  if [ $rc -ne 0 ] || [ ! -s "$sb/answer.md" ]; then echo "  run-$i — ОТКАЗ (rc=$rc)"; else
    echo "  run-$i — готов ($(wc -l < "$sb/answer.md") строк)"; fi
}

echo "плечо: $OUT   промпт: $PROMPT   прогонов: $N, параллельно: $CONC"
running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait
echo "ГОТОВО: $OUT — с ответом $(find "$OUT" -name answer.md -size +0 | wc -l) из $N"
