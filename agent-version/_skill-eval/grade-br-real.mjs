#!/usr/bin/env node
// grade-br-real.mjs — проба BR-REAL: читает ли business-requirements-doc «Бизнес-правила» карточки.
//
//   node grade-br-real.mjs <папка с прогонами run-NN> [ещё папки…]
//
// Меряется ЧТЕНИЕ потребителя на замороженной карточке (fixtures/BR-REAL/README.md). По каждому
// прогону — три вещи, все по диску и по тексту ответа, не по самоотчёту:
//   1. файл БТ на первом ходу НЕ записан (правило «turn 1 = questions only»);
//   2. вопросы несут анкеры из «Бизнес-правил» — те же регэкспы A1–A8, что в grade-sm-real.mjs,
//      плюс роли дословно и «45 с» (окно склейки уведомлений — число, которое неоткуда угадать);
//   3. кодовые идентификаторы в вопросах вне ролей (camelCase, пути, HTTP-глаголы) — утечка.
// Холодный прогон — 0 анкеров: ответ лежал в карточке, а человека спросили по памяти.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BIZ_ANCHORS = [
  ['A1 в акт только работы на 100 %', /((^|[^0-9])100\s*%|полност[а-яё]*\s+выполн|completedVolume\s*>=?\s*totalVolume)[\s\S]{0,200}(при[её]мк|acceptance|акт[аеуы]?\s)|(при[её]мк|acceptance)[\s\S]{0,200}((^|[^0-9])100\s*%|полност[а-яё]*\s+выполн|completedVolume\s*>=?\s*totalVolume)/i],
  ['A2 отклонённая работа сдаётся снова', /(отклон[а-яё]*|REJECTED)[\s\S]{0,150}(NONE|возвращ|снова|повторн|заново|можно[\s\S]{0,20}отправ)/i],
  ['A3 права: только прораб/руководитель', /(только|лишь)\s+(прораб|FOREMAN|руковод|владел|OWNER)[\s\S]{0,80}(редактир|измен|управл|приглаш|добавл|удал)|(WORKER|рабоч[а-яё]*)[\s\S]{0,120}(не\s+может|нельзя|без\s+прав)/i],
  ['A4 последний прораб → руководитель', /(прораб|FOREMAN)[\s\S]{0,200}(переназнач|переход|станов|назнача|подтягива|reassign)[\s\S]{0,120}(владел|руковод|OWNER)|reassignForemanToOwner/i],
  ['A5 исключённому — только новый инвайт', /(исключ[её]н|удал[её]н|сн[яи]т|убра[нл])[а-яё]*[\s\S]{0,200}(нов[а-яё]*\s+приглаш|повторн[а-яё]*\s+приглаш|мастер-?ссылк|inviteToken|общ[а-яё]*\s+ссылк|e-?mail)/i],
  ['A6 публичная ссылка скрывает телефоны/цены', /(публичн[а-яё]*|без\s+(входа|авторизац|регистрац|логин)|publicToken|\/p\/)[\s\S]{0,300}(телефон|phone|цен[аыу]?\s+за\s+единиц|pricePerUnit|скры|не\s+(показ|видн|отда))/i],
  ['A7 история сметы: дельта и итог', /(истори[а-яё]*\s+(изменени[а-яё]*\s+)?смет|estimate.?history|EstimateChangeLog|журнал[а-яё]*\s+(изменений\s+)?смет)[\s\S]{0,300}(delta|дельт|разниц|totalAfter|итог[а-яё]*\s+после|сумм[а-яё]*\s+после)/i],
  ['A8 автор не получает; один канал', /(автор[а-яё]*|инициатор[а-яё]*|excludeUserId)[\s\S]{0,100}(не\s+получа|исключа|кроме)|(кроме|за\s+исключением)\s+(самого\s+)?(автор|инициатор)|(один|выбранн?[а-яё]*|предпочт[а-яё]*)\s+канал/i],
  ['N окно склейки 45 с', /(^|[^0-9])45\s*(с|сек)/i],
]
const ROLE_NAMES = ['OWNER', 'EMPLOYEE', 'CUSTOMER', 'FOREMAN', 'WORKER']
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
// Кодовый регистр вне ролей и вне бэктиков: пути, HTTP-глаголы, camelCase.
const CODEISH = /(^|\s)\/[a-z]|\b(GET|POST|PUT|PATCH|DELETE)\b|\b[a-z]+[A-Z][A-Za-z]*\b/g

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])

function gradeRun(dir) {
  // Добранный после отказа прогон держит и старый `_api-failure.txt`, и новый `answer.md`:
  // измерен тот, у кого есть непустой ответ без текста отказа; старый файл отказа не решает.
  const ans = join(dir, 'answer.md')
  if (!existsSync(ans) || !readFileSync(ans, 'utf8').trim()) return { dir, measured: false }
  const text = readFileSync(ans, 'utf8')
  if (RE_API_FAILURE.test(text)) return { dir, measured: false }
  const files = walk(dir).filter((f) => /business_requirements\.md$/.test(f))
  const anchors = BIZ_ANCHORS.filter(([, re]) => re.test(text)).map(([n]) => n)
  const roles = ROLE_NAMES.filter((r) => new RegExp('\\b' + r + '\\b').test(text))
  const stripped = text.replace(/`[^`]*`/g, '')
  const codeish = [...new Set((stripped.match(CODEISH) || []).map((s) => s.trim()).filter((s) => !ROLE_NAMES.includes(s)))]
  return { dir, measured: true, wroteFile: files.length > 0, anchors, roles, codeish }
}

const roots = process.argv.slice(2)
if (!roots.length) { console.error('нужна папка с прогонами'); process.exit(1) }
for (const root of roots) {
  const runs = readdirSync(root).filter((d) => /^run-/.test(d) && statSync(join(root, d)).isDirectory()).sort()
  const rs = runs.map((d) => gradeRun(join(root, d)))
  console.log(`\n=== ${root} ===`)
  for (const r of rs) {
    if (!r.measured) { console.log(`  ${r.dir.split('/').pop()}: НЕ ИЗМЕРЕНО`); continue }
    console.log(`  ${r.dir.split('/').pop()}: файл ${r.wroteFile ? '⚠ ЗАПИСАН' : 'нет'} · анкеров ${r.anchors.length} [${r.anchors.map((a) => a.slice(0, 2)).join(' ')}] · ролей ${r.roles.length}/5 · кода вне ролей ${r.codeish.length}${r.codeish.length ? ' (' + r.codeish.slice(0, 4).join(', ') + ')' : ''}`)
  }
  const m = rs.filter((r) => r.measured)
  const n = m.length
  const cnt = (p) => m.filter(p).length
  console.log(`  измерено ${n} из ${rs.length}`)
  console.log(`  холодных (0 анкеров) ${cnt((r) => r.anchors.length === 0)} · частичных (1–2) ${cnt((r) => r.anchors.length >= 1 && r.anchors.length <= 2)} · тёплых (≥ 3) ${cnt((r) => r.anchors.length >= 3)}`)
  console.log(`  файл на первом ходу: ${cnt((r) => r.wroteFile)} · роли дословно (≥ 3 из 5): ${cnt((r) => r.roles.length >= 3)} · с кодом вне ролей: ${cnt((r) => r.codeish.length > 0)}`)
  console.log('  анкеры — в скольких прогонах:')
  for (const [name] of BIZ_ANCHORS) console.log(`    ${String(cnt((r) => r.anchors.includes(name))).padStart(2)}/${n}  ${name}`)
}
