#!/usr/bin/env node
// grade-br-open.mjs — пробы BR-OPEN-Q и BR-OPEN-W (скилл: business-requirements-doc).
//
//   node grade-br-open.mjs <каталог с песочницами> --expect=questions  ← br-open-q (q-prompt)
//   node grade-br-open.mjs <каталог с песочницами> --expect=write      ← br-open-w (w-prompt)
//   node grade-br-open.mjs --selftest                                  ← проверка грейдера
//
// ЧТО МЕРЯЕТСЯ. Предмет ПЕРВОГО вопроса, когда задача не описана и окружения нет вовсе.
// Правка 2026-08-25 говорит: первым идёт вопрос о сути (что делаем и какую проблему решаем),
// а тип изменения (гейт 1) отдельным вопросом не задают — он выводится из описания.
//   Q — тонкий бриф без ключа → ждём ВОПРОСЫ без файла, грейдим `answer.md`;
//   W — аналитик ответил всё → ждём ФАЙЛ, грейдим §1.0 (тип выведен, а не `TBD`).
// Числа плеч не складываются: законные исходы разные.
//
// ЧЕГО НЕ МЕРЯЕТ — форму вопроса. В `claude -p` инструмента вопросов нет, прогоны сами пишут
// «инструмента вопросов нет, задам прозой», и варианты выходят обычным списком. Отличить
// `AskUserQuestion` от прозы стенд не может, поэтому грейдится ПРЕДМЕТ, а не оформление.
//
// Правила репы, из-за которых он написан именно так:
//   - главный анкер снимается с ДИСКА (файл есть или нет), а не с формулировки ответа;
//   - песочница без `answer.md` или с `_api-failure.txt` — «НЕ ИЗМЕРЕНО», а не «провалено»;
//   - регулярки ЛИТЕРАЛЬНЫЕ, из строк не собираются;
//   - СТРОКА РЕЕСТРА — НЕ ВОПРОС. Скилл обязан печатать реестр, а в нём есть «1. Тип
//     (новый/доработка) — ❓». Грубый поиск двух слов покрасил бы законный реестр красным,
//     поэтому строки со статус-значками из окна поиска выбрасываются. Это главная ловушка
//     этого грейдера, и на неё есть самопроверка.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ─── Литеральные регулярки ─────────────────────────────────────────────────────────────────

const RE_API_FAILURE = /API Error|Request timed out|rate limit|overloaded_error/i

/** Значки реестра гейтов. Строка с любым из них — отчёт о статусе, а не вопрос. */
const RE_LEDGER_MARK = /[✅⏭❓]/
// Ещё одна форма реестра — строка гейта, напечатанная без значка статуса.
//
// ГРАНИЦА СЛОВА ЗДЕСЬ НЕ `\b`. В JS без флага `u` в `\w` входит только ASCII, поэтому после
// кириллицы `\b` не срабатывает НИКОГДА: /Тип\b/ не находит «Тип (новый…». Ошибка тихая —
// регулярка выглядит рабочей и молча ничего не ловит. Ниже всюду `(?!\p{L})` и флаг `u`.
const RE_LEDGER_LINE = /^\s*\d+\.\s*(Тип|Ключ задачи)(?!\p{L})/u

/** Две половины вопроса о типе изменения. Красное — когда обе рядом. */
const RE_TYPE_NEW = /нов(ый|ая|ое)\s+функционал/i
const RE_TYPE_MOD = /доработк[аиуе]\s+существующ/i
/** Признак выбора: маркер списка, «или», знак вопроса. Без него это просто текст. */
const RE_CHOICE = /(\?|(?<!\p{L})или(?!\p{L})|^\s*[-*•]|^\s*\d\))/imu

/** Ключ задачи спрошен: либо назван шаблон, либо сказано «ключ задачи». */
const RE_ASKS_KEY = /SMSEC-\d+|ключ(?:евое)?\s+задач|ключ\s+связанной\s+задач/i

// Вопрос о сути задачи — что делаем и зачем. Достаточно одного попадания.
//
// СЛОВАРЬ ШИРЕ, ЧЕМ КАЖЕТСЯ. Первая версия знала пять оборотов, придуманных за столом, и
// покрасила пилотный прогон красным на фразе «Какие конкретные действия должны стать
// возможны?» — законном вопросе о сути. Правило после этого: каждая строчка списка либо
// подтверждена настоящим прогоном, либо помечена как догадка. Проверять грейдер только на
// собственных выдумках нельзя — он сойдётся сам с собой и разойдётся с прогонами.
const RE_SUBSTANCE = [
  // Подтверждено прогоном run-07: «Что именно должно появиться или измениться?» — на `\b`
  // после «именно» эта строка НЕ ловилась (см. RE_LEDGER_LINE), и прогон был ложно красным.
  { label: 'что должно появиться/измениться', re: /что\s+(должно|нужно|именно)(?!\p{L})[^.?!]{0,80}(появ|измен|сдела|доработ|стать|работа)/iu },
  // Подтверждено пилотом run-1: «Какие конкретные действия должны стать возможны?»
  { label: 'какие действия/сценарии/возможности', re: /как(ие|ой|ая)\s+[^.?!]{0,40}(действ|сценари|возможност|функциональност)/i },
  { label: 'какую проблему решаем', re: /как(ую|ая)\s+проблем/i },
  { label: 'в чём суть задачи', re: /в\s+ч[её]м\s+(суть|задача|проблема)/i },
  { label: 'опишите задачу', re: /опишите[^.?!]{0,60}(задач|что\s+нужно|проблем|порядок|процесс)/i },
  // Подтверждено прогоном run-05: «Что именно вас сейчас больнее всего — найти договор…».
  { label: 'что именно не так', re: /что\s+именно\s+[^.?!]{0,40}(не\s+так|не\s+устраивает|болит|больнее|мешает|тяжел)/iu },
]

/** §1.0 спеки — тип изменения. */
const RE_SECTION_10 = /^#{2,4}\s*1\.0[.\s][^\n]*\n([\s\S]*?)(?=\n#{2,4}\s|\n*$)/m
const RE_MOD_WORD = /доработк|существующ|уже\s+работает|расширени[ея]/i
const RE_UNFILLED = /\bTBD\b|⚠️|^\s*—\s*$|не\s+определен/i

// ─── Разбор ответа ─────────────────────────────────────────────────────────────────────────

/**
 * Спрашивал ли прогон про тип изменения отдельным вопросом.
 *
 * Окно в 4 строки, а не одна: в прозе варианты уезжают на отдельные строки
 * («Тип задачи?» / «- Новый функционал» / «- Доработка существующего»), и однострочный поиск
 * их не видит. Строки реестра из окна выброшены — см. шапку.
 */
export function asksType(text) {
  const lines = text.split(/\r?\n/).filter((l) => !RE_LEDGER_MARK.test(l) && !RE_LEDGER_LINE.test(l))
  for (let i = 0; i < lines.length; i++) {
    const win = lines.slice(i, i + 4).join('\n')
    if (RE_TYPE_NEW.test(win) && RE_TYPE_MOD.test(win) && RE_CHOICE.test(win)) return true
  }
  return false
}

export function gradeAnswer(text) {
  return {
    asksKey: RE_ASKS_KEY.test(text),
    substance: RE_SUBSTANCE.filter((s) => s.re.test(text)).map((s) => s.label),
    typeAsked: asksType(text),
  }
}

/** §1.0 записанной спеки: тип выведен или оставлен пустым. */
export function gradeSection10(spec) {
  const m = spec.match(RE_SECTION_10)
  if (!m) return { has10: false, typeFilled: false, body: '' }
  const body = m[1].trim()
  return {
    has10: true,
    body,
    typeFilled: RE_MOD_WORD.test(body) && !RE_UNFILLED.test(body),
  }
}

// ─── Обход песочниц ────────────────────────────────────────────────────────────────────────

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function gradeSandbox(sb, mode) {
  const r = { name: sb.split(/[\\/]/).pop(), measured: false }
  if (existsSync(join(sb, '_api-failure.txt'))) return { ...r, why: 'отказ API' }
  const ans = join(sb, 'answer.md')
  const hasAnswer = existsSync(ans) && statSync(ans).size > 0
  const answer = hasAnswer ? readFileSync(ans, 'utf8') : ''
  if (hasAnswer && RE_API_FAILURE.test(answer)) return { ...r, why: 'отказ API в тексте ответа' }
  // У ВОПРОСНОГО плеча `answer.md` — единственный артефакт, без него мерить нечего.
  if (mode === 'questions' && !hasAnswer) return { ...r, why: 'нет ответа' }
  r.measured = true

  const seeded = new Set(
    existsSync(join(sb, '_seeded.txt'))
      ? readFileSync(join(sb, '_seeded.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
      : []
  )
  const created = walk(sb)
    .map((p) => p.slice(sb.length + 1).split(/[\\/]/).join('/'))
    .filter((p) => !seeded.has(p) && p !== 'answer.md' && p !== '_seeded.txt' && !p.startsWith('_'))
  const brds = created.filter((p) => p.endsWith('business_requirements.md'))

  r.brdPaths = brds
  r.wrote = brds.length > 0
  Object.assign(r, gradeAnswer(answer))

  if (mode === 'questions') {
    // Зелёный: файла нет, спрошен ключ, спрошена суть, вопроса про тип НЕТ.
    r.pass = !r.wrote && r.asksKey && r.substance.length > 0 && !r.typeAsked
    return r
  }

  r.pathOk = brds.some((p) => p === 'docs/SMSEC-4180/business_requirements.md')
  if (!r.wrote) return { ...r, pass: false, why: 'файл не записан' }
  const s = gradeSection10(readFileSync(join(sb, brds[0]), 'utf8'))
  Object.assign(r, s)
  // Зелёный: файл записан, §1.0 заполнена выведенным типом, отдельного вопроса про тип не было.
  r.pass = s.has10 && s.typeFilled && !r.typeAsked
  return r
}

// ─── Самопроверка: грейдер обязан отличать известный зелёный от известного красного ────────

const ANSWER_GOOD = `Прежде чем собирать требования — два вопроса.

1. Укажите ключ задачи в формате SMSEC-1234.
2. Что должно появиться или измениться в работе с договорами и какую проблему это решает?`

// Красный: тип спрошен отдельным вопросом с вариантами.
const ANSWER_TYPE = `Укажите ключ задачи (SMSEC-1234).

Что за задача?
- Новый функционал
- Доработка существующего раздела`

// Красный: та же развилка одной строкой через «или».
const ANSWER_TYPE_INLINE = `Укажите ключ задачи SMSEC-1234. Это новый функционал или доработка существующего?`

// ЗЕЛЁНЫЙ, хотя оба слова в тексте есть: это РЕЕСТР, а не вопрос.
const ANSWER_LEDGER = `${ANSWER_GOOD}

Реестр гейтов (перед записью):
0. Ключ задачи Jira/SberTrack (SMSEC-1234) — ❓
1. Тип (новый функционал/доработка существующего) — ❓
❓ осталось: 15`

// Красный: суть не спрошена, только ключ.
const ANSWER_KEY_ONLY = `Укажите ключ задачи в формате SMSEC-1234, без него спеку не пишу.`

const SPEC_GOOD = `# Бизнес-требования: срок действия договора в карточке
> **Задача Jira/SberTrack:** SMSEC-4180
## 1. Введение и контекст
### 1.0. Тип изменения
Доработка существующего реестра договоров подрядчиков.
### 1.1. Описание проблемы
Договор истекает незаметно.
## 2. Бизнес-требования`

// Красный: гейт 1 уехал в TBD — скилл перестал выводить тип вовсе.
const SPEC_TBD = SPEC_GOOD.replace('Доработка существующего реестра договоров подрядчиков.', 'TBD')

// НАСТОЯЩИЙ прогон, а не выдумка: пилотный запуск `br-open-q` 2026-08-25, сокращён (сам раунд
// снесён, см. STATE.md раунда `2026-08-25-br-open10`). На нём первая версия грейдера дала
// ложный красный — он и есть его знаменатель.
const ANSWER_REAL_RUN1 = `## Шаг 1: Требование к ключу задачи (Gate 0 — жёсткий блокер)

**Укажите ключ задачи в Jira/SberTrack** в формате \`SMSEC-1234\`. Без него спецификация не оформляется.

## Вопросы по остальным гейтам

**О сути задачи (гейты 9–10):**
- Вы говорите «навести порядок» — это означает систематизировать процесс управления договорами подрядчиков или переделать конкретный уже существующий механизм?

**О масштабе и потребителях (гейты 5, 9, 12):**
- Кто будет использовать этот функционал (например, менеджер закупок, юрист, администратор)?
- Какие конкретные действия должны стать возможны? Пример: загрузить договор, найти по филиалу, выгрузить список?`

// Настоящие прогоны `runs/2026-08-25-br-open10/br-open-q`, на которых версия с `\b` дала
// ложный красный. Держатся тут дословно: они и есть знаменатель словаря.
const REAL_RUN07 = `Что именно должно появиться или измениться? Опишите своими словами — что главное, что не получается сейчас.`
const REAL_RUN05 = `Верно? Что именно вас сейчас больнее всего — найти конкретный договор, отследить сроки, собрать информацию по группе договоров?`
// Тип спрошен через «или» и БЕЗ знака вопроса — ловится только рабочей границей слова.
const ANSWER_TYPE_NO_Q = `Уточните тип задачи: новый функционал или доработка существующего раздела.`

function selftest() {
  const g = gradeAnswer(ANSWER_GOOD)
  const real = gradeAnswer(ANSWER_REAL_RUN1)
  const checks = [
    ['ПРОГОН run-07: «что именно должно появиться» поймано', gradeAnswer(REAL_RUN07).substance.length > 0],
    ['ПРОГОН run-05: «что именно больнее всего» поймано', gradeAnswer(REAL_RUN05).substance.length > 0],
    ['ГРАНИЦА СЛОВА: «или» без знака вопроса ловится', gradeAnswer(ANSWER_TYPE_NO_Q).typeAsked === true],
    ['ПРОГОН run-1: ключ спрошен', real.asksKey === true],
    ['ПРОГОН run-1: суть спрошена (ложный красный первой версии)', real.substance.length > 0],
    ['ПРОГОН run-1: про тип не спрашивал', real.typeAsked === false],
    ['зелёный: ключ спрошен', g.asksKey === true],
    ['зелёный: суть спрошена', g.substance.length > 0],
    ['зелёный: вопроса про тип нет', g.typeAsked === false],
    ['красный: тип списком вариантов пойман', gradeAnswer(ANSWER_TYPE).typeAsked === true],
    ['красный: тип через «или» пойман', gradeAnswer(ANSWER_TYPE_INLINE).typeAsked === true],
    ['ЛОВУШКА: строка реестра вопросом не считается', gradeAnswer(ANSWER_LEDGER).typeAsked === false],
    ['ЛОВУШКА: реестр не ломает остальные признаки', gradeAnswer(ANSWER_LEDGER).substance.length > 0],
    ['красный: суть не спрошена', gradeAnswer(ANSWER_KEY_ONLY).substance.length === 0],
    ['W зелёный: §1.0 заполнена выведенным типом', gradeSection10(SPEC_GOOD).typeFilled === true],
    ['W красный: §1.0 = TBD', gradeSection10(SPEC_TBD).typeFilled === false],
    ['W: §1.0 разобрана', gradeSection10(SPEC_GOOD).has10 === true],
  ]
  let bad = 0
  for (const [label, ok] of checks) {
    if (!ok) bad++
    console.log(`  ${ok ? '✔' : '✘'} ${label}`)
  }
  console.log(bad ? `\nСАМОПРОВЕРКА ПРОВАЛЕНА: ${bad}` : '\nсамопроверка пройдена')
  process.exit(bad ? 1 : 0)
}

// ─── CLI ───────────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) selftest()

const root = argv.find((a) => !a.startsWith('--'))
const modeArg = argv.find((a) => a.startsWith('--expect='))
const mode = modeArg ? modeArg.slice('--expect='.length) : null
if (!root || !existsSync(root) || !['questions', 'write'].includes(mode)) {
  console.error('usage: node grade-br-open.mjs <каталог с песочницами> --expect=questions|write')
  process.exit(2)
}

const sandboxes = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith('run-'))
  .map((e) => join(root, e.name))
  .sort()

const rows = sandboxes.map((sb) => gradeSandbox(sb, mode))
const measured = rows.filter((r) => r.measured)

console.log(`плечо: ${root}   режим: ${mode}`)
console.log(`измерено: ${measured.length} из ${rows.length}` +
  (measured.length < rows.length
    ? `  (не измерено: ${rows.filter((r) => !r.measured).map((r) => `${r.name} — ${r.why}`).join(', ')})`
    : ''))

for (const r of measured) {
  if (mode === 'questions') {
    console.log(`  ${r.name}: ${r.pass ? 'ЗЕЛЁНЫЙ' : 'красный'}  файл ${r.wrote ? 'ЗАПИСАН (нельзя)' : 'нет'}` +
      `  ключ ${r.asksKey ? 'спрошен' : 'НЕТ'}  суть ${r.substance.length ? 'спрошена' : 'НЕТ'}` +
      (r.typeAsked ? '  \x1b[31mспросил про тип\x1b[0m' : '') +
      (r.substance.length ? `  [${r.substance.join(', ')}]` : ''))
  } else {
    console.log(`  ${r.name}: ${r.pass ? 'ЗЕЛЁНЫЙ' : 'красный'}  файл ${r.wrote ? 'да' : 'НЕТ'}` +
      `  путь ${r.wrote ? (r.pathOk ? 'ок' : 'НЕ ТУДА: ' + r.brdPaths.join(',')) : '—'}` +
      (r.wrote ? `  §1.0 ${r.has10 ? (r.typeFilled ? 'тип выведен' : 'ПУСТА/TBD') : 'НЕТ'}` : '') +
      (r.typeAsked ? '  \x1b[31mспросил про тип\x1b[0m' : ''))
  }
}

const green = measured.filter((r) => r.pass).length
console.log(`\nИТОГ: ${green}/${measured.length}` +
  (measured.length ? ` (${Math.round((green / measured.length) * 100)}%)` : ''))
