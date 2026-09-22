#!/usr/bin/env node
// grade-sm-adv.mjs — пробы SM-ADV на реальном коде: счётчики, которых нет у grade-sm-real / grade-sm-guard / grade-sm-trace.
//
//   node grade-sm-adv.mjs <папка-раунда> [ещё-раунды…]
//   node grade-sm-adv.mjs --selftest
//
// Грейдятся ФАЙЛЫ на диске и трасса, не отчёт. По каждой песочнице <раунд>/sandbox/<плечо>-N/:
//   ПРОДВИЖЕНИЕ  — .work/<svc>.md против services/<svc>.md или _pending/<svc>.md: байт-в-байт? строк потеряно?
//                  и «увидели бы это три грепа» (^### , ^| , ^- ) — слепое пятно механики 4;
//   КАНДИДАТ     — _pending-seeded/<svc>.md (кандидат прошлого прогона) цел байт-в-байт? прежняя services/<svc>.md
//                  при сканировании другого сервиса цела (кроме «Кто меня потребляет»)? в answer.md назван?
//   ЗЕРКАЛА      — «Кто меня потребляет» в карточках не содержит строк, чей источник — только кандидат в _pending/;
//   ОГРАНИЧЕНИЯ  — число блоков `### ограничение` в backend-карточках и есть ли среди них «Каскад» / «формат»
//                  (проба R6: валидатор формата ограничением не является → 0);
//   RESONANCE    — блоков контракта в resonance-api.md против маршрутов, найденных в w/resonance-api (router.<verb>(),
//                  app.<verb>()); ключи, чей путь не найден в коде, — подозрение на добор шумом маркера (R3);
//   KEYED        — при `updated:` в шапке: ключи прежней карточки (_prev), исчезнувшие из карточки, — удаление
//                  при быстром обновлении (запрещено); `scanned` не сдвинут;
//   ЗАПАСНОЙ ПУТЬ — ответ субагента (_sub/N.md) с `## КАРТОЧКА`: текст части равен .work/<svc>.md? (механика 1);
//   КОНТЕКСТ     — tool_use, Agent, ответ завершён (есть таблица scanned / строка ГАРД / «слепок»), карточек
//                  против строк манифеста, цена (проба R8 на 10 сервисов).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const norm = s => s.replace(/`/g, '').replace(/\s+/g, ' ').trim()
const cnt = (t, re) => (t.match(re) || []).length
const three = t => [cnt(t, /^### /gm), cnt(t, /^\| /gm), cnt(t, /^- /gm)]
const section = (t, names) => {
  const out = []; let on = false
  for (const l of t.split('\n')) { if (/^## /.test(l)) { on = names.includes(l.replace(/^## /, '').trim()); continue } if (on) out.push(l) }
  return out.join('\n')
}
const heads = t => (t.match(/^### .+$/gm) || []).map(h => norm(h.slice(4)))
const stripScanned = t => t.replace(/^scanned:.*$/m, '').replace(/^updated:.*$/m, '')
const woMirror = t => t.replace(/^## Кто меня потребляет[\s\S]*?(?=^## |\s*$(?![\s\S]))/m, '## Кто меня потребляет\n')

export function routesFromCode (dir) {
  // (router|app|r).<verb>('<path>' → "VERB path" — путь без префикса монтирования; сравниваем по хвосту
  const out = new Set()
  const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/node_modules|dist|\.git/.test(f)) walk(p) } else if (/\.(js|ts|mjs|cjs)$/.test(f)) for (const m of read(p).matchAll(/\b(?:router|app|r|api)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)/g)) out.add(`${m[1].toUpperCase()} ${m[2]}`) } }
  if (existsSync(dir)) walk(dir)
  return out
}
export function contractKeysNotInCode (card, routes) {
  const keys = heads(section(card, ['Публичный контракт', 'Публичный API'])).filter(k => /^(GET|POST|PUT|PATCH|DELETE) /.test(k))
  const tails = [...routes].map(r => r.split(' ')).map(([v, p]) => [v, p.replace(/^\/+/, '')])
  const missing = keys.filter(k => { const [v, p] = k.split(' '); const path = (p || '').replace(/^\/+/, ''); return !tails.some(([tv, tp]) => tv === v && (tp === path || path.endsWith('/' + tp) || tp === '/' && /^[^/]*$/.test(path))) })
  return { keys, missing }
}
export function promotion (draft, promoted) {
  // CRLF ↔ LF — не потеря содержания (копировщик на Windows пишет \r\n); считаем после нормализации, но называем
  draft = draft.replace(/\r\n?/g, '\n'); promoted = promoted.replace(/\r\n?/g, '\n')
  const same = draft === promoted
  const dl = draft.split('\n'), pl = new Set(promoted.split('\n'))
  const lost = dl.filter(l => l.trim() && !pl.has(l))
  const g1 = three(draft), g2 = three(promoted)
  return { same, lost: lost.length, lostSample: lost.slice(0, 3), threeEqual: g1.every((x, i) => x === g2[i]), g1, g2 }
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}${ok ? '' : `: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`}`) }
  const d = '## Публичный контракт\n\n### `GET /a`\nНазначение.\nсущности: → X\n- факт\n— семантика поля\n\n### `GET /b`\n- факт\n'
  const p = d.replace('сущности: → X\n', '').replace('— семантика поля\n', '')
  const r = promotion(d, p)
  ck('копия без сущности:/— — три грепа равны, строк потеряно 2', [r.same, r.lost, r.threeEqual], [false, 2, true])
  ck('копия байт-в-байт', promotion(d, d).same, true)
  const rt = new Set(['GET /', 'POST /login', 'GET /:id'])
  const c = '## Публичный контракт\n### `GET /api/auth`\n### `POST /api/auth/login`\n### `GET /api/reports/:id`\n### `GET /api/health`\n'
  ck('ключи не из кода', contractKeysNotInCode(c, rt).missing, ['GET /api/auth', 'GET /api/health'])
  ck('woMirror режет только секцию', woMirror('## A\nx\n## Кто меня потребляет\n| a |\n## B\ny\n'), '## A\nx\n## Кто меня потребляет\n## B\ny\n')
  console.log(bad ? `\nсамопроверка: ПРОВАЛОВ ${bad}` : '\nсамопроверка: ok'); process.exit(bad ? 1 : 0)
}

if (process.argv[2] === '--selftest') selftest()
if (!process.argv[2]) { console.error('usage: node grade-sm-adv.mjs <раунд>… | --selftest'); process.exit(1) }

for (const round of process.argv.slice(2)) {
  const sb = join(round, 'sandbox')
  if (!existsSync(sb)) { console.log(`${round}: песочниц нет`); continue }
  for (const d of readdirSync(sb).filter(x => statSync(join(sb, x)).isDirectory()).sort()) {
    const box = join(sb, d), svcDir = join(box, 'w', 'AI-SDD', 'services')
    if (!existsSync(svcDir)) { console.log(`${d}: services/ нет`); continue }
    console.log(`\n== ${round}/${d}`)
    const manifest = read(join(svcDir, 'manifest.yaml'))
    const names = [...manifest.matchAll(/^\s*-\s*name:\s*(\S+)/gm)].map(m => m[1])
    const cards = readdirSync(svcDir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
    const answer = read(join(box, 'answer.md'))

    // ПРОДВИЖЕНИЕ
    const work = join(svcDir, '.work')
    if (existsSync(work)) for (const f of readdirSync(work).filter(f => /\.md$/.test(f) && !/\.opis\.md$/.test(f))) {
      const svc = f.replace(/\.md$/, ''); const draft = read(join(work, f))
      const tgt = existsSync(join(svcDir, '_pending', f)) ? ['_pending/' + f, read(join(svcDir, '_pending', f))] : existsSync(join(svcDir, f)) ? [f, read(join(svcDir, f))] : null
      if (!tgt) { console.log(`  ПРОДВИЖЕНИЕ ${svc}: черновик есть, продвинутой копии нет (сервис в отчёт?)`); continue }
      const r = promotion(woMirror(draft), woMirror(tgt[1]))
      const crA = cnt(draft, /\r/g), crB = cnt(tgt[1], /\r/g)
      const crlf = crA !== crB ? ` · CR-символов ${crA}→${crB} (CRLF↔LF, не содержание)` : ''
      console.log(`  ПРОДВИЖЕНИЕ ${svc} → ${tgt[0]}: ${r.same ? 'байт-в-байт' : `РАСХОЖДЕНИЕ: строк черновика нет в копии ${r.lost}; три грепа ${r.threeEqual ? 'РАВНЫ (слепое пятно)' : 'различаются'} ${JSON.stringify(r.g1)}→${JSON.stringify(r.g2)}`}${crlf}${r.lostSample.length ? '\n      напр.: ' + r.lostSample.map(s => s.slice(0, 80)).join(' | ') : ''}`)
    }

    // КАНДИДАТ прошлого прогона
    const seeded = join(box, '_pending-seeded')
    if (existsSync(seeded)) for (const f of readdirSync(seeded)) {
      const svc = f.replace(/\.md$/, '')
      const now = read(join(svcDir, '_pending', f))
      const intact = now === read(join(seeded, f))
      const prev = read(join(box, '_prev', f)), cur = read(join(svcDir, f))
      const prevIntact = prev ? stripScanned(woMirror(prev)) === stripScanned(woMirror(cur)) : null
      const named = /_pending/.test(answer)
      console.log(`  КАНДИДАТ ${svc}: _pending ${now ? (intact ? 'цел' : 'ИЗМЕНЁН/ПЕРЕЗАПИСАН') : 'УДАЛЁН'} · прежняя карточка (без зеркал) ${prevIntact == null ? '—' : prevIntact ? 'цела' : 'ИЗМЕНЕНА'} · в отчёте назван: ${named ? 'да' : 'НЕТ'}`)
      // ЗЕРКАЛА: строки «Кто меня потребляет», чей источник только в кандидате
      const candRows = new Set(section(now, ['Потребляемые API', 'Зависит от']).split('\n').filter(l => /^\| /.test(l) && !/^\|\s*-{2,}/.test(l)).map(l => norm(l.split('|')[1] || '')))
      for (const c of cards) {
        const mir = section(read(join(svcDir, c + '.md')), ['Кто меня потребляет']).split('\n').filter(l => /^\| `?/.test(l) && !/^\|\s*-{2,}/.test(l) && !/^\|\s*Сервис/.test(l))
        const fromCand = mir.filter(l => norm(l.split('|')[1] || '') === svc)
        if (fromCand.length) console.log(`    ЗЕРКАЛА в ${c}.md от «${svc}»: ${fromCand.length} — законны только если стоят и в services/${svc}.md, не только в кандидате (${candRows.size} строк-источников у кандидата)`)
      }
    }

    // ОГРАНИЧЕНИЯ и RESONANCE и KEYED — по каждой карточке
    for (const c of cards) {
      const t = read(join(svcDir, c + '.md'))
      if (/^type:\s*(backend|fullstack)/m.test(t)) {
        const lim = (section(t, ['Бизнес-правила']).match(/^### ограничение .+$/gm) || [])
        const kask = lim.filter(l => /каскад|формат/i.test(l))
        const kaskAnywhere = /Каскад/.test(t)
        if (lim.length || kaskAnywhere) console.log(`  ОГРАНИЧЕНИЯ ${c}: блоков ${lim.length}${kask.length ? ` — ВАЛИДАТОР ФОРМАТА ЗАПИСАН ОГРАНИЧЕНИЕМ: ${kask.join('; ')}` : ''}${kaskAnywhere && !kask.length ? ' · «Каскад» упомянут вне ограничений (ожидаемо: строка ошибки в контракте)' : ''}`)
      }
      if (/^service:\s*(resonance-api|res-\d+)\s*$/m.test(t)) {
        const svcPath = (t.match(/^repo:\s*(\S+)/m) || [])[1] || '../resonance-api'
        const routes = routesFromCode(join(box, 'w', svcPath.replace(/^\.\.\//, '')))
        const { keys, missing } = contractKeysNotInCode(t, routes)
        console.log(`  RESONANCE ${c}: блоков контракта ${keys.length} · маршрутов в коде ${routes.size} · ключей без маршрута в коде ${missing.length}${missing.length ? ': ' + missing.slice(0, 6).join(', ') + (missing.length > 6 ? ' …' : '') : ''}`)
      }
      const prev = read(join(box, '_prev', c + '.md'))
      if (prev && /^updated:/m.test(t)) {
        const gone = heads(prev).filter(k => !heads(t).includes(k))
        const scannedSame = (prev.match(/^scanned:.*$/m) || [''])[0] === (t.match(/^scanned:.*$/m) || [''])[0]
        console.log(`  KEYED ${c}: ключей прежней карточки нет в новой — ${gone.length}${gone.length ? ' (УДАЛЕНО при быстром обновлении): ' + gone.slice(0, 5).join(', ') : ''} · scanned ${scannedSame ? 'не сдвинут' : 'СДВИНУТ'}`)
      }
    }

    // ЗАПАСНОЙ ПУТЬ
    const sub = join(box, '_sub')
    if (existsSync(sub)) for (const f of readdirSync(sub).sort()) {
      const s = read(join(sub, f)); const m = s.match(/## КАРТОЧКА\s*\n([\s\S]*)$/)
      if (!m) continue
      const body = m[1].replace(/^```(markdown)?\n/, '').replace(/\n```\s*$/, '').trim()
      const svc = (body.match(/^service:\s*(\S+)/m) || [])[1]
      const draft = read(join(work, `${svc}.md`)).trim()
      const eq = draft === body
      console.log(`  ЗАПАСНОЙ ПУТЬ ${f} → ${svc || '?'}: часть «КАРТОЧКА» ${draft ? (eq ? 'записана как есть' : `ИЗМЕНЕНА ведущим (строк: ответ ${body.split('\n').length}, файл ${draft.split('\n').length})`) : 'файла .work нет'}`)
    }

    // КОНТЕКСТ
    const tr = read(join(box, '_trace.jsonl')).split('\n').filter(Boolean).map(l => JSON.parse(l))
    const agents = tr.filter(x => x.tool === 'Agent' || x.tool === 'Task').length
    const done = /scanned|ГАРД|слепок готов|слепок актуален/i.test(answer)
    const targets = names.filter(n => cards.includes(n)).length
    console.log(`  КОНТЕКСТ: tool_use ${tr.length} · Agent ${agents} · карточек ${targets}/${names.length} по манифесту · ответ ${answer.trim() ? (done ? 'завершён' : 'без отчёта Шага 6') : 'ПУСТ'} · цена $${read(join(box, '_cost.txt')).trim() || '—'}`)
  }
}
