#!/usr/bin/env bash
# seed.sh — песочница для `repo-split` на NRS-TAIL: одно большое приложение соседом.
#
#   ./seed.sh <куда>
#
# Фикстура генерится (`make.sh`), а не лежит в git: 2100 java-файлов дороже трёхсот строк
# скрипта. Если `out/` ещё нет — соберём на месте (~12 секунд).
#
# В песочницу едут репа, соседняя маленькая репа и спек-репа. `expected.md` остаётся в фикстуре:
# прогон не должен видеть правду ни при каком блуждании.
set -u
DEST="${1:?куда}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -d "$HERE/out/cargonet" ] || bash "$HERE/make.sh" "$HERE/out" > /dev/null

rm -rf "$DEST"; mkdir -p "$DEST"
cp -r "$HERE/out/cargonet"    "$DEST/cargonet"
cp -r "$HERE/out/weather-api" "$DEST/weather-api"
cp -r "$HERE/out/specs"       "$DEST/AI-SDD"

echo "песочница: $DEST   файлов в репе: $(find "$DEST/cargonet" -type f -not -path '*/.git/*' | wc -l)"
