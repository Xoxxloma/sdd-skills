#!/usr/bin/env node
// grade-sb.mjs — проба SB-CTX: теряется ли работа, спрятанная за пометкой 🟡.
//
//   node grade-sb.mjs <каталог с песочницами>
//   node grade-sb.mjs --selftest
//
// ЧТО МЕРЯЕТСЯ. `stage-breakdown-doc` Step 1 берёт в инвентарь только 🟢 INT-карточки и новые
// сущности §3.2; 🟡 объявлена «стыком извне, который в этой работе никто не создаёт». На спеке
// SMSEC-420 это значит: INT-1 (отправка уведомления в СЦБ) в инвентарь не попадает, и этапа с
// таким выходом в разрезе нет — хотя §3.1 спеки прямым текстом поручает НАМ сформировать тело
// запроса, отправить и решить про повторы.
//
// Правила репы, из-за которых грейдер написан именно так:
//   - грейдится артефакт (ответ прогона), а не пересказ; `_api-failure.txt` → «не измерено»;
//   - регулярки литеральные;
//   - главный анкер снимается с ИМЕНИ этапа, а не с любого упоминания СЦБ в тексте: стык,
//     названный ВХОДОМ этапа, — это ровно тот случай, который проба считает потерей работы,
//     и он обязан оставаться красным. Ловушка проверена самопроверкой (см. ANSWER_TRAP).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

/**
 * Настоящий отказ CLI — это ВЕСЬ вывод прогона: короткий и с маркером в начале. Слова
 * `rate limit` в тексте спеки отказом не являются. Замер 2026-08-14: два прогона `ts-ctx` из
 * десяти написали «429 (rate limit)» и молча выпали из знаменателя — а это ровно те прогоны,
 * что перенесли больше чужой конкретики, то есть стенд врал в пользу скилла.
 */
function isApiFailure(text) {
  if (!text) return false
  return text.length < 600 ? RE_API_FAILURE.test(text) : RE_API_FAILURE.test(text.slice(0, 200))
}

/** Начало блока этапа: заголовок, пункт списка или строка таблицы. */
const RE_STAGE_START = /^\s*[#>*\-|\s]*(?:\*\*)?\s*(?:Этап|ЭТАП|Stage|stage)[-\s]*№?\s*0?\d/

/**
 * Работа, о потере которой проба. Голого «уведомления» здесь нет намеренно: наша собственная
 * сущность называется «журнал уведомлений», и этап «Хранение журнала уведомлений» прошёл бы
 * зелёным, не имея к отправке никакого отношения (поймано самопроверкой на ANSWER_RED).
 * Анкер — либо имя чужой системы, либо глагол отправки.
 */
const RE_SEND_WORK = /СЦБ|отправк|отправл|передач[аи]\s+событ|публикац/i
/** Механика этой работы — её называют, когда действительно берут в этап. */
const RE_SEND_MECH = /фонов\w*\s+задач|воркер|outbox|повтор|ретрай|retry|идемпотент/i
/** Формулы «это не наша работа», которыми скилл выносит 🟡 из инвентаря. */
const RE_EXTERNAL = /извне|внешн|не входит в инвентарь|не создаёт|не создаем|не создаём|уже (?:есть|работает|реализован)/i

/**
 * Отсутствие поля «Наша сторона» названо вслух. Для СТАРОЙ спеки (написанной до правки
 * 2026-08-14, в её шаблоне поля не было) это и есть зелёный исход: разрез не может завести этап
 * под работу, которой в спеке нет, но обязан не потерять её молча — у скилла для этого есть
 * своя дверь, «нужного в спеке нет → возврат в technical-spec-doc».
 */
const RE_FIELD_MISSING = /наша сторона/i
const RE_MISSING_WORD = /нет|отсутству|не заполнен|не указан|не назван|пуст/i

/**
 * Имена этапов. Для строки таблицы берём только первые две ячейки (номер и имя): в остальных
 * стоят «Вход» и «Выход», и стык, названный ВХОДОМ, дал бы ложный зелёный — этап-потребитель
 * работу не создаёт, а проба меряет именно создание.
 */
export function stageTitles(text) {
  const lines = text.split(/\r?\n/)
  const titles = []
  for (const line of lines) {
    if (!RE_STAGE_START.test(line)) continue
    if (line.trimStart().startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '')
      titles.push(cells.slice(0, 2).join(' '))
    } else {
      titles.push(line.replace(/^[#>*\-\s]+/, ''))
    }
  }
  return titles
}

/**
 * Строки, в которых этап описывает СВОЮ работу и свой выход. Строку «Вход» сюда включать
 * нельзя: стык, названный входом, — это ровно случай потери работы.
 */
const RE_WORK_LINE = /^[\s\-*|>]*\*{0,2}(Работа|Что делает|Делает|Выход|Содержание|Задачи|Результат)/i

/**
 * Блоки этапов: заголовок + строки до следующего заголовка этапа. Нужны, чтобы отличить
 * «стык стоит во ВХОДЕ этапа» от «этап эту работу делает».
 */
export function stageBlocks(text) {
  const lines = text.split(/\r?\n/)
  const blocks = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!RE_STAGE_START.test(lines[i])) continue
    const body = []
    for (let j = i + 1; j < lines.length && j <= i + 10; j += 1) {
      if (RE_STAGE_START.test(lines[j])) break
      body.push(lines[j])
    }
    blocks.push({ title: lines[i], body })
  }
  return blocks
}

export function gradeAnswer(text) {
  const titles = stageTitles(text)
  const sendStage = titles.filter((t) => RE_SEND_WORK.test(t))
  const lines = text.split(/\r?\n/)
  const saysFieldMissing = lines.some((l) => RE_FIELD_MISSING.test(l) && RE_MISSING_WORD.test(l))
  // ГЛАВНЫЙ АНКЕР — не имя этапа, а его работа.
  //
  // Разбор базового замера 2026-08-14 показал, что имя решает не то: прогон назвал единственный
  // этап «Логирование отправок и получение журнала», INT-1 записал во «Вход» со словами
  // «производится внешней системой», — а в строке «Работа» у него стоит «инициировать отправку
  // в СЦБ». Исполнитель, читающий такой файл этапа, отправку напишет. Работа не потеряна, хотя
  // владение оформлено неверно. Считать это красным значит мерить формулировку, а не судьбу
  // работы; поэтому pass ставится по строке работы, а владение остаётся отдельным счётчиком.
  const workOwned = stageBlocks(text).some((b) =>
    b.body.some((l) => RE_WORK_LINE.test(l) && RE_SEND_WORK.test(l) && /СЦБ|уведомлен/i.test(l)))
  return {
    saysFieldMissing,
    stages: titles.length,
    sendStage,
    workOwned,
    // Владение оформлено явно: работа названа в имени этапа.
    sendOwned: sendStage.length > 0,
    // INT-1 явно вынесена из инвентаря — правило применено механически.
    int1External: text.split(/\r?\n/).some((l) => /INT-1/.test(l) && RE_EXTERNAL.test(l)),
    // Механика отправки названа хоть где-то: слабый признак, что работа не забыта совсем.
    mechMentioned: RE_SEND_MECH.test(text),
  }
}

function walk(dir, base = dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, base, acc)
    else acc.push(p.slice(base.length + 1).split('\\').join('/'))
  }
  return acc
}

function gradeSandbox(sb) {
  const r = { name: sb.split(/[\\/]/).pop(), measured: false }
  if (existsSync(join(sb, '_api-failure.txt'))) return { ...r, why: 'отказ API' }
  const ans = join(sb, 'answer.md')
  if (!existsSync(ans) || statSync(ans).size === 0) return { ...r, why: 'нет ответа' }
  const answer = readFileSync(ans, 'utf8')
  if (isApiFailure(answer)) return { ...r, why: 'отказ API в тексте ответа' }
  r.measured = true

  const seeded = new Set(
    existsSync(join(sb, '_seeded.txt'))
      ? readFileSync(join(sb, '_seeded.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
      : []
  )
  const created = walk(sb).filter(
    (p) => !seeded.has(p) && p !== 'answer.md' && p !== '_seeded.txt' && !p.startsWith('_')
  )
  // Правило самого скилла: «turn 1 = questions only. No file». Отдельный счётчик, не главный
  // анкер: файлы первым ходом — другой дефект, чем потеря работы.
  r.wroteStages = created.some((p) => /stages\//.test(p))
  Object.assign(r, gradeAnswer(answer))
  // `--legacy` — спека написана по шаблону БЕЗ поля «Наша сторона». Завести этап под работу,
  // которой в спеке нет, скилл не может и не должен; зелёный здесь — назвать пропажу.
  // Работа доехала до исполнителя — либо этапом-владельцем, либо строкой работы внутри этапа.
  // На СТАРОЙ спеке (`--legacy`, поля «Наша сторона» в ней нет) зелёным считается ещё и
  // названная вслух пропажа поля: этап завести не из чего, но потеря перестала быть молчаливой.
  const delivered = r.sendOwned || r.workOwned
  r.pass = LEGACY ? (delivered || r.saysFieldMissing) : delivered
  return r
}

const LEGACY = process.argv.includes('--legacy')

// ─── Самопроверка ──────────────────────────────────────────────────────────────────────────

const ANSWER_GREEN_TABLE = `Инвентарь стыков: INT-2, «NotificationLog» — стыков 2.
Стыки ИЗВНЕ: INT-1 (контракт СЦБ, 🟡 к валидации) — уже реализован на их стороне.

| Этап | Название | Выход | Проверка |
|---|---|---|---|
| Этап 01 | Журнал уведомлений: сущность и запись | таблица notification_logs | вставка строки |
| Этап 02 | Отправка события в СЦБ с повторами | фоновая задача отправки | подготовленный инцидент |
| Этап 03 | Эндпоинт журнала для карточки | INT-2 | запрос с ролью |

Подтверждаете состав?`

const ANSWER_GREEN_HEADING = `Инвентарь: стыков 2 — INT-2 и «NotificationLog».
INT-1 — стык извне.

**Этап 01. Журнал попыток**
Выход: сущность NotificationLog.

**Этап 02. Фоновая отправка уведомлений в СЦБ**
Выход: воркер, повторы, идемпотентность по eventId.`

const ANSWER_RED = `Инвентарь стыков считаю механически: 🟢 INT-2 и новая сущность «NotificationLog» — стыков 2.
Стыки ИЗВНЕ (в инвентарь не входят): INT-1 — контракт СЦБ, 🟡 к валидации, в этой работе его никто не создаёт.

| Этап | Название | Выход |
|---|---|---|
| Этап 01 | Хранение журнала уведомлений | сущность NotificationLog |
| Этап 02 | Эндпоинт журнала | INT-2 |

Подтверждаете?`

// ЛОВУШКА: стык назван ВХОДОМ этапа. Работа по-прежнему ничья — это красный.
const ANSWER_TRAP = `Инвентарь: стыков 2.
INT-1 — стык извне, не входит в инвентарь.

| Этап | Название | Вход | Выход |
|---|---|---|---|
| Этап 01 | Хранение журнала | результат отправки в СЦБ (INT-1) | NotificationLog |
| Этап 02 | Эндпоинт журнала | NotificationLog | INT-2 |`

function selftest() {
  const g1 = gradeAnswer(ANSWER_GREEN_TABLE)
  const g2 = gradeAnswer(ANSWER_GREEN_HEADING)
  const r1 = gradeAnswer(ANSWER_RED)
  const t1 = gradeAnswer(ANSWER_TRAP)
  const checks = [
    ['зелёный (таблица): этап отправки найден', g1.sendOwned === true],
    // Работа в строке «Работа» этапа считается доставленной, даже если имя этапа про другое.
    ['работа в строке «Работа» засчитана',
      gradeAnswer('**Этап 01 — «Журнал уведомлений»**\n- Владеет: NotificationLog\n- Работа: создать запись и инициировать отправку в СЦБ').workOwned === true],
    ['стык во ВХОДЕ работой не считается',
      gradeAnswer('**Этап 01 — «Журнал»**\n- Владеет: NotificationLog\n- Вход: INT-1 (отправка в СЦБ), производится внешней системой').workOwned === false],
    ['зелёный (таблица): этапов насчитано 3', g1.stages === 3],
    ['зелёный (заголовки): этап отправки найден', g2.sendOwned === true],
    ['красный: этапа отправки нет', r1.sendOwned === false],
    // Наша сущность зовётся «журнал уведомлений»: слово «уведомление» в имени этапа
    // доказательством отправки не является.
    ['красный: «Хранение журнала уведомлений» за отправку не засчитано',
      stageTitles(ANSWER_RED).some((t) => /уведомлен/i.test(t)) && r1.sendOwned === false],
    ['красный: INT-1 опознана как вынесенная извне', r1.int1External === true],
    ['ЛОВУШКА: стык во ВХОДЕ этапа зелёным не считается', t1.sendOwned === false],
    ['ловушка: этапы при этом посчитаны', t1.stages === 2],
    ['пропажа поля «Наша сторона» опознана',
      gradeAnswer('У INT-1 поле «Наша сторона» не заполнено — возвращаю в technical-spec-doc.').saysFieldMissing === true],
    ['обычный ответ пропажей поля не считается', r1.saysFieldMissing === false],
  ]
  let bad = 0
  for (const [name, ok] of checks) {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`)
    if (!ok) bad += 1
  }
  console.log(bad === 0 ? '\nсамопроверка пройдена' : `\nсамопроверка ПРОВАЛЕНА: ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

if (process.argv.includes('--selftest')) selftest()

const ROOT = process.argv[2]
if (!ROOT) {
  console.error('usage: node grade-sb.mjs <каталог с песочницами>')
  console.error('       node grade-sb.mjs --selftest')
  process.exit(2)
}

const dirs = readdirSync(ROOT).filter((n) => /^run-/.test(n)).sort()
const rows = dirs.map((d) => gradeSandbox(join(ROOT, d)))
const measured = rows.filter((r) => r.measured)

console.log(`плечо: ${ROOT}`)
console.log(`измерено: ${measured.length} из ${rows.length}`)
for (const r of rows) {
  if (!r.measured) { console.log(`  ${r.name}: НЕ ИЗМЕРЕНО (${r.why})`); continue }
  const mark = r.pass ? 'ЗЕЛЁНЫЙ' : 'красный'
  const bits = [
    `этапов ${r.stages}`,
    r.sendOwned ? `этап отправки: ${r.sendStage[0]}` : 'этапа отправки НЕТ',
    r.int1External ? 'INT-1 вынесена извне' : '',
    r.mechMentioned ? '' : 'механика отправки не названа',
    r.wroteStages ? 'ФАЙЛЫ ЗАПИСАНЫ ПЕРВЫМ ХОДОМ' : '',
  ].filter(Boolean)
  console.log(`  ${r.name}: ${mark}  ${bits.join('  ')}`)
}

const pct = (n) => `${n} (${measured.length ? Math.round((n / measured.length) * 100) : 0}%)`
console.log('\nСЧЁТЧИКИ (из измеренных):')
console.log(`  ${pct(measured.filter((r) => !r.sendOwned && !r.workOwned).length)}\tработа «отправка в СЦБ» не доехала НИКАК: ни этапом, ни строкой работы (главный дефект)`)
console.log(`  ${pct(measured.filter((r) => !r.sendOwned).length)}\tиз них и просто без этапа-владельца (имя этапа про другое)`)
console.log(`  ${pct(measured.filter((r) => r.saysFieldMissing).length)}\tпропажа поля «Наша сторона» названа вслух${LEGACY ? ' (на старой спеке это зелёный исход)' : ''}`)
console.log(`  ${pct(measured.filter((r) => r.int1External).length)}\tINT-1 вынесена из инвентаря как стык извне`)
console.log(`  ${pct(measured.filter((r) => !r.mechMentioned).length)}\tповторы/фоновая задача не названы нигде`)
console.log(`  ${pct(measured.filter((r) => r.wroteStages).length)}\tфайлы этапов записаны первым ходом (нарушение правила скилла)`)
console.log(`  ${pct(measured.filter((r) => r.pass).length)}\tзелёных`)
