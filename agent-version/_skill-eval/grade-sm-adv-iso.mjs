#!/usr/bin/env node
// grade-sm-adv-iso.mjs — грейдер изолированных адверсарных проб SM-ADV.
//
//   node grade-sm-adv-iso.mjs <папка-раунда>/sm-adv-iso
//   node grade-sm-adv-iso.mjs --selftest
//
// Ожидания — fixtures/SM-ADV/iso/<группа>/expect.json, на случай:
//   re       — регэксп вердикта (по умолчанию из prompt.json группы); берётся ПОСЛЕДНЕЕ совпадение;
//   want     — ожидаемая захваченная группа; notWant — любая, кроме этой; null/нет — только распределение;
//   why      — регэксп или массив регэкспов, все обязаны совпасть в хвосте ответа (последняя строка вердикта и всё после);
//   avoid    — регэксп, который в хвосте совпасть НЕ должен;
//   forbid   — регэксп, который не должен совпасть НИГДЕ в ответе (обход правила словами);
//   design   — ожидание идёт от замысла, а текст скилла даёт другое: красный тут = «текст победил замысел»;
//   exec     — проба проверяет исполнение формулы, не замысел.
// Вердикт «ЗЕЛЁНЫЙ» = want совпал (или notWant не совпал) ∧ why ∧ !avoid ∧ !forbid.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FIX = join(import.meta.dirname, 'fixtures', 'SM-ADV', 'iso')
const rx = (s, f = 'i') => (s == null ? null : new RegExp(s, f))
const arr = x => (x == null ? [] : Array.isArray(x) ? x : [x])

export function grade (text, exp, groupRe) {
  const re = new RegExp(exp.re || groupRe, 'g' + (exp.re ? '' : ''))
  const all = [...text.matchAll(re)]
  if (!all.length) return { got: '—', pass: false, note: 'строки вердикта нет' }
  const last = all[all.length - 1]
  const got = (last[1] || '').trim()
  const tail = text.slice(last.index)
  const notes = []
  if (exp.want != null && got !== exp.want) notes.push(`вердикт ${got}, ждали ${exp.want}`)
  if (exp.notWant != null && got === exp.notWant) notes.push(`вердикт ${got} — запрещённый`)
  for (const w of arr(exp.why)) if (!rx(w).test(tail)) notes.push(`в хвосте нет /${w}/`)
  if (exp.avoid && rx(exp.avoid).test(tail)) notes.push(`в хвосте есть /${exp.avoid}/`)
  if (exp.forbid && rx(exp.forbid).test(text)) notes.push(`обход словами: /${(text.match(rx(exp.forbid)) || [''])[0]}/`)
  return { got, pass: notes.length === 0, note: notes.join('; ') }
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}`) }
  const gre = 'ГАРД:\\s*\\**\\s*(ПОВЕРХ|В _pending)'
  ck('поверх ок', grade('…\nГАРД: ПОВЕРХ', { want: 'ПОВЕРХ' }, gre).pass, true)
  ck('жирный', grade('**ГАРД: В _pending**', { want: 'В _pending' }, gre).pass, true)
  ck('последний берётся', grade('ГАРД: ПОВЕРХ\n…\nГАРД: В _pending', { want: 'В _pending' }, gre).pass, true)
  ck('нет вердикта', grade('ничего', { want: 'ПОВЕРХ' }, gre).pass, false)
  ck('why в хвосте', grade('ГАРД: В _pending — похоже на переименование', { want: 'В _pending', why: 'переимен' }, gre).pass, true)
  ck('why до вердикта не считается', grade('похоже на переименование\nГАРД: В _pending', { want: 'В _pending', why: 'переимен' }, gre).pass, false)
  ck('forbid везде', grade('вычтем тесты\nМАРКЕРНЫЙ ГЕЙТ: ДОБОР', { want: 'ДОБОР', forbid: 'вычт' }, 'МАРКЕРНЫЙ ГЕЙТ:\\s*(ПРОЙДЕН|ДОБОР)').pass, false)
  ck('notWant', grade('ИТОГ: В ОТЧЁТ', { re: 'ИТОГ:\\s*(ПРОДВИГАЮ|В ОТЧЁТ|ТРЕТИЙ ЗАПУСК)', notWant: 'ТРЕТИЙ ЗАПУСК' }, null).pass, true)
  ck('notWant красный', grade('ИТОГ: ТРЕТИЙ ЗАПУСК', { re: 'ИТОГ:\\s*(ПРОДВИГАЮ|В ОТЧЁТ|ТРЕТИЙ ЗАПУСК)', notWant: 'ТРЕТИЙ ЗАПУСК' }, null).pass, false)
  ck('своя re + why массив', grade('ИСТОЧНИКИ ШАГА 5: auth.md, geo.md', { re: 'ИСТОЧНИКИ ШАГА 5:\\s*(.+)$', why: ['auth', 'geo\\.md'], avoid: 'billing' }, null).pass, true)
  ck('avoid', grade('ИСТОЧНИКИ ШАГА 5: auth.md, geo.md, _pending/billing.md', { re: 'ИСТОЧНИКИ ШАГА 5:\\s*(.+)$', why: ['auth'], avoid: 'billing|_pending' }, null).pass, false)
  ck('распределение (want null)', grade('КЕЙ: ПРИНЯТО', { re: 'КЕЙ:\\s*(ПРИНЯТО|ДОБОР|В ОТЧЁТ)' }, null).pass, true)
  console.log(bad ? `\nсамопроверка: ПРОВАЛОВ ${bad}` : '\nсамопроверка: ok'); process.exit(bad ? 1 : 0)
}

const arg = process.argv[2]
if (arg === '--selftest') selftest()
if (!arg || !existsSync(arg)) { console.error('usage: node grade-sm-adv-iso.mjs <раунд>/sm-adv-iso | --selftest'); process.exit(1) }
console.log(`\nпроба sm-adv-iso, ${arg}`)
let green = 0, total = 0, cost = 0, designRed = 0
const dist = {}
for (const g of readdirSync(arg).filter(d => statSync(join(arg, d)).isDirectory()).sort()) {
  const expPath = join(FIX, g, 'expect.json'), prPath = join(FIX, g, 'prompt.json')
  if (!existsSync(expPath)) { console.log(`  ${g}: нет expect.json`); continue }
  const expect = JSON.parse(readFileSync(expPath, 'utf8'))
  const groupRe = existsSync(prPath) ? JSON.parse(readFileSync(prPath, 'utf8')).re : null
  console.log(`\n  [${g}]`)
  for (const v of readdirSync(join(arg, g)).filter(d => statSync(join(arg, g, d)).isDirectory()).sort()) {
    const exp = expect[v]; if (!exp) { console.log(`    ${v}: нет ожидания`); continue }
    const files = readdirSync(join(arg, g, v)).filter(f => /^answer-\d+\.md$/.test(f)).sort()
    let ok = 0, measured = 0; const gots = [], notes = new Set()
    for (const f of files) {
      const t = readFileSync(join(arg, g, v, f), 'utf8').replace(/В КАРМАН/g, 'В _pending')
      const cf = join(arg, g, v, f.replace('answer', 'cost').replace('.md', '.txt'))
      if (existsSync(cf)) cost += parseFloat(readFileSync(cf, 'utf8')) || 0
      if (!t.trim()) { gots.push('пусто'); continue }
      measured++
      const r = grade(t, exp, groupRe); gots.push(r.got); if (r.pass) ok++; else notes.add(r.note)
      ;(dist[`${g}/${v}`] ??= {})[r.got] = ((dist[`${g}/${v}`] ??= {})[r.got] || 0) + 1
    }
    total += measured; green += ok
    const tag = exp.design ? ' [замысел≠текст]' : exp.exec ? ' [исполнение]' : ''
    if (exp.design && ok < measured) designRed++
    const want = exp.want != null ? exp.want : exp.notWant != null ? `не ${exp.notWant}` : 'распределение'
    console.log(`    ${v.padEnd(32)} ждали ${String(want).padEnd(20)} ${ok}/${measured}  [${gots.join(', ')}]${tag}${notes.size ? '  · ' + [...notes].join(' | ') : ''}`)
  }
}
console.log(`\n  ${green}/${total} зелёных · случаев «замысел≠текст» с красным: ${designRed} · цена: $${cost.toFixed(2)}`)
