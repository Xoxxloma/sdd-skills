// Грейдер пробы AW-1: «под-скилл записал БТ — что делает оркестратор».
// Плечи: base (снимок до правки) против fixed (после). Одни и те же прогоны дают
// и ЭФФЕКТ правки, и РЕГРЕСС по прежнему поведению.
//
//   node grade-aw.mjs            # числа по обоим плечам
//   node grade-aw.mjs --self-test
//
// Э-1 приёмка вызвана        — Skill:spec-review в потоке вызовов
// Э-2 строка результата есть — в ответе строка вида «приёмка <путь>: …»
// Э-3 не завис на ожидании   — не объявил приёмку асинхронной вместо того, чтобы дать строку
// Р-1 разрез исполняется     — назван task-decomposition-doc
// Р-2 сам файлов не пишет    — в потоке нет Write/Edit (правило 1 оркестратора)
//
// Э-2 и Э-3 разведены нарочно: «вызвал скилл» и «довёл его до результата» — разные события,
// и на пилоте они разошлись. Слить их в один пункт значит зачесть половину работы за целую.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const has = (s, ...subs) => subs.every((x) => s.toLowerCase().includes(x.toLowerCase()));
const hasAny = (s, ...subs) => subs.some((x) => s.toLowerCase().includes(x.toLowerCase()));

export function gradeRun(answer, tools) {
  const t = tools.split(/\s+/).filter(Boolean);
  const at = t.indexOf('Skill:spec-review');

  // Э-3 МЕХАНИЧЕСКИЙ, А НЕ ПО ФОРМУЛИРОВКЕ. Первая редакция ловила «жду результат» списком
  // подстрок и пропустила `run-05` с «дожидаюсь результата» — грейдер сказал 8/10 там, где
  // на деле 7/10. Перечислять способы сказать одно и то же бесперспективно: их столько,
  // сколько у модели синонимов. Признак того, что приёмка реально состоялась, один и он в
  // потоке — после загрузки скилла поднят субагент. Инструкция загружена и на этом всё —
  // проверки не было, что бы ни говорил текст ответа.
  const completed = at >= 0 && t.slice(at + 1).includes('Agent');

  // Э-2 РАЗВЕДЁН НА ДВА. Первая редакция считала «результат назван», если рядом попались
  // слова «приёмка» и «нарушени», — и зачла 6/10 там, где предписанную форму дали двое.
  // Щедрый детектор на целевой метрике опаснее строгого: он показывает, что править нечего.
  // E2_strict — форма из скилла: документ назван ПУТЁМ в самой строке.
  // E2_any    — результат сообщён хоть как-то. Разница между ними и есть размер дефекта формы.
  const strict = /приёмка\s+[`"']?[^\s:]*(business_requirements|technical_specification|stages)[^\s:]*[`"']?\s*:/i;
  const lineAny = has(answer, 'приёмк', 'нарушени');
  return {
    E1_called: at >= 0,
    E2_strict: completed && strict.test(answer),
    E2_any: completed && lineAny,
    E3_completed: completed,
    R1_decomp: hasAny(answer, 'task-decomposition-doc'),
    R2_no_write: !t.some((x) => x === 'Write' || x === 'Edit' || x === 'NotebookEdit'),
  };
}

function arm(dir) {
  const rows = [];
  for (const r of readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).sort()) {
    const a = join(dir, r, 'answer.md'), tl = join(dir, r, '_tools.txt');
    if (existsSync(join(dir, r, '_api-failure.txt'))) continue;
    if (!existsSync(a) || !existsSync(tl)) continue;
    rows.push({ id: r, g: gradeRun(readFileSync(a, 'utf8'), readFileSync(tl, 'utf8')) });
  }
  return rows;
}

const KEYS = [
  ['E1_called', 'Э-1 приёмка вызвана'],
  ['E3_completed', 'Э-3 приёмка доведена до субагента'],
  ['E2_strict', 'Э-2с строка СТРОГО по форме (путь в строке)'],
  ['E2_any', 'Э-2л результат назван хоть как-то'],
  ['R1_decomp', 'Р-1 назван task-decomposition-doc'],
  ['R2_no_write', 'Р-2 сам файлов не писал'],
];

function selfTest() {
  const good = gradeRun('приёмка `docs/ARS-81/business_requirements.md`: нарушений нет\n\nЗапускаю `task-decomposition-doc`.', 'Read Skill:spec-review Agent Read');
  const stall = gradeRun('Жду результат приёмки spec-review. Потом запущу `task-decomposition-doc`.', 'Read Skill:spec-review');
  const base = gradeRun('Вижу §4.5 — три слайса. Запускаю `task-decomposition-doc`.', 'Read Read Skill:task-decomposition-doc');
  const wrote = gradeRun('приёмка: нарушений нет. task-decomposition-doc', 'Skill:spec-review Agent Write');
  // Ключевой случай самотеста: «Приёмка завершена: нарушений нет» — результат сообщён,
  // но документ не назван. Строгий пункт обязан покраснеть, мягкий — нет. Именно этой
  // пары не хватало первой редакции, и она объявила дефект формы несуществующим.
  const loose = gradeRun('Приёмка завершена: нарушений нет.\n\nЗапускаю `task-decomposition-doc`.', 'Skill:spec-review Agent Read');
  const want = [
    ['good', good, { E1_called: true, E2_strict: true, E2_any: true, E3_completed: true, R1_decomp: true, R2_no_write: true }],
    ['loose', loose, { E1_called: true, E2_strict: false, E2_any: true, E3_completed: true }],
    ['stall', stall, { E1_called: true, E2_strict: false, E2_any: false, E3_completed: false, R1_decomp: true, R2_no_write: true }],
    ['base', base, { E1_called: false, E2_strict: false, E2_any: false, R1_decomp: true, R2_no_write: true }],
    ['wrote', wrote, { E1_called: true, E2_any: true, R2_no_write: false }],
  ];
  let bad = 0;
  for (const [n, got, exp] of want)
    for (const [k, v] of Object.entries(exp)) {
      const ok = got[k] === v; if (!ok) bad++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${n}.${k}: ждали ${v}, получили ${got[k]}`);
    }
  console.log(bad ? `\nСАМОТЕСТ ПРОВАЛЕН: ${bad}` : '\nСАМОТЕСТ ПРОЙДЕН.');
  process.exit(bad ? 1 : 0);
}

if (process.argv[2] === '--self-test') selfTest();

// Плечи задаются аргументами: node grade-aw.mjs base fixed fixed-r2
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arms = (names.length ? names : ['base', 'fixed']).filter((n) => existsSync(n)).map((n) => ({ n, rows: arm(n) }));

console.log('\nпрогонов: ' + arms.map((a) => `${a.n} ${a.rows.length}`).join(', ') + '\n');
console.log('пункт'.padEnd(44) + arms.map((a) => a.n.padStart(11)).join(''));
console.log('-'.repeat(44 + 11 * arms.length));
for (const [k, label] of KEYS) {
  console.log(label.padEnd(44) + arms.map((a) => `${a.rows.filter((r) => r.g[k]).length}/${a.rows.length}`.padStart(11)).join(''));
}
for (const a of arms) {
  console.log(`\n--- по прогонам: ${a.n} ---`);
  for (const r of a.rows) console.log(' ', r.id, KEYS.map(([k]) => `${k.replace('_', '')}=${r.g[k] ? 'да' : 'НЕТ'}`).join(' '));
}
