// grade-rs-real.mjs — проба `rs-real`: `repo-split` на РЕАЛЬНОЙ репе, поданной монолитом.
//
//   node grade-rs-real.mjs <папка-раунда>
//
// ГРЕЙДИТСЯ ОТЧЁТ, а не файл: `repo-split` карточек не пишет, его выход — предложение швов и числа.
// Манифест он трогает только после «да», а отвечать на стенде некому, поэтому исход прогона — текст.
//
// ГЛАВНОЕ ЧИСЛО КРАСНОЕ: сколько классов ключей ПОТЕРЯНО. Потеря целого класса невидима для
// собственной сверки скилла — она считала один общий итог, и обе стороны недосчитывали одинаково:
// «по всей репе 155, по кускам 153, разница 2» сходилось при двадцати пропавших сущностях.
//
// ДВА СЛУЧАЯ, И ПУТАТЬ ИХ НЕЛЬЗЯ. `repairy` — монорепа из четырёх приложений, её резать надо.
// `resonance` — мелкая, и правильный исход для неё ОТКАЗ. Без второго сторожа правка, делающая
// скилл ретивее, выглядела бы улучшением: он резал бы всё подряд и всегда «находил» швы.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const KEY = {
  repairy: {
    mustSplit: true,
    // Классы даны корнем слова: скилл склоняет их как хочет.
    classes: { 'эндпоинт': 96, 'сущност': 20, 'задач': 1, 'экран': 24 },
    // Части репы, которые обязаны фигурировать: либо в шве, либо в сквозных. Молча пропасть
    // не может ни одна — приложение на четыре файла тоже кусок.
    parts: ['api', 'web', 'telegram', 'shared'],
    // КАЧЕСТВО РАЗРЕЗА. Монорепа поделена автором на четыре приложения, и правильный шов идёт по
    // ним. Каждое из них само берётся одним сканом, поэтому лезть внутрь незачем: пять кусков из
    // одного приложения — это не разрез, а дробление.
    maxPieces: 5,
  },
  resonance: {
    mustSplit: false,
    classes: { 'эндпоинт': 30, 'экран': 9 },
    parts: [],
  },
}

const CLS = ['эндпоинты','события','задачи','сущности','экраны','вызовы','состояние','экспорты']

// Скилл выдаёт таблицу с фиксированными колонками — и в markdown-форме, и в кодовом блоке.
// Разбираем её: заголовок опознаём по трём и более именам классов, строки — по подписи слева.
function table(a) {
  const lines = a.split('\n')
  // Ячейки: markdown-таблица режется по `|`, кодовый блок — по двум и более пробелам.
  const cell = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/\s*\|\s*|\s{2,}/).map((c) => c.replace(/\*/g, '').trim())
  // Заголовок бывает и через один пробел («эндпоинты события задачи …»), поэтому если резка по
  // двум пробелам не дала имён классов — режем по любому пробелу. Строки с числами так резать
  // нельзя: там подпись «по всей репе» сама содержит пробелы.
  const head = (l) => {
    const a = cell(l).map((x) => x.toLowerCase())
    if (a.filter((x) => CLS.includes(x)).length >= 3) return a
    const b = l.trim().toLowerCase().split(/[\s|]+/).filter(Boolean)
    return b.filter((x) => CLS.includes(x)).length >= 3 ? b : null
  }
  let hdr = -1, cols = []
  for (let i = 0; i < lines.length; i++) {
    const c = head(lines[i])
    if (c) { hdr = i; cols = c; break }
  }
  if (hdr < 0) return null
  const row = (label) => {
    for (let i = hdr + 1; i < Math.min(hdr + 8, lines.length); i++) {
      const c = cell(lines[i])
      if (!c[0] || !c[0].toLowerCase().includes(label)) continue
      // Подпись строки может стоять как отдельной ячейкой, так и слитно с первым числом.
      const nums = c.filter((x) => /^(\d+|—|-)$/.test(x))
      const o = {}
      const clsCols = cols.filter((x) => CLS.includes(x))
      clsCols.forEach((name, j) => { o[name] = /^\d+$/.test(nums[j] ?? '') ? +nums[j] : null })
      return o
    }
    return null
  }
  return { whole: row('по всей репе'), parts: row('по кускам') }
}
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const num = (t, re) => { const m = t.match(re); return m ? parseInt(m[1], 10) : null }

function grade(dir, repo, label) {
  const a = read(join(dir, 'answer.md'))
  if (!a) { console.log(`${label}: ответа нет — НЕ ИЗМЕРЕНО`); return null }
  const k = KEY[repo]
  const low = a.toLowerCase()

  // Класс засчитан, если назван И рядом стоит число в пределах ±30 %. Точность у скилла греповая,
  // он это объявляет сам, поэтому точное совпадение требовать нельзя. Красное — класс, не названный
  // вовсе, или названный с числом, далёким от правды в разы (обычно это ноль).
  const T = table(a)
  const lost = [], found = []
  const gradeClasses = k.mustSplit || !!T
  for (const [cls, n] of gradeClasses ? Object.entries(k.classes) : []) {
    if (T && T.whole) {
      const col = CLS.find((c) => c.startsWith(cls))
      const v = T.whole[col]
      const ok = v !== null && v !== undefined && Math.abs(v - n) <= Math.max(2, n * 0.3)
      ;(ok ? found : lost).push(cls + ' ~' + n + (ok ? '' : ' (в таблице: ' + (v ?? 'нет колонки') + ')'))
      continue
    }
    const named = low.includes(cls)
    const before = [...a.matchAll(new RegExp('(\\d+)\\s*' + cls, 'gi'))].map((m) => +m[1])
    const after = [...a.matchAll(new RegExp(cls + '[^\\d\\n]{0,40}?(\\d+)', 'gi'))].map((m) => +m[1])
    const nums = before.concat(after)
    const close = nums.some((v) => v > 0 && Math.abs(v - n) <= Math.max(2, n * 0.3))
    const note = (named ? '' : ' (класс не назван)') +
      (close ? '' : ' (числа нет' + (nums.length ? ': ' + nums.slice(0, 4).join('/') : '') + ')')
    ;(named && close ? found : lost).push(`${cls} ~${n}${note}`)
  }

  const missParts = k.mustSplit ? k.parts.filter((p) => !low.includes(p)) : []
  // Класс, потерянный ПРИ РАЗРЕЗЕ: посчитан по репе, но не доехал ни в один кусок. Скилл эту
  // строку печатает честно — и не реагирует на неё; для нас это главный провал разреза.
  const dropped = []
  if (T && T.whole && T.parts) {
    for (const c of CLS) {
      const w = T.whole[c], q = T.parts[c]
      if (typeof w === 'number' && typeof q === 'number' && w > 0 && q < w) dropped.push(c + ': ' + w + ' → ' + q)
    }
  }
  const whole = num(a, /по всей репе\s+(\d+)/i)
  const byParts = num(a, /по кускам\s+(\d+)/i)
  // Швы считаются предложенными по ИМЕНАМ КУСКОВ (`<репа>-<что-то>`), а не по слову «вариант»:
  // форма отчёта у прогонов разная — таблица, список, проза, — а имена кусков есть всегда.
  const pieceNames = new Set([...a.matchAll(new RegExp('\\b' + repo + '-[a-zа-я][\\w-]*', 'gi'))].map((m) => m[0].toLowerCase()))
  const proposed = pieceNames.size >= 2
  // Отказ формулируется по-разному («разрез не нужен», «разрез по скиллу не требуется», «репа
  // маленькая»), поэтому ищем пару «разрез/резать» + отрицание в пределах строки, а не точную фразу.
  const refused = /(разрез|резать|разделени)[^\n]{0,40}(не нуж|не требу|не на|излиш)|(не нуж|не требу)[^\n]{0,30}(разрез|разделени)|репа (маленька|небольша)/i.test(a)
  const verdictOk = k.mustSplit ? proposed : refused

  // КАЧЕСТВО РАЗРЕЗА — то, чего в грейдере не было и из-за чего «зелёный» ничего не значил.
  // Два механических признака кривого шва, оба видны по именам кусков:
  //   1. ПЕРЕСЕЧЕНИЕ: одно имя — префикс другого (`X-api` и `X-api-core`). Значит одни и те же
  //      папки попали в два куска, и ключи задвоятся между карточками.
  //   2. ДРОБЛЕНИЕ: кусков больше, чем приложений в репе. Скилл полез внутрь приложения, которое
  //      само берётся одним сканом.
  const names = [...pieceNames].sort()
  const overlap = names.filter((x) => names.some((y) => y !== x && x.startsWith(y + '-')))
  const tooMany = k.maxPieces && names.length > k.maxPieces ? names.length : 0
  const cutOk = k.mustSplit ? overlap.length === 0 && !tooMany : true

  console.log(`\n=== ${label} ===`)
  console.log(`  классов сошлось:   ${gradeClasses ? found.length + '/' + Object.keys(k.classes).length : '— (отказ одной строкой, таблица по Шагу 2.5 не требуется)'}`)
  if (lost.length) console.log(`  ⚠ ПОТЕРЯНО:        ${lost.join(' · ')}`)
  if (k.mustSplit) console.log(`  части репы:        ${missParts.length ? '⚠ не упомянуты: ' + missParts.join(', ') : 'все ' + k.parts.length + ' упомянуты'}`)
  console.log(`  своя сверка:       по всей репе ${whole ?? '—'}, по кускам ${byParts ?? '—'}`)
  if (dropped.length) console.log(`  ⚠ ПОТЕРЯНО ПРИ РАЗРЕЗЕ: ${dropped.join(' · ')}`)
  console.log(`  вердикт:           ${verdictOk ? '✅' : '❌'} ${k.mustSplit ? 'ожидался разрез' : 'ожидался ОТКАЗ (репа мелкая)'}`)
  if (k.mustSplit) {
    console.log(`  куски (${names.length}):       ${names.join(' ') || '—'}`)
    console.log(`  качество разреза:  ${cutOk ? '✅' : '❌'}` +
      (overlap.length ? `  ПЕРЕСЕКАЮТСЯ: ${overlap.join(', ')}` : '') +
      (tooMany ? `  ДРОБЛЕНИЕ: ${tooMany} кусков при ${k.maxPieces} допустимых` : ''))
  }
  return { lost: lost.length, missParts: missParts.length, verdict: verdictOk ? 0 : 1, dropped: dropped.length, cut: cutOk ? 0 : 1 }
}

const round = process.argv[2]
if (!round) { console.error('нужен путь к папке раунда'); process.exit(1) }
const sb = join(round, 'sandbox')
if (!existsSync(sb)) { console.error('песочниц нет'); process.exit(1) }

let redLost = 0, redParts = 0, redVerdict = 0, redDrop = 0, redCut = 0, n = 0
for (const d of readdirSync(sb).sort()) {
  const repo = d.replace(/-\d+$/, '')
  if (!KEY[repo]) continue
  const r = grade(join(sb, d), repo, d)
  if (r) { redLost += r.lost; redParts += r.missParts; redVerdict += r.verdict; redDrop += r.dropped; redCut += r.cut; n++ }
}
const green = n > 0 && redLost === 0 && redParts === 0 && redVerdict === 0 && redDrop === 0 && redCut === 0
console.log(`\n──────  ИТОГ по ${n} прогонам: не посчитано классов ${redLost} · потеряно при разрезе ${redDrop} · не упомянуто частей ${redParts} · неверных вердиктов ${redVerdict} · кривых разрезов ${redCut}  ──────`)
console.log(green ? '  ЗЕЛЁНО' : '  КРАСНО')
