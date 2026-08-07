#!/usr/bin/env bash
# run-trigger.sh — пул прогонов для замера АВТОСРАБАТЫВАНИЯ приёмки внутри пайплайна.
#
#   ./run-trigger.sh <скилл-автора.md> <промпт.txt> <каталог-плеча> <N> [параллельность] [засев]
#
# Отличие от run-pool.sh — два, и оба обязательны для этой пробы.
#
# 1. В песочницу засевается `.claude/skills/spec-review/` — приёмка становится НАСТОЯЩИМ
#    скиллом в реестре, а не файлом по пути. Иначе мерить нечего: модель не может вызвать
#    то, чего в реестре нет. Пилот 2026-08-07 подтвердил, что скилл из `<cwd>/.claude/skills/`
#    виден (`spec-review` первым в списке доступных). Скилл автора по-прежнему грузится
#    ПУТЁМ — так меряют все прежние раунды, и менять способ ради этой пробы нельзя.
#
# 2. Ответ пишется потоком (`--output-format stream-json`), а не текстом. Факт вызова скилла
#    и факт запуска субагента в финальном тексте не видны: агент может о них рассказать, не
#    сделав, и наоборот. Правило репы «грейдить файл, а не формулировку отчёта» здесь
#    означает «грейдить поток вызовов, а не пересказ».
#
# Идемпотентность как в run-pool.sh: песочница с непустым stream.jsonl пропускается.

set -u

SKILL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
PROMPT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
OUT="$3"
N="$4"
CONC="${5:-5}"
SEED="${6:-}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVIEW_SKILL="$REPO/agent-version-3.2/spec-review"

[ -f "$SKILL" ]  || { echo "нет файла скилла: $SKILL";  exit 1; }
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

  # Приёмка — в реестр скиллов песочницы. Копия на каждый прогон: общая папка означала бы,
  # что прогон, решивший что-нибудь в ней записать, молча испортит все последующие.
  mkdir -p "$abs_sb/.claude/skills"
  cp -r "$REVIEW_SKILL" "$abs_sb/.claude/skills/" 2>/dev/null

  if [ -n "$SEED" ]; then
    cp -r "$SEED"/. "$abs_sb"/ 2>/dev/null
  fi
  ( cd "$abs_sb" && find . -type f -not -name '_seeded.txt' | sed 's|^\./||' | sort ) > "$abs_sb/_seeded.txt"

  local task="Твоя рабочая директория — ${abs_sb}. Считай её корнем рабочего репозитория. Ничего за её пределами не создавай и не изменяй: путь, ведущий наружу, — ошибка сборки пути, а не повод писать туда.

Прочитай целиком файл ${SKILL} — это скилл. Дальше действуй строго по нему, как если бы он был загружен командой /skill.

Интерактивного инструмента вопросов (AskUserQuestion) в этом окружении нет. Если по скиллу нужно задать вопросы — задавай их обычным текстом.

Сообщение пользователя лежит в файле ${PROMPT}. Прочитай его и ответь на него по скиллу. Твой ответ — то, что ты сказал бы пользователю в чат."

  ( cd "$sb" && timeout 1200 claude -p "$task" --model haiku --permission-mode bypassPermissions \
      --output-format stream-json --verbose ) \
      > "$sb/stream.jsonl" 2> "$sb/_stderr.log"
  local rc=$?

  # Отказ раннера обязан выпадать в «не измерено», а не в «провалено» — правило репы,
  # оплаченное дважды (2026-08-06: 68 прогонов из 180; 2026-08-07: 20 из 20).
  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/stream.jsonl" 2>/dev/null; then
    mv "$sb/stream.jsonl" "$sb/_api-failure.txt"
    echo "  run-$i — ОТКАЗ API, песочница помечена и в счёт не идёт"
    return 0
  fi
  if [ $rc -ne 0 ] || [ ! -s "$sb/stream.jsonl" ]; then
    echo "  run-$i — ОТКАЗ (rc=$rc), см. $sb/_stderr.log"
  else
    echo "  run-$i — готов"
  fi
}

echo "плечо: $OUT"
echo "скилл автора: $SKILL"
echo "промпт: $PROMPT"
echo "приёмка в реестр: $REVIEW_SKILL"
echo "прогонов: $N, параллельно: $CONC"

running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait

echo "ГОТОВО: $OUT — песочниц с потоком: $(find "$OUT" -name stream.jsonl -size +0 | wc -l) из $N"
