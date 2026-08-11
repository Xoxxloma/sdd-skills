#!/usr/bin/env node
// Грейдер проб project-conventions. Считает ТОЛЬКО механически проверяемое по файлам на диске.
// Смысловые проверки (какие вопросы заданы, предложены ли расшифровки) грейдятся по тексту
// прогона отдельно — сюда они не идут намеренно: грейдить формулировку отчёта регуляркой значит
// мерить не результат, а красноречие.
//
// Запуск: node grade-pc.mjs <runRoot> <fixturesRoot>
//   runRoot      — папка с eval-<N>/<config>/work
//   fixturesRoot — оригиналы фикстур, для сверки «карточки не изменены»

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [, , RUN_ROOT, FIX_ROOT] = process.argv;
if (!RUN_ROOT || !FIX_ROOT) {
  console.error('usage: node grade-pc.mjs <runRoot> <fixturesRoot>');
  process.exit(2);
}

const FIXTURE_OF = { 0: 'PC-BASIC', 1: 'PC-SPLIT', 2: 'PC-THIN', 3: 'PC-AGAIN', 4: 'PC-EMPTY', 5: 'PC-FILTER' };

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Заголовки слотов в CONVENTIONS.md: «### 1. Путь и версионирование» … «### 7. …»
const SLOT_HEADING = /^###\s*([1-7])\.\s+(.+)$/gm;
// Строка «не определено» с причиной: после двоеточия должен стоять непустой текст.
const UNDEFINED_WITH_REASON = /не определено:\s*\S+/;

function slotsOf(text) {
  const map = new Map();
  for (const m of text.matchAll(SLOT_HEADING)) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const next = rest.search(/^###\s/m);
    map.set(num, (next === -1 ? rest : rest.slice(0, next)).trim());
  }
  return map;
}

function gradeEval(id, config) {
  const work = join(RUN_ROOT, `eval-${id}`, config, 'work');
  const fixture = join(FIX_ROOT, FIXTURE_OF[id]);
  const conv = read(join(work, 'CONVENTIONS.md'));
  const terms = read(join(work, 'TERMS.md'));
  const slots = conv ? slotsOf(conv) : new Map();
  const checks = [];
  const add = (text, passed, evidence) => checks.push({ text, passed, evidence });

  // --- общее для всех проб: источники не тронуты ---
  const changed = [];
  for (const f of walk(join(work, 'services'))) {
    const rel = relative(join(work, 'services'), f);
    const orig = read(join(fixture, 'services', rel));
    if (orig === null) changed.push(`${rel} (нет в фикстуре)`);
    else if (orig !== read(f)) changed.push(`${rel} (содержимое отличается)`);
  }
  add('Карточки services/*.md и manifest.yaml не изменены', changed.length === 0,
    changed.length ? `изменено: ${changed.join(', ')}` : 'побайтно совпадают с фикстурой');

  // На диск от скилла уходят ровно два файла. Третий (report.txt и подобные) — мусор в репозитории.
  const ALLOWED = new Set(['CONVENTIONS.md', 'TERMS.md']);
  const stray = walk(work)
    .map((f) => relative(work, f))
    .filter((rel) => !rel.startsWith('services') && !ALLOWED.has(rel));
  add('Лишних файлов не создано (только CONVENTIONS.md и TERMS.md)', stray.length === 0,
    stray.length ? `лишние: ${stray.join(', ')}` : 'посторонних файлов нет');

  if (id === 4) {
    add('CONVENTIONS.md не создан', conv === null, conv ? 'файл есть' : 'файла нет');
    add('TERMS.md не создан', terms === null, terms ? 'файл есть' : 'файла нет');
    const extra = walk(work).map((f) => relative(work, f));
    add('Никаких других файлов не создано', extra.length === 0,
      extra.length ? `создано: ${extra.join(', ')}` : 'директория пуста');
    return checks;
  }

  if (id === 1) {
    add('CONVENTIONS.md в этом ходе НЕ создан', conv === null, conv ? 'файл есть' : 'файла нет');
    add('TERMS.md в этом ходе НЕ создан', terms === null, terms ? 'файл есть' : 'файла нет');
    return checks;
  }

  // --- пробы, где файл обязан появиться (0, 2, 3) ---
  add('CONVENTIONS.md создан рядом с services/, не внутри неё', conv !== null,
    conv === null ? 'файла нет' : `${conv.split('\n').length} строк`);
  add('CONVENTIONS.md не лежит внутри services/', !existsSync(join(work, 'services', 'CONVENTIONS.md')),
    existsSync(join(work, 'services', 'CONVENTIONS.md')) ? 'лежит внутри services/' : 'ок');
  if (!conv) return checks;

  const missing = [1, 2, 3, 4, 5, 6, 7].filter((n) => !slots.has(n));
  add('В файле присутствуют все семь слотов', missing.length === 0,
    missing.length ? `нет слотов: ${missing.join(', ')}` : 'все семь на месте');

  const noReason = [...slots.entries()]
    .filter(([, body]) => /не определено/.test(body) && !UNDEFINED_WITH_REASON.test(body))
    .map(([n]) => n);
  add('У каждой строки «не определено» названа причина', noReason.length === 0,
    noReason.length ? `без причины: слоты ${noReason.join(', ')}` : 'причина везде');

  const hasHumanSections = /^##\s+Числа\s*$/m.test(conv) && /^##\s+Ситуативные\s*$/m.test(conv);
  add('Секции «Числа» и «Ситуативные» присутствуют', hasHumanSections,
    hasHumanSections ? 'обе на месте' : 'одной или обеих нет');

  const filled = [...slots.entries()].filter(([, b]) => !/не определено/.test(b)).map(([n]) => n);
  const undef = [...slots.entries()].filter(([, b]) => /не определено/.test(b)).map(([n]) => n);

  if (id === 0) {
    add('Слот 3 «Пагинация» — «не определено» с причиной «наблюдений 1»',
      /наблюдений\s*1/.test(slots.get(3) ?? ''), slots.get(3) ?? '<нет слота>');
    for (const n of [1, 2, 4, 5, 6, 7]) {
      add(`Слот ${n} содержит правило, а не «не определено»`, filled.includes(n), slots.get(n) ?? '<нет слота>');
    }
    add('Слот 7 несёт ДВА правила (поля и значения enum отдельно)',
      (slots.get(7) ?? '').split('\n').filter((l) => l.trim() && !l.startsWith('_')).length >= 2,
      slots.get(7) ?? '<нет слота>');
    add('incident-web не назван источником ни в одном слоте',
      !/incident-web/.test(conv), /incident-web/.test(conv) ? 'встречается в файле' : 'не встречается');
    add('dispatch назван источником хотя бы одного слота из 5–7',
      /dispatch/.test([5, 6, 7].map((n) => slots.get(n) ?? '').join('\n')),
      [5, 6, 7].map((n) => `${n}: ${slots.get(n) ?? ''}`).join(' | '));
    add('dispatch НЕ назван источником слотов 1–4',
      !/dispatch/.test([1, 2, 3, 4].map((n) => slots.get(n) ?? '').join('\n')),
      [1, 2, 3, 4].map((n) => `${n}: ${slots.get(n) ?? ''}`).join(' | '));
    add('ui-kit (lib) не назван источником ни одного слота',
      !/ui-kit/.test(conv), /ui-kit/.test(conv) ? 'встречается в файле' : 'не встречается');
    add('Чужие значения ui-kit не протекли в правила (unixtime, NEW|IN_PROGRESS|CLOSED)',
      !/unixtime|IN_PROGRESS/.test(conv), /unixtime|IN_PROGRESS/.test(conv) ? 'протекли' : 'нет');
    add('TERMS.md создан', terms !== null, terms === null ? 'файла нет' : `${terms.split('\n').length} строк`);
    // ВНИМАНИЕ: \w в JS не покрывает кириллицу — «групп\w*» не совпадёт с «группа».
    // Поэтому две независимые проверки на литералы, без классов символов.
    add('ГБР записан в TERMS.md с расшифровкой из карточки, без вопроса',
      terms !== null && terms.includes('ГБР') && terms.includes('быстрого реагирования'),
      terms === null ? 'TERMS.md нет' : (terms.split('\n').find((l) => l.includes('ГБР')) ?? '<строки нет>'));
  }

  if (id === 5) {
    const sit = (conv.split(/^##\s+Ситуативные\s*$/m)[1] ?? '');
    add('Стыковые слоты заполнены правилами (не все «не определено»)', filled.length >= 3,
      `заполнено слотов: ${filled.join(', ') || 'нет'}`);
    add('Правило про курсорную пагинацию записано', /nextCursor/.test(conv),
      slots.get(3) ?? sit.trim().slice(0, 120));
    add('Факт сервиса про geo НЕ записан в файл',
      !/зона пересчитыва|пересчитывается только диспетчером/i.test(conv),
      /пересчитывается только диспетчером/i.test(conv) ? 'записан' : 'нет');
    add('Легаси-эндпоинт /v1/session НЕ записан в файл',
      !/v1\/session\b/.test(conv), /v1\/session\b/.test(conv) ? 'записан' : 'нет');
  }

  if (id === 2) {
    add('Ни одного стыкового правила не записано', filled.length === 0,
      filled.length ? `заполнены слоты: ${filled.join(', ')}` : 'все семь «не определено»');
    add('Слот 3 имеет причину «наблюдений нет»', /наблюдений\s*нет/.test(slots.get(3) ?? ''),
      slots.get(3) ?? '<нет слота>');
    const oneEach = [1, 2, 4, 5, 6, 7].filter((n) => /наблюдений\s*1/.test(slots.get(n) ?? ''));
    add('Слоты 1, 2, 4–7 имеют причину «наблюдений 1»', oneEach.length === 6,
      `с причиной «наблюдений 1»: ${oneEach.join(', ') || 'нет'}`);
  }

  if (id === 3) {
    const HUMAN_SLOT1 = 'Путь начинается с `/v1/`, ресурс во множественном числе, составные слова через дефис.';
    const HUMAN_NUM = 'Таймаут первого запроса — 8 с, последующих — 3 с.';
    const HUMAN_SIT = 'Списки отдаются только курсорной пагинацией, курсор в поле `nextCursor`.';
    // Якорь: без него все проверки сохранности проходят просто потому, что файл не трогали.
    const origConv = read(join(fixture, 'CONVENTIONS.md'));
    add('CONVENTIONS.md изменён относительно исходного — дописывание произошло', conv !== origConv,
      conv === origConv ? 'файл байт в байт как в фикстуре: скилл ничего не дописал' : 'файл отличается');
    add('Строка слота 1, написанная человеком, сохранена дословно', conv.includes(HUMAN_SLOT1), HUMAN_SLOT1);
    add('Секция «Числа» не изменена', conv.includes(HUMAN_NUM), HUMAN_NUM);
    add('Секция «Ситуативные» не изменена', conv.includes(HUMAN_SIT), HUMAN_SIT);
    add('В слот 2 дописано правило (был «не определено»)', filled.includes(2), slots.get(2) ?? '<нет слота>');
    add('В слот 4 дописано правило', filled.includes(4), slots.get(4) ?? '<нет слота>');
    add('В слот 6 дописано правило', filled.includes(6), slots.get(6) ?? '<нет слота>');
    add('Слот 3 остался без правила (расхождение nextCursor против offset/limit)',
      undef.includes(3), slots.get(3) ?? '<нет слота>');
    add('Слот 5 остался «наблюдений нет» (nextCursor не засчитан)',
      /наблюдений\s*нет/.test(slots.get(5) ?? ''), slots.get(5) ?? '<нет слота>');
    const origTerms = read(join(fixture, 'TERMS.md')) ?? '';
    const gbrLine = origTerms.split('\n').find((l) => l.startsWith('**ГБР**')) ?? '';
    add('Существующая строка ГБР в TERMS.md не изменена',
      terms !== null && terms.includes(gbrLine) && gbrLine.length > 0, gbrLine || '<не найдена в фикстуре>');
  }

  return checks;
}

// Конфигурации не зашиты: берём все подпапки eval-N, у которых внутри есть work/.
// Так один и тот же грейдер считает и одиночный прогон, и серию повторов (run-1, run-2, …).
const configsOf = (id) => {
  const dir = join(RUN_ROOT, `eval-${id}`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(join(dir, n, 'work'))).sort();
};

const report = [];
for (const id of Object.keys(FIXTURE_OF)) {
  for (const config of configsOf(id)) {
    if (!existsSync(join(RUN_ROOT, `eval-${id}`, config))) continue;
    const checks = gradeEval(Number(id), config);
    const passed = checks.filter((c) => c.passed).length;
    report.push({ run_id: `eval-${id}-${config}`, fixture: FIXTURE_OF[id], passed, total: checks.length, checks });
  }
}

for (const r of report) {
  console.log(`\n=== ${r.run_id} (${r.fixture}) — ${r.passed}/${r.total} ===`);
  for (const c of r.checks) console.log(`  ${c.passed ? 'PASS' : 'FAIL'}  ${c.text}\n        ${String(c.evidence).replace(/\n/g, ' ⏎ ').slice(0, 160)}`);
}
console.log('\n' + JSON.stringify(report.map(({ run_id, passed, total }) => ({ run_id, passed, total })), null, 2));
