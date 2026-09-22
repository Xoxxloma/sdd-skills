#!/usr/bin/env node
// attrib-check.mjs <_stream.jsonl> [ещё…] — как размечены события в потоке: parent_tool_use_id /
// subagent_type / без пометки; и сколько среди них Read кода и Write карточки. Диагностика атрибуции.
import { readFileSync } from 'node:fs'
const BS = String.fromCharCode(92)
for (const f of process.argv.slice(2)) {
  const L = readFileSync(f, 'utf8').split('\n').filter(Boolean)
  const z = () => ({ parent: 0, subtype: 0, none: 0 })
  const tu = z(), code = z(), wr = z(), draftRead = z()
  const keysSeen = new Set()
  for (const l of L) {
    let j; try { j = JSON.parse(l) } catch { continue }
    if (j.type !== 'assistant') continue
    for (const k of Object.keys(j)) keysSeen.add(k)
    const cls = j.parent_tool_use_id ? 'parent' : (j.subagent_type || j.task_description) ? 'subtype' : 'none'
    for (const c of (j.message && j.message.content) || []) {
      if (c.type !== 'tool_use') continue
      tu[cls]++
      const p = ((c.input || {}).file_path || '').split(BS).join('/')
      if (c.name === 'Read' && /\/(repairy|resonance)-(api|web)\/src\//.test(p)) code[cls]++
      if (c.name === 'Write' && /\/services\/[^/]+\.md$/.test(p)) wr[cls]++
      if (c.name === 'Read' && /\/services\/\.work\//.test(p)) draftRead[cls]++
    }
  }
  console.log(f.split('/').slice(-3).join('/'))
  console.log('  ключи событий:', [...keysSeen].filter(k => /parent|subagent|task/.test(k)).join(', ') || '—')
  console.log('  tool_use:', JSON.stringify(tu), '| Read кода:', JSON.stringify(code), '| Write карточки:', JSON.stringify(wr), '| Read черновика:', JSON.stringify(draftRead))
}
