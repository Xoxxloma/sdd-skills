// Счётчик ПРЕТЕНЗИЙ в отчёте (не пунктов вообще).
// Первая редакция считала заголовки девяти критериев Self-Review, включая пройденные, и дала
// 19 там, где претензий заметно меньше. Правило репы: счётчик валидируется на прочитанном глазами
// отчёте до публикации числа. Здесь: строка считается претензией, если она пронумерована или
// помечена ❌ И не помечена ✅/«ок».
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Прогоны, восстановленные ведущим агентом из текста ответа (харнесс не дал субагенту записать
// файл). Текст сжат при переносе, поэтому в счёт претензий они не идут: занизят.
const RECONSTRUCTED = new Set([
  'tier-b/eval-0-author-loop/run-05',
  'tier-b/eval-1-author-dirty/run-01',
  'tier-b/eval-1-author-dirty/run-04',
]);

const claims = (t) =>
  t.split('\n').filter((l) => {
    if (/✅|\bок\b|пройден/i.test(l)) return false;
    return /^\s*(?:#+\s*)?(?:\*\*)?\d+[.)]\s+\S/.test(l) || /❌/.test(l);
  }).length;

const rows = [];
for (const [label, dir] of [
  ['приёмка / loop', 'tier-a/eval-2-spec-loop'],
  ['приёмка / dirty', 'tier-a/eval-0-spec-dirty'],
  ['автор / loop', 'tier-b/eval-0-author-loop'],
  ['автор / dirty', 'tier-b/eval-1-author-dirty'],
]) {
  const nums = [];
  for (const r of readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory())) {
    if (RECONSTRUCTED.has(`${dir}/${r}`)) continue;
    const p = join(dir, r, 'outputs', 'report.md');
    if (existsSync(p)) nums.push(claims(readFileSync(p, 'utf8')));
  }
  nums.sort((a, b) => a - b);
  rows.push({
    ветка: label,
    прогонов: nums.length,
    претензий: nums.join(','),
    медиана: nums[Math.floor(nums.length / 2)],
    среднее: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1),
  });
}
console.table(rows);
