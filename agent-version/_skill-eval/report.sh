#!/usr/bin/env bash
# report.sh <папка-раунда> — сводка по всем плечам раунда одной командой.
#
# Каждое плечо грейдится СВОИМ грейдером: у проб разные артефакты и разные критерии, и один
# общий «процент по раунду» их бы склеил. Печатаются только счётчики — построчные вердикты
# смотри прямым вызовом грейдера.

set -u
R="${1:-}"
[ -d "$R" ] || { echo "usage: ./report.sh <папка-раунда>"; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

section() { echo ""; echo "═══ $1 ═══"; }

# Ложные «отказы API» — прогоны, у которых в тексте спеки встретилось `rate limit`. Они молча
# выпадают из знаменателя, и выпадают именно те, что перенесли больше чужой конкретики. Отчёт
# без этой проверки завышает результат.
FALSE="$(node "$HERE/rescue-answers.mjs" "$R" 2>/dev/null | grep -c 'ЛОЖНЫЙ' || true)"
if [ "${FALSE:-0}" -gt 0 ]; then
  echo "!!! ложных отказов API: $FALSE — верни их в пул: node rescue-answers.mjs $R --fix"
fi

for arm in ts-live ts-conv ts-conv2; do
  [ -d "$R/$arm" ] || continue
  section "$arm  (grade-ts)"
  node "$HERE/grade-ts.mjs" "$R/$arm" | sed -n '/^плечо:/,$p'
done

if [ -d "$R/ts-nodesc" ]; then
  section "ts-nodesc  (grade-nodesc: назван ли файл без description)"
  node "$HERE/grade-nodesc.mjs" "$R/ts-nodesc" | sed -n '/^плечо:/,$p'
  section "ts-nodesc  (grade-ts: те же слоты, что у ts-conv)"
  node "$HERE/grade-ts.mjs" "$R/ts-nodesc" | sed -n '/^плечо:/,$p'
fi

if [ -d "$R/ts-ctx" ]; then
  section "ts-ctx  (grade-ctx --expect=spec)"
  node "$HERE/grade-ctx.mjs" "$R/ts-ctx" --expect=spec | sed -n '/^СЧЁТЧИКИ/,$p'
fi

if [ -d "$R/ts-noctx" ]; then
  section "ts-noctx  (grade-invent: конкретика БЕЗ документа)"
  node "$HERE/grade-invent.mjs" "$R/ts-noctx" | sed -n '/^СЧЁТЧИКИ/,$p'
fi

if [ -d "$R/br-ctx" ]; then
  section "br-ctx  (grade-ctx --expect=questions)"
  node "$HERE/grade-ctx.mjs" "$R/br-ctx" --expect=questions | sed -n '/^СЧЁТЧИКИ/,$p'
fi

if [ -d "$R/rv-conv" ]; then
  section "rv-conv  (grade-rv-conv: приёмка сверила 🟢-контракт с context/)"
  node "$HERE/grade-rv-conv.mjs" "$R/rv-conv" | sed -n '/^СЧЁТЧИКИ/,$p'
fi

if [ -d "$R/sb-ctx" ]; then
  section "sb-ctx  (grade-sb --legacy: спека старого образца)"
  node "$HERE/grade-sb.mjs" "$R/sb-ctx" --legacy | sed -n '/^СЧЁТЧИКИ/,$p'
fi

if [ -d "$R/sb-ctx2" ]; then
  section "sb-ctx2  (grade-sb: спека с полем «Наша сторона»)"
  node "$HERE/grade-sb.mjs" "$R/sb-ctx2" | sed -n '/^СЧЁТЧИКИ/,$p'
fi

# `context-doc`: шесть плеч, у каждого свой критерий. Имя плеча = имя пробы, суффикс после
# `cdoc-` — ключ грейдера, поэтому список пишется парами и на глаз проверяем.
for pair in "cdoc-xlsx xlsx" "cdoc-txt txt" "cdoc-txt-q txt-q" "cdoc-docx docx" "cdoc-fix fix" "cdoc-dup dup"; do
  set -- $pair
  [ -d "$R/$1" ] || continue
  section "$1  (grade-cdoc --probe=$2)"
  node "$HERE/grade-cdoc.mjs" "$R/$1" --probe="$2" | sed -n '/^СЧЁТЧИКИ/,$p'
done
