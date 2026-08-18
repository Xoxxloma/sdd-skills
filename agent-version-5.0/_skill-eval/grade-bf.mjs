#!/usr/bin/env node
// grade-bf.mjs — проба bf-spec: спека на багфикс по баг-репорту (режим `reference/bugfix-mode.md`).
//
//   node grade-bf.mjs <каталог с песочницами>
//   node grade-bf.mjs --selftest
//
// ЧТО ГРЕЙДИТСЯ. Записанный файл `docs/ARS-312/technical_specification.md`, а не отчёт.
//
// ПОБЕГ ИЗ ПЕСОЧНИЦЫ — «НЕ ИЗМЕРЕНО», А НЕ «ПРОВАЛЕНО». Прогон, записавший спеку по абсолютному
// пути в фикстуру, снаружи выглядит как «файла нет»; засчитать это отказом скилла — соврать в обе
// стороны.
//
// ⚠️ ПРИЗНАК ЗДЕСЬ СЛАБЫЙ, И ЭТО НАДО ЗНАТЬ ПРИ ЧТЕНИИ ЧИСЕЛ. «Отчитался о записи + файла нет»
// одинаков у побега и у ФАНТОМНОЙ ЗАПИСИ (сочинил отчёт, не писал ничего). Фантом — дефект скилла
// и обязан оставаться в знаменателе; побег — дефект изоляции и обязан выпадать. Пока их различает
// только эта эвристика, числа `bf-spec` — ВЕРХНЯЯ ОЦЕНКА: часть исключённых могла быть исключена
// зря. Настоящее решение — метка `_escaped.txt` от `check-escape.mjs` по разбору вызовов записи,
// как уже сделано для `analyst-workspace`; в раунде 2026-08-18 её не было.
//
// ПРАВИЛА РЕПЫ: регулярки литеральные; `\b`/`\w` рядом с кириллицей НЕ применять (в JS `\w` —
// только латиница); счётчик на каждый дефект, общего процента нет.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

export function isApiFailure (t) {
  if (!t) return true
  if (t.length > 600) return false
  return RE_API_FAILURE.test(t.slice(0, 300))
}

/** Отчёт утверждает, что спека записана. Вместе с отсутствием файла = побег, а не отказ. */
const RE_CLAIMS_WROTE = /technical_specification\.md|спек[ауи][^.\n]{0,40}(готов|написал|записал)|файл готов/i

// ─── Обязательное ───────────────────────────────────────────────────────────────────────────

// Слово ищем ВО ВСЁМ файле, а не в §1.1: прогоны пишут «Тип: FE-only (багфикс)» там, а в §1.1
/** держат «Суть». Первая редакция смотрела только начало и печатала 3/8 ложно. */
const RE_TYPE_BUGFIX = /багфикс|баг-фикс|bug ?fix|исправление дефекта|устранение дефекта|исправление ошибки/i
const RE_SRC_REPORT = /bug_report\.md/
const RE_ARS102 = /ARS-102/
const RE_FR = /\bFR-1\b/
/** §2 закрыта штатным для багфикса исходом. */
const RE_INT_NA = /не применимо[^.\n]{0,80}контракт|контракт[^.\n]{0,40}не мен[яе]/i
/** Границы правки: что рядом обязано остаться прежним. */
const RE_BOUNDS = /границ[аы] правки|остаются? неизменн|должно остаться|не должн[оа] мен|не затрагива/i
/**
 * Ответ про испорченные записи — «не испорчены» тоже ответ.
 * Расширено 2026-08-18 по живым прогонам: модель пишет «пересчитывать нечего», «не портит записи»,
 * «баг в UI, не в данных», «нет данных в хранилище». Первая редакция ловила лишь часть и напечатала
 * 6/8 там, где ответ был почти везде.
 */
const RE_DATA_ANSWERED = /испорченн|пересч[а-яё]*\s*(не тр|нечего)|не портит[^.\n]{0,20}запис|данные не[^.\n]{0,20}(портит|затрагива|мен)|миграц[а-яё]*[^.\n]{0,40}не (нужн|требу)|таблицы не тр|не в данных|нет данных в хранилищ/i
/** Словарь статуса СПЕКИ, не репорта. */
const RE_STATUS_SPEC = /Статус готовности:\*{0,2}\s*(Готово к разработке|Требуются уточнения \(\d+\))/
const RE_STATUS_REPORT_VOCAB = /Статус готовности:\*{0,2}\s*Готово к оценке/
/** Выдуманная причина — режим это прямо запрещает. */
const RE_INVENTED_CAUSE = /race condition|двойн[оаы][ейм][^.\n]{0,20}(рендер|вызов)|вероятн[оая][^.\n]{0,40}из-за|предположительн[оая][^.\n]{0,40}причин|причина дефекта[^.\n]{0,40}(в том|заключа)/i

/** Заголовки шаблона, которые прогон склонен переименовывать. */
const RE_H_62 = /^###\s*6\.2\.\s*Обратная совместимость\s*$/m
const RE_H_32 = /^###\s*3\.2\.\s*Данные и хранение\s*$/m

export function gradeRun (dir) {
  const r = { dir, measured: true, why: '' }
  const ansPath = join(dir, 'answer.md')
  const ans = existsSync(ansPath) ? readFileSync(ansPath, 'utf8') : ''
  if (isApiFailure(ans)) { r.measured = false; r.why = 'отказ API'; return r }

  // Метка от `check-escape.mjs` — ДОКАЗАТЕЛЬСТВО побега (разбор пишущих вызовов в `stream.jsonl`),
  // а не догадка. Она старше эвристики ниже и снимает вопрос «побег или фантом» целиком.
  if (existsSync(join(dir, '_escaped.txt'))) { r.measured = false; r.why = 'побег из песочницы (метка check-escape)'; return r }

  const spec = join(dir, 'docs/ARS-312/technical_specification.md')
  r.wrote = existsSync(spec)

  if (!r.wrote) {
    // Поток есть, метки нет → побег ИСКЛЮЧЁН доказательно, значит это ФАНТОМ: дефект скилла,
    // остаётся в знаменателе. Потока нет (раунд снят до 2026-08-18) → различить нечем, и тогда
    // работает прежняя эвристика: «отчитался о записи» = не измерено, числа верхняя оценка.
    const hasStream = existsSync(join(dir, 'stream.jsonl'))
    if (!hasStream && RE_CLAIMS_WROTE.test(ans)) {
      r.measured = false
      r.why = 'нет потока вызовов, побег от фантома неотличим (раунд до 2026-08-18)'
      return r
    }
    r.phantom = RE_CLAIMS_WROTE.test(ans)
    return r
  }

  const t = readFileSync(spec, 'utf8')
  r.typeBugfix = RE_TYPE_BUGFIX.test(t)
  r.srcReport = RE_SRC_REPORT.test(t)
  r.blamedARS102 = RE_ARS102.test(t)
  r.hasFR = RE_FR.test(t)
  r.intNA = RE_INT_NA.test(t)
  r.bounds = RE_BOUNDS.test(t)
  r.dataAnswered = RE_DATA_ANSWERED.test(t)
  r.statusSpec = RE_STATUS_SPEC.test(t)
  r.statusReportVocab = RE_STATUS_REPORT_VOCAB.test(t)
  r.invented = RE_INVENTED_CAUSE.test(t)
  r.h62 = RE_H_62.test(t)
  r.h32 = RE_H_32.test(t)
  // Отдельный, более тяжёлый исход: раздела нет вовсе, секция схлопнута. Пункт 11 приёмки
  // краснит и за это — «секции нет вовсе — тоже нарушение».
  r.no32 = !/^###\s*3\.2\./m.test(t)
  r.extraDocs = existsSync(join(dir, 'docs/ARS-312/business_requirements.md'))

  r.pass = r.typeBugfix && r.srcReport && !r.blamedARS102 && r.hasFR && r.bounds &&
    r.dataAnswered && r.statusSpec && !r.statusReportVocab && !r.invented && !r.extraDocs
  return r
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────────────────

const REF_OK = `# Техническая спецификация: устранение двойной отрисовки

> **Статус готовности:** Готово к разработке
> **Задача:** ARS-312

### 1.1. Тип и стороны
Багфикс, только фронт.

### 1.3. Связь с бизнес-требованиями
docs/ARS-312/bug_report.md — FR-1.

## 2. Взаимодействия
Не применимо: контракт не меняется.

### 3.2. Данные и хранение
Данные не портит, пересчёт не требуется.

### 6.2. Обратная совместимость
Границы правки: выбор района и масштаб остаются неизменными.

## 7. Трассировка приёмки
| FR-1 | Пройти шаги из репорта |`

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  ck('тип багфикс', RE_TYPE_BUGFIX.test(REF_OK), true)
  ck('источник — репорт', RE_SRC_REPORT.test(REF_OK), true)
  ck('чужой документ не назван', RE_ARS102.test(REF_OK), false)
  ck('FR-1 есть', RE_FR.test(REF_OK), true)
  ck('§2 не применимо', RE_INT_NA.test(REF_OK), true)
  ck('границы правки', RE_BOUNDS.test(REF_OK), true)
  ck('про данные отвечено', RE_DATA_ANSWERED.test(REF_OK), true)
  ck('статус из словаря спеки', RE_STATUS_SPEC.test(REF_OK), true)
  ck('словарь репорта не сработал', RE_STATUS_REPORT_VOCAB.test(REF_OK), false)
  ck('причина не выдумана', RE_INVENTED_CAUSE.test(REF_OK), false)
  ck('заголовок 6.2 канонический', RE_H_62.test(REF_OK), true)
  ck('заголовок 3.2 канонический', RE_H_32.test(REF_OK), true)
  ck('переименованный 6.2 не проходит', RE_H_62.test('### 6.2. Обратная совместимость (границы правки)'), false)
  ck('переименованный 3.2 не проходит', RE_H_32.test('### 3.2. Нужны ли миграции?'), false)
  ck('ловится выдуманная причина', RE_INVENTED_CAUSE.test('Вероятно, из-за race condition при загрузке тайлов'), true)
  ck('ловится словарь репорта', RE_STATUS_REPORT_VOCAB.test('> **Статус готовности:** Готово к оценке'), true)
  ck('побег: отчёт утверждает запись', RE_CLAIMS_WROTE.test('**Спецификация готова:** `docs/ARS-312/technical_specification.md`'), true)
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  return bad === 0
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1)
const root = argv.find((x) => !x.startsWith('--'))
if (!root || !existsSync(root)) { console.error('usage: node grade-bf.mjs <каталог>'); process.exit(1) }

const all = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^run-\d+$/.test(e.name))
  .map((e) => gradeRun(join(root, e.name)))
  .sort((a, b) => a.dir.localeCompare(b.dir))

const ok = all.filter((r) => r.measured)
const N = ok.length
const c = (f) => ok.filter(f).length
const pct = (n) => `${String(n).padStart(2)}/${N}`

console.log(`\nпроба bf-spec, ${root}`)
console.log(`прогонов: ${all.length}, измерено: ${N}, не измерено: ${all.length - N}`)
for (const r of all.filter((x) => !x.measured)) console.log(`  НЕ ИЗМЕРЕНО ${r.dir}: ${r.why}`)
console.log('')
console.log(`  ${pct(c((r) => !r.wrote))}\tФАЙЛА НЕТ — режим не включился  ← КРИТЕРИЙ`)
console.log(`  ${pct(c((r) => r.wrote && !r.srcReport))}\tисточником не назван баг-репорт`)
console.log(`  ${pct(c((r) => r.wrote && r.blamedARS102))}\tПРИПИСАН ЧУЖОЙ ДОКУМЕНТ ARS-102  ← КРИТЕРИЙ`)
console.log(`  ${pct(c((r) => r.wrote && r.invented))}\tВЫДУМАНА ПРИЧИНА ДЕФЕКТА  ← КРИТЕРИЙ`)
console.log(`  ${pct(c((r) => r.wrote && !r.bounds))}\tГРАНИЦ ПРАВКИ НЕТ в §6.2  ← КРИТЕРИЙ`)
console.log(`  ${pct(c((r) => r.wrote && !r.dataAnswered))}\tпро испорченные записи не сказано`)
console.log(`  ${pct(c((r) => r.wrote && !r.hasFR))}\tтребование FR-1 из репорта потеряно`)
console.log(`  ${pct(c((r) => r.wrote && !r.typeBugfix))}\tтип «багфикс» не назван`)
console.log(`  ${pct(c((r) => r.wrote && !r.intNA))}\t§2 не закрыта «контракт не меняется»`)
console.log(`  ${pct(c((r) => r.wrote && r.statusReportVocab))}\tсловарь статуса из репорта («Готово к оценке»)`)
console.log(`  ${pct(c((r) => r.wrote && !r.statusSpec))}\tстатус вне словаря спеки`)
console.log(`  ${pct(c((r) => r.wrote && r.extraDocs))}\tнаписаны лишние бизнес-требования`)
console.log(`  ${pct(c((r) => r.wrote && !r.h62))}\tзаголовок §6.2 переименован (пункт 11 приёмки покраснеет)`)
console.log(`  ${pct(c((r) => r.wrote && !r.h32))}\tзаголовок §3.2 переименован`)
console.log(`  ${pct(c((r) => r.pass))}\tзелёных`)
console.log('')
