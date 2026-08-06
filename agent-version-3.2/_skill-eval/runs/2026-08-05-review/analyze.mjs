// Разбор ветки «автор» против ветки «приёмка».
// Три числа: сколько претензий в отчёте, как часто автор требует конкретику к чужому 🟡 INT-2
// (это подталкивание к выдумке) и как часто он объявляет ЗАКОННУЮ метку INT-2 нарушением
// (ошибка в другую сторону). Регулярки литеральные, проверены на прочитанных отчётах.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RECONSTRUCTED = new Set([
  'tier-b/eval-0-author-loop/run-05', 'tier-b/eval-1-author-dirty/run-01',
  'tier-b/eval-1-author-dirty/run-04',
]);

const claims = (t) => t.split('\n').filter((l) => {
  if (/✅|\bок\b|пройден/i.test(l)) return false;
  return /^\s*(?:#+\s*)?(?:\*\*)?\d+[.)]\s+\S/.test(l) || /❌/.test(l);
}).length;

// Требует дописать конкретику к INT-2: абзац про INT-2, где сказано, что примера/контракта НЕТ.
const wantsInt2Concrete = (t) =>
  /INT-2[^\n]{0,160}(?:отсутству|нет |не указан|не привед|требуется|нужно|добавить)[^\n]{0,80}(?:пример|JSON|json|контракт)/i.test(t) ||
  /(?:отсутству|нет|не привед)[^\n]{0,80}(?:пример|JSON)[^\n]{0,80}INT-2/i.test(t);

// Объявляет законную метку «🟡 подтверждено аналитиком» с путём нарушением.
const callsInt2Violation = (t) =>
  /INT-2[^\n]{0,200}(?:кардинальн|нарушени|запрещ|нельзя)/i.test(t) ||
  /(?:кардинальн|нарушени)[^\n]{0,150}INT-2/i.test(t);

const rows = [];
for (const [label, dir] of [
  ['приёмка / loop (тир A)', 'tier-a/eval-2-spec-loop'],
  ['приёмка / dirty (тир A)', 'tier-a/eval-0-spec-dirty'],
  ['автор / loop — до правки соседа', 'tier-b/eval-0-author-loop'],
  ['автор / dirty — до правки соседа', 'tier-b/eval-1-author-dirty'],
  ['автор / loop — новая база', 'tier-b2/eval-0-author-loop'],
  ['автор / dirty — новая база', 'tier-b2/eval-1-author-dirty'],
  ['автор / loop — ПОСЛЕ правки', 'tier-b3/eval-0-author-loop'],
  ['автор / dirty — ПОСЛЕ правки', 'tier-b3/eval-1-author-dirty'],
]) {
  const nums = []; let concrete = 0, viol = 0, n = 0;
  for (const r of readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory())) {
    const p = join(dir, r, 'outputs', 'report.md');
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    n += 1;
    if (wantsInt2Concrete(t)) concrete += 1;
    if (callsInt2Violation(t)) viol += 1;
    if (!RECONSTRUCTED.has(`${dir}/${r}`)) nums.push(claims(t));
  }
  nums.sort((a, b) => a - b);
  rows.push({
    ветка: label, прогонов: n,
    'медиана претензий': nums[Math.floor(nums.length / 2)],
    'просит конкретику к 🟡 INT-2': `${concrete}/${n}`,
    'зовёт законную 🟡 нарушением': `${viol}/${n}`,
  });
}
console.table(rows);
