// Детерминированный грейдер раунда «вложенная раскладка» (2026-07-26).
// Грейдит ФАКТ на диске и текст ответа — не самоотчёт модели.
// Запуск: node _skill-eval/grade-nesting.mjs [путь-к-корню-прогона]

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = process.argv[2] ?? '_skill-eval/runs/2026-07-26-nesting'
const FIX = '_skill-eval/fixtures'

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
// Регистр и порядок слов — источник трёх грейдер-артефактов подряд в прошлых раундах.
// Все текстовые проверки идут по нижнему регистру, а «клаузы» — двусторонними regex.
const has = (s, ...subs) => subs.every((x) => s.toLowerCase().includes(x.toLowerCase()))
const hasAny = (s, ...subs) => subs.some((x) => s.toLowerCase().includes(x.toLowerCase()))

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, base, out)
    else out.push(relative(base, p).replace(/\\/g, '/'))
  }
  return out
}

// ---------------------------------------------------------------- пробы

const EPIC70 = sha(`${FIX}/ARS-70/business_requirements.md`)

const CHECKS = {
  // Главная проба правки: грейдим ПУТИ записанных файлов, а не прозу.
  dc12: (dir, files, ans) => ({
    'дети внутри папки эпика': files.includes('docs/ARS-70/ARS-71/business_requirements.md')
      && files.includes('docs/ARS-70/ARS-72/business_requirements.md'),
    'индекс в папке эпика': files.includes('docs/ARS-70/decomposition.md'),
    'НЕ плоские сиблинги': !files.some((f) => /^docs\/ARS-7[12]\//.test(f)),
    'НЕ мимо docs/ (защита от CWD)': !files.some((f) => /^ARS-7[12]\//.test(f)),
    'эпик-БТ не тронут': existsSync(join(dir, 'docs/ARS-70/business_requirements.md'))
      && sha(join(dir, 'docs/ARS-70/business_requirements.md')) === EPIC70,
    'вложенные пути в индексе': /docs\/ARS-70\/ARS-71\//.test(read(join(dir, 'docs/ARS-70/decomposition.md'))),
  }),

  // TS на вложенном ребёнке: turn-1 = вопросы, номер выведен из ИМЕНИ ПАПКИ ребёнка.
  dc7: (dir, files, ans) => ({
    'turn-1: спеку не написал': !files.some((f) => /technical_specification\.md$/.test(f)),
    'кандидат номера ARS-93': /ARS-93/.test(ans),
    'НЕ взял ключ эпика как свой': !/(номер задачи|Номер задачи)[^\n]{0,40}ARS-90/.test(ans),
    'задаёт тех-гейты': hasAny(ans, 'взаимодейств', 'контракт', 'гейт', 'INT-'),
    'precondition пройден (не отказ)': !hasAny(ans, 'нет БТ', 'не могу построить спеку', 'дайте БТ'),
  }),

  // Сверка с диском по вложенному дереву + _foundation не ребёнок.
  gui5: (dir, files, ans) => ({
    'файлов не писал': files.length === 0,
    'назвал готовые ARS-91/92': has(ans, 'ARS-91', 'ARS-92'),
    'назвал оставшийся ARS-93': /ARS-93/.test(ans),
    'есть сводка готово/осталось': hasAny(ans, 'осталось', 'остал', 'готов', 'remaining', 'done'),
    '_foundation не назван ребёнком/слайсом':
      !/_foundation[^\n]{0,60}(ребён|ребен|слайс|дочерн)/i.test(ans)
      && !/(ребён|ребен|слайс|дочерн)[^\n]{0,60}_foundation/i.test(ans),
    'один вопрос про продолжение': hasAny(ans, 'продолжаем', 'продолжить', 'continue with', 'shall we continue'),
  }),

  // Детект общего фундамента на подменённой фикстуре ARS-100.
  gui3: (dir, files, ans) => ({
    'файлов не писал': files.length === 0,
    'увидел общий источник': hasAny(ans, 'общий источник', 'один и тот же источник', 'одни и те же данные',
      'общего источника', 'общий сервис', 'единый источник', 'один источник', 'общая сущность', 'те же данные'),
    'предложил узел #0': hasAny(ans, '#0', 'узел-фундамент', 'узла-фундамента', 'общий тех-фундамент', 'фундамент'),
    // Клауза встречается в обоих порядках: «своего БТ у #0 не будет» и «у #0 не будет своего БТ».
    'клауза «у #0 нет своего БТ»':
      /(бт|бизнес-требован\w*)[^\n]{0,60}(не будет|не имеет|нет|не заводим|не пишем|не создаём|не создаем)/i.test(ans)
      || /(не будет|не имеет|нет|без|не заводим|не пишем)[^\n]{0,60}(бт|бизнес-требован\w*)/i.test(ans),
    'ждёт подтверждения аналитика': hasAny(ans, '?', 'подтверд'),
  }),

  // Режим A на ARS-100: гейт 11 + JSON-контракт + куда лёг файл.
  fnd3: (dir, files, ans) => {
    const specPath = 'docs/ARS-100/_foundation/technical_specification.md'
    // Контент грейдим по спеке ТАМ, КУДА она реально легла, иначе один дефект
    // (положил не туда) вхолостую валит ещё и «ключ» с «JSON» — тройной счёт одной ошибки.
    const actual = files.find((f) => /technical_specification\.md$/.test(f)) ?? specPath
    const spec = read(join(dir, actual))
    return {
      'спека в _foundation папки эпика': files.includes(specPath),
      // Отдельным пунктом, чтобы отличить «положил не туда» от «не положил вовсе»:
      // реальный провал раунда — _foundation/ в корне, отсчитанный от CWD, а не от папки эпика.
      'НЕ в корне (защита от CWD)': !files.some((f) => /^_foundation\//.test(f)),
      'НЕ внутри детской папки': !files.some((f) => /docs\/ARS-100\/ARS-10[123]\/.*technical_specification/.test(f)),
      'БТ для #0 НЕ написан': !files.some((f) => /business_requirements\.md$/.test(f)),
      'в шапке ключ эпика ARS-100': /ARS-100/.test(spec),
      'ключ не выдуман': !/ARS-1(04|05|06)|FND-0|#0-\d/.test(spec),
      'не взял ключ ребёнка': !/(Задача:|номер задачи)[^\n]{0,40}ARS-10[123]/i.test(spec),
      'не спрашивал номер задачи #0': !/какой номер задачи[^\n]{0,40}фундамент/i.test(ans),
      'есть JSON-пример контракта': /```json/.test(spec),
    }
  },
}

// ---------------------------------------------------------------- прогон

const probes = Object.keys(CHECKS)
const table = []
const failDetail = []

for (const probe of probes) {
  for (const effort of ['low', 'high']) {
    const base = join(ROOT, probe, effort)
    if (!existsSync(base)) continue
    const runs = readdirSync(base).sort()
    const agg = {}
    let passed = 0
    let counted = 0

    for (const r of runs) {
      const dir = join(base, r)
      const all = walk(dir)
      const ans = read(join(dir, 'answer.md'))
      // Песочница засеяна фикстурой ДО прогона, поэтому «есть файлы» ещё не значит
      // «прогон был». Единственный честный признак состоявшегося прогона — answer.md.
      if (!existsSync(join(dir, 'answer.md'))) continue
      counted++
      const files = all.filter((f) => f !== 'answer.md' && !f.startsWith('docs/ARS-70/business_requirements.md')
        && !isFixtureCopy(probe, f))
      const res = CHECKS[probe](dir, files, ans)
      let allOk = true
      for (const [k, v] of Object.entries(res)) {
        agg[k] = agg[k] ?? 0
        if (v) agg[k]++
        else { allOk = false; failDetail.push(`${probe}/${effort}/${r}: ${k}`) }
      }
      if (allOk) passed++
    }
    table.push({ probe, effort, passed, counted, agg })
  }
}

// файлы, которые были в песочнице ДО прогона, не считаем «записанными»
function isFixtureCopy(probe, f) {
  const pre = {
    dc12: [/^docs\/ARS-70\/business_requirements\.md$/],
    dc7: [/^docs\/ARS-90\/(business_requirements|decomposition)\.md$/, /^docs\/ARS-90\/_foundation\//, /^docs\/ARS-90\/ARS-9[123]\/(business_requirements|technical_specification)\.md$/],
    gui5: [/^docs\/ARS-90\/(business_requirements|decomposition)\.md$/, /^docs\/ARS-90\/_foundation\//, /^docs\/ARS-90\/ARS-9[123]\/(business_requirements|technical_specification)\.md$/],
    gui3: [/^docs\/ARS-100\/business_requirements\.md$/, /^docs\/ARS-100\/ARS-10[123]\/business_requirements\.md$/],
    fnd3: [/^docs\/ARS-100\/business_requirements\.md$/, /^docs\/ARS-100\/ARS-10[123]\/business_requirements\.md$/],
  }[probe] ?? []
  return pre.some((re) => re.test(f))
}

console.log(`\n=== Раунд «вложенная раскладка», модель haiku, ${ROOT} ===\n`)
for (const row of table) {
  console.log(`${row.probe.toUpperCase()} / ${row.effort}  —  ЧИСТЫХ ПРОГОНОВ ${row.passed}/${row.counted}`)
  for (const [k, v] of Object.entries(row.agg)) {
    const bad = v < row.counted
    console.log(`   ${bad ? '✗' : '✓'} ${String(v).padStart(2)}/${row.counted}  ${k}`)
  }
  console.log('')
}

if (failDetail.length) {
  console.log('=== Провалившиеся пункты (первые 60) ===')
  for (const f of failDetail.slice(0, 60)) console.log('  ' + f)
  if (failDetail.length > 60) console.log(`  … ещё ${failDetail.length - 60}`)
}
