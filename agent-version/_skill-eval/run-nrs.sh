#!/usr/bin/env bash
# run-nrs.sh <фикстура> <имя-репы> <папка-раунда> <N> [параллельность] — стенд `new-repo-split`.
#
#   ./run-nrs.sh NRS-TAIL cargonet runs/2026-08-28-nrs-c1 10 4
#
# Устройство скопировано с `runs/2026-08-25-rs-hub-*/run.sh` дословно, и отступления от него
# каждое стоило раунда:
#
# 1. **Снимок скилла — один на раунд**, в `<раунд>/_skills/`. Живой SKILL.md правится между
#    раундами; прогон, читающий его напрямую, меряет текст, которого через час не существует.
# 2. **Читается копия из /tmp**, а не путь внутрь репы: путь внутрь уводит прогоны бродить по
#    соседним скиллам и по чужим песочницам.
# 3. **Караул фикстуры** после каждого прогона: сбежавший прогон, записавший в саму фикстуру,
#    портит засев всем последующим, и проба начинает отвечать «да» сама себе.
set -u
FIX_NAME="${1:?фикстура, напр. NRS-TAIL}"
REPO="${2:?имя репы, напр. cargonet}"
ROUND_ARG="${3:?папка раунда}"
N="${4:-1}"
CONC="${5:-4}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLROOT="$(cd "$HERE/.." && pwd)"
FIX="$HERE/fixtures/$FIX_NAME"
[ -d "$FIX" ] || { echo "нет фикстуры: $FIX"; exit 1; }
mkdir -p "$ROUND_ARG"
ROUND="$(cd "$ROUND_ARG" && pwd)"
SKILL_SRC="${SKILL_SRC:-$SKILLROOT/new-repo-split}"
mkdir -p "$ROUND/_skills"

if [ ! -f "$ROUND/_skills/new-repo-split.SKILL.md" ]; then
  cp "$SKILL_SRC/SKILL.md" "$ROUND/_skills/new-repo-split.SKILL.md"
  [ -d "$SKILL_SRC/reference" ] && cp -r "$SKILL_SRC/reference" "$ROUND/_skills/new-repo-split.reference"
  echo "снимок скилла: $(wc -l < "$ROUND/_skills/new-repo-split.SKILL.md") строк"
else
  echo "снимок уже есть — прогон читает ЕГО ($(wc -l < "$ROUND/_skills/new-repo-split.SKILL.md") строк)"
fi

SNAP="${NRS_SNAP:-/tmp/nrs-skills}/$(basename "$ROUND")"
rm -rf "$SNAP"; mkdir -p "$SNAP/new-repo-split"
cp "$ROUND/_skills/new-repo-split.SKILL.md" "$SNAP/new-repo-split/SKILL.md"
[ -d "$ROUND/_skills/new-repo-split.reference" ] && cp -r "$ROUND/_skills/new-repo-split.reference" "$SNAP/new-repo-split/reference"
SNAP_WIN="$(cd "$SNAP" && { pwd -W 2>/dev/null || pwd; })"

PROMPT_SRC="$ROUND/stand/prompt.md"
[ -f "$PROMPT_SRC" ] || PROMPT_SRC="$HERE/stand-nrs/prompt.md"
[ -f "$PROMPT_SRC" ] || { echo "нет промпта: $PROMPT_SRC"; exit 1; }

OUT="$ROUND/sandbox"; mkdir -p "$OUT"
run_one() {
  local i="$1" sb="$OUT/$REPO-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $REPO-$i — уже есть, пропуск"; return 0; fi
  mkdir -p "$sb"
  bash "$FIX/seed.sh" "$sb/w" > "$sb/_seed.log" 2>&1 || { echo "  $REPO-$i — засев не собрался"; return 0; }
  local wd="$sb/w/AI-SDD"
  [ -d "$wd" ] || wd="$sb/w/specs"
  local abs; abs="$(cd "$wd" && { pwd -W 2>/dev/null || pwd; })"
  local task; task="$(sed -e "s|WORKDIR|$abs|g" -e "s|SKILLDIR|$SNAP_WIN|g" -e "s|REPONAME|$REPO|g" "$PROMPT_SRC")"
  ( cd "$wd" && timeout 3600 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?
  if grep -qiE "API Error|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/answer.md" 2>/dev/null; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"; echo "  $REPO-$i — ОТКАЗ API, в счёт не идёт"; return 0
  fi
  if [ -n "$(find "$FIX/out" -newer "$sb/_seed.log" -type f 2>/dev/null | head -1)" ]; then
    echo "  $REPO-$i — ⚠ ФИКСТУРА ТРОНУТА"
  fi
  if [ $rc -ne 0 ] || [ ! -s "$sb/answer.md" ]; then echo "  $REPO-$i — ОТКАЗ (rc=$rc)"; else echo "  $REPO-$i — готов"; fi
}
echo "фикстура: $FIX_NAME   репа: $REPO   прогонов: $N   скилл: $SKILL_SRC"
r=0; for i in $(seq -w 1 "$N"); do run_one "$i" & r=$((r+1)); [ "$r" -ge "$CONC" ] && { wait -n 2>/dev/null || wait; r=$((r-1)); }; done; wait
echo "ГОТОВО: $(find "$OUT" -maxdepth 2 -name answer.md -size +0 | wc -l) из $N"
rm -rf "$SNAP"
