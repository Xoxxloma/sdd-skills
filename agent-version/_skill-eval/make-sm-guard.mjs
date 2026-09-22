#!/usr/bin/env node
// make-sm-guard.mjs — собирает фикстуру SM-GUARD: изолированная проба гарда-маршрутизатора.
//
//   node make-sm-guard.mjs            → fixtures/SM-GUARD/case-*.md + expect.json
//
// Каждый случай — то, что ведущий видит на Шаге 4 после грепов: перечни ключей прежней карточки
// и черновика по классам. Ожидание — маршрут по формуле (исчезло ≥ 3 и 3·исчезло > было, по
// любому кодовому классу). Случаи взяты с поля и со стенда (21.09), числа — те же.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, 'fixtures', 'SM-GUARD')
mkdirSync(dir, { recursive: true })

const ep = (n, pre = '/api/v1/items') => Array.from({ length: n }, (_, i) => `${['GET', 'POST', 'PATCH', 'DELETE'][i % 4]} ${pre}/${['list', 'create', 'update', 'remove', 'export', 'search', 'count', 'bulk'][i % 8]}${Math.floor(i / 8) ? '-' + Math.floor(i / 8) : ''}`)
const ent = (n) => Array.from({ length: n }, (_, i) => ['Order', 'Customer', 'Invoice', 'Payment', 'Shipment', 'Carrier', 'Warehouse', 'Slot', 'Tariff', 'Zone', 'Route', 'Driver', 'Vehicle', 'Contract', 'Claim', 'Refund', 'Audit', 'Session', 'Token', 'Role'][i])
const call = (n) => Array.from({ length: n }, (_, i) => `\`billing\` · GET /projects/${i}/estimate`)
const rule = (n) => Array.from({ length: n }, (_, i) => `\`${ent(20)[i % 20]}\` — ${['статус', 'этап', 'вид'][i % 3]}`)
const task = (n) => Array.from({ length: n }, (_, i) => ['nightlyRecalc', 'purgeAudit'][i])

const block = (title, cls) => {
  const lines = [`## ${title}`]
  for (const [name, keys] of Object.entries(cls)) lines.push(`${name} (${keys.length}):`, ...keys.map(k => `  ${k}`), '')
  return lines.join('\n')
}

const cases = [
  // имя, прежняя, черновик, ожидание, почему
  ['web-2-of-89', { 'потребляемые API': call(89) }, { 'потребляемые API': call(89).slice(2) }, 'ПОВЕРХ', 'два мёртвых вызова из 89 — ниже порога'],
  ['web-3-of-128', { 'потребляемые API': call(128) }, { 'потребляемые API': call(128).slice(3) }, 'ПОВЕРХ', 'три из 128 — 3·3 < 128'],
  ['ueb-foreign-3-of-20', { 'сущности': ent(20) }, { 'сущности': ent(20).slice(3) }, 'ПОВЕРХ', 'три чужие сущности из 20 — 9 < 20'],
  ['cut-33-of-48', { 'контракт': ep(48) }, { 'контракт': ep(48).slice(0, 15) }, 'В _pending', '33 из 48 — недочитано'],
  ['class-zeroed-19', { 'сущности': ent(19), 'контракт': ep(13) }, { 'сущности': [], 'контракт': ep(13) }, 'В _pending', 'класс обнулён при целом контракте'],
  ['renamed-prefix-96', { 'контракт': ep(96, '/api/v1/items') }, { 'контракт': ep(96, '/v1/items') }, 'В _pending', 'появилось = исчезло: переименование, но в _pending — и назвать переименованием'],
  ['rules-8-of-22-not-counted', { 'контракт': ep(30), 'бизнес-правила': rule(22) }, { 'контракт': ep(30), 'бизнес-правила': rule(22).slice(8).map(r => r.replace('—', '— (по шаблону)')) }, 'ПОВЕРХ', '«Бизнес-правила» в счёт не идут'],
  ['mirror-1-not-counted', { 'контракт': ep(35), 'кто меня потребляет': ['`ui-web` · GET /svodka/geo/remoteEntry.js'] }, { 'контракт': ep(35), 'кто меня потребляет': [] }, 'ПОВЕРХ', '«Кто меня потребляет» в счёт не идёт'],
  ['task-1-of-2', { 'контракт': ep(20), 'задачи': task(2) }, { 'контракт': ep(20), 'задачи': task(1) }, 'ПОВЕРХ', 'одна из двух — исчезло < 3'],
  ['entities-3-of-4', { 'контракт': ep(12), 'сущности': ent(4) }, { 'контракт': ep(12), 'сущности': ent(1) }, 'В _pending', 'три из четырёх — 3 ≥ 3 и 9 > 4'],
]

const expect = {}
for (const [name, prev, cur, want, why] of cases) {
  const text = [
    `Сервис \`svc\`, тип \`backend\`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы`,
    `\`^### \` и \`^\\| \` по прежней карточке и по черновику. Ключи уже нормализованы.`,
    '',
    block('ПРЕЖНЯЯ КАРТОЧКА', prev),
    block('ЧЕРНОВИК', cur),
  ].join('\n')
  writeFileSync(join(dir, `case-${name}.md`), text)
  expect[name] = { want, why }
}
writeFileSync(join(dir, 'expect.json'), JSON.stringify(expect, null, 2))
writeFileSync(join(dir, 'README.md'), `# SM-GUARD — изолированная проба гарда-маршрутизатора

Собирается \`node make-sm-guard.mjs\`. Каждый \`case-*.md\` — перечни ключей прежней карточки и
черновика по классам, ровно то, что ведущий видит после грепов на Шаге 4. Раннер \`run-sm-guard.sh\`
даёт прогону текст гарда из SKILL.md (по якорям) и один случай; ожидается последняя строка
\`ГАРД: ПОВЕРХ\` либо \`ГАРД: В _pending\`. Ожидания — в \`expect.json\`, там же «почему».

Что проверяется: ведущий применяет формулу, а не рассуждает — считает по классам, исключает
«Бизнес-правила» и «Кто меня потребляет», не пишет слов-причин («законно», «форма», «урезали»).
Случаи с поля и со стенда 21.09: 2/89, 3/128, 3/20, 33/48, обнулённый класс, переименование
96/96, восемь заголовков правил, одно зеркало, одна задача из двух, три сущности из четырёх.
`)
console.log(`SM-GUARD: ${cases.length} случаев → ${dir}`)
