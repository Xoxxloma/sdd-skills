#!/usr/bin/env node
// stream-extract.mjs <_stream.jsonl> <папка-песочницы>
//
// Режет поток `claude -p --output-format stream-json --verbose` на то, что грейдят:
//   answer.md      — текст итогового ответа ведущего (событие result), как раньше;
//   _cost.txt      — total_cost_usd из result;
//   _sub/N.md      — полные ответы субагентов: tool_result вызовов Agent/Task, по порядку;
//   _trace.jsonl   — по строке на каждый tool_use: {n, tool, sub, file_path|pattern|path|command}.
//                    `sub: true` — вызов сделан СУБАГЕНТОМ (у события есть parent_tool_use_id):
//                    с --verbose события субагентов идут через родительский поток, и без этого поля
//                    правки добора и чтения субагента засчитываются ведущему.
// Поток может оборваться (таймаут, отказ) — тогда пишется то, что успело прийти; answer.md
// остаётся пустым, и раннер считает прогон отказом, как и прежде.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [src, out] = process.argv.slice(2)
if (!src || !out) { console.error('stream-extract: нужны <_stream.jsonl> <папка>'); process.exit(1) }
const raw = existsSync(src) ? readFileSync(src, 'utf8') : ''
const useName = new Map()   // tool_use_id → name
const trace = []
const subs = []
let result = '', cost = ''
let n = 0
for (const line of raw.split('\n')) {
  if (!line.trim()) continue
  let j; try { j = JSON.parse(line) } catch { continue }
  if (j.type === 'result') { result = j.result || result; if (j.total_cost_usd != null) cost = String(j.total_cost_usd); continue }
  const content = j.message && Array.isArray(j.message.content) ? j.message.content : []
  const sub = !!j.parent_tool_use_id
  if (j.type === 'assistant') {
    for (const c of content) {
      if (c.type !== 'tool_use') continue
      n++
      useName.set(c.id, c.name)
      const i = c.input || {}
      trace.push({ n, tool: c.name, sub, file_path: i.file_path, pattern: i.pattern, path: i.path, command: i.command, subagent_type: i.subagent_type, description: i.description })
    }
  } else if (j.type === 'user') {
    if (sub) continue   // tool_result внутри субагента — не его ответ ведущему
    for (const c of content) {
      if (c.type !== 'tool_result') continue
      const name = useName.get(c.tool_use_id)
      if (name !== 'Agent' && name !== 'Task') continue
      const text = Array.isArray(c.content) ? c.content.filter(x => x.type === 'text').map(x => x.text).join('\n') : (typeof c.content === 'string' ? c.content : '')
      subs.push(text)
    }
  }
}
writeFileSync(join(out, 'answer.md'), result)
writeFileSync(join(out, '_cost.txt'), cost)
writeFileSync(join(out, '_trace.jsonl'), trace.map(t => JSON.stringify(t)).join('\n') + (trace.length ? '\n' : ''))
if (subs.length) {
  mkdirSync(join(out, '_sub'), { recursive: true })
  subs.forEach((s, i) => writeFileSync(join(out, '_sub', `${i + 1}.md`), s))
}
const lead = trace.filter(t => !t.sub).length
console.error(`stream-extract: tool_use ${trace.length} (ведущий ${lead}, субагенты ${trace.length - lead}), ответов субагентов ${subs.length}, answer ${result.length} зн., цена ${cost || '—'}`)
