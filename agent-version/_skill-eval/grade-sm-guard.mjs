#!/usr/bin/env node
// grade-sm-guard.mjs — пересчёт гарда-маршрутизатора стендом, по файлам, без LLM.
//
//   node grade-sm-guard.mjs <папка-раунда> [ещё-раунды…]
//
// Для каждой песочницы `<раунд>/sandbox/<плечо>-N/` с прежними карточками в `_prev/` берёт
// каждую карточку `_prev/<svc>.md` и смотрит, что с ней стало:
//   ПОВЕРХ     — `w/AI-SDD/services/<svc>.md` изменилась (кроме `scanned`);
//   В _pending   — лежит `w/AI-SDD/services/_pending/<svc>.md`, а карточка байт-в-байт прежняя;
//   НЕ ТРОНУТА — ни того, ни другого.
// Потом считает по классам гарда (те же, что в SKILL.md 2.0: контракт, сущности, задачи, топики,
// экраны, потребляемые API, роли, зависит от; «Бизнес-правила», «Что умеет» и «Кто меня
// потребляет» не считаются) было / исчезло / появилось / опустело и применяет формулу:
//   _pending, если хоть у одного класса (исчезло ≥ 3 и 3·исчезло > было) или то же по опустело.
// Печатает ОЖИДАЕМЫЙ маршрут против ФАКТИЧЕСКОГО. Расхождение — нарушение инварианта:
//   «перезаписано при потере выше порога» — самое дорогое, считается отдельно.
//
// Грейдится файл, а не отчёт: отчёт Шага 6 может рассказать что угодно.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const norm = s => s.replace(/`/g, '').replace(/\s+/g, ' ').trim()
const section = (t, names) => {
  const out = []; let on = false
  for (const l of t.split('\n')) {
    if (/^## /.test(l)) { on = names.includes(l.replace(/^## /, '').trim()); continue }
    if (on) out.push(l)
  }
  return out.join('\n')
}
const heads = t => (t.match(/^### .+$/gm) || []).map(h => norm(h.slice(4)))
const bodyByHead = t => {
  const m = new Map(); let cur = null
  for (const l of t.split('\n')) {
    if (/^### /.test(l)) { cur = norm(l.slice(4)); m.set(cur, 0); continue }
    if (cur && /^- /.test(l)) m.set(cur, m.get(cur) + 1)
  }
  return m
}
const rows = (t, cols) => t.split('\n')
  .filter(l => /^\|/.test(l) && !/^\|\s*-{2,}/.test(l))
  .map(l => l.split('|').slice(1, -1).map(norm))
  .filter(c => c[0] && !/^(Роль|Сервис|Экран|Роут|Путь|Маршрут|Сервис или система|Что вызывает|—)$/.test(c[0]))
  .map(c => cols.map(i => c[i] || '').join(' · '))

// класс → [секции, тип ключа, колонки]
const CLASSES = [
  ['контракт',         ['Публичный контракт', 'Публичный API'], 'head'],
  ['сущности',         ['Владеет данными'],                       'head'],
  ['задачи',           ['Фоновые задачи'],                        'head'],
  ['топики',           ['События'],                               'head'],
  ['экраны',           ['Экраны'],                                'row', [0]],
  ['потребляемые API', ['Потребляемые API'],                      'row', [0, 1]],
  ['роли',             ['Роли и доступ'],                         'row', [0]],
  ['зависит от',       ['Зависит от'],                            'row', [0]],
]

function guard (prev, cur) {
  const per = []
  let pocket = false
  for (const [name, secs, kind, cols] of CLASSES) {
    const a = section(prev, secs), b = section(cur, secs)
    const ka = kind === 'head' ? heads(a) : rows(a, cols)
    const kb = kind === 'head' ? heads(b) : rows(b, cols)
    if (!ka.length && !kb.length) continue
    const sb = new Set(kb), sa = new Set(ka)
    const gone = ka.filter(k => !sb.has(k)), neu = kb.filter(k => !sa.has(k))
    let emptied = []
    if (kind === 'head') {
      const ba = bodyByHead(a), bb = bodyByHead(b)
      emptied = ka.filter(k => sb.has(k) && (ba.get(k) || 0) > 0 && (bb.get(k) || 0) === 0)
    }
    const was = ka.length
    const trip = (gone.length >= 3 && 3 * gone.length > was) || (emptied.length >= 3 && 3 * emptied.length > was)
    if (trip) pocket = true
    per.push({ name, was, gone, neu, emptied, trip })
  }
  return { route: pocket ? 'В _pending' : 'ПОВЕРХ', per }
}

const stripScanned = t => t.replace(/\r\n/g, '\n').replace(/^scanned:.*$/m, '')   // CRLF↔LF — не содержание
// Для сравнения «прежняя цела» секция «Кто меня потребляет» не считается: её пересобирает Шаг 5 у всех карточек.
const stripMirrors = t => t.split(/\n(?=## )/).filter(s => !/^## Кто меня потребляет/.test(s)).join('\n')
const scannedOf = t => (t.match(/^scanned:.*$/m) || [''])[0]

let total = 0, violations = 0, pocketExpected = 0, pocketActual = 0, overwrites = 0, untouched = 0
for (const round of process.argv.slice(2)) {
  const sb = join(round, 'sandbox')
  if (!existsSync(sb)) { console.log(`${round}: песочниц нет`); continue }
  for (const d of readdirSync(sb).filter(x => statSync(join(sb, x)).isDirectory()).sort()) {
    const prevDir = join(sb, d, '_prev'); if (!existsSync(prevDir)) continue
    for (const f of readdirSync(prevDir).filter(x => x.endsWith('.md'))) {
      const svc = f.replace(/\.md$/, '')
      const prev = readFileSync(join(prevDir, f), 'utf8')
      const curPath = join(sb, d, 'w', 'AI-SDD', 'services', f)
      const pendPath = join(sb, d, 'w', 'AI-SDD', 'services', '_pending', f)
      const cur = existsSync(curPath) ? readFileSync(curPath, 'utf8') : ''
      const pend = existsSync(pendPath) ? readFileSync(pendPath, 'utf8') : ''
      const cardSame = stripScanned(prev) === stripScanned(cur)
      let actual, candidate
      if (pend) { actual = 'В _pending'; candidate = pend }
      else if (!cardSame && cur) { actual = 'ПОВЕРХ'; candidate = cur }
      else { actual = 'НЕ ТРОНУТА'; candidate = '' }
      total++
      if (!candidate) { untouched++; console.log(`${d}/${svc}: НЕ ТРОНУТА (кандидата нет)`); continue }
      const g = guard(prev, candidate)
      if (g.route === 'В _pending') pocketExpected++
      if (actual === 'В _pending') pocketActual++
      const bad = g.route !== actual
      if (bad) violations++
      if (bad && g.route === 'В _pending' && actual === 'ПОВЕРХ') overwrites++
      const prevSame = pend ? ((stripMirrors(stripScanned(prev)) === stripMirrors(stripScanned(cur)) ? 'прежняя цела' : 'ПРЕЖНЯЯ ИЗМЕНЕНА') + (scannedOf(prev) !== scannedOf(cur) ? ' · scanned СДВИНУТ' : '')) : ''
      console.log(`${d}/${svc}: ожидалось ${g.route} · факт ${actual}${bad ? '  ← НАРУШЕНИЕ' : ''} ${prevSame}`)
      for (const p of g.per) {
        const flag = p.trip ? '  ⚠ порог' : ''
        console.log(`    ${p.name}: было ${p.was} · исчезло ${p.gone.length} · появилось ${p.neu.length} · опустело ${p.emptied.length}${flag}`)
        if (p.gone.length) console.log('      - ' + p.gone.slice(0, 5).join('\n      - ') + (p.gone.length > 5 ? `\n      … ещё ${p.gone.length - 5}` : ''))
      }
    }
  }
}
console.log(`\nИТОГ: карточек с прежней ${total} · нарушений маршрута ${violations} · из них ПЕРЕЗАПИСАНО при потере выше порога ${overwrites} · в _pending ожидалось ${pocketExpected}, факт ${pocketActual} · не тронуто ${untouched}`)
