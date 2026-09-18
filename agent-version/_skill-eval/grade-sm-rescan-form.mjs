// grade-sm-rescan-form.mjs — правило 2 прежней карточки: «формулировка прежняя, форма по шаблону».
//
//   node grade-sm-rescan-form.mjs <раунд SM-REAL с плечом rescan>
//
// Для каждой песочницы `sandbox/rescan-N/w/AI-SDD/services/repairy-api.md` против `_prev/repairy-api.md`:
//   таблиц          — строк `| Поле | Тип |` в «Владеет данными» (ожидание 0);
//   значений        — полей-перечислений со значениями через `|` (ожидание ≥ 8: столько их в BR-REAL);
//   ключ не первым  — заголовков «Бизнес-правил», не начинающихся с `` ` ``, `сообщение «`, `ограничение «` (ожидание 0);
//   дословно        — доля строк `-`/`—` прежней карточки ВНЕ «Владеет данными», найденных в новой дословно
//                     (правило 2 держит формулировки; ожидание — не ниже, чем у плеча scan без прежней карточки).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const round = process.argv[2];
if (!round || !existsSync(round)) { console.error('нужна папка раунда'); process.exit(1); }

function section(text, title) {
  const m = text.match(new RegExp(`^##\\s+${title}\\s*$`, 'm'));
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+[^#]/m);
  return next === -1 ? rest : rest.slice(0, next);
}
const rows = (t) => t.split('\n').filter((l) => /^[-—]\s/.test(l)).map((l) => l.trim());

const sb = join(round, 'sandbox');
const dirs = existsSync(sb) ? readdirSync(sb).filter((d) => /^rescan-/.test(d) && statSync(join(sb, d)).isDirectory()).sort() : [];
if (!dirs.length) { console.log('плеча rescan нет'); process.exit(0); }
console.log(`\nпроба rescan-form, ${round}`);
console.log('песочница · таблиц · значений · ключ не первым · дословно (вне «Владеет») · карточка');
for (const d of dirs) {
  const card = join(sb, d, 'w', 'AI-SDD', 'services', 'repairy-api.md');
  const prev = join(sb, d, '_prev', 'repairy-api.md');
  if (!existsSync(card)) { console.log(`  ${d}: карточки нет`); continue; }
  const t = readFileSync(card, 'utf8');
  const own = section(t, 'Владеет данными');
  const tables = (own.match(/^\| Поле \| Тип/gm) || []).length;
  const withValues = (own.match(/^- `[A-Za-z_]+`:[^\n]*\|/gm) || []).length;
  const biz = section(t, 'Бизнес-правила');
  const badHeads = (biz.match(/^### /gm) || []).filter((h, i) => {
    const line = biz.split('\n').filter((l) => l.startsWith('### '))[i] || '';
    return !/^### (`|сообщение «|ограничение «)/.test(line);
  }).length;
  let verbatim = '—';
  if (existsSync(prev)) {
    const p = readFileSync(prev, 'utf8');
    const pOwn = section(p, 'Владеет данными');
    const pRows = rows(p.replace(pOwn, '')).filter((r) => r.length > 20);
    const hit = pRows.filter((r) => t.includes(r)).length;
    verbatim = pRows.length ? `${Math.round((100 * hit) / pRows.length)}% (${hit}/${pRows.length})` : '—';
  }
  const ok = tables === 0 && withValues >= 8 && badHeads === 0;
  console.log(`  ${d}: ${tables}${tables ? '❌' : ''} · ${withValues}${withValues < 8 ? '❌' : ''} · ${badHeads}${badHeads ? '❌' : ''} · ${verbatim} · ${ok ? '✅ форма по шаблону' : '❌'}`);
}
