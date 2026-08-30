#!/usr/bin/env bash
# seed.sh — эпик ARS-500 уже разрезан. У ARS-501 и ARS-502 общий источник («справочник допусков
# подрядчиков»), у ARS-503 свой (события аудита СБ). Меряется Шаг 4: предложить #0 и обязательно
# сказать, что своего БТ у него не будет.
set -u
DEST="${1:?куда}"; HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$DEST"; mkdir -p "$DEST"; cp -r "$HERE/docs" "$DEST/docs"
echo "песочница: $DEST   файлов: $(find "$DEST" -type f | wc -l)"
