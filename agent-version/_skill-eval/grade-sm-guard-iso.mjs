#!/usr/bin/env node
// grade-sm-guard-iso.mjs — изолированная проба гарда-маршрутизатора (фикстура SM-GUARD).
//
//   node grade-sm-guard-iso.mjs <папка-раунда>/sm-guard
//
// Читается ПОСЛЕДНЯЯ строка вида «ГАРД: …» в ответе; ожидание — из fixtures/SM-GUARD/expect.json.
// Отдельно считаются слова-причины в ответе — «законно», «форма», «урезали», «не дочитал»,
// «коррекция»: у формулы их быть не должно, их появление значит, что ведущий решал, а не считал.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out || !existsSync(out)) { console.error('нужна папка <раунд>/sm-guard'); process.exit(1) }
const expect = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'SM-GUARD', 'expect.json'), 'utf8'))
const RE = /ГАРД:\s*\**\s*(ПОВЕРХ|В _pending|В КАРМАН)/g   // «В КАРМАН» — прежнее имя _pending (до 22.09)
const REASON = /законн|не настоящ|коррекц|урезал|не дочитал|смен[аы] формы|переформат/i
const MANDATED = /урезали сервис или скан не дочитал|не разбираю|не решаю|не сужу|явно исключ/i

let green = 0, total = 0, reasons = 0, cost = 0
console.log(`проба sm-guard, ${out}`)
for (const v of readdirSync(out).filter(d => statSync(join(out, d)).isDirectory()).sort()) {
  const want = expect[v]; if (!want) { console.log(`  ${v}: нет ожидания в expect.json`); continue }
  const files = readdirSync(join(out, v)).filter(f => /^answer-\d+\.md$/.test(f)).sort()
  let ok = 0, verdicts = [], withReason = 0
  for (const f of files) {
    const t = readFileSync(join(out, v, f), 'utf8')
    const m = [...t.matchAll(RE)]; const got = m.length ? m[m.length - 1][1].replace('В КАРМАН', 'В _pending') : '—'
    verdicts.push(got)
    if (got === want.want) ok++
    if (t.split('\n').some(l => REASON.test(l) && !MANDATED.test(l))) withReason++
    const cf = join(out, v, f.replace('answer', 'cost').replace('.md', '.txt'))
    if (existsSync(cf)) cost += parseFloat(readFileSync(cf, 'utf8')) || 0
  }
  total += files.length; green += ok; reasons += withReason
  console.log(`  ${v.padEnd(28)} ожидание ${want.want.padEnd(9)} ${ok}/${files.length}  [${verdicts.join(', ')}]${withReason ? `  слов-причин в ${withReason}` : ''}`)
}
console.log(`\n  ${green}/${total} зелёных · ответов со словами-причинами ${reasons} · цена: $${cost.toFixed(2)}`)
