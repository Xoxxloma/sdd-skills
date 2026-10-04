#!/usr/bin/env node
// grade-sm-mono.mjs — полный прогон service-map на синтетическом монолите (run-sm-mono.sh).
// Критерии Б-5 и Б-6 плана PLAN-AUTOSPLIT.md §5.
//
//   node grade-sm-mono.mjs <папка-раунда> [--json]     отчёт и <раунд>/GRADE-MONO.txt
//   node grade-sm-mono.mjs --truth <NRS-TAIL|SM-MONO-DGS>  правда по дереву фикстуры, числа по классам
//   node grade-sm-mono.mjs --selftest                   мини-песочницы fixtures/SM-MONO-RUN/grader-selftest/
//
// ПРАВДА — множества ключей, извлечённые из сгенерированного дерева (`fixtures/<фикстура>/out/<сервис>`;
// нет — дерево первой песочницы раунда), а не числа из головы. Число каждого класса сверяется с
// expected.md фикстуры (NRS-TAIL 139/88/9/18, SM-MONO-DGS 120/60/10/12); не сошлось — грейдер отказывается.
//   контракт — REST: глагол + путь с префиксом класс-уровневого @RequestMapping (у NRS-TAIL путь метода
//              уже содержит префикс — тогда засчитывается и он, и удвоенный путь, каким его собрал бы Spring);
//              DGS: тип операции + имя (`query findCases0`), только корневые Query/Mutation/Subscription;
//   сущности — классы @Entity (засчитывается имя класса, оно же без суффикса Entity, имя таблицы);
//   задачи   — классы с @Scheduled (у всех метод `run`, поэтому ключ — класс; `Класс.run` тоже годится);
//   топики   — имена из application.yaml под `topics`/`topic`; направление — `producers` → публикует,
//              иначе потребляет. Доля — по имени; расхождение направления печатается отдельно.
// КАРТОЧКА — `w/AI-SDD/services/<сервис>.md`; ключи — заголовки `###` в секциях «Публичный контракт»,
// «Владеет данными», «Фоновые задачи», «События». Грейдится файл, не формулировка отчёта.
// ТРАССА — `_stream.jsonl` (не `_trace.jsonl` и не ответ): ведущий — события без parent_tool_use_id.
// Не измерено — `_api-failure.txt`, нет answer.md (брошено в фоне без удачного повтора, обрыв).
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdtempSync, cpSync, rmSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const HERE = import.meta.dirname
const FIXT = {
  'NRS-TAIL': { svc: 'cargonet', expect: { contract: 139, entities: 88, jobs: 9, topics: 18 } },
  'SM-MONO-DGS': { svc: 'casedesk', expect: { contract: 120, entities: 60, jobs: 10, topics: 12 } },
}
const CLASSES = ['contract', 'entities', 'jobs', 'topics']
const RU = { contract: 'контракт', entities: 'сущности', jobs: 'задачи', topics: 'топики' }
const SECTION = { contract: 'Публичный контракт', entities: 'Владеет данными', jobs: 'Фоновые задачи', topics: 'События' }
const PEAK_LEAD_MAX = 200000   // решение владельца 10-04 после попытки 1 Б: «всё, что до 200к, укладывается»
const SHARE_MIN = 0.95
const SCRIPTS = ['plan.sh', 'assemble.sh', 'promote.sh', 'check.sh']

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n?/g, '\n') : '')
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '.git' ? [] : walk(join(d, e.name))) : [join(d, e.name)]))

// ─── нормализация ключей ────────────────────────────────────────────────────────────────
export const normPath = (p) => {
  let s = String(p).replace(/[`'"«»]/g, '').replace(/[?#].*$/, '').trim().toLowerCase()
  s = s.replace(/\{[^}/]*\}/g, '{}').replace(/(^|\/):[a-z_][a-z0-9_]*/g, '$1{}')
  s = ('/' + s).replace(/\/+/g, '/')
  if (s.length > 1) s = s.replace(/\/$/, '')
  return s
}
const restKey = (verb, path) => `${verb.toUpperCase()} ${normPath(path)}`
const gqlKey = (op, name) => `${op.toLowerCase()} ${name.toLowerCase()}`
const headCore = (h) => h.replace(/`/g, '').split(/\s+[—–]\s+/)[0].trim()

// ─── правда по дереву ───────────────────────────────────────────────────────────────────
const annoPath = (args) => {
  if (args == null) return ''
  const m = args.match(/(?:value|path)\s*=\s*"([^"]*)"/) || args.match(/^\s*"([^"]*)"/)
  return m ? m[1] : ''
}

export function extractTruth (tree) {
  const T = { contract: new Map(), entities: new Map(), jobs: new Map(), topics: new Map() }
  // T[class]: каноничный ключ → { aliases: Set, dir?, file }
  const add = (cls, key, aliases, extra = {}) => {
    if (!T[cls].has(key)) T[cls].set(key, { aliases: new Set(), ...extra })
    for (const a of aliases) T[cls].get(key).aliases.add(a)
  }
  const javaFiles = walk(join(tree, 'src')).filter((f) => f.endsWith('.java'))
  for (const f of javaFiles) {
    const t = read(f)
    const rel = relative(tree, f).split(sep).join('/')
    const classIdx = t.search(/\b(class|interface|enum|record)\s+\w+/)
    const head = classIdx >= 0 ? t.slice(0, classIdx) : t
    const body = classIdx >= 0 ? t.slice(classIdx) : ''
    const cm = body.match(/^(?:class|interface|enum|record)\s+(\w+)/)
    const className = cm ? cm[1] : null
    // REST
    const pm = head.match(/@RequestMapping\s*(?:\(([^)]*)\))?/)
    const prefix = pm ? annoPath(pm[1] ?? '') : ''
    for (const m of body.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping\b\s*(?:\(([^)]*)\))?/g)) {
      const verb = m[1].toUpperCase(); const p = annoPath(m[2] ?? '')
      const nPre = prefix ? normPath(prefix) : ''; const nP = normPath(p || '/')
      const already = nPre && (nP === nPre || nP.startsWith(nPre + '/'))
      const canonical = already ? nP : normPath((prefix || '') + '/' + (p || ''))
      const aliases = [restKey(verb, canonical)]
      if (already) aliases.push(restKey(verb, normPath(prefix + '/' + p)))
      add('contract', restKey(verb, canonical), aliases, { file: rel })
    }
    // DGS — только корневые типы
    for (const m of body.matchAll(/@Dgs(Query|Mutation|Subscription)\b\s*(\(([^)]*)\))?[\s\S]*?\b(\w+)\s*\(/g)) {
      const fm = (m[3] || '').match(/field\s*=\s*"(\w+)"/)
      const name = fm ? fm[1] : m[4]
      add('contract', gqlKey(m[1], name), [gqlKey(m[1], name)], { file: rel })
    }
    for (const m of body.matchAll(/@DgsData\s*\(([^)]*)\)[\s\S]*?\b(\w+)\s*\(/g)) {
      const pt = (m[1].match(/parentType\s*=\s*"(\w+)"/) || [])[1]
      if (!/^(Query|Mutation|Subscription)$/.test(pt || '')) continue
      const name = (m[1].match(/field\s*=\s*"(\w+)"/) || [])[1] || m[2]
      add('contract', gqlKey(pt, name), [gqlKey(pt, name)], { file: rel })
    }
    // сущности
    if (/@Entity\b/.test(head) && className) {
      const table = (head.match(/@Table\s*\(\s*name\s*=\s*"([^"]+)"/) || [])[1]
      const al = [className.toLowerCase()]
      if (/Entity$/.test(className) && className.length > 6) al.push(className.replace(/Entity$/, '').toLowerCase())
      if (table) al.push(table.toLowerCase())
      add('entities', className, al, { file: rel })
    }
    // задачи
    for (const m of body.matchAll(/@Scheduled\b[^\n]*\n[\s\S]*?\b(\w+)\s*\(/g)) {
      if (!className) continue
      add('jobs', className, [className.toLowerCase(), `${className}.${m[1]}`.toLowerCase(), `${className}#${m[1]}`.toLowerCase()], { file: rel, method: m[1] })
    }
  }
  // топики — application.yaml
  for (const y of walk(join(tree, 'src')).filter((f) => /application[^/\\]*\.ya?ml$/.test(f))) {
    const stack = []
    for (const raw of read(y).split('\n')) {
      if (!raw.trim() || /^\s*#/.test(raw)) continue
      const ind = raw.match(/^\s*/)[0].length
      const li = raw.match(/^\s*-\s+(.+?)\s*$/)
      if (li) {
        while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop()
        const path = stack.map((s) => s.key)
        if (/^topics?$/.test(path[path.length - 1] || '')) {
          const name = li[1].replace(/['"]/g, '')
          add('topics', name, [name.toLowerCase()], { dir: path.some((k) => /producer/i.test(k)) ? 'публикует' : 'потребляет' })
        }
        continue
      }
      const kv = raw.match(/^\s*([\w.-]+):\s*(.*?)\s*$/)
      if (!kv) continue
      while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop()
      stack.push({ key: kv[1], ind })
      if (kv[2] && /^topics?$/.test(kv[1])) {
        const name = kv[2].replace(/['"]/g, '')
        const path = stack.map((s) => s.key)
        add('topics', name, [name.toLowerCase()], { dir: path.some((k) => /producer/i.test(k)) ? 'публикует' : 'потребляет' })
      }
    }
  }
  return T
}

function truthTree (fx, round) {
  const svc = FIXT[fx].svc
  const out = join(HERE, 'fixtures', fx, 'out', svc)
  if (existsSync(join(out, 'src'))) return out
  if (round) {
    const sb = join(round, 'sandbox')
    if (existsSync(sb)) for (const d of readdirSync(sb).sort()) { const t = join(sb, d, 'w', svc); if (existsSync(join(t, 'src'))) return t }
  }
  return null
}

export function loadTruth (fx, round, { build = false } = {}) {
  if (!FIXT[fx]) throw new Error(`неизвестная фикстура ${fx}`)
  let tree = truthTree(fx, round)
  if (!tree && build) {
    const r = spawnSync('bash', [join(HERE, 'fixtures', fx, 'make.sh'), join(HERE, 'fixtures', fx, 'out')], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`make.sh ${fx} упал: ${r.stderr}`)
    tree = truthTree(fx, round)
  }
  if (!tree) throw new Error(`нет дерева ${fx}: соберите bash fixtures/${fx}/make.sh fixtures/${fx}/out`)
  const T = extractTruth(tree)
  const exp = FIXT[fx].expect
  // числа expected.md — тот же источник, что в шапке; файл проверяется на месте, чтобы правка правды не прошла молча
  const md = read(join(HERE, 'fixtures', fx, 'expected.md'))
  const bad = []
  for (const c of CLASSES) {
    if (T[c].size !== exp[c]) bad.push(`${RU[c]}: извлечено ${T[c].size}, в expected.md ${exp[c]}`)
    if (md && !md.includes(`**${exp[c]}**`)) bad.push(`в expected.md нет «**${exp[c]}**» (${RU[c]}) — правда фикстуры изменилась, поправьте грейдер`)
  }
  if (bad.length) throw new Error(`правда ${fx} не сходится с expected.md:\n  ${bad.join('\n  ')}`)
  return { fx, svc: FIXT[fx].svc, tree, T }
}

// ─── карточка ───────────────────────────────────────────────────────────────────────────
function sectionHeads (text) {
  const res = {}; let cur = null
  for (const l of text.split('\n')) {
    if (/^## /.test(l)) { cur = l.slice(3).trim(); continue }
    if (/^# /.test(l)) { cur = null; continue }
    if (cur && /^### /.test(l)) (res[cur] ||= []).push(l.slice(4).trim())
  }
  return res
}

function matchContract (h, T) {
  const s = h.replace(/`/g, ' ')
  const r = s.match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s+(\/\S*)/i)
  let k = null
  if (r) k = restKey(r[1], r[2].replace(/[),.;:]+$/, ''))
  else {
    const g = s.match(/\b(query|mutation|subscription)\b\s*[.:]?\s*(\w+)/i) || (() => { const x = s.match(/\b(\w+)\s*\(\s*(query|mutation|subscription)\s*\)/i); return x ? [x[0], x[2], x[1]] : null })()
    if (g) k = gqlKey(g[1], g[2])
  }
  if (!k) return null
  for (const [key, v] of T.contract) if (v.aliases.has(k)) return key
  return null
}
function matchByToken (h, map, re) {
  const toks = h.replace(/`/g, ' ').split(re).filter(Boolean).map((x) => x.toLowerCase())
  const joined = headCore(h).toLowerCase()
  for (const [key, v] of map) if (v.aliases.has(joined)) return key
  for (const t of toks) for (const [key, v] of map) if (v.aliases.has(t)) return key
  return null
}

export function gradeCard (text, truth) {
  const heads = sectionHeads(text)
  const res = {}
  for (const c of CLASSES) {
    const hs = heads[SECTION[c]] || []
    const found = new Set(); const extras = []; const dups = []; const seenRaw = new Set(); const dirMismatch = []
    for (const h of hs) {
      const raw = headCore(h).toLowerCase()
      let key = null
      if (c === 'contract') key = matchContract(h, truth.T)
      else if (c === 'topics') key = matchByToken(h, truth.T.topics, /[^A-Za-z0-9_.-]+/)
      else key = matchByToken(h, truth.T[c], /[^A-Za-z0-9_.#]+/)
      if (key) {
        if (found.has(key)) dups.push(h); else found.add(key)
        if (c === 'topics') {
          const want = truth.T.topics.get(key).dir
          const got = /потребл/i.test(h) ? 'потребляет' : /публик/i.test(h) ? 'публикует' : null
          if (got && got !== want) dirMismatch.push(h)
        }
      } else if (seenRaw.has(raw)) dups.push(h)
      else extras.push(h)
      seenRaw.add(raw)
    }
    const missing = [...truth.T[c].keys()].filter((k) => !found.has(k))
    res[c] = { found: found.size, truth: truth.T[c].size, share: truth.T[c].size ? found.size / truth.T[c].size : 1, extras, dups, missing, dirMismatch }
  }
  return res
}

// ─── трасса и пики ──────────────────────────────────────────────────────────────────────
export function gradeStream (text) {
  const r = { lead: { peak: 0, readWork: 0, agents: 0, tools: 0 }, sub: { readWork: 0, tools: 0 }, scripts: {}, subs: [], events: 0 }
  for (const s of SCRIPTS) r.scripts[s] = { lead: 0, sub: 0 }
  const desc = new Map(); const subs = new Map()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let e; try { e = JSON.parse(line) } catch { continue }
    if (e.type !== 'assistant' || !e.message) continue
    r.events++
    const u = e.message.usage || {}
    const ctx = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)
    const isSub = !!e.parent_tool_use_id
    if (isSub) {
      const s = subs.get(e.parent_tool_use_id) || { id: e.parent_tool_use_id, desc: e.task_description || desc.get(e.parent_tool_use_id) || '?', peak: 0 }
      s.peak = Math.max(s.peak, ctx); subs.set(e.parent_tool_use_id, s)
    } else r.lead.peak = Math.max(r.lead.peak, ctx)
    for (const c of e.message.content || []) {
      if (c.type !== 'tool_use') continue
      const who = isSub ? 'sub' : 'lead'
      r[who].tools++
      const i = c.input || {}
      if (!isSub && (c.name === 'Agent' || c.name === 'Task')) { r.lead.agents++; desc.set(c.id, i.description || i.subagent_type || '?') }
      if (c.name === 'Read' && /(^|[\\/])\.work[\\/]/.test(String(i.file_path || ''))) r[who].readWork++
      if ((c.name === 'Bash' || c.name === 'PowerShell') && typeof i.command === 'string') {
        for (const s of SCRIPTS) if (i.command.includes(s)) r.scripts[s][who]++
      }
    }
  }
  for (const s of subs.values()) { if (s.desc === '?' && desc.has(s.id)) s.desc = desc.get(s.id); r.subs.push(s) }
  return r
}

// ─── прогон ─────────────────────────────────────────────────────────────────────────────
export function gradeRun (dir, truth) {
  const name = dir.split(/[\\/]/).pop()
  const ans = join(dir, 'answer.md')
  const bg = existsSync(dir) ? readdirSync(dir).filter((f) => /^_bg-abandoned/.test(f)).length : 0
  if (existsSync(join(dir, '_api-failure.txt'))) return { name, measured: false, why: 'отказ API / обрыв' }
  if (!existsSync(ans) || !read(ans).trim()) return { name, measured: false, why: bg ? 'брошено в фоне' : 'нет answer.md' }
  const cardPath = join(dir, 'w', 'AI-SDD', 'services', `${truth.svc}.md`)
  const card = read(cardPath)
  const cardOk = card.trim().length > 0
  const keys = cardOk ? gradeCard(card, truth) : null
  const st = gradeStream(read(join(dir, '_stream.jsonl')))
  const cost = Number(read(join(dir, '_cost.txt')).trim()) || 0
  const dirt = existsSync(join(dir, '_dirt.txt'))
  const sharesOk = cardOk && CLASSES.every((c) => keys[c].share >= SHARE_MIN)
  const topicsFull = cardOk && keys.topics.found === keys.topics.truth
  const b5 = cardOk && sharesOk && topicsFull
  const b6 = st.events > 0 && st.lead.peak > 0 && st.lead.peak <= PEAK_LEAD_MAX && st.lead.readWork === 0
  return { name, measured: true, card: cardOk, keys, st, cost, dirt, bg, b5, b6 }
}

function detectFixture (round) {
  const j = join(round, '_mono.json')
  if (existsSync(j)) { try { return JSON.parse(read(j)).fixture } catch {} }
  const sb = join(round, 'sandbox')
  if (existsSync(sb)) for (const d of readdirSync(sb)) for (const [fx, v] of Object.entries(FIXT)) if (existsSync(join(sb, d, 'w', v.svc))) return fx
  return null
}

export function gradeRound (round, { build = false } = {}) {
  const fx = detectFixture(round)
  if (!fx) throw new Error(`не понял фикстуру раунда ${round}: нет _mono.json и песочниц с cargonet/casedesk`)
  const truth = loadTruth(fx, round, { build })
  const sb = join(round, 'sandbox')
  const dirs = existsSync(sb) ? readdirSync(sb).filter((d) => /^mono-\d+$/.test(d) && statSync(join(sb, d)).isDirectory()).sort() : []
  const runs = dirs.map((d) => gradeRun(join(sb, d), truth))
  const m = runs.filter((r) => r.measured)
  // красный прогон красит сразу (3/3 уже недостижимо); иначе зелёный — только при ≥ 3 измеренных
  const verdict = (k, n) => (k < n ? `${k}/${n} — КРАСНЫЙ` : n < 3 ? `${k}/${n} — НЕ ХВАТАЕТ ИЗМЕРЕНИЙ (нужно ≥ 3)` : `${k}/${n} — ЗЕЛЁНЫЙ`)
  return {
    round, fx, svc: truth.svc, truthCounts: Object.fromEntries(CLASSES.map((c) => [c, truth.T[c].size])), runs,
    measured: m.length, notMeasured: runs.length - m.length,
    b5: { ok: m.filter((r) => r.b5).length, n: m.length, verdict: verdict(m.filter((r) => r.b5).length, m.length) },
    b6: { ok: m.filter((r) => r.b6).length, n: m.length, verdict: verdict(m.filter((r) => r.b6).length, m.length) },
    cost: runs.reduce((a, r) => a + (r.cost || 0), 0),
  }
}

const pct = (x) => `${(x * 100).toFixed(1)} %`
function report (R) {
  const L = []
  L.push(`проба sm-mono, ${R.round}`)
  L.push(`фикстура ${R.fx}, сервис ${R.svc}; правда по дереву: ${CLASSES.map((c) => `${RU[c]} ${R.truthCounts[c]}`).join(', ')} (= expected.md)`)
  for (const r of R.runs) {
    L.push('')
    if (!r.measured) { L.push(`${r.name}: НЕ ИЗМЕРЕНО — ${r.why}`); continue }
    L.push(`${r.name}: карточка ${r.card ? 'записана' : 'НЕТ'}${r.dirt ? '  !!! ТРОГАЛ ПАПКУ СЕРВИСА (_dirt.txt)' : ''}${r.bg ? '  (был повтор после «брошено в фоне»)' : ''}`)
    if (r.card) {
      for (const c of CLASSES) {
        const k = r.keys[c]
        L.push(`  ${RU[c].padEnd(9)} ${k.found}/${k.truth} (${pct(k.share)})  лишних ${k.extras.length}, повторов ${k.dups.length}${k.dirMismatch.length ? `, направление не то ${k.dirMismatch.length}` : ''}${k.missing.length && k.missing.length <= 6 ? `  · нет: ${k.missing.join('; ')}` : k.missing.length ? `  · нет: ${k.missing.slice(0, 6).join('; ')} …и ещё ${k.missing.length - 6}` : ''}`)
        if (k.extras.length) L.push(`            лишние: ${k.extras.slice(0, 5).join(' | ')}${k.extras.length > 5 ? ` …и ещё ${k.extras.length - 5}` : ''}`)
      }
    }
    const s = r.st
    L.push(`  трасса: субагентов ${s.lead.agents}; ${SCRIPTS.map((x) => `${x} ${s.scripts[x].lead}+${s.scripts[x].sub}`).join(', ')} (ведущий+субагенты); Read .work ведущим ${s.lead.readWork} (субагентами ${s.sub.readWork})`)
    L.push(`  пик ведущего ${s.lead.peak}${s.lead.peak > PEAK_LEAD_MAX ? ' > 150k' : ''}; субагенты: ${s.subs.map((x) => `«${String(x.desc).slice(0, 40)}» ${x.peak}`).join(', ') || '—'}`)
    L.push(`  Б-5 ${r.b5 ? 'да' : 'НЕТ'} · Б-6 ${r.b6 ? 'да' : 'НЕТ'} · цена $${r.cost.toFixed(2)}`)
  }
  L.push('')
  L.push(`измерено ${R.measured}, не измерено ${R.notMeasured}, цена $${R.cost.toFixed(2)}`)
  L.push(`Б-5 (карточка записана; ключей по каждому классу ≥ 95 % правды; топиков ${R.truthCounts.topics}/${R.truthCounts.topics}): ${R.b5.verdict}`)
  L.push(`Б-6 (пик ведущего ≤ 200 000; Read ведущего по .work/ = 0): ${R.b6.verdict}`)
  return L.join('\n')
}

// ─── самопроверка ───────────────────────────────────────────────────────────────────────
function selftest () {
  const dir = join(HERE, 'fixtures', 'SM-MONO-RUN', 'grader-selftest')
  const exp = JSON.parse(read(join(dir, 'expected.json')))
  const truths = {}
  let bad = 0; const rows = []
  const get = (o, p) => p.split('/').reduce((a, k) => (a == null ? a : a[k]), o)   // «/», не «.»: в именах скриптов точка
  for (const [c, w] of Object.entries(exp.cases)) {
    truths[w.fixture] ||= loadTruth(w.fixture, null, { build: true })
    const r = gradeRun(join(dir, c), truths[w.fixture])
    const diffs = []
    for (const [p, v] of Object.entries(w.want)) { const g = get(r, p); if (g !== v) diffs.push(`${p}: ждали ${v}, получено ${g}`) }
    if (diffs.length) bad++
    rows.push(`  ${diffs.length ? 'FAIL' : 'ok  '}  ${c.padEnd(26)} ${w.about}${diffs.length ? '  · ' + diffs.join('; ') : ''}`)
  }
  // раунд целиком: три прогона во временной папке
  for (const [label, names, want5, want6] of exp.rounds) {
    const tmp = mkdtempSync(join(tmpdir(), 'sm-mono-st-'))
    try {
      mkdirSync(join(tmp, 'sandbox'))
      names.forEach((n, i) => cpSync(join(dir, n), join(tmp, 'sandbox', `mono-0${i + 1}`), { recursive: true }))
      writeFileSync(join(tmp, '_mono.json'), JSON.stringify({ fixture: exp.cases[names[0]].fixture }))
      const R = gradeRound(tmp)
      const ok = R.b5.verdict.includes(want5) && R.b6.verdict.includes(want6)
      if (!ok) bad++
      rows.push(`  ${ok ? 'ok  ' : 'FAIL'}  раунд «${label}»: Б-5 ${R.b5.verdict}; Б-6 ${R.b6.verdict}${ok ? '' : `  · ждали ${want5} / ${want6}`}`)
    } finally { rmSync(tmp, { recursive: true, force: true }) }
  }
  console.log('случай → ожидание → итог')
  console.log(rows.join('\n'))
  console.log(bad ? `\nсамопроверка: ПРОВАЛОВ ${bad}` : `\nсамопроверка: ok (${rows.length})`)
  process.exit(bad ? 1 : 0)
}

// ─── вход ───────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())
if (isMain) {
  const args = process.argv.slice(2)
  try {
    if (args[0] === '--selftest') selftest()
    else if (args[0] === '--truth') {
      const t = loadTruth(args[1], null, { build: args.includes('--build') })
      console.log(`${args[1]} (${t.tree}): ${CLASSES.map((c) => `${RU[c]} ${t.T[c].size}`).join(', ')} — сходится с expected.md`)
      if (args.includes('--list')) for (const c of CLASSES) for (const [k, v] of t.T[c]) console.log(`${RU[c]}\t${k}${v.dir ? '\t' + v.dir : ''}\t${[...v.aliases].join(' | ')}`)
    } else if (args[0] && existsSync(args[0]) && statSync(args[0]).isDirectory()) {
      const R = gradeRound(args[0])
      const txt = report(R)
      writeFileSync(join(args[0], 'GRADE-MONO.txt'), txt + '\n')
      if (args.includes('--json')) console.log(JSON.stringify(R, (k, v) => (v instanceof Set ? [...v] : v)))
      else console.log(txt)
    } else { console.error('usage: node grade-sm-mono.mjs <раунд> [--json] | --truth <фикстура> [--list] | --selftest'); process.exit(1) }
  } catch (e) { console.error(`ОТКАЗ ГРЕЙДЕРА: ${e.message}`); process.exit(2) }
}
