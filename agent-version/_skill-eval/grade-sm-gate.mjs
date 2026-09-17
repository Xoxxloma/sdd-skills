#!/usr/bin/env node
// grade-sm-gate.mjs — изолированная проба гейта «Бизнес-правила» у ведущего `service-map` (фикстура SM-GATE).
//
//   node grade-sm-gate.mjs <папка-раунда>/sm-gate
//   node grade-sm-gate.mjs --selftest
//
// Читается ПОСЛЕДНЯЯ строка вида «ГЕЙТ: …» в ответе. Верная карточка обязана пройти; у грязного
// двойника мало слова «ДОБОР» — в причине должно стоять посаженное место, иначе добор назначен
// не за то (ровно так выглядел дефект К7: добор за блоки для справочников).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const WANT = {
  clean: { verdict: 'ПРОЙДЕН' },
  a: { verdict: 'ДОБОР', why: /Courier/ },
  b: { verdict: 'ДОБОР', why: /priority/i },
  c: { verdict: 'ДОБОР', why: /Department|на чтение|чуж/i },
  d: { verdict: 'ДОБОР', why: /ограничени|управля/i },
  e: { verdict: 'ДОБОР', why: /заголов|бэктик|shipment\.delivered/i },
  f: { verdict: 'ДОБОР', why: /BOX|PALLET|упаковк|справочник/i },
}
const RE_VERDICT = /ГЕЙТ:\s*\**\s*(ПРОЙДЕН|ДОБОР)([^\n]*)/g

export function grade (text, variant) {
  const all = [...text.matchAll(RE_VERDICT)]
  if (!all.length) return { verdict: null, pass: false, note: 'строки «ГЕЙТ: …» нет' }
  const last = all[all.length - 1]
  const verdict = last[1]; const tail = last[2] + text.slice(last.index).split('\n').slice(1).join('\n')
  const w = WANT[variant]
  if (verdict !== w.verdict) return { verdict, pass: false, note: verdict === 'ДОБОР' ? 'ЛОЖНЫЙ добор: ' + last[2].trim().slice(0, 110) : 'посаженное ПРОПУЩЕНО' }
  if (w.why && !w.why.test(tail)) return { verdict, pass: false, note: 'добор не за то: ' + last[2].trim().slice(0, 110) }
  // Добор за посаженное, но заодно требует блоки для справочников — след К7.
  const junk = variant !== 'f' && verdict === 'ДОБОР' && /Attachment|packageType|PHOTO|PALLET/.test(tail)
  return { verdict, pass: !junk, note: junk ? 'заодно требует блоки для справочников' : '' }
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  ck('чистая — пройден', grade('…\nГЕЙТ: ПРОЙДЕН', 'clean').pass, true)
  ck('чистая — ложный добор', grade('ГЕЙТ: ДОБОР — добавить блок `Attachment`', 'clean').pass, false)
  ck('жирная разметка', grade('**ГЕЙТ: ПРОЙДЕН**', 'clean').pass, true)
  ck('двойник A — добор за Courier', grade('ГЕЙТ: ДОБОР — нет блока `Courier` (ACTIVE, BLOCKED)', 'a').pass, true)
  ck('двойник A — пропущен', grade('ГЕЙТ: ПРОЙДЕН', 'a').pass, false)
  ck('двойник A — добор не за то', grade('ГЕЙТ: ДОБОР — переписать заголовок сообщения', 'a').pass, false)
  ck('двойник A — заодно справочники', grade('ГЕЙТ: ДОБОР — блок `Courier` и блок `Attachment` с PHOTO', 'a').pass, false)
  ck('двойник F — упаковка названа', grade('ГЕЙТ: ДОБОР — строка «тип упаковки (`BOX` / `PALLET`)» — справочник', 'f').pass, true)
  ck('берётся последняя строка', grade('ГЕЙТ: ПРОЙДЕН — так было бы, но\nГЕЙТ: ДОБОР — блок `Courier`', 'a').pass, true)
  ck('нет строки вердикта', grade('всё хорошо', 'clean').pass, false)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

const arg = process.argv[2]
if (arg === '--selftest') selftest()
if (!arg || !existsSync(arg)) { console.error('usage: node grade-sm-gate.mjs <раунд>/sm-gate | --selftest'); process.exit(1) }
console.log(`\nпроба sm-gate, ${arg}`)
let cost = 0; let total = 0; let green = 0
for (const variant of Object.keys(WANT)) {
  const dir = join(arg, variant)
  if (!existsSync(dir)) { console.log(`  ${variant}: нет прогонов`); continue }
  const files = readdirSync(dir).filter((n) => /^answer-\d+\.md$/.test(n)).sort()
  const rows = files.map((f) => {
    const text = readFileSync(join(dir, f), 'utf8')
    const c = join(dir, f.replace('answer', 'cost').replace('.md', '.txt'))
    if (existsSync(c)) cost += Number(readFileSync(c, 'utf8')) || 0
    return text.trim() ? grade(text, variant) : { verdict: null, pass: false, note: 'пустой ответ — НЕ ИЗМЕРЕНО', empty: true }
  })
  const measured = rows.filter((r) => !r.empty)
  const ok = measured.filter((r) => r.pass).length
  total += measured.length; green += ok
  const notes = [...new Set(measured.filter((r) => !r.pass).map((r) => r.note))]
  console.log(`  ${variant.padEnd(6)} ожидание ${WANT[variant].verdict.padEnd(8)} ${ok}/${measured.length}  ${measured.map((r) => r.verdict ?? '?').join(' ')}${notes.length ? '  · ' + notes.join(' | ') : ''}`)
}
console.log(`\n  ${green}/${total}\tзелёных  ← КРИТЕРИЙ: верная карточка проходит, каждый двойник уходит в добор за посаженное`)
console.log(`  цена: $${cost.toFixed(2)}\n`)
