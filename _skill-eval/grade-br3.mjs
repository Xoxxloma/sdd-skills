#!/usr/bin/env node
// grade-br3.mjs — полный бриф первым сообщением (BR-3) и его зеркало на неполном (BR-4).
//
// Обе пробы меряют ОДНО решение скилла: писать файл или спрашивать. Различает их только
// вход, поэтому грейдер один, а плечо задаётся режимом:
//
//   node grade-br3.mjs <каталог с песочницами> --expect=write        ← BR-3 (br3-prompt)
//   node grade-br3.mjs <каталог с песочницами> --expect=questions    ← BR-4 (br4-prompt)
//
// Самопроверка:
//   node grade-br3.mjs _skill-eval/fixtures/br3-validate --expect=write
//   node grade-br3.mjs _skill-eval/fixtures/br4-validate --expect=questions
//
// Правила репы, из-за которых он написан именно так:
//   - главный анкер снимается с ДИСКА (есть файл или нет), а не с формулировки ответа:
//     прогон, который написал «спека готова», не написав файла, обязан быть красным;
//   - песочница без `answer.md` — «НЕ ИЗМЕРЕНО», а не «провалено» (прогон не состоялся);
//   - регулярки литеральные, из строк не собираются;
//   - путь файла — ОТДЕЛЬНАЯ колонка, а не часть вердикта BR-3. Файл, записанный в корень,
//     это дефект маршрута (им владеет BS-10), и он не должен маскировать главный сигнал:
//     иначе «скилл переспросил вместо записи» и «скилл записал не туда» слипаются в один
//     красный, а чинятся они разными правками.
//
// ПОЧЕМУ ПОИСК НЕДОСТАЮЩИХ ГЕЙТОВ РАБОТАЕТ ПРОСТЫМ ГРЕПОМ ПО ОТВЕТУ.
// В `br4-prompt.txt` ни одного из стемов ниже нет — фикстура собрана из `br3-prompt.txt`
// удалением ровно четырёх абзацев. Значит появление стема в ответе означает, что тему
// поднял агент, а не пересказал из промпта. Правишь фикстуру — перепроверь инвариант:
//   grep -i "заказчик\|стейкхолдер\|спонсор\|эксперт\|приоритет\|срок\|дедлайн\|дат\|риск" \
//     _skill-eval/fixtures/br4-prompt.txt        → должно быть пусто
// Без него колонка «поднял недостающее» врёт, а выглядит рабочей.
//
// Стем `числ` в этот список НЕ входит и в регулярки не берётся: в брифе есть «по среднему
// числу сотрудников» и «суммарное число порций». «К какому числу?» как форма вопроса про
// сроки поэтому не ловится — сознательный размен, ложный зелёный дороже пропуска.
//
// ЧЕГО ЭТОТ ГРЕЙДЕР НЕ МЕРЯЕТ И НЕ БУДЕТ. «Не переспросил заново то, что человек уже
// написал» — анкер для глаз, а не для скрипта: словарного способа отличить пересказ на
// подтверждение («понял так: заказ фиксируется в 16:00 — верно?») от открытого переспроса
// («как должен работать заказ?») не существует, а попытка собрать его регулярками — ровно
// тот класс дефекта, который в этой репе уже трижды давал ложный красный. Поэтому ответы
// печатаются целиком в хвосте отчёта, и этот пункт грейдится глазами по PROBES.md.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.argv[2]
const modeArg = process.argv.find((a) => a.startsWith('--expect='))
const mode = modeArg ? modeArg.slice('--expect='.length) : null

if (!root || !existsSync(root) || (mode !== 'write' && mode !== 'questions')) {
  console.error('usage: node grade-br3.mjs <каталог с песочницами> --expect=write|questions')
  process.exit(1)
}

/** Рекурсивно — дефект маршрута (файл в корне вместо docs/<KEY>/) обязан находиться тоже. */
function findBrd(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) findBrd(p, acc)
    else if (e.name === 'business_requirements.md') acc.push(p)
  }
  return acc
}

/** Четыре гейта, отсутствующие в `br4-prompt.txt`. Стемы литеральные и намеренно узкие.
 *  `заказчик` не ловится стемом `заказ`: в брифе «заказ» встречается десяток раз, и общий
 *  стем красил бы каждый прогон зелёным. Валидируется входом `known-fail-partial`. */
const MISSING_GATES = [
  { name: 'заказчик/эксперт', re: /заказчик|стейкхолдер|спонсор|эксперт/i },
  { name: 'приоритет', re: /приоритет/i },
  // `дат[аыеуой]` добавлен по итогу самопроверки: эталонный ответ спрашивал «есть ли дата,
  // к которой это нужно» — законная форма гейта 8, которую стем `срок` не ловил, и
  // known-pass выходил 3/4 вместо 4/4. В `br4-prompt.txt` стема `дат` нет, инвариант цел.
  { name: 'сроки', re: /срок|дедлайн|дат[аыеуой]/i },
  { name: 'риски', re: /риск/i },
]

/** Реестр гейтов (Step 3.5) из ответа прогона.
 *
 *  ЗАЧЕМ. Вердикт BR-4 («файла нет») ловит САМ факт преждевременной записи, но не отвечает,
 *  ПОЧЕМУ прогон решил, что писать можно. Правка R1 легализует новый путь к ✅ — «пользователь
 *  сказал это в каком-то своём сообщении», — и вместе с ним новый способ соврать: пометить ✅
 *  гейт, которого пользователь не касался. В `br4-prompt.txt` четыре гейта отсутствуют
 *  физически, поэтому ✅ на любом из них — фабрикация, проверяемая механически.
 *
 *  ЭТО ДИАГНОСТИКА, А НЕ ВТОРОЙ ДЕТЕКТОР. Прогон, записавший файл, уже красный по вердикту;
 *  колонка лишь разделяет два разных дефекта внутри одного красного — «проставил TBD от себя»
 *  (честно признал пробел) против «пометил ✅ и сослался на пользователя» (соврал про
 *  источник). Вторая правится не так, как первая, и рождается она именно из R1.
 *
 *  Разбор литеральный и намеренно узкий: якорь — строка со словами «реестр гейтов», пункты —
 *  нумерованные строки под ним, маркер — один из трёх значков, которые предписывает Step 3.5.
 *  Строку-многоточие («...» вместо середины списка) скилл пишет законно, она пропускается. */
const LEDGER_ANCHOR = /Реестр\s+гейтов/i
const LEDGER_ITEM = /^\s*>?\s*(\d+)\s*[.)]\s*(.+)$/

function parseLedger(answer) {
  const lines = answer.split(/\r?\n/)
  const start = lines.findIndex((l) => LEDGER_ANCHOR.test(l))
  if (start === -1) return { found: false, entries: [], start: -1, end: -1 }
  const entries = []
  let end = lines.length
  let blanks = 0
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i]
    end = i
    if (/^#{1,6}\s/.test(raw)) break
    // Закрывающий фенс — конец блока, но только когда пункты уже пошли: открывающий фенс
    // может стоять и ПОСЛЕ строки-якоря, если она сама вне блока кода.
    if (/^\s*```/.test(raw)) { if (entries.length) break; else continue }
    const m = raw.match(LEDGER_ITEM)
    if (!m) {
      if (/^\s*>?\s*\.{2,}\s*$/.test(raw) || /^\s*>?\s*…\s*$/.test(raw)) continue // законная элизия
      if (!raw.trim()) { blanks++; if (blanks >= 2 && entries.length) break; continue }
      if (entries.length) break
      continue
    }
    blanks = 0
    const text = m[2]
    // Значки литеральные. `⏭️` в тексте может нести VS16, а может и не нести — берём базовый
    // codepoint. Отсутствие любого из трёх — не провал, а «без маркера»: скилл мог оформить
    // реестр словами, и красить это в ложь нельзя.
    const mark = /✅/.test(text) ? '✅' : /⏭/.test(text) ? '⏭️' : /❓/.test(text) ? '❓' : '—'
    entries.push({ num: Number(m[1]), text, mark })
    end = i + 1
  }
  // УПОМИНАНИЕ ФРАЗЫ — НЕ ВЫВЕДЕННЫЙ РЕЕСТР. Найдено самопроверкой: `known-fail-asked`
  // пишет прозой «после ваших ответов сформирую реестр гейтов», и разбор засчитывал это за
  // реестр из нуля пунктов, а строка «BR-3.3 реестр выведен» — за выведенный. Порог в два
  // пункта: реестр по Step 3.5 несёт минимум Gate 0 и один гейт, а одна нумерованная строка
  // рядом с фразой бывает и в обычном перечислении вопросов.
  if (entries.length < 2) return { found: false, entries: [], start: -1, end: -1 }
  return { found: true, entries, start, end }
}

/** Текст ответа без блока реестра — чтобы посчитать, не держится ли «гейт поднят» на одной
 *  лишь строке реестра. Метрику `gates` это НЕ меняет (числа круга уже сняты старым
 *  разбором); расхождение печатается отдельной заметкой. */
function withoutLedger(answer, led) {
  if (!led.found) return answer
  const lines = answer.split(/\r?\n/)
  return lines.filter((_, i) => i < led.start || i >= led.end).join('\n')
}

const dirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const rows = []
const answers = new Map()
const ledgers = new Map()
const ledgerNotes = []

for (const d of dirs) {
  const sandbox = join(root, d)
  const answerPath = join(sandbox, 'answer.md')

  // Прогоном считается папка с `answer.md` — заготовленная, но не запущенная песочница
  // не должна выглядеть провалом (урок раунда «этапы работ»: восемь пустых run-NN давали
  // восемь красных, и проба выглядела измеренной).
  if (!existsSync(answerPath)) {
    rows.push({ run: d, file: '—', path: '—', key: '—', gates: '—', q: '—', ledger: '—', ok: 'НЕ ИЗМЕРЕНО' })
    continue
  }

  // HTML-комментарии выбрасываем ДО разбора — то же правило, что в grade-bs9. В файлах
  // самопроверки в них лежит ожидание («гейт „заказчик“ обязан остаться неподнятым»), и
  // без этой строки грейдер считал собственные комментарии за поднятые гейты: на первой
  // же валидации known-fail-partial дал 2/4 вместо 1/4, а known-fail-wrote — 4/4.
  const answer = readFileSync(answerPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  answers.set(d, answer)

  const files = findBrd(sandbox)
  const hasFile = files.length > 0

  let rel = '—'
  let pathOk = '—'
  let keyInHeader = '—'
  if (hasFile) {
    const file = files.sort()[0]
    rel = relative(sandbox, file).split(sep).join('/')
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    const head = text.split(/\r?\n/).slice(0, 20).join('\n')
    keyInHeader = (head.match(/([A-Z][A-Z0-9]+-\d+)/) || [])[1] || '—'
    const m = rel.match(/^docs\/([A-Z][A-Z0-9]+-\d+)\/business_requirements\.md$/)
    pathOk = m ? (m[1] === keyInHeader ? 'ДА' : 'КЛЮЧ≠ПАПКА') : 'НЕТ'
  }

  const raised = MISSING_GATES.filter((g) => g.re.test(answer))
  const hasQuestion = /\?/.test(answer)

  const led = parseLedger(answer)
  // ✅ на гейте, которого в брифе нет вовсе, — фабрикация источника (только режим questions).
  const fakeOk = MISSING_GATES.filter((g) => led.entries.some((e) => g.re.test(e.text) && e.mark === '✅'))
  const openMarks = led.entries.filter((e) => e.mark === '❓').length
  let ledgerCol
  if (!led.found) ledgerCol = 'нет'
  else if (mode === 'questions') ledgerCol = fakeOk.length ? `✅×${fakeOk.length}` : `${led.entries.length} п.`
  else ledgerCol = openMarks ? `❓×${openMarks}` : `${led.entries.length} п.`
  // Держится ли «гейт поднят» на одной строке реестра — заметка, не метрика.
  const raisedOutside = MISSING_GATES.filter((g) => g.re.test(withoutLedger(answer, led)))
  if (led.found && raisedOutside.length !== raised.length) {
    ledgerNotes.push(`${d}: гейтов поднято ${raised.length}/4, но вне реестра только ${raisedOutside.length}/4 — часть тем названа лишь строкой реестра, вопроса пользователю по ним могло не быть`)
  }

  let ok
  if (mode === 'write') {
    // BR-3: единственный вердикт — файл записан в этом же ходе. Путь и ключ рядом, но
    // отдельными колонками (см. шапку).
    ok = hasFile ? 'ДА' : 'нет'
  } else {
    // BR-4: файла быть не должно, и недостающее должно быть поднято. Порог 3 из 4, а не
    // 4 из 4: скилл вправе отложить один пункт на следующий батч (Step 3 сам разрешает
    // слать самые важные гейты первыми), и требовать все четыре разом — красить законное
    // поведение в провал.
    ok = !hasFile && raised.length >= 3 && hasQuestion ? 'ДА' : 'нет'
  }

  ledgers.set(d, { led, fakeOk, openMarks })
  rows.push({
    run: d,
    file: hasFile ? 'ДА' : 'нет',
    path: pathOk,
    key: keyInHeader,
    gates: `${raised.length}/4`,
    q: hasQuestion ? 'ДА' : 'нет',
    ledger: ledgerCol,
    ok,
  })
}

const pad = (s, n) => String(s).padEnd(n)
const probe = mode === 'write' ? 'BR-3 (полный бриф → пишет)' : 'BR-4 (неполный бриф → спрашивает)'
console.log(`\n${probe} — ${root}\n`)
console.log(pad('прогон', 22), pad('файл', 6), pad('путь', 12), pad('ключ', 10), pad('гейты', 7), pad('вопрос', 7), pad('реестр', 8), 'вердикт')
console.log('-'.repeat(105))
for (const r of rows) {
  console.log(pad(r.run, 22), pad(r.file, 6), pad(r.path, 12), pad(r.key, 10), pad(r.gates, 7), pad(r.q, 7), pad(r.ledger, 8), r.ok)
}

const measured = rows.filter((r) => r.ok !== 'НЕ ИЗМЕРЕНО')
const cnt = (f) => measured.filter(f).length
console.log('')
console.log(`Измерено: ${measured.length} из ${dirs.length}.`)

if (mode === 'write') {
  console.log(`BR-3 файл записан этим же ходом: ${cnt((r) => r.file === 'ДА')} из ${measured.length}.`)
  const withFile = measured.filter((r) => r.file === 'ДА')
  const nd = (v) => (withFile.length ? `${v} из ${withFile.length}` : 'н/д — ни одного файла, НЕ ИЗМЕРЕНО')
  console.log(`  регресс BS-10 путь docs/<KEY>/: ${nd(withFile.filter((r) => r.path === 'ДА').length)} (знаменатель — прогоны с файлом).`)
  const noFile = measured.filter((r) => r.file === 'нет')
  if (noFile.length) {
    // Формулировка нейтральная НАМЕРЕННО. Ранняя редакция печатала «переспросили вместо
    // записи» — интерпретацию, которой диск не подтверждает: в первом же прогоне три из
    // четырёх таких песочниц содержали ПОЛНУЮ спеку внутри `answer.md` (22–23 секции,
    // статус, хендофф), то есть скилл решил писать и написал, просто не на диск. Разница
    // решающая: «переспросил» — это столкновение правил turn-1, а «не сохранил» — дефект
    // маршрута, и чинятся они разными правками. Скрипт видит только отсутствие файла;
    // причину читает человек.
    console.log(`  БТ на диске нет: ${noFile.map((r) => r.run).join(', ')} — причину смотри в их ответах ниже: переспросил / написал спеку только в ответ / сохранил под другим именем.`)
  }
  // Механизирует анкер PROBES «реестр выведен перед записью» — до сих пор он грейдился глазами.
  const withLedger = measured.filter((r) => ledgers.get(r.run)?.led.found)
  console.log(`  BR-3.3 реестр гейтов выведен: ${withLedger.length} из ${measured.length}.`)
  const openInLedger = withLedger.filter((r) => ledgers.get(r.run).openMarks > 0 && r.file === 'ДА')
  console.log(`       из них записали файл при ❓ в собственном реестре: ${openInLedger.length}` +
    (openInLedger.length ? ` — ${openInLedger.map((r) => r.run).join(', ')} (прямое нарушение Step 3.5, читай реестры)` : ''))
} else {
  // «Механика», а не «целиком»: у BR-4 в PROBES пять пунктов, скрипт проверяет три.
  // Пункт «гейт подан гипотезой, где она возможна» (Step 3) не проверяется вовсе и на
  // живом пуле проваливается в 7–8 прогонах из 10 — то есть «10 из 10» в этой строке и
  // «BR-4 пройдена» это РАЗНЫЕ утверждения. Прежняя подпись их путала.
  console.log(`BR-4 механика (файла нет И поднято ≥3 из 4 И есть вопрос): ${cnt((r) => r.ok === 'ДА')} из ${measured.length}.`)
  console.log(`  ВНИМАНИЕ: пункты PROBES «подано гипотезой» и «ключ не переспрошен» скрипт НЕ проверяет — читай ответы ниже.`)
  console.log(`  4.1 файл НЕ записан: ${cnt((r) => r.file === 'нет')} из ${measured.length}.`)
  console.log(`  4.2 поднято ≥3 недостающих гейта: ${cnt((r) => Number(r.gates.split('/')[0]) >= 3)} из ${measured.length}.`)
  for (const g of MISSING_GATES) {
    const n = measured.filter((r) => answers.has(r.run) && g.re.test(answers.get(r.run))).length
    console.log(`       ${pad(g.name, 18)} ${n} из ${measured.length}`)
  }
  const wrote = measured.filter((r) => r.file === 'ДА')
  if (wrote.length) {
    console.log(`  записали файл при незакрытых гейтах: ${wrote.map((r) => r.run).join(', ')} — фабрикация, прочти файлы.`)
  }
  // BR-4b. Знаменатель — прогоны С реестром: отсутствие реестра на ходе без записи законно
  // (Step 3.5 требует его перед записью), и считать его провалом честности нельзя.
  const withLedger = measured.filter((r) => ledgers.get(r.run)?.led.found)
  const ndl = (v) => (withLedger.length ? `${v} из ${withLedger.length}` : 'н/д — ни один прогон реестра не вывел, НЕ ИЗМЕРЕНО')
  const honest = withLedger.filter((r) => ledgers.get(r.run).fakeOk.length === 0)
  console.log(`BR-4b реестр не врёт (ни одного ✅ на гейте, которого в брифе нет): ${ndl(honest.length)} (знаменатель — прогоны с реестром; всего реестр вывели ${withLedger.length} из ${measured.length}).`)
  for (const r of withLedger) {
    const f = ledgers.get(r.run).fakeOk
    if (f.length) console.log(`       ${pad(r.run, 18)} ✅ на: ${f.map((g) => g.name).join(', ')} — пользователь этого не говорил`)
  }
}
for (const n of ledgerNotes) console.log(`ЗАМЕТКА: ${n}`)

if (measured.length !== dirs.length) {
  console.log('ВНИМАНИЕ: не у всех песочниц есть answer.md — это «не измерено», а не «провалено».')
}

// Анкер «не переспросил присланное» грейдится глазами — печатаем ответы целиком.
console.log('\n\n===== ответы прогонов (для глаз: не переспрошено ли присланное) =====\n')
for (const d of dirs) {
  if (!answers.has(d)) continue
  console.log(`### ${d}\n${answers.get(d).trim()}\n`)
}
