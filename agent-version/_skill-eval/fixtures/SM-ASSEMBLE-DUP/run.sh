#!/usr/bin/env bash
# Склейка частей в assemble.sh (предметная область — условная обсерватория). Части пишут один ключ
# по-разному (строка запроса, аргументы, хвост « — описание», слово и пометка в скобках вокруг топика в
# бэктиках) и одни и те же блоки дважды; plan.tsv отдаёт папки частям.
# Ждём: ключ по шаблону; дубль — блок владельца по плану (ручка части 01, сущности части 02), поля с новыми
# именами из других блоков дописаны (`domeId, note` у ShiftLogEntry), строки `— `
# других блоков дописаны, `- ` отброшены; владельца нет — объединение с причиной (файл у двух частей,
# файл вне частей плана; без plan.tsv — «плана нет»); топик без бэктиков с лишним словом — блок как есть
# и «ключ не опознан»; блок без дубля как есть. «Бизнес-правила» пишет голова: блок части отброшен; в описи
# строки правил частей (точный повтор — одной строкой, подстроки под ней), строк правил головы нет.
# Запуск из любого места: bash run.sh [папка reference скилла] — печатает ОК или что разошлось. Концы строк не сравниваются:
# git на Windows отдаёт эталон с CRLF.
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../sm-run.sh"   # SM_RUNNER=ps1 — через reference/run.ps1, как на Windows
ASM="${1:-$HERE/../../../service-map-2.0/reference}/assemble.sh"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
sm_run "$ASM" "$HERE/parts" 2 2026-10-19 "$OUT/card.md" "$OUT/opis.md" > "$OUT/log" || { cat "$OUT/log"; exit 1; }
tr -d '\r' < "$OUT/log" > "$OUT/log.lf"
bad=0
want() { grep -q -F -- "$1" "$OUT/log.lf" || { echo "нет строки в выводе: $1"; bad=1; }; }
want 'отброшено: секция «Бизнес-правила» у частей 01 — её пишет голова'
want 'Публичный контракт: GET /api/nights/free-count — блок части 01 (владелец по плану); у 02 строк «- » отброшено 1'
want 'Владеет данными: Reservation — блок части 02 (владелец по плану); у 01 строк «- » отброшено 5'
want 'Владеет данными: ShiftLogEntry — блок части 02 (владелец по плану); новых полей от 01 — строк 1; у 01 строк «- » отброшено 0'
want 'Владеет данными: Telescope — блоки частей 01, 02 объединены, владельца нет: файл-источник вне частей плана'
want 'События: потребляет sky.cloud-alert — блоки частей 01, 02 объединены, владельца нет: файл-источник у нескольких частей'
want 'События: публикует на telescope.reservation.events (часть 02)'
diff <(tr -d '\r' < "$HERE/expect.md") "$OUT/card.md" || bad=1
diff <(tr -d '\r' < "$HERE/expect.opis.md") "$OUT/opis.md" || bad=1
# Спецификацию план не разметил (строк о ней нет): она справочник, операция — части с обработчиком (02).
mkdir "$OUT/nospec"; cp "$HERE/parts/"*.md "$OUT/nospec/"; tr -d '\r' < "$HERE/parts/plan.tsv" | grep -v 'openapi\.yaml' > "$OUT/nospec/plan.tsv"
sm_run "$ASM" "$OUT/nospec" 2 2026-10-19 "$OUT/card3.md" "$OUT/opis3.md" > "$OUT/log3" || { cat "$OUT/log3"; exit 1; }
grep -q -F 'Публичный контракт: GET /api/nights/free-count — блок части 02 (владелец по плану)' "$OUT/log3" \
  || { echo "спецификация не размечена: владелец операции не часть с обработчиком (02)"; grep 'free-count' "$OUT/log3"; bad=1; }
# Хвост « — <файл>» у строки факта (и « + <файл>») снимается, факт остаётся: карточка та же, что без хвостов.
mkdir "$OUT/tails"; cp "$HERE/parts/"*.md "$HERE/parts/plan.tsv" "$OUT/tails/"
sed -i -e 's/^- `mount`: `string`/& — src\/telescope\/Telescope.java/' -e 's/^- `operatorId`: `uuid`/& — `src\/log\/ShiftLogEntry.kt`/' \
  -e 's/^— запись с пометкой оператора не удаляется/& — src\/log\/ShiftLog.java + ShiftLogService.java/' "$OUT/tails/part-02.md"
sm_run "$ASM" "$OUT/tails" 2 2026-10-19 "$OUT/card4.md" "$OUT/opis4.md" > "$OUT/log4" || { cat "$OUT/log4"; exit 1; }
grep -q -F 'хвост « — файл» снят у строк фактов: 3' "$OUT/log4" || { echo "хвосты: нет строки о трёх снятых"; grep 'хвост' "$OUT/log4"; bad=1; }
diff <(tr -d '\r' < "$HERE/expect.md") "$OUT/card4.md" || { echo "хвосты: карточка отличается от карточки без хвостов"; bad=1; }
# Без плана владельца нет ни у кого: все дубли — объединение «плана нет».
mkdir "$OUT/noplan"; cp "$HERE/parts/"*.md "$OUT/noplan/"
sm_run "$ASM" "$OUT/noplan" 2 2026-10-19 "$OUT/card2.md" "$OUT/opis2.md" > "$OUT/log2" || { cat "$OUT/log2"; exit 1; }
n=$(grep -c 'объединены, владельца нет: плана нет' "$OUT/log2")
[ "$n" -eq 5 ] || { echo "без плана: объединений «плана нет» $n, ждали 5"; bad=1; }
[ "$bad" -eq 0 ] && echo "ОК"
exit "$bad"
