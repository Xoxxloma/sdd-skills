#!/usr/bin/env bash
# run.sh — стенд раунда «service-map на реальном коде».
#
#   ./run.sh <плечо> <N> [параллельность]
#
# Плечи (числа складывать нельзя — законные исходы разные):
#   scan   манифест засеян тремя строками, аргумент `repairy-api repairy-web`.
#          Мерит Шаги 2–6: опись против кода, гейт на запись, плотность, гард, обратные рёбра.
#   first  манифеста нет. Мерит Шаг 1: два глоба, тип по маркерам, черновик манифеста, остановка.
#
# Чем этот раунд отличается от всех прошлых: дерево не синтетическое. Самая большая фикстура
# стенда — 33 файла на всю пробу и до 48 ключей; здесь `repairy-api` один даёт 125 файлов и
# ~120 ключей. Граница «сколько берёт один субагент» до сих пор не проведена (CHANGELOG 5.0,
# таблица чисел), и этот раунд её и мерит.
#
# Идемпотентность: песочница с непустым answer.md пропускается — скрипт можно перезапускать.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"            # …/agent-version/_skill-eval
SKILLROOT="$(cd "$EVAL/.." && pwd)"          # …/agent-version
FIX="$EVAL/fixtures/SM-REAL"

# Папка раунда отделена от папки скрипта: снимок скилла снимается ОДИН раз на раунд, и плечо
# «после правки» обязано лежать своим раундом, иначе оно прочитает снимок «до» и разница выйдет
# нулевой по построению.
ROUND="${ROUND_DIR:-$HERE}"
# Текст скилла берётся из SKILL_SRC, а не всегда из рабочего дерева: плечи пула отличаются одним
# правилом, и подменять ради каждого рабочее дерево — верный способ смешать редакции.
SKILL_SRC="${SKILL_SRC:-$SKILLROOT/service-map}"
mkdir -p "$ROUND"

ARM="${1:?плечо: scan | first}"
N="${2:-1}"
CONC="${3:-1}"

case "$ARM" in
  scan)  PROMPT="$HERE/stand/prompt-scan.md" ;;
  first) PROMPT="$HERE/stand/prompt-first.md" ;;
  *) echo "неизвестное плечо: $ARM"; exit 1 ;;
esac
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }
[ -x "$FIX/seed.sh" ] || { echo "нет засева: $FIX/seed.sh"; exit 1; }

# ─── Снимок скилла: ОДИН раз на раунд ──────────────────────────────────────────────────────
# Прежняя раскладка писала в конфиг путь к ЖИВОМУ SKILL.md; файл правится между раундами, и текст,
# которым получены числа, переставал существовать в момент следующей правки. `reference/` — часть
# измеряемого текста: без него снимок лжёт, форма карточки живёт там.
mkdir -p "$ROUND/_skills"
if [ ! -f "$ROUND/_skills/service-map.SKILL.md" ]; then
  cp "$SKILL_SRC/SKILL.md" "$ROUND/_skills/service-map.SKILL.md"
  cp -r "$SKILL_SRC/reference" "$ROUND/_skills/service-map.reference"
  echo "снимок скилла снят: $ROUND/_skills/"
else
  echo "снимок скилла уже есть — прогон читает ЕГО"
fi
if [ ! -f "$ROUND/_commit.txt" ]; then
  { git -C "$ROUND" rev-parse HEAD 2>/dev/null || echo "нет git"; } > "$ROUND/_commit.txt"
  [ -n "$(git -C "$ROUND" status --porcelain 2>/dev/null)" ] \
    && echo "рабочее дерево грязное — источник истины это _skills/" >> "$ROUND/_commit.txt"
fi

# ПРОГОН ЧИТАЕТ КОПИЮ СНИМКА ВНЕ РЕПОЗИТОРИЯ. Единственный путь, который прогон получает внутрь
# репы, — путь к скиллу; получив его, часть прогонов уходит бродить по соседним папкам и пишет
# результат в фикстуру. Каталог сносится ПОСЛЕ плеча: копившиеся снимки прошлых раундов один раз
# уже привели к тому, что прогон прочитал чужой SKILL.md и попал в знаменатель.
SNAP_ROOT="${SM_REAL_SNAP:-/tmp/sm-real-skills}/$(basename "$ROUND")"
rm -rf "$SNAP_ROOT"; mkdir -p "$SNAP_ROOT/service-map"
cp "$ROUND/_skills/service-map.SKILL.md" "$SNAP_ROOT/service-map/SKILL.md"
cp -r "$ROUND/_skills/service-map.reference" "$SNAP_ROOT/service-map/reference"
# ПУТИ В ПРОМПТ ИДУТ В WINDOWS-ФОРМЕ. `claude` здесь — windows-процесс, и msys-путь
# (`/tmp/…`, `/c/Users/…`) его инструменты не разрешают: прогон получил бы «файл не найден» на
# самом скилле и завершился отказом, неотличимым от честного «читать нечего».
SNAP_WIN="$(cd "$SNAP_ROOT" && pwd -W 2>/dev/null || echo "$SNAP_ROOT")"

OUT="$ROUND/sandbox"
mkdir -p "$OUT"

run_one() {
  local i="$1"
  local sb="$OUT/$ARM-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $ARM-$i — уже есть, пропуск"; return 0; fi
  mkdir -p "$sb"

  bash "$FIX/seed.sh" "$sb/w" "$ARM" > "$sb/_seed.log" 2>&1 \
    || { echo "  $ARM-$i — засев не собрался, см. $sb/_seed.log"; return 0; }

  # Отпечаток засева ДО прогона. По нему караул ниже отличает «скилл записал в чужую репу»
  # от «так и было»: запрет в промпте изоляцией не является, а правило 2 скилла («ты только
  # читаешь чужие репозитории») ни одной синтетической фикстурой не проверялось — писать в них
  # было незачем.
  ( cd "$sb/w" && find repairy-api repairy-web resonance-api resonance-web -type f \
      -not -path '*/.git/*' -not -name .git | sort ) > "$sb/_seeded.txt"

  local wd="$sb/w/AI-SDD"
  local abs_wd; abs_wd="$(cd "$wd" && { pwd -W 2>/dev/null || pwd; })"
  local task
  task="$(sed -e "s|WORKDIR|$abs_wd|g" -e "s|SKILLDIR|$SNAP_WIN|g" "$PROMPT")"

  ( cd "$wd" && timeout 3600 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?

  # Отказ раннера обязан выпадать в «не измерено», а не в «провалено».
  if grep -qiE "API Error|Request not allowed|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/answer.md" 2>/dev/null; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"
    echo "  $ARM-$i — ОТКАЗ API, в счёт не идёт"
    return 0
  fi

  # ─── Караул чужих реп ──────────────────────────────────────────────────────────────────
  ( cd "$sb/w" && find repairy-api repairy-web resonance-api resonance-web -type f \
      -not -path '*/.git/*' -not -name .git | sort ) > "$sb/_after.txt"
  if ! diff -q "$sb/_seeded.txt" "$sb/_after.txt" > /dev/null; then
    echo "  !!! $ARM-$i — ПРОГОН ТРОГАЛ ПАПКИ СЕРВИСОВ (правило 2 скилла):"
    diff "$sb/_seeded.txt" "$sb/_after.txt" | head -20 | sed 's/^/      /'
    diff "$sb/_seeded.txt" "$sb/_after.txt" > "$sb/_dirt.txt"
  fi

  if [ $rc -ne 0 ] || [ ! -s "$sb/answer.md" ]; then
    echo "  $ARM-$i — ОТКАЗ (rc=$rc), см. $sb/_stderr.log"
  else
    echo "  $ARM-$i — готов; карточек: $(ls -1 "$wd/services"/*.md 2>/dev/null | grep -v manifest | wc -l)"
  fi
}

{
  echo "плечо: $ARM"
  echo "модель: haiku"
  echo "прогонов: $N, параллельность: $CONC"
  echo "текст скилла: $SKILL_SRC"
  echo "источники: ${SM_REAL_SRC:-/c/Users/Konstantin/projects}/{repairy,resonance}"
  echo "снимок скилла: _skills/service-map.SKILL.md ($(wc -l < "$ROUND/_skills/service-map.SKILL.md") строк)"
} > "$ROUND/_settings-$ARM.txt"
cat "$ROUND/_settings-$ARM.txt"

running=0
for i in $(seq -w 1 "$N"); do
  run_one "$i" &
  running=$((running + 1))
  if [ "$running" -ge "$CONC" ]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait

echo "ГОТОВО: песочниц с ответом — $(find "$OUT" -maxdepth 2 -name answer.md -size +0 -path "*$ARM-*" | wc -l) из $N"
rm -rf "$SNAP_ROOT"
echo "снимок из /tmp снесён (журнальная копия осталась в $ROUND/_skills/)"
