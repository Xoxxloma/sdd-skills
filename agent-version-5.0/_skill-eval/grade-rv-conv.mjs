#!/usr/bin/env node
// grade-rv-conv.mjs — проба RV-CONV: находит ли приёмка промах 🟢-контракта против `context/`.
//
//   node grade-rv-conv.mjs <каталог с песочницами>
//   node grade-rv-conv.mjs --selftest
//
// ЧТО МЕРЯЕТСЯ. `PLAN-CONTEXT.md`, шаг 3: правило формы из `context/conventions.md` применяют не
// все прогоны `technical-spec-doc`, а растить пишущий скилл нельзя. Нагрузка кладётся на приёмку.
// Фикстура `RV-CONV` — спека, чистая по всем 11 пунктам чек-листа, с ТРЕМЯ отступлениями от
// `context/conventions.md`. Критерий шага: промах назван ≥8 прогонов из 10.
//
// Правила репы, из-за которых он написан именно так:
//   - артефакт приёмки — `answer.md` из stdout: скилл по правилу ничего не пишет на диск;
//   - песочница без `answer.md` или с `_api-failure.txt` — «НЕ ИЗМЕРЕНО», а не «провалено»;
//   - регулярки ЛИТЕРАЛЬНЫЕ, из строк не собираются;
//   - анкер неугадываем: `/v1/`, `asOf`, `camelCase`, `403` в отчёте об ЭТОЙ спеке взяться могут
//     только из `context/conventions.md` — в самой спеке ни одной из этих строк нет.

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// ─── Литеральные регулярки ──────────────────────────────────────────────────────────────────

/** Промах 1 — путь без версии. В спеке стоит `GET /rooms/occupancy`; `/v1/` есть только в правиле. */
const RE_FIX_PATH = /\/v1\//
const RE_PATH_CITED = /\/rooms\/occupancy/

/** Промах 2 — `as_of: timestamp`: не `camelCase`, без суффикса `At`, без `iso8601`. */
const RE_FIELD_CITED = /as_of/
const RE_FIX_FIELD = /asOf|camelCase|iso8601|суффикс/i

/** Промах 3 — `401` при отказе по роли. `403` в спеке не встречается ни разу. */
const RE_FIX_CODE = /\b403\b/
const RE_CODE_CITED = /\b401\b/

/**
 * Ложное срабатывание пункта 12: конвенции применены к ЧУЖОЙ карточке. Ловится не упоминанием
 * INT-2 — его упоминают и по делу, — а соседством чужой карточки с токеном правил в одной строке.
 *
 * ДЕФЕКТ ГРЕЙДЕРА, найденный на базе 2026-08-14: было `\/api\/v2\/calendar|INT-2`, и счётчик
 * давал 3 из 5 на прогонах, где INT-2 названа по пункту 1 (конкретика под 🟡) и про конвенции не
 * сказано ни слова. Анкер обязан прослеживаться до строки, которую он проверяет.
 */
const RE_FALSE_ALIEN = /^.*(?:INT-2|\/api\/v2\/calendar).*(?:\/v1\/|camelCase|iso8601|конвенц|context\/).*$/mi
const RE_FALSE_BUSYUNTIL = /^.*busyUntil.*(?:нарушени|исправ|привед|перепиш|→).*$/mi

/**
 * Пункт 1 чек-листа сработал на метке «🟡 подтверждено аналитиком», где конкретика законна и
 * уходит в счётную строку. К пункту 12 отношения не имеет — считается отдельно, чтобы не
 * приписывать этому раунду чужой шум.
 */
const RE_ITEM1_ON_CONFIRMED = /\/api\/v2\/calendar/

/** Отчёт приёмки вообще состоялся: строка формата. */
const RE_REPORT = /нарушени[йя][:*\s]*\d+|чек-лист прочитан/i
const RE_VIOLATIONS = /нарушений[:*\s]+(\d+)/i

// ─── Разбор одной песочницы ─────────────────────────────────────────────────────────────────

function gradeOne (dir) {
  const answerPath = join(dir, 'answer.md')
  const failPath = join(dir, '_api-failure.txt')
  if (existsSync(failPath)) return { measured: false, why: 'отказ API' }
  if (!existsSync(answerPath)) return { measured: false, why: 'нет answer.md' }
  const text = readFileSync(answerPath, 'utf8')
  if (!text.trim()) return { measured: false, why: 'пустой answer.md' }

  const hitPath = RE_FIX_PATH.test(text) && RE_PATH_CITED.test(text)
  const hitField = RE_FIELD_CITED.test(text) && RE_FIX_FIELD.test(text)
  const hitCode = RE_FIX_CODE.test(text) && RE_CODE_CITED.test(text)

  const m = text.match(RE_VIOLATIONS)
  return {
    measured: true,
    hitPath,
    hitField,
    hitCode,
    found: hitPath || hitField || hitCode,
    all3: hitPath && hitField && hitCode,
    report: RE_REPORT.test(text),
    falseAlien: RE_FALSE_ALIEN.test(text),
    falseBusyUntil: RE_FALSE_BUSYUNTIL.test(text),
    item1OnConfirmed: RE_ITEM1_ON_CONFIRMED.test(text),
    violations: m ? Number(m[1]) : null,
  }
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────────────────

function selftest () {
  const cases = [
    ['пусто', '', { measured: false }],
    ['нашёл путь', 'нарушений: 1\n1. INT-1 — «GET /rooms/occupancy» → путь без /v1/', { found: true, hitPath: true, hitField: false, hitCode: false }],
    ['нашёл поле', 'нарушений: 1\n«as_of: timestamp» → по конвенции camelCase и суффикс At', { found: true, hitField: true, hitPath: false }],
    ['нашёл код', 'нарушений: 1\n«401 — у роли нет права» → по конвенции 403', { found: true, hitCode: true }],
    ['все три', 'нарушений: 3\n/rooms/occupancy без /v1/; as_of вместо asOf; 401 вместо 403', { found: true, all3: true }],
    ['чистый отчёт', 'чек-лист прочитан, тип: тех-спецификация\nнарушений: 0', { found: false, report: true, violations: 0 }],
    ['ложное на чужой карточке', 'нарушений: 1\nINT-2: GET /api/v2/calendar/events — не по конвенции /v1/', { found: false, falseAlien: true }],
    ['INT-2 по пункту 1 — НЕ ложное', 'нарушений: 1\n1. §2 INT-2 — конкретный путь под 🟡\n«GET /api/v2/calendar/events»', { falseAlien: false, item1OnConfirmed: true }],
    ['жирная разметка в счёте', '**нарушений:** 2\n«as_of» → нужен asOf', { violations: 2, report: true, found: true }],
    ['403 без цитаты 401 не засчитывается', 'нарушений: 0\nобщие правила: 403 для ролей соблюдены', { hitCode: false, found: false }],
  ]
  let bad = 0
  for (const [name, text, want] of cases) {
    const tmp = join(process.env.TMPDIR || '/tmp', `rvconv-selftest-${name.replace(/\W+/g, '-')}`)
    mkdirSync(tmp, { recursive: true })
    if (text) writeFileSync(join(tmp, 'answer.md'), text, 'utf8')
    const got = gradeOne(tmp)
    for (const [k, v] of Object.entries(want)) {
      if (got[k] !== v) { console.log(`  ✗ ${name}: ${k} = ${got[k]}, ждали ${v}`); bad += 1 }
    }
    rmSync(tmp, { recursive: true, force: true })
  }
  console.log(bad === 0 ? 'самопроверка: ок' : `самопроверка: ПРОВАЛЕНА, расхождений ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ─── Плечо ──────────────────────────────────────────────────────────────────────────────────

// `--clean` — сторожевое плечо `RV-CLEAN`: документ чистый, папки `context/` нет вовсе.
// Критерий переворачивается: зелёный — «нарушений: 0». Любая находка здесь либо ложное
// срабатывание пункта 12 там, где его предмета нет, либо уход субагента за пределы артефакта
// по новому пути к корню репозитория.
const CLEAN = process.argv.includes('--clean')

const arg = process.argv[2]
if (arg === '--selftest') selftest()
if (!arg) { console.error('usage: node grade-rv-conv.mjs <каталог с песочницами> | --selftest'); process.exit(1) }
if (!existsSync(arg)) { console.error(`нет каталога: ${arg}`); process.exit(1) }

const runs = readdirSync(arg)
  .filter(n => /^run-\d+$/.test(n))
  .filter(n => statSync(join(arg, n)).isDirectory())
  .sort()

console.log(`плечо: ${arg}   проба: rv-conv`)
const rows = runs.map(n => [n, gradeOne(join(arg, n))])
const measured = rows.filter(([, r]) => r.measured)

for (const [n, r] of rows) {
  if (!r.measured) { console.log(`  ${n}: НЕ ИЗМЕРЕНО (${r.why})`); continue }
  const hits = [r.hitPath && 'путь', r.hitField && 'поле', r.hitCode && 'код'].filter(Boolean)
  const flags = [
    r.falseAlien && 'ЛОЖНОЕ:чужая карточка',
    r.falseBusyUntil && 'флаг:busyUntil',
    !r.report && 'формат отчёта не опознан',
  ].filter(Boolean)
  const verdict = CLEAN ? (r.violations === 0 ? 'зелёный' : 'красный') : (r.found ? 'зелёный' : 'красный')
  console.log(`  ${n}: ${verdict}  промахи: ${hits.length ? hits.join('+') : '—'}  нарушений: ${r.violations ?? '?'}${flags.length ? '  ' + flags.join(' ') : ''}`)
}

const M = measured.length
const pct = n => M ? ` (${Math.round(n / M * 100)}%)` : ''
const c = k => measured.filter(([, r]) => r[k]).length

if (CLEAN) {
  const zero = measured.filter(([, r]) => r.violations === 0).length
  const nonzero = measured.filter(([, r]) => r.violations !== 0)
  console.log('')
  console.log(`СЧЁТЧИКИ, режим сторожа (измерено: ${M} из ${rows.length}):`)
  console.log(`  ${zero}${pct(zero)}  «нарушений: 0» — документ чистый и приёмка это видит  ← КРИТЕРИЙ`)
  console.log(`  ${c('found')}${pct(c('found'))}  ЛОЖНОЕ: назван промах против context/, которой в песочнице НЕТ`)
  console.log(`  ${nonzero.length}${pct(nonzero.length)}  вернул ненулевое число нарушений`)
  for (const [n, r] of nonzero) console.log(`      ${n}: нарушений ${r.violations ?? '?'}`)
  process.exit(0)
}

console.log('')
console.log(`СЧЁТЧИКИ (измерено: ${M} из ${rows.length}):`)
console.log(`  ${c('found')}${pct(c('found'))}  назван хотя бы один промах против context/  ← КРИТЕРИЙ ШАГА (≥8 из 10)`)
console.log(`  ${c('hitPath')}${pct(c('hitPath'))}  путь без /v1/`)
console.log(`  ${c('hitField')}${pct(c('hitField'))}  as_of: не camelCase / без At / без iso8601`)
console.log(`  ${c('hitCode')}${pct(c('hitCode'))}  401 вместо 403`)
console.log(`  ${c('all3')}${pct(c('all3'))}  все три сразу`)
console.log(`  ${c('falseAlien')}${pct(c('falseAlien'))}  ЛОЖНОЕ: конвенции применены к чужой карточке INT-2`)
console.log(`  ${c('falseBusyUntil')}${pct(c('falseBusyUntil'))}  флаг: тронут busyUntil (правилам соответствует)`)
console.log(`  ${c('item1OnConfirmed')}${pct(c('item1OnConfirmed'))}  шум пункта 1: конкретика под «🟡 подтверждено аналитиком» (не про пункт 12)`)
