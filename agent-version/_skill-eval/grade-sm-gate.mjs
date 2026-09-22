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
  // строка на поле и вторая строка на то же значение — форма строки «продлена» из образца шаблона (аудит, С17)
  g: { verdict: 'ДОБОР', why: /weightKg|перевешен|строк[аи] на поле|имя поля|дв[еух]+ строк/i },
  // дата, которой состояние отличается, рядом со значением в скобках — форма, которую бриф разрешает
  // («как `expiresAt` в примере шаблона»); гейт (3) обязан её пропускать
  h: { verdict: 'ПРОЙДЕН' },
  i: { verdict: 'ДОБОР', why: /таблиц|значени|Владеет|\|/i },
  j: { verdict: 'ДОБОР', why: /письмо|сообщени|заголов/i },
  k: { verdict: 'ДОБОР', why: /заголов|ключ|Shipment/i },
  l: { verdict: 'ДОБОР', why: /заполнит|не определено|одинаков|CANCELLED|LOST|перехода/i },
  n: { verdict: 'ПРОЙДЕН' },
  o: { verdict: 'ДОБОР', why: /хозя|управля|конфиг|ограничени|манифест/i },
  p: { verdict: 'ДОБОР', why: /BOX|PALLET|запят|справочник|упаковк/i },
  q: { verdict: 'ДОБОР', why: /сообщени|слил|один блок|задержан|два блока|заголов/i },
  r: { verdict: 'ПРОЙДЕН' },
  s: { verdict: 'ДОБОР', why: /значени|ShipmentStatus|status|перечислен/i },
  // валидация входа, названная именем внешней системы: число 5 требует лишь, чтобы хозяин был
  // НАЗВАН, и «имя внешней системы» этому удовлетворяет — в поле так прошли 4 карточки из 5
  // (21.09). Хозяин обязан быть переключателем: имя из манифеста, роль или система из «Зависит от».
  t: { verdict: 'ДОБОР', why: /Каскад|Зависит от|валидац|хозя|переключат|манифест/i },
  // поля «Владеет данными» слиты в одну строку через «·» — с прода 22.09 (navigator: до 14 полей в строке);
  // грепы считают строки, не поля, поэтому проверка «одно поле на строку» заведена явно
  u: { verdict: 'ДОБОР', why: /одн[оу] строк|одно поле|слипш|·|Владеет/i },
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
  // Добор за посаженное, но заодно требует блоки для справочников — след К7. У «u» слипшаяся строка
  // сама содержит packageType/PALLET — ответ цитирует её законно, поэтому «u» из проверки исключён.
  const junk = !['f', 'p', 'i', 'u'].includes(variant) && verdict === 'ДОБОР' && /Attachment|packageType|PHOTO|PALLET/.test(tail)
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
  ck('двойник G — строка на поле названа', grade('ГЕЙТ: ДОБОР — строка «перевешено» с `weightKg` — строка на поле', 'g').pass, true)
  ck('двойник G — пропущен', grade('ГЕЙТ: ПРОЙДЕН', 'g').pass, false)
  ck('берётся последняя строка', grade('ГЕЙТ: ПРОЙДЕН — так было бы, но\nГЕЙТ: ДОБОР — блок `Courier`', 'a').pass, true)
  ck('двойник N — не определено проходит', grade('ГЕЙТ: ПРОЙДЕН', 'n').pass, true)
  ck('двойник L — заполнитель назван', grade('ГЕЙТ: ДОБОР — строки CANCELLED и LOST одинаковым правилом, нужно «не определено»', 'l').pass, true)
  ck('двойник O — хозяин назван', grade('ГЕЙТ: ДОБОР — в ограничении не назван хозяин, конфиг им не является', 'o').pass, true)
  ck('двойник P — справочник назван', grade('ГЕЙТ: ДОБОР — строка BOX/PALLET: два токена, справочник', 'p').pass, true)
  ck('двойник Q — слитые сообщения названы', grade('ГЕЙТ: ДОБОР — сообщений в карточке 1 при 2 строках описи: два вида слиты в один блок', 'q').pass, true)
  ck('двойник R — верный добор проходит', grade('ГЕЙТ: ПРОЙДЕН', 'r').pass, true)
  ck('двойник S — тип без значений назван', grade('ГЕЙТ: ДОБОР — у `status` в «Владеет данными» имя типа ShipmentStatus вместо значений через |', 's').pass, true)
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
