#!/usr/bin/env bash
# run.sh — стенд раунда «асинхронщина в карточке».
#
#   ./run.sh <проба> <N> [параллельность]
#
# Пробы:
#   async         service-map на SM-ASYNC, скилл ПОСЛЕ правки (SM-68…SM-73, SM-79)
#   async-before  то же на снимке скилла ДО правки            — база для сравнения
#
# Обе гоняют один промпт на одной фикстуре; отличается только каталог скилла. Иначе «стало
# лучше» не с чем сравнивать: на прежних фикстурах у топиков нет фактов второго уровня, а
# фоновая задача вовсе не ключ.
#
# Раскладка песочницы (соседи ДОЛЖНЫ лежать рядом со спек-репой, а не внутри неё):
#   sandbox/<проба>-NN/
#     w/specs/services/manifest.yaml   ← рабочая директория прогона
#     w/metering-api/  w/billing-worker/
#
# Материал кладётся в подпапку `w/`, чтобы два уровня вверх упирались в песочницу, а не
# выводили прогон в соседние (наблюдение 2026-08-11 на раунде разреза).
#
# Идемпотентность: песочница с непустым answer.md пропускается — скрипт можно перезапускать.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"            # …/agent-version-5.0/_skill-eval
AFTER="$(cd "$EVAL/.." && pwd)"              # …/agent-version-5.0 — скилл после правки
BEFORE="$HERE/before"                        # снимок скилла до правки, см. materialize_before
FIX="$EVAL/fixtures"
FIXTURE=SM-ASYNC

# Коммит, на котором снят снимок «до». Зафиксирован числом, а не как HEAD: после того как
# правка уедет в коммит, HEAD станет версией «после», и проба сравнивала бы скилл сам с собой.
BEFORE_REF=c922858

# Снимок «до» в репозитории не лежит — это 140 КБ дубля скилла. Он материализуется из git
# при запуске и удаляется вместе с песочницами.
materialize_before() {
  [ -f "$BEFORE/service-map/SKILL.md" ] && return 0
  mkdir -p "$BEFORE/service-map/reference"
  local root; root="$(cd "$AFTER/.." && pwd)"
  for f in SKILL.md reference/card.template.md reference/manifest.example.yaml; do
    git -C "$root" show "$BEFORE_REF:agent-version-5.0/service-map/$f" > "$BEFORE/service-map/$f" \
      || { echo "не достал $f из $BEFORE_REF"; exit 1; }
  done
  echo "снимок «до» материализован из $BEFORE_REF"
}

PROBE="${1:?проба: async | async-before}"
N="${2:-1}"
CONC="${3:-2}"

case "$PROBE" in
  async)        SKILLDIR="$AFTER" ;;
  async-before) materialize_before; SKILLDIR="$BEFORE" ;;
  *) echo "неизвестная проба: $PROBE"; exit 1 ;;
esac
PROMPT="$HERE/stand/prompt-async.md"
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }
[ -f "$SKILLDIR/service-map/SKILL.md" ] || { echo "нет скилла: $SKILLDIR"; exit 1; }

OUT="$HERE/sandbox"
mkdir -p "$OUT"

lay_out() {
  local sb="$1"
  mkdir -p "$sb/w/specs"
  cp -r "$FIX/$FIXTURE/tree/." "$sb/w/specs/"
  cp -r "$FIX/$FIXTURE/neighbours/." "$sb/w/"
}

run_one() {
  local i="$1"
  local sb="$OUT/$PROBE-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $PROBE-$i — уже есть, пропуск"; return 0; fi
  lay_out "$sb"
  local wd="$sb/w/specs"
  [ -d "$wd" ] || { echo "  $PROBE-$i — нет рабочей директории $wd"; return 1; }
  local abs_wd; abs_wd="$(cd "$wd" && pwd)"

  local task
  task="$(sed -e "s|WORKDIR|$abs_wd|g" -e "s|SKILLDIR|$SKILLDIR|g" "$PROMPT")"

  ( cd "$wd" && timeout 2400 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?

  # Отказ раннера обязан выпадать в «не измерено», а не в «провалено».
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

echo "проба: $PROBE   фикстура: $FIXTURE   скилл: $SKILLDIR   прогонов: $N (параллельно $CONC)"
running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait
echo "ГОТОВО: песочниц с ответом — $(find "$OUT" -maxdepth 2 -name answer.md -size +0 -path "*$PROBE-*" | wc -l) из $N"
