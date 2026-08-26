#!/usr/bin/env bash
# seed.sh — песочница для `repo-split` на RS-HUB: одно большое приложение соседом.
#
#   ./seed.sh <куда>
#
# Фикстура генерится (`make.sh`), а не лежит в git: 1354 java-файла дороже шестидесяти строк
# скрипта. Если `out/` ещё нет — соберём на месте.
#
# В песочницу едут ТОЛЬКО репа и спек-репа. `expected.md` остаётся в фикстуре: прогон не должен
# видеть правду ни при каком блуждании.
set -u
DEST="${1:?куда}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -d "$HERE/out/opscore" ] || bash "$HERE/make.sh" "$HERE/out" > /dev/null

rm -rf "$DEST"; mkdir -p "$DEST"
cp -r "$HERE/out/opscore"     "$DEST/opscore"
cp -r "$HERE/out/geo-service" "$DEST/geo-service"
cp -r "$HERE/out/specs"       "$DEST/AI-SDD"

echo "песочница: $DEST   файлов в репе: $(find "$DEST/opscore" -type f -not -path '*/.git/*' | wc -l)"
