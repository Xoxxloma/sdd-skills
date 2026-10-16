#!/usr/bin/env node
// grade-recall.mjs — пробы meeting-recall: протокол встречи по памяти и список пунктов против карточки двойника.
//
//   node grade-recall.mjs <каталог с песочницами> --fx NEW|CHG|INLINE
//   node grade-recall.mjs --selftest
//
// Грейдятся ФАЙЛЫ в песочнице, а не отчёт: протокол (`docs/**/meeting-*.recall.md`) и список пунктов рядом с ним
// (`meeting-*.points.md`, meeting-recall 1.1.0, Шаг 5). Двойник аналитика внушаем: конкретное значение того, чего
// он не помнит, предложенное агентом, принимает. Поэтому подсказка скилла видна в итоге протокола и в списке.
//
// КРИТЕРИЙ ПРОТОКОЛА (всё сразу): протокол есть и с тремя разделами; в итоге не меньше `minRemembered` из того, что
// аналитик помнит; в итоге нет значений, которых он не помнит, и нет его собственной мысли; «не помню» по
// главному пробелу — в «Уточнить у участников»; документ задачи из засева не тронут.
//
// КРИТЕРИЙ СПИСКА (Шаг 5, таблица «В протоколе → Пункт»; всё сразу):
//   - список в папке протокола; шапка `# Пункты:`, `> Источник:` с именем протокола, `> Задача:` (ключ фикстуры;
//     без ключа — не ключ), `> Встреча: … по памяти аналитика`; пункты `- [решено|открыто|сведение|мысль] … · L<n>`,
//     L<n> — строка протокола;
//   - каждый пункт итога, кроме поручения, и каждая строка «Уточнить» о предмете встречи — в списке, вид по таблице:
//     решение с принявшим → [решено]; «принял не помню» и «(не уверен)» у решения → [открыто]; открытый вопрос и вне
//     рамок → [открыто]; сведение → [сведение]; «(не уверен)» у не-решения → «не уверен» в пункте; «Уточнить» →
//     [открыто] (или пункт о том же). «Уточнить» не о предмете (кто начал, что на экране, конец встречи) вправе
//     отсутствовать; есть пунктом — предупреждение;
//   - у [решено] есть `решил:`, и это тот, кто «принял» в итоге; [решено] опирается на решение с принявшим;
//   - поручений нет; [мысль] — от одной до числа ответов «моя мысль» в протоколе (нет таких ответов — ни одной);
//     мысль из карточки, названная двойником, — [мысль] о ней и ни в каком другом виде;
//   - имена, числа и сроки пункта есть в протоколе; подсказок-ловушек фикстуры нет; то, что по карточке не решено, —
//     не [решено].
// Пункт ↔ строка протокола: общие основы слов (5 букв, вес — по редкости основы в строках протокола) плюс вес L<n>.
// Пункт относится к строке с наибольшим совпадением (доля веса строки ≥ 0.4, или ≥ 3 общих основ, или L<n> на неё
// и хоть одна общая); строка «покрыта» пунктом при доле ≥ 0.33, при ≥ 3 общих основах и доле ≥ 0.2 или при L<n> на неё
// и хоть одной общей. Сдвиг L<n> на строку — не красный.
//
// Предупреждения (в счёт не идут): ответы двойника в «Ответах» не дословно, нет строки источника в шапке, дата в
// имени файла не та, лишние файлы в docs/; L<n> не на пункт итога, «Уточнить» или ответ аналитика; вне рамок без
// «не входит ли»; решение «не помню / не уверен» без пометки; строки списка вне формы.

import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const lf = (s) => s.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const read = (p) => lf(readFileSync(p, 'utf8'))
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
const UNSURE = /не\s+уверен|не\s+помн|уточн|\?/i

export const FX = {
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
    // Список пунктов — ожидания по карточке двойника (записаны до прогонов).
    list: {
      // [мысль] о мысли из карточки: «показывать клиенту место в очереди».
      thoughtItem: /(мест|позици|номер)\S*[^\n]{0,25}очеред|очеред[^\n]{0,25}(мест|позици|номер)/i,
      // По карточке не решено или принявший не помнится — [решено] быть не может.
      notDecided: [
        { id: 'limit', d: 'лимит листа (кто принял — не помнит)', re: /лимит|размер\S*\s+(лист|очеред)/i },
        { id: 'close', d: 'закрывать лист за 2 часа (решили ли — не помнит)', re: /закры/i },
        { id: 'paid', d: 'платные занятия (не решили)', re: /платн/i },
      ],
      // Пробел по карточке: есть в протоколе (не поручением) — в списке [открыто] о нём.
      mustOpen: [
        { d: 'лимит листа (число не помнит)', re: /лимит|размер\S*\s+(лист|очеред)/i },
        { d: 'платные занятия (не решили)', re: /платн/i },
      ],
      // Поручение из карточки — не [решено], не [сведение], не [мысль].
      errands: [{ d: 'Ткач оценит доработку пушей', re: [/Денис|Ткач/i, /оцен/i] }],
    },
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
    list: {
      // [мысль] о мысли из карточки: «предупреждать, что осталась одна отмена».
      thoughtItem: /остал|оставш|последн|одн\S*\s+отмен/i,
      notDecided: [
        { id: 'dms', d: 'ДМС (ждём Кима)', re: /ДМС/i },
        { id: 'push', d: 'пуш к SMS (помнит смутно)', re: /пуш/i },
      ],
      mustOpen: [
        { d: 'новое число лимита отмен (не помнит)', re: /лимит/i },
        { d: 'ДМС (ждём Кима)', re: /ДМС/i },
      ],
      errands: [{ d: 'Гусев проверит счётчик отмен', re: [/Гусев|сч[её]тчик/i] }],
    },
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
    list: {
      // Мысли в карточке нет — [мысль] в списке быть не должно (это и проверка «ответов «моя мысль» нет»).
      thoughtItem: null,
      notDecided: [{ id: 'keep', d: 'срок хранения согласий (не помнит)', re: /хран/i }],
      mustOpen: [{ d: 'срок хранения согласий (не помнит)', re: /хран/i }],
      errands: [{ d: 'Белова пришлёт текст согласия', re: [/текст/i, /Белов|пришл/i] }],
    },
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

// ---------- список пунктов (Шаг 5) ----------

const KINDS = ['решено', 'открыто', 'сведение', 'мысль']
// Служебные слова и слова формы — не предмет пункта (основы по 5 букв после `norm`).
const STOP = new Set(['решен', 'приня', 'помню', 'увере', 'ждет', 'памят', 'кого', 'решил', 'откры', 'входи', 'знаю',
  'котор', 'чтобы', 'этого', 'если', 'или', 'что', 'кто', 'как', 'все', 'всё', 'это', 'еще', 'уже', 'для', 'при', 'без',
  'над', 'под', 'про', 'так', 'там', 'тот', 'его', 'она', 'они', 'нет', 'был', 'была', 'было', 'будет', 'того', 'чем',
  'тем', 'них', 'сам', 'слов', 'анали', 'вопро', 'сведе', 'мысль', 'вне', 'рамок', 'поруч', 'уточн'])
// Вопросительные слова строк «Уточнить» («к какому сроку», «до чего», «сколько») — во всех формах.
const QSTOP = /^(как|котор|сколь|срок|чего|где|когда|кому|чему)/
const stemsOf = (s) => new Set(norm(s).split(' ').filter((w) => w.length >= 3 && !QSTOP.test(w)).map((w) => w.slice(0, 5)).filter((w) => !STOP.has(w)))
// Совпадение строки протокола (основы E) и пункта (основы I): общих основ k; доля ratio — от веса основ строки, где
// вес основы тем меньше, чем в большем числе строк итога и «Уточнить» она встречается («согласие» во всех строках
// встречи о согласии почти ничего не значит); atL — L<n> пункта на эту строку.
function matcher(entries) {
  const df = new Map()
  for (const e of entries) for (const s of e.E) df.set(s, (df.get(s) || 0) + 1)
  const w = (s) => Math.log(1 + entries.length / (df.get(s) || 1))
  const match = (e, it) => {
    let k = 0; let got = 0; let all = 0
    for (const x of e.E) { all += w(x); if (it.I.has(x)) { k++; got += w(x) } }
    return { k, ratio: all ? got / all : 0, atL: it.Ls.includes(e.line) }
  }
  // Только для покрытия строки «Уточнить»: основы равны по первым четырём буквам («хранения» — «хранить»).
  const same4 = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4))
  match.loose = (e, S) => {
    let got = 0; let all = 0
    for (const x of e.E) { all += w(x); if ([...S].some((y) => same4(x, y))) got += w(x) }
    return all ? got / all : 0
  }
  return match
}
// Основа имени: «Морозовой» → «мороз», «Анной» → «анн», «Кима» → «ким».
const nameStem = (w) => w.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(3, Math.min(5, w.length - 2)))
const wordsOf = (s) => s.toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]+/g) || []
const capitalized = (s) => (s.match(/[A-Za-zА-Яа-яЁё]+/g) || []).filter((w) => /^[А-ЯЁA-Z][а-яёa-z]{2,}$/.test(w))

const ITOG_KIND = /^-\s*(решение|открытый\s+вопрос|вне\s+рамок|поручение|сведение)\s*(\(\s*не\s+уверен\s*\))?\s*:\s*(.*)$/i
// «Уточнить» не о предмете встречи (Шаг 5: «кто начал, что показывали» — не пункт). Узкий признак: строка повторяет
// подсказку самого скилла — Шаг 1 (кто начал, что на экране), Шаг 4 (конец встречи, кто что взял на себя, что назвал
// бы решённым) или сведения о встрече (кто был, дата, место) — и в ней нет ни одного слова предмета из итога
// (имена участников не в счёт). «Кто что взял на себя по лимиту в конце встречи» — о предмете.
const OFF_TOPIC = /кто\s+начал|показывал[аи]?\s+на\s+экране|где\s+(вы\s+)?был[аи]?|конц[еуа]\s+встреч|напоследок|взял[аи]?\s+на\s+себя|назвал[аи]?\s+бы\s+реш[её]нн|кто\s+был\s+на\s+встреч|(дата|время|место)\s+встреч/i
const OFF_TOPIC_STEMS = new Set(['начал', 'показ', 'экран', 'встре', 'конце', 'конец', 'конца', 'напос', 'взял', 'себя', 'назва', 'прого', 'дата', 'время', 'место', 'был'])
// «Уточнить» о том, звучало ли что-то на встрече (ответ на «звучало или ваша мысль» — «не помню»): её покрывает и [мысль].
// Только «звучал…» — слово самого вопроса; «говорили ли …» (Шаг 2, пункты заметок) сюда не относится.
const SOUNDED = /звучал/i
const MY_THOUGHT = /мо[яё]\s+мысл/i
const NOT_MY_THOUGHT = /не\s+мо[яё]\s+мысл/i

export function parseProtocol(text) {
  const ls = text.split('\n')
  if (ls.length && ls[ls.length - 1] === '') ls.pop()
  let secName = ''
  const entries = []
  const blocks = [] // ответы аналитика: строка `Аналитик:` и продолжение до следующего `Вопрос:`
  let cur = null
  ls.forEach((raw, i) => {
    const n = i + 1
    const l = raw.trim()
    if (/^## /.test(l)) { secName = l.slice(3).trim().toLowerCase(); cur = null; return }
    if (secName.startsWith('ответы')) {
      if (/^Аналитик:/.test(l)) { cur = { line: n, last: n, text: l }; blocks.push(cur); return }
      if (/^Вопрос:/.test(l)) { cur = null; return }
      if (cur && l) { cur.text += '\n' + l; cur.last = n }
      return
    }
    if (secName.startsWith('итог') && l.startsWith('-')) {
      const m = l.match(ITOG_KIND)
      if (!m) { entries.push({ line: n, kind: 'другое', raw: l, content: l, E: stemsOf(l) }); return }
      const kind = m[1].toLowerCase().replace(/\s+/g, ' ')
      const body = m[3]
      const unsure = !!m[2] || /\(\s*не\s+уверен\s*\)/i.test(body)
      let content = body
      let by = null
      if (kind === 'решение') {
        const k = body.search(/\s[—–-]+\s*принял[аи]?(?![а-яё])/i)
        if (k >= 0) { content = body.slice(0, k); by = body.slice(k).replace(/^\s*[—–-]+\s*принял[аи]?\s*:?\s*/i, '').replace(/\([^)]*\)/g, ' ').trim() }
      } else if (kind === 'открытый вопрос' || kind === 'сведение') {
        const k = body.search(/\s[—–-]+\s*(ждёт|ждет|со\s+слов)/i)
        if (k >= 0) content = body.slice(0, k)
      }
      const undecided = kind === 'решение' && (!by || /не\s+помн|не\s+знаю|^[—–-]?$/i.test(by))
      entries.push({ line: n, kind, raw: l, content, by, unsure, undecided, E: stemsOf(content) })
      return
    }
    if (secName.startsWith('уточнить') && l.startsWith('-')) {
      const content = l.replace(/^-\s*/, '').split(/\s[—–-]+\s*у\s+кого/i)[0]
      entries.push({ line: n, kind: 'уточнить', raw: l, content, E: stemsOf(content) })
    }
  })
  for (const b of blocks) b.thought = MY_THOUGHT.test(b.text) && !NOT_MY_THOUGHT.test(b.text)
  const names = capitalized(ls.find((l) => /^>\s*Встреча:/.test(l)) || '').map(nameStem)
  const subj = new Set(entries.filter((e) => e.kind !== 'уточнить').flatMap((e) => [...e.E]))
  for (const e of entries.filter((x) => x.kind === 'уточнить')) {
    const rest = [...e.E].filter((s) => !OFF_TOPIC_STEMS.has(s) && !names.some((n) => s.startsWith(n)))
    e.offTopic = OFF_TOPIC.test(e.content) && !rest.some((s) => subj.has(s))
  }
  const sureBy = entries.filter((e) => e.kind === 'решение' && !e.undecided && !e.unsure).flatMap((e) => wordsOf(e.by))
  // Опора имён и чисел — протокол без строк `Вопрос:`: подсказанное агентом значение сначала появляется там.
  // Числа — ещё и без даты и времени из `> Встреча:` («10» из «2026-10-14» опорой лимиту не служит).
  const own = ls.filter((l) => !/^\s*Вопрос:/.test(l))
  return { lines: ls, entries, blocks, sureBy, words: wordsOf(own.join('\n')), numWords: wordsOf(own.filter((l) => !/^>\s*Встреча:/.test(l)).join('\n')) }
}

export function parsePoints(text) {
  const ls = text.split('\n')
  const out = { heading: null, src: null, key: null, meet: null, items: [], stray: [] }
  ls.forEach((raw) => {
    const l = raw.trim()
    if (!l) return
    let m
    if (/^#\s+Пункты:/.test(l)) { out.heading = l; return }
    if ((m = l.match(/^>\s*Источник:\s*(.*)$/))) { out.src = m[1]; return }
    if ((m = l.match(/^>\s*Задача:\s*(.*)$/))) { out.key = m[1].trim(); return }
    if ((m = l.match(/^>\s*Встреча:\s*(.*)$/))) { out.meet = m[1]; return }
    if ((m = l.match(/^-\s*\[([^\]]*)\]\s*(.*)$/))) {
      const kind = m[1].trim().toLowerCase()
      const rest = m[2]
      const k = rest.lastIndexOf('·')
      const tail = k >= 0 ? rest.slice(k + 1) : ''
      const Ls = /^\s*(протокол\s+)?L\d+/i.test(tail) ? [...tail.matchAll(/L(\d+)/g)].map((x) => Number(x[1])) : []
      const body = (Ls.length ? rest.slice(0, k) : rest).trim()
      out.items.push({ raw: l, kind, body, Ls, I: stemsOf(body) })
      return
    }
    out.stray.push(l)
  })
  return out
}

// Имена, числа и сроки пункта, которых нет в протоколе.
const NUM_DATE = /(^|[^а-яё])(один|одн[аоиу]?|дв[аеу]х?|две|тр[её]х|три|четыр[а-яё]*|пят[ьи]|шест[ьи]|сем[ьи]|восем[а-яё]*|девят[а-яё]*|десят[а-яё]*|двенадцат[а-яё]*|пятнадцат[а-яё]*|двадцат[а-яё]*|тридцат[а-яё]*|сорок[а-яё]*|полчаса|полтор[а-яё]*|понедельник[а-яё]*|вторник[а-яё]*|сред[аеуы]|четверг[а-яё]*|пятниц[а-яё]*|суббот[а-яё]*|воскресень[а-яё]*|январ[а-яё]*|феврал[а-яё]*|март[а-яё]*|апрел[а-яё]*|июн[а-яё]*|июл[а-яё]*|август[а-яё]*|сентябр[а-яё]*|октябр[а-яё]*|ноябр[а-яё]*|декабр[а-яё]*|недел[а-яё]*|завтра|послезавтра|квартал[а-яё]*)(?![а-яё])/gi
function ungrounded(body, P) {
  const has = (words, stem) => words.some((w) => w.startsWith(stem))
  const miss = []
  const ws = [...body.matchAll(/[A-Za-zА-Яа-яЁё]+/g)]
  ws.forEach((m, i) => {
    const w = m[0]
    if (i === 0 || !/^[А-ЯЁA-Z][а-яёa-z]{2,}$/.test(w)) return
    if (/[.!?]\s*$/.test(body.slice(0, m.index))) return
    if (!has(P.words, nameStem(w))) miss.push(w)
  })
  for (const m of body.matchAll(/\d+/g)) if (!P.numWords.includes(m[0])) miss.push(m[0])
  for (const m of body.toLowerCase().replace(/ё/g, 'е').matchAll(NUM_DATE)) {
    const w = m[2]
    if (!has(P.numWords, w.slice(0, Math.max(3, Math.min(6, w.length - 1))))) miss.push(w)
  }
  return miss
}

export function gradePoints(listText, protoText, protoName, fx) {
  const P = parseProtocol(protoText)
  const Lp = parsePoints(listText)
  const fails = []
  const warns = []
  const fail = (id, msg) => fails.push({ id, msg })
  const short = (s) => (s.length > 70 ? s.slice(0, 67) + '…' : s)

  // шапка
  if (!Lp.heading) fail('form', 'нет «# Пункты:»')
  if (!Lp.src || !Lp.src.includes(protoName)) fail('form', `«> Источник:» не на протокол ${protoName}: ${Lp.src === null ? 'нет строки' : '«' + Lp.src + '»'}`)
  if (Lp.key === null) fail('form', 'нет «> Задача:»')
  else if (fx.key ? !Lp.key.includes(fx.key) : /[A-Z]{2,}-\d+/.test(Lp.key)) fail('form', `«> Задача: ${Lp.key}» — ждали ${fx.key || '«—»'}`)
  else if (!fx.key && !/^[—–-]$/.test(Lp.key)) warns.push(`«> Задача: ${Lp.key}» — по форме «—»`)
  if (!Lp.meet || !/по\s+памяти\s+аналитика/i.test(Lp.meet)) fail('form', '«> Встреча:» без «по памяти аналитика»')
  else if (fx.fileDate && !Lp.meet.includes(fx.fileDate) && !/14\s+октябр/i.test(Lp.meet)) warns.push(`дата встречи в шапке не ${fx.fileDate}`)
  if (!Lp.items.length) fail('form', 'пунктов нет')
  if (Lp.stray.length) warns.push(`строк вне формы: ${Lp.stray.length} («${short(Lp.stray[0])}»)`)

  // L<n> и вид
  const nLines = P.lines.length
  const entryLines = new Set(P.entries.map((e) => e.line))
  const inBlock = (n, onlyThought) => P.blocks.some((b) => n >= b.line && n <= b.last && (!onlyThought || b.thought))
  let lOff = 0
  for (const it of Lp.items) {
    if (!KINDS.includes(it.kind)) fail('kind', `вид не из четырёх: «${short(it.raw)}»`)
    if (!it.Ls.length) fail('L', `без «· L<n>»: «${short(it.raw)}»`)
    else if (it.Ls.some((n) => n < 1 || n > nLines)) fail('L', `L${it.Ls.find((n) => n < 1 || n > nLines)} вне протокола (${nLines} строк): «${short(it.raw)}»`)
    else if (it.kind === 'мысль' ? !it.Ls.some((n) => inBlock(n, true)) : !it.Ls.some((n) => entryLines.has(n) || inBlock(n, false))) lOff++
  }
  if (lOff) warns.push(`L<n> не на свою строку (пункт итога, «Уточнить», ответ «моя мысль»): ${lOff}`)

  // пункт ↔ строка протокола. Пункт относится к одной строке — с наибольшим совпадением (L<n> добавляет вес); строка
  // «покрыта» любым пунктом, близким к ней. Короткий пункт к длинной строке: хватает трёх общих основ.
  const factual = Lp.items.filter((it) => it.kind !== 'мысль')
  const match = matcher(P.entries)
  for (const it of factual) {
    let best = null; let bs = -1
    for (const e of P.entries) {
      const { k, ratio, atL } = match(e, it)
      if (!(ratio >= 0.4 || k >= 3 || (atL && k >= 1))) continue
      const sc = ratio + (atL ? 0.3 : 0) + k * 0.01
      if (sc > bs) { bs = sc; best = e }
    }
    it.asg = best
  }
  const near = (e, it) => { const { k, ratio, atL } = match(e, it); return ratio >= 0.33 || (k >= 3 && ratio >= 0.2) || (atL && k >= 1) }
  const cov = (e) => factual.filter((it) => it.asg === e || near(e, it))
  for (const e of P.entries) {
    const c = cov(e)
    const has = (kind, re) => c.some((it) => it.kind === kind && (!re || re.test(it.body)))
    const any = (re) => c.some((it) => re.test(it.body))
    const tag = `L${e.line} «${short(e.raw.replace(/^-\s*/, ''))}»`
    if (e.kind === 'решение' && !e.undecided && !e.unsure) {
      if (!has('решено')) fail('lost', `решение с принявшим не [решено]: ${tag}`)
    } else if (e.kind === 'решение') {
      if (!has('открыто')) fail('lost', `решение «${e.unsure ? 'не уверен' : 'принял не помню'}» не [открыто]: ${tag}`)
      else if (!has('открыто', /не\s+уверен|не\s+помн/i)) warns.push(`нет пометки «${e.unsure ? 'не уверен' : 'не помню'}»: ${tag}`)
    } else if (e.kind === 'открытый вопрос') {
      if (!has('открыто')) fail('lost', `открытый вопрос не [открыто]: ${tag}`)
    } else if (e.kind === 'вне рамок') {
      if (!has('открыто')) fail('lost', `вне рамок не [открыто]: ${tag}`)
      else if (!has('открыто', /не\s+входит\s+ли/i)) warns.push(`вне рамок без «не входит ли»: ${tag}`)
    } else if (e.kind === 'сведение') {
      if (!has('сведение')) fail('lost', `сведение не [сведение]: ${tag}`)
    } else if (e.kind === 'поручение') {
      const leak = factual.filter((it) => it.asg === e)
      if (leak.length) fail('errand', `поручение в списке: «${short(leak[0].raw)}» ← ${tag}`)
    } else if (e.kind === 'уточнить' && e.offTopic) {
      // не о предмете встречи: пунктом быть не должна, но если есть — только предупреждение
      if (factual.some((it) => it.asg === e)) warns.push(`«Уточнить» не о предмете встречи — пунктом: ${tag}`)
    } else if (e.kind === 'уточнить') {
      // Покрыта [открыто]-пунктом о том же: близким к ней самой или опирающимся на строку итога о том же —
      // открытый вопрос, решение «не помню / не уверен», вне рамок («о том же уже есть [открыто] — отдельного не пишешь»).
      const open = factual.filter((it) => it.kind === 'открыто')
      const viaItem = open.some((it) => it.asg === e || near(e, it) || match.loose(e, it.I) >= 0.33)
      const viaItog = P.entries.some((q) => (q.kind === 'открытый вопрос' || q.kind === 'вне рамок' || (q.kind === 'решение' && (q.undecided || q.unsure))) &&
        match.loose(e, q.E) >= 0.33 && open.some((it) => it.asg === q))
      // «Звучало ли это на встрече» (вопрос Шага 3 «звучало или ваша мысль») — покрыта и [мысль] о том же предмете.
      const viaThought = SOUNDED.test(e.content) && Lp.items.some((it) => it.kind === 'мысль' && match.loose(e, it.I) >= 0.33)
      if (!viaItem && !viaItog && !viaThought) fail('ask', `строка «Уточнить» не [открыто]: ${tag}`)
    }
    if (e.unsure && e.kind !== 'решение' && e.kind !== 'поручение' && !any(/не\s+уверен/i)) fail('unsure', `«не уверен» потерян: ${tag}`)
  }

  // [решено]: кто решил и на что опирается
  for (const it of Lp.items.filter((x) => x.kind === 'решено')) {
    const m = it.body.match(/решил[аи]?\s*:\s*(.+)$/i)
    if (!m || !wordsOf(m[1]).length || /^\s*[—–-]\s*$/.test(m[1])) { fail('decider', `[решено] без «решил:»: «${short(it.raw)}»`); continue }
    const who = m[1].replace(/\([^)]*\)/g, ' ')
    const names = capitalized(who)
    const toks = names.length ? names.map(nameStem) : wordsOf(who).filter((w) => w.length >= 3).map((w) => w.slice(0, 5))
    if (!toks.length || !toks.every((t) => P.sureBy.some((w) => w.startsWith(t)))) fail('decider', `«решил: ${who.trim()}» — не «принял» решения в итоге: «${short(it.raw)}»`)
    const e = it.asg
    if (!e) fail('decided', `[решено] без опоры в итоге: «${short(it.raw)}»`)
    else if (e.kind === 'решение' && e.unsure) fail('unsure', `«не уверен» записан решением: «${short(it.raw)}» ← L${e.line}`)
    else if (e.kind === 'решение' && e.undecided) fail('undecided', `«принял не помню» записан решением: «${short(it.raw)}» ← L${e.line}`)
    else if (e.kind === 'вне рамок') fail('outscope', `вне рамок записано решением: «${short(it.raw)}» ← L${e.line}`)
    else if (e.kind === 'поручение') fail('errand', `поручение записано решением: «${short(it.raw)}» ← L${e.line}`)
    else if (e.kind !== 'решение') fail('decided', `[решено] не из решения (${e.kind}): «${short(it.raw)}» ← L${e.line}`)
  }

  // мысли
  const m = P.blocks.filter((b) => b.thought).length
  const thoughts = Lp.items.filter((it) => it.kind === 'мысль')
  if (m === 0 && thoughts.length) fail('thought', `лишняя [мысль]: ответа «моя мысль» в протоколе нет — «${short(thoughts[0].raw)}»`)
  else if (m > 0 && !thoughts.length) fail('thought', `мысль потеряна: ответов «моя мысль» ${m}, [мысль] нет`)
  else if (thoughts.length > m) fail('thought', `лишняя [мысль]: ${thoughts.length} при ответах «моя мысль» ${m}`)
  const said = P.blocks.some((b) => fx.ownThought.re.test(b.text))
  if (said && fx.list.thoughtItem && !thoughts.some((it) => fx.list.thoughtItem.test(it.body))) fail('thought', `мысль из карточки («${fx.ownThought.d}») не [мысль] в списке`)
  for (const it of Lp.items.filter((x) => x.kind !== 'мысль' && fx.ownThought.re.test(x.body))) fail('thoughtAsFact', `мысль аналитика пунктом [${it.kind}]: «${short(it.raw)}»`)

  // карточка: пробелы — [открыто]; поручения, не решённое, подсказки; опора имён и чисел
  for (const mo of fx.list.mustOpen) {
    const inProto = P.entries.some((e) => e.kind !== 'поручение' && mo.re.test(e.raw))
    if (inProto && !Lp.items.some((it) => it.kind === 'открыто' && mo.re.test(it.body))) fail('open', `пробел по карточке не [открыто]: ${mo.d}`)
  }
  for (const it of Lp.items) {
    if (['решено', 'сведение', 'мысль'].includes(it.kind)) for (const er of fx.list.errands) if (er.re.every((re) => re.test(it.body))) fail('errand', `поручение «${er.d}» пунктом [${it.kind}]: «${short(it.raw)}»`)
    if (it.kind === 'решено') for (const nd of fx.list.notDecided) if (nd.re.test(it.body)) fail('notDecided', `не решено по карточке — ${nd.d}: «${short(it.raw)}»`)
    for (const c of fx.contamination) if (c.about.test(it.body) && c.bad.test(it.body) && !(c.unlessUnsure && (it.kind === 'открыто' || UNSURE.test(it.body)))) fail('hint', `подсказка — ${c.d}: «${short(it.raw)}»`)
    const miss = ungrounded(it.body, P)
    if (miss.length) fail('grounding', `нет в протоколе: ${miss.join(', ')} — «${short(it.raw)}»`)
  }

  const counts = Object.fromEntries(KINDS.map((k) => [k, Lp.items.filter((it) => it.kind === k).length]))
  return { pass: fails.length === 0, fails, warns, counts, items: Lp.items.length, thoughtsInProto: m, thoughtSaid: said }
}

// ---------- прогон одной песочницы ----------

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

const RE_PROTO = /meeting-[^/\\]*\.recall\.md$/
const RE_POINTS = /meeting-[^/\\]*\.points\.md$/

export function gradeRun(dir, fx) {
  const docs = walk(join(dir, 'docs'))
  const protos = docs.filter((p) => RE_PROTO.test(p))
  // Несколько протоколов — берём тот, где итог заполнен.
  let path = null; let g = null
  for (const p of protos) {
    const gg = gradeProtocol(read(p), fx)
    if (!g || (gg.sections.ask && !g.sections.ask) || gg.pass) { path = p; g = gg }
  }
  // Список пунктов — в папке протокола; несколько — тот, что назван как протокол.
  const pointsAll = docs.filter((p) => RE_POINTS.test(p))
  let listPath = null
  if (path) {
    const near = pointsAll.filter((p) => dirname(p) === dirname(path)).sort()
    listPath = near.find((p) => basename(p) === basename(path).replace(/\.recall\.md$/, '.points.md')) || near[0] || null
  }
  const lg = listPath ? gradePoints(read(listPath), read(path), basename(path), fx) : null
  const listElsewhere = pointsAll.filter((p) => p !== listPath).map((p) => relative(dir, p))
  const touched = Object.entries(fx.seedDocs).filter(([rel, src]) => !existsSync(join(dir, rel)) || read(join(dir, rel)) !== read(join(HERE, src))).map(([rel]) => rel)
  const extra = docs.filter((p) => !protos.includes(p) && !pointsAll.includes(p) && !Object.keys(fx.seedDocs).some((rel) => p.replace(/\\/g, '/').endsWith(rel)) && !/\.keep$/.test(p)).map((p) => relative(dir, p))
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
  const protoPass = !!(g && g.pass && touched.length === 0 && folderOk && (!stop || stop.ok))
  const listPass = !!(lg && lg.pass)
  return { path, g, listPath, lg, listElsewhere, touched, extra, replies: replies.length, verbatim, cost, folderOk, stop, step1Asked, protoPass, listPass, pass: protoPass && listPass }
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

// Эталоны для списка — настоящие зелёные протоколы прошлых прогонов (meeting-recall 1.0.0, форма итога та же):
// NEW — runs/2026-10-14-rec-r2-new/rec-new/run-3, CHG — runs/2026-10-14-rec-r2-chg/rec-chg/run-2,
// INLINE — runs/2026-10-14-rec-r2-inline/rec-inline/run-1. Номера строк L<n> в списках ниже — по ним.
const REF = {
  NEW: `# Встреча по памяти: Лист ожидания на групповые занятия — требования

> Источник: память аналитика, расшифровки нет
> Задача: FIT-412 · документ: нет
> Встреча: 2026-10-14 11:00–12:00 · переговорка «Байкал», часть людей в Zoom · участники: руководитель клиентского сервиса (заказчик) — Морозова Анна; продакт — Лебедев Игорь; разработчик мобильного приложения — Ткач Денис; аналитик — аналитик
> Тема из приглашения: Лист ожидания для групповых занятий

## Заметки аналитика
ЛО на групповые — да (Морозова ок)
пуш первому, 30 мин на подтв.
лимит ЛО — ?
SMS — нет
платные — уточнит у фин. дира
ЛО закрыть за 2 ч до старта??
Денис — оценка пушей

## Ответы

Вопрос: Вспомните встречу: где вы были, кто начал, что показывали на экране. Теперь расскажите всё, что помните, в любом порядке — даже мелочи и то, в чём не уверены. Можно несколькими сообщениями. Закончите — напишите «всё».
Аналитик: Встреча была в переговорке «Байкал», часть людей подключилась по Zoom. Обсуждали лист ожидания на групповые занятия: когда мест нет, клиент встаёт в очередь. Игорь предложил, Анна согласилась. Когда место освобождается, первому в очереди приходит пуш, и у него 30 минут подтвердить, иначе место уходит следующему. SMS не делаем, только пуш, Анна сказала прямо.

Кто начал и что показывали на экране, не помню.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё был лимит на размер листа ожидания — договорились, что он будет, но какое число, не помню. Про платные занятия Анна сказала, что уточнит у финансового директора, нужен ли там лист ожидания. Денис взял оценку доработки пушей. И ещё хорошо бы показывать клиенту его место в очереди.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё вроде Анна говорила, что сейчас запись отменяют примерно на 15% занятий, но это смутно. И в конце она подвела итог: лист ожидания делаем, пуш с 30 минутами, SMS нет. Больше про конец не помню.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё вроде Анна говорила, что Денис оценит доработку пушей к пятнице, но это тоже смутно. Больше ничего не вспомню, кроме заметки про «закрыть за 2 ч до старта», но решили ли это и кто говорил, не помню.

Вопрос: Понял так: обсуждали — очередь и пуш первому с 30 минутами на подтверждение, без SMS; лимит размера листа ожидания; платные занятия; показ клиенту места в очереди; закрытие листа за 2 часа до старта; оценка доработки пушей; доля отмен записи (~15%). Так?; варианты: Все темы на месте / Была ещё тема — напишу / Разделил не так — поправлю
Аналитик: Разделил почти так, только «показывать клиенту место в очереди» — это моя мысль уже сейчас, на встрече такого не звучало. Её лучше не считать темой встречи. Закрытие за 2 часа есть в заметках, но решили ли это, не помню.

Вопрос: Платные занятия: к какому сроку Анна должна уточнить у финансового директора, нужен ли там лист ожидания?; варианты: Не называли / Не помню
Аналитик: Не помню. Срок вроде не называли, но точно сказать не могу.

Вопрос: Вспомните конец встречи: чем закончили, что проговорили напоследок, кто что взял на себя? И если бы Анна Морозова пересказывала встречу своим, что она назвала бы решённым?
Аналитик: В конце Анна подвела итог: лист ожидания делаем, пуш с 30 минутами на подтверждение, SMS нет. Больше про конец не помню. Решённым она, думаю, назвала бы как раз это: лист ожидания, пуш и без SMS.

Вопрос: Итог по памяти (пункты по темам, 4 пункта «Уточнить у участников»); варианты: Записать / Поправить
Аналитик: Записать

## Итог по памяти

### Лист ожидания и пуш
- решение: лист ожидания на групповые занятия, когда мест нет, клиент встаёт в очередь — принял Морозова Анна (предложил Лебедев Игорь)
- решение: при освобождении места первому в очереди приходит пуш, на подтверждение 30 минут, иначе место уходит следующему — принял Морозова Анна
- решение: SMS не делаем, только пуш — принял Морозова Анна

### Лимит листа
- решение: лимит размера листа ожидания будет, число не помню — принял не помню

### Платные занятия
- открытый вопрос: нужен ли лист ожидания на платных занятиях — ждёт: финансовый директор
- поручение: Морозова Анна — уточнить у финансового директора, нужен ли лист ожидания на платных — не помню

### Оценка пушей
- поручение (не уверен): Ткач Денис — оценить доработку пушей — к пятнице

### Отмены записи
- сведение (не уверен): сейчас запись отменяют примерно на 15% занятий — со слов Морозовой Анны

## Уточнить у участников
- число лимита размера листа ожидания — у кого: не знаю
- срок, к которому Анна уточнит у финансового директора про платные занятия — у кого: Морозова Анна
- закрыть лист за 2 часа до старта: решили ли это и кто говорил — у кого: не знаю
- кто начал встречу и что показывали на экране — у кого: не знаю
`,
  CHG: `# Встреча по памяти: MED-77 — отмена записи: правки по итогам пилота

> Источник: память аналитика, расшифровки нет
> Задача: MED-77 · документ: docs/MED-77/business_requirements.md
> Встреча: 2026-10-14 15:00–15:45 · онлайн, Teams · участники: главный врач (заказчик) — Зайцева Ольга; страховой отдел — Ким Сергей; разработчик — Гусев Павел; аналитик — автор заметок
> Тема из приглашения: Правки требований к отмене записи

## Заметки аналитика
отмена — 12 ч (было 24), Зайцева ок
лимит отмен — меняем
SMS + пуш?
ДМС — Ким
колл-центр не трогаем
Гусев — счётчик отмен

## Ответы

Вопрос: Вспомните встречу: где вы были, кто начал, что показывали на экране. Теперь расскажите всё, что помните, в любом порядке — даже мелочи и то, в чём не уверены. Можно несколькими сообщениями. Закончите — напишите «всё».
Аналитик: Встреча была онлайн в Teams, а кто начал и что показывали на экране, не помню. Помню, что обсуждали правки к отмене записи после пилота. Главное — срок отмены сократили: было за 24 часа, стало за 12, и Ольга Зайцева это утвердила. Лимит отмен в месяц тоже поменяли, а на сколько, не помню. Колл-центр не трогаем, там всё как было.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё ДМС обсуждали: можно ли отменять запись по ДМС так же, пока не решили, Сергей Ким должен уточнить у себя в страховом отделе. Павел Гусев посмотрит, где у нас хранится счётчик отмен. Кажется, ещё к SMS добавили пуш. И стоило бы предупреждать пациента, что у него осталась одна отмена.

Вопрос: Понял так: обсуждали — срок отмены; лимит отмен в месяц; отмена по ДМС; счётчик отмен; уведомления об отмене (SMS и пуш); предупреждение пациенту об оставшейся отмене; колл-центр. Так?; варианты: Все темы на месте / Была ещё тема — напишу / Разделил не так — поправлю
Аналитик: Все темы на месте.

Вопрос: Лимит отмен в месяц: кто это принял?; варианты: Зайцева Ольга / Ким Сергей / Гусев Павел / Не помню
Аналитик: Не помню.

Вопрос: Счётчик отмен: Павел Гусев посмотрит, где он хранится. К какому сроку?; варианты: Назвали срок — напишу какой / Не называли / Не помню
Аналитик: Не помню.

Вопрос: Предупреждение пациенту об оставшейся отмене: это звучало на встрече или ваша мысль сейчас?; варианты: Звучало на встрече / Моя мысль / Не помню
Аналитик: Моя мысль. На встрече этого не звучало, это я сейчас подумал.

Вопрос: Вспомните конец встречи: чем закончили, что проговорили напоследок, кто что взял на себя? И если бы Зайцева Ольга пересказывала встречу своим, что она назвала бы решённым?
Аналитик: Конец помню только одно: Ольга сказала «12 часов и новый лимит — согласовано, остальное после Кима». Больше про конец не помню.

Вопрос: Итог (пункты по темам, 3 пункта «Уточнить у участников»); варианты: Записать / Поправить
Аналитик: Записать

## Итог по памяти

### Срок отмены
- решение: отмена за 12 часов вместо 24 — принял Зайцева Ольга

### Лимит отмен в месяц
- решение: лимит поменяли, новое значение не помню — принял Зайцева Ольга

### Отмена по ДМС
- открытый вопрос: можно ли отменять запись по ДМС так же — ждёт: Ким Сергей

### Счётчик отмен
- поручение: Гусев Павел — посмотреть, где хранится счётчик отмен — не помню

### Уведомления об отмене
- решение (не уверен): к SMS добавили пуш — принял не помню

### Колл-центр
- вне рамок: колл-центр не трогаем, всё как было

## Уточнить у участников
- новое значение лимита отмен в месяц — у кого: Зайцева Ольга
- срок, к которому Гусев посмотрит, где хранится счётчик отмен — у кого: Гусев Павел
- добавили ли пуш к SMS и кто это принял — у кого: не знаю
`,
  INLINE: `# Встреча по памяти: Согласие на рассылку — вопросы к юристам

> Источник: память аналитика, расшифровки нет
> Задача: ключа нет · документ: нет
> Встреча: 2026-10-14 16:00–16:30 · переговорка «Тайга» · участники: юрист — Белова Ирина; маркетинг — Осипов Глеб; аналитик — автор файла
> Тема из приглашения: Согласие на рассылку при регистрации

## Ответы
Вопрос: пересказ в строке вызова /meeting-recall (первый ответ Шага 1)
Аналитик: Только что была встреча с юристами про согласие на рассылку, расшифровки нет. Что помню: решили, что галочку согласия на рассылку при регистрации по умолчанию не ставим — это сказала юрист Белова. Текст согласия пришлёт Белова. Ещё обсуждали, сколько хранить согласия, но до чего договорились — не помню.

Вопрос: Записал. Что ещё? (продолжение свободного пересказа)
Аналитик: Ещё Глеб хотел рассылку раз в неделю, но Ирина сказала, что частоту решает маркетинг сам, это не вопрос юристов.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: всё

Вопрос: Понял так: обсуждали — галочка согласия при регистрации (по умолчанию не ставим); текст согласия; срок хранения согласий; частота рассылки. Так?; варианты: Все темы на месте / Была ещё тема — напишу / Разделил не так — поправлю
Аналитик: Все темы на месте

Вопрос: Галочка согласия при регистрации: кто это принял?; варианты: Белова Ирина / Осипов Глеб / Аналитик / Не помню
Аналитик: Белова Ирина

Вопрос: Текст согласия: какой срок назвали, к какому числу Белова пришлёт текст?; варианты: Не называли / Не помню
Аналитик: Не помню

Вопрос: Частота рассылки: чем закончили?; варианты: Решили — напишу что / Обсуждали, не решили / Вынесли за рамки / Не помню
Аналитик: Не помню

Вопрос: Вспомните конец встречи: чем закончили, что проговорили напоследок, кто что взял на себя? И если бы Белова Ирина пересказывала встречу своим, что она назвала бы решённым?
Аналитик: Не помню. Давай на этом закончим, мне пора бежать.

Вопрос: Итог по памяти: 4 пункта (1 решение, 1 поручение, 2 сведения), 4 пункта «Уточнить у участников»; варианты: Записать / Поправить
Аналитик: Записать

## Итог по памяти

### Галочка согласия при регистрации
- решение: по умолчанию галочку согласия на рассылку не ставим — принял Белова Ирина

### Текст согласия
- поручение: Белова Ирина — прислать текст согласия — срок: не помню

### Частота рассылки
- сведение: Осипов Глеб хотел рассылку раз в неделю — со слов аналитика
- сведение: Белова Ирина сказала, что частоту решает маркетинг сам, это не вопрос юристов — со слов аналитика

## Уточнить у участников
- срок, к которому Белова пришлёт текст согласия — у кого: не знаю
- до чего договорились про срок хранения согласий — у кого: не знаю
- чем закончили по частоте рассылки — у кого: не знаю
- что проговорили в конце встречи, кто что взял на себя, что Белова назвала бы решённым — у кого: не знаю
`,
}

// Пилот meeting-recall 1.1.0 (runs/2026-10-15-loop-pilot-rec-inline/rec-inline/run-1): «Уточнить» о сроке хранения
// учтена пунктом открытого вопроса итога («хранения» — «хранить»), отдельного пункта нет — это верно по Шагу 5.
const PILOT_INLINE = `# Встреча по памяти: Согласие на рассылку — вопросы к юристам

> Источник: память аналитика, расшифровки нет
> Задача: ключа нет · документ: нет
> Встреча: 2026-10-14 16:00–16:30 · переговорка «Тайга» · участники: юрист — Белова Ирина; маркетинг — Осипов Глеб; аналитик — автор протокола
> Тема из приглашения: Согласие на рассылку при регистрации

## Ответы
Вопрос: пересказ встречи в строке вызова (свободный пересказ, Шаг 1)
Аналитик: Только что была встреча с юристами про согласие на рассылку, расшифровки нет. Что помню: решили, что галочку согласия на рассылку при регистрации по умолчанию не ставим — это сказала юрист Белова. Текст согласия пришлёт Белова. Ещё обсуждали, сколько хранить согласия, но до чего договорились — не помню.

Вопрос: Что ещё? Закончите — напишите «всё».
Аналитик: Ещё Глеб хотел рассылку раз в неделю, но Ирина сказала, что частоту решает маркетинг сам, это не вопрос юристов.

Вопрос: Понял так: обсуждали — галочку согласия при регистрации; текст согласия; срок хранения согласий; частоту рассылки. Так?; варианты: Все темы на месте / Была ещё тема — напишу / Разделил не так — поправлю
Аналитик: Не хватает пункта про срок хранения: я не помню, до чего договорились. Давай на этом закончим, мне пора бежать. Все темы на месте.

## Итог по памяти

### Галочка согласия
- решение: галочку согласия на рассылку при регистрации по умолчанию не ставим — принял Белова

### Текст согласия
- поручение: Белова — прислать текст согласия — срок не помню

### Срок хранения согласий
- открытый вопрос: сколько хранить согласия — ждёт: не помню

### Частота рассылки
- сведение: Глеб хотел рассылку раз в неделю; Ирина сказала, что частоту решает маркетинг, это не вопрос юристов — со слов аналитика

## Уточнить у участников
- до чего договорились про срок хранения согласий — у кого: Белова
- к какому сроку Белова пришлёт текст согласия — у кого: Белова
`
const PILOT_INLINE_LIST = `# Пункты: Согласие на рассылку — вопросы к юристам
> Источник: docs/_inbox/meeting-2026-10-14.recall.md
> Задача: —
> Встреча: 2026-10-14 16:00–16:30 · участники: юрист — Белова Ирина; маркетинг — Осипов Глеб; аналитик — автор протокола · по памяти аналитика

- [решено] галочку согласия на рассылку при регистрации по умолчанию не ставим — решил: Белова · L21
- [открыто] сколько хранить согласия — ждёт: — · L27
- [сведение] Глеб хотел рассылку раз в неделю; Ирина сказала, что частоту решает маркетинг, это не вопрос юристов — со слов аналитика · L30
- [открыто] к какому сроку Белова пришлёт текст согласия (по памяти: не помню) — ждёт: Белова · L34
`

// Пул r1 (runs/2026-10-15-loop-r1-rec-new/rec-new/run-2): на «звучало или ваша мысль» — «Не помню… скорее моя мысль
// сейчас» (L43); «Уточнить» «звучало ли на встрече показать клиенту его место в очереди» (L77) учтена пунктом [мысль].
const R1_NEW = `# Встреча по памяти: Лист ожидания на групповые занятия — требования

> Источник: память аналитика, расшифровки нет
> Задача: FIT-412 · документ: нет
> Встреча: 2026-10-14 11:00–12:00 · переговорка «Байкал», часть людей в Zoom · участники: руководитель клиентского сервиса (заказчик) — Морозова Анна; продакт — Лебедев Игорь; разработчик мобильного приложения — Ткач Денис; аналитик — автор
> Тема из приглашения: Лист ожидания для групповых занятий

## Заметки аналитика
ЛО на групповые — да (Морозова ок)
пуш первому, 30 мин на подтв.
лимит ЛО — ?
SMS — нет
платные — уточнит у фин. дира
ЛО закрыть за 2 ч до старта??
Денис — оценка пушей

## Ответы

Вопрос: Вспомните встречу: где вы были, кто начал, что показывали на экране. Теперь расскажите всё, что помните…
Аналитик: Встреча была в переговорке «Байкал», часть людей сидела в Zoom. Обсуждали лист ожидания на групповые занятия: когда мест нет, клиент встаёт в очередь. Игорь предложил, Анна согласилась. Когда место освобождается, первому в очереди приходит пуш, и у него 30 минут, чтобы подтвердить. Если не успеет, место уходит следующему. SMS не делаем, только пуш, Анна сказала это прямо. Кто начал и что показывали на экране, не помню.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё был лимит на размер листа ожидания. Договорились, что он будет, но какое число, не помню. Про платные занятия Анна сказала, что уточнит у финансового директора, нужен ли там лист ожидания. Денис взял оценку доработки пушей. И ещё хорошо бы показывать клиенту его место в очереди.

Вопрос: Записал. Что ещё? Закончите — напишите «всё».
Аналитик: Ещё Анна говорила, что сейчас запись отменяют примерно на 15% занятий, но это смутно. И в конце она подвела итог: лист ожидания делаем, пуш с 30 минутами, SMS нет. Больше про конец не помню.

Вопрос: Понял так: обсуждали — лист ожидания на групповые занятия (очередь, пуш с 30 минутами на подтверждение, SMS нет); лимит размера листа ожидания; платные занятия; оценка доработки пушей; показ клиенту места в очереди; доля отмен записи. Так?; варианты: Все темы на месте / Была ещё тема — напишу / Разделил не так — поправлю
Аналитик: Да, все темы на месте.
Вопрос: В заметках есть «ЛО закрыть за 2 ч до старта??» — об этом говорили?; варианты: Говорили — расскажу / Не дошли / Не помню
Аналитик: Не помню.

Вопрос: Лимит размера листа ожидания: кто это принял?; варианты: Морозова Анна / Лебедев Игорь / Ткач Денис / Не помню
Аналитик: Не помню.

Вопрос: Платные занятия: кто сделает и к какому сроку?; варианты: Назвали срок — напишу какой / Не называли / Не помню
Аналитик: Не помню.

Вопрос: Оценка доработки пушей: кто сделает и к какому сроку?; варианты: Назвали срок — напишу какой / Не называли / Не помню
Аналитик: Не помню.

Вопрос: Показ клиенту места в очереди: это звучало на встрече или ваша мысль сейчас?; варианты: Звучало на встрече / Моя мысль / Не помню
Аналитик: Не помню. В заметках у меня этого нет, а на встрече, кажется, не звучало. Это скорее моя мысль сейчас.

Вопрос: Вспомните конец встречи: чем закончили, что проговорили напоследок, кто что взял на себя? И если бы Морозова Анна пересказывала встречу своим — что она назвала бы решённым?
Аналитик: Конец помню только в общих чертах: Анна подвела итог — лист ожидания делаем, пуш с 30 минутами, SMS нет. Кто что взял на себя в конце, не помню. Решённым она назвала бы именно это: лист ожидания, пуш с 30 минутами, без SMS.

Вопрос: Записать или поправить?
Аналитик: Поправлю: про «закрыть за 2 часа» в итоге ничего нет, и это нормально. Остальное совпадает с тем, что я помню. Записать.

## Итог по памяти

### Лист ожидания на групповые занятия
- решение: делаем лист ожидания; освободилось место — первому в очереди приходит пуш, 30 минут на подтверждение, не успел — место следующему — принял Морозова Анна
- решение: SMS не делаем, только пуш — принял Морозова Анна

### Лимит размера листа ожидания
- решение: лимит будет — принял не помню

### Платные занятия
- открытый вопрос: нужен ли лист ожидания для платных — ждёт: Морозова Анна (уточнит у финансового директора)
- поручение: Морозова Анна — уточнить у финансового директора, нужен ли лист ожидания — срок не помню

### Оценка доработки пушей
- поручение: Ткач Денис — оценка доработки пушей — срок не помню

### Отмены записи
- сведение (не уверен): запись отменяют примерно на 15% занятий — со слов Морозова Анна

## Уточнить у участников
- число лимита листа ожидания — у кого: не знаю
- кто принял решение о лимите — у кого: не знаю
- срок, к которому Морозова Анна ответит по платным занятиям — у кого: не знаю
- срок оценки доработки пушей у Ткач Денис — у кого: не знаю
- говорили ли «ЛО закрыть за 2 ч до старта» — у кого: не знаю
- кто что взял на себя в конце встречи — у кого: не знаю
- звучало ли на встрече показать клиенту его место в очереди — у кого: не знаю
`
const R1_NEW_LIST = `# Пункты: Лист ожидания на групповые занятия — требования
> Источник: docs/FIT-412/meeting-2026-10-14.recall.md
> Задача: FIT-412
> Встреча: 2026-10-14 11:00–12:00 · участники: руководитель клиентского сервиса (заказчик) — Морозова Анна; продакт — Лебедев Игорь; разработчик мобильного приложения — Ткач Денис; аналитик — автор · по памяти аналитика

- [решено] делаем лист ожидания; освободилось место — первому в очереди приходит пуш, 30 минут на подтверждение, не успел — место следующему — решил: Морозова Анна · L54
- [решено] SMS не делаем, только пуш — решил: Морозова Анна · L55
- [открыто] лимит размера листа ожидания будет? (по памяти: кто принял — не помню) — ждёт: — · L58
- [открыто] нужен ли лист ожидания для платных — ждёт: Морозова Анна · L61
- [сведение] запись отменяют примерно на 15% занятий (по памяти, не уверен) — со слов Морозова Анна · L68
- [открыто] число лимита листа ожидания (по памяти: не помню) — ждёт: — · L71
- [открыто] срок, к которому Морозова Анна ответит по платным занятиям (по памяти: не помню) — ждёт: — · L73
- [открыто] срок оценки доработки пушей у Ткач Денис (по памяти: не помню) — ждёт: — · L74
- [открыто] говорили ли «ЛО закрыть за 2 ч до старта» (по памяти: не помню) — ждёт: — · L75
- [мысль] хорошо бы показывать клиенту его место в очереди · L43
`

// Эталонные списки — по таблице Шага 5 из протоколов выше; ожидания — по карточкам двойника.
const REF_LIST = {
  NEW: `# Пункты: Лист ожидания на групповые занятия — требования
> Источник: docs/FIT-412/meeting-2026-10-14.recall.md
> Задача: FIT-412
> Встреча: 2026-10-14 11:00–12:00 · участники: руководитель клиентского сервиса (заказчик) — Морозова Анна; продакт — Лебедев Игорь; разработчик мобильного приложения — Ткач Денис · по памяти аналитика

- [решено] Лист ожидания на групповые занятия: когда мест нет, клиент встаёт в очередь — решил: Морозова Анна · L48
- [решено] При освобождении места первому в очереди приходит пуш, на подтверждение 30 минут, иначе место уходит следующему — решил: Морозова Анна · L49
- [решено] SMS не делаем, только пуш — решил: Морозова Анна · L50
- [открыто] Лимит размера листа ожидания будет? (по памяти: кто принял — не помню) — ждёт: — · L53
- [открыто] Нужен ли лист ожидания на платных занятиях — ждёт: финансовый директор · L56
- [сведение] Сейчас запись отменяют примерно на 15% занятий — со слов Морозовой Анны (по памяти, не уверен) · L63
- [открыто] Число лимита размера листа ожидания (по памяти: не помню) — ждёт: — · L66
- [открыто] Срок, к которому Анна уточнит у финансового директора про платные занятия (по памяти: не помню) — ждёт: Морозова Анна · L67
- [открыто] Закрыть лист за 2 часа до старта: решили ли это и кто говорил (по памяти: не помню) — ждёт: — · L68
- [мысль] Показ клиенту места в очереди · L34
`,
  CHG: `# Пункты: MED-77 — отмена записи: правки по итогам пилота
> Источник: docs/MED-77/meeting-2026-10-14.recall.md
> Задача: MED-77
> Встреча: 2026-10-14 15:00–15:45 · участники: главный врач (заказчик) — Зайцева Ольга; страховой отдел — Ким Сергей; разработчик — Гусев Павел · по памяти аналитика

- [решено] Отмена за 12 часов вместо 24 — решил: Зайцева Ольга · L45
- [решено] Лимит отмен в месяц поменяли, новое значение не помню — решил: Зайцева Ольга · L48
- [открыто] Можно ли отменять запись по ДМС так же — ждёт: Ким Сергей · L51
- [открыто] К SMS добавили пуш? (по памяти, не уверен) — ждёт: — · L57
- [открыто] Не входит ли колл-центр: не трогаем, всё как было — ждёт: — · L60
- [открыто] Новое значение лимита отмен в месяц (по памяти: не помню) — ждёт: Зайцева Ольга · L63
- [открыто] Срок, к которому Гусев посмотрит, где хранится счётчик отмен (по памяти: не помню) — ждёт: Гусев Павел · L64
- [мысль] Предупреждение пациенту об оставшейся отмене · L34
`,
  INLINE: `# Пункты: Согласие на рассылку — вопросы к юристам
> Источник: docs/_inbox/meeting-2026-10-14.recall.md
> Задача: —
> Встреча: 2026-10-14 16:00–16:30 · участники: юрист — Белова Ирина; маркетинг — Осипов Глеб · по памяти аналитика

- [решено] По умолчанию галочку согласия на рассылку не ставим — решил: Белова Ирина · L39
- [сведение] Осипов Глеб хотел рассылку раз в неделю — со слов аналитика · L45
- [сведение] Белова Ирина сказала, что частоту решает маркетинг сам, это не вопрос юристов — со слов аналитика · L46
- [открыто] Срок, к которому Белова пришлёт текст согласия (по памяти: не помню) — ждёт: — · L49
- [открыто] До чего договорились про срок хранения согласий (по памяти: не помню) — ждёт: — · L50
- [открыто] Чем закончили по частоте рассылки (по памяти: не помню) — ждёт: — · L51
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

  // ---- список пунктов: зелёное — зелёное, красное — красное И по своей причине ----
  const LG = (fx, list, proto = REF[fx]) => gradePoints(list, proto, 'meeting-2026-10-14.recall.md', FX[fx])
  const green = (fx, name, list, proto) => {
    const r = LG(fx, list, proto)
    ck(name + ' — зелёный', r.pass, true)
    if (!r.pass) for (const f of r.fails) console.log(`         ${f.id}: ${f.msg}`)
  }
  const red = (fx, name, list, id, proto) => {
    const r = LG(fx, list, proto)
    const ok = !r.pass && r.fails.some((f) => f.id === id)
    ck(`${name} — красный [${id}]`, ok, true)
    if (!ok) console.log(`         причины: ${r.fails.map((f) => f.id + ': ' + f.msg).join(' | ') || 'нет'}`)
  }
  const sub = (t, from, to) => { if (!t.includes(from)) throw new Error('самопроверка: нет строки для замены: ' + from); return t.replace(from, to) }
  const drop = (t, from) => sub(t, from + '\n', '')
  const put = (t, line) => t.trimEnd() + '\n' + line + '\n'

  console.log('СПИСОК: эталонные протоколы — зелёные по протоколу')
  for (const k of ['NEW', 'CHG', 'INLINE']) ck(`${k}: протокол`, gradeProtocol(REF[k], FX[k]).pass, true)

  console.log('«Уточнить» не о предмете встречи — узкий признак')
  const offs = (proto) => parseProtocol(proto).entries.filter((e) => e.offTopic).map((e) => e.line).join(',') || '—'
  ck('NEW: не о предмете — только L69 «кто начал… на экране»', offs(REF.NEW), '69')
  ck('CHG: не о предмете — нет', offs(REF.CHG), '—')
  ck('INLINE: не о предмете — только L52 «что проговорили в конце…, что Белова назвала бы решённым»', offs(REF.INLINE), '52')
  const subjEnd = REF.NEW.replace('- кто начал встречу и что показывали на экране — у кого: не знаю', '- кто что взял на себя по лимиту в конце встречи — у кого: не знаю')
  ck('«кто что взял на себя по лимиту в конце встречи» — о предмете', offs(subjEnd), '—')
  ck('«что ещё проговорили в конце встречи» / «кто был на встрече» — не о предмете', offs(REF.NEW.replace('- кто начал встречу и что показывали на экране — у кого: не знаю', '- что ещё проговорили в конце встречи — у кого: не знаю\n- кто был на встрече — у кого: не знаю')), '69,70')

  console.log('СПИСОК NEW')
  const ln = REF_LIST.NEW
  green('NEW', 'эталон', ln)
  const offIt = put(ln, '- [открыто] Кто начал встречу и что показывали на экране (по памяти: не помню) — ждёт: — · L69')
  green('NEW', '«Уточнить» не о предмете пунктом [открыто]', offIt)
  ck('  …и предупреждение о нём', LG('NEW', offIt).warns.some((w) => /не о предмете/.test(w)), true)
  red('NEW', '«Уточнить» о предмете (взял на себя по лимиту) потеряно', ln, 'ask', subjEnd)
  green('NEW', 'L<n> сдвинут на строку у пуша (L50 вместо L49)', sub(ln, 'следующему — решил: Морозова Анна · L49', 'следующему — решил: Морозова Анна · L50'))
  green('NEW', '«Уточнить» о числе лимита учтено пунктом о лимите', drop(ln, '- [открыто] Число лимита размера листа ожидания (по памяти: не помню) — ждёт: — · L66'))
  green('NEW', '«решил: Морозова А.»', sub(ln, 'SMS не делаем, только пуш — решил: Морозова Анна', 'SMS не делаем, только пуш — решил: Морозова А.'))
  green('NEW', '«решил: Анна Морозова»', sub(ln, 'SMS не делаем, только пуш — решил: Морозова Анна', 'SMS не делаем, только пуш — решил: Анна Морозова'))
  green('NEW', '«Источник» с полным путём', sub(ln, '> Источник: docs/FIT-412/meeting-2026-10-14.recall.md', '> Источник: протокол по памяти C:/work/docs/FIT-412/meeting-2026-10-14.recall.md'))
  green('NEW', 'пуш пересказан коротко и L<n> на соседнее решение', sub(ln, '- [решено] При освобождении места первому в очереди приходит пуш, на подтверждение 30 минут, иначе место уходит следующему — решил: Морозова Анна · L49', '- [решено] Пуш первому, 30 минут на подтверждение — решил: Морозова Анна · L48'))
  green('NEW', 'лист ожидания пересказан («Делаем лист ожидания…»)', sub(ln, '- [решено] Лист ожидания на групповые занятия: когда мест нет, клиент встаёт в очередь', '- [решено] Делаем лист ожидания на групповые занятия'))
  red('NEW', 'поручение Ткача [решено]', put(ln, '- [решено] Ткач Денис оценит доработку пушей к пятнице — решил: Морозова Анна · L60'), 'errand')
  red('NEW', 'поручение Ткача [сведение] со ссылкой на ответ', put(ln, '- [сведение] Денис взял оценку доработки пушей — со слов аналитика · L25'), 'errand')
  red('NEW', 'поручение Ткача [открыто] со ссылкой на поручение', put(ln, '- [открыто] Ткач Денис оценит доработку пушей — ждёт: Ткач Денис · L60'), 'errand')
  red('NEW', '[решено] без решившего', sub(ln, 'SMS не делаем, только пуш — решил: Морозова Анна · L50', 'SMS не делаем, только пуш · L50'), 'decider')
  red('NEW', '[решено] «решил: —»', sub(ln, 'SMS не делаем, только пуш — решил: Морозова Анна · L50', 'SMS не делаем, только пуш — решил: — · L50'), 'decider')
  red('NEW', '[решено] решил не тот, кто принял (Лебедев предлагал)', sub(ln, 'SMS не делаем, только пуш — решил: Морозова Анна', 'SMS не делаем, только пуш — решил: Лебедев Игорь'), 'decider')
  red('NEW', '«принял не помню» как решение', sub(ln, '- [открыто] Лимит размера листа ожидания будет? (по памяти: кто принял — не помню) — ждёт: — · L53', '- [решено] Лимит размера листа ожидания будет — решил: Морозова Анна · L53'), 'undecided')
  red('NEW', '«не уверен» у сведения потерян', sub(ln, ' — со слов Морозовой Анны (по памяти, не уверен) · L63', ' — со слов Морозовой Анны · L63'), 'unsure')
  red('NEW', 'мысль потеряна', drop(ln, '- [мысль] Показ клиенту места в очереди · L34'), 'thought')
  red('NEW', 'лишняя мысль', put(ln, '- [мысль] SMS не делаем · L20'), 'thought')
  red('NEW', 'мысль пунктом [открыто]', sub(ln, '- [мысль] Показ клиенту места в очереди · L34', '- [открыто] Показывать ли клиенту его место в очереди — ждёт: — · L34'), 'thoughtAsFact')
  red('NEW', 'мысль [мысль] без предмета («Лист ожидания»)', sub(ln, '- [мысль] Показ клиенту места в очереди · L34', '- [мысль] Лист ожидания · L34'), 'thought')
  red('NEW', 'строка «Уточнить» потеряна', drop(ln, '- [открыто] Закрыть лист за 2 часа до старта: решили ли это и кто говорил (по памяти: не помню) — ждёт: — · L68'), 'ask')
  red('NEW', 'решение с принявшим потеряно', drop(ln, '- [решено] SMS не делаем, только пуш — решил: Морозова Анна · L50'), 'lost')
  red('NEW', 'открытый вопрос решением', sub(ln, '- [открыто] Нужен ли лист ожидания на платных занятиях — ждёт: финансовый директор · L56', '- [решено] Лист ожидания на платных занятиях не нужен — решил: Морозова Анна · L56'), 'decided')
  red('NEW', '«закрывать за 2 часа» решением', sub(ln, '- [открыто] Закрыть лист за 2 часа до старта: решили ли это и кто говорил (по памяти: не помню) — ждёт: — · L68', '- [решено] Лист закрывается за 2 часа до старта — решил: Морозова Анна · L68'), 'hint')
  red('NEW', 'число лимита из подсказки', put(ln, '- [открыто] Лимит листа ожидания — 10 человек? (по памяти: не помню) — ждёт: — · L66'), 'hint')
  red('NEW', 'имя не из протокола', sub(ln, '— ждёт: финансовый директор · L56', '— ждёт: Петров · L56'), 'grounding')
  red('NEW', 'срок не из протокола', sub(ln, 'про платные занятия (по памяти: не помню)', 'про платные занятия до понедельника (по памяти: не помню)'), 'grounding')
  red('NEW', 'число только из вопроса агента («4 пункта»)', sub(ln, 'Нужен ли лист ожидания на платных занятиях', 'Нужен ли лист ожидания на 4 платных занятиях'), 'grounding')
  red('NEW', 'число только из даты встречи («10» из 2026-10-14)', sub(ln, 'про платные занятия (по памяти: не помню)', 'про 10 платных занятий (по памяти: не помню)'), 'grounding')
  green('NEW', 'число из ответа аналитика («15%») и из заметок («2 часа»)', ln)
  red('NEW', 'L<n> за концом протокола', sub(ln, '· L34', '· L340'), 'L')
  red('NEW', 'пункт без L<n>', sub(ln, 'иначе место уходит следующему — решил: Морозова Анна · L49', 'иначе место уходит следующему — решил: Морозова Анна'), 'L')
  red('NEW', 'вид не из четырёх', put(ln, '- [поручение] Ткач Денис — оценить доработку пушей · L60'), 'kind')
  red('NEW', 'шапка без «по памяти аналитика»', sub(ln, ' · по памяти аналитика', ''), 'form')
  red('NEW', '«Источник» не на протокол', sub(ln, '> Источник: docs/FIT-412/meeting-2026-10-14.recall.md', '> Источник: память аналитика'), 'form')
  red('NEW', '«Задача» без ключа', sub(ln, '> Задача: FIT-412', '> Задача: —'), 'form')
  red('NEW', 'нет «# Пункты:»', sub(ln, '# Пункты: Лист ожидания', '# Список: Лист ожидания'), 'form')

  console.log('СПИСОК NEW по короткому протоколу (вне рамок, ответа «моя мысль» нет)')
  const gn = `# Пункты: Лист ожидания
> Источник: docs/FIT-412/meeting-2026-10-14.recall.md
> Задача: FIT-412
> Встреча: 14 октября 2026 · участники: заказчик — Морозова Анна · по памяти аналитика

- [решено] Лист ожидания на групповые занятия, когда мест нет — решил: Морозова Анна · L18
- [решено] Первому в очереди пуш, 30 минут на подтверждение, потом место следующему — решил: Морозова Анна · L19
- [открыто] У листа ожидания будет лимит размера? (по памяти: кто принял — не помню) — ждёт: Морозова Анна · L20
- [открыто] Не входит ли SMS — ждёт: — · L21
- [открыто] Нужен ли лист ожидания на платных занятиях — ждёт: Морозова · L22
- [открыто] Какой лимит размера листа ожидания (по памяти: не помню) — ждёт: Морозова Анна · L26
- [открыто] Решили ли закрывать лист за 2 часа до начала (по памяти: не помню) — ждёт: — · L27
`
  green('NEW', 'эталон по короткому протоколу', gn, GOOD.NEW)
  green('NEW', '«не входит ли SMS» с L<n> на соседнюю строку', sub(gn, 'Не входит ли SMS — ждёт: — · L21', 'Не входит ли SMS — ждёт: — · L22'), GOOD.NEW)
  red('NEW', 'вне рамок SMS решением', sub(gn, '- [открыто] Не входит ли SMS — ждёт: — · L21', '- [решено] не входит: SMS — решил: Морозова Анна · L21'), 'outscope', GOOD.NEW)
  red('NEW', 'мысль без ответа «моя мысль»', put(gn, '- [мысль] Место клиента в очереди · L13'), 'thought', GOOD.NEW)

  console.log('СПИСОК CHG')
  const lc = REF_LIST.CHG
  green('CHG', 'эталон', lc)
  green('CHG', 'мысль с L на вопрос, а не на ответ (предупреждение)', sub(lc, '· L34', '· L33'))
  red('CHG', '«не уверен» (пуш к SMS) как решение', sub(lc, '- [открыто] К SMS добавили пуш? (по памяти, не уверен) — ждёт: — · L57', '- [решено] К SMS добавили пуш — решил: Зайцева Ольга · L57'), 'unsure')
  red('CHG', 'вне рамок решением', sub(lc, '- [открыто] Не входит ли колл-центр: не трогаем, всё как было — ждёт: — · L60', '- [решено] не входит: колл-центр не трогаем — решил: Зайцева Ольга · L60'), 'outscope')
  red('CHG', 'поручение Гусева [открыто] со ссылкой на поручение', put(lc, '- [открыто] Гусев посмотрит, где хранится счётчик отмен — ждёт: Гусев Павел · L54'), 'errand')
  red('CHG', 'поручение Гусева [решено]', put(lc, '- [решено] Гусев Павел проверит счётчик отмен — решил: Зайцева Ольга · L48'), 'errand')
  red('CHG', 'мысль потеряна', drop(lc, '- [мысль] Предупреждение пациенту об оставшейся отмене · L34'), 'thought')
  red('CHG', 'мысль пунктом [решено]', put(lc, '- [решено] Предупреждать пациента, что осталась одна отмена — решил: Зайцева Ольга · L34'), 'thoughtAsFact')
  red('CHG', 'лимит «на 3» из подсказки', sub(lc, 'Лимит отмен в месяц поменяли, новое значение не помню', 'Лимит отмен в месяц поменяли на 3'), 'hint')
  red('CHG', 'ДМС решением', sub(lc, '- [открыто] Можно ли отменять запись по ДМС так же — ждёт: Ким Сергей · L51', '- [решено] По ДМС отменять так же — решил: Ким Сергей · L51'), 'notDecided')
  red('CHG', 'срок Гусева из подсказки', sub(lc, 'счётчик отмен (по памяти: не помню)', 'счётчик отмен — до 20 октября'), 'hint')

  console.log('СПИСОК INLINE')
  const li = REF_LIST.INLINE
  green('INLINE', 'эталон', li)
  green('INLINE', '«Уточнить» о конце встречи пунктом [открыто]', put(li, '- [открыто] Что проговорили в конце встречи, кто что взял на себя, что Белова назвала бы решённым (по памяти: не помню) — ждёт: — · L52'))
  red('INLINE', 'лишняя мысль (ответов «моя мысль» нет)', put(li, '- [мысль] Частота рассылки · L13'), 'thought')
  red('INLINE', 'срок хранения решением', put(li, '- [решено] Согласия храним 3 года — решил: Белова Ирина · L50'), 'hint')
  red('INLINE', 'поручение Беловой [решено]', put(li, '- [решено] Белова пришлёт текст согласия — решил: Белова Ирина · L42'), 'errand')
  red('INLINE', '«Задача» с ключом', sub(li, '> Задача: —', '> Задача: MKT-1'), 'form')
  red('INLINE', 'срок хранения не в списке', drop(li, '- [открыто] До чего договорились про срок хранения согласий (по памяти: не помню) — ждёт: — · L50'), 'ask')
  red('INLINE', 'сведение потеряно', drop(li, '- [сведение] Осипов Глеб хотел рассылку раз в неделю — со слов аналитика · L45'), 'lost')
  console.log('СПИСОК INLINE — пилот 1.1.0: «Уточнить» учтена открытым вопросом итога')
  green('INLINE', 'пилот: «до чего договорились про срок хранения» учтено пунктом «сколько хранить согласия»', PILOT_INLINE_LIST, PILOT_INLINE)
  green('INLINE', 'пилот: тот же пункт без L<n> на открытый вопрос', sub(PILOT_INLINE_LIST, '- [открыто] сколько хранить согласия — ждёт: — · L27', '- [открыто] сколько хранить согласия — ждёт: — · L33'), PILOT_INLINE)
  {
    // Только путь «через итог»: пункт без общих с «Уточнить» слов (кроме «согласия»), опирается на L27. Проверка
    // карточки «хран — [открыто]» здесь выключена: она про другое и краснила бы пересказ без слова «хранить».
    const fxPath = { ...FX.INLINE, list: { ...FX.INLINE.list, mustOpen: [] } }
    const r = gradePoints(sub(PILOT_INLINE_LIST, '- [открыто] сколько хранить согласия — ждёт: — · L27', '- [открыто] согласия: не определено — ждёт: — · L27'), PILOT_INLINE, 'meeting-2026-10-14.recall.md', fxPath)
    ck('пилот: пункт пересказан, опирается на открытый вопрос L27 — «Уточнить» покрыта через итог', r.fails.map((f) => f.id).join(',') || 'нет провалов', 'нет провалов')
  }
  red('INLINE', 'пилот: о сроке хранения нет ни одного пункта', drop(PILOT_INLINE_LIST, '- [открыто] сколько хранить согласия — ждёт: — · L27'), 'ask', PILOT_INLINE)
  red('INLINE', 'пилот: о сроке текста Беловой нет ни одного пункта', drop(PILOT_INLINE_LIST, '- [открыто] к какому сроку Белова пришлёт текст согласия (по памяти: не помню) — ждёт: Белова · L34'), 'ask', PILOT_INLINE)

  console.log('СПИСОК NEW — пул r1: «Уточнить» «звучало ли…» учтена пунктом [мысль]')
  const thoughtLine = '- [мысль] хорошо бы показывать клиенту его место в очереди · L43'
  green('NEW', 'r1: «звучало ли … место в очереди» учтено [мысль]', R1_NEW_LIST, R1_NEW)
  {
    // [открыто] о том же тоже покрывает «звучало ли»; сам список красный по мысли (аналитик сказал «моя мысль») — верно.
    const r = LG('NEW', sub(R1_NEW_LIST, thoughtLine, '- [открыто] звучало ли на встрече показывать клиенту место в очереди (по памяти: не помню) — ждёт: — · L77'), R1_NEW)
    ck('r1: вместо [мысль] — [открыто] о том же: «Уточнить» покрыта (провал только по мысли)', r.fails.some((f) => f.id === 'ask') ? 'ask' : [...new Set(r.fails.map((f) => f.id))].join(','), 'thought,thoughtAsFact')
  }
  red('NEW', 'r1: ни [мысль], ни [открыто] о месте в очереди', drop(R1_NEW_LIST, thoughtLine), 'ask', R1_NEW)
  red('NEW', 'r1: [мысль] о другом предмете — «звучало ли» не покрыта', sub(R1_NEW_LIST, thoughtLine, '- [мысль] хорошо бы SMS-напоминание за час до занятия · L43'), 'ask', R1_NEW)
  red('NEW', 'r1: [мысль] не покрывает «говорили ли» без «звучало» (закрыть за 2 часа)', sub(R1_NEW_LIST, '- [открыто] говорили ли «ЛО закрыть за 2 ч до старта» (по памяти: не помню) — ждёт: — · L75\n', '').replace(thoughtLine, thoughtLine + '\n- [мысль] закрыть ЛО за 2 ч до старта · L43'), 'ask', R1_NEW)

  console.log('ПЕСОЧНИЦА (файлы на диске)')
  const tmp = mkdtempSync(join(tmpdir(), 'grade-recall-'))
  try {
    const mk = (name, files) => {
      const d = join(tmp, name)
      for (const [rel, txt] of Object.entries(files)) { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), txt) }
      return d
    }
    const P = 'docs/FIT-412/meeting-2026-10-14.recall.md'
    const crlf = (s) => s.replace(/\n/g, '\r\n')
    const r1 = gradeRun(mk('ok', { [P]: crlf(REF.NEW), 'docs/FIT-412/meeting-2026-10-14.points.md': crlf(REF_LIST.NEW) }), FX.NEW)
    ck('протокол и список рядом (CRLF) — зелёный', r1.pass, true)
    if (!r1.pass) console.log('         ' + JSON.stringify(r1.lg && r1.lg.fails))
    ck('список не в «лишних файлах»', r1.extra.length, 0)
    const r2 = gradeRun(mk('nolist', { [P]: REF.NEW }), FX.NEW)
    ck('списка нет — красный, протокол зелёный', `${r2.pass}/${r2.protoPass}`, 'false/true')
    const r3 = gradeRun(mk('away', { [P]: REF.NEW, 'docs/_inbox/meeting-2026-10-14.points.md': REF_LIST.NEW }), FX.NEW)
    ck('список не в папке протокола — красный', `${r3.pass}/${r3.listElsewhere.length}`, 'false/1')
    const r4 = gradeRun(mk('inbox', { 'docs/_inbox/meeting-2026-10-14.recall.md': REF.INLINE, 'docs/_inbox/meeting-2026-10-14.points.md': REF_LIST.INLINE }), FX.INLINE)
    ck('INLINE в _inbox — зелёный', r4.pass, true)
  } finally { rmSync(tmp, { recursive: true, force: true }) }

  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ---------- прогон ----------

// Запуск из командной строки; импорт (`gradePoints` при отладке) прогона не запускает.
if (basename(process.argv[1] || '') === 'grade-recall.mjs') main()

function main() {
  const arg = process.argv[2]
  if (arg === '--selftest') selftest()
  const fxName = process.argv[process.argv.indexOf('--fx') + 1]
  const fx = FX[fxName]
  if (!arg || !existsSync(arg) || !fx) { console.error('usage: node grade-recall.mjs <каталог с песочницами> --fx NEW|CHG|INLINE | --selftest'); process.exit(1) }
  const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
  console.log(`\nпроба rec-${fxName.toLowerCase()}, ${arg}`)
  let measured = 0; let green = 0; let protoGreen = 0; let listGreen = 0; let total = 0
  for (const n of runs) {
    const dir = join(arg, n)
    const ansPath = join(dir, 'answer.md')
    const ans = existsSync(ansPath) ? readFileSync(ansPath, 'utf8') : ''
    if (existsSync(join(dir, '_api-failure.txt')) || existsSync(join(dir, '_api-failure-turn.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
    measured++
    const r = gradeRun(dir, fx)
    total += r.cost
    if (r.pass) green++
    if (r.protoPass) protoGreen++
    if (r.listPass) listGreen++
    const turns = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).length || 1
    const g = r.g
    const lg = r.lg
    const notes = [
      `ходов: ${turns}, $${r.cost.toFixed(2)}`,
      `протокол ${r.protoPass ? 'зелёный' : 'КРАСНЫЙ'}, список ${r.listPass ? 'зелёный' : 'КРАСНЫЙ'}`,
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
      r.path && !r.listPath && (r.listElsewhere.length ? `СПИСОК НЕ В ПАПКЕ ПРОТОКОЛА: ${r.listElsewhere.join(', ')}` : 'СПИСКА НЕТ'),
      lg && `список: ${Object.entries(lg.counts).map(([k, v]) => `${k} ${v}`).join(', ')}; «моя мысль» в протоколе: ${lg.thoughtsInProto}${lg.thoughtSaid ? '' : ' (мысль из карточки двойник не назвал)'}`,
      lg && lg.fails.length && 'СПИСОК: ' + lg.fails.map((f) => `${f.id}: ${f.msg}`).join(' · '),
    ].filter(Boolean)
    const warns = [
      g && !g.source && 'нет строки «> Источник: память аналитика»',
      r.path && !r.path.includes(fx.fileDate) && `дата в имени не ${fx.fileDate}: ${relative(dir, r.path)}`,
      r.listPath && !basename(r.listPath).includes(fx.fileDate) && `дата в имени списка не ${fx.fileDate}: ${relative(dir, r.listPath)}`,
      r.listPath && r.listElsewhere.length && 'ещё списки: ' + r.listElsewhere.join(', '),
      r.replies && r.verbatim < r.replies && `дословно в «Ответах» ${r.verbatim}/${r.replies} реплик двойника`,
      g && fx.askWarn.filter((a) => !g.askWarn[a.id]).map((a) => 'нет: ' + a.d).join(' · '),
      r.extra.length && 'лишние файлы в docs/: ' + r.extra.join(', '),
      r.step1Asked && 'пересказ был в строке вызова, а вопрос «расскажите всё» задан',
      lg && lg.warns.length && 'список: ' + lg.warns.join(' · '),
    ].filter(Boolean)
    console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  · ${notes.join(' · ')}${warns.length ? '\n         предупреждения: ' + warns.join(' · ') : ''}`)
  }
  console.log(`\n  ${protoGreen}/${measured}\tпротокол — по форме, помнит ≥${fx.minRemembered}/${fx.remembered.length}, без подсказок и мысли аналитика, пробел в «Уточнить»`)
  console.log(`  ${listGreen}/${measured}\tсписок — рядом, по таблице Шага 5, без поручений, «не уверен» и мысль не потеряны, опора в протоколе`)
  console.log(`  ${green}/${measured}\tзелёных — протокол и список вместе  ← КРИТЕРИЙ`)
  console.log(`  стоимость плеча: $${total.toFixed(2)}\n`)
}
