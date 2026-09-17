#!/usr/bin/env node
// grade-cdoc-paste.mjs — плечо `cdoc-paste` (фикстура CD-PASTE, аудит С33).
//   node grade-cdoc-paste.mjs <папка-раунда>/cdoc-paste
// Грейдится диск, а не формулировка: прежний файл цел БАЙТ В БАЙТ и появился второй — про гарантию.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2]
if (!root || !existsSync(root)) { console.error('usage: node grade-cdoc-paste.mjs <раунд>/cdoc-paste'); process.exit(1) }
const here = dirname(fileURLToPath(import.meta.url))
const ORIG = readFileSync(join(here, 'fixtures/CD-PASTE/context/labor-hours.md'), 'utf8')
let green = 0, total = 0, cost = 0
console.log(`\nпроба cdoc-paste, ${root}`)
for (const run of readdirSync(root).filter((n) => /^run-\d+$/.test(n)).sort()) {
  const dir = join(root, run); const ctx = join(dir, 'context')
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  if (!ans.trim()) { console.log(`  ${run}: пустой ответ — НЕ ИЗМЕРЕНО`); continue }
  total++
  const files = existsSync(ctx) ? readdirSync(ctx).filter((n) => n.endsWith('.md')) : []
  const old = existsSync(join(ctx, 'labor-hours.md')) ? readFileSync(join(ctx, 'labor-hours.md'), 'utf8') : null
  const intact = old === ORIG
  const others = files.filter((n) => n !== 'labor-hours.md')
  const warranty = others.filter((n) => /гарант/i.test(readFileSync(join(ctx, n), 'utf8')))
  const stream = existsSync(join(dir, 'stream.jsonl')) ? readFileSync(join(dir, 'stream.jsonl'), 'utf8') : ''
  const c = [...stream.matchAll(/"total_cost_usd":([0-9.]+)/g)].map((m) => Number(m[1])); if (c.length) cost += c[c.length - 1]
  const ok = intact && warranty.length === 1
  if (ok) green++
  const why = old === null ? 'прежний файл УДАЛЁН' : intact ? 'прежний файл цел' : (/гарант/i.test(old) ? 'прежний файл ЗАТЁРТ или дописан гарантией' : 'прежний файл изменён')
  console.log(`  ${run}: ${ok ? 'ЗЕЛЁНЫЙ' : 'КРАСНЫЙ'}  ${why} · новых файлов про гарантию: ${warranty.length}${warranty.length ? ' (' + warranty.join(', ') + ')' : ''} · всего файлов: ${files.length}`)
}
console.log(`\n  ${green}/${total}\tзелёных  ← КРИТЕРИЙ: прежний файл цел байт в байт И рядом один новый файл про гарантию`)
console.log(`  цена: $${cost.toFixed(2)}\n`)
