#!/usr/bin/env bash
# run.sh — стенд раунда «разрез монолита».
#
#   ./run.sh <проба> <N> [параллельность]
#
# Пробы:
#   rs-mono    repo-split на RS-MONO   (RS-1…RS-7, RS-9, RS-10) — разрез предъявлен, не записан
#   rs-write   repo-split на RS-MONO   (RS-8, RS-11)            — согласие дано в промпте, пишет
#   rs-small   repo-split на RS-SMALL  (RS-2)                   — анти-овертриггер
#   pieces       service-map на SM-PIECES (SM-64)        — сверка соседей, ход останавливается
#   pieces-scan  service-map на SM-PIECES (SM-65,65b,66) — согласие дано в промпте, пишет карточки
#
# Раскладка песочницы (соседи ДОЛЖНЫ лежать рядом со спек-репой, а не внутри неё):
#   sandbox/<проба>-NN/
#     w/specs/services/manifest.yaml   ← рабочая директория прогона
#     w/rentalcore/  w/geo-service/   ← соседние репы (внутри w/, чтобы два уровня вверх
#                                       не выводили в чужие песочницы)
#
# Идемпотентность: песочница с непустым answer.md пропускается — скрипт можно перезапускать.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"            # …/agent-version-5.0/_skill-eval
SKILLDIR="$(cd "$EVAL/.." && pwd)"           # …/agent-version-5.0
FIX="$EVAL/fixtures"

PROBE="${1:?проба: rs-mono | rs-write | rs-small | pieces}"
N="${2:-1}"
CONC="${3:-3}"

case "$PROBE" in
  rs-mono|rs-write) PROMPT="$HERE/stand/prompt-$PROBE.md"; FIXTURE=RS-MONO ;;
  rs-small)         PROMPT="$HERE/stand/prompt-rs-small.md"; FIXTURE=RS-SMALL ;;
  rs-front)         PROMPT="$HERE/stand/prompt-rs-front.md"; FIXTURE=RS-FRONT ;;
  rs-alien)         PROMPT="$HERE/stand/prompt-rs-alien.md"; FIXTURE=RS-ALIEN ;;
  pieces)           PROMPT="$HERE/stand/prompt-pieces.md";      FIXTURE=SM-PIECES ;;
  pieces-scan)      PROMPT="$HERE/stand/prompt-pieces-scan.md"; FIXTURE=SM-PIECES ;;
  *) echo "неизвестная проба: $PROBE"; exit 1 ;;
esac
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }

OUT="$HERE/sandbox"
mkdir -p "$OUT"

# --- раскладка одной песочницы ------------------------------------------------
# Материал кладётся в ПОДПАПКУ `w/`, а не в корень песочницы. Причина — наблюдение
# 2026-08-11: прогон поднялся на два уровня от рабочей директории и нашёл соседние репы
# ЧУЖИХ параллельных песочниц («Нашёл frontdesk в двух местах: rs-front-2/…, rs-front-3/…»).
# С подпапкой два уровня вверх упираются в `<проба>-NN`, где нет ничего, кроме `w/`.
lay_out() {
  local sb="$1"
  rm -rf "$sb"; mkdir -p "$sb/w"
  case "$FIXTURE" in
    RS-MONO|RS-SMALL|RS-FRONT|RS-ALIEN)
      # генератор кладёт specs/ и соседей рядом — ровно нужная раскладка
      bash "$FIX/$FIXTURE/make.sh" "$sb/w" >/dev/null
      ;;
    SM-PIECES)
      mkdir -p "$sb/w/specs"
      cp -r "$FIX/SM-PIECES/tree/." "$sb/w/specs/"
      cp -r "$FIX/SM-PIECES/neighbours/." "$sb/w/"
      ;;
  esac
}

run_one() {
  local i="$1"
  local sb="$OUT/$PROBE-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $PROBE-$i — уже есть, пропуск"; return 0; fi
  lay_out "$sb"
  local wd="$sb/w/specs"
  [ -d "$wd" ] || { echo "  $PROBE-$i — нет рабочей директории $wd"; return 1; }
  local abs_wd; abs_wd="$(cd "$wd" && pwd)"

  # Промпт собирается подстановкой: пути абсолютные, иначе агент разрешит их от своей директории.
  local task
  task="$(sed -e "s|WORKDIR|$abs_wd|g" -e "s|SKILLDIR|$SKILLDIR|g" "$PROMPT")"

  ( cd "$wd" && timeout 1800 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?

  # Отказ раннера обязан выпадать в «не измерено», а не в «провалено» — правило из run-pool.sh.
  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/answer.md" 2>/dev/null; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"
    echo "  $PROBE-$i — ОТКАЗ API, в счёт не идёт"
    return 0
  fi
  if [ $rc -ne 0 ] || [ ! -s "$sb/answer.md" ]; then
    echo "  $PROBE-$i — ОТКАЗ (rc=$rc), см. $sb/_stderr.log"
  else
    echo "  $PROBE-$i — готов"
  fi
}

echo "проба: $PROBE   фикстура: $FIXTURE   прогонов: $N (параллельно $CONC)"
running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait
echo "ГОТОВО: песочниц с ответом — $(find "$OUT" -maxdepth 2 -name answer.md -size +0 -path "*$PROBE-*" | wc -l) из $N"
