#!/usr/bin/env bash
# run-trigger-bare.sh — КОНТРОЛЬ к замеру автосрабатывания приёмки.
#
#   ./run-trigger-bare.sh <промпт.txt> <каталог-плеча> <N> [параллельность] [засев]
#
# ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. В `run-trigger.sh` промпт стенда велит агенту «прочитай целиком
# файл <скилл> и действуй строго по нему». Это законно для замера скилла автора, но для
# вопроса «дотянется ли агент до ДРУГОГО скилла» оно само может быть причиной отказа:
# инструкция «действуй строго по этому» правдоподобно читается как «и ни по чему больше».
# Нулевой результат с таким конфаундом результатом не является.
#
# Здесь скилла автора нет вовсе. В песочнице лежит готовая спека и приёмка в реестре
# (`.claude/skills/spec-review/`), а промпт — обычная просьба аналитика, слово в слово из
# триггеров в описании приёмки. Если она не вызовется и здесь — дело в самом триггере,
# а не в обёртке стенда.

set -u

PROMPT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"
N="$3"
CONC="${4:-5}"
SEED="${5:-}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVIEW_SKILL="$REPO/agent-version-3.2/spec-review"

[ -f "$PROMPT" ] || { echo "нет файла промпта: $PROMPT"; exit 1; }
[ -d "$REVIEW_SKILL" ] || { echo "нет скилла приёмки: $REVIEW_SKILL"; exit 1; }
if [ -n "$SEED" ]; then
  [ -d "$SEED" ] || { echo "нет папки засева: $SEED"; exit 1; }
  SEED="$(cd "$SEED" && pwd)"
fi
mkdir -p "$OUT"

run_one() {
  local i="$1"
  local sb="$OUT/run-$i"
  mkdir -p "$sb"
  if [ -s "$sb/stream.jsonl" ]; then echo "  run-$i — уже есть, пропуск"; return 0; fi
  local abs_sb
  abs_sb="$(cd "$sb" && pwd)"

  mkdir -p "$abs_sb/.claude/skills"
  cp -r "$REVIEW_SKILL" "$abs_sb/.claude/skills/" 2>/dev/null
  [ -n "$SEED" ] && cp -r "$SEED"/. "$abs_sb"/ 2>/dev/null
  ( cd "$abs_sb" && find . -type f -not -name '_seeded.txt' | sed 's|^\./||' | sort ) > "$abs_sb/_seeded.txt"

  # Ни слова про скиллы: пусть модель сама решает, чем это делать.
  local task="Твоя рабочая директория — ${abs_sb}. Считай её корнем рабочего репозитория.

Интерактивного инструмента вопросов (AskUserQuestion) в этом окружении нет. Если нужно что-то спросить — спрашивай обычным текстом.

Сообщение пользователя лежит в файле ${PROMPT}. Прочитай его и ответь на него. Твой ответ — то, что ты сказал бы пользователю в чат."

  ( cd "$sb" && timeout 900 claude -p "$task" --model haiku --permission-mode bypassPermissions \
      --output-format stream-json --verbose ) \
      > "$sb/stream.jsonl" 2> "$sb/_stderr.log"
  local rc=$?

  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/stream.jsonl" 2>/dev/null; then
    mv "$sb/stream.jsonl" "$sb/_api-failure.txt"
    echo "  run-$i — ОТКАЗ API, песочница помечена и в счёт не идёт"
    return 0
  fi
  [ $rc -ne 0 ] || [ ! -s "$sb/stream.jsonl" ] && echo "  run-$i — ОТКАЗ (rc=$rc)" || echo "  run-$i — готов"
}

echo "плечо-контроль: $OUT"
echo "промпт: $PROMPT"
echo "прогонов: $N, параллельно: $CONC"

running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait
echo "ГОТОВО: $OUT — песочниц с потоком: $(find "$OUT" -name stream.jsonl -size +0 | wc -l) из $N"
