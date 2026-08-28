#!/usr/bin/env bash
# seed.sh — песочница для `repo-split` на NRS-MULTI: монорепа из четырёх приложений соседом.
#
#   ./seed.sh <куда>
#
# Фикстура генерится (`make.sh`), а не лежит в git: 971 исходник дороже двухсот строк скрипта.
# Если `out/` ещё нет — соберём на месте.
#
# В песочницу едут ТОЛЬКО репы и спек-репа. `expected.md` остаётся в фикстуре: прогон не должен
# видеть правду ни при каком блуждании.
set -u
DEST="${1:?куда}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -d "$HERE/out/medex" ] || bash "$HERE/make.sh" "$HERE/out" > /dev/null

rm -rf "$DEST"; mkdir -p "$DEST"
cp -r "$HERE/out/medex"      "$DEST/medex"
cp -r "$HERE/out/billing-gw" "$DEST/billing-gw"
cp -r "$HERE/out/specs"      "$DEST/AI-SDD"

echo "песочница: $DEST   файлов в репе: $(find "$DEST/medex" -type f -not -path '*/.git/*' | wc -l)"
