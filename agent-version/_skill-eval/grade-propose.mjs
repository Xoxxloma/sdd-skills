// grade-propose.mjs — ПРЕДЛАГАЕТ ЛИ агент ответ вместе с вопросом.
//
//   node grade-propose.mjs <папка-плеча|папка-раунда>
//   node grade-propose.mjs --ab <плечо-до> <плечо-после>
//   node grade-propose.mjs --selftest
//
// ЗАЧЕМ. Жалоба 2026-08-30: после запретов на выдумку агент перестал предлагать корректные
// варианты там, где проектирует новое. `grade-options.mjs` на этот вопрос не отвечает — он
// меряет СЛОЖНОСТЬ варианта («мудрёность») и ищет пункты списка в окне после вопроса. На
// пилоте `ts-opt` он дал «вариантов: 1» для хода, где названы два предложения и три
// альтернативы: агент написал их прозой, а не списком. Разметка — не предмет этого замера.
//
// ЧТО СЧИТАЕТСЯ. Четыре числа на прогон:
//   вопросов          — предложений со знаком «?» плюс прямые просьбы («Укажите …»);
//   с конкретикой     — из них те, в чьём окне есть ТВЁРДЫЙ ТОКЕН (см. ниже). Это отделяет
//                       «понял так: опрос раз в 5 секунд — верно?» от «как обновлять счётчик?»;
//   альтернатив       — сколько РАЗНЫХ ответов названо: пунктами списка (парсер берётся из
//                       `grade-options.mjs`, свой не пишем) и перечислением внутри строки;
//   отговорок         — «опишу сам», «уточню в чате» и прочее, что ответом не является.
//
// ТВЁРДЫЙ ТОКЕН — механический признак того, что предмет назван, а не класс предмета:
// число с единицей (5 секунд, 30 дней), литерал в обратных кавычках (`updatedAt`), значение
// в кавычках, перечисление через «/» или «или». Регулярки по СЛОВАМ-МАРКЕРАМ («предлагаю»,
// «понял так») здесь намеренно НЕ используются: слово-маркер меряет формулировку отчёта, а
// не содержание вопроса, и на нём мы уже обжигались (DEFECTS.md, ловушки стенда).
//
// ЧЕГО ЗДЕСЬ НЕТ. Оценки, «хороший вопрос или плохой». Число альтернатив само по себе не
// хорошо и не плохо: один вариант законен, когда перебора не было. Замер сравнительный —
// смысл имеет РАЗНИЦА между плечами, а не абсолют.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { optionsOf } from './grade-options.mjs'

const RE_API_FAILURE = /API Error|Request timed out|rate limit|overloaded_error/i
const WINDOW = 4 // строк вокруг вопроса, в которых конкретика ещё считается его

// Прямая просьба — это тоже вопрос, хотя «?» в ней нет: «Укажите ключ задачи `SMSEC-1234`».
const RE_ASK = /^\s*(?:[-*•]|\d+[.)])?\s*\**(?:укажите|подтвердите|уточните|назовите|выберите|скажите)(?!\p{L})/iu

// Твёрдые токены. Каждый — предмет, который человек может проверить, а не класс предмета.
const HARD = [
  { label: 'число с единицей', re: /(?<!\p{L})\d+(?:[.,]\d+)?\s*(?:сек|секунд\p{L}*|мс|миллисекунд\p{L}*|мин|минут\p{L}*|час\p{L}*|дн\p{L}*|дней|сут\p{L}*|недел\p{L}*|месяц\p{L}*|шт|раз\p{L}*|%)(?!\p{L})/iu },
  { label: 'литерал в кавычках-бэктик', re: /`[^`\n]{2,}`/u },
  { label: 'значение в кавычках', re: /[«"][^»"\n]{2,}[»"]/u },
  { label: 'перечисление через или/слэш', re: /(?<!\p{L})\p{L}[\p{L}\d]*\s*(?:\/|\bили\b)\s*\p{L}[\p{L}\d]*/iu },
]

// Отговорка вариантом не бывает — правило живёт в самих скиллах, здесь только счётчик.
const RE_EXCUSE = /(опишу|укажу|отвечу|уточню|напишу|расскажу)\s+(сам|сама|в\s+чате|в\s+поле|отдельно|позже)|пока\s+не\s+знаю|другое(?!\p{L})/iu

/** Режет текст на строки, выбрасывая код-блоки и таблицы. */
function linesOf(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*\|/.test(l))
}

/** Сколько разных ответов названо ВНУТРИ строки: «(10 сек, 30 сек, иное)», «3 сек или 10?». */
export function inlineAlts(line) {
  let n = 0
  // Скобочное перечисление из двух и более членов.
  for (const m of line.matchAll(/\(([^()\n]{4,120})\)/g)) {
    const parts = m[1].split(/,|;|\bили\b/i).map((s) => s.trim()).filter((s) => s.length >= 2)
    if (parts.length >= 2) n += parts.length
  }
  // «A или B» вне скобок — две названные стороны развилки.
  if (!/\(/.test(line)) {
    const or = line.match(/(?<!\p{L})[^,;:()\n]{2,60}\s+или\s+[^,;:()\n?]{2,60}/iu)
    if (or) n += 2
  }
  return n
}

/** Разбор одного хода к человеку. */
export function gradeAnswer(text) {
  const lines = linesOf(text)
  const listOpts = optionsOf(text) // пункты списка — парсер общий с grade-options
  const questions = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const isQ = line.includes('?') || RE_ASK.test(line)
    if (!isQ) continue
    // Окно вопроса: он сам и WINDOW строк вокруг. Гипотеза часто стоит АБЗАЦЕМ ПЕРЕД
    // вопросом («Предлагаю: опрашивать каждые 5 секунд. Подойдёт?»), поэтому окно двустороннее.
    const win = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join('\n')
    const hard = HARD.filter((h) => h.re.test(win)).map((h) => h.label)
    questions.push({ line: line.trim(), hard, inline: inlineAlts(line) })
  }
  const excuses = listOpts.filter((o) => RE_EXCUSE.test(o)).length
  const inline = questions.reduce((s, q) => s + q.inline, 0)
  return {
    questions: questions.length,
    withHard: questions.filter((q) => q.hard.length > 0).length,
    alts: listOpts.length + inline,
    listAlts: listOpts.length,
    inlineAlts: inline,
    excuses,
    detail: questions,
  }
}

const isApiFailure = (t) => RE_API_FAILURE.test(t.slice(0, 400))

function gradeSandbox(sb) {
  const r = { name: sb.split(/[\\/]/).pop(), measured: false }
  if (existsSync(join(sb, '_api-failure.txt'))) return { ...r, why: 'отказ API' }
  const ansPath = join(sb, 'answer.md')
  if (!existsSync(ansPath)) return { ...r, why: 'ответа нет' }
  const answer = readFileSync(ansPath, 'utf8')
  if (isApiFailure(answer)) return { ...r, why: 'отказ API в тексте ответа' }
  if (!answer.trim()) return { ...r, why: 'пустой ответ' }
  return { ...r, measured: true, ...gradeAnswer(answer) }
}

function sandboxesOf(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const p = join(dir, e.name)
    if (existsSync(join(p, 'answer.md'))) out.push(p)
    else if (statSync(p).isDirectory()) out.push(...sandboxesOf(p))
  }
  return out
}

function summarize(dir) {
  const rows = sandboxesOf(dir).map(gradeSandbox)
  const ok = rows.filter((r) => r.measured)
  const sum = (f) => ok.reduce((s, r) => s + f(r), 0)
  return {
    dir,
    runs: rows.length,
    measured: ok.length,
    questions: sum((r) => r.questions),
    withHard: sum((r) => r.withHard),
    alts: sum((r) => r.alts),
    listAlts: sum((r) => r.listAlts),
    inlineAlts: sum((r) => r.inlineAlts),
    excuses: sum((r) => r.excuses),
    rows,
  }
}

function report(s) {
  const per = (n) => (s.questions ? (n / s.questions).toFixed(2) : '—')
  console.log(`плечо: ${s.dir}`)
  console.log(`  прогонов: ${s.runs}, измерено: ${s.measured}`)
  console.log(`  вопросов: ${s.questions}  (${(s.questions / (s.measured || 1)).toFixed(1)} на прогон)`)
  console.log(`  с конкретикой: ${s.withHard}/${s.questions} (${s.questions ? Math.round((100 * s.withHard) / s.questions) : 0}%)   ← предложил, а не спросил в пустоту`)
  console.log(`  альтернатив: ${s.alts} (${per(s.alts)} на вопрос) — списком ${s.listAlts}, в строке ${s.inlineAlts}`)
  console.log(`  отговорок: ${s.excuses}`)
}

// ─── Самопроверка на дословных строках ─────────────────────────────────────────────────────
// Ход пилота `ts-opt` run-1 от 2026-08-30, размеченный руками ДО написания счётчика:
// 2 вопроса, оба с конкретикой, 3 альтернативы в строке, 0 отговорок.
const PILOT = `**Открытые гейты:**

1. **Частота опроса (гейт 8 — синхронность/производительность).**
   БТ говорит «при изменении обновляется без перезагрузки», но конкретного интервала нет. **Предлагаю: опрашивать счётчик каждые 5 секунд** — достаточно для видимости текущей активности, не создаёт избыточную нагрузку. Подойдёт этот интервал или нужен другой (10 сек, 30 сек, иное)?

2. **Интерпретация updatedAt=null (подтверждение подрядчика о существующем).**
   В \`services/auth.md\` указано: \`updatedAt: iso8601|null\`. Правильно ли я понимаю, что фронт должен показать прочерк «—» вместо значения \`count\`?
`
const EMPTY_Q = `## Вопросы

Что должна делать выгрузка в Excel?

Кто потребитель отчёта?
`
const EXCUSE_Q = `Что делаем в первую очередь?

- Опишу сам
- Пока не знаю
`

function selftest() {
  const p = gradeAnswer(PILOT)
  const e = gradeAnswer(EMPTY_Q)
  const x = gradeAnswer(EXCUSE_Q)
  const checks = [
    ['пилот: два вопроса найдены', p.questions === 2],
    ['пилот: оба с конкретикой', p.withHard === 2],
    ['пилот: альтернативы в строке найдены', p.inlineAlts >= 3],
    ['пилот: отговорок нет', p.excuses === 0],
    ['пустые вопросы найдены', e.questions === 2],
    ['пустые вопросы конкретики не дают', e.withHard === 0],
    ['пустые вопросы альтернатив не дают', e.alts === 0],
    ['отговорки в списке пойманы', x.excuses === 2],
    ['«или» вне скобок даёт две стороны', inlineAlts('таймаут 3 секунды или 10?') === 2],
    ['скобочное перечисление считается', inlineAlts('нужен другой (10 сек, 30 сек, иное)?') === 3],
    ['одиночная скобка перечислением не считается', inlineAlts('счётчик (гейт 8) обновляется?') === 0],
  ]
  let bad = 0
  for (const [name, ok] of checks) {
    if (!ok) bad += 1
    console.log(`${ok ? '  ok' : 'FAIL'}  ${name}`)
  }
  console.log(bad ? `\nПРОВАЛЕНО: ${bad} из ${checks.length}` : `\nвсе ${checks.length} проверок прошли`)
  process.exit(bad ? 1 : 0)
}

// ─── CLI ───────────────────────────────────────────────────────────────────────────────────
// Охрана main-модуля — та же, что в `grade-options.mjs` и по той же причине: без неё
// `import` этого файла ради `gradeAnswer` запускает CLI с чужим argv и печатает usage.
const IS_MAIN = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].split('\\').join('/')}`).href
if (IS_MAIN) {
const [a, b, c] = process.argv.slice(2)
if (a === '--selftest') selftest()
else if (a === '--ab') {
  const before = summarize(b)
  const after = summarize(c)
  report(before)
  console.log('')
  report(after)
  const d = (f, l) => {
    const x = before.questions ? f(before) / before.questions : 0
    const y = after.questions ? f(after) / after.questions : 0
    console.log(`  ${l}: ${x.toFixed(2)} → ${y.toFixed(2)}  (${y - x >= 0 ? '+' : ''}${(y - x).toFixed(2)})`)
  }
  console.log('\nРАЗНИЦА на вопрос:')
  d((s) => s.withHard, 'с конкретикой')
  d((s) => s.alts, 'альтернатив  ')
} else if (a) report(summarize(a))
else {
  console.log('usage: grade-propose.mjs <папка> | --ab <до> <после> | --selftest')
  process.exit(1)
}
}
