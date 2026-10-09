#!/usr/bin/env node
// grade-sq.mjs — проба `sq-audit`: скилл `sdd-quality-audit` на фикстуре SQ-AUDIT.
//
//   node grade-sq.mjs <каталог с песочницами run-NN>
//   node grade-sq.mjs --selftest
//
// ЧТО МЕРЯЕТСЯ. Скилл обходит `docs/` из восьми фич и пишет `sdd-quality-report.md` в корень песочницы.
// Грейдится ФАЙЛ на диске, а не пересказ в чате. Эталон и смысл каждой фичи — `fixtures/SQ-AUDIT/README.md`.
//
// Проверки:
//   отчёт      — файл `sdd-quality-report*.md` в корне песочницы
//   docs       — в `docs/` ничего не создано и не изменено
//   строки     — у каждой из восьми папок своя строка сводной таблицы
//   н/п        — колонки «н/п: баг-репорт», «н/п: узел-фундамент», «спеки нет» там, где должны
//   счёт       — сумма частей = итог, максимум = веса применимых критериев, процент = округление
//   хорошая    — PSS-2210: БТ ≥ 4.0, спека ≥ 4.5
//   версия     — PSS-2211 (новый шаблон) ≥ 4.0 и отличается от PSS-2210 (старый) не больше чем на 0.5
//   частичная  — PSS-2212: БТ крит. 4 ≤ 0.5; в спеке снижено хоть в одной посаженной дыре (2, 3, 5)
//                и ни в одной непосаженной (1, 4); обе ≥ 50%
//   протыкано  — PSS-2213: БТ и спека < 50% и «шаблонно» у обоих
//   багфикс    — ARS-312: спека ≥ 80%, н/п не меньше двух из крит. 2, 3, 5
//   фундамент  — ARS-100/_foundation: крит. 1 спеки — н/п
//   внимание   — в «Требуют внимания» есть PSS-2213 и нет PSS-2210/2211/2212, ARS-312
//   флаг       — «шаблонно» только у PSS-2213 (заглушки эпика не проверяются)
//   цитаты     — справочно: ≥ 85% цитат «…» от 20 знаков из «Деталей» находятся в документах фикстуры
//                (короткие — это имена объектов в своём падеже, а не цитаты строк)
//
// Правила репы: песочница без ответа или с отказом API — «НЕ ИЗМЕРЕНО»; регулярки литеральные,
// `\b`/`\w` рядом с кириллицей не применяются.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DOCS = join(HERE, 'fixtures', 'SQ-AUDIT', 'docs')
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
const W_BT = [0.5, 1, 1, 1, 1]
const W_SPEC = [1, 1, 1, 1, 1]

// Ключ строки — по пути документа в ячейках; порядок важен: специфичное раньше общего.
const ROW_KEYS = [
  ['FND', '_foundation'],
  ['ARS-101', 'ARS-101'],
  ['ARS-312', 'ARS-312'],
  ['PSS-2210', 'PSS-2210'],
  ['PSS-2211', 'PSS-2211'],
  ['PSS-2212', 'PSS-2212'],
  ['PSS-2213', 'PSS-2213'],
  ['EPIC', 'ARS-100']
]

const norm = (s) => s.replace(/[*`«»„“”"]/g, '').replace(/ё/g, 'е').replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim().toLowerCase()

function walk (dir) {
  const out = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p)
  }
  return out
}

/** Ячейка оценки: «0.5+1+н/п+1+1 = 3.5 из 4.5 (78%)» → части, итог, максимум, процент. */
export function parseScore (cell) {
  const m = cell.match(/^(.*?)=\s*([\d.,]+)\s*из\s*([\d.,]+)\s*\(\s*(\d+)\s*%\s*\)/)
  if (!m) return null
  const num = (x) => Number(x.replace(',', '.'))
  const parts = m[1].split('+').map((x) => x.trim()).filter(Boolean).map((x) => (x.includes('н/п') ? null : num(x)))
  if (parts.some((x) => x !== null && Number.isNaN(x))) return null
  return { parts, sum: num(m[2]), max: num(m[3]), pct: Number(m[4]) }
}

export function arithmeticOk (sc, weights) {
  if (!sc || sc.parts.length !== weights.length) return false
  const sum = sc.parts.reduce((a, x) => a + (x ?? 0), 0)
  const max = weights.reduce((a, w, i) => a + (sc.parts[i] === null ? 0 : w), 0)
  if (Math.abs(sum - sc.sum) > 0.01 || Math.abs(max - sc.max) > 0.01) return false
  if (sc.parts.some((x, i) => x !== null && (x < 0 || x > weights[i] + 0.001))) return false
  return max === 0 || Math.abs(Math.round((sum / max) * 100) - sc.pct) <= 1
}

/** Сводная таблица: заголовок с колонками «фича» и «jira», дальше строки с `|`. */
export function parseTable (text) {
  const lines = text.split(/\r?\n/)
  const hi = lines.findIndex((l) => l.trim().startsWith('|') && /фича/i.test(l) && /jira/i.test(l))
  if (hi < 0) return null
  const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const head = cells(lines[hi]).map((c) => c.toLowerCase())
  const col = (re) => head.findIndex((h) => re.test(h))
  const idx = {
    bt: head.findIndex((h) => h === 'бт'),
    btScore: col(/^бт оценка/),
    spec: head.findIndex((h) => h === 'спека'),
    specScore: col(/^спек[аи]? оценка/),
    flag: col(/шаблонно/)
  }
  const rows = {}
  for (let i = hi + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const c = cells(lines[i])
    const joined = c.join(' ')
    const key = ROW_KEYS.find(([, needle]) => joined.includes(needle))
    if (!key || rows[key[0]]) continue
    rows[key[0]] = {
      bt: c[idx.bt] ?? '', btScore: c[idx.btScore] ?? '', spec: c[idx.spec] ?? '',
      specScore: c[idx.specScore] ?? '', flag: c[idx.flag] ?? ''
    }
  }
  return rows
}

function section (text, title) {
  const i = text.indexOf(`## ${title}`)
  if (i < 0) return null
  const rest = text.slice(i + title.length + 3)
  const j = rest.search(/\n## /)
  return j < 0 ? rest : rest.slice(0, j)
}

export function quotes (details) {
  const out = []
  // Строки «→ …» — рекомендация проверяющего: в кавычках там его формулировка, а не строка документа.
  const body = details.split(/\r?\n/).filter((l) => !l.trim().startsWith('→')).join('\n')
  for (const m of body.matchAll(/«([^«»]{20,})»/g)) {
    for (const frag of m[1].split(/…|\.\.\./)) {
      const f = norm(frag).replace(/[.,;:]+$/, '')
      if (f.length >= 20) out.push(f)
    }
  }
  return out
}

export function gradeReport (text, corpus) {
  const ck = {}
  const rows = parseTable(text) || {}
  const need = ROW_KEYS.map(([k]) => k)
  ck['строки'] = need.every((k) => rows[k])
  const r = (k) => rows[k] || { bt: '', btScore: '', spec: '', specScore: '', flag: '' }
  ck['н/п'] = /спеки нет/i.test(r('PSS-2211').specScore + r('PSS-2211').spec) &&
    /н\/п[^|]*баг/i.test(r('ARS-312').btScore + r('ARS-312').bt) &&
    /н\/п[^|]*фундамент/i.test(r('FND').btScore + r('FND').bt) &&
    /спеки нет/i.test(r('EPIC').specScore + r('EPIC').spec)
  const sc = {}
  for (const k of need) {
    sc[k] = { bt: parseScore(r(k).btScore), spec: parseScore(r(k).specScore) }
  }
  const scored = []
  for (const k of need) {
    if (sc[k].bt) scored.push(arithmeticOk(sc[k].bt, W_BT))
    if (sc[k].spec) scored.push(arithmeticOk(sc[k].spec, W_SPEC))
  }
  ck['счёт'] = scored.length >= 10 && scored.every(Boolean)
  const btS = (k) => sc[k].bt?.sum ?? -1
  const spS = (k) => sc[k].spec?.sum ?? -1
  const pct = (x) => x?.pct ?? -1
  const part = (x, i) => (x ? x.parts[i] : undefined)
  ck['хорошая'] = btS('PSS-2210') >= 4.0 && spS('PSS-2210') >= 4.5
  ck['версия'] = btS('PSS-2211') >= 4.0 && btS('PSS-2210') >= 0 && Math.abs(btS('PSS-2210') - btS('PSS-2211')) <= 0.5
  const p12b = sc['PSS-2212'].bt; const p12s = sc['PSS-2212'].spec
  // Роли БТ (крит. 5) не проверяются: исполнитель отзыва в фикстуре угадывается по тексту, и 1 по правилу
  // «между 0.5 и 1 — старший» законен. В спеке три посаженные дыры на границе 0.5/1 (данные одной строкой,
  // роли только в UI, без примеров у части карточек): требуется, чтобы снижение попало хотя бы в одну из
  // них и ни одно — в непосаженные (1 и 4). Какая именно дожата до 0.5 — печатается отдельно.
  const planted = p12s ? [1, 2, 4].filter((i) => p12s.parts[i] !== null && p12s.parts[i] <= 0.5).length : 0
  const offTarget = p12s ? [0, 3].some((i) => p12s.parts[i] !== null && p12s.parts[i] < 1) : true
  ck['частичная'] = !!p12b && !!p12s && part(p12b, 3) !== null && part(p12b, 3) <= 0.5 &&
    planted >= 1 && !offTarget && pct(p12b) >= 50 && pct(p12s) >= 50
  const f13 = r('PSS-2213').flag
  ck['протыкано'] = pct(sc['PSS-2213'].bt) >= 0 && pct(sc['PSS-2213'].bt) < 50 && pct(sc['PSS-2213'].spec) >= 0 && pct(sc['PSS-2213'].spec) < 50 &&
    /БТ/.test(f13) && /спек/i.test(f13)
  const bug = sc['ARS-312'].spec
  ck['багфикс'] = !!bug && bug.pct >= 80 && [1, 2, 4].filter((i) => bug.parts[i] === null).length >= 2
  ck['фундамент'] = !!sc.FND.spec && sc.FND.spec.parts[0] === null
  const att = section(text, 'Требуют внимания') || ''
  ck['внимание'] = att.includes('PSS-2213') && !['PSS-2210', 'PSS-2211', 'PSS-2212', 'ARS-312'].some((k) => att.includes(k))
  ck['флаг'] = ['PSS-2210', 'PSS-2211', 'PSS-2212', 'ARS-312'].every((k) => /нет/i.test(r(k).flag))
  const qs = quotes(section(text, 'Детали') || '')
  const found = qs.filter((q) => corpus.includes(q)).length
  ck['цитаты'] = qs.length >= 5 && found / qs.length >= 0.85
  const p12 = p12s ? `данные ${p12s.parts[1]} роли ${p12s.parts[2]} контракты ${p12s.parts[4]}` : '-'
  return { ck, quotes: `${found}/${qs.length}`, missing: qs.filter((q) => !corpus.includes(q)).slice(0, 3), sc, p12 }
}

function gradeOne (dir, corpus, seeded) {
  const ans = join(dir, 'answer.md')
  if (!existsSync(ans)) return { measured: false, why: 'нет answer.md' }
  const a = readFileSync(ans, 'utf8')
  if (RE_API_FAILURE.test(a.slice(0, 300))) return { measured: false, why: 'отказ API' }
  const rep = readdirSync(dir).filter((n) => /^sdd-quality-report(-\d+)?\.md$/.test(n)).sort()
  const docsOk = (() => {
    const d = join(dir, 'docs')
    if (!existsSync(d)) return false
    const now = walk(d).map((p) => relative(d, p).replace(/\\/g, '/')).sort()
    if (now.join('\n') !== seeded.join('\n')) return false
    return now.every((p) => readFileSync(join(d, p), 'utf8') === readFileSync(join(FIXTURE_DOCS, p), 'utf8'))
  })()
  if (!rep.length) return { measured: true, ck: { 'отчёт': false, docs: docsOk }, quotes: '-', missing: [] }
  const g = gradeReport(readFileSync(join(dir, rep[0]), 'utf8'), corpus)
  return { measured: true, ...g, ck: { 'отчёт': true, docs: docsOk, ...g.ck } }
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  ck('счёт с н/п', arithmeticOk(parseScore('н/п+1+0.5+1+1 = 3.5 из 4.0 (88%)'), W_SPEC), true)
  ck('счёт БТ с весом 0.5', arithmeticOk(parseScore('0.25+1+1+0.5+0 = 2.75 из 4.5 (61%)'), W_BT), true)
  ck('неверная сумма', arithmeticOk(parseScore('0.5+1+1+1+1 = 4.0 из 4.5 (89%)'), W_BT), false)
  ck('максимум без вычета н/п', arithmeticOk(parseScore('н/п+1+1+1+1 = 4.0 из 5.0 (80%)'), W_SPEC), false)
  ck('балл выше веса', arithmeticOk(parseScore('1+1+1+1+1 = 5.0 из 4.5 (111%)'), W_BT), false)
  ck('запятая вместо точки', arithmeticOk(parseScore('0,5+1+1+1+1 = 4,5 из 4,5 (100%)'), W_BT), true)
  ck('не оценка', parseScore('н/п: баг-репорт'), null)
  const corpus = norm('Сотрудник подаёт заявку на пропуск: ФИО посетителя, номер документа')
  ck('цитата найдена с переносом и бэктиками', quotes('x «Сотрудник подаёт `заявку`\n  на пропуск» y').every((q) => corpus.includes(q)), true)
  ck('цитата с многоточием режется, короткий обрывок отброшен', quotes('«Сотрудник подаёт заявку … номер документа»').length, 1)
  const good = [
    '## Требуют внимания', '- PSS-2213 · БТ 0.5 из 4.5 (11%) · шаблонно: да', '',
    '## Сводная таблица',
    '| команда | ai-sdd repo | аналитик | фича | jira | БТ | БТ оценка | Спека | Спек оценка | шаблонно |',
    '|---|---|---|---|---|---|---|---|---|---|',
    '| А | | | ф | PSS-2210 | docs/PSS-2210/business_requirements.md | 0.5+1+1+1+1 = 4.5 из 4.5 (100%) | docs/PSS-2210/technical_specification.md | 1+1+1+1+1 = 5.0 из 5.0 (100%) | нет |',
    '| А | | | ф | PSS-2211 | docs/PSS-2211/business_requirements.md | 0.5+1+1+1+1 = 4.5 из 4.5 (100%) | спеки нет | спеки нет | нет |',
    '| А | | | ф | PSS-2212 | docs/PSS-2212/business_requirements.md | 0.5+1+0.5+0.5+0.5 = 3.0 из 4.5 (67%) | docs/PSS-2212/technical_specification.md | 1+0.5+0.5+1+0.5 = 3.5 из 5.0 (70%) | нет |',
    '| А | | | ф | PSS-2213 | docs/PSS-2213/business_requirements.md | 0+0.5+0+0+0 = 0.5 из 4.5 (11%) | docs/PSS-2213/technical_specification.md | 0+0+0+0.5+0 = 0.5 из 5.0 (10%) | БТ, спека |',
    '| А | | | ф | ARS-312 | н/п: баг-репорт | н/п: баг-репорт | docs/ARS-312/technical_specification.md | 1+н/п+н/п+1+н/п = 2.0 из 2.0 (100%) | нет |',
    '| А | | | ф | ARS-100 | docs/ARS-100/business_requirements.md | 0+0+0.5+0+0 = 0.5 из 4.5 (11%) | спеки нет | спеки нет | БТ |',
    '| А | | | ф | ARS-100 | н/п: узел-фундамент | н/п: узел-фундамент | docs/ARS-100/_foundation/technical_specification.md | н/п+0+0+0+0 = 0.0 из 4.0 (0%) | спека |',
    '| А | | | ф | ARS-101 | docs/ARS-100/ARS-101/business_requirements.md | 0+0+0+0+0 = 0.0 из 4.5 (0%) | docs/ARS-100/ARS-101/technical_specification.md | 0+0+0+0+0 = 0.0 из 5.0 (0%) | БТ, спека |',
    '', '## Детали', '«Сотрудник подаёт заявку на пропуск» «номер документа посетителя»', '«ФИО посетителя, номер документа» «Сотрудник подаёт заявку» «на пропуск: ФИО посетителя»'
  ].join('\n')
  const corp2 = norm('Сотрудник подаёт заявку на пропуск: ФИО посетителя, номер документа посетителя')
  const g = gradeReport(good, corp2)
  ck('эталонный отчёт — все проверки', Object.values(g.ck).every(Boolean), true)
  ck('PSS-2212 в «внимании» — красный', gradeReport(good.replace('- PSS-2213', '- PSS-2212 · x\n- PSS-2213'), corp2).ck['внимание'], false)
  ck('версия разошлась — красный', gradeReport(good.replace('0.5+1+1+1+1 = 4.5 из 4.5 (100%) | спеки нет', '0.5+0+1+1+1 = 3.5 из 4.5 (78%) | спеки нет'), corp2).ck['версия'], false)
  ck('нет строки фундамента — красный', gradeReport(good.split('\n').filter((l) => !l.includes('_foundation')).join('\n'), corp2).ck['строки'], false)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) selftest()
const root = argv.find((x) => !x.startsWith('--'))
if (!root) { console.error('usage: node grade-sq.mjs <каталог с run-NN> | --selftest'); process.exit(1) }
const seeded = walk(FIXTURE_DOCS).map((p) => relative(FIXTURE_DOCS, p).replace(/\\/g, '/')).sort()
const corpus = norm(walk(FIXTURE_DOCS).map((p) => readFileSync(p, 'utf8')).join('\n'))
const runs = readdirSync(root).filter((n) => /^run-\d+$/.test(n) && statSync(join(root, n)).isDirectory()).sort()
const rows = runs.map((n) => [n, gradeOne(join(root, n), corpus, seeded)])
const ok = rows.filter(([, r]) => r.measured)
console.log(`\nпроба sq-audit, ${root}\nпрогонов: ${rows.length}, измерено: ${ok.length}`)
const tally = {}
for (const [n, r] of rows) {
  if (!r.measured) { console.log(`  ${n}: НЕ ИЗМЕРЕНО (${r.why})`); continue }
  const failed = Object.entries(r.ck).filter(([k, v]) => !v && k !== 'цитаты').map(([k]) => k)
  for (const [k, v] of Object.entries(r.ck)) tally[k] = (tally[k] || 0) + (v ? 1 : 0)
  console.log(`  ${n}: ${failed.length ? 'красный — ' + failed.join(', ') : 'зелёный'}  PSS-2212 спека: ${r.p12 ?? '-'}  цитаты ${r.quotes}${r.missing.length ? '  не найдены: ' + r.missing.map((q) => `«${q.slice(0, 50)}»`).join(' ') : ''}`)
}
console.log('\nпо проверкам:')
for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}/${ok.length}`)
// «цитаты» — справочно, в критерий не входит: промахи пула 2026-10-09 разобраны руками — имена разделов
// в своём падеже («конечных потребителей»), склейки двух мест одной строкой; выдуманных строк нет.
const green = ok.filter(([, r]) => Object.entries(r.ck).every(([k, v]) => v || k === 'цитаты')).length
console.log(`\n  ${green}/${ok.length}\tзелёных — все проверки, кроме справочной «цитаты»  ← КРИТЕРИЙ\n`)
