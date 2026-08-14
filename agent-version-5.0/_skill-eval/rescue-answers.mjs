#!/usr/bin/env node
// rescue-answers.mjs — возвращает в пул прогоны, ошибочно объявленные отказом API.
//
//   node rescue-answers.mjs <папка-раунда>        показать
//   node rescue-answers.mjs <папка-раунда> --fix  вернуть
//
// ПОВОД. `run-pool.sh` объявляет прогон отказом API, если в его ответе встретилась строка из
// списка «API Error | rate limit | session limit | …». Список писался под ответ, который ЦЕЛИКОМ
// состоит из сообщения об ошибке CLI. Но `rate limit` — обычные слова технической спеки: замер
// 2026-08-14, плечо `ts-ctx`, прогон run-05 написал «Backoff strategy для 409 (дубликат) и 429
// (rate limit)» — и весь прогон уехал в `_api-failure.txt`, то есть тихо выпал из знаменателя.
//
// Цена этой ошибки выше, чем кажется: на `ts-ctx` слова `429` и `rate limit` приходят из самой
// фикстуры, и выпадают ровно те прогоны, которые перенесли в спеку больше чужой конкретики.
// Счётчик утечки смещается ВНИЗ — то есть стенд врёт в пользу скилла.
//
// ПРИЗНАК НАСТОЯЩЕГО ОТКАЗА: сообщение CLI — это весь вывод. Оно короткое и стоит в начале.
// Поэтому отказом считается файл короче 600 байт ЛИБО файл, где маркер попал в первые 200.

import { readdirSync, existsSync, readFileSync, renameSync, statSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const MARKERS = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i

export function looksLikeRealFailure(text) {
  if (text.length < 600) return MARKERS.test(text)
  return MARKERS.test(text.slice(0, 200))
}

const ROOT = process.argv[2]
const FIX = process.argv.includes('--fix')
if (!ROOT) {
  console.error('usage: node rescue-answers.mjs <папка-раунда> [--fix]')
  process.exit(2)
}

function* sandboxes(dir) {
  for (const arm of readdirSync(dir)) {
    const armDir = join(dir, arm)
    if (!statSync(armDir).isDirectory() || arm.startsWith('_')) continue
    for (const run of readdirSync(armDir)) {
      if (!/^run-/.test(run)) continue
      yield join(armDir, run)
    }
  }
}

let rescued = 0
let kept = 0
let stale = 0
for (const sb of sandboxes(ROOT)) {
  const f = join(sb, '_api-failure.txt')
  if (!existsSync(f)) continue
  // МЕТКА ПРОШЛОЙ ПОПЫТКИ. Песочница, перезапущенная после отказа, получает новый `answer.md`,
  // но старый `_api-failure.txt` остаётся лежать рядом — и грейдер, который смотрит на него
  // первым, объявляет удачный прогон неизмеренным. Поймано 2026-08-14 на плече `sb-ctx`:
  // 10 живых ответов, «измерено: 0 из 10».
  const ans = join(sb, 'answer.md')
  if (existsSync(ans) && readFileSync(ans, 'utf8').trim() !== '') {
    stale += 1
    console.log(`  МЕТКА ПРОШЛОЙ ПОПЫТКИ (ответ уже есть): ${sb}${FIX ? ' — снята' : ''}`)
    if (FIX) rmSync(f)
    continue
  }
  const text = readFileSync(f, 'utf8')
  if (looksLikeRealFailure(text)) {
    kept += 1
    console.log(`  отказ настоящий: ${sb} (${text.length} б)`)
    continue
  }
  rescued += 1
  const why = (text.match(MARKERS) ?? ['?'])[0]
  console.log(`  ЛОЖНЫЙ отказ по слову «${why}»: ${sb} (${text.length} б)${FIX ? ' — возвращён' : ''}`)
  if (FIX) renameSync(f, join(sb, 'answer.md'))
}
console.log(`\nложных: ${rescued}, настоящих: ${kept}${FIX ? '' : '   (запусти с --fix, чтобы вернуть)'}`)
