#!/usr/bin/env bash
# run-ctx.sh — пул прогонов одной пробы петли 5.0 через `claude -p` (Haiku).
#
#   ./run-ctx.sh <проба> <папка-раунда> <N> [параллельность]
#
# Заменяет связку `setup-ctx-runs.mjs` + ручной запуск субагентов. Причины ровно две, и обе
# из разбора раундов 2026-08-13/14:
#
# 1. **Снимок скилла обязателен и делается ЗДЕСЬ.** Прежняя раскладка писала в `runs.json` путь
#    к ЖИВОМУ `SKILL.md`; файл правится между раундами и не коммитится, поэтому текст, которым
#    получены числа, переставал существовать в момент следующей правки. Снимок кладётся в
#    `<раунд>/_skills/` ОДИН раз на раунд: повторный запуск той же пробы в том же раунде обязан
#    читать тот же текст, иначе половина пула мерит одно, половина другое.
#
# 2. **`answer.md` берётся из stdout, а не просьбой к прогону.** Раунд 2 просил «обязательно
#    запиши ответ в answer.md» — шесть прогонов `ts-ctx` из десяти положили туда всю спеку и
#    файла спеки не создали (`RUNNER.md`, раздел «Ловушка»). Здесь про запись файлов в промпте
#    не сказано ничего: единственные файлы в песочнице те, которые скилл создал сам.
#
# Раскладка плоская: `<раунд>/<проба>/run-NN/` — она же песочница, `answer.md` рядом.
# `grade-ctx.mjs` читает её напрямую, `grade-ts.mjs` — с 2026-08-14 тоже (обе формы).

set -u

PROBE="${1:-}"
ROUND="${2:-}"
N="${3:-10}"
CONC="${4:-5}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Свой пул, а не корневой `_skill-eval/run-pool.sh`. Причина — в шапке `run-pool-ctx.sh`:
# последняя строка промпта корневого раннера («Твой ответ — то, что ты сказал бы пользователю в
# чат») отменяла запись файла у половины прогонов. Корневой раннер не трогаем: на нём стоят
# другие евалы репы, и менять его надо своим замером, а не заодно.
POOL="$HERE/run-pool-ctx.sh"

# проба → фикстура, файл промпта, скилл. `SEED_SUB` — подпапка засева, если он не вся фикстура.
SEED_SUB=""
# Заглушки под-скиллов: имя подпапки внутри фикстуры. Пусто → в песочницу кладётся один скилл,
# как было. Заводится только у проб, которые меряют МАРШРУТ оркестратора, а не содержание.
STUBS_SUB=""
case "$PROBE" in
  ts-live)   FIXTURE=TS-LIVE;   PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  ts-conv)   FIXTURE=TS-CONV;   PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  ts-conv2)  FIXTURE=TS-CONV2;  PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  ts-ctx)    FIXTURE=TS-CTX;    PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  ts-nodesc) FIXTURE=TS-NODESC; PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  ts-noctx)  FIXTURE=TS-NOCTX;  PROMPT_FILE=spec-prompt.txt;  SKILL=technical-spec-doc ;;
  br-ctx)    FIXTURE=BR-CTX;    PROMPT_FILE=t1-prompt.txt;    SKILL=business-requirements-doc ;;
  sb-ctx)    FIXTURE=SB-CTX;    PROMPT_FILE=stage-prompt.txt; SKILL=stage-breakdown-doc ;;
  # Приёмка ничего не пишет на диск: её артефакт — `answer.md` из stdout, и другого нет.
  rv-conv)   FIXTURE=RV-CONV;   PROMPT_FILE=rv-prompt.txt;    SKILL=spec-review ;;
  # Сторож основного пути: чистый документ и НЕТ папки `context/`. Ловит оба способа, которыми
  # пункт 12 мог полезть не туда, — ложное срабатывание там, где его предмета нет, и уход
  # субагента за пределы артефакта по новому пути к корню репозитория.
  rv-clean)  FIXTURE=RV-CLEAN;  PROMPT_FILE=rv-prompt.txt;    SKILL=spec-review ;;
  sb-ctx2)   FIXTURE=SB-CTX2;   PROMPT_FILE=stage-prompt.txt; SKILL=stage-breakdown-doc ;;
  # ── `spec-readiness`: достаточно ли спеки, чтобы писать код ────────────────────────────────
  # Как и приёмка, ничего не пишет на диск: артефакт — `answer.md` из stdout. Парное плечо без
  # скилла гоняется отдельным `run-ctl.sh` на той же фикстуре — оно и есть знаменатель.
  sr-gap)    FIXTURE=SR-GAP;    PROMPT_FILE=sr-prompt.txt;   SKILL=spec-readiness ;;
  # Сторож ложного срабатывания: спека реализуема, законный исход — «блокеров: 0».
  sr-clean)  FIXTURE=SR-CLEAN;  PROMPT_FILE=sr-prompt.txt;   SKILL=spec-readiness ;;
  # Ловушка: `services/itsm.md` набита конкретикой, которой в спеке нет. Ни один её литерал не
  # имеет права попасть в отчёт, и ни одна 🟡-карточка — в блокеры.
  sr-yellow) FIXTURE=SR-YELLOW; PROMPT_FILE=sr-prompt.txt;   SKILL=spec-readiness ;;
  # Дифференцирующий тест фикстуры, а не скилла: `SR-GAP` обязана быть чистой ПО ФОРМЕ. Приёмка
  # нашла нарушение — значит фикстура мерит форму, а не реализуемость, и чинить надо её.
  rv-srgap)  FIXTURE=SR-GAP;    PROMPT_FILE=rv-prompt.txt;   SKILL=spec-review ;;
  # У `BR-ROLES` засев лежит подпапкой (`seed/`), а не всей фикстурой: рядом с ним живут второй
  # засев под тех-спеку и четыре промпта разных плеч.
  br-roles-w) FIXTURE=BR-ROLES; PROMPT_FILE=w-prompt.txt; SKILL=business-requirements-doc; SEED_SUB=seed ;;
  br-roles-q) FIXTURE=BR-ROLES; PROMPT_FILE=q-prompt.txt; SKILL=business-requirements-doc; SEED_SUB=seed ;;
  # ── `context-doc`: импорт документа человека в `context/` ─────────────────────────────────
  # Главная проба набора — `cdoc-xlsx`: источник НЕ читается (конвертера в окружении нет), и
  # законный исход — отсутствие файла. Гейт описания в её промпте снят заранее, иначе «файла нет»
  # получалось бы по неверной причине: прогон просто ждёт согласования описания.
  cdoc-xlsx)  FIXTURE=CD-XLSX; PROMPT_FILE=x-prompt.txt; SKILL=context-doc ;;
  # Одна фикстура, два плеча, отличие — один абзац промпта: снят гейт описания или нет. Складывать
  # их числа нельзя, у плеч разные законные исходы (файл против вопроса) — см. `br-roles-w/q`.
  cdoc-txt)   FIXTURE=CD-TXT;  PROMPT_FILE=w-prompt.txt; SKILL=context-doc ;;
  cdoc-txt-q) FIXTURE=CD-TXT;  PROMPT_FILE=q-prompt.txt; SKILL=context-doc ;;
  # Противовес `cdoc-xlsx`: офисный файл, который РЕАЛЬНО распаковывается, — отказ здесь дефект.
  cdoc-docx)  FIXTURE=CD-DOCX; PROMPT_FILE=d-prompt.txt; SKILL=context-doc ;;
  cdoc-fix)   FIXTURE=CD-FIX;  PROMPT_FILE=f-prompt.txt; SKILL=context-doc ;;
  cdoc-dup)   FIXTURE=CD-DUP;  PROMPT_FILE=u-prompt.txt; SKILL=context-doc ;;

  # ── `bug-report-doc`: описание дефекта ────────────────────────────────────────────────────
  # Одно дерево, шесть плеч (как `CD-TXT` и `BR-ROLES`). Отличие плеч — только сообщение
  # аналитика; окружение у всех одно, поэтому числа сравнимы между собой.
  #
  # В дереве лежит `docs/ARS-102/` — спека вкладки расчёта ГБР на карточке инцидента. Для
  # `bg-role-w` это ЯКОРЬ: ожидаемое поведение там записано (§4.4, §5.3), и скилл обязан
  # сослаться путём и разделом. Для `bg-flick-w` и `bg-form-w` это ЛОВУШКА: их дефекты живут на
  # других экранах, и приписанный им `ARS-102` — нарушение. Одно дерево ловит оба провала.
  #
  # Плечи `-w` дают ответы аналитика заранее («это ПРОДОЛЖЕНИЕ», как у `ts-ctx`) и меряют
  # ЗАПИСАННЫЙ ФАЙЛ. Плечи `-q` дают голое описание и меряют, ЧТО СПРОШЕНО и что файла нет.
  # Складывать их числа нельзя: законные исходы разные.
  bg-flick-w)  FIXTURE=BG-INC; PROMPT_FILE=flick-w-prompt.txt;  SKILL=bug-report-doc ;;
  bg-flick-q)  FIXTURE=BG-INC; PROMPT_FILE=flick-q-prompt.txt;  SKILL=bug-report-doc ;;
  bg-form-w)   FIXTURE=BG-INC; PROMPT_FILE=form-w-prompt.txt;   SKILL=bug-report-doc ;;
  bg-role-w)   FIXTURE=BG-INC; PROMPT_FILE=role-w-prompt.txt;   SKILL=bug-report-doc ;;
  # Ключа в сообщении нет намеренно — Gate 0 обязан заблокировать запись.
  bg-data-q)   FIXTURE=BG-INC; PROMPT_FILE=data-q-prompt.txt;   SKILL=bug-report-doc ;;
  # Негативный случай: новая возможность в жалобной форме, баг-репорта быть не должно.
  bg-notbug-q) FIXTURE=BG-INC; PROMPT_FILE=notbug-q-prompt.txt; SKILL=bug-report-doc ;;

  # ── спека на багфикс: режим `technical-spec-doc` по баг-репорту ───────────────────────────
  # Флаг багфикса изображён промптом — проводник про багфикс ещё не знает (шаг 8 плана). Дерево
  # своё, а не `BG-INC`: там `bg-flick-w` сама пишет в `docs/ARS-312/`, и готовый репорт в
  # песочнице дал бы ей найти собственный выход засеянным.
  bf-spec)     FIXTURE=BF-SPEC; PROMPT_FILE=spec-prompt.txt; SKILL=technical-spec-doc ;;

  # ── лишние тех-гейты у багфикса: BF-GATE, два ВОПРОСНЫХ плеча ─────────────────────────────
  # Ответов аналитика заранее НЕТ — законный исход по скиллу «turn 1 = questions only»: список
  # вопросов и ни одного файла. Грейдится `answer.md`, как у `br-ctx` и `bg-*-q`.
  #
  # `bfg-scroll` — дефект не про доступ/нагрузку/выкат/ошибки: меряется ПЕРЕБОР вопросов.
  # `bfg-role`   — дефект ПРО доступ: сторож обратного отказа. Если правка научит скилл молчать
  #                про роли вообще, покраснеет здесь. Складывать числа плеч нельзя.
  bfg-scroll)  FIXTURE=BF-GATE; PROMPT_FILE=scroll-q-prompt.txt; SKILL=technical-spec-doc ;;
  bfg-role)    FIXTURE=BF-GATE; PROMPT_FILE=role-q-prompt.txt;   SKILL=technical-spec-doc ;;

  # ── МАРШРУТ проводника: под-скиллы заглушены ──────────────────────────────────────────────
  # Меряется только переход по шагам: какой скилл вызван, в каком порядке, что передано, зашёл ли
  # в разрез. Документы не производятся — заглушки кладут предзаписанные из `prebaked/`.
  #
  # Грейдится `_trace.log`, который заглушки пишут на диск, а НЕ формулировка отчёта: агент может
  # рассказать о вызове, не сделав его, и наоборот. То же правило, что «грейдить файл, а не отчёт».
  #
  # `rt-bug` — багфикс мимо БТ и мимо разреза; `rt-feature` — сторож: обычная задача обязана
  # по-прежнему уходить в `business-requirements-doc`, иначе правка входа сломала основной путь.
  rt-bug)      FIXTURE=RT-BUG; PROMPT_FILE=bug-prompt.txt;     SKILL=analyst-workspace; STUBS_SUB=stubs ;;
  rt-feature)  FIXTURE=RT-BUG; PROMPT_FILE=feature-prompt.txt; SKILL=analyst-workspace; STUBS_SUB=stubs ;;
  # ПОРЯДОК НА ВХОДЕ. Правка 2026-08-18 убрала лишний ход: проводник больше не спрашивает ключ
  # задачи сам — его спрашивает под-скилл своим Gate 0, и порядок теперь «кнопка → меню БТ/баг →
  # под-скилл». Два плеча выше этого НЕ ВИДЯТ: ключ подан в их промптах строкой «Ключ задачи: …»,
  # то есть к моменту развилки он уже есть и спрашивать нечего. Отсюда два плеча ниже.
  #
  # `rt-menu` — Шаг 1Б: кнопка нажата, тип НЕ назван, ключа нет. Верный исход — ход остановлен
  # одним вопросом из двух вариантов, ключ не спрошен, ни один под-скилл не вызван.
  rt-menu)     FIXTURE=RT-BUG; PROMPT_FILE=menu-prompt.txt;    SKILL=analyst-workspace; STUBS_SUB=stubs ;;
  # `rt-nokey` — тот же дефект, что в `rt-bug`, но ключа нет НИГДЕ. Маршрут обязан дойти до
  # `bug-report-doc`, а не встать с требованием назвать ключ. Заглушка при непереданном ключе
  # берёт `ARS-312`, поэтому пути ниже по маршруту те же и числа сопоставимы с `rt-bug` напрямую.
  rt-nokey)    FIXTURE=RT-BUG; PROMPT_FILE=nokey-prompt.txt;   SKILL=analyst-workspace; STUBS_SUB=stubs ;;
  # Ветка «Продолжить начатое»: на диске лежит ТОЛЬКО баг-репорт, спеки под него нет. Проверяется,
  # опознан ли он сводкой состояния (глоб ветки его раньше не видел вовсе) и уходит ли маршрут в
  # спеку с флагом багфикса, а не по кругу в `bug-report-doc`. Рядом чужая `ARS-102` с полным
  # комплектом — ловушка на подстановку соседнего документа.
  rt-cont)     FIXTURE=RT-CONT; PROMPT_FILE=cont-prompt.txt; SKILL=analyst-workspace; STUBS_SUB=stubs ;;

  # ── приёмка баг-репорта ───────────────────────────────────────────────────────────────────
  # Главное плечо здесь ЧИСТОЕ, а не грязное: у проверяющего инструмента худший отказ — покраснеть
  # на корректном документе. Список, который краснит зря, перестают читать целиком, и вместе с
  # ложными находками теряются настоящие. Та же логика, что у сторожа `rv-clean`.
  #
  # Чистый документ — ЗАМОРОЖЕННЫЙ ВЫХОД ПРОГОНА `bg-flick-w` из круга 2, а не рукопись
  # (происхождение записано в `fixtures/RV-BUG/PROVENANCE.txt`). Так проверка идёт по тому, что
  # скилл реально пишет, а не по идеалу, которого он не производит.
  rv-bug-clean) FIXTURE=RV-BUG; PROMPT_FILE=clean-prompt.txt; SKILL=spec-review ;;
  rv-bug-dirty) FIXTURE=RV-BUG; PROMPT_FILE=dirty-prompt.txt; SKILL=spec-review ;;
  # Спека на багфикс рядом с баг-репортом: источником обязан уйти РЕПОРТ, а пункт 3 обязан найти
  # FR-1 в его «Ожидаемом результате» и НЕ покраснеть за «требование без контракта» — §2 у багфикса
  # законно «не применимо». Два разных провала, различимы в одном отчёте: приёмка называет пути
  # вслух, поэтому непереданный источник виден прямо, а ложная находка — это пункт 3.
  rv-bug-spec)  FIXTURE=RV-BUG; PROMPT_FILE=spec-prompt.txt; SKILL=spec-review ;;
  # РАЗЛИЧАЮЩАЯ проба под правило источника. У ARS-314 репорт несёт FR-1, а §7 спеки его не
  # трассирует. Источник передан → пункт 3 обязан назвать «требование без критерия приёмки».
  # Источник НЕ передан → пункт 3 молчит, и «нарушений: 0» получается сам собой. Без этой пробы
  # чистый вердикт на `rv-bug-spec` не отличить от неработающего правила: он выходит в обоих случаях.
  rv-bug-src)   FIXTURE=RV-BUG; PROMPT_FILE=src-prompt.txt;  SKILL=spec-review ;;

  *) echo "неизвестная проба: '$PROBE'"; echo "есть: bfg-scroll bfg-role ts-live ts-conv ts-conv2 ts-ctx ts-nodesc ts-noctx br-ctx sb-ctx sb-ctx2 rv-conv rv-clean br-roles-w br-roles-q cdoc-xlsx cdoc-txt cdoc-txt-q cdoc-docx cdoc-fix cdoc-dup sr-gap rv-bug-clean rv-bug-dirty rv-bug-spec rv-bug-src bf-spec rt-bug rt-feature rt-menu rt-nokey rt-cont bg-flick-w bg-flick-q bg-form-w bg-role-w bg-data-q bg-notbug-q"; exit 1 ;;
esac

[ -n "$ROUND" ] || { echo "usage: ./run-ctx.sh <проба> <папка-раунда> <N> [параллельность]"; exit 1; }
[ -f "$POOL" ]  || { echo "нет раннера: $POOL"; exit 1; }

FIXTURE_DIR="$HERE/fixtures/$FIXTURE"
PROMPT="$FIXTURE_DIR/$PROMPT_FILE"
[ -f "$PROMPT" ] || { echo "нет промпта: $PROMPT"; exit 1; }

mkdir -p "$ROUND/_skills"
SNAP_KEEP="$ROUND/_skills/$SKILL.SKILL.md"
if [ -f "$SNAP_KEEP" ]; then
  echo "снимок скилла уже есть — прогон читает ЕГО: $SNAP_KEEP"
else
  cp "$HERE/../$SKILL/SKILL.md" "$SNAP_KEEP"
  echo "снимок скилла: $SNAP_KEEP"
fi
# ПРОГОН ЧИТАЕТ КОПИЮ СНИМКА ВНЕ РЕПОЗИТОРИЯ. Единственный путь, который прогон получает внутрь
# репы, — это путь к скиллу; получив его, часть прогонов уходит бродить по соседним папкам и
# пишет результат в фикстуру (2026-08-14: три случая). В папке раунда снимок остаётся для
# журнала, но читается он из /tmp — оттуда идти некуда.
SNAP_ROOT="${SKILL_EVAL_SEED_ROOT:-/tmp/skill-eval-seed}/$(basename "$ROUND")-skills"
mkdir -p "$SNAP_ROOT/$SKILL"
SNAP="$SNAP_ROOT/$SKILL/SKILL.md"
cp "$SNAP_KEEP" "$SNAP"
# ПАПКА `reference/` — ЧАСТЬ ИЗМЕРЯЕМОГО ТЕКСТА, И БЕЗ НЕЁ СНИМОК ЛЖЁТ. `spec-review` держит в
# `SKILL.md` только маршрут, а сами правила — в `reference/checklist-*.md`; `technical-spec-doc`
# держит там шаблон спеки. Снимая один `SKILL.md`, раннер отправлял прогон читать ЖИВОЙ чек-лист:
# круги «до правки» и «после» мерились бы на одном и том же тексте, и разница вышла бы нулевой
# по построению. Кладётся рядом со снимком, поэтому относительный путь `reference/…` из скилла
# ведёт в снимок, а не в репозиторий.
if [ -d "$HERE/../$SKILL/reference" ]; then
  if [ ! -d "$ROUND/_skills/$SKILL.reference" ]; then
    cp -r "$HERE/../$SKILL/reference" "$ROUND/_skills/$SKILL.reference"
  fi
  rm -rf "$SNAP_ROOT/$SKILL/reference"
  cp -r "$ROUND/_skills/$SKILL.reference" "$SNAP_ROOT/$SKILL/reference"
fi
# Отпечаток дерева рядом со снимком: по нему видно, из какого состояния репы взят текст.
if [ ! -f "$ROUND/_commit.txt" ]; then
  { git -C "$HERE" rev-parse HEAD 2>/dev/null || echo "нет git"; } > "$ROUND/_commit.txt"
  if [ -n "$(git -C "$HERE" status --porcelain 2>/dev/null)" ]; then
    echo "рабочее дерево грязное — источник истины это _skills/" >> "$ROUND/_commit.txt"
  fi
fi

# ─── Караул фикстуры ДО прогона ────────────────────────────────────────────────────────────
# Проверка после плеча опоздала дважды. Прогон записывает результат в фикстуру по абсолютному
# пути (2026-08-14: `ts-conv`, потом `ts-live`), и следующее плечо засевается уже с готовым
# документом — то есть проба «написал ли скилл файл» отвечает «да» сама себе. Поймано на
# `runs/2026-08-14-loop-r1b`: все десять песочниц `ts-live` получили спеку засевом.
#
# Поэтому состав фикстуры фиксируется манифестом и сверяется ПЕРЕД засевом. Расхождение —
# остановка, а не предупреждение: испорченное плечо дешевле не запускать, чем потом опознавать.
MANIFEST="$FIXTURE_DIR/_manifest.txt"
CURRENT="$(cd "$FIXTURE_DIR" && find . -type f -not -name '_manifest.txt' | sed 's|^\./||' | sort)"
if [ -f "$MANIFEST" ]; then
  if ! printf '%s\n' "$CURRENT" | diff -q - "$MANIFEST" >/dev/null 2>&1; then
    echo "!!! СОСТАВ ФИКСТУРЫ $FIXTURE НЕ СОВПАДАЕТ С МАНИФЕСТОМ — прогон не запускался."
    printf '%s\n' "$CURRENT" | diff - "$MANIFEST" | head -20
    echo "Разберись, откуда файл: обычно это прогон, записавший результат в фикстуру."
    echo "Манифест обновляется руками, когда фикстуру меняешь осознанно."
    exit 1
  fi
else
  printf '%s\n' "$CURRENT" > "$MANIFEST"
  echo "манифест фикстуры заведён: $MANIFEST"
fi

# Засев: фикстура без материала стенда. README, промпты и `expected.md` в песочницу не едут —
# прогон, прочитавший их, узнал бы ожидаемый исход и проба стала бы вакуумной.
#
# `expected.md` добавлен в список 2026-08-18, после того как он приехал в песочницу пилота
# `bg-flick-w` целиком — со списком анкеров и перечнем красных исходов. Раньше не срабатывало
# только потому, что фикстуры с таким именем (`RS-*`) гоняются другим раннером: список исключений
# перечислял конкретные имена, а не описывал класс «материал стенда». Пилот из-за этого выброшен
# и переснят.
# ЗАСЕВ ЛЕЖИТ ВНЕ РЕПОЗИТОРИЯ, И ЭТО НЕ ГИГИЕНА, А ИЗОЛЯЦИЯ.
#
# Пока засев лежал в папке раунда (`<раунд>/_seed/<проба>`), он был соседом песочниц и выглядел
# как ещё один рабочий репозиторий: та же `docs/<KEY>/business_requirements.md`, тот же
# `context/`. Прогон, промахнувшийся мимо своей директории, писал спеку туда — и ВСЕ последующие
# прогоны плеча копировали её себе засевом. Проба «записал ли скилл файл» отвечала «да» сама
# себе; поймано 2026-08-14 на `_pilot-wrapper` и `loop-r1c/ts-live` — там спека стоит в
# `_seeded.txt` у всех десяти песочниц.
SEED_ROOT="${SKILL_EVAL_SEED_ROOT:-/tmp/skill-eval-seed}"
SEED="$SEED_ROOT/$(basename "$ROUND")-$PROBE"
SEED_SRC="$FIXTURE_DIR${SEED_SUB:+/$SEED_SUB}"
rm -rf "$SEED"; mkdir -p "$SEED"
( cd "$SEED_SRC" && tar cf - --exclude=README.md --exclude='*-prompt.txt' --exclude=_manifest.txt --exclude=expected.md --exclude=stubs --exclude=PROVENANCE.txt . ) | ( cd "$SEED" && tar xf - )

echo "проба: $PROBE   фикстура: $FIXTURE   скилл: $SKILL"
STUBS_DIR=""
if [ -n "$STUBS_SUB" ]; then
  STUBS_DIR="$FIXTURE_DIR/$STUBS_SUB"
  [ -d "$STUBS_DIR" ] || { echo "нет папки заглушек: $STUBS_DIR"; exit 1; }
  echo "заглушки: $STUBS_SUB → .claude/skills/ песочницы"
fi

bash "$POOL" "$SNAP" "$PROMPT" "$ROUND/$PROBE" "$N" "$CONC" "$SEED" "$STUBS_DIR"

# ─── Караул фикстуры ────────────────────────────────────────────────────────────────────────
# Запрет в промпте изоляцией НЕ является. Замер 2026-08-14, плечо `ts-conv`: прогон получил
# песочницу рабочей директорией — и записал спеку по АБСОЛЮТНОМУ пути в саму фикстуру
# (`fixtures/TS-CONV/docs/ARS-201/technical_specification.md`). Инцидент того же класса, что
# описан в `PROBES.md` правилом №2, и цена та же: следующий прогон засеялся бы уже готовой
# спекой, а «написал сам» стало бы неотличимо от «прочитал написанное».
#
# Караул не мешает прогону — он ловит след. Молча чинить нельзя: испорченное плечо надо
# перегнать, а не подчистить.
#
# Сверяется фикстура с ЗАСЕВОМ, снятым с неё в начале плеча, а не с git: половина фикстур
# не закоммичена, и `git status` показывал бы их целиком как новые — караул, кричащий всегда,
# не караул.
# ВНИМАНИЕ: список материала стенда выписан ДВАЖДЫ — здесь и в исключениях `tar` при засеве выше.
# Добавляешь имя — добавляй в оба места. 2026-08-18: `expected.md` добавили только в засев, и
# караул тут же дал ложную тревогу «фикстура изменилась» на файле, который просто перестал ездить.
DIRT="$(diff -rq "$SEED" "$SEED_SRC" 2>/dev/null | grep -v "README.md\|-prompt.txt\|_manifest.txt\|expected.md\|stubs\|PROVENANCE" || true)"
if [ -n "$DIRT" ]; then
  echo ""
  echo "!!! ФИКСТУРА ИЗМЕНИЛАСЬ ВО ВРЕМЯ ПРОГОНА — плечо недостоверно, перегнать после чистки:"
  echo "$DIRT"
fi
