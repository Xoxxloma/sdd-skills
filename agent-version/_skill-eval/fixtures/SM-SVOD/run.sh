#!/usr/bin/env bash
# svod.sh на маленьком сервисе (предметная область — условная обсерватория): Java-перечисления с именем и без
# суффикса, Python-enum (признак после имени), роль внутри объекта, правило доступа по шаблону пути в конфиге,
# общий отправитель, тест с теми же значениями. Опись и карточка — как после частей; plan.tsv собирается здесь
# (корень — абсолютный путь фикстуры).
# Ждём: перечисления по шаблону — 4, без строки «перечисление:» — Priority и Band; места закрыты строками
# описи, кроме начального значения в сущности (строка `место:` с неверным номером) и проверки роли участника;
# тест и файл объявления мест не дают; свод — роли (своя, «без входа», из правила конфига), переходы с
# доступом входа, отправка через отправителя сведена к топику; у «публикует» без отправки — SENDER;
# `- когда:` заполнена у отменённой брони. Режим `SVOD_KEEP=1` — не удалять временную папку.
# Запуск из любого места: bash run.sh — печатает ОК или что разошлось.
HERE="$(cd "$(dirname "$0")" && pwd)"
SVOD="$HERE/../../../service-map-2.0/reference/svod.sh"
OUT="$(mktemp -d)"; if [ -n "${SVOD_KEEP:-}" ]; then echo "временная папка: $OUT"; else trap 'rm -rf "$OUT"' EXIT; fi
cp "$HERE/opis.md" "$HERE/card.md" "$OUT/"
ROOT="$(cd "$HERE/svc" && { pwd -W 2>/dev/null || pwd; })"
{ printf 'корень\t%s\n' "$ROOT"; printf '%s\t%s\t%s\t%s\n' шаблон перечисления '\benum\s+<ИМЯ>\b' '*.java' шаблон перечисления 'class\s+<ИМЯ>\(.*Enum' '*.py'; } > "$OUT/plan.tsv"
bash "$SVOD" "$OUT/opis.md" "$OUT/card.md" "$OUT/svod" "$OUT/plan.tsv" > "$OUT/log" 2>&1 || { cat "$OUT/log"; exit 1; }
tr -d '\r' < "$OUT/log" > "$OUT/log.lf"
sed "s#$ROOT/##" "$OUT/svod/svod.items" > "$OUT/items"
bad=0
in_log() { grep -q -F -- "$1" "$OUT/log.lf" || { echo "нет строки в выводе: $1"; bad=1; }; }
in_items() { grep -q -F -- "$1" "$OUT/items" || { echo "нет пункта: $1"; bad=1; }; }
no_items() { ! grep -q -F -- "$1" "$OUT/items" || { echo "лишний пункт: $1"; bad=1; }; }
in_md() { grep -q -F -- "$1" "$OUT/svod/svod.md" || { echo "нет в svod.md: $1"; bad=1; }; }
in_card() { grep -q -F -- "$1" "$OUT/card.md" || { echo "нет в карточке: $1"; bad=1; }; }
grep -q 'awk:' "$OUT/log.lf" && { echo "ошибка awk:"; grep 'awk:' "$OUT/log.lf"; bad=1; }
in_log 'перечисления: по шаблону объявлено 4, без строки «перечисление:» 2'
in_items 'ENUM	перечисление Priority (поля Reservation.priority): нет строки «перечисление:» — src/main/java/obs/reservation/Priority.java'
in_items 'ENUM	перечисление Band (поля Telescope.band): нет строки «перечисление:» — py/telescope.py'
in_items 'MESTO	ReservationStatus.REQUESTED: строки 6 (строка 40: значения там нет) — src/main/java/obs/reservation/Reservation.java'
in_items 'MESTO	MemberRole.CURATOR: строки 5 — src/main/java/obs/crew/CrewService.java'
no_items 'ReservationServiceTest'
no_items 'MemberRole.java'
no_items 'ReservationStatus.CANCELLED'
no_items 'publishCancelled'
in_items 'SENDER	публикует telescope.dome.closed'
no_items 'SENDER	публикует telescope.reservation.cancelled'
in_md '### `NIGHT_OPERATOR`'
in_md '- `POST /api/reservations/cancel` — Отмена брони. — наблюдатель — только своя бронь'
in_md '### `без входа`'
in_md '### `ADMIN`'
in_md '- `GET /api/admin/stats` — Сводка по куполам для администратора. — из конфига /admin/**'
in_md '### `Reservation.status` (тип `ReservationStatus`)'
in_md '- `POST /api/reservations/cancel` — Отмена брони. — из `CONFIRMED` — доступ: NIGHT_OPERATOR; наблюдатель — только своя бронь — условие: если ночь ещё не началась'
in_md '#### `WAITLISTED`'
in_md '### `telescope.reservation.cancelled`'
in_card '- когда: `POST /api/reservations/cancel`'
# Ключи свода для check.sh: роли, значения полей-состояний (с переходом и без), токены отправок.
for k in 'роль	ADMIN' 'роль	NIGHT_OPERATOR' 'роль	без входа' 'объект	Reservation	CANCELLED' 'объект	Reservation	WAITLISTED' 'сообщение	telescope.reservation.cancelled'; do
  grep -q -x -F -- "$k" "$OUT/svod/svod.keys" || { echo "нет ключа свода: $k"; bad=1; }
done
grep -q -F 'объект	Member' "$OUT/svod/svod.keys" && { echo "лишний ключ свода: Member без переходов"; bad=1; }
[ "$(grep -c '^- когда:' "$OUT/card.md")" -eq 1 ] || { echo "строк «- когда:» не одна"; bad=1; }
# Вариант описи: правило по шаблону с `*` (одна папка) подходит к ручке, правило без ручек — строка в вывод;
# место с видом не из списка не закрыто; тип из `перечисление:` без объявления — строка в вывод.
mkdir "$OUT/v" && cp "$HERE/card.md" "$OUT/v/"
sed -e 's|^место: ReservationStatus.CANCELLED.*|&\nместо: MemberRole.CURATOR — используется — src/main/java/obs/crew/CrewService.java:5|' \
    -e 's|^правило доступа: .*|&\nправило доступа: /api/*/stats → AUDITOR — src/main/java/obs/config/SecurityConfig.java:6\nправило доступа: /internal/** → SYSTEM — src/main/java/obs/config/SecurityConfig.java:7\nперечисление: LegacyKind OLD \| NEW — src/main/java/obs/legacy/LegacyKind.java|' "$HERE/opis.md" > "$OUT/v/opis.md"
bash "$SVOD" "$OUT/v/opis.md" "$OUT/v/card.md" "$OUT/v/svod" "$OUT/plan.tsv" > "$OUT/v/log" 2>&1
tr -d '\r' < "$OUT/v/log" > "$OUT/v/log.lf"
grep -q -F 'правило доступа «/internal/**» не подошло ни к одной ручке' "$OUT/v/log.lf" || { echo "нет строки о правиле без ручек"; bad=1; }
grep -q -F 'перечисления описи без объявления по шаблону (шаблон узок или тип из библиотеки): LegacyKind' "$OUT/v/log.lf" || { echo "нет строки о типе без объявления"; bad=1; }
grep -q -F 'MemberRole.CURATOR: строки 5 (вид места не из списка)' "$OUT/v/svod/svod.items" || { echo "место с видом не из списка закрыто"; bad=1; }
grep -q -F -- '- `GET /api/admin/stats` — Сводка по куполам для администратора. — из конфига /api/*/stats' "$OUT/v/svod/svod.md" || { echo "правило с * не подошло к ручке"; bad=1; }
# Значения из карточки: поле `Тип (A | B)` без строки `перечисление:` — значения в своде; пара дат — блок «по датам».
mkdir "$OUT/v2" && sed 's/^- `priority`: `Priority?`$/&\n- `stage`: `Stage` (`DRAFT` \\| `FINAL`)/' "$HERE/card.md" > "$OUT/v2/card.md"
sed -e 's|^  шлёт: нет$|&|' -e '/^POST \/api\/reservations\/confirm/,/^GET/{s|^  шлёт: нет$|  меняет: Reservation.stage DRAFT → FINAL — src/main/java/obs/reservation/ReservationService.java\n  шлёт: нет|}' \
    -e 's|^Member — .*|&\nсостояние: Reservation.startsAt \| endsAt — src/main/java/obs/reservation/Reservation.java\n  · бронь действует между началом и концом — src/main/java/obs/reservation/Reservation.java|' "$HERE/opis.md" > "$OUT/v2/opis.md"
bash "$SVOD" "$OUT/v2/opis.md" "$OUT/v2/card.md" "$OUT/v2/svod" > "$OUT/v2/log" 2>&1
for l in '### `Reservation.stage` (тип `Stage`)' '#### `DRAFT`' '#### `FINAL`' '## Состояния по датам' '### `Reservation` (поля startsAt | endsAt)' '- бронь действует между началом и концом'; do
  grep -q -x -F -- "$l" "$OUT/v2/svod/svod.md" || { echo "свод v2: нет строки: $l"; bad=1; }
done
grep -q -x -F 'объект	Reservation	' "$OUT/v2/svod/svod.keys" || { echo "свод v2: нет ключа объекта по датам"; bad=1; }
# Отправка без строки `отправитель:` сводится к топику: метод — по файлу-источнику «публикует», ключ продюсера —
# по строке плана «топик» с ключом над ним; состояние по одной дате в свод не идёт.
mkdir "$OUT/v3" && cp "$HERE/card.md" "$OUT/v3/"
sed -e '/^отправитель:/d' -e 's|^Member — .*|&\nпубликует telescope.reservation.cancelled — src/main/java/obs/reservation/ReservationProducer.java\nсостояние: Reservation.sentAt — src/main/java/obs/reservation/Reservation.java|' \
    -e '/^POST \/api\/reservations\/confirm/,/^GET/{s|^  шлёт: нет$|  шлёт: dome-closed-producer — при подтверждении — src/main/java/obs/reservation/ReservationService.java|}' "$HERE/opis.md" > "$OUT/v3/opis.md"
{ cat "$OUT/plan.tsv"; printf 'топик\ttelescope.dome.closed\tsrc/main/resources/application.yaml\tdome-closed-producer\n'; } > "$OUT/v3/plan.tsv"
bash "$SVOD" "$OUT/v3/opis.md" "$OUT/v3/card.md" "$OUT/v3/svod" "$OUT/v3/plan.tsv" > "$OUT/v3/log" 2>&1
for k in 'сообщение	telescope.reservation.cancelled' 'сообщение	telescope.dome.closed'; do
  grep -q -x -F -- "$k" "$OUT/v3/svod/svod.keys" || { echo "v3: отправка не сведена к топику: $k"; cat "$OUT/v3/svod/svod.keys"; bad=1; }
done
grep -q -E 'сообщение	(publishCancelled|dome-closed-producer)$' "$OUT/v3/svod/svod.keys" && { echo "v3: в своде остался метод или ключ продюсера"; bad=1; }
grep -q -F 'состояние по одной дате — не состояние, в свод не идёт: Reservation (sentAt)' "$OUT/v3/log" || { echo "v3: нет строки о состоянии по одной дате"; cat "$OUT/v3/log"; bad=1; }
grep -q -F 'Состояния по датам' "$OUT/v3/svod/svod.md" && { echo "v3: одна дата попала в свод"; bad=1; }
# Шумное значение: голым словом в 40 файлах и больше — сверки нет, строка в вывод.
mkdir -p "$OUT/noisy/src" && for i in $(seq 1 41); do printf 'class C%s { boolean f(int x) { return x == NEW; } }\n' "$i" > "$OUT/noisy/src/C$i.java"; done
printf 'enum Kind { NEW, OLD }\n' > "$OUT/noisy/src/Kind.java"
printf '## Владеет данными\n\n### `Box`\nЯщик.\n- `kind`: `Kind`\n' > "$OUT/noisy/card.md"
printf 'Box — src/Box.java (@Entity)\nперечисление: Kind NEW | OLD — src/Kind.java\n' > "$OUT/noisy/opis.md"
NR_="$(cd "$OUT/noisy" && { pwd -W 2>/dev/null || pwd; })"
printf 'корень\t%s\n' "$NR_" > "$OUT/noisy/plan.tsv"
bash "$SVOD" "$OUT/noisy/opis.md" "$OUT/noisy/card.md" "$OUT/noisy/svod" "$OUT/noisy/plan.tsv" > "$OUT/noisy/log" 2>&1
grep -q -F 'шумные значения (словом в 40 файлах и больше — сверки нет): Kind.NEW (41)' "$OUT/noisy/log" || { echo "шумное значение не названо"; cat "$OUT/noisy/log"; bad=1; }
grep -q 'Kind.NEW' "$OUT/noisy/svod/svod.items" && { echo "шумное значение попало в пункты MESTO"; bad=1; }
# SVOD_ONLY=1 — только svod.sh (так его гоняют под строгим awk: `gawk --posix` вместо awk в PATH; check.sh и
# assemble.sh строгий режим не проходят и до этой правки — `cls`, BINMODE).
if [ -n "${SVOD_ONLY:-}" ]; then [ "$bad" -eq 0 ] && echo "ОК (только svod.sh)"; exit "$bad"; fi
# check.sh по своду (одиночный читающий): привязки, метки «Событий», пункты svod.items — читающему; секции
# автора свода — заглушка, сверки со сводом нет. У входа без `шлёт:` — BIND.
CHECK="$HERE/../../../service-map-2.0/reference/check.sh"
sed '/^POST \/api\/reservations\/confirm/,/^GET/{/^  шлёт: нет$/d}' "$OUT/opis.md" > "$OUT/opis.bind.md"
CHECK_SVOD="$OUT/svod" CHECK_PLAN="$OUT/plan.tsv" CHECK_LISTS="$OUT/dobor.md" bash "$CHECK" "$OUT/opis.bind.md" "$OUT/card.md" > "$OUT/check1" 2>&1
tr -d '\r' < "$OUT/check1" > "$OUT/check1.lf"
in_check() { grep -q -F -- "$1" "$2" || { echo "нет строки в выводе check.sh ($(basename "$2")): $1"; bad=1; }; }
grep -q 'awk:' "$OUT/check1.lf" && { echo "ошибка awk в check.sh:"; grep 'awk:' "$OUT/check1.lf"; bad=1; }
in_check 'входов без строк привязки: 1 — POST /api/reservations/confirm — нет строк шлёт:' "$OUT/check1.lf"
in_check 'блоков «Событий» без строк-меток: 2 — публикует telescope.dome.closed — нет строк ключ:, когда:, гарантия:, не шлётся:; публикует telescope.reservation.cancelled — нет строк ключ:, не шлётся:' "$OUT/check1.lf"
in_check 'перечислений без строки «перечисление:»: 2; мест без строки описи: 2; публикуемых топиков без отправки: 1' "$OUT/check1.lf"
in_check 'секции автора свода — заглушка: сверки со сводом нет' "$OUT/check1.lf"
in_check 'ДОБОР читающий: 8 (без привязки 1, нет метки 2, перечисление без строки 2, место без строки 2, топик без отправки 1)' "$OUT/check1.lf"
grep -q -F 'ключ описи с источником — блока в карточке нет' "$OUT/dobor.md" && grep -A2 -F 'ключ описи с источником' "$OUT/dobor.md" | grep -q -E 'перечисление:|место:|правило доступа|отправитель' && { echo "строки свода в описи стали ключами (ADD)"; bad=1; }
grep -q -F 'тип поля сущности объявлен перечислением' "$OUT/dobor.md" || { echo "в перечне читающего нет раздела ENUM"; bad=1; }
# Секции автора свода написаны не полностью: нет двух ролей, двух значений и сообщения; «Зависит от» —
# инфраструктура из «Стека». Сверка со сводом — автору свода, отдельным файлом.
awk '
  /^## Бизнес-правила/ { print; getline; print "\n### `Reservation` — бронь ночи\n- подтверждена (`CONFIRMED`) — оператором\n- отменена (`CANCELLED`) — оператором"; next }
  /^## Роли и доступ/ { print; getline; print "| Роль | Что может |\n|---|---|\n| `NIGHT_OPERATOR` | отменяет брони |"; next }
  /^## Публичный контракт/ { print "## Стек\n| Слой | Чем |\n|---|---|\n| Хранилище | PostgreSQL |\n\n## Зависит от\n| Сервис или система | Зачем |\n|---|---|\n| `postgresql` | хранение броней |\n| `dome-control` | состояние купола |\n" }
  { print }' "$OUT/card.md" > "$OUT/card.full.md"
CHECK_SVOD="$OUT/svod" CHECK_PLAN="$OUT/plan.tsv" CHECK_LISTS="$OUT/dobor2.md" bash "$CHECK" "$OUT/opis.md" "$OUT/card.full.md" > "$OUT/check2" 2>&1
tr -d '\r' < "$OUT/check2" > "$OUT/check2.lf"
grep -q 'awk:' "$OUT/check2.lf" && { echo "ошибка awk в check.sh (2):"; grep 'awk:' "$OUT/check2.lf"; bad=1; }
in_check 'свод против секций автора свода — нет в секциях: 5 — роль ADMIN — нет строки в «Ролях и доступе»; роль без входа — нет строки в «Ролях и доступе»; объект Reservation — нет строки значения REQUESTED; объект Reservation — нет строки значения WAITLISTED; сообщение telescope.reservation.cancelled — нет блока' "$OUT/check2.lf"
in_check '«Зависит от» — инфраструктура из «Стека»: 1 — postgresql — имя стоит в «Стеке»' "$OUT/check2.lf"
in_check 'ДОБОР автор свода: 5 (строки свода 5)' "$OUT/check2.lf"
[ -s "$OUT/dobor2-svod.md" ] && grep -q -F 'роль ADMIN' "$OUT/dobor2-svod.md" || { echo "нет файла перечня автора свода с пунктами"; bad=1; }
# Нарезанный сервис: маршрут пунктов по файлу — место и перечисление в папке части 01 — ей, файл вне частей —
# остатку (02, номер после последней части плана).
P="$OUT/parts"; mkdir -p "$P"
{ printf '<!-- service-map: часть 01 2026-10-21 -->\n'; cat "$HERE/card.md"; } > "$P/part-01.md"
{ printf '<!-- service-map: часть 01 2026-10-21 -->\n'; cat "$HERE/opis.md"; } > "$P/part-01.opis.md"
printf '<!-- service-map: часть 02 2026-10-21 -->\n' > "$P/part-02.md"; printf '<!-- service-map: часть 02 2026-10-21 -->\n' > "$P/part-02.opis.md"
{ cat "$OUT/plan.tsv"; printf 'часть\t01\tконтракт\t3\nпуть\t%s/src/main/java/obs/reservation\tпапки\t01\n' "$ROOT"; } > "$P/plan.tsv"
bash "$SVOD" "$HERE/opis.md" "$OUT/card.md" "$P/svod" "$P/plan.tsv" > /dev/null 2>&1
CHECK_PARTS="$P" CHECK_PLAN="$P/plan.tsv" CHECK_LISTS="$P/dobor.md" bash "$CHECK" "$HERE/opis.md" "$OUT/card.md" > "$OUT/check3" 2>&1
tr -d '\r' < "$OUT/check3" > "$OUT/check3.lf"
grep -q -E '^ДОБОР часть 01: .*перечисление без строки 1, место без строки 1' "$OUT/check3.lf" || { echo "нарезка: часть 01 не получила перечисление и место"; grep '^ДОБОР' "$OUT/check3.lf"; bad=1; }
grep -q -E '^ДОБОР часть 02: .*перечисление без строки 1, место без строки 1' "$OUT/check3.lf" || { echo "нарезка: остаток не получил перечисление и место"; grep '^ДОБОР' "$OUT/check3.lf"; bad=1; }
grep -q -F 'Priority' "$P/dobor-01.md" && grep -q -F 'CrewService.java' "$P/dobor-02.md" || { echo "нарезка: пункты не в тех файлах перечня"; bad=1; }
# Склейка (assemble.sh): две части пишут блок «публикует» с разными метками — у владельца (02, по плану)
# «тело: не определено» заменяется телом части 01, «ключ» дописывается, «гарантия» владельца остаётся;
# «Зависит от» одного имени у двух частей — одна строка и строка в выводе; хвост-файл у `доступ:` снят,
# `меняет: нет` в карточку не идёт; свод собран в папке частей, `- когда:` дописана.
ASM="$HERE/../../../service-map-2.0/reference/assemble.sh"
mkdir "$OUT/asm" && cp "$HERE/asm/"* "$OUT/asm/"
bash "$ASM" "$OUT/asm" 2 2026-10-21 "$OUT/asm.card.md" "$OUT/asm.opis.md" > "$OUT/asm.log" 2>&1 || { cat "$OUT/asm.log"; exit 1; }
tr -d '\r' < "$OUT/asm.log" > "$OUT/asm.lf"
in_check 'События: публикует telescope.reservation.cancelled — блок части 02 (владелец по плану); новых строк-меток от 01 — строк 2; у 01 строк «- » отброшено 1' "$OUT/asm.lf"
in_check 'Зависит от: dome-control — строка части 02 отброшена, оставлена строка части 01' "$OUT/asm.lf"
in_check 'когда: дописано у 1 блоков публикации' "$OUT/asm.lf"
for l in '- тело: `ReservationCancelled`' '- ключ: `observerId`' '- гарантия: после коммита, через outbox' '- когда: `POST /api/reservations/cancel`' 'доступ: `NIGHT_OPERATOR`' '| `dome-control` | состояние купола |'; do
  grep -q -x -F -- "$l" "$OUT/asm.card.md" || { echo "склейка: нет строки карточки: $l"; bad=1; }
done
grep -q -E '^(меняет|шлёт): нет|не определено: класс тела|отдельным вызовом|проверка купола в задаче' "$OUT/asm.card.md" && { echo "склейка: лишняя строка в карточке"; bad=1; }
[ -s "$OUT/asm/svod/svod.md" ] || { echo "склейка: свода в папке частей нет"; bad=1; }
# Без строк свода в описях частей svod.sh не зовётся и папки svod/ нет.
mkdir "$OUT/asm0" && cp "$HERE/asm/"* "$OUT/asm0/" && sed -i -E '/^[ 	]+(доступ|меняет|шлёт):/d' "$OUT/asm0/"part-0*.opis.md
bash "$ASM" "$OUT/asm0" 2 2026-10-21 "$OUT/asm0.card.md" "$OUT/asm0.opis.md" > "$OUT/asm0.log" 2>&1 || { cat "$OUT/asm0.log"; exit 1; }
[ -d "$OUT/asm0/svod" ] && { echo "склейка без строк свода: папка svod/ создана"; bad=1; }
# Без корней — только свод и `когда:`, мест и пунктов перечислений нет.
cp "$HERE/opis.md" "$HERE/card.md" "$OUT/" && mkdir "$OUT/nr"
bash "$SVOD" "$OUT/opis.md" "$OUT/card.md" "$OUT/nr" > "$OUT/log2" 2>&1 || { cat "$OUT/log2"; exit 1; }
grep -q -F 'корней нет — мест и сверки перечислений нет' "$OUT/log2" || { echo "без корней: нет строки о корнях"; bad=1; }
grep -q -E '^(ENUM|MESTO)' "$OUT/nr/svod.items" && { echo "без корней: есть пункты ENUM/MESTO"; bad=1; }
[ "$bad" -eq 0 ] && echo "ОК"
exit "$bad"
