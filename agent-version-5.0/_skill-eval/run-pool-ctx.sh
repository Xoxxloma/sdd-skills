#!/usr/bin/env bash
# run-pool-ctx.sh — пул прогонов для проб петли 5.0. Копия корневого `_skill-eval/run-pool.sh`
# с двумя правками, обе из замера 2026-08-14.
#
#   ./run-pool-ctx.sh <скилл.md> <промпт.txt> <каталог-плеча> <N> [параллельность] [засев]
#
# ПРАВКА 1 — УБРАНА ПОСЛЕДНЯЯ СТРОКА ПРОМПТА «Твой ответ — то, что ты сказал бы пользователю в чат».
#
# Она стоила половины замера. База по четырём пишущим пробам дала 12 прогонов из 40, которые
# выдали хендофф «спека готова, файл `docs/<KEY>/technical_specification.md`, статус такой-то» и
# НЕ СОЗДАЛИ ФАЙЛА; на `ts-ctx` таких было пять из десяти. Пилот `pilot-wrapper.sh` — та же
# фикстура, тот же снимок скилла, та же модель, отличие ровно в этой строке — дал спеку на диске
# в 5 прогонах из 5.
#
# Механика понятная: строка называет ответ в чат ЕДИНСТВЕННЫМ результатом работы. Прогон её
# исполняет — формулирует ответ, — а запись файла становится необязательной подготовкой к нему.
# Стенд мерил собственную формулировку и списывал её в дефект скилла.
#
# Урок тот же, что в `RUNNER.md`: обёртка не «оформление», она часть измеряемого. Меняешь
# обёртку — перезапускай пробу с нуля и не сравнивай с прежними числами.
#
# ПРАВКА 2 — ОТКАЗ API ОПОЗНАЁТСЯ СТРОЖЕ. Настоящее сообщение CLI — это ВЕСЬ вывод: короткий и с
# маркера в начале. Прежняя проверка искала маркер где угодно, и прогон, написавший в спеке
# «429 (rate limit)», уезжал в `_api-failure.txt` — то есть молча выпадал из знаменателя. На
# `ts-ctx` так пропали 2 прогона из 10, и именно те, что перенесли в спеку больше чужой
# конкретики: стенд врал в пользу скилла.

set -u

SKILL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
PROMPT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
OUT="$3"
N="$4"
CONC="${5:-5}"
SEED="${6:-}"

[ -f "$SKILL" ]  || { echo "нет файла скилла: $SKILL";  exit 1; }
[ -f "$PROMPT" ] || { echo "нет файла промпта: $PROMPT"; exit 1; }
if [ -n "$SEED" ]; then
  [ -d "$SEED" ] || { echo "нет папки засева: $SEED"; exit 1; }
  SEED="$(cd "$SEED" && pwd)"
fi
mkdir -p "$OUT"

# Настоящий отказ CLI: короткий вывод либо маркер в первых 200 байтах.
is_api_failure() {
  local f="$1"
  local size; size=$(wc -c < "$f")
  if [ "$size" -lt 600 ]; then
    grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$f"
  else
    head -c 200 "$f" | grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit"
  fi
}

# Состав засева на момент старта плеча — эталон для сверки перед каждым прогоном.
SEED_FILES=""
if [ -n "$SEED" ]; then
  SEED_FILES="$(cd "$SEED" && find . -type f | sed 's|^\./||' | sort | tr '\n' ' ')"
fi

run_one() {
  local i="$1"
  local sb="$OUT/run-$i"
  # Стоп-файл: если засев испорчен, остальные прогоны не запускаются — испорченное плечо
  # дешевле не доганять, чем потом опознавать.
  if [ -e "$OUT/_STOP" ]; then echo "  run-$i — СТОП, плечо остановлено"; return 0; fi
  mkdir -p "$sb"
  if [ -s "$sb/answer.md" ]; then echo "  run-$i — уже есть, пропуск"; return 0; fi
  local abs_sb; abs_sb="$(cd "$sb" && pwd)"

  if [ -n "$SEED" ]; then
    # СВЕРКА ЗАСЕВА ПЕРЕД КАЖДЫМ ПРОГОНОМ, а не один раз на плечо. Прогон, промахнувшийся мимо
    # своей песочницы, пишет результат в соседнюю папку — и если это папка засева, все следующие
    # прогоны получают готовый документ. 2026-08-14: так было испорчено целое плечо и пилот, и
    # заметили это только по `_seeded.txt`. Сверка стоит одну команду и ловит порчу на первом же
    # прогоне после неё.
    local now; now="$(cd "$SEED" && find . -type f | sed 's|^\./||' | sort | tr '\n' ' ')"
    if [ -n "${SEED_FILES:-}" ] && [ "$now" != "$SEED_FILES" ]; then
      echo "  run-$i — ЗАСЕВ ИСПОРЧЕН, плечо остановлено"
      echo "    было: $SEED_FILES"
      echo "    стало: $now"
      touch "$OUT/_STOP"
      return 1
    fi
    cp -r "$SEED"/. "$abs_sb"/ 2>/dev/null
    ( cd "$abs_sb" && find . -type f -not -name '_seeded.txt' | sed 's|^\./||' | sort ) > "$abs_sb/_seeded.txt"
  fi

  local task="Твоя рабочая директория — ${abs_sb}. Считай её корнем рабочего репозитория. Ничего за её пределами не создавай и не изменяй: путь, ведущий наружу, — ошибка сборки пути, а не повод писать туда.

Прочитай целиком файл ${SKILL} — это скилл. Дальше действуй строго по нему, как если бы он был загружен командой /skill.

Интерактивного инструмента вопросов (AskUserQuestion) в этом окружении нет. Если по скиллу нужно задать вопросы — задавай их обычным текстом.

Сообщение пользователя лежит в файле ${PROMPT}. Прочитай его и отработай по скиллу."

  # `WRAPPER_CHAT_LINE=1` возвращает ту самую строку — только для A/B-замера самой обёртки.
  # В обычных прогонах она не ставится: см. шапку файла.
  if [ "${WRAPPER_CHAT_LINE:-0}" = "1" ]; then
    task="$task
Твой ответ — то, что ты сказал бы пользователю в чат."
  fi

  ( cd "$sb" && timeout 900 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?

  if [ -s "$sb/answer.md" ] && is_api_failure "$sb/answer.md"; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"
    echo "  run-$i — ОТКАЗ API, песочница помечена и в счёт не идёт"
    return 0
  fi
  if [ $rc -ne 0 ]; then
    echo "  run-$i — ОТКАЗ (rc=$rc), см. $sb/_stderr.log"
  else
    echo "  run-$i — готов"
  fi
}

echo "плечо: $OUT"
echo "скилл: $SKILL"
echo "промпт: $PROMPT"
echo "прогонов: $N, параллельно: $CONC"

running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait

echo "ГОТОВО: $OUT — песочниц с ответом: $(find "$OUT" -name answer.md -size +0 | wc -l) из $N"
