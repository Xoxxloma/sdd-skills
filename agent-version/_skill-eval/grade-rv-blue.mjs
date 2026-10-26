#!/usr/bin/env node
// grade-rv-blue.mjs — пробы rv-blue-* (скилл: spec-review, checklist-spec.md), шаг 2 п.2б PLAN-FROM-POCOCK.
//
//   node grade-rv-blue.mjs <каталог плеча> --case=yes|idk|cr|dirty|was
//   node grade-rv-blue.mjs --selftest
//
// Фикстура RV-BLUE: чистые спеки после 2б (SHT-410 — 🔵 по источникам, SHT-411 — 🟡-основа изменения) и двойники с
// посаженными дефектами (SHT-412 — 🔵 без источника, карточка без «Вид», изменение без «Существующего стыка»;
// SHT-413 — «было» у прежнего поля на 🟡-основе).
// UA-420 — мелкая правка, стык 🔵 без пути.
//   yes/idk/cr: ложных пунктов по правилам 2б нет, нет §1 по строке стыка и §7 «🟢 без транспорта» у карточек изменения.
//   dirty/was: посаженное найдено. Прочие нарушения — справкой.

import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { turn, apiFailed } from './br-lib.mjs'

/** Блоки пунктов отчёта: от строки «N. …» до следующей такой строки или до счётной строки. */
export function items (answer) {
  const lines = answer.split('\n')
  const out = []
  let cur = null
  for (const l of lines) {
    if (/^\s*\d+\.\s/.test(l)) { if (cur) out.push(cur); cur = l; continue }
    if (/стоящих только на|нарушений:/i.test(l)) { if (cur) { out.push(cur); cur = null } continue }
    if (cur !== null) cur += '\n' + l
  }
  if (cur) out.push(cur)
  return out
}

const NEW = /источник|«?Вид»?\b|Существующ[а-яё]*\s+стык|«было»|\bбыло\b|🟡-основ/i
const P1 = /к\s+валидации/i
const P7 = /без\s+транспорта|метод\s+и\s+путь|нет\s+(ни\s+)?(метода|пути)/i
const CHANGE_CARD = { yes: /INT-1\b|INT-3\b|INT-4\b/, idk: /INT-1\b|INT-3\b/, cr: /INT-1\b/ }

export function grade (answer, kase) {
  const its = items(answer)
  const v = answer.match(/нарушений:?\**:?\s*\**\s*(\d+)/i)
  const viol = v ? Number(v[1]) : null
  const m = {}
  if (kase === 'yes' || kase === 'idk' || kase === 'cr') {
    const fpNew = its.filter((b) => NEW.test(b))
    const fpP1 = its.filter((b) => P1.test(b) && /стык/i.test(b))
    const fpP7 = its.filter((b) => P7.test(b) && CHANGE_CARD[kase].test(b))
    m['нет ложных по правилам 2б'] = fpNew.length === 0
    m['нет §1 по строке стыка'] = fpP1.length === 0
    m['нет §7 у карточек изменения'] = fpP7.length === 0
    m._other = its.filter((b) => !fpNew.includes(b) && !fpP1.includes(b) && !fpP7.includes(b))
    // Ревью шага 2: счётная строка — метки 🔵 со «со слов» при пути или поле у карточки и в стыке; у SHT-410 их ровно 3.
    if (kase === 'yes') { const c = answer.match(/стоящих только на памяти аналитика:\s*\**\s*(\d+)/i); m['счётная строка = 3'] = !!c && Number(c[1]) === 3 }
  } else if (kase === 'dirty') {
    m['найдено: 🔵 без источника (INT-2)'] = its.some((b) => /источник/i.test(b) && /INT-2\b|пропуск|badge/i.test(b))
    m['найдено: нет «Вид» (INT-5)'] = its.some((b) => /Вид/.test(b) && /INT-5\b|справочник|org/i.test(b))
    m['найдено: изменение без стыка (INT-3)'] = its.some((b) => /Существующ[а-яё]*\s+стык|стык/i.test(b) && /INT-3\b|bikeRack|велосипед|карточк[аи]\s+рейса/i.test(b))
    m._other = its.filter((b) => !/источник|Вид|стык/i.test(b))
  } else {
    m['найдено: «было» на 🟡-основе'] = its.some((b) => /было/i.test(b) && /seatsLeft|🟡/i.test(b))
    m._other = its.filter((b) => !/было/i.test(b))
  }
  m._viol = viol
  return m
}

function selftest () {
  const ok = (name, cond) => { console.log(`  ${cond ? '✅' : '❌'} ${name}`); return cond ? 0 : 1 }
  let f = 0
  const clean = 'нарушений: 0\n\nутверждений, стоящих только на памяти аналитика: 1'
  const g1 = grade(clean, 'idk'); f += ok('yes: счётная строка 1 — красный', !grade(clean, 'yes')['счётная строка = 3']); f += ok('idk чистый — зелёный', g1['нет ложных по правилам 2б'] && g1['нет §1 по строке стыка'] && g1['нет §7 у карточек изменения'])
  const fp7 = 'нарушений: 1\n\n1. §2 INT-3 — карточка 🟢 без транспорта\n   «Существующий стык: 🟡 к валидации»\n   → назовите метод и путь\n'
  f += ok('idk: §7 у изменения пойман', !grade(fp7, 'idk')['нет §7 у карточек изменения'])
  const dirty = 'нарушений: 3\n\n1. §2 INT-2 — конкретика под 🔵 без источника\n   «GET /api/v3/badges»\n2. §2 INT-5 — нет строки «Вид»\n   «### INT-5»\n3. §2 INT-3 — изменение без строки «Существующий стык»\n   «bikeRack»\n'
  const gd = grade(dirty, 'dirty'); f += ok('dirty: три найдены', gd['найдено: 🔵 без источника (INT-2)'] && gd['найдено: нет «Вид» (INT-5)'] && gd['найдено: изменение без стыка (INT-3)'])
  f += ok('dirty: пустой отчёт — красный', !grade('нарушений: 0', 'dirty')['найдено: нет «Вид» (INT-5)'])
  f += ok('was: найдено', grade('нарушений: 1\n\n1. §2 INT-3 — «было» на 🟡-основе\n   «seatsLeft | int»\n', 'was')['найдено: «было» на 🟡-основе'])
  console.log(`самопроверка: ${f ? 'провалов ' + f : '✓'}`)
  return f
}

if (process.argv.includes('--selftest')) process.exit(selftest() ? 1 : 0)
const arg = process.argv[2]
const kase = (process.argv.find((a) => a.startsWith('--case=')) || '').slice(7)
if (!arg || !existsSync(arg) || !['yes', 'idk', 'cr', 'dirty', 'was'].includes(kase)) { console.error('usage: node grade-rv-blue.mjs <каталог плеча> --case=yes|idk|cr|dirty|was'); process.exit(1) }
const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба rv-blue-${kase}, ${arg}`)
let measured = 0; let green = 0
for (const n of runs) {
  const dir = join(arg, n)
  const t1 = turn(dir, 1)
  if (apiFailed(dir, [t1.answer])) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const g = grade(t1.answer || '', kase)
  const bad = Object.entries(g).filter(([k, v]) => !k.startsWith('_') && !v).map(([k]) => k)
  if (!bad.length) green++
  console.log(`  ${n}: ${bad.length ? 'красный' : 'зелёный'} · нарушений ${g._viol ?? '?'}${bad.length ? '  ✗ ' + bad.join(' · ') : ''}`)
  for (const o of g._other.slice(0, 4)) console.log(`        прочее: ${o.split('\n')[0].trim().slice(0, 120)}`)
}
console.log(`\n  ${green}/${measured}\tзелёных  ← КРИТЕРИЙ\n`)
