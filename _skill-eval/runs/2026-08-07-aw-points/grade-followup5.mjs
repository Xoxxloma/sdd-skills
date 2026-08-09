// Грейдер ПРАВКИ 5: проверяется ли документ ЗАНОВО после доработки.
//
//   node grade-followup5.mjs --self-test
//   node grade-followup5.mjs <плечо> [<плечо> ...]
//
// Ход 1 — под-скилл записал спеку, оркестратор её принимает (в фикстуре три настоящих
// нарушения). Ход 2 — аналитик говорит «нажал Доработать, под-скилл переписал файл».
// Меряем ровно одно: поднялась ли приёмка ВТОРОЙ раз на переписанную редакцию.
//
// Пункты:
//   Х1-приёмка  — на ходу 1 приёмка доведена до субагента (иначе мерить нечего)
//   Х2-субагент — на ходу 2 поднят субагент. ЭТО ГЕЙТ: проверка состоялась.
//   Х2-скилл    — на ходу 2 `spec-review` вызван заново. Наблюдаем, не гейтим: скилл уже в
//                 контексте с хода 1, и повторный вызов не обязателен для того, чтобы
//                 проверка произошла.
//   Х2-строка   — в СВОИХ словах агента на ходу 2 есть строка результата приёмки.
//
// Как и весь раунд: считаем поток вызовов, а не пересказ. Текст берём только из сообщений
// `assistant` — в `user` приезжают загруженный скилл и отчёты субагентов (дефект С-7).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function readTurn(path) {
  // Поток хода после зачистки раунда не хранится: он весит 8 МБ на плечо и целиком выводим
  // в две плоские вытопки. Есть они — читаем их, грейд от этого не меняется.
  // Разделитель берём тот, что в пути: на Windows `join` даёт обратный слэш, и подстановка
  // по прямому молча не срабатывает — грейд печатает пустоту вместо чисел.
  const flat = path.replace(/([\\/])(turn[12])\.jsonl$/, (m, sep, t) => `${sep}_${t}_tools.txt`);
  if (!existsSync(path) && existsSync(flat)) {
    return {
      tools: readFileSync(flat, 'utf8').split(/\s+/).filter(Boolean),
      text: existsSync(flat.replace('_tools.txt', '_answer.md'))
        ? readFileSync(flat.replace('_tools.txt', '_answer.md'), 'utf8')
        : '',
    };
  }
  if (!existsSync(path)) return { tools: [], text: '' };
  const tools = [];
  const text = [];
  for (const l of readFileSync(path, 'utf8').split('\n')) {
    const s = l.trim();
    if (!s.startsWith('{')) continue;
    let e;
    try { e = JSON.parse(s); } catch { continue; }
    const c = e?.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b?.type === 'tool_use') tools.push(b.name === 'Skill' ? `Skill:${b.input?.skill}` : b.name);
      if (b?.type === 'text' && b.text && e.type === 'assistant') text.push(b.text);
    }
  }
  return { tools, text: text.join('\n\n') };
}

export function gradeRun(t1, t2) {
  const i1 = t1.tools.indexOf('Skill:spec-review');
  return {
    X1_review: i1 >= 0 && t1.tools.slice(i1 + 1).includes('Agent'),
    X2_agent: t2.tools.includes('Agent'),
    X2_skill: t2.tools.includes('Skill:spec-review'),
    X2_line: /приёмк/i.test(t2.text) && /нарушени/i.test(t2.text),
  };
}

function selfTest() {
  const T = (tools, text = '') => ({ tools, text });
  const cases = [
    // Как задумано: ход 1 проверил, ход 2 проверил заново и назвал строку.
    ['recheck_full',
      T(['Read', 'Skill:spec-review', 'Agent']),
      T(['Skill:spec-review', 'Agent'], 'приёмка `docs/RMS-4021/technical_specification.md`: нарушений нет'),
      { X1_review: true, X2_agent: true, X2_skill: true, X2_line: true }],
    // Скилл уже в контексте, повторного вызова нет — но субагент поднят. Гейт ЗЕЛЁНЫЙ:
    // проверка состоялась. Слить Х2-субагент с Х2-скиллом значило бы засчитать это провалом.
    ['recheck_no_reload',
      T(['Skill:spec-review', 'Agent']),
      T(['Agent'], 'приёмка `docs/RMS-4021/technical_specification.md`: 1 нарушение'),
      { X1_review: true, X2_agent: true, X2_skill: false, X2_line: true }],
    // ИЗМЕРЯЕМЫЙ ПРОВАЛ: доработку объявили сделанной, проверять не стали.
    ['no_recheck',
      T(['Skill:spec-review', 'Agent']),
      T(['Read'], 'Спека переписана, нарушения закрыты. Что дальше?'),
      { X1_review: true, X2_agent: false, X2_skill: false, X2_line: false }],
    // Ложный зелёный: агент РАССКАЗАЛ про повторную приёмку, субагента не поднял.
    // Строка есть, гейт красный — ровно та пара, ради которой пункты разведены.
    ['told_not_done',
      T(['Skill:spec-review', 'Agent']),
      T(['Skill:spec-review'], 'приёмка `docs/RMS-4021/technical_specification.md`: нарушений нет'),
      { X1_review: true, X2_agent: false, X2_skill: true, X2_line: true }],
    // Ход 1 не состоялся — мерить нечего, прогон в гейт не идёт.
    ['turn1_stalled',
      T(['Skill:spec-review']),
      T(['Skill:spec-review', 'Agent'], 'приёмка: нарушений нет'),
      { X1_review: false, X2_agent: true }],
    // Строку считаем только по СВОИМ словам: текст из `user` в `text` не попадает вовсе.
    ['line_from_user_ignored',
      T(['Skill:spec-review', 'Agent']),
      T(['Agent'], ''),
      { X2_agent: true, X2_line: false }],
  ];
  let bad = 0;
  for (const [name, t1, t2, want] of cases) {
    const got = gradeRun(t1, t2);
    for (const [k, v] of Object.entries(want)) {
      const ok = got[k] === v;
      if (!ok) bad++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}.${k}: ждали ${v}, получили ${got[k]}`);
    }
  }
  console.log(bad ? `\nСАМОТЕСТ ПРОВАЛЕН: ${bad}` : '\nСАМОТЕСТ ПРОЙДЕН.');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();

const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rows = [];
for (const dir of dirs) {
  if (!existsSync(dir)) { console.log(`нет плеча: ${dir}`); continue; }
  for (const r of readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).sort()) {
    const d = join(dir, r);
    if (['_api-failure.txt', '_api-failure2.txt', '_incomplete.txt'].some((m) => existsSync(join(d, m)))) continue;
    const t1 = readTurn(join(d, 'turn1.jsonl'));
    const t2 = readTurn(join(d, 'turn2.jsonl'));
    if (!t2.tools.length && !t2.text) continue;
    rows.push({ id: `${dir}/${r}`, g: gradeRun(t1, t2), n2: t2.tools.length });
  }
}

if (!rows.length) { console.log('прогонов не найдено'); process.exit(0); }

const cnt = (k) => rows.filter((r) => r.g[k]).length;
console.log(`\nпрогонов измерено: ${rows.length}\n`);
console.log('Х1 приёмка на ходу 1 доведена до субагента'.padEnd(46) + `${cnt('X1_review')}/${rows.length}`.padStart(9));
console.log('Х2 ПОВТОРНАЯ приёмка поднята (ГЕЙТ)'.padEnd(46) + `${cnt('X2_agent')}/${rows.length}`.padStart(9));
console.log('Х2 `spec-review` вызван заново (наблюдаем)'.padEnd(46) + `${cnt('X2_skill')}/${rows.length}`.padStart(9));
console.log('Х2 строка результата в своих словах'.padEnd(46) + `${cnt('X2_line')}/${rows.length}`.padStart(9));
console.log();
for (const r of rows) {
  console.log(' ', r.id.padEnd(22),
    `Х1=${r.g.X1_review ? 'да' : 'НЕТ'}`,
    `Х2-субагент=${r.g.X2_agent ? 'да' : 'НЕТ'}`,
    `Х2-скилл=${r.g.X2_skill ? 'да' : 'нет'}`,
    `Х2-строка=${r.g.X2_line ? 'да' : 'НЕТ'}`,
    `| вызовов на ходу 2: ${r.n2}`,
    !r.g.X2_agent && r.g.X2_line ? '| ЛОЖНЫЙ ЗЕЛЁНЫЙ: сказал, но не проверил' : '');
}
