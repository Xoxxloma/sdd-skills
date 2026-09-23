// make-v2-runners.mjs — собирает run-ctx-v2.sh и run-pool-ctx-v2.sh из текущих run-ctx.sh / run-pool-ctx.sh.
// Повод (раунд ts-comb, 2026-09-23): обёртка передавала прогону АБСОЛЮТНЫЙ ПУТЬ к файлу промпта внутри
// fixtures/<ФИКСТУРА>/; прогон шёл в эту папку, находил там документ сверху и писал спеку рядом с ним.
// На bf-spec так ушли 4 прогона из 5 (два в фикстуру, один в засев, один в чужую песочницу).
// v2: сообщение пользователя — инлайн; засев — не соседом снимка скилла.
// Запуск: node make-v2-runners.mjs
import { readFileSync, writeFileSync } from 'node:fs';

let p = readFileSync('run-pool-ctx.sh', 'utf8');
const oldLine = 'Сообщение пользователя лежит в файле ${PROMPT}. Прочитай его и отработай по скиллу."';
if (!p.includes(oldLine)) throw new Error('строка промпта не найдена в run-pool-ctx.sh');
p = p.replace(oldLine, 'Сообщение пользователя:\n<<<\n$(cat "$PROMPT")\n>>>\nОтработай по скиллу."');
p = p.replace('# run-pool-ctx.sh —',
  '# run-pool-ctx-v2.sh — КОПИЯ 2026-09-23 (собрана make-v2-runners.mjs): сообщение пользователя ИНЛАЙН,\n' +
  '# а не путём к файлу. Путь внутрь стенда в промпте — вектор побега из песочницы (bf-spec: 4 из 5).\n' +
  '# run-pool-ctx.sh —');
writeFileSync('run-pool-ctx-v2.sh', p);

let c = readFileSync('run-ctx.sh', 'utf8');
const oldPool = 'POOL="$HERE/run-pool-ctx.sh"';
const oldSeed = 'SEED_ROOT="${SKILL_EVAL_SEED_ROOT:-/tmp/skill-eval-seed}"';
if (!c.includes(oldPool) || !c.includes(oldSeed)) throw new Error('POOL или SEED_ROOT не найдены в run-ctx.sh');
c = c.replace(oldPool, 'POOL="$HERE/run-pool-ctx-v2.sh"');
c = c.replace(oldSeed, 'SEED_ROOT="${SKILL_EVAL_SEED_ROOT:-/tmp/skill-eval-seedsrc}"');
c = c.replace('# run-ctx.sh —',
  '# run-ctx-v2.sh — КОПИЯ 2026-09-23 (собрана make-v2-runners.mjs): пул run-pool-ctx-v2.sh (промпт инлайн),\n' +
  '# засев в /tmp/skill-eval-seedsrc — не соседом снимка скилла: прогон листает родителя пути к снимку.\n' +
  '# run-ctx.sh —');
writeFileSync('run-ctx-v2.sh', c);
console.log('run-ctx-v2.sh и run-pool-ctx-v2.sh собраны');
