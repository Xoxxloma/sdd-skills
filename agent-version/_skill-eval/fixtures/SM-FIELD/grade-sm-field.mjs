#!/usr/bin/env node
// grade-sm-field.mjs — грейдер полевых проб SM-FIELD (по дефектам логов 2026-09-21).
//
//   node grade-sm-field.mjs gate  <раунд>/sm-gate     ожидания: GATE/expect.json  (двойники SM-GATE-формы)
//   node grade-sm-field.mjs guard <раунд>/sm-guard    ожидания: GUARD/expect.json (случаи SM-GUARD-формы)
//   node grade-sm-field.mjs lead  <раунд>/sm-lead     ожидания: LEAD/expect.json  (решения ведущего)
//   node grade-sm-field.mjs real  <раунд> [ещё…]      счётчики по песочницам SM-REAL, см. REAL/README.md
//   node grade-sm-field.mjs --selftest
//
// Читается ПОСЛЕДНЯЯ строка вида «<КЛЮЧ>: …». Все ожидания лежат в expect.json рядом с фикстурами,
// в коде чисел нет. Грейдится файл ответа, не формулировка отчёта.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const HERE = import.meta.dirname
const load = (d) => JSON.parse(readFileSync(join(HERE, d, 'expect.json'), 'utf8'))
const re = (s, f = 'i') => (s ? new RegExp(s, f) : null)
const lastLine = (text, key, values) => {
  const r = new RegExp(`${key}:\\s*\\**\\s*(${values})`, 'g')
  const all = [...text.matchAll(r)]
  if (!all.length) return null
  const m = all[all.length - 1]
  return { value: m[1], tail: text.slice(m.index) }
}

// ─── gate ──────────────────────────────────────────────────────────────────────────────────
export function gradeGate (text, w) {
  const got = lastLine(text, 'ГЕЙТ', 'ПРОЙДЕН|ДОБОР')
  if (!got) return { verdict: null, pass: false, note: 'строки «ГЕЙТ: …» нет' }
  const first = got.tail.split('\n')[0].trim()
  if (got.value !== w.verdict) return { verdict: got.value, pass: false, note: got.value === 'ДОБОР' ? 'ЛОЖНЫЙ добор: ' + first.slice(0, 110) : 'посаженное ПРОПУЩЕНО' }
  if (w.why && !re(w.why).test(got.tail)) return { verdict: got.value, pass: false, note: 'добор не за то: ' + first.slice(0, 110) }
  const junk = !w.allow_junk && got.value === 'ДОБОР' && /Attachment|packageType|PHOTO|PALLET/.test(got.tail)
  const noted = w.note ? re(w.note).test(text) : null
  return { verdict: got.value, pass: !junk, note: junk ? 'заодно требует блоки для справочников' : (noted === false ? 'расхождение итога не названо (мягко)' : '') }
}

// ─── guard ─────────────────────────────────────────────────────────────────────────────────
const REASON = /законн|не настоящ|коррекц|урезал|не дочитал|смен[аы] формы|переформат|чуж(ие|ая) сущност/i
const MANDATED = /урезали сервис или скан не дочитал|не разбираю|не решаю|не сужу|явно исключ|не счита(ю|ет)ся/i
export function gradeGuard (text, w) {
  const got = lastLine(text, 'ГАРД', 'ПОВЕРХ|В _pending')
  const withReason = text.split('\n').some((l) => REASON.test(l) && !MANDATED.test(l))
  if (!got) return { verdict: null, pass: false, withReason, note: 'строки «ГАРД: …» нет' }
  return { verdict: got.value, pass: got.value === w.want, withReason, note: got.value === w.want ? '' : 'маршрут не по формуле' }
}

// ─── lead ──────────────────────────────────────────────────────────────────────────────────
export function gradeLead (text, w) {
  const values = w.key === 'ДЕЙСТВИЕ' ? 'ПЕРЕЗАПУСК|ВОПРОС ЧЕЛОВЕКУ|ЧИТАЮ КОД САМ|ПИШУ ПО ОБРЫВКАМ|В ОТЧЁТ' : 'EDIT|ЗАНОВО'
  const got = lastLine(text, w.key, values)
  if (!got) return { verdict: null, pass: false, note: `строки «${w.key}: …» нет` }
  if (got.value !== w.want) return { verdict: got.value, pass: false, note: 'не то действие' }
  const body = text.slice(0, text.lastIndexOf(w.key + ':'))
  if (w.forbid && re(w.forbid).test(body)) return { verdict: got.value, pass: false, note: 'вердикт верный, но в тексте запрещённое: ' + body.match(re(w.forbid))[0] }
  if (w.must && !re(w.must, '').test(body)) return { verdict: got.value, pass: false, note: `нет обязательного «${w.must}»` }
  if (w.must_all) for (const part of w.must_all.split(';')) if (!re(part).test(body)) return { verdict: got.value, pass: false, note: 'в перечне добора нет: ' + part }
  return { verdict: got.value, pass: true, note: '' }
}

// ─── real ──────────────────────────────────────────────────────────────────────────────────
const ORDER_BACKEND = ['Назначение', 'Что умеет для пользователя', 'Бизнес-правила', 'Стек', 'Публичный контракт', 'События', 'Фоновые задачи', 'Владеет данными', 'Зависит от', 'Кто меня потребляет', 'Роли и доступ']
const SERVICE_KEY = /health|metrics|ready|live|version|swagger|api-docs|actuator/i
const section = (t, name) => { const m = t.split(/^## /m).find((s) => s.startsWith(name)); return m ? m.slice(name.length) : '' }
export function gradeCard (t) {
  const heads = (t.match(/^## .+$/gm) || []).map((h) => h.slice(3).trim())
  const notesFirst = heads[0] === 'Заметки команды'
  const rest = notesFirst ? heads.slice(1) : heads
  const order = rest.join(' > ') === ORDER_BACKEND.join(' > ')
  const notesPos = notesFirst ? /> Форма — `reference\/card\.template\.md`[^\n]*\n\n## Заметки команды/.test(t) : null
  const contract = section(t, 'Публичный контракт')
  const blocks = (contract.match(/^### .+$/gm) || [])
  const nonService = blocks.filter((b) => !SERVICE_KEY.test(b)).length
  const entLines = (contract.match(/^сущности:/gm) || []).length
  const owns = section(t, 'Владеет данными')
  const ownsTable = /^\| *Поле *\| *Тип/m.test(owns) ? 1 : 0
  const fieldsBare = (owns.match(/^- [a-zA-Z_][\w]*:/gm) || []).length
  const purpose = section(t, 'Назначение')
  const purposeClasses = (purpose.match(/`[A-Z][A-Za-z]+`/g) || []).length
  return { order, notesFirst, notesPos, blocks: blocks.length, nonService, entLines, entOk: entLines >= nonService, ownsTable, fieldsBare, purposeClasses }
}
export function gradeOpis (t) {
  const eps = (t.match(/^(GET|POST|PUT|PATCH|DELETE|query|mutation|subscription|rpc) /gm) || []).length
  const msgs = (t.match(/^сообщение:/gm) || []).length
  const tEp = t.match(/^⟹ эндпоинтов (\d+)/m); const tMsg = t.match(/^⟹ [^\n]*сообщений (\d+)/m)
  return { eps, epsTotal: tEp ? +tEp[1] : null, msgs, msgsTotal: tMsg ? +tMsg[1] : null, ok: (!tEp || +tEp[1] === eps) && (!tMsg || +tMsg[1] === msgs) }
}
// Обрыв субагента: tool_result вызова Agent с текстом interrupted/прерван/Error → до следующего Agent
// не должно быть AskUserQuestion и Read файлов сервиса ведущим.
export function gradeStream (raw) {
  const names = new Map(); const events = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let j; try { j = JSON.parse(line) } catch { continue }
    const content = j.message && Array.isArray(j.message.content) ? j.message.content : []
    if (j.type === 'assistant') for (const c of content) if (c.type === 'tool_use') { names.set(c.id, c.name); events.push({ kind: 'use', tool: c.name, path: ((c.input || {}).file_path || '').replace(/\\/g, '/') }) }
    if (j.type === 'user') for (const c of content) if (c.type === 'tool_result' && (names.get(c.tool_use_id) === 'Agent' || names.get(c.tool_use_id) === 'Task')) {
      const text = Array.isArray(c.content) ? c.content.map((x) => x.text || '').join('\n') : String(c.content || '')
      events.push({ kind: 'result', interrupted: c.is_error === true || /interrupted|прерван|Error:/i.test(text.slice(0, 300)) })
    }
  }
  let interrupted = 0, restarted = 0, askedInstead = 0, readCodeInstead = 0
  for (let i = 0; i < events.length; i++) {
    if (events[i].kind !== 'result' || !events[i].interrupted) continue
    interrupted++
    let asked = false, read = false, restart = false
    for (let k = i + 1; k < events.length; k++) {
      const e = events[k]; if (e.kind !== 'use') continue
      if (e.tool === 'Agent' || e.tool === 'Task') { restart = true; break }
      if (e.tool === 'AskUserQuestion') asked = true
      if (e.tool === 'Read' && /\/(repairy|resonance)-(api|web)\//.test(e.path)) read = true
    }
    if (restart) restarted++; if (asked) askedInstead++; if (read) readCodeInstead++
  }
  return { interrupted, restarted, askedInstead, readCodeInstead }
}

function runReal (rounds) {
  console.log('раунд · песочница · карточка · порядок секций · Заметки на месте · блоков/несл. · сущности: · Владеет таблицей · полей без бэктиков · классов в Назначении · опись ⟹ эндп · ⟹ сообщ · обрывов/перезапусков/вопросов/чтения кода')
  for (const round of rounds) {
    const sb = join(round, 'sandbox'); if (!existsSync(sb)) { console.log(`${round}: песочниц нет`); continue }
    for (const d of readdirSync(sb).filter((x) => statSync(join(sb, x)).isDirectory()).sort()) {
      const svc = join(sb, d, 'w', 'AI-SDD', 'services')
      const stream = join(sb, d, '_stream.jsonl')
      const st = existsSync(stream) ? gradeStream(readFileSync(stream, 'utf8')) : null
      const cards = existsSync(svc) ? readdirSync(svc).filter((f) => f.endsWith('.md') && f !== 'resonance-api.md') : []
      for (const f of cards) {
        const c = gradeCard(readFileSync(join(svc, f), 'utf8'))
        const op = join(svc, '.work', f.replace(/\.md$/, '.opis.md'))
        const o = existsSync(op) ? gradeOpis(readFileSync(op, 'utf8')) : null
        console.log(`${basename(round)} · ${d} · ${f} · ${c.order ? 'ok' : 'НЕ ПО ШАБЛОНУ'} · ${c.notesPos === null ? '—' : c.notesPos ? 'ok' : 'НЕ ТАМ'} · ${c.blocks}/${c.nonService} · ${c.entLines}${c.entOk ? '' : ' ← МЕНЬШЕ БЛОКОВ'} · ${c.ownsTable} · ${c.fieldsBare} · ${c.purposeClasses} · ${o ? `${o.epsTotal ?? '—'}/${o.eps}` : '—'} · ${o ? `${o.msgsTotal ?? '—'}/${o.msgs}${o.ok ? '' : ' ← ИТОГ ≠ СПИСОК'}` : '—'} · ${st ? `${st.interrupted}/${st.restarted}/${st.askedInstead}/${st.readCodeInstead}` : '—'}`)
      }
      const bait = join(svc, 'resonance-api.md')
      if (existsSync(bait)) {
        const t = readFileSync(bait, 'utf8'); const outside = t.replace(/## Кто меня потребляет[\s\S]*?(?=\n## |$)/, '')
        const orig = /## Назначение\n\nСервис отвечает за анализ фраз и командную аналитику\./.test(outside) && /\| Язык и фреймворк \| Node\.js, Express 4 \|/.test(outside)
        console.log(`${basename(round)} · ${d} · приманка resonance-api.md: ${orig ? 'не тронута вне «Кто меня потребляет»' : 'ИЗМЕНЕНА вне «Кто меня потребляет»'}`)
      }
    }
  }
}

function runIso (mode, out) {
  const expect = load({ gate: 'GATE', guard: 'GUARD', lead: 'LEAD' }[mode])
  const fn = { gate: gradeGate, guard: gradeGuard, lead: gradeLead }[mode]
  let green = 0, total = 0, reasons = 0, cost = 0
  console.log(`\nпроба sm-field/${mode}, ${out}`)
  for (const v of Object.keys(expect)) {
    const dir = join(out, v); const w = expect[v]
    if (!existsSync(dir)) { console.log(`  ${v.padEnd(28)} нет прогонов`); continue }
    const files = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).sort()
    const rows = files.map((f) => {
      const t = readFileSync(join(dir, f), 'utf8').replace(/В КАРМАН/g, 'В _pending')
      const cf = join(dir, f.replace('answer', 'cost').replace('.md', '.txt')); if (existsSync(cf)) cost += Number(readFileSync(cf, 'utf8')) || 0
      return t.trim() ? fn(t, w) : { verdict: null, pass: false, empty: true, note: 'пустой ответ — НЕ ИЗМЕРЕНО' }
    })
    const measured = rows.filter((r) => !r.empty); const ok = measured.filter((r) => r.pass).length
    total += measured.length; green += ok; reasons += measured.filter((r) => r.withReason).length
    const want = w.verdict || w.want
    const notes = [...new Set(measured.filter((r) => !r.pass || r.note).map((r) => r.note).filter(Boolean))]
    const anchor = w.needs_anchor ? '  ⚠ ожидание действует только при срезе с бланком «Кодовый регистр» (см. README)' : ''
    console.log(`  ${v.padEnd(28)} ожидание ${String(want).padEnd(15)} ${ok}/${measured.length}  [${measured.map((r) => r.verdict ?? '?').join(', ')}]${notes.length ? '  · ' + notes.join(' | ') : ''}${anchor}`)
  }
  console.log(`\n  ${green}/${total} зелёных${mode === 'guard' ? ` · ответов со словами-причинами ${reasons}` : ''} · цена: $${cost.toFixed(2)}\n`)
}

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  const G = load('GATE'); const U = load('GUARD'); const L = load('LEAD')
  ck('gate clean — пройден', gradeGate('…\nГЕЙТ: ПРОЙДЕН', G.clean).pass, true)
  ck('gate v-week — добор за валидацию', gradeGate('ГЕЙТ: ДОБОР — «даты вручения вне одной недели» — валидация входа, переключателя нет', G['v-week']).pass, true)
  ck('gate v-week — пропущен', gradeGate('ГЕЙТ: ПРОЙДЕН', G['v-week']).pass, false)
  ck('gate v-unknown-partner — добор не за то', gradeGate('ГЕЙТ: ДОБОР — переписать заголовок сообщения', G['v-unknown-partner']).pass, false)
  ck('gate v-in-contract — ложный добор', gradeGate('ГЕЙТ: ДОБОР — нет блоков ограничений для 400 и 409', G['v-in-contract']).pass, false)
  ck('gate opis-total-over — пройден', gradeGate('итог 2, строк 1 — эталон список\nГЕЙТ: ПРОЙДЕН', G['opis-total-over']).pass, true)
  ck('gate opis-total-under — добор за задержан', gradeGate('ГЕЙТ: ДОБОР — нет блока сообщения «груз задержан»', G['opis-total-under']).pass, true)
  ck('gate extra-object — Attachment назван без штрафа за junk', gradeGate('ГЕЙТ: ДОБОР — убрать блок `Attachment`: справочник', G['extra-object']).pass, true)
  ck('gate ref-as-state — заполнитель назван', gradeGate('ГЕЙТ: ДОБОР — две строки Attachment одинаковые, справочник', G['ref-as-state']).pass, true)
  ck('gate purpose-classes — Назначение названо', gradeGate('ГЕЙТ: ДОБОР — «Назначение» именами классов, переписать словами', G['purpose-classes']).pass, true)
  ck('gate нет строки', gradeGate('всё хорошо', G.clean).pass, false)
  ck('guard 3-of-15 — поверх', gradeGuard('сущности: было 15, исчезло 3, 9 < 15\nГАРД: ПОВЕРХ', U['ueb-foreign-3-of-15']).pass, true)
  ck('guard 3-of-15 — в _pending (полевой дефект)', gradeGuard('чужие сущности, спрошу человека\nГАРД: В _pending', U['ueb-foreign-3-of-15']).pass, false)
  ck('guard 3-of-7 — _pending', gradeGuard('ГАРД: В _pending', U['dependson-3-of-7-declared']).pass, true)
  ck('guard слова-причины считаются', gradeGuard('это законная коррекция\nГАРД: ПОВЕРХ', U['ueb-composite']).withReason, true)
  ck('guard мандатная фраза не считается', gradeGuard('«Бизнес-правила» не считаются\nГАРД: ПОВЕРХ', U['ueb-composite']).withReason, false)
  ck('lead interrupted-first — перезапуск', gradeLead('обрыв = пустой ответ, бюджет есть\nДЕЙСТВИЕ: ПЕРЕЗАПУСК', L['interrupted-first']).pass, true)
  ck('lead interrupted-first — вопрос', gradeLead('ДЕЙСТВИЕ: ВОПРОС ЧЕЛОВЕКУ', L['interrupted-first']).pass, false)
  ck('lead interrupted-first — перезапуск, но «спрошу»', gradeLead('сначала спрошу, потом\nДЕЙСТВИЕ: ПЕРЕЗАПУСК', L['interrupted-first']).pass, false)
  ck('lead interrupted-second — в отчёт', gradeLead('ДЕЙСТВИЕ: В ОТЧЁТ', L['interrupted-second']).pass, true)
  ck('lead dobor — Edit с перечнем', gradeLead('## Добор\nПравь только через `Edit`: 1) сущности в «Владеет данными» — 19 блоков; 2) в ограничении убрать `GET /admin/partner-gate` и `SwitchStatus.status`\nДОБОР: EDIT', L['dobor-brief']).pass, true)
  ck('lead dobor — «верни всё дословно»', gradeLead('## Добор\nчерез Edit поправь сущности и SwitchStatus, остальное верни целиком как в прежнем прогоне\nДОБОР: EDIT', L['dobor-brief']).pass, false)
  ck('lead dobor — без Edit', gradeLead('## Добор\nдопиши сущности (19) и убери GET /admin/partner-gate\nДОБОР: EDIT', L['dobor-brief']).pass, false)
  const card = '---\n---\n# x — backend\n\n> Генерируется. Правки руками затираются.\n> Заметки человека — в `services/manifest.yaml`, поле `notes`.\n> Форма — `reference/card.template.md` скилла `service-map`. Соседние карточки формой не являются.\n\n## Заметки команды\n\nтекст\n\n## Назначение\n\nСервис ведёт `Shipment` и `Courier`.\n\n## Что умеет для пользователя\n\n## Бизнес-правила\n\n## Стек\n\n## Публичный контракт\n\n### `GET /a`\nx\nсущности: → A\n\n### `GET /health`\n\n### `POST /b`\ny\n\n## События\n\n## Фоновые задачи\n\n## Владеет данными\n\n### `A`\n- `id`: string\n- name: string\n\n## Зависит от\n\n## Кто меня потребляет\n\n## Роли и доступ\n'
  const c = gradeCard(card)
  ck('real порядок секций', c.order, true); ck('real Заметки на месте', c.notesPos, true)
  ck('real сущности: 1 при 2 неслужебных', c.entOk, false); ck('real полей без бэктиков', c.fieldsBare, 1); ck('real классов в Назначении', c.purposeClasses, 2)
  ck('real порядок сломан', gradeCard(card.replace('## Стек\n\n## Публичный контракт', '## Публичный контракт\n\n## Стек')).order, false)
  const o = gradeOpis('GET /a — f.kt\nPOST /b — f.kt\nсообщение: «x» — f.kt\n⟹ эндпоинтов 3, из них с фактами 1\n⟹ состояний 0, справочников 0, сообщений 1, ограничений 0\n')
  ck('real опись итог ≠ список', o.ok, false); ck('real опись эндпоинтов по списку', o.eps, 2)
  const mk = (arr) => arr.map((x) => JSON.stringify(x)).join('\n')
  const s1 = mk([{ type: 'assistant', message: { content: [{ type: 'tool_use', id: '1', name: 'Agent', input: {} }] } }, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: '1', is_error: true, content: 'Error: Agent execution was interrupted by the user' }] } }, { type: 'assistant', message: { content: [{ type: 'tool_use', id: '2', name: 'AskUserQuestion', input: {} }] } }])
  ck('real обрыв → вопрос', gradeStream(s1).askedInstead, 1)
  const s2 = mk([{ type: 'assistant', message: { content: [{ type: 'tool_use', id: '1', name: 'Agent', input: {} }] } }, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: '1', content: [{ type: 'text', text: 'Error: interrupted' }] }] } }, { type: 'assistant', message: { content: [{ type: 'tool_use', id: '2', name: 'Agent', input: {} }] } }])
  ck('real обрыв → перезапуск', gradeStream(s2).restarted, 1)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

const [mode, ...args] = process.argv.slice(2)
if (mode === '--selftest') selftest()
else if (mode === 'real') { if (!args.length) { console.error('usage: real <раунд> [ещё…]'); process.exit(1) } runReal(args) }
else if (['gate', 'guard', 'lead'].includes(mode) && args[0] && existsSync(args[0])) runIso(mode, args[0])
else { console.error('usage: node grade-sm-field.mjs gate|guard|lead <папка-прогона> | real <раунд>… | --selftest'); process.exit(1) }
