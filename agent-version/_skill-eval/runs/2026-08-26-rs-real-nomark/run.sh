#!/usr/bin/env bash
# run.sh — стенд `repo-split` на РЕАЛЬНЫХ репах, поданных монолитом.
#   ./run.sh <repairy|resonance> <N> [параллельность]
# Снимок скилла — один на раунд, в <раунд>/_skills/. Читается копия из /tmp: путь внутрь репы
# уводит прогоны бродить по соседним папкам.
set -u
REPO="${1:?repairy|resonance}"; N="${2:-1}"; CONC="${3:-5}"
HERE="$(cd "$(dirname "$0")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"
SKILLROOT="$(cd "$EVAL/.." && pwd)"
FIX="$EVAL/fixtures/RS-REAL"
ROUND="${ROUND_DIR:-$HERE}"
SKILL_SRC="${SKILL_SRC:-$SKILLROOT/repo-split}"
mkdir -p "$ROUND/_skills"

if [ ! -f "$ROUND/_skills/repo-split.SKILL.md" ]; then
  cp "$SKILL_SRC/SKILL.md" "$ROUND/_skills/repo-split.SKILL.md"
  [ -d "$SKILL_SRC/reference" ] && cp -r "$SKILL_SRC/reference" "$ROUND/_skills/repo-split.reference"
  echo "снимок скилла: $(wc -l < "$ROUND/_skills/repo-split.SKILL.md") строк"
else
  echo "снимок уже есть — прогон читает ЕГО ($(wc -l < "$ROUND/_skills/repo-split.SKILL.md") строк)"
fi

SNAP="${RS_SNAP:-/tmp/rs-skills}/$(basename "$ROUND")"
rm -rf "$SNAP"; mkdir -p "$SNAP/repo-split"
cp "$ROUND/_skills/repo-split.SKILL.md" "$SNAP/repo-split/SKILL.md"
[ -d "$ROUND/_skills/repo-split.reference" ] && cp -r "$ROUND/_skills/repo-split.reference" "$SNAP/repo-split/reference"
SNAP_WIN="$(cd "$SNAP" && { pwd -W 2>/dev/null || pwd; })"

OUT="$ROUND/sandbox"; mkdir -p "$OUT"
run_one() {
  local i="$1" sb="$OUT/$REPO-$i"
  if [ -s "$sb/answer.md" ]; then echo "  $REPO-$i — уже есть, пропуск"; return 0; fi
  mkdir -p "$sb"
  bash "$FIX/seed.sh" "$sb/w" "$REPO" > "$sb/_seed.log" 2>&1 || { echo "  $REPO-$i — засев не собрался"; return 0; }
  local wd="$sb/w/AI-SDD"
  local abs; abs="$(cd "$wd" && { pwd -W 2>/dev/null || pwd; })"
  local task; task="$(sed -e "s|WORKDIR|$abs|g" -e "s|SKILLDIR|$SNAP_WIN|g" -e "s|REPONAME|$REPO|g" "$HERE/stand/prompt.md")"
  ( cd "$wd" && timeout 3600 claude -p "$task" --model haiku --permission-mode bypassPermissions ) \
      > "$sb/answer.md" 2> "$sb/_stderr.log"
  local rc=$?
  if grep -qiE "API Error|Please run /login|Credit balance|rate limit|session limit|usage limit" "$sb/answer.md" 2>/dev/null; then
    mv "$sb/answer.md" "$sb/_api-failure.txt"; echo "  $REPO-$i — ОТКАЗ API, в счёт не идёт"; return 0
  fi
  [ $rc -ne 0 ] || [ ! -s "$sb/answer.md" ] && echo "  $REPO-$i — ОТКАЗ (rc=$rc)" || echo "  $REPO-$i — готов"
}
echo "репа: $REPO   прогонов: $N   скилл: $SKILL_SRC"
r=0; for i in $(seq -w 1 "$N"); do run_one "$i" & r=$((r+1)); [ "$r" -ge "$CONC" ] && { wait -n 2>/dev/null || wait; r=$((r-1)); }; done; wait
echo "ГОТОВО: $(find "$OUT" -maxdepth 2 -name answer.md -size +0 -path "*$REPO-*" | wc -l) из $N"
rm -rf "$SNAP"
