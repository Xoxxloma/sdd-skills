#!/usr/bin/env node
// grade-rv-lim.mjs — пробы rv-lim-* / rv-crlim-* (скилл: spec-review), п.2 PLAN-FROM-POCOCK, шаг 4.
//
//   node grade-rv-lim.mjs <каталог плеча> --case=bt-clean|bt-dirty|cr-clean|cr-dirty
//
// ЧТО МЕРЯЕТСЯ — счётная строка «порог без примера на границе» (фикстура RV-LIM): число верное, и
// отсутствие примера не выдано за нарушение (Р9: пример — форма гипотезы, не условие закрытия гейта).

import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { turn, apiFailed } from './br-lib.mjs'

const CASES = {
  'bt-clean': { re: /критериев с порогом без примера на границе:\s*\**\s*(\d+)/i, want: 0 },
  'bt-dirty': { re: /критериев с порогом без примера на границе:\s*\**\s*(\d+)/i, want: 2 },
  'cr-clean': { re: /как должно стать»?\s*с порогом без примера на границе:\s*\**\s*(\d+)/i, want: 0 },
  'cr-dirty': { re: /как должно стать»?\s*с порогом без примера на границе:\s*\**\s*(\d+)/i, want: 1 },
}
const arg = process.argv[2]
const kase = (process.argv.find((a) => a.startsWith('--case=')) || '').slice(7)
if (!arg || !existsSync(arg) || !CASES[kase]) { console.error('usage: node grade-rv-lim.mjs <каталог плеча> --case=bt-clean|bt-dirty|cr-clean|cr-dirty'); process.exit(1) }
const { re, want } = CASES[kase]

const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба rv-lim ${kase}, ${arg} (ждём счёт ${want})`)
let measured = 0; let green = 0
for (const n of runs) {
  const dir = join(arg, n)
  const t1 = turn(dir, 1)
  if (apiFailed(dir, [t1.answer])) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const a = t1.answer || ''
  const m = a.match(re)
  const got = m ? Number(m[1]) : null
  const v = a.match(/нарушений:?\**:?\s*\**\s*(\d+)/i)
  const viol = v ? Number(v[1]) : null
  // Нарушение «про границу» — пункт списка, где речь о границе / ближайшем значении (сама счётная строка не в счёт).
  const items = a.split('\n').filter((l) => !re.test(l) && /^\s*\d+\.\s/.test(l))
  const aboutEdge = items.filter((l) => /границ|ближайш|7\s?500[,.]01|26-?(я|ю|е|го)/i.test(l))
  // Число без совета (ревью 5.74): строка о пороге/границе с призывом что-то сделать — ведущий превратил счёт в просьбу.
  const advice = a.split('\n').filter((l) => !re.test(l) && /(порог|границ)/i.test(l) && /посмотрите|дополните|допишите|закройте|уточните|если хотите|стоит\s+(учесть|проверить|закрыть|добавить)|рекоменду/i.test(l))
  // Шапка «нарушений: N» — гейт для оркестратора; у документов RV-LIM нарушений нет (круг 1: 0 во всех 8 прогонах).
  const pass = got === want && aboutEdge.length === 0 && advice.length === 0 && viol === 0
  if (pass) green++
  console.log(`  ${n}: ${pass ? 'зелёный' : 'красный'}  · счёт ${got ?? 'НЕТ СТРОКИ'} · нарушений ${viol ?? '?'}${aboutEdge.length ? ` · ⚠ нарушение про границу: ${aboutEdge[0].trim().slice(0, 100)}` : ''}${advice.length ? ` · ⚠ совет к числу: ${advice[0].trim().slice(0, 110)}` : ''}`)
  if (viol) for (const l of items.slice(0, 4)) console.log(`        ${l.trim().slice(0, 130)}`)
}
console.log(`\n  ${green}/${measured}\tзелёных  ← КРИТЕРИЙ\n`)
