#!/usr/bin/env node
// grade-sm-trace.mjs — что делал ВЕДУЩИЙ, по трассе `_trace.jsonl` (stream-extract.mjs).
//
//   node grade-sm-trace.mjs <папка-раунда> [ещё…]
//
// Считаются ТОЛЬКО вызовы ведущего (`sub: false`); вызовы субагентов (`sub: true`, они идут через
// родительский поток при --verbose) — отдельной колонкой «субагентских». Трасса без поля `sub`
// (снята старым экстрактором) считается целиком как ведущего и помечается «(без sub)».
//   шаблон Read      — чтений card.template.md ведущим (ожидание 0: ему хватает грепа таблицы);
//   шаблон Grep      — грепов по шаблону (ожидание ≤ 1);
//   чужие карточки   — Read services/<карточка>.md (ожидание 0 — образцом формы сосед быть не может);
//   Write карточки   — Write в services/<name>.md самим ведущим (запасной путь копии; верность копии
//                      проверяет grade-sm-adv.mjs ПРОДВИЖЕНИЕ);
//   Read черновика   — Read services/.work/*.md целиком (ожидание 0: только Grep);
//   Edit черновика   — Edit/Write ведущим в services/.work/ (ожидание 0: черновик правит только добор);
//   код Read         — Read файлов сервисов вне services/ (ожидание 0: кода ведущий не видит);
//   субагентов       — вызовов Agent; вопросов — AskUserQuestion; всего — tool_use ведущего.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const rows = []
for (const round of process.argv.slice(2)) {
  const sb = join(round, 'sandbox'); if (!existsSync(sb)) continue
  for (const d of readdirSync(sb).filter(x => statSync(join(sb, x)).isDirectory()).sort()) {
    const tr = join(sb, d, '_trace.jsonl'); if (!existsSync(tr)) continue
    const all = readFileSync(tr, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    const hasSub = all.some(x => 'sub' in x)
    const t = hasSub ? all.filter(x => !x.sub) : all
    const p = x => (x.file_path || x.path || '').replace(/\\/g, '/')
    const isCard = x => /\/services\/[^/]+\.md$/.test(p(x)) && !/\/services\/(\.work|_pending)\//.test(p(x))
    const isDraft = x => /\/services\/\.work\//.test(p(x))
    const isCode = x => p(x) && !/\/services\//.test(p(x)) && !/card\.template\.md$|SKILL\.md$|manifest\.example\.yaml$|actions\.log$|\/Temp\//.test(p(x)) && /\/(repairy|resonance)-(api|web)\//.test(p(x))
    rows.push({
      round: basename(round), sb: d + (hasSub ? '' : ' (без sub)'),
      tmplRead: t.filter(x => x.tool === 'Read' && /card\.template\.md$/.test(p(x))).length,
      tmplGrep: t.filter(x => x.tool === 'Grep' && /card\.template\.md$/.test(p(x))).length,
      foreignRead: t.filter(x => x.tool === 'Read' && isCard(x) && !/manifest\.yaml$/.test(p(x))).length,
      cardWrite: t.filter(x => x.tool === 'Write' && isCard(x)).length,
      draftRead: t.filter(x => x.tool === 'Read' && isDraft(x)).length,
      draftEdit: t.filter(x => (x.tool === 'Edit' || x.tool === 'Write') && isDraft(x)).length,
      codeRead: t.filter(x => x.tool === 'Read' && isCode(x)).length,
      agents: t.filter(x => x.tool === 'Agent' || x.tool === 'Task').length,
      asks: t.filter(x => x.tool === 'AskUserQuestion').length,
      total: t.length,
      subCalls: all.length - t.length,
    })
  }
}
if (!rows.length) { console.log('трасс нет — прогоны сняты без stream-json'); process.exit(0) }
console.log('раунд · песочница · шаблон Read · шаблон Grep · чужие карточки Read · Write карточки · Read черновика · Edit черновика · код Read · субагентов · вопросов · всего ведущего · субагентских')
for (const r of rows) console.log(`${r.round} · ${r.sb} · ${r.tmplRead} · ${r.tmplGrep} · ${r.foreignRead} · ${r.cardWrite} · ${r.draftRead} · ${r.draftEdit} · ${r.codeRead} · ${r.agents} · ${r.asks} · ${r.total} · ${r.subCalls}`)
const sum = k => rows.reduce((a, r) => a + r[k], 0)
console.log(`\nИТОГ по ${rows.length}: шаблон Read ${sum('tmplRead')} · чужие карточки Read ${sum('foreignRead')} · Write карточки ${sum('cardWrite')} · Read черновика ${sum('draftRead')} · Edit черновика ${sum('draftEdit')} · код Read ${sum('codeRead')} · вопросов ${sum('asks')}`)
