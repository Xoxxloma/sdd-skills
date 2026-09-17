#!/usr/bin/env node
// grade-br-rework.mjs — проба br-rework: что писатель БТ делает с ГОТОВЫМ документом и находками приёмки.
//
//   node grade-br-rework.mjs <каталог с песочницами>
//   node grade-br-rework.mjs --selftest
//
// Грейдится ФАЙЛ в песочнице против засева, а не отчёт прогона. Исходы, которые различаются:
// поправил на месте · переписал целиком · завёл новый файл · не тронул и ушёл в интервью.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REL = 'docs/RMS-5102/business_requirements.md'
const HERE = new URL('.', import.meta.url).pathname
const SEED = readFileSync(join(HERE, 'fixtures/BR-REWORK', REL), 'utf8')
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
const RE_ASKS_KEY = /(укажите|назовите|пришлите|сообщите|дайте|нужен|требуется|не передан|не указан)[^.\n]{0,40}ключ|ключ[^.\n]{0,40}(не передан|не указан|❓)/i

function section (text, startsWith) {
  const lines = text.split(/\r?\n/)
  const from = lines.findIndex((l) => l.startsWith(startsWith))
  if (from < 0) return null
  const rest = lines.slice(from + 1)
  const to = rest.findIndex((l) => /^##+ /.test(l))
  return (to < 0 ? rest : rest.slice(0, to)).join('\n').trim()
}

export function gradeDoc (text, answer, otherDocs) {
  const r = { exists: text !== null, newDocs: otherDocs }
  if (!r.exists) { r.pass = false; return r }
  r.untouched = text === SEED
  r.fix1 = !/PassportDto/.test(text)
  const crit = section(text, '### 4.2') || ''
  r.fix2 = /\[FR-3\][\s\S]{0,400}Дано[\s\S]{0,300}Когда[\s\S]{0,300}Тогда/.test(crit)
  // Сколько непустых строк засева дожило дословно. Две строки с посаженным PassportDto не в счёт.
  const seedLines = SEED.split('\n').map((l) => l.trim()).filter((l) => l && !/PassportDto|^Новых интеграций нет/.test(l))
  const have = new Set(text.split('\n').map((l) => l.trim()))
  r.kept = seedLines.filter((l) => have.has(l)).length / seedLines.length
  r.rewritten = r.kept < 0.9
  r.s45 = section(text, '## 4.5') === section(SEED, '## 4.5')
  r.s53 = section(text, '### 5.3') === section(SEED, '### 5.3')
  r.status = /\*\*Статус готовности:\*\*\s*Готово к оценке/.test(text)
  r.asksKey = RE_ASKS_KEY.test(answer)
  r.questions = (answer.match(/\?/g) || []).length
  r.pass = !r.newDocs.length && r.fix1 && r.fix2 && !r.rewritten && r.s45 && r.s53 && r.status && !r.asksKey
  return r
}

function listMd (dir, base = dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listMd(p, base))
    else if (e.name.endsWith('.md') && !/^answer/.test(e.name)) out.push(relative(base, p))
  }
  return out
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  ck('засев как есть — не тронут, красный', gradeDoc(SEED, 'Укажите ключ задачи.', []).pass, false)
  ck('засев как есть — ключ переспрошен', gradeDoc(SEED, 'Укажите ключ задачи (SMSEC-1234).', []).asksKey, true)
  const good = SEED.replace(' Сведения о комнате для\nэкрана блокировки берутся из `PassportDto`.', ' Сведения о комнате для\nэкрана блокировки берутся из паспорта переговорной.')
    .replace('\n## 4.5.', '- **[FR-3]** Дано: комната закрыта на обслуживание. Когда: пользователь с ролью\n  `ROLE_FACILITY_ADMIN` снимает блокировку. Тогда: комнату снова можно бронировать с этого момента.\n\n## 4.5.')
  const g = gradeDoc(good, 'Поправил два места, статус прежний.', [])
  ck('правка на месте — зелёный', g.pass, true)
  ck('правка на месте — текст цел', g.kept > 0.99, true)
  ck('новый файл рядом — красный', gradeDoc(good, '', ['docs/RMS-5102/business_requirements_v2.md']).pass, false)
  const rewritten = good.split('\n').map((l) => (l.startsWith('#') || l.startsWith('>') || !l.trim()) ? l : l + ' ').join('\n').replace(/ {1}$/gm, ' — уточнено')
  ck('переписан целиком — пойман', gradeDoc(rewritten, '', []).rewritten, true)
  ck('тронута §4.5 — поймано', gradeDoc(good.replace('Не применимо: один деливербл.', 'Не применимо: деливербл один.'), '', []).s45, false)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

const arg = process.argv[2]
if (arg === '--selftest') selftest()
if (!arg || !existsSync(arg)) { console.error('usage: node grade-br-rework.mjs <каталог с песочницами> | --selftest'); process.exit(1) }
const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба br-rework, ${arg}`)
let measured = 0; let green = 0
for (const n of runs) {
  const dir = join(arg, n)
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  if (existsSync(join(dir, '_api-failure.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const p = join(dir, REL)
  const text = existsSync(p) ? readFileSync(p, 'utf8') : null
  const others = existsSync(join(dir, 'docs')) ? listMd(join(dir, 'docs'), dir).filter((f) => f !== REL) : []
  const r = gradeDoc(text, ans, others)
  if (r.pass) green++
  const outcome = !r.exists ? 'ФАЙЛ ИСЧЕЗ' : r.untouched ? 'файл НЕ ТРОНУТ' : r.rewritten ? `ПЕРЕПИСАН (дословно дожило ${(r.kept * 100).toFixed(0)}% строк)` : `правка на месте (дожило ${(r.kept * 100).toFixed(0)}% строк)`
  const notes = [
    r.newDocs.length && 'НОВЫЕ ФАЙЛЫ: ' + r.newDocs.join(', '),
    r.exists && !r.fix1 && 'PassportDto остался',
    r.exists && !r.fix2 && 'критерия FR-3 нет',
    r.exists && !r.s45 && 'тронута §4.5',
    r.exists && !r.s53 && 'тронута §5.3',
    r.exists && !r.status && 'статус изменён',
    r.asksKey && 'КЛЮЧ ПЕРЕСПРОШЕН',
    `вопросительных знаков в ответе: ${r.questions ?? '?'}`,
  ].filter(Boolean)
  console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  ${outcome}  · ${notes.join(' · ')}`)
}
console.log(`\n  ${green}/${measured}\tзелёных — поправил свой файл на месте, без вопросов по закрытому и без побочных правок  ← КРИТЕРИЙ\n`)
