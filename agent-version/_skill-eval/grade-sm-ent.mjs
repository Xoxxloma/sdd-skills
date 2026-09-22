#!/usr/bin/env node
// grade-sm-ent.mjs — изолированная проба «сущности — сверка сверху» (фикстура SM-ENT).
//
//   node grade-sm-ent.mjs <папка-раунда>/sm-ent
//
// Читается ПОСЛЕДНЯЯ строка «СУЩНОСТИ: …»; ожидание — из fixtures/SM-ENT/expect.json. У ДОБОР дополнительно
// требуется, чтобы в ответе был текст добора с «убери» (из «Владеет данными») и «сущности:» (перезапись строки
// в ручках) — без второго добор порождает тупик «Сущности у ручек». Отдельно считаются ответы, где ведущий
// решил оставить прежнюю карточку: по правилу исход после неудачного добора — карточка пишется.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out || !existsSync(out)) { console.error('нужна папка <раунд>/sm-ent'); process.exit(1) }
const expect = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'SM-ENT', 'expect.json'), 'utf8'))
const RE = /СУЩНОСТИ:\s*\**\s*(ПРОЙДЕН|ДОБОР)/g
const STAY = /прежняя карточка остаётся|карточк[аи] не (будет|пишется)|не продвига/i

let green = 0, total = 0, stays = 0, cost = 0
console.log(`проба sm-ent, ${out}`)
for (const v of readdirSync(out).filter(d => statSync(join(out, d)).isDirectory()).sort()) {
  const want = expect[v]; if (!want) { console.log(`  ${v}: нет ожидания в expect.json`); continue }
  const files = readdirSync(join(out, v)).filter(f => /^answer-\d+\.md$/.test(f)).sort()
  let ok = 0; const verdicts = []; const notes = []
  for (const f of files) {
    const t = readFileSync(join(out, v, f), 'utf8')
    const m = [...t.matchAll(RE)]; const got = m.length ? m[m.length - 1][1] : '—'
    let pass = got === want.want
    if (pass && got === 'ДОБОР') {
      const hasRemove = /убери|убрать|удали/i.test(t), hasRewrite = /сущности:/.test(t) && /перепиш|не сущность/i.test(t)
      if (!hasRemove || !hasRewrite) { pass = false; notes.push(`${f}: добор без ${!hasRemove ? '«убери»' : ''}${!hasRemove && !hasRewrite ? ' и ' : ''}${!hasRewrite ? 'перезаписи сущности:' : ''}`) }
    }
    if (STAY.test(t)) { stays++; notes.push(`${f}: оставил прежнюю карточку`) }
    verdicts.push(got + (pass ? '' : '✗'))
    if (pass) ok++
    const cf = join(out, v, f.replace('answer', 'cost').replace('.md', '.txt'))
    if (existsSync(cf)) cost += parseFloat(readFileSync(cf, 'utf8')) || 0
  }
  total += files.length; green += ok
  console.log(`  ${v.padEnd(30)} ожидание ${want.want.padEnd(8)} ${ok}/${files.length}  [${verdicts.join(', ')}]${notes.length ? '  · ' + notes.join(' | ') : ''}`)
}
console.log(`\n  ${green}/${total} зелёных · «прежняя остаётся» в ${stays} · цена: $${cost.toFixed(2)}`)
