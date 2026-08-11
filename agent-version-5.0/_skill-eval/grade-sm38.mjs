// SM-38 — плотность карточки: доехали ли факты семантики внутрь блоков.
// Считает не ключи (это делают SM-29/полнота инвентаря), а ФАКТЫ, которых
// не вывести из заголовка. Якоря взяты из README фикстуры SM-NEUTRAL, где
// «один буллет Семантика = ровно один факт», поэтому счёт однозначен.
//
// Запуск: node agent-version-3.2/_skill-eval/grade-sm38.mjs <папка-прогонов>
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const runsDir = process.argv[2];
if (!runsDir) {
  console.error('нужен путь к папке прогонов');
  process.exit(1);
}
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// 14 якорей SM-38. Каждый — альтернативы написания одного и того же факта:
// грейдим факт, а не формулировку, иначе получим ложный красный на синониме.
const ANCHORS = [
  ['total без отменённых', /total[^\n]*отменённ|отменённ[^\n]*total|не включ[^\n]*отменённ/i],
  ['assignedVehicleId', /assignedVehicleId/],
  ['422 на доставленном', /422/],
  ['62 символа', /\b62\b/],
  ['номер ТТН', /ТТН|товарно-транспортн/i],
  ['blocked: true', /blocked/i],
  ['ИНН и 409', /409/],
  ['дата отправки', /дат[аы][^\n]*отправк|отправк[^\n]*дат/i],
  ['целиком или частично', /частичн/i],
  ['склад плюс окно', /окн[оа]/i],
  ['cancelled', /cancelled/i],
  ['releasedAt', /releasedAt/],
  ['180 дней', /\b180\b/],
  ['capacityKg', /capacityKg/i],
];

// Заражение примерами из инструкции (SM-46): появление любого = модель дописала
// пример вместо чтения кода.
const POISON = [/\/v1\/incidents/, /ЧОП/, /ГБР/, /\bchi\b/, /Kafka/];

function runsOf(d) {
  if (!isDir(d)) return [];
  return readdirSync(d)
    .filter((f) => /^run-\d+$/.test(f))
    .sort()
    .map((f) => join(d, f))
    .filter((p) => existsSync(join(p, 'answer.md')));
}

const runs = runsOf(runsDir);
if (!runs.length) {
  console.error(`в ${runsDir} нет прогонов с answer.md`);
  process.exit(1);
}

const perAnchor = new Map(ANCHORS.map(([n]) => [n, 0]));
let sumFacts = 0;

console.log(`=== SM-38 — ${runs.length} прогонов ===`);
for (const r of runs) {
  const t = read(join(r, 'answer.md'));
  const hit = ANCHORS.filter(([, re]) => re.test(t));
  hit.forEach(([n]) => perAnchor.set(n, perAnchor.get(n) + 1));
  sumFacts += hit.length;
  const poisoned = POISON.filter((re) => re.test(t)).length;
  const miss = ANCHORS.filter(([, re]) => !re.test(t)).map(([n]) => n);
  console.log(
    `${r.split(/[\\/]/).pop()}: фактов ${hit.length}/${ANCHORS.length}` +
      (poisoned ? `  ⚠ заражение примерами: ${poisoned}` : '') +
      (miss.length ? `  нет: ${miss.join(', ')}` : '')
  );
}

console.log('\n--- по якорям (в скольких прогонах доехал) ---');
for (const [n, c] of perAnchor) console.log(`${c}/${runs.length}  ${n}`);
console.log(
  `\nСРЕДНЯЯ ПЛОТНОСТЬ: ${(sumFacts / runs.length).toFixed(1)} из ${ANCHORS.length} фактов на прогон`
);
