#!/usr/bin/env node
// grade-bs9.mjs — механика «Статуса готовности» БТ (BS-9) и путь записи файла (BS-10).
//
// Скрипт НЕ выносит качественных суждений. Он отвечает только на то, на что можно ответить
// строкой: где лежит файл, какое значение стоит в статусе, есть ли в нём число, сколько
// пунктов в блоке «Открытые вопросы», сколько TBD/⚠️ в теле — и сходится ли одно с другим.
//
// Два измерения в одном грейдере намеренно: обе пробы снимаются с ОДНОГО артефакта, и
// заводить второй проход по тем же песочницам незачем.
//
// Правила репы, из-за которых он написан именно так:
//   - грейдим файл на диске, а не ответ агента (`answer.md` не читается вовсе);
//   - регулярки литеральные, из строк не собираются (`\Z` в grade-gl стоил ложных нулей);
//   - песочница без артефакта — «НЕ ИЗМЕРЕНО», а не «провалено»;
//   - поиск файла рекурсивный: дефект маршрута (файл в корне вместо docs/<KEY>/) — это то,
//     что BS-10 и меряет, поэтому находить файл надо и там.
//
// ВНИМАНИЕ при чтении итогов: BS-9.1 («статус согласован с блоком») зелёная и на СТАРОЙ форме
// без числа — она про согласованность, а не про форму. Число меряют только 9.2 и 9.3.
// Отчитываться одной строкой 9.1 нельзя: до правки она и так была высокой.
//
// usage: node grade-bs9.mjs <каталог с песочницами>
//        node grade-bs9.mjs _skill-eval/fixtures/bs9-validate     ← самопроверка грейдера
//        node grade-bs9.mjs _skill-eval/fixtures/bs9b-validate    ← самопроверка 9.6 (BS-9b)

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.argv[2]
if (!root || !existsSync(root)) {
  console.error('usage: node grade-bs9.mjs <каталог с песочницами>')
  process.exit(1)
}

/** Рекурсивно ищет все business_requirements.md. Детские БТ эпика тоже попадут — это норма,
 *  для BS-9/BS-10 фикстура одноузловая, и лишний файл виден в колонке «путь». */
function findBrd(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) findBrd(p, acc)
    else if (e.name === 'business_requirements.md') acc.push(p)
  }
  return acc
}

/** Шапка = всё до первого заголовка `## `. Статус и «Открытые вопросы» живут там. */
function header(text) {
  const lines = text.split(/\r?\n/)
  const end = lines.findIndex((l) => /^##\s/.test(l))
  return (end === -1 ? lines : lines.slice(0, end)).join('\n')
}

function body(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s/.test(l))
  return start === -1 ? '' : lines.slice(start).join('\n')
}

/** Значение статуса одной строкой, без markdown-обвязки. */
function statusValue(head) {
  const m = head.match(/Статус\s+готовности\s*:?\s*\**\s*([^\n]*)/i)
  if (!m) return null
  return m[1]
    .replace(/\*+/g, '')
    .replace(/^[:\s]+/, '')
    .replace(/[\s>]+$/, '')
    .trim()
}

/** Пункты блока «Открытые вопросы»: перечисление после его заголовка, до первого `##`.
 *  Считаются И нумерованные (`1.`), И маркированные (`-`, `*`, `•`) — шаблон навязывает
 *  нумерацию, но документ с дефисами верен, а грейдер, считающий только цифры, красит его
 *  в провал. Строка-курсив шаблона «*(Если открытых вопросов нет — …)*» под маркер не
 *  попадает: после `*` там скобка, а не пробел. */
function openItems(text) {
  const lines = text.split(/\r?\n/)
  // Якорь — строка, которая ВЫГЛЯДИТ заголовком блока (жирная метка или `#`-заголовок), а не
  // любое упоминание фразы. Иначе разбор цепляется за упоминание в значении статуса или за
  // утёкшее пояснение шаблона, а на настоящем заголовке ниже срабатывает break — и верный
  // документ получает ноль пунктов.
  // Фраза обязана стоять ВНУТРИ жирной метки или в `#`-заголовке. Проверка «строка жирная и
  // где-то содержит фразу» цепляется за значение статуса «Требуются уточнения (2) — открытые
  // вопросы перечислены ниже», и разбор начинается строкой выше настоящего блока.
  const isHeader = (l) =>
    /^\s*>?\s*\*\*[^*]*Открытые\s+вопрос/i.test(l) || /^#{1,6}\s+[^\n]*Открытые\s+вопрос/i.test(l)
  let start = lines.findIndex(isHeader)
  if (start === -1) start = lines.findIndex((l) => /Открытые\s+вопрос/i.test(l))
  if (start === -1) return { count: 0, found: false }
  let count = 0
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i]
    end = i
    // Блок кончается заголовком секции либо СЛЕДУЮЩЕЙ жирной меткой («**Источники:**»).
    // По `>` не ориентируемся: цитатное оформление — рекомендация шаблона, а не обязанность,
    // и документ с тем же блоком без `>` верен.
    if (/^#{1,6}\s/.test(raw)) break
    // Снимаем ТОЛЬКО цитатный префикс. Общий `^\s*>?\s?` съедал бы и отступ вложенного
    // подпункта в документе без `>`, и подпункт становился бы отдельным пунктом.
    const line = /^\s*>/.test(raw) ? raw.replace(/^\s*>\s?/, '') : raw
    // Вложенный подпункт — часть своего пункта. Порог 2 пробела: под `-`-списком это
    // стандартное вложение, под нумерованным бывает 3–4.
    if (/^\s{2,}/.test(line)) continue
    // Пункт проверяется ДО жирной метки: `**1. Гейт 6:** …` — это пункт, обёрнутый жирным,
    // а не начало следующего под-блока. Обратный порядок обнулял счёт на первом же пункте.
    const isItem = /^\s*(\d+[.)]|[-*•])\s+\S/.test(line) || /^\s*\*\*\s*(\d+[.)]|[-*•])\s+/.test(line)
    if (!isItem) {
      // Жирная метка не-пункт («**Источники:**») закрывает блок.
      if (/^\s*\*\*[^*]+\*\*/.test(line)) break
      continue
    }
    // Строка «открытых вопросов нет» — не пункт, каким бы маркером и словами её ни оформили.
    if (/Все\s+ключевые\s+данные\s+подтверждены/i.test(line)) continue
    if (/открыт\w*\s+вопрос\w*\s+нет/i.test(line)) continue
    if (/готов\w*\s+к\s+оценке/i.test(line)) continue
    count++
    end = i + 1
  }
  return { count, found: true, start, end }
}

/** Настоящий незакрытый пробел в теле: строка, ЗНАЧЕНИЕМ которой является `TBD`, либо
 *  пометка `⚠️ Требует уточнения`. Слово «TBD», упомянутое прозой внутри предложения
 *  («поля, помеченные как TBD, мы закрыли»), сюда не попадает — иначе верный документ
 *  красится в провал, а словарного способа отличить их не существует. */
function realGaps(bodyText) {
  let n = 0
  for (const raw of bodyText.split(/\r?\n/)) {
    const line = raw.replace(/^\s*>?\s*/, '')
    // ⚠ в любом виде — маркер расплывчатости, слова «Требует уточнения» скилл требует не
    // везде (§617 разрешает голый значок). VS16 может быть, а может и не быть.
    if (/⚠/.test(line)) { n++; continue }
    // Ячейка таблицы: §2.3 «Бизнес-риски» по шаблону — таблица, и `TBD` там значение ячейки.
    if (/^\s*\|/.test(line)) {
      const cells = line.split('|').map((c) => c.replace(/\*+/g, '').trim())
      if (cells.some((c) => /^TBD\b/i.test(c))) n++
      continue
    }
    // Обычная строка: `TBD` как ЗНАЧЕНИЕ — в начале, после метки с двоеточием или после тире.
    // Слово внутри предложения («поля, помеченные как TBD, мы закрыли») не считается.
    const flat = line.replace(/^[-*•]\s*/, '').replace(/\*+/g, '')
    if (/(^|:\s*|—\s*|–\s*|-\s+)TBD\b/i.test(flat)) n++
  }
  return n
}

/** Сколько файлов прогон создал в песочнице, кроме служебных стенда. Скилл обязан написать
 *  ровно один `.md` и не трогать больше ничего — правило есть в Step 4 и в Self-Review 5, а
 *  проверки под него не было ни одной: BS-10 смотрит только ПУТЬ уже найденного файла.
 *  Класс не гипотетический — в «Уроках харнесса» записаны прогоны, писавшие мимо песочницы. */
function producedFiles(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) producedFiles(p, acc)
    // `_api-failure.txt` создаёт РАННЕР (`mv answer.md _api-failure.txt` при отказе API),
    // а не скилл — он того же класса, что answer.md и _stderr.log. Без него в списке проба
    // печатала 0 из 9 и 0 из 10: стопроцентный красный, целиком порождённый исключениями.
    else if (!['answer.md', '_stderr.log', '_api-failure.txt'].includes(e.name)) acc.push(relative(dir, p))
  }
  return acc
}

const dirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const rows = []
const notes = []

for (const d of dirs) {
  const sandbox = join(root, d)
  const produced = producedFiles(sandbox)
  const files = findBrd(sandbox)
  if (files.length === 0) {
    // «ДОКУМЕНТА НЕТ» И «НЕ ИЗМЕРЕНО» — РАЗНЫЕ ИСХОДЫ, И ПУТАТЬ ИХ НЕЛЬЗЯ.
    // Прежняя редакция звала «не измерено» любую песочницу без БТ. Правило писалось под
    // отказ стенда, но под него попадал и состоявшийся прогон, который просто не записал
    // файла, — то есть НАСТОЯЩИЙ провал BS-10 вынимался из знаменателя и завышал плечо.
    // Признак «прогон состоялся» — непустой `answer.md`, а не наличие документа.
    const ran = existsSync(join(sandbox, 'answer.md')) && statSync(join(sandbox, 'answer.md')).size > 0
    rows.push({
      run: d, path: '—', pathOk: ran ? 'ФАЙЛА НЕТ' : '—', key: '—', stub: '—',
      status: ran ? 'документ не записан' : 'НЕ ИЗМЕРЕНО (прогона не было)',
      num: '—', items: '—', tbd: '—', made: String(produced.length), ok: ran ? 'нет' : '—',
    })
    continue
  }
  if (files.length > 1) notes.push(`${d}: найдено ${files.length} файлов business_requirements.md — грейдится первый по пути`)

  const file = files.sort()[0]
  const rel = relative(sandbox, file).split(sep).join('/')
  // HTML-комментарии выбрасываем до любого разбора: в них лежат пометки автора фикстуры и
  // служебные хвосты, а слово `TBD` в комментарии считалось бы незакрытым пробелом.
  const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const head = header(text)
  const rest = body(text)

  // BS-10: путь. Ожидание — docs/<KEY>/business_requirements.md от корня песочницы.
  const pathMatch = rel.match(/^docs\/([A-Z][A-Z0-9]+-\d+)\/business_requirements\.md$/)
  const pathLoose = rel.match(/^docs\/([A-Za-z][A-Za-z0-9]+-\d+)\/business_requirements\.md$/i)
  const keyInHeader = (head.match(/([A-Z][A-Z0-9]+-\d+)/) || [])[1] || '—'
  // Регистр отделён от «файл не там»: `docs/ars-140/` — другой дефект, чем файл в корне,
  // и чинится он иначе.
  const pathOk = pathMatch
    ? (pathMatch[1] === keyInHeader ? 'ДА' : 'КЛЮЧ≠ПАПКА')
    : (pathLoose ? 'РЕГИСТР' : 'НЕТ')

  // BS-9: статус.
  const stub = /ПРОСТАВЛЯЕТСЯ\s+ПОСЛЕ\s+ЗАПИСИ/i.test(text) ? 'ДА' : 'нет'
  const status = statusValue(head)
  const numMatch = status && status.match(/Требуются\s+уточнени\S*\s*\(\s*(\d+)\s*\)/i)
  const isNeedsWork = !!status && /Требуются\s+уточнени/i.test(status)
  const isReady = !!status && /Готово\s+к\s+оценке/i.test(status)
  // Блок ищем по ВСЕМУ файлу: прогон мог поставить его в конец, и тогда разбор одной шапки
  // делает 9.1 ложно зелёной.
  const block = openItems(text)
  const items = block.count
  const blockFound = block.found

  // «Тело» для 9.5 — всё, кроме шапки и кроме самого блока «Открытые вопросы»: пункты блока
  // сами содержат слово TBD, и считать их пробелами значит зачесть собранный блок как
  // несобранный.
  const allLines = text.split(/\r?\n/)
  const firstSection = allLines.findIndex((l) => /^##\s/.test(l))
  const tbd = realGaps(
    allLines
      .filter((_, i) => (firstSection === -1 || i >= firstSection) && !(block.found && i >= block.start && i < block.end))
      .join('\n')
  )

  // ДВЕ РАЗНЫЕ СВЕРКИ, и смешивать их нельзя:
  //   9.1 — статус против БЛОКА (блок авторитет для статуса);
  //   9.5 — блок против ТЕЛА (тело авторитет для блока).
  // Ровно на этом стоит повод пробы: в круге 5 блок говорил «все данные подтверждены» при
  // двух `TBD` в теле, и статус был согласован с блоком — то есть 9.1 зелёная, а документ
  // врёт. Поймать это может только 9.5.
  const shouldNeedWork = items > 0
  let ok = 'нет'
  if (stub === 'ДА' || !status) ok = 'нет'
  else if (shouldNeedWork && isNeedsWork) ok = 'ДА'
  else if (!shouldNeedWork && isReady) ok = 'ДА'

  rows.push({
    run: d,
    path: rel,
    pathOk,
    key: keyInHeader,
    stub,
    status: status || '—',
    num: numMatch ? numMatch[1] : 'нет',
    items: blockFound ? String(items) : 'нет блока',
    tbd: String(tbd),
    made: String(produced.length),
    ok,
  })
  if (produced.length > 1) notes.push(`${d}: создано файлов ${produced.length} — ${produced.join(', ')}`)
}

const pad = (s, n) => String(s).padEnd(n)
console.log(
  pad('прогон', 14), pad('путь ок', 10), pad('заглушка', 9),
  pad('число', 6), pad('пунктов', 8), pad('TBD/⚠️', 7), pad('файлов', 7), pad('статус верен', 13), 'значение статуса'
)
console.log('-'.repeat(120))
for (const r of rows) {
  console.log(
    pad(r.run, 14), pad(r.pathOk, 10), pad(r.stub, 9),
    pad(r.num, 6), pad(r.items, 8), pad(r.tbd, 7), pad(r.made, 7), pad(r.ok, 13), r.status
  )
}

const measured = rows.filter((r) => r.ok !== '—')
const cnt = (f) => measured.filter(f).length
console.log('')
console.log(`Измерено: ${measured.length} из ${dirs.length}.`)
console.log(`BS-9.1 статус согласован с блоком: ${cnt((r) => r.ok === 'ДА')} из ${measured.length}.`)
// Знаменатель у 9.2/9.3 — только прогоны с непустым блоком: при N = 0 значение «Готово к
// оценке» скобок не несёт по построению, и считать его промахом нельзя.
const noBlock = measured.filter((r) => r.items === 'нет блока')
if (noBlock.length) {
  console.log(`Секции «Открытые вопросы» нет вовсе (шаблон её требует): ${noBlock.length} из ${measured.length} — ${noBlock.map((r) => r.run).join(', ')}.`)
}
const withItems = measured.filter((r) => Number(r.items) > 0)
const cntI = (f) => withItems.filter(f).length
const nd = (v) => (withItems.length ? `${v} из ${withItems.length}` : 'н/д — ни одного прогона с непустым блоком, НЕ ИЗМЕРЕНО')
console.log(`BS-9.2 число в статусе присутствует: ${nd(cntI((r) => r.num !== 'нет'))} (знаменатель — прогоны с непустым блоком).`)
console.log(`BS-9.3 число равно количеству пунктов: ${nd(cntI((r) => r.num !== 'нет' && r.num === r.items))} (тот же знаменатель).`)
console.log(`BS-9.4 заглушка не осталась: ${cnt((r) => r.stub === 'нет')} из ${measured.length}.`)
// 9.5 — повод пробы. Блок обязан быть собран из тела: есть незакрытый `TBD`/`⚠️` → в блоке
// есть пункт. Именно это нарушали 4 прогона из 5 в круге 5, и 9.1 их пропускает.
const blockBroken = measured.filter((r) => Number(r.tbd) > 0 && Number(r.items) === 0)
console.log(`BS-9.5 блок собран из тела (есть TBD/⚠️ → есть пункт): ${measured.length - blockBroken.length} из ${measured.length}` +
  (blockBroken.length ? ` — не собран: ${blockBroken.map((r) => r.run).join(', ')}` : ''))
// 9.6 — БЛОК СОБРАН ЦЕЛИКОМ, А НЕ ЧАСТИЧНО. Заведено под BS-9b (2026-08-07).
// 9.5 ловит только полностью пустой блок при непустом теле, поэтому мимо неё проходит
// главный вариант дефекта R2: скилл берёт N из числа ⏭️ в реестре, собирает блок ровно из
// стольких же пунктов и оставляет `⚠️` в теле неучтённым. Тогда num == items, 9.1/9.2/9.3
// зелёные, а документ занижает число открытых пунктов. Правило Step 4 — «собери в блок
// КАЖДЫЙ TBD и КАЖДЫЙ ⚠️», значит пунктов не может быть меньше, чем пробелов в теле.
// Больше — законно: один пробел скилл вправе расписать двумя пунктами.
const partial = measured.filter((r) => r.items !== 'нет блока' && Number(r.items) < Number(r.tbd))
console.log(`BS-9.6 блок покрывает все пробелы тела (пунктов ≥ TBD/⚠️): ${measured.length - partial.length} из ${measured.length}` +
  (partial.length ? ` — не покрывает: ${partial.map((r) => `${r.run} (${r.items} п. при ${r.tbd} в теле)`).join(', ')}` : ''))
console.log(`BS-10 путь docs/<KEY>/business_requirements.md: ${cnt((r) => r.pathOk === 'ДА')} из ${measured.length}.`)
// Скилл обязан написать РОВНО ОДИН файл (Step 4 «Пиши только этот один файл», Self-Review 5).
// Проверки под это правило не было ни одной: BS-10 смотрит путь уже найденного файла и лишние
// файлы рядом с ним не видит. Заведено по разбору диффа 2026-08-06.
console.log(`BS-10b записан ровно один файл: ${cnt((r) => r.made === '1')} из ${measured.length}.`)
if (measured.length !== dirs.length) {
  console.log('ВНИМАНИЕ: не у всех песочниц есть артефакт — это «не измерено», а не «провалено».')
}
for (const n of notes) console.log(`ЗАМЕТКА: ${n}`)

console.log('\n\n===== шапки прогонов (для глаз) =====\n')
for (const d of dirs) {
  const files = findBrd(join(root, d))
  if (!files.length) continue
  console.log(`### ${d}\n${header(readFileSync(files.sort()[0], 'utf8')).trim()}\n`)
}
