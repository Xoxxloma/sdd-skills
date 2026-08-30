// grade-options.mjs — сложность ВАРИАНТОВ ОТВЕТА в ходе скилла к человеку.
//
//   node grade-options.mjs <папка-плеча|папка-раунда>   — счётчик по прогонам
//   node grade-options.mjs --corpus <папка-с-раундами>  — свод по всему корпусу
//   node grade-options.mjs --selftest
//
// ЗАЧЕМ. Жалоба с прода 2026-08-26: вход был подробный, а варианты ответа оказались
// настолько мудрёными, что аналитик перечитывал их трижды. Это НЕ «вода при пустоте»
// (её ловит `grade-water.mjs`), а противоположный дефект: материала много, и все правила
// скилла про вариант — добавляющие («вложи расшифровку», «вложи следствие», «вложи
// конкретику»), а ограничения сверху нет ни одного.
//
// ЧТО СЧИТАЕТСЯ ВАРИАНТОМ. Пункт списка в окне после строки с вопросом. Окно, а не
// «строка вплотную»: в прозе агент вставляет между вопросом и списком пустую строку,
// заголовок «Варианты:», иногда абзац гипотезы. Первая версия разборщика брала только
// вплотную и нашла 118 вариантов на 480 прогонов — то есть мерила свою узость, а не корпус.
//
// ЧЕГО НЕ СЧИТАЕТСЯ: строки таблиц, код-блоки, строки реестра гейтов (со значками ✅⏭❓),
// пути к файлам, заголовки. Реестр — законный вывод скилла, и вариантом он не является.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request timed out|rate limit|overloaded_error/i
const RE_LEDGER = /[✅⏭❓]/
const RE_BULLET = /^\s{0,6}(?:[-*•]|\d+[.)])\s+(\S.*)$/
const WINDOW = 6 // строк после вопроса, в которых список ещё считается его вариантами

/** Вытаскивает варианты из текста хода. */
export function optionsOf(text) {
  const clean = text.replace(/```[\s\S]*?```/g, '')
  const lines = clean.split(/\r?\n/)
  const out = []
  let since = Infinity
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^\s*\|/.test(line)) { continue }              // таблица
    if (/^\s*#{1,6}\s/.test(line)) { since = Infinity; continue } // заголовок рвёт связь
    const m = line.match(RE_BULLET)
    if (m) {
      // Пункт со знаком вопроса — это САМ ВОПРОС, а не выбор под ним. Агент нумерует вопросы
      // списком, и без этой проверки вопрос №2 попадал в варианты вопроса №1: на пилоте ts-opt
      // три «самых тяжёлых варианта» оказались тремя вопросами. Цена — теряются варианты,
      // сформулированные вопросом («Существующий сервис, который потребляет админка?»); их
      // меньше, чем ложняков, и они не про сложность выбора.
      if (since <= WINDOW && !RE_LEDGER.test(line) && !line.includes('?')) {
        const body = m[1].replace(/\*\*/g, '').trim()
        if (body.length >= 6 && !/^https?:|^[\w./-]+\.(md|yaml|json|ts|js)$/i.test(body)) out.push(body)
      }
      // Сам вопрос часто стоит НУМЕРОВАННЫМ ПУНКТОМ, а варианты — вложенным списком под ним:
      //   3. **Механизм обновления**: как обновляем счётчик?
      //      - Вариант A: опрос раз в 30 секунд
      // Первая версия съедала такую строку как пункт и окно по ней не открывала, поэтому
      // вложенные варианты не находились вовсе. Пойман на пилоте пробы ts-opt 2026-08-26.
      if (line.includes('?')) since = 0
      continue
    }
    if (line.includes('?')) { since = 0; continue }
    if (!line.trim()) { since += 1; continue }         // пустая строка окно не рвёт
    since += 1
  }
  return out
}

const SEP = /\s+[—–-]\s+|:\s+/
const RE_CLAUSE = /(?<!\p{L})(но|кроме|однако|при\s+условии|только\s+если|за\s+исключением|если\s+только|при\s+этом|тогда\s+как)(?!\p{L})/giu
const RE_BARE_ID = /(?<![\p{L}-])(FR|INT|NFR|AC|BR)-\d+(?!\s*[(«„]|\s*[—–-]\s*\p{L})|§\s*\d+(?:\.\d+)*(?![\d.])(?!\s*[(—–-]\s*\p{L})/u

const LABEL_WORDS_MAX = 5
const EXPLAIN_CHARS_MAX = 120

/** Разбор одного варианта на метку и пояснение плюс четыре механических признака. */
export function gradeOption(o) {
  // Скобка в хвосте — это пояснение, а не часть метки: «Начать другую задачу (вернёмся
  // к стартовому вопросу)» первая версия считала меткой из семи слов. Ложняк снят по разбору
  // корпуса 2026-08-26.
  const paren = o.match(/^(.+?)\s*\((.+)\)\s*$/)
  const parts = paren ? [paren[1], paren[2]] : o.split(SEP)
  const label = parts[0].trim()
  const explain = parts.slice(1).join(' — ').trim()
  const labelWords = label.replace(/[`«»"']/g, '').split(/\s+/).filter(Boolean).length
  const clauses = (o.match(RE_CLAUSE) || []).length
  const flags = []
  // «Метка длиннее 5 слов» имеет смысл ТОЛЬКО когда агент сам разделил вариант на метку и
  // пояснение и перегрузил первую. Вариант без разделителя — это одна фраза, и девять слов в
  // ней («система, где видны все договоры и их сроки в одном месте») читаются с первого раза.
  // Первая версия метила такие как дефект и дала завышенные 14%/31% — ложняк снят по пилоту
  // 2026-08-26.
  const split = parts.length > 1
  if (split && labelWords > LABEL_WORDS_MAX) flags.push('метка длиннее 5 слов')
  if (explain.length > EXPLAIN_CHARS_MAX) flags.push('пояснение длиннее 120 знаков')
  // Без разделителя судим по весу целиком: столько текста одной фразой человек не удержит.
  if (!split && o.length > 110) flags.push('вариант одной фразой длиннее 110 знаков')
  if (clauses >= 1) flags.push('оговорка в варианте')
  if (RE_BARE_ID.test(o)) flags.push('идентификатор без расшифровки')
  // Несколько предложений или точка с запятой внутри варианта — слеплено больше одной мысли.
  if (/;/.test(o) || (o.match(/[.!?]\s+\p{Lu}/gu) || []).length >= 1) flags.push('несколько мыслей в варианте')
  return { label, explain, labelWords, clauses, flags, len: o.length }
}

// ─── Самопроверка на дословных строках ─────────────────────────────────────────────────────
const GOOD = 'Реестр договоров — юрист находит договор по номеру и видит срок'
const LONG_LABEL = 'Реестр всех договоров подрядчиков с историей изменений и поиском по номеру — сделаем это'
const LONG_EXPLAIN = 'Уведомления — ' + 'система шлёт письмо за тридцать дней до окончания договора ответственному юристу и дублирует его руководителю отдела закупок, '.repeat(2)
const CLAUSED = 'Выгрузка в Excel — выгружаем строки, отобранные фильтром, но только видимые колонки, кроме архивных'
const BARE = 'FR-1 или FR-3?'
const QTEXT = 'Что делаем в первую очередь?\n\n**Варианты:**\n\n- Реестр договоров — поиск по номеру\n- Уведомления — письмо за 30 дней\n'
const LEDGER_TEXT = 'Реестр гейтов?\n- 1. Тип (новый/доработка) — ❓\n- 2. Бизнес-процесс — ❓\n'
// Пилот ts-opt: вопрос нумерованным пунктом, варианты вложенным списком под ним.
const NESTED = '3. **Механизм обновления**: как обновляется счётчик?\n   - **Вариант A:** опрос каждые 30 секунд\n   - **Вариант B:** websocket с push от бэка\n'
// Тот же пилот: агент нумерует ВОПРОСЫ списком. Ни один из них вариантом не является.
const QUESTION_LIST = '1. Существование эндпоинта: подтверждаете, что он уже реализован?\n2. Ролевое ограничение: проверять роль на фронте или полагаться на 403 от бэка?\n'

function selftest() {
  const checks = [
    ['ОКНО: список через пустую строку и заголовок найден', optionsOf(QTEXT).length === 2],
    ['ЛОВУШКА: строки реестра вариантами не считаются', optionsOf(LEDGER_TEXT).length === 0],
    ['ВЛОЖЕННЫЙ СПИСОК: варианты под нумерованным вопросом найдены', optionsOf(NESTED).length === 2],
    ['ЛОЖНЯК: нумерованный вопрос вариантом не считается', optionsOf(QUESTION_LIST).length === 0],
    ['чистый вариант признаков не даёт', gradeOption(GOOD).flags.length === 0],
    ['длинная метка поймана', gradeOption(LONG_LABEL).flags.includes('метка длиннее 5 слов')],
    ['длинное пояснение поймано', gradeOption(LONG_EXPLAIN).flags.includes('пояснение длиннее 120 знаков')],
    ['оговорка поймана', gradeOption(CLAUSED).flags.includes('оговорка в варианте')],
    ['голый идентификатор пойман', gradeOption(BARE).flags.includes('идентификатор без расшифровки')],
    ['ЛОЖНЯК: длинная фраза без разделителя меткой не считается',
      !gradeOption('система, где видны все договоры и их сроки в одном месте').flags.includes('метка длиннее 5 слов')],
    ['ЖАЛОБА: плотный вариант с кодами и «;» пойман',
      gradeOption('Недоступность источника — BE отвечает не-2xx (503/504), а не 200 с null; FE трактует любой таймаут как «источник недоступен» → «—» (FR-3)').flags.length >= 2],
    ['ЛОЖНЯК: скобка-пояснение меткой не считается',
      !gradeOption('Начать другую задачу (вернёмся к стартовому вопросу)').flags.includes('метка длиннее 5 слов')],
    ['идентификатор с расшифровкой не считается голым',
      !gradeOption('FR-1 (юрист видит срок в карточке) — делаем первым').flags.includes('идентификатор без расшифровки')],
  ]
  let bad = 0
  for (const [label, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? '✔' : '✘'} ${label}`) }
  console.log(bad ? `\nСАМОПРОВЕРКА ПРОВАЛЕНА: ${bad}` : '\nсамопроверка пройдена')
  process.exit(bad ? 1 : 0)
}

// ─── CLI ───────────────────────────────────────────────────────────────────────────────────
// Охрана main-модуля. Без неё `import { optionsOf }` из соседнего грейдера запускал ЭТОТ CLI
// с чужим argv: `grade-propose.mjs --selftest` печатал самопроверку grade-options и выходил,
// своей не показав вовсе. Парсер вариантов здесь один на все счётчики намеренно (см. шапку),
// поэтому импорт обязан быть тихим. На прямой запуск охрана не влияет — числа те же.
const IS_MAIN = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].split('\\').join('/')}`).href
if (!IS_MAIN) { /* импорт: только экспорты, CLI молчит */ } else {
const argv = process.argv.slice(2)
if (argv.includes('--selftest')) selftest()

const corpusMode = argv.includes('--corpus')
const root = argv.filter((a) => !a.startsWith('--'))[0]
if (!root) { console.error('нужен путь (или --selftest)'); process.exit(1) }

/** Собирает тексты ходов: answer-NN.md, если есть, иначе answer.md. */
function turnsIn(dir, acc = []) {
  let ents
  try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  const files = ents.filter((e) => e.isFile()).map((e) => e.name)
  const numbered = files.filter((f) => /^answer-\d+\.md$/.test(f)).sort()
  const plain = files.filter((f) => f === 'answer.md')
  for (const f of (numbered.length ? numbered : plain)) {
    const text = readFileSync(join(dir, f), 'utf8')
    if (text.trim() && !RE_API_FAILURE.test(text)) acc.push({ file: join(dir, f), text })
  }
  for (const e of ents) if (e.isDirectory()) turnsIn(join(dir, e.name), acc)
  return acc
}

const turns = turnsIn(root)
const opts = []
for (const t of turns) for (const o of optionsOf(t.text)) opts.push({ file: t.file, ...gradeOption(o), text: o })

const N = opts.length
const bad = opts.filter((o) => o.flags.length)
console.log(`${corpusMode ? 'корпус' : 'плечо'}: ${root}`)
console.log(`ходов: ${turns.length}, вариантов: ${N}`)
if (!N) process.exit(0)
console.log(`МУДРЁНЫХ: ${bad.length}/${N} (${Math.round((100 * bad.length) / N)}%)`)
const byFlag = {}
for (const o of bad) for (const f of o.flags) byFlag[f] = (byFlag[f] || 0) + 1
for (const [k, v] of Object.entries(byFlag).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(Math.round((100 * v) / N)).padStart(3)}%  ${String(v).padStart(4)}  ${k}`)
}
const lens = opts.map((o) => o.len).sort((a, b) => a - b)
console.log(`длина варианта: медиана ${lens[Math.floor(lens.length / 2)]}, 90-й перцентиль ${lens[Math.floor(lens.length * 0.9)]} знаков`)

if (!corpusMode) {
  console.log('\n--- самые тяжёлые ---')
  for (const o of [...bad].sort((a, b) => b.len - a.len).slice(0, 8)) {
    console.log(`· ${o.text.slice(0, 150)}\n    [${o.flags.join(', ')}]`)
  }
}

}
