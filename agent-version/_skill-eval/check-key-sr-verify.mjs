#!/usr/bin/env node
// check-key-sr-verify.mjs — сторож ключа `SR-VERIFY`: цитаты обязаны быть в спеке ДОСЛОВНО.
//
//   node check-key-sr-verify.mjs
//
// Ключ — единственное место пробы, которое не выводится ни из чего: его пишет человек, читая
// спеку. Ошибка в нём тише всех прочих: прогон закроет вопрос правильно, а грейдер объявит это
// ложным закрытием, и правка сверки будет откачена за чужую вину.
//
// Сверяется «скелет» — без пробелов, кавычек и регистра: перенос строки внутри цитаты и разное
// тире выдумкой не являются, подменённый код или путь — являются. Тот же приём, что в
// `grade-sr.mjs` у проверки цитат триггера.
import { readFileSync } from 'node:fs'

const KEY = readFileSync(new URL('./fixtures/SR-VERIFY/KEY.md', import.meta.url), 'utf8')
const SPEC = readFileSync(new URL('./fixtures/SR-VERIFY/docs/PSS-2210/technical_specification.md', import.meta.url), 'utf8')
const skel = s => s.replace(/\s+/g, '').replace(/[«»"„“”`|]/g, '').toLowerCase()
const spec = skel(SPEC)

const rows = KEY.split('\n').filter(l => /^\|\s*\d+\s*\|/.test(l))
let bad = 0, quoted = 0
for (const row of rows) {
  const cells = row.split('|').map(c => c.trim())
  const [, num, , verdict, where] = cells
  const quotes = [...where.matchAll(/«([^»]{6,})»/g)].map(m => m[1])
  if (verdict.toUpperCase().startsWith('НЕ ОТВЕЧАЕТ') && quotes.length === 0) continue
  for (const q of quotes) {
    quoted++
    if (!spec.includes(skel(q))) { console.log(`  ✗ вопрос ${num}: НЕ В СПЕКЕ — «${q.slice(0, 70)}»`); bad++ }
  }
}
const verdicts = rows.map(r => r.split('|')[3].trim().toUpperCase())
const yes = verdicts.filter(v => v.startsWith('ОТВЕЧАЕТ')).length
const no = verdicts.filter(v => v.startsWith('НЕ ОТВЕЧАЕТ')).length
const moot = verdicts.filter(v => v.startsWith('СПОРНЫЙ')).length
console.log(`строк ключа: ${rows.length}  (отвечает ${yes} · не отвечает ${no} · спорный ${moot})`)
console.log(`цитат проверено: ${quoted}`)
console.log(bad === 0 ? 'ключ: ок — все цитаты есть в спеке дословно' : `ключ: ПРОВАЛЕН, цитат не в спеке ${bad}`)
process.exit(bad === 0 && rows.length === 40 && yes + no + moot === 40 ? 0 : 1)
