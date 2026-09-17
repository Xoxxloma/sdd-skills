#!/usr/bin/env node
// grade-sm-graph2.mjs — проба sm-graph2: Шаг 5 `service-map` на втором проходе (фикстура SM-GRAPH2).
//
//   node grade-sm-graph2.mjs <каталог с песочницами>
//   node grade-sm-graph2.mjs --selftest
//
// ЧТО ГРЕЙДИТСЯ. Файлы `services/*.md` в песочнице, а не отчёт прогона: правило репы «грейдить
// файл, а не формулировку». Из каждой карточки берётся секция «Кто меня потребляет», строки
// разбираются в пары «потребитель → карточка». Законных пар в фикстуре две; всё остальное — либо
// оставленное устаревшее зеркало, либо выдуманное ребро (дефект К6: строка потребителя принята за
// исходящее ребро и отзеркалена обратно). Исходящие секции обязаны остаться как в фикстуре.

import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CARDS = ['auth', 'user-profile', 'incident-web']
const ALLOWED = new Set(['incident-web>auth', 'auth>user-profile'])
const EXPECTED = { auth: 2, 'user-profile': 2, 'incident-web': 0 }
const STALE = 'incident-web>user-profile'
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

/** Секция карточки от заголовка до следующего «## ». */
export function section (text, title) {
  const lines = text.split(/\r?\n/)
  const from = lines.findIndex((l) => l.trim() === '## ' + title)
  if (from < 0) return null
  const rest = lines.slice(from + 1)
  const to = rest.findIndex((l) => l.startsWith('## '))
  return (to < 0 ? rest : rest.slice(0, to)).join('\n')
}

/** Строки данных таблицы: без шапки, без разделителя и без пустой формы «| — | | |». */
export function rows (sec) {
  if (sec === null) return []
  return sec.split('\n').filter((l) => l.startsWith('|')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((c) => c.length && !/^-+$/.test(c[0].replace(/[:\s]/g, '')) && !/^Сервис/.test(c[0]) && c[0] !== '—' && c[0] !== '')
}
const name = (cell) => cell.replace(/`/g, '').trim()

export function gradeCards (cards, seed) {
  const r = { invented: [], stale: false, missing: [], sourcesChanged: [], noSection: [] }
  for (const card of CARDS) {
    const text = cards[card]
    if (text === undefined) { r.noSection.push(card + ' (нет файла)'); continue }
    const sec = section(text, 'Кто меня потребляет')
    if (sec === null) { r.noSection.push(card); continue }
    const got = rows(sec)
    let legit = 0
    for (const c of got) {
      const pair = name(c[0]) + '>' + card
      if (ALLOWED.has(pair)) legit++
      else if (pair === STALE) r.stale = true
      else r.invented.push(pair)
    }
    if (legit < EXPECTED[card]) r.missing.push(`${card}: ${legit} из ${EXPECTED[card]}`)
    for (const t of ['Потребляемые API', 'Зависит от']) {
      const a = section(text, t); const b = section(seed[card], t)
      if (b !== null && (a === null || a.trim() !== b.trim())) r.sourcesChanged.push(`${card} «${t}»`)
    }
  }
  r.pass = !r.invented.length && !r.stale && !r.missing.length && !r.sourcesChanged.length && !r.noSection.length
  return r
}

const HERE = new URL('.', import.meta.url).pathname
const readSeed = () => Object.fromEntries(CARDS.map((c) => [c, readFileSync(join(HERE, 'fixtures/SM-GRAPH2/services', c + '.md'), 'utf8')]))

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  const seed = readSeed()
  // Нетронутая фикстура: законные зеркала на месте, но устаревшая строка осталась — красный.
  const asIs = gradeCards(seed, seed)
  ck('фикстура как есть — устаревшее зеркало видно', asIs.stale, true)
  ck('фикстура как есть — выдуманных нет', asIs.invented.length, 0)
  ck('фикстура как есть — красный', asIs.pass, false)
  // Верный исход: устаревшая строка убрана.
  const good = { ...seed, 'user-profile': seed['user-profile'].replace('| `incident-web` | `GET /v1/profiles/{id}` | аватар и имя в шапке |\n', '') }
  ck('верный исход — зелёный', gradeCards(good, seed).pass, true)
  // Дефект К6: строка потребителя auth отзеркалена обратно во фронт.
  const k6 = { ...good, 'incident-web': good['incident-web'].replace('## Кто меня потребляет\n| Сервис | Что вызывает | Зачем |\n|---|---|---|\n| — | | |', '## Кто меня потребляет\n| Сервис | Что вызывает | Зачем |\n|---|---|---|\n| `auth` | `GET /v1/sessions/count` | плашка активных сессий в шапке |') }
  const rk = gradeCards(k6, seed)
  ck('выдуманное обратное ребро поймано', rk.invented.join(','), 'auth>incident-web')
  ck('выдуманное ребро — красный', rk.pass, false)
  // Потеря: одна из двух строк auth → user-profile схлопнута.
  const lost = { ...good, 'user-profile': good['user-profile'].replace('| `auth` | — | чтение отображаемого имени для журнала входов |\n', '') }
  ck('схлопнутое зеркало поймано', gradeCards(lost, seed).missing.length, 1)
  // Симметрия «починена» удалением исходящей строки.
  const cut = { ...good, 'incident-web': good['incident-web'].replace('| `notifications-svc` | `POST /v1/subscribe` | подписка на пуши, вне манифеста |\n', '') }
  ck('тронутая исходящая секция поймана', gradeCards(cut, seed).sourcesChanged.length, 1)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

const arg = process.argv[2]
if (arg === '--selftest') selftest()
if (!arg || !existsSync(arg)) { console.error('usage: node grade-sm-graph2.mjs <каталог с песочницами> | --selftest'); process.exit(1) }
const seed = readSeed()
const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба sm-graph2, ${arg}`)
let measured = 0; let green = 0; const tot = { invented: 0, stale: 0, missing: 0, sources: 0 }
for (const n of runs) {
  const dir = join(arg, n)
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  if (existsSync(join(dir, '_api-failure.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const cards = {}
  for (const c of CARDS) { const p = join(dir, 'services', c + '.md'); if (existsSync(p)) cards[c] = readFileSync(p, 'utf8') }
  const r = gradeCards(cards, seed)
  if (r.pass) green++
  if (r.invented.length) tot.invented++
  if (r.stale) tot.stale++
  if (r.missing.length) tot.missing++
  if (r.sourcesChanged.length) tot.sources++
  const notes = [
    r.invented.length && 'ВЫДУМАНО: ' + r.invented.join(', '),
    r.stale && 'устаревшее зеркало оставлено',
    r.missing.length && 'потеряно: ' + r.missing.join('; '),
    r.sourcesChanged.length && 'тронуты исходящие: ' + r.sourcesChanged.join(', '),
    r.noSection.length && 'нет секции: ' + r.noSection.join(', '),
  ].filter(Boolean)
  console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}${notes.length ? '  ' + notes.join(' · ') : ''}`)
}
console.log(`\nизмерено: ${measured} из ${runs.length}`)
console.log(`  ${tot.invented}/${measured}\tВЫДУМАННОЕ ОБРАТНОЕ РЕБРО — строка потребителя принята за исходящую  ← КРИТЕРИЙ (К6)`)
console.log(`  ${tot.stale}/${measured}\tустаревшее зеркало оставлено — секция не пересобрана целиком`)
console.log(`  ${tot.missing}/${measured}\tзаконное зеркало потеряно или схлопнуто`)
console.log(`  ${tot.sources}/${measured}\tтронуты «Потребляемые API» / «Зависит от»`)
console.log(`  ${green}/${measured}\tзелёных\n`)
