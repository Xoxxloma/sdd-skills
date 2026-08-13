#!/usr/bin/env node
// grade-handoff.mjs — анкеры хендоффа BS-4 плюс новый анкер раунда 2026-08-13.
//
//   node grade-handoff.mjs <каталог-плеча>
//
// Грейдится ТЕКСТ ХЕНДОФФА (`answer.md`) — это единственная проба петли, где измеряемое
// живёт в чате, а не в файле. Поэтому анкеры держатся на буквальных подстроках формы, а не
// на пересказе: «Годится?» это литерал из скелета Step 6, а не оборот, который агент мог
// выбрать сам.
//
// Анкеры:
//   D  следующий шаг НЕ назван — ни именем скилла, ни словами «тех-спека»/«Дальше:».
//      Правка 2026-08-13 убрала строку «Дальше» из скелета; на плече «до» этот анкер
//      обязан падать — там строка ещё в скилле, и её отсутствие означало бы, что
//      хендофф сломан по другой причине.
//   E  BS-4.1: разрез закрыт вопросом (литерал «Годится?»).
//   F  BS-4.2: отложенный гейт предъявлен в хендоффе — строка про открытые пункты,
//      и она заканчивается вопросом. Знаменатель — прогоны, у которых в документе
//      блок «Открытые вопросы» непуст: спрашивать нечего там, где пунктов нет.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ВНИМАНИЕ на `\w`: в JS без флага `u` он равен [A-Za-z0-9_] и кириллицу НЕ матчит.
// Первая редакция этого файла держала `Открыт\w*\s+пункт` и давала ровный ноль на обоих
// плечах — анкер не срабатывал ни разу, а выглядело это как поведение скилла. Кириллические
// классы здесь выписаны явно: [а-яё].
const NEXT_STEP = /task-decomposition-doc|technical-spec-doc|stage-breakdown-doc|тех[-. ]?спек|техническ[а-яё]+\s+спецификаци|Дальше:/i
// Разрез закрыт вопросом: строка с «?», говорящая про разрез. Литерал «Годится?» из скелета
// сюда входит, но не исчерпывает — «Режем на три слайса — годится?» и «Годится разбиение?»
// это тот же закрытый разрез, а проба спрашивает про вопрос, а не про формулировку.
const CUT_WORDS = /годит|режем|разбива|разбиени|слайс/i
// Отложенный гейт предъявлен: строка с «?» про открытые пункты или прямо про сроки.
const OPEN_WORDS = /открыт[а-яё]*\s+(пункт|вопрос)|срок|дедлайн/i

const arm = process.argv[2]
if (!arm) { console.error('нужен каталог плеча'); process.exit(1) }

const dirs = readdirSync(arm)
  .filter(d => /^run-/.test(d) && statSync(join(arm, d)).isDirectory())
  .sort()

const rows = []
for (const d of dirs) {
  const ans = join(arm, d, 'answer.md')
  if (!existsSync(ans)) { rows.push({ d, skip: 'нет ответа' }); continue }
  const text = readFileSync(ans, 'utf8')

  // Документ прогона — чтобы знать, был ли открытый пункт вообще.
  let hasOpenItems = null
  const stack = [join(arm, d)]
  while (stack.length) {
    const cur = stack.pop()
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.name === 'business_requirements.md') {
        const doc = readFileSync(p, 'utf8')
        const head = doc.slice(0, doc.indexOf('\n## ') + 1 || 2000)
        hasOpenItems = /^>\s*\d+\.\s+\S/m.test(head)
      }
    }
  }

  const qLines = text.split('\n').filter(l => l.includes('?'))
  const nextNamed = NEXT_STEP.test(text)
  const cutQ = qLines.some(l => CUT_WORDS.test(l))
  const openLine = qLines.find(l => OPEN_WORDS.test(l)) || ''
  const openAsked = !!openLine
  rows.push({ d, nextNamed, cutQ, hasOpenItems, openAsked, openLine: openLine.trim().slice(0, 58) })
}

console.log('прогон      след.шаг назван  «Годится?»  откр.пункты в док.  спрошены в хендоффе  строка')
console.log('-'.repeat(120))
for (const r of rows) {
  if (r.skip) { console.log(`${r.d.padEnd(11)} ${r.skip}`); continue }
  console.log(
    `${r.d.padEnd(11)} ${(r.nextNamed ? 'ДА' : 'нет').padEnd(16)} ${(r.cutQ ? 'ДА' : 'нет').padEnd(11)} ` +
    `${(r.hasOpenItems === null ? '—' : r.hasOpenItems ? 'есть' : 'нет').padEnd(19)} ` +
    `${(r.openAsked ? 'ДА' : 'нет').padEnd(20)} ${r.openLine}`)
}

const measured = rows.filter(r => !r.skip)
const withOpen = measured.filter(r => r.hasOpenItems === true)
console.log(`\nИзмерено: ${measured.length} из ${dirs.length}.`)
console.log(`D  следующий шаг НЕ назван: ${measured.filter(r => !r.nextNamed).length} из ${measured.length}` +
  (measured.some(r => r.nextNamed) ? ` — назван: ${measured.filter(r => r.nextNamed).map(r => r.d).join(', ')}` : ''))
console.log(`E  разрез закрыт «Годится?»: ${measured.filter(r => r.cutQ).length} из ${measured.length}`)
console.log(`F  открытые пункты спрошены: ${withOpen.filter(r => r.openAsked).length} из ${withOpen.length} (знаменатель — прогоны с непустым блоком)`)
