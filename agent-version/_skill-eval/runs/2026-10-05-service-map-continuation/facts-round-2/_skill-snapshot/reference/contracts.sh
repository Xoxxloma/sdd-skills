#!/usr/bin/env bash
# Independent declarations, without interpreting implementation or invoking models.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "НЕ ПРОВЕРЕНО: для независимой сверки объявлений нужен Node.js" >&2; exit 3; }
exec node "$HERE/contracts.mjs" "$@"
