#!/usr/bin/env node
// grade-rt.mjs — пробы rt-bug / rt-feature: МАРШРУТ проводника, под-скиллы заглушены.
//
//   node grade-rt.mjs <каталог с песочницами> --probe=bug|feature
//   node grade-rt.mjs --selftest
//
// ЧТО ГРЕЙДИТСЯ. `_trace.log` — файл, который заглушки пишут на диск, вызванные по-настоящему.
// НЕ отчёт агента: он может рассказать о вызове, не сделав его, и наоборот. Правило репы
// «грейдить файл, а не формулировку» здесь означает «грейдить след вызова, а не пересказ».
//
// ПОЧЕМУ ТРАССА, А НЕ ПОТОК. Поток (`stream.jsonl`) показал бы вызовы точнее, но заглушка пишет
// в трассу ещё и ПЕРЕДАННОЕ (источник, флаг багфикса), чего в имени вызова нет. Поток остаётся
// вторым источником: по нему `check-escape.mjs` доказывает побег.
//
// ПРАВИЛА: регулярки литеральные; `\b`/`\w` рядом с кириллицей НЕ применять; побег — «не
// измерено»; счётчик на каждый дефект.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

export function isApiFailure (t) {
  if (!t) return true
  if (t.length > 600) return false
  return RE_API_FAILURE.test(t.slice(0, 300))
}

/** Строки трассы → массив имён под-скиллов в порядке вызова. */
export function parseTrace (text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

const SKILL_OF = (line) => line.split(/\s+/)[0]

export function gradeRun (dir, probe) {
  const r = { dir, probe, measured: true, why: '' }
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  if (existsSync(join(dir, '_escaped.txt'))) { r.measured = false; r.why = 'побег из песочницы'; return r }
  if (isApiFailure(ans)) { r.measured = false; r.why = 'отказ API'; return r }

  const tracePath = join(dir, '_trace.log')
  r.lines = existsSync(tracePath) ? parseTrace(readFileSync(tracePath, 'utf8')) : []
  r.calls = r.lines.map(SKILL_OF)
  r.calledAny = r.calls.length > 0

  // Оркестратор писать документы не должен — их пишут под-скиллы. Файл есть, а вызова нет =
  // сделал работу сам.
  r.docs = existsSync(join(dir, 'docs')) ? readdirSync(join(dir, 'docs')) : []

  r.first = r.calls[0] ?? null
  r.calledBugReport = r.calls.includes('bug-report-doc')
  r.calledBT = r.calls.includes('business-requirements-doc')
  r.calledReview = r.calls.includes('spec-review')
  r.calledSpec = r.calls.includes('technical-spec-doc')
  r.calledStages = r.calls.includes('stage-breakdown-doc')
  // Разрез: заглушки `task-decomposition-doc` нет намеренно — её вызов виден только в потоке.
  // В трассе признак другой: до спеки дошёл, а лишнего документа не появилось.
  r.decomposition = r.docs.some((d) => existsSync(join(dir, 'docs', d, 'decomposition.md')))

  // Флаг багфикса и источник заглушка спеки пишет в свою строку.
  const specLine = r.lines.find((l) => l.startsWith('technical-spec-doc')) ?? ''
  r.specSource = /источник=(\S+)/.exec(specLine)?.[1] ?? ''
  r.specFlag = /флаг=(\S+)/.exec(specLine)?.[1] ?? ''
  r.flagBugfix = /багфикс/i.test(r.specFlag)
  r.sourceIsReport = /bug_report\.md/.test(r.specSource)

  if (probe === 'bug') {
    r.wrongFirst = r.first !== null && r.first !== 'bug-report-doc'
    r.pass = r.first === 'bug-report-doc' && !r.calledBT && !r.decomposition &&
      r.calledSpec && r.flagBugfix && r.sourceIsReport
  } else {
    r.wrongFirst = r.first !== null && r.first !== 'business-requirements-doc'
    r.pass = r.first === 'business-requirements-doc' && !r.calledBugReport
  }
  return r
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────────────────

const REF_BUG = `bug-report-doc
spec-review docs/ARS-312/bug_report.md
technical-spec-doc источник=docs/ARS-312/bug_report.md флаг=багфикс
spec-review docs/ARS-312/technical_specification.md
stage-breakdown-doc`

const REF_FEATURE = `business-requirements-doc
spec-review docs/SMSEC-77/business_requirements.md
technical-spec-doc источник=docs/SMSEC-77/business_requirements.md флаг=обычный`

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  const b = parseTrace(REF_BUG).map(SKILL_OF)
  ck('первый вызов багфикса', b[0], 'bug-report-doc')
  ck('БТ не вызывался', b.includes('business-requirements-doc'), false)
  ck('спека вызвана', b.includes('technical-spec-doc'), true)
  const specLine = parseTrace(REF_BUG).find((l) => l.startsWith('technical-spec-doc'))
  ck('флаг багфикса прочитан', /флаг=(\S+)/.exec(specLine)[1], 'багфикс')
  ck('источник — репорт', /bug_report\.md/.test(/источник=(\S+)/.exec(specLine)[1]), true)
  const f = parseTrace(REF_FEATURE).map(SKILL_OF)
  ck('первый вызов фичи', f[0], 'business-requirements-doc')
  ck('баг-репорт не вызывался', f.includes('bug-report-doc'), false)
  ck('пустая трасса — ноль вызовов', parseTrace('').length, 0)
  ck('отказ API', isApiFailure('API Error: Request not allowed'), true)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  return bad === 0
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1)
const root = argv.find((x) => !x.startsWith('--'))
const pa = argv.find((x) => x.startsWith('--probe='))
const PROBE = pa ? pa.slice('--probe='.length) : ''
if (!root || !['bug', 'feature'].includes(PROBE)) {
  console.error('usage: node grade-rt.mjs <каталог> --probe=bug|feature'); process.exit(1)
}

const all = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^run-\d+$/.test(e.name))
  .map((e) => gradeRun(join(root, e.name), PROBE))
  .sort((a, b) => a.dir.localeCompare(b.dir))

const ok = all.filter((r) => r.measured)
const N = ok.length
const c = (f) => ok.filter(f).length
const pct = (n) => `${String(n).padStart(2)}/${N}`

console.log(`\nпроба rt-${PROBE}, ${root}`)
console.log(`прогонов: ${all.length}, измерено: ${N}, не измерено: ${all.length - N}`)
for (const r of all.filter((x) => !x.measured)) console.log(`  НЕ ИЗМЕРЕНО ${r.dir}: ${r.why}`)
console.log('')
console.log(`  ${pct(c((r) => !r.calledAny))}\tНИ ОДНОГО ВЫЗОВА — проводник сделал работу сам  ← КРИТЕРИЙ`)
if (PROBE === 'bug') {
  console.log(`  ${pct(c((r) => r.calledBT))}\tУШЁЛ В БИЗНЕС-ТРЕБОВАНИЯ на дефекте  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrongFirst))}\tпервым вызван не тот скилл`)
  console.log(`  ${pct(c((r) => r.decomposition))}\tЗАШЁЛ В РАЗРЕЗ — на дефекте резать нечего  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.calledBugReport && !r.calledSpec))}\tостановился на репорте, спеку не запустил`)
  console.log(`  ${pct(c((r) => r.calledSpec && !r.flagBugfix))}\tспека запущена БЕЗ флага багфикса`)
  console.log(`  ${pct(c((r) => r.calledSpec && !r.sourceIsReport))}\tспеке передан не репорт`)
  console.log(`  ${pct(c((r) => !r.calledReview))}\tприёмка не запущена ни разу`)
  console.log(`  ${pct(c((r) => !r.calledStages))}\tэтапы не запущены`)
} else {
  console.log(`  ${pct(c((r) => r.calledBugReport))}\tУШЁЛ В БАГ-РЕПОРТ на обычной задаче  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrongFirst))}\tпервым вызван не business-requirements-doc`)
  console.log(`  ${pct(c((r) => !r.calledReview))}\tприёмка не запущена ни разу`)
}
console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
console.log('')
