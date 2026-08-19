#!/usr/bin/env bash
# run.sh — стенд раунда «GraphQL: маршрут один, операций одиннадцать».
#
#   ./run.sh <проба> <N> [параллельность]
#
# Пробы:
#   gql         service-map на SM-GQL, скилл ПОСЛЕ правки 2026-08-13 (SM-80…SM-85)
#   gql-before  то же на снимке скилла ДО правки                     — база для сравнения
#   dense       читающий субагент на SM-DENSE, скилл ПОСЛЕ правки    — регресс REST
#
# `dense` здесь не ради плотности, а ради ФОРМЫ КЛЮЧА: правка трогает определение ключа
# «Публичного контракта», и надо убедиться, что у REST-сервиса заголовки блоков остались
# `МЕТОД /путь` и их по-прежнему 27. Дрейф ключей здесь стоил бы гарда на утоньшение во
# всех существующих карточках.
#
# Раскладка песочницы (соседи ДОЛЖНЫ лежать рядом со спек-репой, а не внутри неё):
#   sandbox/<проба>-NN/
#     w/specs/services/manifest.yaml   ← рабочая директория прогона
#     w/vetcare-api/  w/vetcare-web/
#
# Идемпотентность: песочница с непустым answer.md пропускается — скрипт можно перезапускать.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"            # …/agent-version-5.0/_skill-eval
AFTER="$(cd "$EVAL/.." && pwd)"              # …/agent-version-5.0 — скилл после правки
BEFORE="$HERE/before"                        # снимок скилла до правки, см. materialize_before
FIX="$EVAL/fixtures"

# Коммит, на котором снят снимок «до». Правка 2026-08-13 лежит в рабочем дереве и не
# закоммичена, поэтому «до» — это HEAD на момент раунда, зафиксированный числом.
BEFORE_REF=fbdfc19

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

PROBE="${1:?проба: gql | gql-before | dense}"
N="${2:-1}"
CONC="${3:-2}"

case "$PROBE" in
  gql)        SKILLDIR="$AFTER"; MODE=tree; FIXTURE=SM-GQL ;;
  gql-before) materialize_before; SKILLDIR="$BEFORE"; MODE=tree; FIXTURE=SM-GQL ;;
  dense)      SKILLDIR="$AFTER"; MODE=text; FIXTURE=SM-DENSE ;;
  *) echo "неизвестная проба: $PROBE"; exit 1 ;;
esac
[ -f "$SKILLDIR/service-map/SKILL.md" ] || { echo "нет скилла: $SKILLDIR"; exit 1; }

OUT="$HERE/sandbox"
mkdir -p "$OUT"

run_tree() {
  local sb="$1" i="$2"
  mkdir -p "$sb/w/specs"
  cp -r "$FIX/$FIXTURE/tree/." "$sb/w/specs/"
  cp -r "$FIX/$FIXTURE/neighbours/." "$sb/w/"
  local wd="$sb/w/specs"
  local abs_wd; abs_wd="$(cd "$wd" && pwd)"
  local task
  task="$(sed -e "s|WORKDIR|$abs_wd|g" -e "s|SKILLDIR|$SKILLDIR|g" "$HERE/stand/prompt-gql.md")"
  ( cd "$wd" && timeout 2400 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  return $?
}

run_text() {
  local sb="$1" i="$2"
  mkdir -p "$sb/w"
  local task
  task="$(sed -e "s|SKILLDIR|$SKILLDIR|g" "$HERE/stand/prompt-dense.md")
$(cat "$FIX/$FIXTURE/repo.md")"
  ( cd "$sb/w" && timeout 2400 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  return $?
}

run_one() {
  local i="$1"
  local sb="$OUT/$PROBE-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $PROBE-$i — уже есть, пропуск"; return 0; fi
  mkdir -p "$sb"
  if [ "$MODE" = tree ]; then run_tree "$sb" "$i"; else run_text "$sb" "$i"; fi
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
