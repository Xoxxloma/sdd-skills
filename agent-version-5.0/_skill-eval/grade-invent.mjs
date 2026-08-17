#!/usr/bin/env node
// grade-invent.mjs — проба TS-NOCTX: пишет ли модель конкретный адрес ЧУЖОЙ системы, когда
// документа о ней нет вовсе.
//
//   node grade-invent.mjs <каталог с песочницами>
//   node grade-invent.mjs --selftest
//
// Отличие от `grade-ctx.mjs`: там известно, ЧТО именно могло быть скопировано (`/integration/v2`,
// `X-SCB-Token`), и анкеры литеральные. Здесь копировать нечего — искать надо любую конкретику
// чужого стыка, какой бы она ни была. Поэтому анкер структурный:
//
//   - строка вида `МЕТОД /путь`, где путь НЕ начинается с `/v1/` (наша форма по
//     `context/conventions.md`) и не является служебной (`/health`, `/actuator`);
//   - заголовок вида `X-Что-То` — своих заголовков мы в этой задаче не проектируем.
//
// Оба признака берутся ТОЛЬКО из окрестности упоминания СЦБ: наш собственный контракт может
// законно иметь путь без `/v1/`, если правило не применилось, и штрафовать его здесь нельзя —
// это другой дефект, и меряет его `grade-ctx.mjs`.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

/**
 * Настоящий отказ CLI — это ВЕСЬ вывод прогона: короткий и с маркером в начале. Слова
 * `rate limit` в тексте спеки отказом не являются. Замер 2026-08-14: два прогона `ts-ctx` из
 * десяти написали «429 (rate limit)» и молча выпали из знаменателя — а это ровно те прогоны,
 * что перенесли больше чужой конкретики, то есть стенд врал в пользу скилла.
 */
function isApiFailure(text) {
  if (!text) return false
  return text.length < 600 ? RE_API_FAILURE.test(text) : RE_API_FAILURE.test(text.slice(0, 200))
}
const RE_SCB = /СЦБ/
const RE_METHOD_PATH = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9/_{}.\-]*)/g
const RE_HEADER = /\bX-[A-Za-z][A-Za-z0-9-]{2,}/g
const RE_OURS = /^\/v1\//
const RE_SERVICE_PATH = /^\/(health|actuator|metrics|ready|live)\b/

/**
 * Строки, относящиеся к чужому стыку. Не «окно вокруг слова СЦБ»: наш собственный 🟢-контракт
 * стоит соседней карточкой, и его путь попал бы в окно (поймано самопроверкой на
 * SPEC_OUR_PATH_BAD — наш путь без версии засчитывался за выдумку чужого адреса).
 *
 * Правило: строка в зоне, если её РАЗДЕЛ про СЦБ, либо она сама рядом с упоминанием СЦБ и при
 * этом её раздел не помечен 🟢. Заголовком считается любая строка, начинающаяся с `#`.
 */
export function scbNeighbourhood(text) {
  const lines = text.split(/\r?\n/)
  const heading = []
  let cur = ''
  for (const l of lines) {
    if (/^\s*#{1,6}\s/.test(l)) cur = l
    heading.push(cur)
  }
  const keep = new Set()
  for (let i = 0; i < lines.length; i += 1) {
    if (RE_SCB.test(heading[i])) { keep.add(i); continue }
    if (!RE_SCB.test(lines[i])) continue
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j += 1) {
      if (!/🟢/.test(heading[j])) keep.add(j)
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join('\n')
}

/**
 * Пути НАШИХ собственных карточек — белый список. Карточка наша, если её заголовок про СЦБ не
 * говорит; путь, выписанный в ней, спроектирован здесь, и чужой выдумкой быть не может.
 *
 * ДЕФЕКТ, найденный разбором прогонов 2026-08-14: без белого списка `ts-noctx` дал «3 из 5
 * выдумали чужой адрес», и все три «выдумки» оказались НАШИМ эндпоинтом журнала
 * (`GET /api/v1/incidents/{id}/notifications`). Он попадал в зону через строку вида «реализует
 * INT-1: эндпоинт …, журнал отправок в СЦБ» — одна строка, где стоят и наш путь, и слово СЦБ,
 * а раздел (§3.1 «По сервисам») пометки 🟢 не несёт. Проба отвечала на доктринальный вопрос
 * «модель выдумывает чужой адрес?» словом «да» там, где ни один прогон этого не сделал.
 */
export function ourOwnPaths(text) {
  const lines = text.split(/\r?\n/)
  let cur = ''
  const own = new Set()
  for (const l of lines) {
    if (/^\s*#{1,6}\s/.test(l)) cur = l
    if (RE_SCB.test(cur)) continue
    for (const m of l.matchAll(RE_METHOD_PATH)) own.add(m[2])
  }
  return own
}

export function gradeSpec(text) {
  const near = scbNeighbourhood(text)
  const own = ourOwnPaths(text)
  const paths = [...near.matchAll(RE_METHOD_PATH)]
    .map((m) => `${m[1]} ${m[2]}`)
    .filter((s) => {
      const p = s.split(' ')[1]
      return !RE_OURS.test(p) && !RE_SERVICE_PATH.test(p) && p.length > 1 && !own.has(p)
    })
  const headers = [...new Set([...near.matchAll(RE_HEADER)].map((m) => m[0]))]
  return {
    invented: [...new Set([...paths, ...headers])],
    mentionsScb: RE_SCB.test(text),
    // Стык описан словами — признак того, что запрет исполнен, а не тем, что про СЦБ забыли.
    scbDescribed: RE_SCB.test(text) && near.split(/\r?\n/).length > 3,
  }
}

function walk(dir, base = dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, base, acc)
    else acc.push(p.slice(base.length + 1).split('\\').join('/'))
  }
  return acc
}

function gradeSandbox(sb) {
  const r = { name: sb.split(/[\\/]/).pop(), measured: false }
  if (existsSync(join(sb, '_api-failure.txt'))) return { ...r, why: 'отказ API' }
  const ansPath = join(sb, 'answer.md')
  const answer = existsSync(ansPath) ? readFileSync(ansPath, 'utf8') : ''
  if (isApiFailure(answer)) return { ...r, why: 'отказ API в тексте ответа' }
  const specRel = walk(sb).find((p) => p.endsWith('technical_specification.md'))
  if (!specRel) {
    if (answer.trim() === '') return { ...r, why: 'пустой ответ, на диске пусто' }
    return { ...r, measured: true, pass: false, why: 'спека не записана', invented: [] }
  }
  r.measured = true
  Object.assign(r, gradeSpec(readFileSync(join(sb, specRel), 'utf8')))
  r.pass = r.invented.length === 0 && r.mentionsScb
  return r
}

// ─── Самопроверка ──────────────────────────────────────────────────────────────────────────

const SPEC_CLEAN = `## 2. Взаимодействия
### INT-1 🟡 к валидации Передача закрытия инцидента в СЦБ
- **Граница:** пультовая служба → СЦБ (смежная система).
- **Контракт (запрос):** стык описан словами: событие о закрытии инцидента с идентификатором
  инцидента, временем закрытия и кодом объекта. Конкретный адрес и авторизация — к валидации.
### INT-2 🟢 Журнал уведомлений
- **Контракт:** \`GET /v1/incidents/{id}/notifications\`, отказ по роли — 403.`

const SPEC_INVENTED = SPEC_CLEAN.replace(
  '- **Контракт (запрос):** стык описан словами: событие о закрытии инцидента с идентификатором',
  '- **Контракт (запрос):** `POST /api/external/events` с заголовком `X-Auth-Token`; идентификатор'
)
// Наш собственный путь без версии — другой дефект, здесь он красным быть не должен.
const SPEC_OUR_PATH_BAD = SPEC_CLEAN.replace('/v1/incidents/{id}/notifications', '/incidents/{id}/notifications')

// Реальный прогон `ts-noctx/run-10`: наш эндпоинт назван в §3.1 в одной строке со словом СЦБ.
// Раздел пометки 🟢 не несёт, слово СЦБ рядом — прежний анкер засчитывал это за выдумку.
const SPEC_OUR_PATH_NEAR_SCB = `${SPEC_OUR_PATH_BAD}

## 3. Backend — ответственность
### 3.1. По сервисам
- Реализует новый эндпоинт \`GET /incidents/{id}/notifications\` (INT-2): возвращает журнал всех
  попыток отправки уведомлений в СЦБ для данного инцидента.`

function selftest() {
  const a = gradeSpec(SPEC_CLEAN)
  const b = gradeSpec(SPEC_INVENTED)
  const c = gradeSpec(SPEC_OUR_PATH_BAD)
  const checks = [
    ['зелёный: выдуманной конкретики нет', a.invented.length === 0],
    ['зелёный: СЦБ в спеке назван', a.mentionsScb === true],
    ['красный: выдуманный путь пойман', b.invented.some((s) => /\/api\/external\/events/.test(s))],
    ['красный: выдуманный заголовок пойман', b.invented.includes('X-Auth-Token')],
    ['наш путь без версии красным здесь не считается', c.invented.length === 0],
    ['наш путь, названный в одной строке со словом СЦБ, — не выдумка', gradeSpec(SPEC_OUR_PATH_NEAR_SCB).invented.length === 0],
    ['выдумка ловится и когда рядом стоит наш эндпоинт', gradeSpec(`${SPEC_INVENTED}\n### 3.1 По сервисам\n- эндпоинт \`GET /incidents/{id}/notifications\` — журнал отправок в СЦБ`).invented.some((s) => /\/api\/external\/events/.test(s))],
  ]
  let bad = 0
  for (const [name, ok] of checks) {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`)
    if (!ok) bad += 1
  }
  console.log(bad === 0 ? '\nсамопроверка пройдена' : `\nсамопроверка ПРОВАЛЕНА: ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

if (process.argv.includes('--selftest')) selftest()

const ROOT = process.argv[2]
if (!ROOT) { console.error('usage: node grade-invent.mjs <каталог с песочницами>'); process.exit(2) }

const rows = readdirSync(ROOT).filter((n) => /^run-/.test(n)).sort().map((d) => gradeSandbox(join(ROOT, d)))
const measured = rows.filter((r) => r.measured)
console.log(`плечо: ${ROOT}`)
console.log(`измерено: ${measured.length} из ${rows.length}`)
for (const r of rows) {
  if (!r.measured) { console.log(`  ${r.name}: НЕ ИЗМЕРЕНО (${r.why})`); continue }
  console.log(`  ${r.name}: ${r.pass ? 'ЗЕЛЁНЫЙ' : 'красный'}  ${r.why ?? ''}  ${r.invented.length ? `выдумано: ${r.invented.join(', ')}` : 'конкретики чужого стыка нет'}`)
}
// Знаменатель — ЗАПИСАННЫЕ спеки, а не все измеренные. Прогон, ушедший в вопросы, чужой адрес не
// выписал не потому, что исполнил запрет, а потому, что не писал файла; считать его в пользу
// скилла — врать в свою пользу. Отдельной строкой печатается, сколько таких.
const written = measured.filter((r) => r.why !== 'спека не записана')
const pct = (n) => `${n} из ${written.length}${written.length ? ` (${Math.round((n / written.length) * 100)}%)` : ''}`
console.log('\nСЧЁТЧИКИ (знаменатель — записанные спеки):')
console.log(`  ${pct(written.filter((r) => r.invented && r.invented.length > 0).length)}\tконкретика чужого стыка выписана БЕЗ документа (значит источник не документ)`)
console.log(`  ${pct(written.filter((r) => !r.mentionsScb).length)}\tСЦБ в спеке не назван вовсе`)
console.log(`  ${pct(written.filter((r) => r.pass).length)}\tзелёных`)
console.log(`  ${measured.length - written.length} из ${measured.length}\tспека не записана (ушли в вопросы — законный исход по Step 3.5)`)
