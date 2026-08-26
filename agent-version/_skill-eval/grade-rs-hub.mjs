// grade-rs-hub.mjs — проба `rs-hub`: `repo-split` на ОДНОМ приложении со звёздной связностью
// и контрактом вне кода.
//
//   node grade-rs-hub.mjs <папка-раунда>
//
// ГРЕЙДИТСЯ ОТЧЁТ, а не файл: `repo-split` карточек не пишет, его выход — предложение швов и числа.
// Манифест он трогает только после «да», а отвечать на стенде некому, поэтому исход прогона — текст.
//
// Чем эта проба отличается от `rs-real`. Там обе репы решались границами приложений: `repairy` —
// монорепа из четырёх, `resonance` — мелкая. Путь «одно приложение перевалило порог → режем его
// по связности пакетов» не исполнялся ни разу за десять циклов. RS-HUB кладёт скилл ровно на него
// и добавляет три ловушки из полевого лога: контракт вне кода, звезда вместо кластеров,
// событие-топик против класса-обработчика. Правда — в `fixtures/RS-HUB/expected.md`.
//
// СЕМЬ КРАСНЫХ СЧЁТЧИКОВ. Критерий, которого нет в грейдере, молча считается выполненным, — это
// уже стоило серии c1–c6 в прошлом раунде, поэтому здесь мерится и качество разреза, и молчание
// о топологии, и археология.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'opscore'
// Правда фикстуры. Классы даны корнем слова: скилл склоняет их как хочет.
const TRUTH = { 'эндпоинт': 118, 'событи': 20, 'задач': 11, 'сущност': 91 }
// Наивные маркеры дают вот это — если в отчёте стоит такое число, ловушка сработала.
const TRAP = { 'эндпоинт': 14, 'событи': 11 }
const CLS = ['эндпоинты', 'события', 'задачи', 'сущности', 'экраны', 'вызовы', 'состояние', 'экспорты']

// Три периферийных кластера: у каждого внутри десятки связей, к хабу — единицы. Это единственные
// слабые швы в репе, и найти их — главное содержание верного разреза.
const CLUSTERS = [
  { name: 'A', pkgs: ['billing', 'invoice', 'tariff'] },
  { name: 'B', pkgs: ['report', 'analytic'] },
  { name: 'C', pkgs: ['notify', 'template'] },
]
// Имя куска, означающее разрез по слоям, а не по доменам.
const MAXP = 6   // больше — ядро раздроблено
// `core` в списке НЕТ намеренно: ядро звезды — законный кусок, и назвать его `-core` не грех.
// Слоем его делает СОСТАВ (сквозные папки внутри), а это отдельный счётчик ниже.
const LAYER = /(^|[-_ ])(shared|common|infra|infrastructure|domains?|layer|utils?|base|platform|kernel|misc)([-_ ]|$)/i

// --- разбор таблицы классов ----------------------------------------------------------
// Против grade-rs-real.mjs здесь две добавки, обе по факту первого же прогона:
//   1. РАЗДЕЛИТЕЛЬ БЫВАЕТ ПСЕВДОГРАФИКОЙ. Прогон нарисовал таблицу рамкой `│` (U+2502), а не
//      ascii-палкой, и парсер увидел одну ячейку вместо восьми. Числа были верные — 104 и 91, —
//      а грейдер показал «нет». Ложное красное так же вредно, как ложное зелёное: по нему правят
//      то, что работает.
//   2. ПОДПИСИ У СТРОКИ С ЧИСЛАМИ МОЖЕТ НЕ БЫТЬ. «по всей репе» стоит шапкой НАД именами классов,
//      а сама числовая строка идёт без подписи. Тогда берём первую чисто числовую строку после
//      заголовка — но только если подпись нашлась поблизости сверху.
const BAR = /[|│┃┆┊╎]/g
function table(a) {
  const lines = a.split('\n')
  const norm = (l) => l.replace(BAR, '|')
  const cell = (l) => norm(l).trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/\s*\|\s*|\s{2,}/).map((c) => c.replace(/\*/g, '').trim())
  const head = (l) => {
    const a2 = cell(l).map((x) => x.toLowerCase())
    if (a2.filter((x) => CLS.includes(x)).length >= 3) return a2
    const b = norm(l).trim().toLowerCase().split(/[\s|]+/).filter(Boolean)
    return b.filter((x) => CLS.includes(x)).length >= 3 ? b : null
  }
  let hdr = -1, cols = []
  for (let i = 0; i < lines.length; i++) {
    const c = head(lines[i])
    if (c) { hdr = i; cols = c; break }
  }
  if (hdr < 0) return null
  const clsCols = cols.filter((x) => CLS.includes(x))
  const pack = (nums) => {
    const o = {}
    clsCols.forEach((name, j) => { o[name] = /^\d+$/.test(nums[j] ?? '') ? +nums[j] : null })
    return o
  }
  const row = (label) => {
    for (let i = hdr + 1; i < Math.min(hdr + 8, lines.length); i++) {
      const c = cell(lines[i])
      if (!c[0] || !c[0].toLowerCase().includes(label)) continue
      return pack(c.filter((x) => /^(\d+|—|-)$/.test(x)))
    }
    // Подписи нет — ищем её над заголовком, а числа берём первой числовой строкой под ним.
    const above = lines.slice(Math.max(0, hdr - 4), hdr).some((l) => l.toLowerCase().includes(label))
    if (!above) return null
    for (let i = hdr + 1; i < Math.min(hdr + 6, lines.length); i++) {
      const c = cell(lines[i]).filter(Boolean)
      const nums = c.filter((x) => /^(\d+|—|-)$/.test(x))
      if (nums.length >= 3 && nums.length === c.length) return pack(nums)
    }
    return null
  }
  return { whole: row('по всей репе'), parts: row('по кускам') }
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const num = (t, re) => { const m = t.match(re); return m ? parseInt(m[1], 10) : null }
const near = (v, n) => v !== null && v !== undefined && Math.abs(v - n) <= Math.max(2, n * 0.3)

function grade(dir, label) {
  const a = read(join(dir, 'answer.md'))
  if (!a) { console.log(`${label}: ответа нет — НЕ ИЗМЕРЕНО`); return null }
  const low = a.toLowerCase()
  const lines = a.split('\n')

  // 1. КЛАССЫ. Точность у скилла греповая — он это объявляет сам, — поэтому ±30 %, но не меньше 2.
  const T = table(a)
  const lost = []
  const trapped = []
  for (const [cls, n] of Object.entries(TRUTH)) {
    const col = CLS.find((c) => c.startsWith(cls))
    let v = T && T.whole ? T.whole[col] : null
    if (v === null || v === undefined) {
      // Таблицы нет либо колонка пустая — ищем число рядом с именем класса в тексте.
      const before = [...a.matchAll(new RegExp('(\\d+)\\s*' + cls, 'gi'))].map((m) => +m[1])
      const after = [...a.matchAll(new RegExp(cls + '[^\\d\\n]{0,40}?(\\d+)', 'gi'))].map((m) => +m[1])
      const cand = before.concat(after)
      v = cand.find((x) => near(x, n)) ?? cand.find((x) => TRAP[cls] && Math.abs(x - TRAP[cls]) <= 2) ?? cand[0] ?? null
    }
    if (near(v, n)) continue
    lost.push(`${cls} ~${n} (в отчёте: ${v ?? 'нет'})`)
    if (TRAP[cls] && v !== null && Math.abs(v - TRAP[cls]) <= 2) trapped.push(`${cls}: ${v} — наивный маркер`)
  }

  // 2. ХАБ. Мало назвать пакет: топология обязана быть названа ЧИСЛОМ, иначе «границы по слабым
  //    связям» внутри ядра проведены по живому и человек об этом не узнает.
  //    Число обязано быть про СВЯЗИ, а не про что попало. Первый прогон назвал `shipment`
  //    «центральным доменом (360 файлов, 26 % всей репы)» — и это не измерение топологии:
  //    матрицы импортов он не считал вовсе, а доля файлов о швах не говорит ничего.
  const hubWord = /(хаб|hub|звезд|звёзд|центральн|центр\s+граф|узел\s+граф|через\s+(пакет|узел|него)|степень\s+связн|доля\s+(ссылок|рёбер|ребер))/i
  const linkWord = /(ссыл|связ|импорт|рёбер|ребер|зависимост)/i
  const hubNamed = /shipment/i.test(a)
  const hubLine = lines.some((l) => {
    if (!/shipment/i.test(l) && !hubWord.test(l)) return false
    if (!linkWord.test(l)) return false
    return [...l.matchAll(/(\d+)/g)].map((m) => +m[1]).some((x) => x >= 40)
  })
  const hubOk = hubNamed && hubWord.test(a) && hubLine

  // 3. СЛОЙ КУСКОМ. Имена кусков вида `<репа>-<что-то>`; форма отчёта у прогонов разная, а имена
  //    есть всегда.
  const pieceNames = [...new Set([...a.matchAll(new RegExp('\\b' + REPO + '-[a-zа-яё][\\w-]*', 'gi'))]
    .map((m) => m[0].toLowerCase()))].sort()
  const layered = pieceNames.filter((p) => LAYER.test(p.slice(REPO.length + 1)))

  // 3b. ЯДРО ОДНИМ КУСКОМ. Верный разрез — три периферийные группы плюс ядро: 4–5 кусков.
  //     «30 кусков по доменам» и «8 логических групп» одинаково означают раздробленное ядро:
  //     каждая граница внутри него режет десятки ссылок. Считаем по числу, которое прогон назвал
  //     САМ, — имена кусков он перечисляет не все («opscore-address, …, opscore-waybill»).
  const declared = lines.filter((l) => /вариант/i.test(l))
    .flatMap((l) => [...l.matchAll(/(\d+)\s*[–—-]?\s*\d*\s*куск/gi)].map((m) => +m[1]))
  const pieceCount = declared.length ? Math.min(...declared) : pieceNames.length
  const shredded = pieceCount > MAXP ? pieceCount : 0

  // 4. ПЕРИФЕРИЯ. Кластер засчитан, если он узнаётся ЛИБО в имени куска, ЛИБО строкой состава:
  //    прогон вправе назвать кусок `opscore-finance`, если в его папках стоят billing и invoice.
  const missed = CLUSTERS.filter((c) => {
    const byName = pieceNames.some((p) => c.pkgs.some((k) => p.includes(k)))
    const byRow = lines.some((l) => c.pkgs.filter((k) => l.toLowerCase().includes(k)).length >= 2)
    return !(byName || byRow)
  }).map((c) => c.name + ' (' + c.pkgs.join(',') + ')')

  // 5. ВЕРДИКТ. Репа втрое над порогом по файлам — разрез обязан быть предъявлен. Отказ и
  //    «спросил и замолчал» здесь красные: слабые швы в репе есть.
  const proposed = pieceNames.length >= 2
  const refused = /(разрез|резать|разделени)[^\n]{0,40}(не нуж|не требу|не на|излиш)/i.test(a)

  // 6. ПОТЕРЯ ПРИ РАЗРЕЗЕ. Класс посчитан по репе, но не доехал ни в один кусок.
  const dropped = []
  if (T && T.whole && T.parts) {
    for (const c of CLS) {
      const w = T.whole[c], q = T.parts[c]
      if (typeof w === 'number' && typeof q === 'number' && w > 0 && q !== w) dropped.push(`${c}: по репе ${w}, по кускам ${q}`)
    }
  }

  // 7. АРХЕОЛОГИЯ. В репе лежит приманка: README с номером релиза и `history.txt`. Скилл читает
  //    чужую репу и не судит о её жизненном цикле — ни признака, ни права у него нет.
  const digArchive = /(из эксплуатац|активно (развива|поддержива)|не (устарел|заброшен))|release\/\d|01\.087|history\.txt|git log/i
  const dig = digArchive.test(a)

  // 8. ЧИСЛА ПО КУСКАМ ПРИКИНУТЫ, А НЕ ПОСЧИТАНЫ. Полевой лог 2026-08-25: каждая строка варианта —
  //    «~170 файлов, ~55 endpoint, ~35 entity». Тильда выглядит честной оговоркой о греповой
  //    точности, но греповая точность — это «аннотация в комментарии», а не «по этой папке я не
  //    считал». Прикинутое число нельзя сложить: там же сумма сущностей по кускам вышла 144 при 82
  //    по репе — вдвое больше, чем в репе есть, и разрез строился на этом.
  const pieceRe = new RegExp(REPO + '-[a-zа-яё]', 'i')
  const estimated = lines.filter((l) => pieceRe.test(l)).some((l) => /~\s*\d+/.test(l)) ||
    /прикидочн|ориентировочн|примерно \d+/i.test(a)

  // 9. СВЕРКА ДЕЛЕГИРОВАНА. «Эту проверку человек должен пересчитать по карточкам service-map» —
  //    единственное независимое число петли отдано тому, кого оно и должно было проверять.
  const delegated = /(человек|аналитик)[^\n]{0,40}(пересчита|перепрове|уточни)|уточня[а-я]*\s+(на сводке|позже|потом)|(проверит|уточнит|пересчита[а-я]*)[^\n]{0,30}service-map/i.test(a)

  // 10. СКВОЗНАЯ ПАПКА В КУСКЕ. Прогон c3 положил common+constants+exceptions+configurations
  //     внутрь ядра и тут же написал «сквозные: нет». Ключи сквозных размажутся по чужой
  //     карточке, а строка «сквозные» перестаёт что-либо значить.
  const CROSS = ["common", "constants", "exceptions", "configurations"]
  const crossInPiece = lines.some((l) => pieceRe.test(l) &&
    CROSS.filter((c) => l.toLowerCase().includes(c)).length >= 2)
  const whole = num(a, /по всей репе\s+(\d+)/i)
  const byParts = num(a, /по кускам\s+(\d+)/i)

  // 11. ПРОГОН НЕ ДОШЁЛ. Ни кусков, ни таблицы классов — измерять в нём нечего, а три счётчика
  //     (классы, периферия, хаб) он раздувает разом, изображая провал норм там, где провалилась
  //     процедура. Считаем такой прогон ОДИН раз своим счётчиком и из остальных исключаем — так
  //     же, как стенд поступает с отказом API: «не измерено», а не «провалено».
  if (pieceNames.length === 0 && !(T && T.whole)) {
    console.log(`\n=== ${label} ===`)
    console.log('  ⚠ НЕ ДОШЁЛ: ни кусков, ни таблицы классов — из прочих счётчиков исключён')
    return { lost: 0, hub: 0, layer: 0, shred: 0, periph: 0, verdict: 0, dropped: 0, dig: 0, est: 0, deleg: 0, cross: 0, stall: 1 }
  }

  console.log(`\n=== ${label} ===`)
  console.log(`  классов сошлось:   ${4 - lost.length}/4`)
  if (lost.length) console.log(`  ⚠ НЕ СОШЛОСЬ:      ${lost.join(' · ')}`)
  if (trapped.length) console.log(`  ⚠ ЛОВУШКА:         ${trapped.join(' · ')}`)
  console.log(`  хаб назван числом: ${hubOk ? '✅' : '❌'}` +
    (hubOk ? '' : `  (пакет ${hubNamed ? 'назван' : 'НЕ назван'}, топология ${hubWord.test(a) ? 'названа' : 'НЕ названа'}, числа ${hubLine ? 'есть' : 'НЕТ'})`))
  console.log(`  куски (${pieceNames.length}):       ${pieceNames.join(' ') || '—'}`)
  console.log(`  ядро одним куском: ${shredded ? "❌ " + shredded + " кусков" : "✅ " + pieceCount}`)
  console.log(`  разрез по слоям:   ${layered.length ? '❌ ' + layered.join(', ') : '✅ нет'}`)
  console.log(`  периферия:         ${missed.length ? '❌ не отделено: ' + missed.join(' · ') : '✅ все 3 кластера'}`)
  console.log(`  вердикт:           ${proposed ? '✅ разрез предъявлен' : '❌ ' + (refused ? 'ОТКАЗ' : 'кусков нет')}`)
  console.log(`  своя сверка:       по всей репе ${whole ?? '—'}, по кускам ${byParts ?? '—'}`)
  if (dropped.length) console.log(`  ⚠ ПОТЕРЯНО ПРИ РАЗРЕЗЕ: ${dropped.join(' · ')}`)
  console.log(`  сквозные:          ${crossInPiece ? "❌ легли в кусок" : "✅ вне кусков"}`)
  console.log(`  числа по кускам:   ${estimated ? '❌ прикинуты (~N), не посчитаны' : '✅ посчитаны'}`)
  console.log(`  сверка:            ${delegated ? '❌ делегирована человеку/service-map' : '✅ своя'}`)
  console.log(`  археология:        ${dig ? '❌ судит о жизненном цикле / читал историю' : '✅ нет'}`)

  return {
    lost: lost.length, hub: hubOk ? 0 : 1, layer: layered.length ? 1 : 0, shred: shredded ? 1 : 0,
    periph: missed.length, verdict: proposed ? 0 : 1, dropped: dropped.length, dig: dig ? 1 : 0,
    est: estimated ? 1 : 0, deleg: delegated ? 1 : 0,
    cross: crossInPiece ? 1 : 0, stall: 0,
  }
}

const round = process.argv[2]
if (!round) { console.error('нужен путь к папке раунда'); process.exit(1) }
const sb = join(round, 'sandbox')
if (!existsSync(sb)) { console.error('песочниц нет'); process.exit(1) }

const tot = { lost: 0, hub: 0, layer: 0, shred: 0, periph: 0, verdict: 0, dropped: 0, dig: 0, est: 0, deleg: 0, cross: 0, stall: 0 }
let n = 0
for (const d of readdirSync(sb).sort()) {
  if (!d.startsWith(REPO + '-')) continue
  const r = grade(join(sb, d), d)
  if (r) { for (const k of Object.keys(tot)) tot[k] += r[k]; n++ }
}
const green = n > 0 && Object.values(tot).every((v) => v === 0)
console.log(`\n──────  ИТОГ по ${n} прогонам  ──────`)
console.log(`  классов не сошлось ${tot.lost} · хаб не назван ${tot.hub} · разрез по слоям ${tot.layer} · ядро раздроблено ${tot.shred} · периферия не отделена ${tot.periph}`)
console.log(`  вердиктов неверных ${tot.verdict} · сверка не сошлась ${tot.dropped} · археология ${tot.dig}`)
console.log(`  числа прикинуты ${tot.est} · сверка делегирована ${tot.deleg} · сквозные в куске ${tot.cross}`)
console.log(`  НЕ ДОШЛИ ${tot.stall} из ${n} (в прочих счётчиках не учтены)`)
console.log(green ? '  ЗЕЛЁНО' : '  КРАСНО')
