#!/usr/bin/env bash
# seed.sh — песочница для `repo-split`: ОДНА репа целиком соседом, манифест с одной строкой.
#
#   ./seed.sh <куда> <repairy|resonance>
#
# Отличие от SM-REAL: там репа заранее разложена по сервисам, здесь она подаётся монолитом —
# именно так её видит `repo-split`, и именно на этом проверяется, теряет он куски или нет.
set -u
DEST="${1:?куда}"; REPO="${2:?repairy|resonance}"
SRC_ROOT="${RS_REAL_SRC:-/c/Users/Konstantin/projects}"
[ -d "$SRC_ROOT/$REPO" ] || { echo "нет источника: $SRC_ROOT/$REPO"; exit 1; }

EXCL="--exclude=node_modules --exclude=dist --exclude=dist.zip --exclude=dev-dist --exclude=.next
--exclude=.turbo --exclude=.git --exclude=coverage --exclude=playwright-report --exclude=test-results
--exclude=.playwright-mcp --exclude=@repairy --exclude=report.html --exclude=*.log --exclude=*.zip"

rm -rf "$DEST"; mkdir -p "$DEST/AI-SDD/services" "$DEST/$REPO"
# shellcheck disable=SC2086
( cd "$SRC_ROOT/$REPO" && tar cf - $EXCL . ) | ( cd "$DEST/$REPO" && tar xf - )
mkdir -p "$DEST/$REPO/.git"; echo "ref: refs/heads/main" > "$DEST/$REPO/.git/HEAD"

# Манифест — одна строка на всю репу. Это состояние ДО разреза: так его пишет человек, когда
# ещё не знает, что репа не берётся одним сканом.
{
  echo "# Слепок соседних сервисов. Этот файл ведёт человек."
  echo "services:"
  echo "  - name: $REPO"
  echo "    path: ../$REPO"
  echo "    type: fullstack"
} > "$DEST/AI-SDD/services/manifest.yaml"

echo "песочница: $DEST   репа: $REPO   файлов: $(find "$DEST/$REPO" -type f -not -path '*/.git/*' | wc -l)"
