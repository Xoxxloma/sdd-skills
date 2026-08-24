// grade-sm-real.mjs — проба `sm-real`: service-map на настоящем коде (repairy + resonance).
// Ключ ответов — fixtures/SM-REAL/KEY.md, числа там считаны грепом по источникам.
//
//   node agent-version/_skill-eval/grade-sm-real.mjs <папка-раунда> [ещё-раунды…]
//
// Грейдится ФАЙЛ на диске (services/*.md), а не формулировка отчёта: первый же прогон показал,
// что отчёт Шага 6 расходится с собственной карточкой («20 экранов» при 23, «все с фактами»
// при 12 пустых блоках).
//
// ЧИСЛОВЫЕ АНКЕРЫ ПИШУТСЯ С ГРАНИЦЕЙ `(^|[^0-9])`. Без неё альтернатива `5 мин` совпала с хвостом
// строки `JWT на 15 мин` и дала анкеру «подпись живёт 300 с» ложный зелёный (2026-08-24).
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const KEY = {
  'repairy-api': { endpoints: 96, entities: 20, jobs: 1, topics: 0, roles: 5 },
  'repairy-web': { screens: 24 },
}

// 14 фактов, ни один не лежит в файле эндпоинта. Грейдится факт, а не формулировка.
const ANCHORS = [
  ['подпись S3 живёт 300 с',      /\b300\b|(^|[^0-9])5 мин|PRESIGN_TTL/i],
  ['белый список MIME',           /ALLOWED_MIME|бел[ыо][йм] списк|image\/jpeg/i],
  ['гонка номера акта → 409',     /P2002|409[^\n]*(акт|номер|повтор)|повтор[^\n]*409/i],
  ['unique (projectId, number)',  /projectId, ?number/i],
  ['removedAt вместо удаления',   /removedAt/],
  ['выборки фильтруют removedAt', /removedAt:\s*null/i],
  ['склейка уведомлений',         /debounce|склеива|окно ожидан/i],
  ['окна 45 / 120 / 180 с',       /(^|[^0-9])45 ?сек|(^|[^0-9])120 ?сек|(^|[^0-9])180 ?сек/i],
  ['приёмки без задержки',        /без задержк|(^|[^0-9])0 ?(мс|сек)|немедленн/i],
  ['лимит 10 в час',              /(^|[^0-9])10[^\n]*час|час[^\n]*(^|[^0-9])10/i],
  ['очередь в Redis, TTL 600',    /\b600\b|QUEUE_TTL/i],
  ['cron */30',                   /\*\/30/],
  ['@unique на ключевых полях',   /unique|уникальн/i],
  ['410 Gone на истёкшей сессии', /\b410\b|Gone/],
]

// Появление любого = модель дописала пример из скилла вместо чтения кода.
const POISON = [/ЧОП/, /ГБР/, /ГОСБ/, /\/v1\/incidents/, /\bchi\b/, /Kafka/, /shipping/, /ТТН/]

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const section = (t, name) => {
  const out = []
  let on = false
  for (const l of t.split('\n')) {
    if (l.startsWith('## ')) { on = l.trim() === `## ${name}`; continue }
    if (on) out.push(l)
  }
  return out.join('\n')
}
const blocks = (t) => {
  const res = []
  let cur = null
  for (const l of t.split('\n')) {
    if (l.startsWith('### ')) { if (cur) res.push(cur); cur = { key: l.slice(4).replace(/`/g, '').trim(), facts: 0, ent: null, purpose: null } }
    else if (cur) {
      if (l.startsWith('- ')) cur.facts++
      else if (/^сущности:/.test(l)) cur.ent = l
      else if (cur.purpose === null && l.trim()) cur.purpose = l
    }
  }
  if (cur) res.push(cur)
  return res
}
const cmp = (got, want) => (got === want ? '✅' : '❌') + ` ${got}/${want}`

function grade(runDir, label) {
  const svc = join(runDir, 'w', 'AI-SDD', 'services')
  const api = read(join(svc, 'repairy-api.md'))
  const web = read(join(svc, 'repairy-web.md'))
  if (!api && !web) { console.log(`${label}: карточек нет — НЕ ИЗМЕРЕНО`); return null }

  const contract = blocks(section(api, 'Публичный контракт'))
  const ents = blocks(section(api, 'Владеет данными'))
  const jobs = blocks(section(api, 'Фоновые задачи'))
  const topics = blocks(section(api, 'События'))
  const roles = section(api, 'Роли и доступ').split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-|Роль/.test(l))
  const screens = section(web, 'Экраны').split('\n').filter((l) => /^\|\s*`?\//.test(l))

  // Сущность засчитывается в ЛЮБОЙ из двух форм: отдельной строкой (редакции 2–3) или в назначении
  // (редакция 4). Иначе сравнение редакций мерило бы форму, а не наличие связи «ручка → сущность».
  const names = ents.map((e) => e.key).filter(Boolean)
  const nameRe = names.length ? new RegExp('\b(' + names.join('|') + ')\b') : /$^/
  const inPurpose = (b) => !!b.purpose && (nameRe.test(b.purpose) || /не сущность/i.test(b.purpose))
  const named = contract.filter((b) => b.ent || inPurpose(b))
  const withEnt = contract.filter((b) => b.ent)
  const kind = (re) => withEnt.filter((b) => re.test(b.ent)).length
  const empty = contract.filter((b) => b.facts === 0)
  const emptyNotWhole = empty.filter((b) => b.ent && !/целиком/i.test(b.ent))
  const facts = contract.reduce((s, b) => s + b.facts, 0)
  const hits = ANCHORS.filter(([, re]) => re.test(api))
  const poisoned = POISON.filter((re) => re.test(api) || re.test(web))
  const ticks = (api.match(/^### `/gm) || []).length

  console.log(`\n=== ${label} ===`)
  console.log(`  скилл: ${(() => { const p = join(runDir, '..', '..', '_skills', 'service-map.SKILL.md'); return existsSync(p) ? readFileSync(p, 'utf8').split('\n').length + ' строк' : 'снимка нет' })()}`)
  console.log('  ПОЛНОТА')
  console.log(`    эндпоинты   ${cmp(contract.length, KEY['repairy-api'].endpoints)}`)
  console.log(`    сущности    ${cmp(ents.length, KEY['repairy-api'].entities)}`)
  console.log(`    задачи      ${cmp(jobs.length, KEY['repairy-api'].jobs)}`)
  console.log(`    топики      ${cmp(topics.length, KEY['repairy-api'].topics)}  (брокера в репе нет — любой блок это выдумка)`)
  console.log(`    роли        ${cmp(roles.length, KEY['repairy-api'].roles)}`)
  console.log(`    экраны      ${cmp(screens.length, KEY['repairy-web'].screens)}`)
  console.log('  СУЩНОСТИ У РУЧЕК')
  console.log(`    сущность названа       ${named.length}/${contract.length}   (отдельной строкой ${withEnt.length}, в назначении ${named.length - withEnt.length})`)
  console.log(`    целиком / проекция / не сущность: ${kind(/целиком/i)} / ${kind(/проекц/i)} / ${kind(/не сущность/i)}`)
  console.log('  ПЛОТНОСТЬ')
  console.log(`    строк-фактов в контракте  ${facts}`)
  console.log(`    блоков с пустым телом     ${empty.length}`)
  console.log(`    из них НЕ помечены «целиком» (нарушение)  ${emptyNotWhole.length}`)
  console.log(`    анкеров                   ${hits.length}/${ANCHORS.length}`)
  const miss = ANCHORS.filter(([, re]) => !re.test(api)).map(([n]) => n)
  if (miss.length) console.log(`      нет: ${miss.join('; ')}`)
  console.log('  ПРОЧЕЕ')
  console.log(`    отравление примерами   ${poisoned.length ? '⚠ ' + poisoned.map(String).join(' ') : 'чисто'}`)
  console.log(`    ключ в бэктиках        ${ticks}/${contract.length + ents.length + jobs.length + topics.length}`)
  const dirt = join(runDir, '_dirt.txt')
  console.log(`    караул чужих реп       ${existsSync(dirt) ? '⚠ ГРЯЗНО' : 'чисто'}`)
  return { facts, empty: empty.length, anchors: hits.length, named: named.length }
}

const rounds = process.argv.slice(2)
if (!rounds.length) { console.error('нужен путь к папке раунда'); process.exit(1) }
for (const r of rounds) {
  const sb = join(r, 'sandbox')
  if (!existsSync(sb)) { console.log(`${r}: песочниц нет`); continue }
  for (const d of readdirSync(sb).filter((f) => /^scan-/.test(f)).sort()) grade(join(sb, d), `${r.split(/[\/]/).pop()} / ${d}`)
}
