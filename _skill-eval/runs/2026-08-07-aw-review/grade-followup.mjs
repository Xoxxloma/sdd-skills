// Грейдер двухходовой пробы: восстанавливается ли проверка на переспрос.
// Признак механический — вызов субагента после загрузки скилла. Что написано словами,
// не считается: весь этот раунд стоит на том, что рассказ о проверке и проверка — разное.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ev = (p) => {
  if (!existsSync(p)) return { tools: [], text: '' };
  const tools = []; let text = '';
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const s = l.trim(); if (!s.startsWith('{')) continue;
    let e; try { e = JSON.parse(s); } catch { continue; }
    if (e.type === 'result' && e.result) text = String(e.result);
    const c = e?.message?.content;
    if (Array.isArray(c)) for (const b of c) if (b?.type === 'tool_use')
      tools.push(b.name === 'Skill' ? `Skill:${b.input?.skill}` : b.name);
  }
  return { tools, text };
};
const done = (t) => { const i = t.indexOf('Skill:spec-review'); return i >= 0 && t.slice(i + 1).includes('Agent'); };

// Папки задаются аргументами. `followup-2` заведена отдельной НАРОЧНО: `claude -p --continue`
// продолжает последний разговор ДЛЯ ДАННОЙ РАБОЧЕЙ ДИРЕКТОРИИ. Переиспользуй я песочницы
// упавшего по лимиту пула — ход 2 мог бы прицепиться к оборванной сессии первой попытки, и
// замер молча поехал бы по чужому разговору. Свежие пути это исключают.
const DIRS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rows = [];
for (const dir of (DIRS.length ? DIRS : ['followup']))
for (const r of (existsSync(dir) ? readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).sort() : [])) {
  const d = join(dir, r);
  if (existsSync(join(d, '_api-failure.txt')) || existsSync(join(d, '_api-failure2.txt'))) continue;
  const t1 = ev(join(d, 'turn1.jsonl')), t2 = ev(join(d, 'turn2.jsonl'));
  if (!t2.text && !t2.tools.length) continue;
  // Субагент на ходу 2 может подниматься и без повторной загрузки скилла — он уже в контексте.
  const t2agent = t2.tools.includes('Agent');
  rows.push({ id: `${dir}/${r}`, ok1: done(t1.tools), ok2: t2agent, t2tools: t2.tools.join(' '), t2: t2.text });
}

const stalled = rows.filter((r) => !r.ok1);
console.log(`\nпрогонов измерено: ${rows.length}`);
console.log(`ход 1 — проверка прошла: ${rows.filter((r) => r.ok1).length}/${rows.length}`);
console.log(`ход 1 — ЗАВИС (проверки не было): ${stalled.length}/${rows.length}\n`);
console.log('=== что было на ходу 2 у ЗАВИСШИХ (это и есть ответ на вопрос) ===');
for (const r of stalled) {
  console.log(`\n  ${r.id}  субагент на ходу 2: ${r.ok2 ? 'ДА — проверка восстановилась' : 'НЕТ — ответил без проверки'}`);
  console.log(`  инструменты хода 2: ${r.t2tools || '(нет)'}`);
  console.log('  ответ: ' + (r.t2.split('\n').find((x) => x.trim()) || '').slice(0, 150));
}
if (stalled.length) {
  const rec = stalled.filter((r) => r.ok2).length;
  console.log(`\nИТОГ: восстановилось ${rec}/${stalled.length}, ответили без проверки ${stalled.length - rec}/${stalled.length}`);
} else console.log('\nзависших нет — на этом пуле дефект не воспроизвёлся');
