#!/usr/bin/env node
// grade-bs6.mjs — извлекает §4.5 из артефактов прогона и считает механические сигналы.
//
// Скрипт НЕ выносит вердикт. Он отвечает только на то, на что можно ответить строкой
// (есть ли секция, есть ли «не применимо», сколько строк слайсов, какие запрещённые
// обороты встретились), и печатает §4.5 целиком — качественные критерии BS-6
// («границы по деливерблам», «ценность в одиночку непуста») читаются глазами.
//
// Так сделано намеренно: в этой репе грейд по самоотчёту модели уже дважды расходился
// с фактом, а грейд регуляркой по смысловому критерию — красил верный текст в провал.
//
// usage: node grade-bs6.mjs <каталог с песочницами>

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
if (!root || !existsSync(root)) {
  console.error('usage: node grade-bs6.mjs <каталог с песочницами>')
  process.exit(1)
}

/** Рекурсивно ищет первый .md в каталоге. */
/** ПОРЯДОК ОБХОДА ЗДЕСЬ РЕШАЕТ ВСЁ, И ОДНАЖДЫ УЖЕ СОЛГАЛ.
 *  `answer.md` (ответ прогона, кладёт раннер) в листинге идёт РАНЬШЕ каталога `docs/`, и
 *  прежняя редакция возвращала его вместо записанного БТ: на боевой раскладке грейдер
 *  печатал «файл ✓» для 20 песочниц из 20, где БТ реально было 11, и «§4.5 НЕТ» для 19 из 20.
 *  Самопроверка этого не ловила, потому что в `fixtures/bs6-validate/*` лежит ТОЛЬКО
 *  `business_requirements.md` — раскладка, которой в бою не бывает. Отсюда правило:
 *  вход самопроверки обязан повторять боевую раскладку, включая служебные файлы стенда,
 *  иначе он проверяет грейдер на задаче, которой тот не решает.
 *  Служебные файлы раннера исключены по имени; сначала обходим подкаталоги. */
const HARNESS_FILES = new Set(['answer.md', '_api-failure.txt'])

function findMd(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const found = findMd(join(dir, e.name))
    if (found) return found
  }
  for (const e of entries) {
    if (e.isDirectory()) continue
    if (HARNESS_FILES.has(e.name)) continue
    if (e.name.endsWith('.md')) return join(dir, e.name)
  }
  return null
}

/** Вырезает §4.5: от заголовка, начинающегося с «4.5», до следующего заголовка не про 4.5. */
function section45(text) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^#{1,6}\s*(§\s*)?4\.5\b/.test(l))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i]) && !/^#{1,6}\s*(§\s*)?4\.5\b/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

const BANNED = [
  [/бесполезн/gi, 'сцепка: «бесполезно без …»'],
  [/(одни|те)\s+же\s+данны|единый\s+источник|один\s+источник|общий\s+источник/gi, 'общий источник'],
  [/на\s+этапе\s+тех|при\s+разработке\s+техническ|в\s+тех[.-]?\s?спек/gi, 'решение отложено вниз'],
  [/один\s+экран|одна\s+бизнес-цель|одной\s+цели|единая\s+цель/gi, 'один экран / одна цель'],
]

// Маркеры процедуры ШАГА 1. Она — инструкция скиллу и живёт в блоке `Output template`;
// в артефакт должна попадать только её ВЫХОД: таблица слайсов либо строка «не применимо».
// Заголовки пунктов, попавшие в файл, — утечка инструкции в документ для заказчика.
const PROCEDURE = [
  /ш[аa]г\s*[12]\b/i,
  /^\s*\**\s*анализ\b/im,
  /назови\s+числа/i,
  /типовой\s+исход/i,
  /^\s*\d\.\s*\**\s*(числа|порог|ценность)/im,
  /порог\s*(сработал|срабатывает|:)/i,
]

// Проверка СТРУКТУРНАЯ, а не по словам, и это принципиально: словарный вариант дал 3 ложных
// «чисто» из 20 — прогоны пересказывают ту же процедуру своими заголовками («Числа:»,
// «Пороговое решение:», «Пункт 3: Порог»), и перечислить все формулировки нельзя.
// По шаблону в §4.5 допустимы ровно две формы: таблица слайсов ИЛИ строка «не применимо:
// <причина>». Всё, что сверх этого, — пересказ инструкции в документе для заказчика.
function hasProcedure(sec) {
  const prose = sec
    .split(/\r?\n/)
    .slice(1) // без строки заголовка секции
    .filter((l) => l.trim() && !/^\s*\|/.test(l) && !/^\s*```/.test(l))
  // «не применимо: причина» законно занимает строку-две; таблица — ноль.
  return prose.length > 2 || PROCEDURE.some((re) => re.test(sec))
}

/** Строки данных таблицы: | … | — без строки-разделителя и без шапки. */
function sliceRows(sec) {
  const pipes = sec.split(/\r?\n/).filter((l) => /^\s*\|/.test(l))
  const hasSep = pipes.some((l) => /^\s*\|[\s:|-]+\|?\s*$/.test(l))
  const data = pipes.filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l))
  return hasSep ? Math.max(0, data.length - 1) : data.length
}

const dirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const rows = []
const bodies = []

for (const d of dirs) {
  const md = findMd(join(root, d))
  if (!md) {
    // «ПРОГОН НЕ СОСТОЯЛСЯ» И «ПРОГОН НЕ НАПИСАЛ ФАЙЛ» — РАЗНЫЕ ИСХОДЫ.
    // Прежняя редакция звала «не измерено» любую песочницу без документа и выбрасывала её
    // из знаменателя. Под это правило попадал состоявшийся прогон, который просто не дошёл
    // до записи (остановился на карте понимания или напечатал спеку в чат) — а это 3–4
    // прогона из 10 на `bs6`. В результате BS-6 считалась с 5–6 наблюдений вместо 10, и
    // редакции скилла становились неразличимы ПО ПОСТРОЕНИЮ. Хуже: настоящий дефект
    // («карта вместо записи», уже лечившийся на br2-prompt 7/10 → 19/19) прятался под
    // видом отсутствия данных.
    // Признак «прогон состоялся» — непустой `answer.md`, а не наличие документа.
    const ansPath = join(root, d, 'answer.md')
    const ran = existsSync(ansPath) && statSync(ansPath).size > 0
    rows.push({
      run: d, file: ran ? 'НЕ ЗАПИСАН' : '—', s45: '—', naprim: '—', proc: '—', slices: '—',
      banned: ran ? 'ПРОВАЛ: прогон состоялся, документа нет' : 'НЕ ИЗМЕРЕНО (прогона не было)',
    })
    continue
  }
  const text = readFileSync(md, 'utf8')
  const sec = section45(text)
  if (sec === null) {
    rows.push({ run: d, file: '✓', s45: 'НЕТ', naprim: '—', proc: '—', slices: '—', banned: '' })
    bodies.push(`### ${d} — секции 4.5 в файле НЕТ`)
    continue
  }
  const naprim = /не\s+примен/i.test(sec)
  const hits = BANNED.filter(([re]) => re.test(sec)).map(([, label]) => label)
  rows.push({
    run: d,
    file: '✓',
    s45: '✓',
    naprim: naprim ? 'ДА' : 'нет',
    proc: hasProcedure(sec) ? 'ДА' : 'нет',
    slices: String(sliceRows(sec)),
    banned: hits.join(', '),
  })
  bodies.push(`### ${d}\n${sec.trim()}`)
}

const pad = (s, n) => String(s).padEnd(n)
console.log(pad('прогон', 10), pad('файл', 6), pad('§4.5', 6), pad('«не примен.»', 13), pad('процедура', 10), pad('строк', 7), 'обороты')
console.log('-'.repeat(95))
for (const r of rows) {
  console.log(pad(r.run, 10), pad(r.file, 6), pad(r.s45, 6), pad(r.naprim, 13), pad(r.proc, 10), pad(r.slices, 7), r.banned)
}

// ТРИ РАЗНЫХ ЗНАМЕНАТЕЛЯ, И ПУТАТЬ ИХ НЕЛЬЗЯ.
//   ran      — прогон состоялся (есть ответ). Знаменатель для «дошёл ли до записи».
//   measured — есть документ. Знаменатель для всего, что читается ИЗ документа.
//   noFile   — состоялся, но документа нет. Это ПРОВАЛ, а не отсутствие данных.
// Прежде noFile молча уезжал в «не измерено», и BS-6 считалась с половины пула.
const ran = rows.filter((r) => r.file === '✓' || r.file === 'НЕ ЗАПИСАН')
const noFile = rows.filter((r) => r.file === 'НЕ ЗАПИСАН')
const measured = rows.filter((r) => r.file === '✓')
const naprimCount = measured.filter((r) => r.naprim === 'ДА').length
console.log('')
console.log(`Прогонов состоялось: ${ran.length} из ${dirs.length} песочниц.`)
console.log(`Дошли до записи документа: ${measured.length} из ${ran.length}.` +
  (noFile.length ? `  ← ПРОВАЛ у ${noFile.length}: ${noFile.map((r) => r.run).join(', ')} (состоялись, документа нет — это дефект, а не «нет данных»)` : ''))
console.log(`Измерено по документу: ${measured.length} из ${dirs.length}.`)
console.log(`«не применимо» в §4.5: ${naprimCount} из ${measured.length}.`)
console.log(`Процедура ШАГА 1 переписана в файл: ${measured.filter((r) => r.proc === 'ДА').length} из ${measured.length}.`)
// Предупреждение только про НЕСОСТОЯВШИЕСЯ прогоны. Раньше оно печаталось и тогда, когда
// документа нет у состоявшегося прогона, — то есть накрывало провал формулировкой «это не
// провал», ровно наоборот смыслу.
if (ran.length !== dirs.length) {
  console.log(`ВНИМАНИЕ: прогонов не состоялось ${dirs.length - ran.length} — это «не измерено», а не «провалено», в знаменатель они не идут.`)
}

console.log('\n\n===== §4.5 каждого прогона (для качественных критериев) =====\n')
console.log(bodies.join('\n\n'))
