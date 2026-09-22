#!/usr/bin/env node
// trace-paths.mjs <_trace.jsonl> [Read|Grep|Write|Bash] — печатает вызовы ведущего с путями (короткими).
import { readFileSync } from 'node:fs'
const [f, only] = process.argv.slice(2)
for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
  const x = JSON.parse(l)
  if (only && x.tool !== only) continue
  const p = (x.file_path || x.path || '').replace(/\\/g, '/').split('/').slice(-3).join('/')
  const extra = x.tool === 'Grep' ? ` «${(x.pattern || '').slice(0, 40)}»` : x.tool === 'Bash' ? ` ${(x.command || '').replace(/\s+/g, ' ').slice(0, 90)}` : x.tool === 'Agent' ? ` ${x.description || ''}` : ''
  console.log(x.n, x.tool, p + extra)
}
