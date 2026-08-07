#!/usr/bin/env bash
# run-followup.sh — двухходовая проба: что будет, если аналитик переспросит.
#
#   ./run-followup.sh <скилл.md> <промпт1.txt> <вопрос2> <каталог-плеча> <N> [парал] [засев]
#
# ЗАЧЕМ. Замер круга 1 показал: 3 прогона из 10 загружают приёмку и объявляют, что ждут
# результат. Фонового задания при этом нет — вызов скилла синхронен, он лишь кладёт инструкцию
# в контекст. Значит результат не придёт сам никогда. Открытый вопрос один и он решает, чем
# считать этот дефект:
#
#   - аналитик переспрашивает «ну что там?» → агент поднимает субагента и проверка ВСЁ-ТАКИ
#     проходит. Тогда дефект — задержка на один ход, неприятно и не более;
#   - агент отвечает по памяти, не поднимая субагента. Тогда дефект — ЛОЖНЫЙ ЗЕЛЁНЫЙ, и это
#     хуже, чем не иметь приёмки вовсе: человек получает подтверждение, которого не было.
#
# Ход 2 идёт через `claude -p --continue` в той же песочнице, то есть в том же разговоре с
# тем же контекстом — иначе меряли бы новый разговор, а не переспрос.

set -u

SKILL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
PROMPT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
Q2="$3"
OUT="$4"
N="$5"
CONC="${6:-5}"
SEED="${7:-}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVIEW_SKILL="$REPO/agent-version-3.2/spec-review"

[ -f "$SKILL" ]  || { echo "нет скилла: $SKILL";  exit 1; }
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }
[ -n "$SEED" ] && SEED="$(cd "$SEED" && pwd)"
mkdir -p "$OUT"

run_one() {
  local i="$1"
  local sb="$OUT/run-$i"
  mkdir -p "$sb"
  if [ -s "$sb/turn2.jsonl" ]; then echo "  run-$i — уже есть, пропуск"; return 0; fi
  local abs_sb; abs_sb="$(cd "$sb" && pwd)"

  mkdir -p "$abs_sb/.claude/skills"
  cp -r "$REVIEW_SKILL" "$abs_sb/.claude/skills/" 2>/dev/null
  [ -n "$SEED" ] && cp -r "$SEED"/. "$abs_sb"/ 2>/dev/null

  local task="Твоя рабочая директория — ${abs_sb}. Считай её корнем рабочего репозитория. Ничего за её пределами не создавай и не изменяй.

Прочитай целиком файл ${SKILL} — это скилл. Дальше действуй строго по нему, как если бы он был загружен командой /skill.

Интерактивного инструмента вопросов (AskUserQuestion) в этом окружении нет. Если по скиллу нужно задать вопросы — задавай их обычным текстом.

Сообщение пользователя лежит в файле ${PROMPT}. Прочитай его и ответь на него по скиллу. Твой ответ — то, что ты сказал бы пользователю в чат."

  ( cd "$sb" && timeout 900 claude -p "$task" --model haiku --permission-mode bypassPermissions \
      --output-format stream-json --verbose ) > "$sb/turn1.jsonl" 2> "$sb/_e1.log"

  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/turn1.jsonl" 2>/dev/null; then
    mv "$sb/turn1.jsonl" "$sb/_api-failure.txt"; echo "  run-$i — ОТКАЗ API"; return 0
  fi

  # Ход 2 — переспрос в ТОМ ЖЕ разговоре.
  ( cd "$sb" && timeout 900 claude -p --continue "$Q2" --model haiku --permission-mode bypassPermissions \
      --output-format stream-json --verbose ) > "$sb/turn2.jsonl" 2> "$sb/_e2.log"

  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/turn2.jsonl" 2>/dev/null; then
    mv "$sb/turn2.jsonl" "$sb/_api-failure2.txt"; echo "  run-$i — ОТКАЗ API на ходу 2"; return 0
  fi
  echo "  run-$i — готов"
}

echo "плечо: $OUT"; echo "вопрос хода 2: $Q2"; echo "прогонов: $N, параллельно: $CONC"
running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait
echo "ГОТОВО: $OUT — с двумя ходами: $(find "$OUT" -name turn2.jsonl -size +0 | wc -l) из $N"
