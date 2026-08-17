#!/usr/bin/env node
// grade-cdoc.mjs — пробы скилла `context-doc` (импорт документа человека в `context/`).
//
//   node grade-cdoc.mjs <каталог с песочницами> --probe=xlsx|txt|txt-q|docx|fix|dup
//   node grade-cdoc.mjs --selftest
//
// ЧТО ГРЕЙДИТСЯ. Файл на диске, а не формулировка отчёта (правило репы №1: 3 прогона `ts-live`
// из 11 отчитались о спеке, которой нет). Текст `answer.md` читается только там, где артефакта
// на диске быть не должно: просьба к человеку на `xlsx` и вопрос с вариантами описания на `txt-q`.
//
// ПОЧЕМУ ОДИН ФАЙЛ НА ШЕСТЬ ПЛЕЧ. Разбор шапки, поиск созданных файлов, опознание отказа API и
// сверка тела с эталоном общие для всех проб; разъехавшись по шести файлам, они разъедутся и по
// смыслу. Разное — только анкеры, и они собраны в блоках ниже, каждый со своей пробой.
//
// ПРАВИЛА, ИЗ-ЗА КОТОРЫХ ОН НАПИСАН ИМЕННО ТАК:
//   - регулярки ЛИТЕРАЛЬНЫЕ и из строк не собираются (`\Z` в JS — литерал `Z`, стоило репе
//     раунда: 15 пунктов покраснели ложно);
//   - шапка разбирается ПОСТРОЧНО, а не одной регуляркой: петля ищет `^description:` грепом,
//     и слово `description` в теле документа шапкой не является;
//   - отказ API и подмена артефакта — «НЕ ИЗМЕРЕНО», а не «провалено»;
//   - счётчик на каждый дефект, общего процента нет.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// Истина листа CD-XLSX. Тот же модуль собирает саму фикстуру (`make-cd-xlsx.mjs`), поэтому
// эталон и `.xlsx` разъехаться не могут: правится модуль, пересобирается файл.
import { ROWS as X_ROWS } from './cd-xlsx-truth.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBES = ['xlsx', 'txt', 'txt-q', 'docx', 'fix', 'dup']

// ─── Общее ──────────────────────────────────────────────────────────────────────────────────

/** Файлы стенда: их создаёт раннер, они не результат работы скилла. */
const HARNESS = new Set(['answer.md', '_seeded.txt', '_stderr.log', '_api-failure.txt', '_escaped.txt', '_STOP'])

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

/**
 * Настоящий отказ CLI — это ВЕСЬ вывод: короткий и с маркером в начале. Слова `rate limit`
 * внутри перенесённого документа отказом не являются: на `ts-ctx` так молча выпали из
 * знаменателя 2 прогона из 10, и именно те, что перенесли больше конкретики.
 */
export function isApiFailure (text) {
  if (!text) return false
  return text.length < 600 ? RE_API_FAILURE.test(text) : RE_API_FAILURE.test(text.slice(0, 200))
}

const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').trim()

/**
 * Разбор шапки ПОСТРОЧНО. `hasFM` только если первая непустая строка — `---` и блок закрыт:
 * незакрытая шапка для грепа петли эквивалентна её отсутствию.
 */
export function splitFM (text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i += 1
  if (lines[i] !== '---') return { hasFM: false, keys: [], vals: new Map(), body: norm(text) }
  let j = i + 1
  const keys = []
  const vals = new Map()
  while (j < lines.length && lines[j].trim() !== '---') {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):[ \t]?(.*)$/.exec(lines[j])
    if (m) { keys.push(m[1]); if (!vals.has(m[1])) vals.set(m[1], m[2].trim()) }
    j += 1
  }
  if (j >= lines.length) return { hasFM: false, keys: [], vals: new Map(), body: norm(text) }
  return { hasFM: true, keys, vals, body: norm(lines.slice(j + 1).join('\n')) }
}

const isMd = (p) => /\.mdx?$/i.test(p)
const inContext = (p) => /^context\//i.test(p)

/** Снимок песочницы: только данные, никакого диска — на нём же работает самопроверка. */
export function makeSnap ({ answer = '', files = {}, seeded = [] }) {
  const map = files instanceof Map ? files : new Map(Object.entries(files))
  const seed = new Set(seeded)
  const created = [...map.keys()].filter((p) => !seed.has(p) && !HARNESS.has(p))
  return { answer, files: map, seeded: seed, created }
}

const ctxMd = (snap) => [...snap.files.keys()].filter((p) => inContext(p) && isMd(p)).sort()
const newDocs = (snap) => snap.created.filter((p) => isMd(p))

/** Шапка всех перечисленных файлов: три поля, `description` первым делом. */
function headerReport (snap, paths) {
  const rows = paths.map((p) => {
    const fm = splitFM(snap.files.get(p) ?? '')
    return {
      path: p,
      hasDesc: fm.hasFM && fm.vals.has('description') && Boolean(fm.vals.get('description')),
      hasSource: fm.vals.has('source'),
      hasUpdated: fm.vals.has('updated'),
      extra: fm.keys.filter((k) => k !== 'description' && k !== 'source' && k !== 'updated'),
      desc: fm.vals.get('description') ?? '',
      fm,
    }
  })
  return {
    rows,
    allDesc: rows.length > 0 && rows.every((r) => r.hasDesc),
    all3: rows.length > 0 && rows.every((r) => r.hasDesc && r.hasSource && r.hasUpdated),
    extra: rows.some((r) => r.extra.length > 0),
  }
}

/** Описание называет предметы, а не жанр. Счётчик грубый — строка печатается целиком. */
function descSubjects (desc, subjects) {
  return subjects.filter((re) => re.test(desc)).length
}

// ─── Общие детекторы содержания ─────────────────────────────────────────────────────────────

/** Сводка вместо переноса. Многоточие не берём: слишком шумно. */
const RE_ELISION = /и т\.[ \u00a0]?д|и т\.[ \u00a0]?п|аналогичн|остальные (?:строки|коды|записи|пункты)|прочие коды|сокращено|перечень сокращ/i
/** Свои выводы и примечания — то, чего в исходнике не было. */
const RE_EDITORIAL = /важно отметить|стоит отметить|таким образом|рекомендуетс|обратите внимание|следует учитывать|примечание автора|вывод:|как видно|по сути/i
/** Просьба поставить софт вместо действия, которое человек может выполнить сам. */
const RE_INSTALL = /pandoc|libreoffice|pip install|npm i(?:nstall)? |установите? (?:пакет|python|конвертер)/i
/** Просьба пересохранить в CSV — «точное действие» из правила отказа. */
const RE_CSV = /csv/i
const RE_RESAVE = /пересохран|сохрани|выгруз|экспорт/i
/** Прогон утверждает, что записал файл в context/. */
const RE_CLAIMS_PATH = /context\/[A-Za-z0-9_-]+\.md/

// ─── Проба xlsx: контейнер распаковывается — доехали ли ячейки без искажений ────────────────
//
// ПЕРЕПИСАНА 2026-08-17 после первого замера. Прежняя редакция считала законным исходом
// ОТСУТСТВИЕ файла: предполагалось, что ручное соединение `sheet1.xml` с `sharedStrings.xml`
// даёт правдоподобную и неверную таблицу. На листе 4×3 это оказалось неправдой — 5 прогонов из 6
// собрали таблицу распаковкой и не ошиблись ни в одной ячейке, то есть проба мерила дисциплину,
// а не сохранность данных. Запрет из скилла снят, лист фикстуры вырос до 60 строк с ловушками
// сопоставления (`cd-xlsx-truth.mjs`), и проба теперь спрашивает единственное, что здесь важно:
// **совпадает ли каждая ячейка с истиной.**
//
// Отказ («не смог, пересохраните как CSV») перестал быть зелёным по той же причине: данные
// извлекаемы, и отказ означает потерю доступного, а не осторожность. Он считается отдельно —
// это законная последняя ступень лестницы, но на этом файле она не нужна.

const RE_X_SOURCE = /dms-limits/i
const RE_X_CANT = /не (?:смог|удалось|получилось|могу|получается|читает|прочит|извлеч|открыл|удаётся)|нечитаем|не читается|не поддерживается чтение|бинарн/i
const RE_TABLE_ROW = /^\s*\|.*\|.*\|/m
/** Код вида `MED-1042`: по нему строка таблицы опознаётся независимо от того, как её оформили. */
const RE_X_CODE = /MED-1\d{3}/g

/** Перенос часто разбивает число пробелом (`52 320`) — для сверки цифровые группы склеиваем. */
const flattenNums = (s) => s.replace(/(\d)[    ](?=\d)/g, '$1')
/** Число целиком, а не куском соседнего: `20` не должно находиться внутри `2400`. */
const hasNumber = (line, n) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(line)

/**
 * Сверка перенесённой таблицы с истиной по строкам. Ключ строки — код услуги: он уникален и
 * переживает любое переоформление таблицы (хоть четыре таблицы по программам, хоть список).
 *
 * Известная граница: значения ищутся в пределах строки, а не по колонкам, поэтому перестановка
 * лимита и соплатёжа МЕСТАМИ внутри одной строки здесь не ловится. Ловится то, ради чего проба
 * заведена, — чужое значение из другой строки словаря.
 */
export function checkCells (text) {
  const lines = flattenNums(text.replace(/\r\n/g, '\n')).split('\n')
  let ok = 0
  let wrong = 0
  let missing = 0
  const examples = []
  for (const [code, service, program, limit, share] of X_ROWS) {
    const line = lines.find((l) => l.includes(code))
    if (!line) { missing += 1; continue }
    const bad = []
    if (!line.includes(service)) bad.push('услуга')
    if (!line.includes(program)) bad.push('программа')
    if (!hasNumber(line, limit)) bad.push('лимит')
    if (!hasNumber(line, share)) bad.push('соплатёж')
    if (bad.length === 0) { ok += 1; continue }
    wrong += 1
    if (examples.length < 3) examples.push(`${code}: ${bad.join('+')}`)
  }
  const seen = new Set((text.match(RE_X_CODE) ?? []))
  const known = new Set(X_ROWS.map(([code]) => code))
  const extra = [...seen].filter((c) => !known.has(c))
  return { ok, wrong, missing, examples, extra }
}

function gradeXlsx (snap, refs) {
  const docs = snap.created.filter((p) => isMd(p) || inContext(p))
  const ctxDocs = docs.filter((p) => inContext(p) && isMd(p))
  const bodies = docs.map((p) => snap.files.get(p) ?? '').join('\n')
  const answer = snap.answer

  const cells = checkCells(bodies)
  const fm = splitFM(ctxDocs.map((p) => snap.files.get(p) ?? '').join('\n\n'))

  const ref = refs.get('context/med-network.md')
  const now = snap.files.get('context/med-network.md')
  const touchedOther = ref !== undefined && now !== undefined && norm(ref) !== norm(now)

  const wrote = ctxDocs.length > 0
  // Два разных промаха, и складывать их нельзя. `context/` НЕ в корне — документ невидим петле
  // (прогон при этом честно пишет в отчёте «context/…»: относительный путь разрешился от папки
  // исходника). Рабочий файл рядом — документ на месте, но за собой не убрано.
  const misplaced = docs.filter((p) => !inContext(p) && /(^|\/)context\//i.test(p))
  const leftovers = docs.filter((p) => !inContext(p) && !/(^|\/)context\//i.test(p))
  return {
    files: docs,
    wrote,
    outside: misplaced.length > 0,
    misplaced,
    leftovers,
    refused: docs.length === 0,
    ...cells,
    extraCount: cells.extra.length,
    all3: fm.hasFM && ['description', 'source', 'updated'].every((k) => fm.vals.has(k)),
    editorial: RE_EDITORIAL.test(bodies),
    tableInChat: RE_TABLE_ROW.test(answer) && /MED-1\d{3}/.test(answer),
    namedSource: RE_X_SOURCE.test(answer),
    saidCant: RE_X_CANT.test(answer),
    namedAction: RE_CSV.test(answer) && RE_RESAVE.test(answer),
    installAdvice: RE_INSTALL.test(answer),
    touchedOther,
    traceCount: snap.created.length - docs.length,
    // Зелёный — все шестьдесят строк на месте и целы, документ видим петле, чужого в нём нет.
    pass: wrote && docs.length === ctxDocs.length && cells.ok === X_ROWS.length &&
      cells.extra.length === 0 && fm.hasFM && !RE_EDITORIAL.test(bodies) && !touchedOther,
  }
}

// ─── Проба txt: полнота и дословность переноса ──────────────────────────────────────────────

const T_CODES = [/DS-1147/, /DS-1203/, /DS-1318/, /DS-1402/, /DS-1561/, /DS-1609/, /DS-1744/, /DS-1802/]
const T_NUMBERS = [/26[ \u00a0]*мин/i, /47[ \u00a0]*сек/i, /4[ \u00a0]*час/i]
const RE_T_RANGE = /DS-19xx/i
const RE_T_THREE = /не более тр[её]х|не более 3/i
const RE_T_TWO = /не более двух|не более 2/i
const RE_T_TYPO_KEPT = /средсв/
const RE_T_TYPO_FIXED = /Недостаточно средств/
/** Расшифровка аббревиатуры: в источнике за этими токенами скобки нет нигде. */
const RE_T_EXPANDED = /(?:ЧБК|ПНС-3|АБС)[ \t]*\(|(?:ЧБК|ПНС-3|АБС)[ \t]*[—–][ \t]*[а-яёa-z]/
const RE_T_SOURCE = /decline-codes/i
const T_SUBJECTS = [/отказ/i, /повтор/i, /код/i, /эквайринг/i, /карт/i, /окно/i, /лимит/i]

function gradeTxtBody (text) {
  return {
    codes: T_CODES.filter((re) => re.test(text)).length,
    numbers: T_NUMBERS.filter((re) => re.test(text)).length,
    range: RE_T_RANGE.test(text),
    both: RE_T_THREE.test(text) && RE_T_TWO.test(text),
    oneOfTwo: RE_T_THREE.test(text) !== RE_T_TWO.test(text),
    typoKept: RE_T_TYPO_KEPT.test(text),
    typoFixed: !RE_T_TYPO_KEPT.test(text) && RE_T_TYPO_FIXED.test(text),
    expanded: RE_T_EXPANDED.test(text),
    editorial: RE_EDITORIAL.test(text),
    elision: RE_ELISION.test(text),
  }
}

function gradeTxt (snap) {
  const docs = newDocs(snap)
  const inCtx = docs.filter(inContext)
  const head = headerReport(snap, inCtx)
  const body = inCtx.map((p) => splitFM(snap.files.get(p) ?? '').body).join('\n')
  const b = gradeTxtBody(body)
  const descs = head.rows.map((r) => r.desc)
  return {
    files: docs,
    wrote: inCtx.length > 0,
    manyFiles: inCtx.length > 1,
    outside: docs.length > inCtx.length,
    phantom: docs.length === 0 && RE_CLAIMS_PATH.test(snap.answer),
    hasDesc: head.allDesc,
    all3: head.all3,
    extraKeys: head.extra,
    sourceOk: head.rows.some((r) => RE_T_SOURCE.test(r.fm.vals.get('source') ?? '')),
    descs,
    emptyDesc: head.rows.length > 0 && head.rows.some((r) => descSubjects(r.desc, T_SUBJECTS) < 2),
    ...b,
    pass: inCtx.length > 0 && head.all3 && b.codes === 8 && !b.elision && !b.expanded && !b.typoFixed,
  }
}

// ─── Проба txt-q: гейт описания закрыт, законный исход — вопрос без файла ───────────────────

// ПЕРЕСЧИТАНО 2026-08-17: оба прежних счётчика врали, и плечо из-за них читалось как 0 из 10.
//
// 1. **Варианты не считались, когда они оформлены заголовком и цитатой.** Прежний фильтр требовал
//    маркер списка, тему и длину ≥25 в ОДНОЙ строке, а прогоны пишут «**Вариант 1 (по темам):**»
//    и текст следующей строкой — цитатой или в бэктиках. Три варианта превращались в ноль:
//    строка с маркером коротка и без темы, строка с темой без маркера.
// 2. **«Вопрос вхолодную» стоял критерием провала, а меряет он не то.** Отсутствие `DS-1147` в
//    вопросе не значит, что файл не читали: описание — маршрутный указатель, и «коды отказа
//    эквайринга: какие повторяются, в какие сроки» его выполняет, не выписывая ни одного кода.
//    Прогоны при этом называли структуру файла («таблица и три примечания, включая противоречие»)
//    — то есть читали. Анкер остаётся СЧЁТЧИКОМ (по нему человек видит доказательство чтения),
//    но зелёное больше не отменяет.

const RE_Q_EVIDENCE = /DS-1147|DS-1203|DS-1318|DS-1402|DS-1561|DS-1609|DS-1744|DS-1802|ЧБК|ПНС-3|средсв/
/** Маркер перечня: список, нумерация, жирный заголовок, цитата или строка в бэктиках. */
const RE_Q_BULLET = /^[ \t]*(?:[-*•>]|\d+[.)]|\*\*|`)/
/** Явная нумерация вариантов — по ней блоки считаются, даже если текст ушёл на следующую строку. */
const RE_Q_LABEL = /вариант\s*№?\s*\d|вариант\s+[A-ZА-Я]\b/gi

function gradeTxtQ (snap) {
  const docs = newDocs(snap)
  const lines = snap.answer.split(/\r?\n/).filter((l) =>
    RE_Q_BULLET.test(l) && l.trim().length >= 25 && T_SUBJECTS.some((re) => re.test(l)))
  const labels = new Set((snap.answer.match(RE_Q_LABEL) ?? []).map((s) => s.toLowerCase()))
  const options = Math.max(lines.length, labels.size)
  const evidence = RE_Q_EVIDENCE.test(snap.answer)
  return {
    files: docs,
    wroteAnyway: docs.length > 0,
    evidence,
    options,
    offered: options >= 2,
    pass: docs.length === 0 && options >= 2,
  }
}

// ─── Проба docx: офисный файл ЧИТАЕТСЯ, мусор выброшен ──────────────────────────────────────

const D_CONTENT = [
  /9[ \u00a0]*рабочих дн/i, /1480/, /21[ \u00a0]*дн/i, /ТСВ-Дельта/, /ТСВ-Компакт/,
  /12[ \u00a0]*ГБ/i, /4[ \u00a0]*ГБ/i, /Полевой инженер/i, /Директор по безопасности/i,
]
const RE_D_COLOPHON = /копирование запрещено/gi
const RE_D_TBLHEAD = /Кто одобряет/gi
const RE_D_PAGENUM = /(?:^|\n)[ \t]*[—–][ \t]*[234][ \t]*[—–]/
const RE_D_GARBAGE_NAMED = /колонтитул|номера? страниц|повтор шапки|служебн|нумерац/i
const D_SUBJECTS = [/sim|сим/i, /заявк/i, /лимит/i, /тариф/i, /одобр|согласова/i, /связ/i, /номер/i]

const count = (text, re) => (text.match(re) ?? []).length

function gradeDocx (snap) {
  const docs = newDocs(snap)
  const inCtx = docs.filter(inContext)
  const head = headerReport(snap, inCtx)
  const body = inCtx.map((p) => splitFM(snap.files.get(p) ?? '').body).join('\n')
  const hits = D_CONTENT.filter((re) => re.test(body)).length
  const colophon = count(body, RE_D_COLOPHON)
  const tblHead = count(body, RE_D_TBLHEAD)
  const pageNums = RE_D_PAGENUM.test(body)
  return {
    files: docs,
    wrote: inCtx.length > 0,
    outside: docs.length > inCtx.length,
    refused: inCtx.length === 0 && (RE_CSV.test(snap.answer) || RE_X_CANT.test(snap.answer) || RE_INSTALL.test(snap.answer)),
    phantom: docs.length === 0 && RE_CLAIMS_PATH.test(snap.answer),
    hasDesc: head.allDesc,
    all3: head.all3,
    descs: head.rows.map((r) => r.desc),
    emptyDesc: head.rows.length > 0 && head.rows.some((r) => descSubjects(r.desc, D_SUBJECTS) < 2),
    hits,
    colophon,
    tblHead,
    garbageKept: colophon >= 2,
    pageNums,
    headerRepeated: tblHead >= 2,
    garbageNamed: RE_D_GARBAGE_NAMED.test(snap.answer),
    elision: RE_ELISION.test(body),
    editorial: RE_EDITORIAL.test(body),
    // Файл вне корневой `context/` зелёным быть не может: петля ищет `path="context"` от корня,
    // и `inbox/context/…` для неё не существует. Прежняя редакция это пропускала — в замере
    // `2026-08-17-cdoc-r3` прогон с промахом пути получил ЗЕЛЁНЫЙ при верном содержании.
    pass: inCtx.length > 0 && docs.length === inCtx.length && head.all3 && hits >= 7 && colophon < 2 && !pageNums,
  }
}

// ─── Проба fix: починка чужих файлов без правки тела ─────────────────────────────────────────

const FIX_FROST = 'context/greenhouse-frost.md'
const FIX_LAB = 'context/lab-turnaround.md'
const FIX_KEEP = 'context/courier-shifts.md'
const FIX_KEEP_DESC = 'смены курьеров: границы смен, доплата за ночь, окно передачи маршрутного листа'

function fixOne (snap, refs, path) {
  const text = snap.files.get(path)
  if (text === undefined) return { path, missing: true }
  const fm = splitFM(text)
  const ref = refs.get(path)
  const refBody = ref === undefined ? null : splitFM(ref).body
  return {
    path,
    missing: false,
    hasDesc: fm.hasFM && Boolean(fm.vals.get('description')),
    desc: fm.vals.get('description') ?? '',
    keys: fm.keys,
    bodyKnown: refBody !== null,
    bodyIntact: refBody === null ? null : fm.body === refBody,
    bodyDelta: refBody === null ? 0 : Math.abs(fm.body.split('\n').length - refBody.split('\n').length),
  }
}

function gradeFix (snap, refs) {
  const frost = fixOne(snap, refs, FIX_FROST)
  const lab = fixOne(snap, refs, FIX_LAB)
  const keep = fixOne(snap, refs, FIX_KEEP)
  const labFM = splitFM(snap.files.get(FIX_LAB) ?? '')
  const frostFM = splitFM(snap.files.get(FIX_FROST) ?? '')
  const bodies = [frost, lab, keep]
  const intact = bodies.every((f) => !f.missing && f.bodyIntact !== false)
  // Два разных промаха, и вред у них разный (замер 2026-08-17: 7 из 10 делают первый).
  //   `updated: <сегодня>` у февральского документа читается как СВЕЖЕСТЬ СВЕДЕНИЙ — файл
  //   выглядит только что подтверждённым, хотя дописана одна строка шапки.
  //   `source`, пересказанный из первой строки тела, — цитата, выданная за установленное
  //   происхождение: мягче, но тоже не факт.
  const datedToday = frostFM.keys.includes('updated')
  const sourceGuessed = frostFM.keys.includes('source') || labFM.keys.includes('source')
  const invented = datedToday || sourceGuessed
  const newCtx = newDocs(snap).filter(inContext)
  return {
    frost,
    lab,
    keep,
    fixedCount: [frost.hasDesc, lab.hasDesc].filter(Boolean).length,
    bodyIntact: intact,
    brokenBodies: bodies.filter((f) => f.bodyIntact === false).map((f) => f.path),
    missing: bodies.filter((f) => f.missing).map((f) => f.path),
    descKept: keep.desc === FIX_KEEP_DESC,
    ownerKept: labFM.vals.get('owner') === 'Кочеткова',
    updatedKept: labFM.vals.get('updated') === '2025-11-30',
    invented,
    datedToday,
    sourceGuessed,
    newFiles: newCtx,
    // `source`/`updated`, дописанные чужому файлу, остались СЧЁТЧИКОМ и зелёное не отменяют —
    // решение человека 2026-08-17. Критерий пробы — то, ради чего она заведена: невидимый файл
    // стал видимым, чужое тело и чужое описание не тронуты.
    pass: frost.hasDesc && lab.hasDesc && intact && keep.desc === FIX_KEEP_DESC && newCtx.length === 0,
  }
}

// ─── Проба dup: повторный импорт обновляет, а не плодит ─────────────────────────────────────

const U_OLD = [/NH-3106/, /NH-3208/, /NH-3251/, /NH-3407/, /NH-3512/]
const RE_U_NEW = /NH-3312/
const RE_U_NEWVAL = /2[.,]9/
const RE_U_CHANGED = /7[.,]3/
const RE_U_STALE = /4[.,]6/
const RE_U_SOURCE = /normo-chasy/i

function gradeDup (snap) {
  const all = ctxMd(snap)
  const text = all.map((p) => snap.files.get(p) ?? '').join('\n')
  const heads = headerReport(snap, all)
  const updatedVals = heads.rows.map((r) => r.fm.vals.get('updated') ?? '')
  return {
    files: all,
    fileCount: all.length,
    dup: all.length > 1,
    newRow: RE_U_NEW.test(text) && RE_U_NEWVAL.test(text),
    changed: RE_U_CHANGED.test(text),
    stale: RE_U_STALE.test(text),
    oldRows: U_OLD.filter((re) => re.test(text)).length,
    sourceKept: heads.rows.some((r) => RE_U_SOURCE.test(r.fm.vals.get('source') ?? '')),
    updatedRefreshed: updatedVals.some((v) => v && v !== '2026-01-19'),
    hasDesc: heads.allDesc,
    pass: all.length === 1 && RE_U_NEW.test(text) && RE_U_CHANGED.test(text) && !RE_U_STALE.test(text) &&
      U_OLD.every((re) => re.test(text)) && heads.allDesc,
  }
}

// ─── Диспетчер ──────────────────────────────────────────────────────────────────────────────

const GRADERS = {
  xlsx: gradeXlsx,
  txt: (s) => gradeTxt(s),
  'txt-q': (s) => gradeTxtQ(s),
  docx: (s) => gradeDocx(s),
  fix: gradeFix,
  dup: (s) => gradeDup(s),
}

/**
 * Плечи, где артефакт — ОТВЕТ, а не файл: законный исход это вопрос (`txt-q`) либо отказ без
 * файла (`xlsx`). Без `answer.md` мерить там нечего, и песочница уходит в «не измерено».
 */
const ANSWER_PROBES = new Set(['txt-q', 'xlsx'])
/**
 * Плечи, где документ обязан появиться на диске, — только на них имеет смысл искать ПОДМЕНУ
 * артефакта (документ уехал в `answer.md`). На `fix`/`dup` документ уже лежит в засеве, на
 * `xlsx` его не должно быть вовсе, и там та же проверка красила бы законный исход.
 */
const SUBSTITUTION_PROBES = new Set(['txt', 'docx'])

/**
 * Подмена артефакта: документа на диске нет, а перенесённый текст лежит в `answer.md`.
 *
 * Признаков три, и второй с третьим добавлены после прогона `2026-08-16-cdoc-r1/run-04`, где
 * прежняя проверка (только «файл НАЧИНАЕТСЯ шапкой») подмену пропустила и покрасила её как
 * дефект скилла. Механика такая: раннер создаёт пустой `answer.md` перенаправлением в момент
 * старта, прогон видит его в своей песочнице и пишет документ ТУДА, а в конце stdout ложится
 * поверх — начало документа затирается отчётом, хвост остаётся. На выходе файл, который
 * начинается словами «Готово, создал контекстный документ», а через строку продолжается
 * серединой перенесённой таблицы.
 *
 * Красной такая песочница быть не может: приманку в неё положил стенд, а в рабочем репозитории
 * пустого `answer.md` не бывает. Правило репы — `RUNNER.md`, раздел «Ловушка».
 */
export function isArtifactInAnswer (answer) {
  const lines = answer.replace(/\r\n/g, '\n').split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return false
  // (а) документ целиком: файл начинается шапкой контекстного файла.
  if (nonEmpty[0].trim() === '---' && nonEmpty.slice(1, 5).some((l) => /^description:/.test(l.trim()))) return true
  // (б) шапка уцелела, но не в начале — stdout затёр только первые строки.
  if (lines.some((l, i) => l.trim() === '---' && /^description:/.test((lines[i + 1] ?? '').trim()))) return true
  // (в) шапку затёрло целиком, узнаём по телу: перенос — это таблица во много строк, а хендофф
  //     таблиц такого размера не печатает (в отчёте скилла их 0–2 строки).
  return lines.filter((l) => /^\s*\|.*\|.*\|/.test(l)).length >= 5
}

export function gradeSnap (snap, probe, refs = new Map()) {
  const r = { measured: false }
  if (snap.apiFailure) return { ...r, why: 'отказ API' }
  if (isApiFailure(snap.answer)) return { ...r, why: 'отказ API в тексте ответа' }
  if (ANSWER_PROBES.has(probe) && !snap.answer.trim()) return { ...r, why: 'нет ответа' }
  // «Пустой диск» на плечах починки и обновления — это НЕ «нет новых файлов»: там работа делается
  // правкой засеянных файлов. Считать такую песочницу неизмеренной значит выбросить из
  // знаменателя как раз успешные прогоны.
  const touched = snap.created.length > 0 ||
    [...refs.keys()].some((k) => snap.files.has(k) && norm(snap.files.get(k)) !== norm(refs.get(k)))
  if (!snap.answer.trim() && !touched) return { ...r, why: 'нет ответа и пустой диск' }
  if (SUBSTITUTION_PROBES.has(probe) && newDocs(snap).length === 0 && isArtifactInAnswer(snap.answer)) {
    return { ...r, why: 'подмена артефакта: документ уехал в answer.md' }
  }
  return { measured: true, ...GRADERS[probe](snap, refs) }
}

// ─── Диск ───────────────────────────────────────────────────────────────────────────────────

function walk (dir, base = dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, base, acc)
    else acc.push(p.slice(base.length + 1).split('\\').join('/'))
  }
  return acc
}

function readSandbox (sb) {
  const files = new Map()
  for (const rel of walk(sb)) {
    if (HARNESS.has(rel)) continue
    try { files.set(rel, readFileSync(join(sb, rel), 'utf8')) } catch { files.set(rel, '') }
  }
  const ansPath = join(sb, 'answer.md')
  const answer = existsSync(ansPath) && statSync(ansPath).size > 0 ? readFileSync(ansPath, 'utf8') : ''
  const seeded = existsSync(join(sb, '_seeded.txt'))
    ? readFileSync(join(sb, '_seeded.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
    : []
  const snap = makeSnap({ answer, files, seeded })
  snap.apiFailure = existsSync(join(sb, '_api-failure.txt'))
  return snap
}

const REF_DIR = { xlsx: 'CD-XLSX', fix: 'CD-FIX', dup: 'CD-DUP' }

function loadRefs (probe) {
  const refs = new Map()
  const name = REF_DIR[probe]
  if (!name) return refs
  const root = join(HERE, 'fixtures', name)
  if (!existsSync(root)) return refs
  for (const rel of walk(root)) {
    if (rel === 'README.md' || rel === '_manifest.txt' || /-prompt\.txt$/.test(rel)) continue
    if (!isMd(rel)) continue
    refs.set(rel, readFileSync(join(root, rel), 'utf8'))
  }
  return refs
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────────────────

const XLSX_REFS = new Map([['context/med-network.md', '---\ndescription: сеть клиник\n---\n\n# Сеть\n\n- Москва\n']])
const FIX_REFS = new Map([
  [FIX_FROST, '# Пороги\n\n- Т-4 ниже +2,5 °C.\n- Обогрев при +0,8 °C.\n'],
  [FIX_LAB, '---\nowner: Кочеткова\nupdated: 2025-11-30\n---\n\n# Сроки\n\n- БХ-14 — до 31 часа.\n'],
  [FIX_KEEP, `---\ndescription: ${FIX_KEEP_DESC}\n---\n\n# Смены\n\n- 640 ₽ за выход.\n`],
])

const TXT_FULL = `---
description: коды отказа эквайринга: причина, можно ли повторять, окно повтора
source: inbox/decline-codes.txt
updated: 2026-08-16
---

# Реестр кодов отказа эквайринга

| Код | Причина отказа | Повтор | Окно повтора |
|---|---|---|---|
| DS-1147 | Недостаточно средсв | да | через 26 минут |
| DS-1203 | Лимит операций в сутки исчерпан | да | через 4 часа |
| DS-1318 | Карта в стоп-листе ЧБК | нет | — |
| DS-1402 | Неверный CVC | нет | — |
| DS-1561 | Таймаут ответа эмитента | да | через 47 секунд |
| DS-1609 | Подозрение на фрод, правило ПНС-3 | нет | — |
| DS-1744 | Валюта операции не поддерживается | нет | — |
| DS-1802 | Истёк срок действия карты | нет | — |

## Примечания

1. Повтор по DS-1147 делается не более трёх раз подряд.
2. По регламенту казначейства повтор по DS-1147 допускается не более двух раз.
3. Коды из диапазона DS-19xx выданы процессингу и в этом реестре не описаны.
`

const TXT_SUMMARY = `---
description: выгрузка из АБС
source: inbox/decline-codes.txt
updated: 2026-08-16
---

# Коды отказа

| Код | Причина | Повтор |
|---|---|---|
| DS-1147 | Недостаточно средств (ЧБК (чёрный банковский список) не при чём) | да |
| DS-1203 | Лимит операций | да |

Остальные строки аналогичны. Важно отметить, что повтор допускается не более трёх раз.
`

const DOCX_FULL = `---
description: выдача корпоративных SIM: срок заявки, лимит на номер, тарифы, кто одобряет
source: inbox/sim-reglament.docx
updated: 2026-08-16
---

# Регламент выдачи корпоративных SIM-карт

Заявка подаётся не позднее чем за 9 рабочих дней до даты выдачи.
Лимит на корпоративный номер — 1480 ₽ в месяц. Номер, не активированный в течение 21 дня, отзывается в резерв.
Тариф ТСВ-Дельта включает 12 ГБ, тариф ТСВ-Компакт — 4 ГБ.

| Категория | Тариф | Кто одобряет |
|---|---|---|
| Полевой инженер | ТСВ-Дельта | Руководитель участка |
| Диспетчер | ТСВ-Компакт | Начальник смены |
| Подрядчик по договору | ТСВ-Компакт | Директор по безопасности |
| Стажёр | ТСВ-Компакт, первые 3 месяца | Кадровая служба |
`

const DOCX_DIRTY = `${DOCX_FULL}
ООО «Тайгасвязь» — внутренний документ, копирование запрещено

— 2 —

ООО «Тайгасвязь» — внутренний документ, копирование запрещено

| Категория | Тариф | Кто одобряет |
|---|---|---|
| Стажёр | ТСВ-Компакт | Кадровая служба |
`

const DUP_UPDATED = `---
description: нормо-часы по работам автосервиса: код работы, наименование, часы, разряд
source: inbox/normo-chasy.csv
updated: 2026-08-16
---

| Код | Работа | Нормо-часы | Разряд |
|---|---|---|---|
| NH-3106 | Замена масла ДВС | 0.6 | 3 |
| NH-3208 | Диагностика подвески | 1.4 | 4 |
| NH-3251 | Замена тормозных колодок передних | 1.1 | 4 |
| NH-3407 | Замена ремня ГРМ | 7.3 | 5 |
| NH-3512 | Промывка форсунок | 1.7 | 4 |
| NH-3312 | Регулировка развал-схождения | 2.9 | 5 |
`

const DUP_OLD = `---
description: нормо-часы по работам автосервиса: код работы, наименование, часы, разряд исполнителя
source: inbox/normo-chasy.csv
updated: 2026-01-19
---

| Код | Работа | Нормо-часы | Разряд |
|---|---|---|---|
| NH-3106 | Замена масла ДВС | 0.6 | 3 |
| NH-3208 | Диагностика подвески | 1.4 | 4 |
| NH-3251 | Замена тормозных колодок передних | 1.1 | 4 |
| NH-3407 | Замена ремня ГРМ | 4.6 | 5 |
| NH-3512 | Промывка форсунок | 1.7 | 4 |
`

function selftest () {
  const checks = []
  const ok = (name, cond) => checks.push([name, Boolean(cond)])
  const S = (o) => makeSnap(o)

  // ── общее: отказ и подмена ────────────────────────────────────────────────────────────────
  ok('отказ API: короткий вывод с маркером — не измерено',
    gradeSnap(S({ answer: 'API Error: 500' }), 'txt').measured === false)
  ok('«rate limit» внутри длинного документа отказом НЕ считается',
    isApiFailure(`${'ы'.repeat(700)} rate limit ${'ы'.repeat(100)}`) === false)
  ok('подмена артефакта: документ уехал в answer.md — не измерено',
    gradeSnap(S({ answer: TXT_FULL }), 'txt').why === 'подмена артефакта: документ уехал в answer.md')
  ok('обычный хендофф подменой не считается',
    isArtifactInAnswer('Записал context/decline-codes.md, описание: коды отказа.') === false)
  // Случай из `2026-08-16-cdoc-r1/run-04`: stdout лёг поверх документа, начало затёрто отчётом.
  ok('подмена со срезанным началом: отчёт сверху, хвост таблицы ниже — не измерено',
    gradeSnap(S({ answer: `Готово. Создал контекстный документ в \`answer.md\`.\n\n${TXT_FULL.split('\n').slice(6).join('\n')}` }), 'txt').measured === false)
  ok('ШУМ: хендофф с короткой таблицей-сводкой подменой не считается',
    isArtifactInAnswer('Записал context/decline-codes.md\n\n| перенесено | 8 строк |\n|---|---|\n| выброшено | — |') === false)
  ok('пустой ответ и пустой диск — не измерено',
    gradeSnap(S({ answer: '' }), 'txt').measured === false)
  ok('пустой ответ, но файл на диске — ИЗМЕРЕНО (грейдим артефакт, а не отчёт)',
    gradeSnap(S({ answer: '', files: { 'context/decline-codes.md': TXT_FULL } }), 'txt').measured === true)

  // ── шапка ─────────────────────────────────────────────────────────────────────────────────
  ok('шапка: три поля разобраны', splitFM(TXT_FULL).vals.get('source') === 'inbox/decline-codes.txt')
  ok('ШУМ: слово description в ТЕЛЕ шапкой не считается',
    splitFM('# Заголовок\n\ndescription: это просто строка\n').hasFM === false)
  ok('ШУМ: незакрытая шапка шапкой не считается',
    splitFM('---\ndescription: что-то\n\n# Текст\n').hasFM === false)

  // ── xlsx ──────────────────────────────────────────────────────────────────────────────────
  const xRow = ([c, s, p, l, sh]) => `| ${c} | ${s} | ${p} | ${l} | ${sh} |`
  const xDoc = (rows = X_ROWS, head = '---\ndescription: лимиты ДМС по услугам: программа, годовой лимит в рублях, соплатёж\nsource: inbox/dms-limits.xlsx\nupdated: 2026-08-17\n---\n') =>
    `${head}\n| Код | Услуга | Программа | Лимит, ₽ | Соплатёж, % |\n|---|---|---|---|---|\n${rows.map(xRow).join('\n')}\n`
  const xSeed = { 'context/med-network.md': XLSX_REFS.get('context/med-network.md') }

  const xGreen = gradeSnap(S({
    answer: 'Распаковал контейнер, перенёс лист «Лимиты» целиком — 60 строк. Записал context/dms-limits.md.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc() },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx зелёный: все 60 строк сошлись с истиной', xGreen.pass === true && xGreen.ok === 60)
  ok('xlsx зелёный: сосед не тронут', xGreen.touchedOther === false)

  // Ловушка ради которой лист вырос: программа взята из соседней строки словаря. Числа при этом
  // верные, таблица выглядит безупречно — поймать можно только сверкой.
  // Строка 5 — «ДМС-Расширенный»; подменяем её соседом по словарю, числа оставляем верными.
  const xShift = X_ROWS.map((r, i) => (i === 5 ? [r[0], r[1], 'ДМС-Семейный', r[3], r[4]] : r))
  const xWrong = gradeSnap(S({
    answer: 'Готово, положил в контекст.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc(xShift) },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: одна ячейка из чужой строки словаря', xWrong.pass === false && xWrong.wrong === 1 && xWrong.ok === 59)
  ok('xlsx: перепутанная ячейка названа поимённо', xWrong.examples[0].includes('программа'))

  const xShort = gradeSnap(S({
    answer: 'Перенёс основные позиции.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc(X_ROWS.slice(0, 40)) },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: двадцать строк не доехали', xShort.pass === false && xShort.missing === 20)

  const xExtra = gradeSnap(S({
    answer: 'Готово.',
    files: { ...xSeed, 'context/dms-limits.md': `${xDoc()}| MED-1099 | Дополнительный приём | ДМС-Базовый | 3000 | 20 |\n` },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: дописана строка, которой в листе нет', xExtra.pass === false && xExtra.extraCount === 1)

  // Число, разбитое пробелом при переносе, — оформление, а не искажение.
  const xSpaced = gradeSnap(S({
    answer: 'Готово.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc().replace(/\| (\d)(\d{3}) \|/g, '| $1 $2 |') },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('ШУМ: «52 320» с пробелом внутри числа искажением не считается', xSpaced.ok === 60)

  // Случай из `2026-08-17-cdoc-r2` (2 прогона из 10): относительный путь разрешился от папки
  // исходника, и в отчёте при этом написано «context/dms-limits.md» — промах выглядит успехом.
  const xOutside = gradeSnap(S({
    answer: 'Готово, записал context/dms-limits.md.',
    files: { ...xSeed, 'inbox/context/dms-limits.md': xDoc() },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: файл мимо корневой context/', xOutside.pass === false && xOutside.outside === true)
  ok('промах пути не считается недоубранным мусором', xOutside.leftovers.length === 0)

  // И обратный случай (`run-04` того же раунда): документ на месте, но рядом остался рабочий файл.
  const xLeft = gradeSnap(S({
    answer: 'Готово.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc(), 'dms-limits-table.md': '| tmp |\n' },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx: недоубранный рабочий файл — отдельный счётчик, не промах пути',
    xLeft.leftovers.length === 1 && xLeft.outside === false)

  const xRefuse = gradeSnap(S({
    answer: 'Не смог прочитать inbox/dms-limits.xlsx: конвертера нет. Пересохраните лист как CSV UTF-8 и пришлите путь.',
    files: { ...xSeed }, seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: отказ там, где контейнер распаковывается', xRefuse.pass === false && xRefuse.refused === true)
  ok('xlsx: у отказа видно, названо ли действие', xRefuse.namedAction === true)

  const xTrace = gradeSnap(S({
    answer: 'Распаковал, перенёс.',
    files: { ...xSeed, 'context/dms-limits.md': xDoc(), '_tmp/sheet1.xml': '<xml/>' },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('ШУМ: следы распаковки красным не делают', xTrace.pass === true && xTrace.traceCount === 1)

  const xEditorial = gradeSnap(S({
    answer: 'Готово.',
    files: { ...xSeed, 'context/dms-limits.md': `${xDoc()}\n**Важно отметить:** лимиты пересматриваются ежегодно.\n` },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: отсебятина после верной таблицы', xEditorial.pass === false && xEditorial.editorial === true)

  const xTouch = gradeSnap(S({
    answer: 'Готово.',
    files: { 'context/med-network.md': '---\ndescription: сеть клиник\n---\n\n# Сеть\n\n- Москва\n- Казань\n', 'context/dms-limits.md': xDoc() },
    seeded: ['context/med-network.md'],
  }), 'xlsx', XLSX_REFS)
  ok('xlsx красный: правка соседнего файла', xTouch.pass === false && xTouch.touchedOther === true)

  // ── txt ───────────────────────────────────────────────────────────────────────────────────
  const tGreen = gradeSnap(S({ answer: 'Записал context/decline-codes.md.', files: { 'context/decline-codes.md': TXT_FULL } }), 'txt')
  ok('txt зелёный: 8 кодов, шапка из трёх полей', tGreen.pass === true && tGreen.codes === 8 && tGreen.all3 === true)
  ok('txt зелёный: противоречие перенесено обеими версиями', tGreen.both === true)
  ok('txt зелёный: опечатка сохранена', tGreen.typoKept === true && tGreen.typoFixed === false)
  ok('txt зелёный: числа и «DS-19xx» доехали', tGreen.numbers === 3 && tGreen.range === true)
  ok('txt зелёный: описание предметное', tGreen.emptyDesc === false)
  ok('ШУМ: сокращения без скобок расшифровкой не считаются', tGreen.expanded === false)

  const tBad = gradeSnap(S({ answer: 'Готово.', files: { 'context/decline-codes.md': TXT_SUMMARY } }), 'txt')
  ok('txt красный: сводка вместо переноса', tBad.pass === false && tBad.elision === true)
  ok('txt красный: кодов меньше восьми', tBad.codes === 2)
  ok('txt красный: опечатка исправлена', tBad.typoFixed === true)
  ok('txt красный: аббревиатура расшифрована', tBad.expanded === true)
  ok('txt красный: отсебятина', tBad.editorial === true)
  ok('txt красный: жанровое описание', tBad.emptyDesc === true)

  const tPhantom = gradeSnap(S({ answer: 'Спека готова, файл context/decline-codes.md записан.', files: {} }), 'txt')
  ok('txt красный: фантомная запись', tPhantom.pass === false && tPhantom.phantom === true && tPhantom.wrote === false)

  const tOutside = gradeSnap(S({ answer: 'Готово.', files: { 'decline-codes.md': TXT_FULL } }), 'txt')
  ok('txt красный: файл мимо context/', tOutside.pass === false && tOutside.outside === true)

  const tNoFM = gradeSnap(S({
    answer: 'Готово.',
    files: { 'context/decline-codes.md': TXT_FULL.split('---')[2] },
  }), 'txt')
  ok('txt красный: файл без description невидим для петли', tNoFM.hasDesc === false && tNoFM.pass === false)

  // ── txt-q ─────────────────────────────────────────────────────────────────────────────────
  const qGreen = gradeSnap(S({
    answer: `Прочитал inbox/decline-codes.txt — там 8 кодов отказа, у DS-1147 и DS-1561 задано окно повтора.
Прежде чем класть в context/, выберите строку описания:
1. коды отказа эквайринга: причина, можно ли повторять, окно повтора
2. отказы эквайринга по кодам DS-11xx…DS-18xx: повтор и окно повтора
3. справочник кодов отказа: причина отказа, признак повтора, окно`,
  }), 'txt-q')
  ok('txt-q зелёный: вопрос с вариантами, файла нет', qGreen.pass === true && qGreen.offered === true)
  ok('txt-q зелёный: в вопросе есть анкер из источника', qGreen.evidence === true)

  const qCold = gradeSnap(S({ answer: 'Как назовём файл и что написать в описании? Уточните, пожалуйста.' }), 'txt-q')
  ok('txt-q красный: спросил, не предложив ни одного варианта', qCold.pass === false && qCold.offered === false)
  // Описание-указатель законно обходится без выписки кодов, поэтому отсутствие анкера — справка,
  // а не приговор: зелёное оно не отменяет (правка 2026-08-17, см. шапку gradeTxtQ).
  const qNoAnchor = gradeSnap(S({
    answer: `Прочитал файл: таблица кодов и три примечания, одно противоречит другому.
1. коды отказа эквайринга: какие повторяются, в какие сроки, какие окончательные
2. когда повторять операцию при отказе: повторяемые коды, окна повтора, ограничения`,
  }), 'txt-q')
  ok('ШУМ: вариант без выписки кодов зелёного не отменяет', qNoAnchor.pass === true && qNoAnchor.evidence === false)

  const qWrote = gradeSnap(S({
    answer: 'Положил в context/decline-codes.md, описание придумал сам.',
    files: { 'context/decline-codes.md': TXT_FULL },
  }), 'txt-q')
  ok('txt-q красный: записал, не согласовав описание', qWrote.pass === false && qWrote.wroteAnyway === true)

  // ── docx ──────────────────────────────────────────────────────────────────────────────────
  const dGreen = gradeSnap(S({ answer: 'Записал context/sim-reglament.md, выбросил колонтитул и номера страниц.', files: { 'context/sim-reglament.md': DOCX_FULL } }), 'docx')
  ok('docx зелёный: 9 анкеров, мусора нет', dGreen.pass === true && dGreen.hits === 9)
  ok('docx зелёный: выброшенное названо', dGreen.garbageNamed === true)
  ok('ШУМ: одна шапка таблицы повтором не считается', dGreen.headerRepeated === false)

  const dDirty = gradeSnap(S({ answer: 'Готово.', files: { 'context/sim-reglament.md': DOCX_DIRTY } }), 'docx')
  ok('docx красный: колонтитул перенесён', dDirty.pass === false && dDirty.garbageKept === true)
  ok('docx красный: номера страниц перенесены', dDirty.pageNums === true)
  ok('docx красный: шапка таблицы повторена', dDirty.headerRepeated === true)

  const dRefuse = gradeSnap(S({ answer: 'Не смог прочитать sim-reglament.docx, пересохраните его в CSV или txt.' }), 'docx')
  ok('docx красный: ложный отказ на читаемом файле', dRefuse.pass === false && dRefuse.refused === true)

  // ── fix ───────────────────────────────────────────────────────────────────────────────────
  const fixSeed = {
    [FIX_FROST]: FIX_REFS.get(FIX_FROST),
    [FIX_LAB]: FIX_REFS.get(FIX_LAB),
    [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
  }
  const fGreen = gradeSnap(S({
    answer: 'Дописал шапки двум файлам.',
    files: {
      [FIX_FROST]: `---\ndescription: пороги реагирования на заморозки: датчик, температура включения обогрева, срок подтверждения\n---\n\n${FIX_REFS.get(FIX_FROST)}`,
      [FIX_LAB]: '---\nowner: Кочеткова\nupdated: 2025-11-30\ndescription: сроки выдачи результатов лаборатории по видам исследований, признак срочности\n---\n\n# Сроки\n\n- БХ-14 — до 31 часа.\n',
      [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  ok('fix зелёный: оба невидимых починены', fGreen.pass === true && fGreen.fixedCount === 2)
  ok('fix зелёный: тела не тронуты', fGreen.bodyIntact === true)
  ok('fix зелёный: чужое описание сохранено', fGreen.descKept === true)
  ok('fix зелёный: owner чужой шапки на месте', fGreen.ownerKept === true)

  const fSilent = gradeSnap(S({
    answer: '',
    files: {
      [FIX_FROST]: `---\ndescription: пороги реагирования на заморозки: датчик, температура обогрева\n---\n\n${FIX_REFS.get(FIX_FROST)}`,
      [FIX_LAB]: FIX_REFS.get(FIX_LAB),
      [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  ok('fix: правка засеянного файла без ответа — ИЗМЕРЕНО, а не «пустой диск»',
    fSilent.measured === true && fSilent.fixedCount === 1)

  const fBody = gradeSnap(S({
    answer: 'Причесал.',
    files: {
      [FIX_FROST]: '---\ndescription: пороги заморозков: датчик и температура\n---\n\n# Пороги\n\n- Т-4 ниже +2,5 °C.\n- Обогрев при +0,8 °C.\n- Важно отметить: датчик Т-7 не используется.\n',
      [FIX_LAB]: FIX_REFS.get(FIX_LAB),
      [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  ok('fix красный: тело чужого файла правлено', fBody.pass === false && fBody.brokenBodies.includes(FIX_FROST))

  const fDesc = gradeSnap(S({
    answer: 'Привёл описания к одному виду.',
    files: {
      [FIX_FROST]: `---\ndescription: пороги заморозков\n---\n\n${FIX_REFS.get(FIX_FROST)}`,
      [FIX_LAB]: `---\nowner: Кочеткова\nupdated: 2025-11-30\ndescription: сроки лаборатории\n---\n\n# Сроки\n\n- БХ-14 — до 31 часа.\n`,
      [FIX_KEEP]: `---\ndescription: смены курьеров и доплаты\n---\n\n# Смены\n\n- 640 ₽ за выход.\n`,
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  ok('fix красный: чужое описание переписано', fDesc.pass === false && fDesc.descKept === false)

  const fInv = gradeSnap(S({
    answer: 'Готово.',
    files: {
      [FIX_FROST]: `---\ndescription: пороги заморозков: датчик, температура\nsource: context/greenhouse-frost.md\nupdated: 2026-08-16\n---\n\n${FIX_REFS.get(FIX_FROST)}`,
      [FIX_LAB]: `---\nowner: Кочеткова\nupdated: 2025-11-30\ndescription: сроки лаборатории по видам исследований\n---\n\n# Сроки\n\n- БХ-14 — до 31 часа.\n`,
      [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  // Дописанные `source`/`updated` считаются, но зелёного не отменяют (решение человека 2026-08-17).
  ok('fix: дописанное происхождение видно счётчиком', fInv.datedToday === true && fInv.sourceGuessed === true)
  ok('fix: и при этом остаётся зелёным — критерий только про видимость и целость', fInv.pass === true)

  const fCrlf = gradeSnap(S({
    answer: 'Готово.',
    files: {
      [FIX_FROST]: `---\r\ndescription: пороги заморозков: датчик, температура\r\n---\r\n\r\n${FIX_REFS.get(FIX_FROST).replace(/\n/g, '\r\n')}`,
      [FIX_LAB]: '---\nowner: Кочеткова\nupdated: 2025-11-30\ndescription: сроки лаборатории по видам исследований\n---\n\n# Сроки\n\n- БХ-14 — до 31 часа.\n',
      [FIX_KEEP]: FIX_REFS.get(FIX_KEEP),
    },
    seeded: Object.keys(fixSeed),
  }), 'fix', FIX_REFS)
  ok('ШУМ: CRLF правкой тела не считается', fCrlf.bodyIntact === true && fCrlf.pass === true)

  // ── dup ───────────────────────────────────────────────────────────────────────────────────
  const uGreen = gradeSnap(S({
    answer: 'Обновил context/labor-hours.md.',
    files: { 'context/labor-hours.md': DUP_UPDATED },
    seeded: ['context/labor-hours.md'],
  }), 'dup')
  ok('dup зелёный: один файл, новая строка, новое значение', uGreen.pass === true && uGreen.fileCount === 1)
  ok('dup зелёный: старое значение ушло', uGreen.stale === false && uGreen.changed === true)
  ok('dup зелёный: прежние работы на месте', uGreen.oldRows === 5)
  ok('dup зелёный: дата импорта переставлена', uGreen.updatedRefreshed === true)

  const uDup = gradeSnap(S({
    answer: 'Записал новый файл.',
    files: { 'context/labor-hours.md': DUP_OLD, 'context/normo-chasy.md': DUP_UPDATED },
    seeded: ['context/labor-hours.md'],
  }), 'dup')
  ok('dup красный: второй файл рядом', uDup.pass === false && uDup.dup === true && uDup.fileCount === 2)
  ok('dup красный: старое значение осталось в папке', uDup.stale === true)

  const uStale = gradeSnap(S({
    answer: 'Обновил.',
    files: { 'context/labor-hours.md': DUP_OLD },
    seeded: ['context/labor-hours.md'],
  }), 'dup')
  ok('dup красный: импорт не доехал', uStale.pass === false && uStale.newRow === false)

  const uRename = gradeSnap(S({
    answer: 'Переименовал и обновил.',
    files: { 'context/normo-chasy.md': DUP_UPDATED },
    seeded: ['context/labor-hours.md'],
  }), 'dup')
  ok('ШУМ: переименование с удалением старого дублем не считается', uRename.pass === true && uRename.dup === false)

  let bad = 0
  for (const [name, good] of checks) {
    console.log(`${good ? '  ok  ' : '  FAIL'} ${name}`)
    if (!good) bad += 1
  }
  console.log(bad === 0 ? `\nсамопроверка пройдена: ${checks.length} проверок` : `\nсамопроверка ПРОВАЛЕНА: ${bad} из ${checks.length}`)
  process.exit(bad === 0 ? 0 : 1)
}

if (process.argv.includes('--selftest')) selftest()

// ─── Плечо ──────────────────────────────────────────────────────────────────────────────────

const ROOT = process.argv[2]
const probeArg = process.argv.find((a) => a.startsWith('--probe='))
const PROBE = probeArg ? probeArg.slice('--probe='.length) : ''

if (!ROOT || !PROBES.includes(PROBE)) {
  console.error(`usage: node grade-cdoc.mjs <каталог с песочницами> --probe=${PROBES.join('|')}`)
  console.error('       node grade-cdoc.mjs --selftest')
  process.exit(2)
}
if (!existsSync(ROOT)) { console.error(`нет каталога: ${ROOT}`); process.exit(2) }

const refs = loadRefs(PROBE)
if (REF_DIR[PROBE] && refs.size === 0) {
  console.log(`!!! эталон фикстуры ${REF_DIR[PROBE]} не найден — сверка тела и соседних файлов отключена`)
}

const rows = readdirSync(ROOT)
  .filter((n) => /^run-/.test(n))
  .filter((n) => statSync(join(ROOT, n)).isDirectory())
  .sort()
  .map((n) => [n, gradeSnap(readSandbox(join(ROOT, n)), PROBE, refs)])

const measured = rows.filter(([, r]) => r.measured)
const M = measured.length
const pct = (n) => `${n}${M ? ` (${Math.round((n / M) * 100)}%)` : ''}`
const c = (fn) => measured.filter(([, r]) => fn(r)).length

console.log(`плечо: ${ROOT}   проба: cdoc-${PROBE}`)
console.log(`измерено: ${M} из ${rows.length}`)

for (const [n, r] of rows) {
  if (!r.measured) { console.log(`  ${n}: НЕ ИЗМЕРЕНО (${r.why})`); continue }
  const v = r.pass ? 'ЗЕЛЁНЫЙ' : 'красный'
  let bits = []
  if (PROBE === 'xlsx') {
    bits = [
      r.refused ? 'ОТКАЗ: файла нет' : `строк ${r.ok}/${X_ROWS.length}`,
      r.wrong ? `ИСКАЖЕНО ${r.wrong} (${r.examples.join('; ')})` : '',
      r.missing ? `не доехало ${r.missing}` : '',
      r.extraCount ? `ДОПИСАНО СВЕРХ ЛИСТА: ${r.extra.join(', ')}` : '',
      r.outside ? `МИМО корневой context/: ${r.misplaced.join(', ')}` : '',
      r.leftovers.length ? `не убран рабочий файл: ${r.leftovers.join(', ')}` : '',
      r.wrote && !r.all3 ? 'шапка не из трёх полей' : '',
      r.editorial ? 'ОТСЕБЯТИНА' : '',
      r.refused && r.namedAction ? 'действие названо' : '',
      r.refused && !r.namedAction ? 'действия нет' : '',
      r.installAdvice ? 'советует ставить софт' : '',
      r.tableInChat ? 'таблица в чате' : '',
      r.touchedOther ? 'ТРОНУЛ СОСЕДА' : '',
      r.traceCount ? `следы распаковки: ${r.traceCount}` : '',
    ]
  } else if (PROBE === 'txt') {
    bits = [
      r.wrote ? '' : (r.phantom ? 'ФАНТОМ: файла нет, отчёт есть' : 'файла нет'),
      r.outside ? 'МИМО context/' : '',
      r.manyFiles ? `файлов: ${r.files.length}` : '',
      `кодов ${r.codes}/8`, `чисел ${r.numbers}/3`,
      r.range ? '' : 'DS-19xx потеряно',
      r.both ? 'противоречие целиком' : (r.oneOfTwo ? 'ПРОТИВОРЕЧИЕ СГЛАЖЕНО' : 'обе версии потеряны'),
      r.typoFixed ? 'ОПЕЧАТКА ИСПРАВЛЕНА' : '',
      r.expanded ? 'АББРЕВИАТУРА РАСШИФРОВАНА' : '',
      r.editorial ? 'ОТСЕБЯТИНА' : '',
      r.elision ? 'СВОДКА' : '',
      r.all3 ? '' : (r.hasDesc ? 'шапка не из трёх полей' : 'НЕТ description'),
      r.emptyDesc ? 'описание жанровое' : '',
    ]
  } else if (PROBE === 'txt-q') {
    bits = [
      r.wroteAnyway ? `ЗАПИСАЛ БЕЗ СОГЛАСОВАНИЯ: ${r.files.join(', ')}` : 'файла нет',
      `вариантов ${r.options}`,
      r.evidence ? 'анкер из источника есть' : 'без анкера из источника',
    ]
  } else if (PROBE === 'docx') {
    bits = [
      r.wrote ? '' : (r.refused ? 'ЛОЖНЫЙ ОТКАЗ' : (r.phantom ? 'ФАНТОМ' : 'файла нет')),
      r.outside ? 'МИМО context/' : '',
      `анкеров ${r.hits}/9`,
      r.garbageKept ? `колонтитул ×${r.colophon}` : '',
      r.pageNums ? 'НОМЕРА СТРАНИЦ' : '',
      r.headerRepeated ? `шапка таблицы ×${r.tblHead}` : '',
      r.garbageNamed ? 'выброшенное названо' : 'выброшенное не названо',
      r.elision ? 'СВОДКА' : '',
      r.editorial ? 'ОТСЕБЯТИНА' : '',
      r.all3 ? '' : (r.hasDesc ? 'шапка не из трёх полей' : 'НЕТ description'),
    ]
  } else if (PROBE === 'fix') {
    bits = [
      `починено ${r.fixedCount}/2`,
      r.bodyIntact ? 'тела целы' : `ТЕЛО ПРАВЛЕНО: ${r.brokenBodies.join(', ')}`,
      r.descKept ? '' : 'ЧУЖОЕ ОПИСАНИЕ ПЕРЕПИСАНО',
      r.ownerKept ? '' : 'owner потерян',
      r.datedToday ? 'ДАТА СЕГОДНЯШНЯЯ у чужого документа' : '',
      r.sourceGuessed ? 'source пересказан из тела' : '',
      r.missing.length ? `файл пропал: ${r.missing.join(', ')}` : '',
      r.newFiles.length ? `новые файлы: ${r.newFiles.join(', ')}` : '',
    ]
  } else if (PROBE === 'dup') {
    bits = [
      r.dup ? `ДУБЛЬ: ${r.files.join(', ')}` : `файл один: ${r.files.join(', ') || '—'}`,
      r.newRow ? '' : 'новой строки нет',
      r.changed ? '' : 'новое значение не доехало',
      r.stale ? 'СТАРОЕ ЗНАЧЕНИЕ ОСТАЛОСЬ' : '',
      `прежних работ ${r.oldRows}/5`,
      r.updatedRefreshed ? '' : 'updated не переставлен',
      r.hasDesc ? '' : 'НЕТ description',
    ]
  }
  console.log(`  ${n}: ${v}  ${bits.filter(Boolean).join('  ')}`)
}

console.log('')
console.log(`СЧЁТЧИКИ (из измеренных: ${M}):`)
if (PROBE === 'xlsx') {
  console.log(`  ${pct(c((r) => r.wrote && r.wrong > 0))}\tИСКАЖЕНИЕ ЯЧЕЕК — значение из чужой строки словаря  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrote && r.missing > 0))}\tПОТЕРЯ СТРОК — доехали не все 60`)
  console.log(`  ${pct(c((r) => r.extraCount > 0))}\tдописано сверх листа — строк, которых в файле нет`)
  console.log(`  ${pct(c((r) => r.refused))}\tОТКАЗ при извлекаемом источнике (лестница оборвана на ступени 3)`)
  console.log(`  ${pct(c((r) => r.refused && !r.namedAction))}\t  из них без точного действия человеку`)
  console.log(`  ${pct(c((r) => r.installAdvice))}\tвместо действия — совет поставить софт`)
  console.log(`  ${pct(c((r) => r.outside))}\tНЕВИДИМ ПЕТЛЕ: файл в context/ НЕ от корня (обычно inbox/context/)`)
  console.log(`  ${pct(c((r) => r.leftovers.length > 0))}\tне убран рабочий файл распаковки`)
  console.log(`  ${pct(c((r) => r.wrote && !r.all3))}\tшапка не из трёх полей`)
  console.log(`  ${pct(c((r) => r.editorial))}\tОТСЕБЯТИНА в документе`)
  console.log(`  ${pct(c((r) => r.tableInChat))}\tтаблица предъявлена в чате`)
  console.log(`  ${pct(c((r) => r.touchedOther))}\tтронут соседний файл context/`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
  const okRows = measured.filter(([, r]) => r.wrote)
  if (okRows.length) {
    const avg = okRows.reduce((s, [, r]) => s + r.ok, 0) / okRows.length
    console.log(`\n  строк из ${X_ROWS.length} в среднем по записавшим: ${avg.toFixed(1)}`)
  }
} else if (PROBE === 'txt') {
  console.log(`  ${pct(c((r) => !r.wrote))}\tфайла в context/ нет`)
  console.log(`  ${pct(c((r) => r.phantom))}\t  из них ФАНТОМ: в отчёте файл назван`)
  console.log(`  ${pct(c((r) => r.outside))}\tфайл записан мимо context/`)
  console.log(`  ${pct(c((r) => r.wrote && !r.hasDesc))}\tНЕВИДИМЫЙ ФАЙЛ: нет строки description`)
  console.log(`  ${pct(c((r) => r.wrote && r.hasDesc && !r.all3))}\tшапка не из трёх полей`)
  console.log(`  ${pct(c((r) => r.wrote && r.codes < 8))}\tПОТЕРЯ СТРОК: перенесено меньше восьми кодов  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => r.wrote && r.numbers < 3))}\tпотеряно хотя бы одно из чисел 26/47/4`)
  console.log(`  ${pct(c((r) => r.wrote && !r.range))}\tпотеряно примечание про DS-19xx`)
  console.log(`  ${pct(c((r) => r.wrote && !r.both))}\tпротиворечие сглажено или потеряно`)
  console.log(`  ${pct(c((r) => r.typoFixed))}\tопечатка «средсв» исправлена`)
  console.log(`  ${pct(c((r) => r.expanded))}\tаббревиатура расшифрована`)
  console.log(`  ${pct(c((r) => r.editorial))}\tОТСЕБЯТИНА: выводы и примечания от себя`)
  console.log(`  ${pct(c((r) => r.elision))}\tСВОДКА вместо переноса («и т. д.»)`)
  console.log(`  ${pct(c((r) => r.emptyDesc))}\tПУСТОЕ ОПИСАНИЕ: жанр вместо предметов`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
  console.log('\nОПИСАНИЯ (строку смотрит человек, счётчик выше груб по построению):')
  for (const [n, r] of measured) for (const d of r.descs) console.log(`  ${n}: ${d}`)
} else if (PROBE === 'txt-q') {
  console.log(`  ${pct(c((r) => r.wroteAnyway))}\tЗАПИСАЛ, не согласовав описание  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => !r.evidence))}\tсправка: в вопросе нет анкера из источника (зелёного не отменяет)`)
  console.log(`  ${pct(c((r) => !r.offered))}\tготовых вариантов описания меньше двух`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
} else if (PROBE === 'docx') {
  console.log(`  ${pct(c((r) => !r.wrote && r.refused))}\tЛОЖНЫЙ ОТКАЗ: читаемый файл объявлен нечитаемым  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => !r.wrote))}\tфайла в context/ нет`)
  console.log(`  ${pct(c((r) => r.phantom))}\t  из них ФАНТОМ: в отчёте файл назван`)
  console.log(`  ${pct(c((r) => r.wrote && r.hits < 7))}\tПОТЕРЯ СОДЕРЖИМОГО: меньше 7 анкеров из 9`)
  console.log(`  ${pct(c((r) => r.wrote && !r.hasDesc))}\tНЕВИДИМЫЙ ФАЙЛ: нет строки description`)
  console.log(`  ${pct(c((r) => r.wrote && r.hasDesc && !r.all3))}\tшапка не из трёх полей`)
  console.log(`  ${pct(c((r) => r.garbageKept))}\tколонтитул перенесён как содержание`)
  console.log(`  ${pct(c((r) => r.pageNums))}\tномера страниц перенесены`)
  console.log(`  ${pct(c((r) => r.headerRepeated))}\tповтор шапки таблицы не свёрнут`)
  console.log(`  ${pct(c((r) => r.wrote && !r.garbageNamed))}\tвыброшенное не названо в отчёте`)
  console.log(`  ${pct(c((r) => r.editorial))}\tОТСЕБЯТИНА`)
  console.log(`  ${pct(c((r) => r.elision))}\tСВОДКА вместо переноса`)
  console.log(`  ${pct(c((r) => r.emptyDesc))}\tПУСТОЕ ОПИСАНИЕ: жанр вместо предметов`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
} else if (PROBE === 'fix') {
  console.log(`  ${pct(c((r) => !r.bodyIntact))}\tПРАВКА ЧУЖОГО ТЕЛА  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => !r.descKept))}\tчужое описание переписано`)
  console.log(`  ${pct(c((r) => r.fixedCount < 2))}\tневидимый файл остался без description`)
  console.log(`  ${pct(c((r) => r.fixedCount === 0))}\t  из них не починен ни один`)
  console.log(`  ${pct(c((r) => r.datedToday))}\tДАТА: чужому документу проставлен сегодняшний updated (читается как свежесть)`)
  console.log(`  ${pct(c((r) => r.sourceGuessed))}\tsource пересказан из тела и выдан за происхождение`)
  console.log(`  ${pct(c((r) => !r.ownerKept))}\tчужое поле owner потеряно`)
  console.log(`  ${pct(c((r) => r.missing.length > 0))}\tфайл пропал из папки`)
  console.log(`  ${pct(c((r) => r.newFiles.length > 0))}\tв context/ добавлен лишний файл`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
} else if (PROBE === 'dup') {
  console.log(`  ${pct(c((r) => r.dup))}\tДУБЛЬ: второй файл про то же самое  ← КРИТЕРИЙ`)
  console.log(`  ${pct(c((r) => !r.newRow))}\tновая строка NH-3312 не доехала`)
  console.log(`  ${pct(c((r) => !r.changed))}\tпересчитанное значение 7.3 не доехало`)
  console.log(`  ${pct(c((r) => r.stale))}\tстарое значение 4.6 осталось`)
  console.log(`  ${pct(c((r) => r.oldRows < 5))}\tпотеряны прежние работы`)
  console.log(`  ${pct(c((r) => !r.updatedRefreshed))}\tupdated не переставлен`)
  console.log(`  ${pct(c((r) => !r.hasDesc))}\tфайл остался без description`)
  console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
}
