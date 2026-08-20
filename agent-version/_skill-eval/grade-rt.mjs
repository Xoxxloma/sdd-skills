#!/usr/bin/env node
// grade-rt.mjs — пробы rt-bug / rt-feature / rt-menu / rt-nokey: МАРШРУТ проводника,
// под-скиллы заглушены.
//
//   node grade-rt.mjs <каталог с песочницами> --probe=bug|feature|menu|nokey
//   node grade-rt.mjs --selftest
//
// ПОРЯДОК НА ВХОДЕ (плечи `menu` и `nokey`, заведены 2026-08-18). До правки маршрут спрашивал
// ключ задачи ДВАЖДЫ: `analyst-workspace` своим ходом между меню «БТ или баг» и запуском
// под-скилла, и следом сам под-скилл своим Gate 0. Лишний ход убран, порядок теперь один:
// кнопка → меню из двух вариантов → под-скилл; ключ спрашивает только под-скилл.
//
// Плечи `bug` и `feature` этого не видят по построению: ключ подан в их промптах строкой
// «Ключ задачи: …», и к моменту развилки спрашивать уже нечего. На них тот же анкер работает
// как ПЕРЕСПРАШИВАНИЕ (ключ дан — значит любая просьба его назвать лишняя), на `menu`/`nokey` —
// как лишний ход. Событие одно, смысл разный, поэтому счётчик печатается на всех четырёх.
//
// ЧТО ГРЕЙДИТСЯ. `_trace.log` — файл, который заглушки пишут на диск, вызванные по-настоящему.
// НЕ отчёт агента: он может рассказать о вызове, не сделав его, и наоборот. Правило репы
// «грейдить файл, а не формулировку» здесь означает «грейдить след вызова, а не пересказ».
//
// ПОЧЕМУ ТРАССА, А НЕ ПОТОК. Поток (`stream.jsonl`) показал бы вызовы точнее, но заглушка пишет
// в трассу ещё и ПЕРЕДАННОЕ (источник, флаг багфикса), чего в имени вызова нет. Поток остаётся
// вторым источником: по нему `check-escape.mjs` доказывает побег.
//
// ПРАВИЛА: регулярки литеральные; `\b`/`\w` рядом с кириллицей НЕ применять; побег — «не
// измерено»; счётчик на каждый дефект.

import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

/**
 * НАСТОЯЩАЯ просьба назвать ключ, а не упоминание ключа в отчёте.
 * Анкер взят дословно из `grade-bg.mjs`, где он уже прошёл починку: первая редакция там искала
 * подстроку «ключ задачи» и печатала «ключ переспрошен» 11 из 12, потому что под неё попадала
 * строка реестра `Ключ задачи (ARS-312) — ✅`, то есть отчёт о ЗАКРЫТОМ гейте. Копия намеренная:
 * два грейдера меряют одно событие, и расходиться анкерам нельзя.
 */
const RE_ASKS_KEY = /(укажите|назовите|пришлите|сообщите|дайте|нужен|требуется|не передан|не указан)[^.\n]{0,40}ключ|ключ[^.\n]{0,40}(не передан|не указан|❓)/i

/**
 * Половины кнопки Шага 1Б. Проверяются ОБЕ: один вариант — это не развилка, а утверждение.
 * `\b`/`\w` рядом с кириллицей не применяются — правило репы, `\b` считается по [A-Za-z0-9_].
 */
const RE_OPT_BT = /бизнес-требован|идею в БТ|новая возможност|нового функционал/i
const RE_OPT_BUG = /баг-репорт|баг-репорте|сломанное поведение/i

/**
 * НЕ ТОТ ШАГ. Первая редакция `showsMenu` была слепой, и слепа она была по построению: подпись
 * стартовой кнопки Шага 1 — «Бизнес: Переводим Идею в БТ, баг — в баг-репорт», а пояснение рядом
 * с ней — «новая возможность идёт в бизнес-требования, сломанное поведение — в баг-репорт».
 * В ней СИДЯТ ОБЕ половины, которые ищут `RE_OPT_BT` и `RE_OPT_BUG`. Значит прогон, который
 * ПЕРЕСПРОСИЛ стартовый вопрос Шага 1 вместо развилки Шага 1Б (а это нарушение правила 2 — ответ
 * уже дан), получал зелёное. Отличаем по соседям: у Шага 1 четыре варианта, и три остальных на
 * Шаге 1Б появиться не могут.
 */
const RE_STEP1_NEIGHBOURS = /Продолжить начатое|обновить описание сервисов|Создаем Спецификацию|создаём спецификацию|готового документа/i

/**
 * Просьба, ПЕРЕАДРЕСОВАННАЯ под-скиллу, просьбой проводника не является: «ключ спросит
 * `bug-report-doc`» — это исполнение правила, а не его нарушение. Без этого исключения анкер
 * красил бы верное поведение: в хендоффе полного маршрута про ключ сказать законно.
 */
const RE_KEY_DELEGATED = /(спросит|запросит|уточнит|соберёт|соберет)[^.\n]{0,60}(под-скилл|подскилл|скилл|bug-report-doc|business-requirements-doc)|(под-скилл|подскилл|bug-report-doc|business-requirements-doc)[^.\n]{0,60}(спросит|запросит|уточнит)/i

export function isApiFailure (t) {
  if (!t) return true
  if (t.length > 600) return false
  return RE_API_FAILURE.test(t.slice(0, 300))
}

/** Строки трассы → массив имён под-скиллов в порядке вызова. */
export function parseTrace (text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

const REPLACEMENT = String.fromCharCode(0xFFFD)

/**
 * ЧТЕНИЕ ТРАССЫ С ПОДБОРОМ КОДИРОВКИ.
 *
 * Поймано 2026-08-20 на прогоне base10/run-04: строка трассы пришла как
 * `technical-spec-doc ????????=docs/... ????=???????` — латиница цела, кириллица мусор.
 * Причина виндовая и не наша: заглушка велит «допиши строку в `_trace.log`», агент дописывает
 * её PowerShell'ом, а `Add-Content` по умолчанию пишет системной кодировкой (cp1251), не UTF-8.
 *
 * Цена дефекта — ЛОЖНАЯ НАХОДКА: анкеры «источник=» и «флаг=» по такой строке не срабатывают, и
 * прогон с ПОЛНЫМ маршрутом читается как «спека запущена без флага багфикса». Ровно тот класс,
 * против которого заведено правило репы «грейдить файл, а не формулировку»: файл-то мы читаем,
 * но читаем не теми байтами.
 *
 * Чиним на стороне ЧТЕНИЯ, а не в заглушке: правка фикстуры обнулила бы базу, снятую тем же днём.
 * Лестница станций от этого не страдала — станции опознаются по латинским именам скиллов и путям
 * файлов; страдали только счётчики флага и источника.
 */
export function readTrace (path) {
  const buf = readFileSync(path)
  const utf = buf.toString('utf8')
  if (!utf.includes(REPLACEMENT)) return utf
  // Символ-замена значит «эти байты не UTF-8». Единственный реальный кандидат на Windows —
  // системная кириллическая кодировка; `TextDecoder` в ноде её знает (полный ICU в сборке).
  try {
    const cp = new TextDecoder('windows-1251').decode(buf)
    return cp.includes(REPLACEMENT) ? utf : cp
  } catch { return utf }
}

const SKILL_OF = (line) => line.split(/\s+/)[0]

/**
 * ЛЕСТНИЦА МАРШРУТА — шесть станций, в порядке исполнения.
 *
 * Заведена 2026-08-20. Повод: `r.pass` — конъюнкция шести условий, и на слабой модели она даёт
 * ноль ВСЕГДА (`rt-bug`: 1/10, 0/10, 0/7, 0/7 за четыре раунда). Ноль не отличает «встал на
 * репорте» от «дошёл до этапов», поэтому правка скилла не двигала ни одного числа, и стенд не
 * отвечал на вопрос, ради которого заведён.
 *
 * Считаются ДВА разных числа, и путать их нельзя:
 *   `steps` — сколько станций отмечено всего (объём сделанной работы);
 *   `reach` — длина НЕПРЕРЫВНОГО префикса от первой станции (где маршрут оборвался).
 * Пропустил приёмку, но написал спеку: `steps` 3, `reach` 1. Обе цифры честные и о разном.
 *
 * Станция «приёмка» опознаётся по ПУТИ в строке трассы, а не по имени скилла: `spec-review`
 * вызывается за маршрут несколько раз на разные документы, и без пути они неразличимы.
 */
const STATION_REVIEW = (re) => (t) => t.some((l) => l.startsWith('spec-review') && re.test(l))
const STATION_CALL = (name) => (t) => t.some((l) => l.startsWith(name))

const STATIONS = {
  bug: [
    ['репорт написан', STATION_CALL('bug-report-doc')],
    ['репорт принят', STATION_REVIEW(/bug_report\.md/)],
    ['спека запущена', STATION_CALL('technical-spec-doc')],
    ['спека принята', STATION_REVIEW(/technical_specification\.md/)],
    ['этапы нарезаны', STATION_CALL('stage-breakdown-doc')],
    ['этапы приняты', STATION_REVIEW(/stages/)],
  ],
  feature: [
    ['БТ написано', STATION_CALL('business-requirements-doc')],
    ['БТ принято', STATION_REVIEW(/business_requirements\.md/)],
    ['спека запущена', STATION_CALL('technical-spec-doc')],
    ['спека принята', STATION_REVIEW(/technical_specification\.md/)],
    ['этапы нарезаны', STATION_CALL('stage-breakdown-doc')],
    ['этапы приняты', STATION_REVIEW(/stages/)],
  ],
}
STATIONS.nokey = STATIONS.bug
// `menu` лестницы не имеет: там верный исход — остановка ДО первого вызова, и любая станция
// на этом плече означает дефект, а не прогресс.

export function ladder (lines, probe) {
  const st = STATIONS[probe]
  if (!st) return { steps: 0, reach: 0, hit: [], total: 0 }
  const hit = st.map(([name, f]) => ({ name, ok: f(lines) }))
  const steps = hit.filter((h) => h.ok).length
  let reach = 0
  for (const h of hit) { if (!h.ok) break; reach++ }
  return { steps, reach, hit, total: st.length }
}

export function gradeRun (dir, probe) {
  const r = { dir, probe, measured: true, why: '' }
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  if (existsSync(join(dir, '_escaped.txt'))) { r.measured = false; r.why = 'побег из песочницы'; return r }
  // Отказ API ПОСРЕДИ цикла ходов (маркер ставит раннер): склейка ответов длинная, и маркер
  // отказа в ней за первые 200 байт не виден — без этой проверки прогон, потерявший API на
  // четвёртом ходу, считался бы обрывом маршрута на третьей станции.
  if (existsSync(join(dir, '_api-failure-turn.txt'))) { r.measured = false; r.why = 'отказ API посреди ходов'; return r }
  if (isApiFailure(ans)) { r.measured = false; r.why = 'отказ API'; return r }

  const tracePath = join(dir, '_trace.log')
  r.lines = existsSync(tracePath) ? parseTrace(readTrace(tracePath)) : []
  r.calls = r.lines.map(SKILL_OF)
  r.calledAny = r.calls.length > 0

  // Оркестратор писать документы не должен — их пишут под-скиллы. Файл есть, а вызова нет =
  // сделал работу сам.
  r.docs = existsSync(join(dir, 'docs')) ? readdirSync(join(dir, 'docs')) : []

  r.first = r.calls[0] ?? null
  r.calledBugReport = r.calls.includes('bug-report-doc')
  r.calledBT = r.calls.includes('business-requirements-doc')
  r.calledReview = r.calls.includes('spec-review')
  r.calledSpec = r.calls.includes('technical-spec-doc')
  r.calledStages = r.calls.includes('stage-breakdown-doc')
  // Лестница считается по СЫРЫМ строкам трассы: станции приёмки различаются путём.
  Object.assign(r, ladder(r.lines, probe))
  // Разрез: заглушки `task-decomposition-doc` нет намеренно — её вызов виден только в потоке.
  // В трассе признак другой: до спеки дошёл, а лишнего документа не появилось.
  r.decomposition = r.docs.some((d) => existsSync(join(dir, 'docs', d, 'decomposition.md')))

  // Флаг багфикса и источник заглушка спеки пишет в свою строку.
  const specLine = r.lines.find((l) => l.startsWith('technical-spec-doc')) ?? ''
  r.specSource = /источник=(\S+)/.exec(specLine)?.[1] ?? ''
  r.specFlag = /флаг=(\S+)/.exec(specLine)?.[1] ?? ''
  // ДВА НАПИСАНИЯ ФЛАГА, И ОБА ЗАКОННЫ. Заглушка просит писать «багфикс», но прогон
  // base10/run-15 записал `флаг=bugfix` — сведение верное, слово английское. Меряем «передан ли
  // флаг починки», а не «на каком языке заглушка его записала»: тот же класс ложной находки,
  // что и cp1251-трасса, только на уровне словаря, а не байтов.
  r.flagBugfix = /багфикс|bugfix|bug-fix/i.test(r.specFlag)
  r.sourceIsReport = /bug_report\.md/.test(r.specSource)

  // Ключ задачи спрашивает под-скилл, а не проводник. Заглушки вопросов не задают, значит любая
  // просьба назвать ключ в `answer.md` принадлежит проводнику — кроме переадресованной.
  r.asksKey = RE_ASKS_KEY.test(ans) && !RE_KEY_DELEGATED.test(ans)
  r.showsBT = RE_OPT_BT.test(ans)
  r.showsBug = RE_OPT_BUG.test(ans)
  r.wrongStep = RE_STEP1_NEIGHBOURS.test(ans)
  r.showsMenu = r.showsBT && r.showsBug && !r.wrongStep

  if (probe === 'bug' || probe === 'nokey') {
    r.wrongFirst = r.first !== null && r.first !== 'bug-report-doc'
    r.pass = r.first === 'bug-report-doc' && !r.calledBT && !r.decomposition &&
      r.calledSpec && r.flagBugfix && r.sourceIsReport
    // Только на `nokey` отсутствие ключа — условие пробы, и лишний вопрос ломает маршрут.
    // На `bug` ключ подан, и переспрашивание остаётся ОТДЕЛЬНЫМ счётчиком: вшив его в зелёное,
    // мы поменяли бы критерий плеча задним числом и сделали числа r1…r3 несопоставимыми.
    if (probe === 'nokey') r.pass = r.pass && !r.asksKey
  } else if (probe === 'feature') {
    r.wrongFirst = r.first !== null && r.first !== 'business-requirements-doc'
    r.pass = r.first === 'business-requirements-doc' && !r.calledBugReport
  } else {
    // `menu`: верный исход — ход ОСТАНОВЛЕН вопросом. Ни один под-скилл не вызван, ключ не
    // спрошен, показаны обе половины кнопки Шага 1Б — и это именно 1Б, а не переспрошенный Шаг 1.
    r.wrongFirst = false
    r.pass = !r.calledAny && !r.asksKey && r.showsMenu
  }
  return r
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────────────────

const REF_BUG = `bug-report-doc
spec-review docs/ARS-312/bug_report.md
technical-spec-doc источник=docs/ARS-312/bug_report.md флаг=багфикс
spec-review docs/ARS-312/technical_specification.md
stage-breakdown-doc`

const REF_FEATURE = `business-requirements-doc
spec-review docs/SMSEC-77/business_requirements.md
technical-spec-doc источник=docs/SMSEC-77/business_requirements.md флаг=обычный`

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  const b = parseTrace(REF_BUG).map(SKILL_OF)
  ck('первый вызов багфикса', b[0], 'bug-report-doc')
  ck('БТ не вызывался', b.includes('business-requirements-doc'), false)
  ck('спека вызвана', b.includes('technical-spec-doc'), true)
  const specLine = parseTrace(REF_BUG).find((l) => l.startsWith('technical-spec-doc'))
  ck('флаг багфикса прочитан', /флаг=(\S+)/.exec(specLine)[1], 'багфикс')
  ck('источник — репорт', /bug_report\.md/.test(/источник=(\S+)/.exec(specLine)[1]), true)
  const f = parseTrace(REF_FEATURE).map(SKILL_OF)
  ck('первый вызов фичи', f[0], 'business-requirements-doc')
  ck('баг-репорт не вызывался', f.includes('bug-report-doc'), false)
  ck('пустая трасса — ноль вызовов', parseTrace('').length, 0)
  ck('отказ API', isApiFailure('API Error: Request not allowed'), true)

  // Анкер ключа: вопрос отличается от строки отчёта. Обе стороны проверяются, иначе повторится
  // дефект `grade-bg.mjs`, где «Ключ задачи (ARS-312) — ✅» считалось переспрашиванием.
  ck('просьба назвать ключ', RE_ASKS_KEY.test('Укажите ключ задачи в трекере (ARS-1234).'), true)
  ck('ключ назван блокером', RE_ASKS_KEY.test('Ключ задачи не передан — без него файл не пишется.'), true)
  ck('строка отчёта — НЕ просьба', RE_ASKS_KEY.test('Ключ задачи (ARS-312) — ✅'), false)
  ck('передача ключа — НЕ просьба', RE_ASKS_KEY.test('Запускаю bug-report-doc с ключом ARS-312.'), false)
  // Переадресация под-скиллу — исполнение правила, а не нарушение. Без этого исключения анкер
  // красит верный хендофф полного маршрута.
  ck('переадресовано под-скиллу', RE_KEY_DELEGATED.test('Ключ не указан — его спросит bug-report-doc своим первым вопросом.'), true)
  ck('прямое требование НЕ переадресовано', RE_KEY_DELEGATED.test('Укажите ключ задачи, без него дальше не идём.'), false)

  // Меню Шага 1Б: зачитываются только ОБЕ половины кнопки.
  const MENU = 'Что за работа: переводим идею в БТ (агент соберёт бизнес-требования) или это баг — в баг-репорт?'
  ck('меню — половина БТ', RE_OPT_BT.test(MENU), true)
  ck('меню — половина бага', RE_OPT_BUG.test(MENU), true)
  ck('одна половина — не меню', RE_OPT_BUG.test('Собираю бизнес-требования.'), false)
  // ГЛАВНАЯ проверка этого анкера: подпись стартовой кнопки Шага 1 содержит ОБЕ половины, и без
  // соседей её не отличить от развилки Шага 1Б.
  const STEP1 = 'Что уже есть на руках? 1) Бизнес: Переводим Идею в БТ, баг — в баг-репорт. 2) Аналитика: Создаем Спецификацию на основе готового документа. 3) Продолжить начатое. 4) Доработка готова — обновить описание сервисов.'
  ck('стартовый вопрос ловится обеими половинами', RE_OPT_BT.test(STEP1) && RE_OPT_BUG.test(STEP1), true)
  ck('и отсекается соседями Шага 1', RE_STEP1_NEIGHBOURS.test(STEP1), true)
  ck('развилка 1Б соседей не содержит', RE_STEP1_NEIGHBOURS.test(MENU), false)

  // Лестница: два числа об одном прогоне, и главный случай — когда они РАСХОДЯТСЯ.
  const lb = ladder(parseTrace(REF_BUG), 'bug')
  ck('лестница багфикса — станций', lb.steps, 5)
  ck('лестница багфикса — дошёл до', lb.reach, 5)
  const lf = ladder(parseTrace(REF_FEATURE), 'feature')
  ck('лестница фичи — станций', lf.steps, 3)
  ck('лестница фичи — дошёл до', lf.reach, 3)
  // Пропущенная приёмка: работа сделана, но маршрут оборван на первой станции. Ровно это
  // различение и есть повод завести лестницу — конъюнкция `pass` здесь даёт тот же ноль,
  // что и у прогона, вставшего сразу после репорта.
  const SKIPPED = `bug-report-doc
technical-spec-doc источник=docs/ARS-312/bug_report.md флаг=багфикс
stage-breakdown-doc`
  const ls = ladder(parseTrace(SKIPPED), 'bug')
  ck('приёмка пропущена — станций', ls.steps, 3)
  ck('приёмка пропущена — дошёл до', ls.reach, 1)
  // Встал сразу после репорта — нижняя точка шкалы.
  const STALLED = ladder(parseTrace('bug-report-doc'), 'bug')
  ck('встал на репорте — станций', STALLED.steps, 1)
  ck('встал на репорте — дошёл до', STALLED.reach, 1)
  ck('пустая трасса — ноль станций', ladder([], 'bug').steps, 0)
  // `nokey` идёт по той же лестнице, что и `bug`: маршрут у них один, разница только в ключе.
  ck('nokey — та же лестница', ladder(parseTrace(REF_BUG), 'nokey').steps, 5)
  // `menu` лестницы не имеет: там верный исход — ноль вызовов.
  ck('menu — лестницы нет', ladder(parseTrace(REF_BUG), 'menu').total, 0)

  // Кодировка трассы: cp1251-строка обязана читаться так же, как UTF-8. Проверяем на настоящем
  // событии — строке заглушки спеки, которая и приехала битой на base10/run-04.
  const LINE = 'technical-spec-doc источник=docs/ARS-312/bug_report.md флаг=багфикс'
  const tmp1 = join(tmpdir(), 'rt-trace-utf8.log')
  const tmp2 = join(tmpdir(), 'rt-trace-cp1251.log')
  writeFileSync(tmp1, LINE, 'utf8')
  // Настоящие cp1251-байты, а не подделка: кодируем посимвольно по таблице windows-1251.
  const cp1251 = Buffer.from(Array.from(LINE, (ch) => {
    const c = ch.charCodeAt(0)
    if (c < 128) return c
    if (c >= 0x410 && c <= 0x44F) return c - 0x410 + 0xC0
    if (c === 0x451) return 0xB8
    if (c === 0x401) return 0xA8
    throw new Error('символ вне таблицы: ' + ch)
  }))
  writeFileSync(tmp2, cp1251)
  ck('трасса UTF-8 читается', readTrace(tmp1), LINE)
  ck('трасса cp1251 читается так же', readTrace(tmp2), LINE)
  const flagOf = (t) => /флаг=(\S+)/.exec(t)?.[1] ?? ''
  ck('флаг виден в cp1251-трассе', flagOf(readTrace(tmp2)), 'багфикс')
  // Английское написание флага — не дефект скилла, а словарь прогона.
  ck('флаг багфикса по-русски', /багфикс|bugfix|bug-fix/i.test('багфикс'), true)
  ck('флаг багфикса по-английски', /багфикс|bugfix|bug-fix/i.test('bugfix'), true)
  ck('обычный флаг не путается', /багфикс|bugfix|bug-fix/i.test('обычный'), false)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  return bad === 0
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1)
const root = argv.find((x) => !x.startsWith('--'))
const pa = argv.find((x) => x.startsWith('--probe='))
const PROBE = pa ? pa.slice('--probe='.length) : ''
if (!root || !['bug', 'feature', 'menu', 'nokey'].includes(PROBE)) {
  console.error('usage: node grade-rt.mjs <каталог> --probe=bug|feature|menu|nokey'); process.exit(1)
}

const all = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^run-\d+$/.test(e.name))
  .map((e) => gradeRun(join(root, e.name), PROBE))
  .sort((a, b) => a.dir.localeCompare(b.dir))

const ok = all.filter((r) => r.measured)
const N = ok.length
const c = (f) => ok.filter(f).length
const pct = (n) => `${String(n).padStart(2)}/${N}`

console.log(`\nпроба rt-${PROBE}, ${root}`)
console.log(`прогонов: ${all.length}, измерено: ${N}, не измерено: ${all.length - N}`)
for (const r of all.filter((x) => !x.measured)) console.log(`  НЕ ИЗМЕРЕНО ${r.dir}: ${r.why}`)
console.log('')
if (PROBE === 'menu') {
  // Здесь остановка — ВЕРНЫЙ исход, а не дефект: ход обязан прерваться вопросом.
  console.log(`  ${pct(c((r) => r.asksKey))}\tСПРОСИЛ КЛЮЧ ЗАДАЧИ — лишний ход, его задаёт под-скилл  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.calledAny))}\tВЫЗВАЛ ПОД-СКИЛЛ — тип угадан за аналитика  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => !r.showsMenu))}\tменю из двух вариантов не показано`)
  console.log(`  ${pct(c((r) => r.wrongStep))}\t— ПЕРЕСПРОШЕН стартовый вопрос Шага 1, а не развилка 1Б`)
  console.log(`  ${pct(c((r) => !r.showsBT))}\t— нет половины «идея в БТ»`)
  console.log(`  ${pct(c((r) => !r.showsBug))}\t— нет половины «баг в баг-репорт»`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
  console.log('')
  process.exit(0)
}
console.log(`  ${pct(c((r) => !r.calledAny))}\tНИ ОДНОГО ВЫЗОВА — проводник сделал работу сам  ← КРИТЕРИЙ`)
console.log(`  ${pct(c((r) => r.asksKey))}\t${PROBE === 'nokey' ? 'СПРОСИЛ КЛЮЧ ЗАДАЧИ — его задаёт под-скилл  ← КРИТЕРИЙ' : 'ключ ПЕРЕСПРОШЕН — он дан в ответах аналитика'}`)
if (PROBE === 'bug' || PROBE === 'nokey') {
  console.log(`  ${pct(c((r) => r.calledBT))}\tУШЁЛ В БИЗНЕС-ТРЕБОВАНИЯ на дефекте  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrongFirst))}\tпервым вызван не тот скилл`)
  console.log(`  ${pct(c((r) => r.decomposition))}\tЗАШЁЛ В РАЗРЕЗ — на дефекте резать нечего  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.calledBugReport && !r.calledSpec))}\tостановился на репорте, спеку не запустил`)
  console.log(`  ${pct(c((r) => r.calledSpec && !r.flagBugfix))}\tспека запущена БЕЗ флага багфикса`)
  console.log(`  ${pct(c((r) => r.calledSpec && !r.sourceIsReport))}\tспеке передан не репорт`)
  console.log(`  ${pct(c((r) => !r.calledReview))}\tприёмка не запущена ни разу`)
  console.log(`  ${pct(c((r) => !r.calledStages))}\tэтапы не запущены`)
} else {
  console.log(`  ${pct(c((r) => r.calledBugReport))}\tУШЁЛ В БАГ-РЕПОРТ на обычной задаче  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrongFirst))}\tпервым вызван не business-requirements-doc`)
  console.log(`  ${pct(c((r) => !r.calledReview))}\tприёмка не запущена ни разу`)
}
// ─── Лестница маршрута ──────────────────────────────────────────────────────────────────────
// Печатается ПЕРЕД «зелёными» намеренно: зелёное — редкое событие, а лестница отвечает на
// вопрос «докуда дошли» и на нуле зелёных. Средние даются с одним знаком: при N=7 второй знак
// уже шум.
if (N > 0) {
  const TOTAL = ok[0].total || 6
  const avg = (f) => (ok.reduce((s, r) => s + f(r), 0) / N).toFixed(1)
  console.log('')
  console.log(`  станций пройдено (объём работы): ${avg((r) => r.steps)} из ${TOTAL} в среднем`)
  console.log(`  маршрут дошёл до (непрерывно):   ${avg((r) => r.reach)} из ${TOTAL} в среднем`)
  const distr = Array.from({ length: TOTAL + 1 }, (_, k) => c((r) => r.reach === k))
  console.log(`  распределение обрыва: ${distr.map((n, k) => `${k}→${n}`).join('  ')}`)
  console.log('')
  for (let i = 0; i < TOTAL; i++) {
    const name = ok[0].hit[i]?.name ?? `станция ${i + 1}`
    console.log(`  ${pct(c((r) => r.hit[i]?.ok))}\tстанция ${i + 1}: ${name}`)
  }
  console.log('')
}
console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
console.log('')
