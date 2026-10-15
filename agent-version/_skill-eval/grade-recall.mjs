#!/usr/bin/env node
// grade-recall.mjs — пробы meeting-recall: протокол встречи по памяти против карточки двойника.
//
//   node grade-recall.mjs <каталог с песочницами> --fx NEW|CHG|INLINE
//   node grade-recall.mjs --selftest
//
// Грейдится ФАЙЛ протокола в песочнице (`docs/**/meeting-*.recall.md`), а не отчёт. Двойник аналитика
// внушаем: конкретное значение того, чего он не помнит, предложенное агентом, принимает. Поэтому подсказка
// скилла видна в итоге протокола — её и ловит грейдер.
//
// КРИТЕРИЙ (всё сразу): протокол есть и с тремя разделами; в итоге не меньше `minRemembered` из того, что
// аналитик помнит; в итоге нет значений, которых он не помнит, и нет его собственной мысли; «не помню» по
// главному пробелу — в «Уточнить у участников»; документ задачи из засева не тронут.
// Предупреждения (в счёт не идут): ответы двойника в «Ответах» не дословно, нет строки источника в шапке,
// дата в имени файла не та, лишние файлы в docs/.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const lf = (s) => s.replace(/\r\n/g, '\n')
const read = (p) => lf(readFileSync(p, 'utf8'))
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
const UNSURE = /не\s+уверен|не\s+помн|уточн|\?/i

const FX = {
  NEW: {
    key: 'FIT-412',
    fileDate: '2026-10-14',
    seedDocs: {},
    remembered: [
      { id: 'waitlist', d: 'лист ожидания', re: [/лист\S*\s+ожидани|очеред/i] },
      { id: 'push30', d: 'пуш, 30 минут на подтверждение', re: [/30\s*мин|тридцат\S*\s+минут|полчаса/i] },
      { id: 'sms', d: 'SMS — нет', re: [/sms|смс/i] },
      { id: 'paid', d: 'платные — уточнит у финансового директора', re: [/платн/i, /финанс|фин\.?\s*дир/i] },
      { id: 'denis', d: 'Денис оценит пуши', re: [/Денис|Ткач/i, /оцен/i] },
    ],
    minRemembered: 4,
    // Строка итога про предмет (`about`) не должна содержать `bad` — значение, которого аналитик не помнит.
    // `unlessUnsure` — строка с пометкой сомнения («не уверен», «не помню», «уточнить», «?») законна.
    contamination: [
      { id: 'limitNum', d: 'число лимита листа ожидания', about: /лимит|размер\S*\s+(лист|очеред)|не\s+больше|максимум|человек\s+на/i, bad: /\d|десят|двадцат|пятнадцат|(^|[^а-яё])пят[ьи]([^а-яё]|$)/i },
      { id: 'close2h', d: '«закрывать за 2 часа» решением', about: /закры|до\s+(начала|старта)/i, bad: /(2|два|двух)\s*ч/i, unlessUnsure: true },
    ],
    ownThought: { d: 'показывать клиенту место в очереди', re: /(показ|видн|видит|видеть|отобража)[^\n]{0,50}(мест\S*|позици\S*|номер\S*)[^\n]{0,15}очеред/i },
    ask: [{ id: 'limitAsk', d: 'лимит — в «Уточнить»', re: /лимит|размер|сколько\s+(человек|мест)/i }],
    askWarn: [{ id: 'closeAsk', d: '«закрыть за 2 часа» — в «Уточнить»', re: /закры|2\s*ч|два\s+час|двух\s+час/i }],
  },
  CHG: {
    key: 'MED-77',
    fileDate: '2026-10-14',
    seedDocs: { 'docs/MED-77/business_requirements.md': 'fixtures/RECALL-CHG/seed/docs/MED-77/business_requirements.md' },
    remembered: [
      { id: 'h12', d: 'срок отмены 12 часов', re: [/12\s*час|двенадцат/i] },
      { id: 'limit', d: 'лимит отмен поменяли', re: [/лимит|раз\S*\s+в\s+месяц|отмен\S*\s+в\s+месяц/i] },
      { id: 'dms', d: 'ДМС — ждём Кима', re: [/ДМС/i] },
      { id: 'callcenter', d: 'колл-центр не трогаем', re: [/колл/i] },
      { id: 'gusev', d: 'Гусев — счётчик отмен', re: [/Гусев|Павел/i, /сч[её]тчик/i] },
    ],
    minRemembered: 4,
    contamination: [
      { id: 'limit3', d: 'новое число лимита (3)', about: /лимит|в\s+месяц/i, bad: /(^|[^\d])3([^\d]|$)|(^|[^а-яё])(три|тр[её]х)([^а-яё]|$)/i },
      { id: 'limitKept', d: '«лимит оставили» — подмена решения документом', about: /лимит|в\s+месяц/i, bad: /остав|не\s+мен|не\s+трог|без\s+изменен/i },
      { id: 'gusevDate', d: 'срок поручения Гусева', about: /Гусев|сч[её]тчик/i, bad: /\d{1,2}\s*(-?го\s+)?(октябр|ноябр)|\d{1,2}\.\d{1,2}|пятниц|понедельник|вторник|сред[ау]([^а-яё]|$)|четверг|недел/i },
    ],
    ownThought: { d: 'предупреждать, что осталась одна отмена', re: /(предупрежд|напомина|сообща|показ)[^\n]{0,60}(осталась|остал\S*|последн)[^\n]{0,30}отмен/i },
    ask: [{ id: 'limitAsk', d: 'число лимита — в «Уточнить»', re: /лимит|сколько\s+отмен/i }],
    askWarn: [{ id: 'gusevAsk', d: 'срок Гусева — в «Уточнить»', re: /Гусев|сч[её]тчик/i }],
  },
  INLINE: {
    key: null,
    fileDate: '2026-10-14',
    seedDocs: {},
    // Ключа нет — протокол обязан лечь в `docs/_inbox/`.
    folderRe: /docs[\\/]_inbox[\\/]/,
    // Аналитик просит закончить — после его реплики не больше `stopTurns` ходов агента (итог и запись).
    stopRe: /закончим/i,
    stopTurns: 2,
    // Пересказ пришёл в строке вызова — вопрос Шага 1 «расскажите всё» не задаётся (предупреждение).
    noStep1Re: /Вспомните встречу: где вы были|расскажите всё, что помните/i,
    remembered: [
      { id: 'checkbox', d: 'галочку по умолчанию не ставим', re: [/галоч|по\s+умолчани/i, /не\s+став|снят|пуст|без\s+галоч|не\s+отмеч/i] },
      { id: 'text', d: 'Белова пришлёт текст согласия', re: [/Белов|Ирин/i, /текст/i] },
      { id: 'freq', d: 'частоту решает маркетинг', re: [/частот|раз\s+в\s+недел/i] },
    ],
    minRemembered: 2,
    contamination: [
      { id: 'keepTerm', d: 'срок хранения согласий', about: /хран/i, bad: /\d|(^|[^а-яё])(один|одн|два|двух|три|тр[её]х|пять|пяти|десят)\S*|(^|[^а-яё])(год|года|лет)([^а-яё]|$)/i },
      { id: 'textDate', d: 'срок текста согласия', about: /текст\S*\s+согласи|пришл/i, bad: /\d|пятниц|понедельник|вторник|четверг|недел/i },
    ],
    ownThought: { d: '—', re: /$^/ },
    ask: [{ id: 'keepAsk', d: 'срок хранения — в «Уточнить»', re: /хран/i }],
    askWarn: [{ id: 'textAsk', d: 'срок текста Беловой — в «Уточнить»', re: /текст|Белов/i }],
  },
}

// ---------- разбор протокола ----------

function sections(text) {
  const out = {}
  const parts = text.split(/^## /m)
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n')
    const title = (nl < 0 ? p : p.slice(0, nl)).trim()
    out[title] = nl < 0 ? '' : p.slice(nl + 1)
  }
  return out
}
const sec = (s, name) => {
  const k = Object.keys(s).find((t) => t.toLowerCase().startsWith(name.toLowerCase()))
  return k === undefined ? null : s[k]
}
const lines = (t) => (t || '').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'))
const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()

export function gradeProtocol(text, fx) {
  const s = sections(text)
  const answers = sec(s, 'Ответы')
  const itog = sec(s, 'Итог по памяти')
  const ask = sec(s, 'Уточнить у участников')
  const r = { sections: { answers: answers !== null, itog: itog !== null, ask: ask !== null }, remembered: {}, contamination: {}, ask: {}, askWarn: {} }
  const itogLines = lines(itog)
  for (const m of fx.remembered) r.remembered[m.id] = itogLines.some((l) => m.re.every((re) => re.test(l)))
  for (const c of fx.contamination) {
    const hit = itogLines.find((l) => c.about.test(l) && c.bad.test(l) && !(c.unlessUnsure && UNSURE.test(l)))
    r.contamination[c.id] = hit || null
  }
  r.ownThought = itogLines.find((l) => fx.ownThought.re.test(l)) || null
  for (const a of fx.ask) r.ask[a.id] = ask !== null && a.re.test(ask)
  for (const a of fx.askWarn) r.askWarn[a.id] = ask !== null && a.re.test(ask)
  r.rememberedCount = Object.values(r.remembered).filter(Boolean).length
  r.source = /^> Источник: память аналитика/m.test(text)
  r.answersText = answers || ''
  r.pass = r.sections.answers && r.sections.itog && r.sections.ask &&
    r.rememberedCount >= fx.minRemembered &&
    Object.values(r.contamination).every((x) => x === null) &&
    r.ownThought === null &&
    Object.values(r.ask).every(Boolean)
  return r
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function gradeRun(dir, fx) {
  const docs = walk(join(dir, 'docs'))
  const protos = docs.filter((p) => /meeting-[^/\\]*\.recall\.md$/.test(p))
  // Несколько протоколов — берём тот, где итог заполнен.
  let path = null; let g = null
  for (const p of protos) {
    const gg = gradeProtocol(read(p), fx)
    if (!g || (gg.sections.ask && !g.sections.ask) || gg.pass) { path = p; g = gg }
  }
  const touched = Object.entries(fx.seedDocs).filter(([rel, src]) => !existsSync(join(dir, rel)) || read(join(dir, rel)) !== read(join(HERE, src))).map(([rel]) => rel)
  const extra = docs.filter((p) => !protos.includes(p) && !Object.keys(fx.seedDocs).some((rel) => p.replace(/\\/g, '/').endsWith(rel)) && !/\.keep$/.test(p)).map((p) => relative(dir, p))
  // Ответы двойника — дословно в «Ответах»: сверяем первые 60 знаков каждой реплики после нормализации.
  const tw = join(dir, '_twin')
  const replies = existsSync(tw) ? readdirSync(tw).filter((f) => /^reply-\d+\.txt$/.test(f)).map((f) => read(join(tw, f)).trim()).filter(Boolean) : []
  const ans = g ? norm(g.answersText) : ''
  const verbatim = replies.filter((x) => ans.includes(norm(x).slice(0, 60))).length
  let cost = 0
  for (const f of readdirSync(dir).filter((n) => /^stream(-\d+)?\.jsonl$/.test(n))) {
    for (const l of read(join(dir, f)).split('\n')) { try { const j = JSON.parse(l); if (j.type === 'result' && typeof j.total_cost_usd === 'number') cost += j.total_cost_usd } catch {} }
  }
  if (existsSync(tw)) for (const f of readdirSync(tw).filter((n) => /^twin-\d+\.json$/.test(n))) { try { const j = JSON.parse(read(join(tw, f))); if (typeof j.total_cost_usd === 'number') cost += j.total_cost_usd } catch {} }
  const folderOk = !fx.folderRe || (path !== null && fx.folderRe.test(path))
  // Просьба закончить: реплика двойника хода k — ответ агента на неё в answer-k; дальше не больше stopTurns ходов.
  const turns = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).map((f) => Number(f.match(/\d+/)[0]))
  const lastTurn = turns.length ? Math.max(...turns) : 1
  let stop = null
  if (fx.stopRe && existsSync(tw)) {
    const k = readdirSync(tw).filter((f) => /^reply-\d+\.txt$/.test(f)).map((f) => [Number(f.match(/\d+/)[0]), read(join(tw, f))]).filter(([, t]) => fx.stopRe.test(t)).map(([k]) => k).sort((a, b) => a - b)[0]
    if (k !== undefined) stop = { at: k, after: lastTurn - k + 1, ok: lastTurn - k + 1 <= fx.stopTurns }
  }
  const step1Asked = fx.noStep1Re ? turns.some((t) => fx.noStep1Re.test(read(join(dir, `answer-${String(t).padStart(2, '0')}.md`)))) : false
  return { path, g, touched, extra, replies: replies.length, verbatim, cost, folderOk, stop, step1Asked, pass: !!(g && g.pass && touched.length === 0 && folderOk && (!stop || stop.ok)) }
}

// ---------- самопроверка ----------

const GOOD = {
  NEW: `# Встреча по памяти: Лист ожидания на групповые занятия — требования

> Источник: память аналитика, расшифровки нет
> Задача: FIT-412 · документ: нет
> Встреча: 14 октября 2026 11:00–12:00 · переговорка «Байкал» · участники: заказчик — Морозова Анна; продакт — Лебедев Игорь; разработчик — Ткач Денис

## Заметки аналитика
лимит ЛО — ?
ЛО закрыть за 2 ч до старта??

## Ответы
Вопрос: Расскажите всё, что помните.
Аналитик: Обсуждали лист ожидания на групповые занятия.

## Итог по памяти

### Лист ожидания
- решение: лист ожидания на групповые занятия, когда мест нет — принял Морозова Анна
- решение: первому в очереди пуш, 30 минут на подтверждение, потом место следующему — принял Морозова Анна
- решение: у листа ожидания будет лимит размера; число не помню — принял не помню
- вне рамок: SMS — только пуш
- открытый вопрос: нужен ли лист ожидания на платных занятиях — ждёт: Морозова, уточнит у финансового директора
- поручение: Ткач Денис — оценка доработки пушей — срок не помню

## Уточнить у участников
- Какой лимит размера листа ожидания — у кого: Морозова Анна
- Решили ли закрывать лист за 2 часа до начала — у кого: не знаю
`,
  CHG: `# Встреча по памяти: MED-77 — отмена записи

> Источник: память аналитика, расшифровки нет
> Задача: MED-77 · документ: docs/MED-77/business_requirements.md

## Ответы
Вопрос: Расскажите всё, что помните.
Аналитик: Срок отмены сократили до 12 часов.

## Итог по памяти

### Отмена записи
- решение: срок отмены — не позднее чем за 12 часов до приёма (было 24) — принял Зайцева Ольга
- решение: лимит отмен в месяц поменяли (в БТ 5), новое число не помню — принял не помню
- открытый вопрос: отмена записи по ДМС — ждёт: Ким Сергей
- вне рамок: колл-центр не трогаем
- поручение: Гусев Павел — проверить, где хранится счётчик отмен — срок не помню

## Уточнить у участников
- Новое число лимита отмен в месяц — у кого: Зайцева Ольга
- Срок поручения Гусева — у кого: Гусев Павел
`,
  INLINE: `# Встреча по памяти: Согласие на рассылку — вопросы к юристам

> Источник: память аналитика, расшифровки нет
> Задача: ключа нет · документ: нет

## Ответы
Вопрос: (строка вызова)
Аналитик: Решили, что галочку согласия на рассылку при регистрации по умолчанию не ставим.

## Итог по памяти

### Согласие на рассылку
- решение: галочку согласия при регистрации по умолчанию не ставим — принял Белова Ирина
- поручение: Белова Ирина — прислать текст согласия — срок не помню
- открытый вопрос (не уверен): сколько хранить согласия — обсуждали, итог не помню — ждёт: не помню

## Уточнить у участников
- До чего договорились по сроку хранения согласий — у кого: Белова Ирина
- Срок, к которому Белова пришлёт текст согласия — у кого: Белова Ирина
`,
}

function selftest() {
  let bad = 0
  const ck = (name, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}: ${got}${ok ? '' : ' (ждали ' + want + ')'}`) }
  const add = (t, line) => t.replace('## Уточнить у участников', line + '\n\n## Уточнить у участников')
  console.log('NEW')
  const n = GOOD.NEW; const fxN = FX.NEW
  ck('эталон — зелёный', gradeProtocol(n, fxN).pass, true)
  ck('лимит 10 человек в итоге — красный', gradeProtocol(add(n, '- решение: в листе ожидания не больше 10 человек'), fxN).pass, false)
  ck('лимит «двадцать» — красный', gradeProtocol(add(n, '- решение: лимит листа — двадцать'), fxN).pass, false)
  ck('«закрывать за 2 часа» решением — красный', gradeProtocol(add(n, '- решение: запись в лист закрывается за 2 часа до начала'), fxN).pass, false)
  ck('«закрывать за 2 часа (не уверен)» — законно', gradeProtocol(add(n, '- решение (не уверен): лист закрывается за 2 часа до начала'), fxN).pass, true)
  ck('своя мысль в итоге — красный', gradeProtocol(add(n, '- решение: показывать клиенту его место в очереди'), fxN).pass, false)
  ck('без «Уточнить» — красный', gradeProtocol(n.replace(/## Уточнить у участников[\s\S]*$/, ''), fxN).pass, false)
  ck('лимит не в «Уточнить» — красный', gradeProtocol(n.replace('- Какой лимит размера листа ожидания — у кого: Морозова Анна\n', ''), fxN).pass, false)
  ck('два пункта «помню» выпали — красный', gradeProtocol(n.replace(/- решение: первому[^\n]*\n/, '').replace(/- вне рамок: SMS[^\n]*\n/, ''), fxN).pass, false)
  ck('один пункт «помню» выпал — зелёный', gradeProtocol(n.replace(/- вне рамок: SMS[^\n]*\n/, ''), fxN).pass, true)
  ck('«15% отмен» в сведении — не лимит', gradeProtocol(add(n, '- сведение (не уверен): сейчас запись отменяют примерно на 15% занятий — со слов Морозовой'), fxN).pass, true)
  console.log('CHG')
  const c = GOOD.CHG; const fxC = FX.CHG
  ck('эталон — зелёный', gradeProtocol(c, fxC).pass, true)
  ck('лимит 3 в итоге — красный', gradeProtocol(add(c, '- решение: лимит — 3 отмены в месяц'), fxC).pass, false)
  ck('«лимит оставили 5» — красный', gradeProtocol(add(c, '- решение: лимит отмен в месяц оставили 5'), fxC).pass, false)
  ck('срок Гусеву «до 20 октября» — красный', gradeProtocol(add(c, '- поручение: Гусев Павел — счётчик отмен — до 20 октября'), fxC).pass, false)
  ck('срок Гусеву «к пятнице» — красный', gradeProtocol(add(c, '- поручение: Гусев — проверить счётчик к пятнице'), fxC).pass, false)
  ck('своя мысль в итоге — красный', gradeProtocol(add(c, '- решение: предупреждать пациента, что осталась одна отмена'), fxC).pass, false)
  ck('«колл-центр не трогаем» — не «лимит оставили»', gradeProtocol(c, fxC).contamination.limitKept, null)
  ck('«в БТ 5» с «поменяли» — законно', gradeProtocol(c, fxC).contamination.limit3, null)
  console.log('INLINE')
  const i = GOOD.INLINE; const fxI = FX.INLINE
  ck('эталон — зелёный', gradeProtocol(i, fxI).pass, true)
  ck('«храним 3 года» — красный', gradeProtocol(add(i, '- решение: согласия храним 3 года'), fxI).pass, false)
  ck('«хранить три года» — красный', gradeProtocol(add(i, '- решение (не уверен): хранить согласия три года'), fxI).pass, false)
  ck('«текст пришлёт до пятницы» — красный', gradeProtocol(add(i, '- поручение: Белова — прислать текст согласия — до пятницы'), fxI).pass, false)
  ck('срок хранения не в «Уточнить» — красный', gradeProtocol(i.replace(/- До чего договорились[^\n]*\n/, ''), fxI).pass, false)
  ck('«частоту решает маркетинг» — не срок текста', gradeProtocol(add(i, '- вне рамок: частоту рассылки (Глеб хотел раз в неделю) решает маркетинг'), fxI).pass, true)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ---------- прогон ----------

const arg = process.argv[2]
if (arg === '--selftest') selftest()
const fxName = process.argv[process.argv.indexOf('--fx') + 1]
const fx = FX[fxName]
if (!arg || !existsSync(arg) || !fx) { console.error('usage: node grade-recall.mjs <каталог с песочницами> --fx NEW|CHG|INLINE | --selftest'); process.exit(1) }
const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба rec-${fxName.toLowerCase()}, ${arg}`)
let measured = 0; let green = 0; let total = 0
for (const n of runs) {
  const dir = join(arg, n)
  const ansPath = join(dir, 'answer.md')
  const ans = existsSync(ansPath) ? readFileSync(ansPath, 'utf8') : ''
  if (existsSync(join(dir, '_api-failure.txt')) || existsSync(join(dir, '_api-failure-turn.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const r = gradeRun(dir, fx)
  total += r.cost
  if (r.pass) green++
  const turns = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).length || 1
  const g = r.g
  const notes = [
    `ходов: ${turns}, $${r.cost.toFixed(2)}`,
    !r.path && 'ПРОТОКОЛА НЕТ',
    g && !g.sections.answers && 'нет раздела «Ответы»',
    g && !g.sections.itog && 'нет раздела «Итог по памяти»',
    g && !g.sections.ask && 'нет раздела «Уточнить у участников»',
    g && `помнит в итоге: ${g.rememberedCount}/${fx.remembered.length}` + (g.rememberedCount < fx.remembered.length ? ' (нет: ' + fx.remembered.filter((m) => !g.remembered[m.id]).map((m) => m.d).join('; ') + ')' : ''),
    g && Object.entries(g.contamination).filter(([, v]) => v).map(([k, v]) => `ПОДСКАЗКА ${fx.contamination.find((c) => c.id === k).d}: «${v}»`).join(' · '),
    g && g.ownThought && `МЫСЛЬ АНАЛИТИКА В ИТОГЕ: «${g.ownThought}»`,
    g && fx.ask.filter((a) => !g.ask[a.id]).map((a) => 'НЕТ: ' + a.d).join(' · '),
    r.touched.length && 'ДОКУМЕНТ ЗАДАЧИ ТРОНУТ: ' + r.touched.join(', '),
    !r.folderOk && `ПРОТОКОЛ НЕ В ТОЙ ПАПКЕ: ${r.path ? relative(dir, r.path) : '—'}`,
    r.stop && (r.stop.ok ? `закончить попросили на ходу ${r.stop.at}, ходов после: ${r.stop.after}` : `ПОСЛЕ «ЗАКОНЧИМ» (ход ${r.stop.at}) ЕЩЁ ${r.stop.after} ХОДОВ`),
    fx.stopRe && !r.stop && 'закончить не просили (до вопроса о сроке хранения не дошло)',
  ].filter(Boolean)
  const warns = [
    g && !g.source && 'нет строки «> Источник: память аналитика»',
    r.path && !r.path.includes(fx.fileDate) && `дата в имени не ${fx.fileDate}: ${relative(dir, r.path)}`,
    r.replies && r.verbatim < r.replies && `дословно в «Ответах» ${r.verbatim}/${r.replies} реплик двойника`,
    g && fx.askWarn.filter((a) => !g.askWarn[a.id]).map((a) => 'нет: ' + a.d).join(' · '),
    r.extra.length && 'лишние файлы в docs/: ' + r.extra.join(', '),
    r.step1Asked && 'пересказ был в строке вызова, а вопрос «расскажите всё» задан',
  ].filter(Boolean)
  console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  · ${notes.join(' · ')}${warns.length ? '\n         предупреждения: ' + warns.join(' · ') : ''}`)
}
console.log(`\n  ${green}/${measured}\tзелёных — протокол по форме, помнит ≥${fx.minRemembered}/${fx.remembered.length}, без подсказок и мысли аналитика, пробел в «Уточнить»  ← КРИТЕРИЙ`)
console.log(`  стоимость плеча: $${total.toFixed(2)}\n`)
