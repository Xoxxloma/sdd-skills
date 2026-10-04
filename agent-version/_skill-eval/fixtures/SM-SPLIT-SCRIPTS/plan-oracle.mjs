// Независимый оракул plan.sh (service-map-2.0, задача Б). Написан по контракту брифа стенда,
// БЕЗ чтения plan.sh и SKILL.md.
//
//   node plan-oracle.mjs <counts.txt> <K> <w> <корень>[,<корень>…] [--variant <имя>]
//      → печатает план в форме контракта (для глаз и отладки)
//   import { plan, VARIANTS } — для compare.mjs
//
// Контракт (кратко): блоки «## <класс> :: <ключ|ориентир>», строки «<путь>:<число>». Вес файла =
// Σ ключ + w × Σ ориентир; вес папки — сумма поддерева. Общий вес ≤ K → «нарезка не нужна».
// Иначе папки с ненулевым весом пакуются подряд в порядке путей (байтовая сортировка) в части ≤ K;
// папка тяжелее K режется по подпапкам рекурсивно, её собственные файлы с весом идут подряд частями
// «файлы» ≤ K; файл тяжелее K — отдельной частью; нулевые поддеревья — остаток; файлы вне корней в план
// не входят.
//
// Решения там, где контракт молчит (каждое — кандидат в «неоднозначность контракта»; у спорных есть
// вариант, и сравнение принимает любой вариант с пометкой, какой совпал):
//  O1. Итог по классам — сумма ВСЕХ строк counts (литерально «итоги по классам = суммы counts»),
//      в том числе вне корней. Вариант itog=inroot — только внутри корней.
//  O2. Общий вес W — только внутри корней («вне корней в план не входят»).
//  O3. Порядок папок — сортировка строк путей целиком, без хвостового «/» (sort=plain: «a» < «a-b» <
//      «a/x»). Варианты: sort=slash — путь + «/» («a-b/» < «a/»), sort=dfs — обход дерева, соседи по имени.
//  O4. Упаковка папок — одна последовательность на весь сервис, жадно «подряд» (next-fit).
//      Вариант pack=parent — отдельно внутри каждой разрезанной папки; pack=run — внутри папки, и
//      тяжёлая подпапка ещё и обрывает серию соседей («подряд» прерывается).
//  O5. Файл тяжелее K среди своих файлов обрывает текущую часть «файлы» (big=break). Вариант
//      big=extract — тяжёлые вынимаются, остальные пакуются подряд без разрыва.
//  O6. Корень, который сам ≤ K (бывает только при нескольких корнях), — единица «папки» целиком
//      (root=unit). Вариант root=expand — корень всегда режется на верхние папки.
//  O7. Пути сравниваются в канонической форме: «\» → «/», «/c/…» → «C:/…», буква диска заглавная.
//  O8. Там же: «//» → «/», «/./» убирается, «<папка>/..» раскрывается, хвостовой «/» снимается.
//  O9. Заголовок блока: «## класс :: ключ|ориентир» или «## класс :: регэксп :: маска :: ключ|ориентир»;
//      класс — первое поле, вид — последнее, пометка в скобках после вида на вид не влияет.
import fs from 'node:fs'

export const canon = (p) => {
  let s = String(p).trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  s = s.replace(/^\/([a-zA-Z])(\/|$)/, (_, d, e) => d.toUpperCase() + ':' + (e || '/'))
  s = s.replace(/^([a-zA-Z]):/, (_, d) => d.toUpperCase() + ':')
  // O8: «/./» убирается, «<папка>/..» раскрывается (выше корня не поднимается), хвостовой «/» снимается
  const m = s.match(/^([A-Z]:)?(\/)?(.*)$/)
  const head = (m[1] || '') + (m[2] || ''); const abs = !!m[2]
  const out = []
  for (const seg of m[3].split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!abs) out.push('..'); continue }
    out.push(seg)
  }
  return head + out.join('/') || head || '.'
}

export function parseCounts (text) {
  const lines = []
  let cur = null
  for (const raw of text.split(/\r?\n/)) {
    if (/^##\s/.test(raw)) {
      const h = raw.match(/^##\s+(.+?)\s*::.*::\s*(ключ|ориентир)(?:\s*\([^)]*\))?\s*$/) || raw.match(/^##\s+(.+?)\s*::\s*(ключ|ориентир)(?:\s*\([^)]*\))?\s*$/)
      if (h) cur = { cls: h[1].trim(), type: h[2] }
      continue
    }
    if (!cur) continue
    const m = raw.match(/^(.*\S):(\d+)\s*$/)
    if (!m) continue
    lines.push({ path: m[1].trim(), n: Number(m[2]), cls: cur.cls, type: cur.type })
  }
  return lines
}

const isAbs = (p) => /^([A-Z]:)?\//.test(p)
const cmpBytes = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return Buffer.compare(x, y) }

export const VARIANTS = {
  primary: { itog: 'all', sort: 'plain', pack: 'global', big: 'break', root: 'unit' },
  'sort=slash': { sort: 'slash' },
  'sort=dfs': { sort: 'dfs' },
  'pack=parent': { pack: 'parent' },
  'pack=run': { pack: 'run' },
  'big=extract': { big: 'extract' },
  'root=expand': { root: 'expand' },
  'itog=inroot': { itog: 'inroot' },
}
export const variant = (name) => ({ ...VARIANTS.primary, ...(VARIANTS[name] || {}) })

export function plan (countsText, K, w, rootsArg, opt = VARIANTS.primary) {
  const o = { ...VARIANTS.primary, ...opt }
  const roots = (Array.isArray(rootsArg) ? rootsArg : String(rootsArg).split(',')).map((r) => canon(r)).filter(Boolean)
  const lines = parseCounts(countsText)
  const keyClasses = []; const oriClasses = []
  for (const l of lines) {
    const list = l.type === 'ключ' ? keyClasses : oriClasses
    if (!list.includes(l.cls)) list.push(l.cls)
  }
  // файлы
  const files = new Map()
  let outside = 0; const outsideFiles = []
  const itogAll = { ключ: {}, ориентир: {} }; const itogIn = { ключ: {}, ориентир: {} }
  for (const l of lines) {
    const p = canon(l.path)
    itogAll[l.type][l.cls] = (itogAll[l.type][l.cls] || 0) + l.n
    const ri = roots.findIndex((r) => p === r || p.startsWith(r + '/'))
    const lw = l.type === 'ключ' ? l.n : w * l.n
    if (ri < 0) { outside += lw; outsideFiles.push(p); continue }
    itogIn[l.type][l.cls] = (itogIn[l.type][l.cls] || 0) + l.n
    let f = files.get(p)
    if (!f) { f = { path: p, root: ri, w: 0, cls: {}, ori: {} }; files.set(p, f) }
    f.w += lw
    const bag = l.type === 'ключ' ? f.cls : f.ori
    bag[l.cls] = (bag[l.cls] || 0) + l.n
  }
  // дерево по корням
  const mkNode = (path, root, parent) => ({ path, root, parent, w: 0, dirs: new Map(), files: [] })
  const tops = roots.map((r, i) => mkNode(r, i, null))
  for (const f of files.values()) {
    let node = tops[f.root]
    const rel = f.path.slice(node.path.length + 1).split('/')
    node.w += f.w
    for (let i = 0; i < rel.length - 1; i++) {
      const sub = node.path + '/' + rel[i]
      if (!node.dirs.has(sub)) node.dirs.set(sub, mkNode(sub, f.root, node))
      node = node.dirs.get(sub); node.w += f.w
    }
    node.files.push(f)
  }
  const W = round(tops.reduce((a, t) => a + t.w, 0))
  const res = { K, w, W, itog: o.itog === 'all' ? itogAll : itogIn, keyClasses, oriClasses, outside: round(outside), outsideFiles, roots, parts: [], mode: W <= K ? 'не нужна' : 'план' }
  if (res.mode === 'не нужна') return res

  const covered = (node) => { const out = []; const walk = (n) => { out.push(...n.files); for (const d of n.dirs.values()) walk(d) }; walk(node); return out }
  const sortKey = (p) => (o.sort === 'slash' ? p + '/' : p)
  const byPath = (a, b) => cmpBytes(sortKey(a.path), sortKey(b.path))
  const folderGroups = [] // [[unit…]] — последовательности для упаковки
  const fileParts = []
  const global = []
  const packFiles = (node) => {
    const own = node.files.filter((f) => f.w > 0).sort((a, b) => cmpBytes(a.path, b.path))
    let cur = []; let cw = 0
    const flush = () => { if (cur.length) fileParts.push({ kind: 'файлы', items: cur, w: cw }); cur = []; cw = 0 }
    const heavy = own.filter((f) => f.w > K)
    const light = own.filter((f) => f.w <= K)
    if (o.big === 'extract') {
      for (const f of heavy) fileParts.push({ kind: 'файлы', items: [f], w: f.w })
      for (const f of light) { if (cur.length && cw + f.w > K) flush(); cur.push(f); cw += f.w }
      flush(); return
    }
    for (const f of own) {
      if (f.w > K) { flush(); fileParts.push({ kind: 'файлы', items: [f], w: f.w }); continue }
      if (cur.length && cw + f.w > K) flush()
      cur.push(f); cw += f.w
    }
    flush()
  }
  // pack=run: тяжёлая папка обрывает «подряд» — соседи до и после неё пакуются разными сериями
  const walkKids = (kids, unitOk) => {
    const local = []; let run = []
    for (const d of kids) {
      if (unitOk(d)) { const u = { kind: 'папки', items: [d], w: d.w }; local.push(u); run.push(u); global.push(u) } else {
        if (o.pack === 'run' && run.length) { folderGroups.push(run); run = [] }
        expand(d)
      }
    }
    if (o.pack === 'parent' && local.length) folderGroups.push(local)
    if (o.pack === 'run' && run.length) folderGroups.push(run)
  }
  const expand = (node) => {
    const kids = [...node.dirs.values()].filter((d) => d.w > 0)
    kids.sort((a, b) => cmpBytes(a.path, b.path))
    walkKids(kids, (d) => d.w <= K)
    packFiles(node)
  }
  const topsSorted = [...tops].filter((t) => t.w > 0).sort((a, b) => cmpBytes(a.path, b.path))
  walkKids(topsSorted, (t) => t.w <= K && o.root === 'unit')
  if (o.pack === 'global') {
    if (o.sort !== 'dfs') global.sort((a, b) => byPath(a.items[0], b.items[0]))
    folderGroups.push(global)
  } else if (o.sort !== 'dfs') for (const g of folderGroups) g.sort((a, b) => byPath(a.items[0], b.items[0]))
  const folderParts = []
  for (const g of folderGroups) {
    let cur = []; let cw = 0
    for (const u of g) {
      if (cur.length && cw + u.w > K) { folderParts.push({ kind: 'папки', items: cur, w: cw }); cur = []; cw = 0 }
      cur.push(u.items[0]); cw += u.w
    }
    if (cur.length) folderParts.push({ kind: 'папки', items: cur, w: cw })
  }
  for (const p of [...folderParts, ...fileParts]) {
    const fl = p.kind === 'папки' ? p.items.flatMap(covered) : p.items
    const cls = {}; const ori = {}
    for (const f of fl) {
      for (const [c, n] of Object.entries(f.cls)) cls[c] = (cls[c] || 0) + n
      for (const [c, n] of Object.entries(f.ori)) ori[c] = (ori[c] || 0) + n
    }
    res.parts.push({ kind: p.kind, paths: p.items.map((x) => x.path), w: round(p.w), cls, ori, files: fl.map((f) => f.path) })
  }
  return res
}

export const round = (x) => Math.round(x * 1000) / 1000

// относительная форма пути: «Ri:rel» («.» — сам корень)
export function relOf (p, roots) {
  const c = canon(p)
  if (!isAbs(c)) return roots.length === 1 ? `R1:${c}` : `R?:${c}`
  let best = -1
  roots.forEach((r, i) => { if ((c === r || c.startsWith(r + '/')) && (best < 0 || r.length > roots[best].length)) best = i })
  if (best < 0) return `?:${c}`
  return `R${best + 1}:${c === roots[best] ? '.' : c.slice(roots[best].length + 1)}`
}

export function fmt (res) {
  const num = (x) => String(round(x))
  const list = (m, order) => order.filter((c) => m[c]).map((c) => `${c} ${m[c]}`).join(', ')
  const out = []
  const ori = list(res.itog.ориентир, res.oriClasses)
  out.push(`итог по классам: ${list(res.itog.ключ, res.keyClasses)}${ori ? ` | ориентир: ${ori}` : ''}`)
  if (res.outside) out.push(`вне корней сервиса: вес ${num(res.outside)}`)
  if (res.mode === 'не нужна') { out.push(`нарезка не нужна: вес ${num(res.W)} ≤ K=${res.K}`); return out.join('\n') }
  out.push(`вес сервиса ${num(res.W)} при K=${res.K}, w=${res.w}`)
  res.parts.forEach((p, i) => out.push(`часть ${String(i + 1).padStart(2, '0')} вес ${num(p.w)} (${list(p.cls, res.keyClasses)}): ${p.kind} ${p.paths.join('; ')}`))
  out.push(`частей ${res.parts.length}; остаток — поддеревья с нулевым весом`)
  return out.join('\n')
}

if (process.argv[1] && process.argv[1].endsWith('plan-oracle.mjs') && process.argv.length >= 6) {
  const [, , counts, K, w, roots, flag, vname] = process.argv
  const opt = flag === '--variant' ? variant(vname) : VARIANTS.primary
  console.log(fmt(plan(fs.readFileSync(counts, 'utf8'), Number(K), Number(w), roots, opt)))
}
