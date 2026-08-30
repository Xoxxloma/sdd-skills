#!/usr/bin/env node
// grade-nrs.mjs <папка-раунда> [фикстура] — грейдер `new-repo-split`.
//
// Меряется не «красивый ли разрез», а одиннадцать механических якорей. Правда — в `expected.md`
// соответствующей фикстуры; здесь продублированы только числа, по которым идёт сверка.
// Красный исход, ради которого заведён каждый счётчик, назван в комментарии у счётчика.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── правда по фикстурам ───────────────────────────────────────────────────────────────────────
// Одна таблица на все плечи: грейдер один, фикстура выбирается аргументом. Копия файла на каждую
// фикстуру расходится с оригиналом молча — правку якоря вносят в одну, а гоняют другую.
const FIXTURES = {
  'NRS-TAIL': {
    APP: 'cargonet',
    TRUTH: { 'эндпоинт': 139, 'событи': 18, 'задач': 9, 'сущност': 88 },
    TRAP: { 'эндпоинт': 186, 'событи': 6, 'сущност': 176 },
    ZERO: ['common', 'exceptions', 'constants', 'configuration', 'security', 'baseclass'],
    KEYED: ['consignment', 'tariffbook', 'crew', 'settlement', 'analytics', 'exchange', 'dispatcher'],
    OVERSIZE: 'exchange', PKGDIR: 'cargonet/src/main/java/ru/cargonet/v2',
  },
  'RS-HUB': {
    APP: 'opscore',
    TRUTH: { 'эндпоинт': 118, 'событи': 20, 'задач': 11, 'сущност': 91 },
    TRAP: { 'эндпоинт': 14, 'событи': 11 },
    ZERO: ['common', 'exceptions', 'constants', 'configurations', 'integration'],
    KEYED: ['shipment', 'billing', 'invoice', 'tariff', 'report', 'analytics', 'notify', 'template'],
    // Ядро звезды: `shipment` с приросшими к нему пакетами не влезает в скан ни при каком делении.
    OVERSIZE: 'shipment', PKGDIR: 'opscore/src/main/java/ru/opscore/v2',
  },
}

const round = process.argv[2]
const FIX = process.argv[3] || 'NRS-TAIL'
if (!round) { console.log('usage: node grade-nrs.mjs <папка-раунда> [NRS-TAIL|RS-HUB]'); process.exit(1) }
const CF = FIXTURES[FIX]
if (!CF) { console.log(`нет такой фикстуры: ${FIX}`); process.exit(1) }
const { APP, TRUTH, TRAP, ZERO, KEYED, OVERSIZE, PKGDIR } = CF

// Список пакетов берётся ИЗ ФИКСТУРЫ, а не переписывается в грейдер руками: переписанный список
// расходится с генератором молча, и грейдер начинает мерить репу, которой нет.
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const pkgRoot = join(HERE, 'fixtures', FIX, 'out', PKGDIR)
const PKGS = existsSync(pkgRoot)
  ? readdirSync(pkgRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name.toLowerCase())
  : [...new Set(ZERO.concat(KEYED))]
if (!existsSync(pkgRoot)) console.log(`⚠ пакетов фикстуры не нашёл (${pkgRoot}) — сверяюсь по короткому списку`)

// Имена, которыми называют склеенное «всё остальное». Спица с таким именем — группировка по
// смыслу: её `description` не пишется, и по нему потом не попадут грепом.
const BUCKET = /(^|[-_])(прочее|остальное|other|misc|rest|content|common|shared|core|infra|infrastructure|domains?|utils?|base|platform)([-_]|$)/i
const CLS = ['эндпоинты', 'события', 'задачи', 'сущности', 'экраны', 'вызовы', 'состояние', 'экспорты']
const BAR = /[|│┃┆┊╎]/g

// ── разбор таблицы «по приложению / по спицам» ────────────────────────────────────────────────
// Форма отчёта у прогонов разная: markdown-таблица, псевдографика, столбик пробелами. Ищем
// заголовок с именами классов и две строки под ним.
// Заголовок ищется НЕ первой строкой с двумя словами класса: в отчёте выше почти всегда стоит
// проза вида «104 эндпоинта … 91 сущность», и первая версия грейдера цеплялась за неё, а потом
// объявляла «прогон не дошёл» на ответе с полной таблицей. Заголовок — строка, в которой имён
// классов ТРИ и больше; строку данных ищем от неё вниз, а не от прозы.
function table(a) {
  const lines = a.split('\n')
  const clsCount = (l) => CLS.filter((c) => l.toLowerCase().includes(c.slice(0, 4))).length
  const heads = []
  for (let i = 0; i < lines.length; i++) if (clsCount(lines[i]) >= 3) heads.push(i)
  if (!heads.length) return null

  // Значение берётся по ПОЗИЦИИ КОЛОНКИ, а не по порядку чисел в строке. Прежняя версия
  // раскладывала числа подряд по списку классов — и на строке `по приложению 1354 14 0 11 91`
  // (первая колонка «файлов») сдвигалась на одну, объявляя неверными все четыре класса у верного
  // прогона. Колонок в таблицах прогонов бывает и «файлов», и «ВСЕГО», и они не классы.
  const cut = (l) => l.includes('|') ? l.split('|').map((s) => s.trim())
    : l.trim().split(/\s{2,}/).map((s) => s.trim()).filter((s) => s !== '')
  const num = (s) => (s === undefined ? undefined : /\d/.test(s) ? parseInt(s.replace(/[^\d]/g, ''), 10) : null)

  // Таблица, выровненная ПРОБЕЛАМИ, читается по символьной позиции колонки, а не по числу
  // разделителей: заголовок `эндпоинты события задачи сущности` разделён одинарными пробелами, и
  // разбиение по двойным склеивает его в одну ячейку — грейдер объявлял числа ненайденными у
  // прогона, который напечатал их все. Позиция же есть всегда.
  const byOffset = (hdr, label, stop) => {
    const H = lines[hdr]
    const pos = {}
    for (const c of CLS) {
      const i = H.toLowerCase().indexOf(c.slice(0, 4))
      if (i >= 0 && pos[c] === undefined) pos[c] = i
    }
    if (Object.keys(pos).length < 3) return null
    for (let i = hdr + 1; i < stop; i++) {
      if (!lines[i].toLowerCase().includes(label)) continue
      const toks = [...lines[i].matchAll(/\S+/g)].map((m) => ({ v: m[0], at: m.index }))
        .filter((t) => /^[~]?\d+[*]?$|^[—\-–]$/.test(t.v))
      if (toks.length < 3) continue
      const out = {}
      for (const [k, p] of Object.entries(pos)) {
        // Ближайший по левому краю токен: колонки печатают то по левому краю, то по правому.
        let best = null, d = 1e9
        for (const t of toks) { const dd = Math.min(Math.abs(t.at - p), Math.abs(t.at + t.v.length - (p + 6))); if (dd < d) { d = dd; best = t } }
        out[k] = best && d <= 8 ? num(best.v) : undefined
      }
      if (Object.values(out).some((v) => typeof v === 'number')) return out
    }
    return null
  }

  const rowAt = (hdr, label) => {
    const H = cut(lines[hdr])
    // Позиция каждого класса среди ВСЕХ колонок заголовка, включая «файлов» и «ВСЕГО».
    const pos = {}
    H.forEach((c, i) => { const k = CLS.find((x) => c.toLowerCase().startsWith(x.slice(0, 4))); if (k && pos[k] === undefined) pos[k] = i })
    if (Object.keys(pos).length < 2) return null
    // Окно — до СЛЕДУЮЩЕГО заголовка, а не десять строк: между шапкой таблицы и строкой «по
    // приложению» прогон печатает раскладку по доменам, и на тридцати пяти доменах итог уезжает
    // далеко вниз. Узкое окно объявляло числа ненайденными у прогона, который их напечатал.
    const stop = heads.find((h) => h > hdr) ?? lines.length
    for (let i = hdr + 1; i < stop; i++) {
      if (!lines[i].toLowerCase().includes(label)) continue
      const D = cut(lines[i])
      // Строка данных короче заголовка на подпись — выравниваем по хвосту, если длины разошлись.
      const off = D.length === H.length ? 0 : D.length - H.length
      const out = {}
      let got = 0
      for (const [k, p] of Object.entries(pos)) {
        const v = num(D[p + off])
        out[k] = v
        if (typeof v === 'number') got++
      }
      if (!got) continue
      return out
    }
    return null
  }
  const find = (...labels) => {
    for (const h of heads) {
      const stop = heads.find((x) => x > h) ?? lines.length
      for (const l of labels) { const r = rowAt(h, l) || byOffset(h, l, stop); if (r) return r }
    }
    return null
  }
  return { whole: find('по приложению', 'по репе', 'всего'), parts: find('по спицам', 'по кускам') }
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const near = (v, n) => v !== null && v !== undefined && Math.abs(v - n) <= Math.max(2, n * 0.3)

function grade(dir, label) {
  const a = read(join(dir, 'answer.md'))
  if (!a) { console.log(`${label}: ответа нет — НЕ ИЗМЕРЕНО`); return null }
  const lines = a.split('\n')
  const T = table(a)

  // Имена спиц и шапки берутся СПИСКОМ РЕАЛЬНЫХ ПАКЕТОВ фикстуры, а не догадкой по форме строки.
  // Две прежние версии врали именно здесь: первая знала только форму `opscore-billing` и насчитала
  // ноль спиц там, где их было 29; вторая выхватывала первое слово строки и объявила спицей слово
  // «prefix» из соседнего абзаца. Пакеты известны — сверяться надо с ними.
  // Секции НЕ ищутся по словам-заголовкам «ШАПКА»/«СПИЦЫ»: прогоны пишут свободно — «рекомендую
  // заменить path у строки opscore», «два кандидата на спицы». Прежняя версия на таком ответе
  // цеплялась за слово «шапки» в последнем абзаце и объявляла пять пакетов шапки спицами, хотя
  // прогон был верным. Признак шапки уникален и не зависит от формулировки: только её `path`
  // содержит манифест сборки и папку ресурсов.
  const has = (hay, p) => new RegExp('(^|[^a-z0-9_-])' + p + '([^a-z0-9_-]|$)').test(hay)
  const hubLines = lines.filter((l) => /pom\.xml|package\.json|build\.gradle|go\.mod|\/resources|\/config\b/i.test(l))
  const hubBlock = hubLines.join('\n').toLowerCase()
  const inHub = (p) => has(hubBlock, p)

  // Спицы — пакеты, названные в строках, где прогон говорит про спицы, минус срез шапки.
  // Нет ни одной такой строки — падаем на имена строк манифеста вида `opscore-billing`.
  const spokeLines = lines.filter((l) => /спиц/i.test(l))
  const spokeBlock = (spokeLines.length ? spokeLines.join('\n') : a).toLowerCase()
  const byName = [...new Set([...a.matchAll(new RegExp('\\b' + APP + '-([a-zа-яё][\\w-]*)', 'gi'))].map((m) => m[1].toLowerCase()))]
  const spokeNames = [...new Set(
    PKGS.filter((p) => !inHub(p) && has(spokeBlock, p)).concat(byName.filter((p) => !inHub(p)))
  )].sort()

  // 1. ШАПКА. Без строки на приложение целиком зеркала входящих рёбер зеркалить некуда: сосед
  //    пишет имя деплоя, `service-map` его не находит и пропускает строку молча и законно.
  const hubNamed = /шапк/i.test(a) && lines.some((l) => /шапк/i.test(l) || new RegExp(APP + '\\b(?!-)', 'i').test(l))

  // 2. ШАПКА СЪЕЛА ДОМЕН. Пакет с ключами в её `path` уносит туда свои ключи — и они исчезают из
  //    спицы, где им место, а карточка приложения набирает чужой контракт.
  const hubAte = KEYED.filter((p) => inHub(p))

  // 3. ШАПКА = КОРЕНЬ РЕПЫ. Даёт отказ субагента на первом же скане — ровно тот, ради которого
  //    всё и делается.
  const hubIsRoot = new RegExp('path[^\\n]{0,14}\\.\\./' + APP + '\\s*(,|$)', 'im').test(a)

  // 4. СПИЦ СЛИШКОМ МАЛО либо СЛИШКОМ МНОГО. Меньше трёх — перенос проблемы. Больше двенадцати
  //    при почти равных ключах — непройденное условие самостоятельности: тридцать пакетов по
  //    три сущности объявлены доменами, и человек получил тридцать карточек на один сервис.
  const few = spokeNames.length < 3 ? 1 : 0
  const many = spokeNames.length > 12 ? spokeNames.length : 0

  // 5. СВАЛОЧНАЯ СПИЦА или склейка ≥4 папок без числа связности.
  const bucketNamed = spokeNames.filter((s) => BUCKET.test(s))
  const glued = lines.filter((l) => new RegExp(APP + '-[a-zа-яё]', 'i').test(l))
    .filter((l) => {
      const pkgs = (l.match(/\bv2\/[a-z]+/gi) || []).length + (l.match(/,\s*[a-z]{4,}/gi) || []).length
      return pkgs >= 4 && !/\d+\s*(ссыл|связ|импорт)/i.test(l)
    })

  // 6. НУЛЕВОЙ ПАКЕТ СТАЛ СПИЦЕЙ. Карточка по нему выйдет безупречной по форме и пустой.
  const zeroAsSpoke = ZERO.filter((z) => spokeNames.includes(z))

  // 7. СТРОКА ПОКРЫТИЯ с двумя числами. Без неё вопрос «чего в слепке нет» не имеет ответа.
  //    Строка про папки с НУЛЁМ ключей в счёт не идёт: они в шапке, терять там нечего.
  const coverage = lines.some((l) => /не\s+описан|не\s+покрыт|без\s+спиц/i.test(l) &&
    (l.match(/\d+/g) || []).length >= 2 && !ZERO.some((z) => l.toLowerCase().includes(z)))

  // 8. КЛАССЫ. Точность греповая — ±30 %, но не меньше 2. Попадание в TRAP — отдельный диагноз:
  //    118 против 14 значит «контракт вне кода не найден», 20 против 11 — «событие сочтено классом».
  const lost = []
  const trapped = []
  for (const [cls, n] of Object.entries(TRUTH)) {
    const col = CLS.find((c) => c.startsWith(cls.slice(0, 6)))
    let v = T && T.whole ? T.whole[col] : null
    if (v === null || v === undefined) {
      const cand = [...a.matchAll(new RegExp('(\\d+)[^\\d\\n]{0,20}' + cls, 'gi'))].map((m) => +m[1])
        .concat([...a.matchAll(new RegExp(cls + '[^\\d\\n]{0,40}?(\\d+)', 'gi'))].map((m) => +m[1]))
      v = cand.find((x) => near(x, n)) ?? cand.find((x) => TRAP[cls] && Math.abs(x - TRAP[cls]) <= 3) ?? cand[0] ?? null
    }
    if (near(v, n)) continue
    lost.push(`${cls} ~${n} (в отчёте: ${v ?? 'нет'})`)
    if (TRAP[cls] && v !== null && Math.abs(v - TRAP[cls]) <= 3) trapped.push(`${cls}: ${v} — наивный маркер`)
  }

  // 9. ПАКЕТ ЗА ПОРОГОМ. Его нельзя выдать за строку, которая прочитается: субагент вернёт отказ.
  const overNamed = lines.some((l) => new RegExp(OVERSIZE, 'i').test(l) &&
    /порог|5\d\d|\d{3,}\s*файл|не (влез|берётся|вытян)|слишком|одним сканом/i.test(l))

  // 10. ТИЛЬДА В ЧИСЛАХ. `~86 эндпоинтов` нельзя сложить, и сверка на нём сойдётся с чем угодно.
  const tilde = /~\s*\d+/.test(a) ? 1 : 0

  // 11. МАНИФЕСТ ТРОНУТ ДО «ДА». Вопросов задать некому — значит записи быть не должно.
  const mfPaths = ['w/AI-SDD/services/manifest.yaml', 'w/specs/services/manifest.yaml']
  const mf = mfPaths.map((p) => read(join(dir, p))).find((x) => x) || ''
  const wrote = mf ? (mf.match(new RegExp(APP + '-', 'gi')) || []).length : 0

  if (spokeNames.length === 0 && !(T && T.whole)) {
    console.log(`\n=== ${label} ===\n  ПРОГОН НЕ ДОШЁЛ (ни спиц, ни таблицы) — в счёт норм не идёт`)
    return { stall: 1 }
  }

  const r = {
    hub: hubNamed ? 0 : 1, hubAte: hubAte.length, hubRoot: hubIsRoot ? 1 : 0,
    few, many: many ? 1 : 0, bucket: bucketNamed.length + glued.length, zero: zeroAsSpoke.length,
    cover: coverage ? 0 : 1, keys: lost.length, trap: trapped.length,
    over: overNamed ? 0 : 1, tilde, wrote: wrote > 0 ? 1 : 0, stall: 0,
  }

  console.log(`\n=== ${label} ===`)
  console.log(`  спиц ${spokeNames.length}: ${spokeNames.slice(0, 8).join(', ')}${spokeNames.length > 8 ? ' …' : ''}`)
  console.log(`  шапка: ${hubNamed ? 'есть' : '❌ НЕТ'}${hubIsRoot ? '  ❌ path = корень репы' : ''}${hubAte.length ? '  ❌ съела: ' + hubAte.join(',') : ''}`)
  if (few) console.log(`  ❌ спиц меньше трёх`)
  if (many) console.log(`  ❌ спиц ${many} — условие самостоятельности не проверялось`)
  if (bucketNamed.length) console.log(`  ❌ свалочная спица: ${bucketNamed.join(', ')}`)
  if (glued.length) console.log(`  ❌ склейка ≥4 папок без числа связей: ${glued.length}`)
  if (zeroAsSpoke.length) console.log(`  ❌ нулевой пакет стал спицей: ${zeroAsSpoke.join(', ')}`)
  console.log(`  покрытие: ${coverage ? 'названо' : '❌ строки нет'}`)
  console.log(`  ключи: ${lost.length ? '❌ ' + lost.join(' · ') : 'сошлись'}`)
  if (trapped.length) console.log(`  ❌ наивный маркер: ${trapped.join(' · ')}`)
  console.log(`  ${OVERSIZE} за порогом: ${overNamed ? 'назван' : '❌ не назван'}`)
  if (tilde) console.log(`  ❌ тильда в числах`)
  if (wrote) console.log(`  ❌ МАНИФЕСТ ТРОНУТ ДО «ДА»: ${wrote} строк`)
  return r
}

const sb = join(round, 'sandbox')
if (!existsSync(sb)) { console.log(`нет песочницы: ${sb}`); process.exit(1) }
const dirs = readdirSync(sb).filter((d) => d.startsWith(APP)).sort()
const tot = { hub: 0, hubAte: 0, hubRoot: 0, few: 0, many: 0, bucket: 0, zero: 0, cover: 0, keys: 0, trap: 0, over: 0, tilde: 0, wrote: 0, stall: 0 }
let n = 0
for (const d of dirs) {
  const r = grade(join(sb, d), d)
  if (!r) continue
  if (r.stall) { tot.stall++; continue }
  n++
  for (const k of Object.keys(tot)) if (k !== 'stall') tot[k] += r[k] || 0
}

console.log('\n' + '='.repeat(70))
console.log(`ФИКСТУРА ${FIX} — ИТОГО по ${n} прогонам${tot.stall ? ` (+${tot.stall} не дошли)` : ''}:`)
const NAMES = {
  hub: 'шапки нет', hubAte: 'шапка съела доменный пакет', hubRoot: 'path шапки = корень репы',
  few: 'спиц меньше трёх', many: 'спиц больше двенадцати', bucket: 'свалочная спица / склейка без числа',
  zero: 'нулевой пакет стал спицей', cover: 'строки покрытия нет', keys: 'класс посчитан неверно',
  trap: 'попал в наивный маркер', over: 'пакет за порогом не назван', tilde: 'тильда в числах',
  wrote: 'манифест тронут до «да»',
}
for (const [k, name] of Object.entries(NAMES)) console.log(`  ${String(tot[k]).padStart(3)}  ${name}`)
const red = Object.entries(tot).filter(([k]) => k !== 'stall').reduce((s, [, v]) => s + v, 0)
console.log(`\n  СУММА КРАСНОГО: ${red}   ${red === 0 && n > 0 ? '✅ ЗЕЛЁНЫЙ' : ''}`)
