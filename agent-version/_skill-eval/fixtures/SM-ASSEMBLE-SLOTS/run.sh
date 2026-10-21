#!/usr/bin/env bash
# Склейка блоков «Событий» строками-метками и «Зависит от» строками частей; проверки формы «Событий» и
# «Зависит от» в check.sh. Предметная область — условная обсерватория.
# Ждём: у дубля «публикует» владелец (часть 02 по плану) получает метки части 01, которых у него нет, его
# «тело: не определено» заменяется телом части 01, «гарантия» владельца остаётся; «Зависит от» одного имени у
# двух частей — одна строка и строка в выводе; хвост-файл у `доступ:` снят, `меняет: нет` в карточку не идёт.
# check.sh: блок без меток «когда», «не шлётся» — пункт «нет метки»; строка «Зависит от», чьё имя стоит в
# «Стеке», — пункт «инфраструктура». Режим `KEEP=1` — не удалять временную папку.
# Запуск из любого места: bash run.sh — печатает ОК или что разошлось.
HERE="$(cd "$(dirname "$0")" && pwd)"
REF="$HERE/../../../service-map-2.0/reference"
OUT="$(mktemp -d)"; if [ -n "${KEEP:-}" ]; then echo "временная папка: $OUT"; else trap 'rm -rf "$OUT"' EXIT; fi
bad=0
in_file() { grep -q -F -- "$1" "$2" || { echo "нет строки ($(basename "$2")): $1"; bad=1; }; }

mkdir "$OUT/asm" && cp "$HERE/asm/"* "$OUT/asm/"
bash "$REF/assemble.sh" "$OUT/asm" 2 2026-10-21 "$OUT/card.md" "$OUT/opis.md" > "$OUT/asm.log" 2>&1 || { cat "$OUT/asm.log"; exit 1; }
tr -d '\r' < "$OUT/asm.log" > "$OUT/asm.lf"
grep -q 'awk:' "$OUT/asm.lf" && { echo "ошибка awk в склейке:"; grep 'awk:' "$OUT/asm.lf"; bad=1; }
in_file 'События: публикует telescope.reservation.cancelled — блок части 02 (владелец по плану); новых строк-меток от 01 — строк 2; у 01 строк «- » отброшено 1' "$OUT/asm.lf"
in_file 'Зависит от: dome-control — строка части 02 отброшена, оставлена строка части 01' "$OUT/asm.lf"
for l in '- тело: `ReservationCancelled`' '- ключ: `observerId`' '- гарантия: после коммита, через outbox' 'доступ: `NIGHT_OPERATOR`' '| `dome-control` | состояние купола |'; do
  grep -q -x -F -- "$l" "$OUT/card.md" || { echo "склейка: нет строки карточки: $l"; bad=1; }
done
grep -q -E '^(меняет|шлёт): нет|не определено: класс тела|отдельным вызовом|проверка купола в задаче' "$OUT/card.md" && { echo "склейка: лишняя строка в карточке"; bad=1; }

# check.sh: «Стек» с хранилищем и та же база строкой «Зависит от».
awk '/^## Публичный контракт/ { print "## Стек\n| Слой | Чем |\n|---|---|\n| Хранилище | PostgreSQL |\n" } { print } /^\| `dome-control`/ { print "| `postgresql` | хранение броней |" }' "$OUT/card.md" > "$OUT/card.full.md"
CHECK_LISTS="$OUT/dobor.md" bash "$REF/check.sh" "$OUT/opis.md" "$OUT/card.full.md" 2>&1 | tr -d '\r' > "$OUT/check1.lf"
grep -q 'awk:' "$OUT/check1.lf" && { echo "ошибка awk в check.sh:"; grep 'awk:' "$OUT/check1.lf"; bad=1; }
in_file 'блоков «Событий» без строк-меток: 1 — публикует telescope.reservation.cancelled — нет строк когда:, не шлётся:' "$OUT/check1.lf"
in_file '«Зависит от» — инфраструктура из «Стека»: 1 — postgresql — имя стоит в «Стеке»' "$OUT/check1.lf"
in_file 'ДОБОР читающий: 2 (нет метки 1, инфраструктура 1)' "$OUT/check1.lf"
in_file 'блок «Событий» без строки-метки' "$OUT/dobor.md"
# Нарезанный: метка — автору блока (блок «публикует» писали обе части).
CHECK_PARTS="$OUT/asm" CHECK_PLAN="$OUT/asm/plan.tsv" CHECK_LISTS="$OUT/asm/dobor.md" bash "$REF/check.sh" "$OUT/opis.md" "$OUT/card.full.md" 2>&1 | tr -d '\r' > "$OUT/check2.lf"
in_file 'ДОБОР часть 01: 1 (нет метки 1)' "$OUT/check2.lf"
in_file 'ДОБОР часть 02: 1 (нет метки 1)' "$OUT/check2.lf"
# Строку «Зависит от» с инфраструктурой написала часть (без заголовка таблицы) — пункт ей, а не «без хозяина».
mkdir "$OUT/asm2" && cp "$HERE/asm/"* "$OUT/asm2/" && printf '| `postgresql` | хранение броней |\n' >> "$OUT/asm2/part-02.md"
bash "$REF/assemble.sh" "$OUT/asm2" 2 2026-10-21 "$OUT/card2.md" "$OUT/opis2.md" > /dev/null 2>&1 || { echo "склейка asm2 упала"; bad=1; }
awk '/^## Публичный контракт/ { print "## Стек\n| Слой | Чем |\n|---|---|\n| Хранилище | PostgreSQL |\n" } { print }' "$OUT/card2.md" > "$OUT/card2.full.md"
CHECK_PARTS="$OUT/asm2" CHECK_PLAN="$OUT/asm2/plan.tsv" CHECK_LISTS="$OUT/asm2/dobor.md" bash "$REF/check.sh" "$OUT/opis2.md" "$OUT/card2.full.md" 2>&1 | tr -d '\r' > "$OUT/check3.lf"
in_file 'ДОБОР часть 02: 2 (нет метки 1, инфраструктура 1)' "$OUT/check3.lf"
grep -q '^ДОБОР без хозяина' "$OUT/check3.lf" && { echo "инфраструктура части ушла «без хозяина»"; bad=1; }
[ "$bad" -eq 0 ] && echo "ОК"
exit "$bad"
