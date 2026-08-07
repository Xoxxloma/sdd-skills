// Грейдер замера «автосрабатывание и делегирование приёмки».
// Читает ПОТОК ВЫЗОВОВ (stream.jsonl), а не текст ответа: агент может рассказать о запуске
// приёмки, не запустив её, и наоборот — правило репы «грейдить файл, а не формулировку».
//
//   node _skill-eval/grade-trigger.mjs <папка-плеча>
//   node _skill-eval/grade-trigger.mjs --inspect <папка-плеча>   # какие инструменты вообще звались
//   node _skill-eval/grade-trigger.mjs --self-test               # валидация на известном результате
//
// Что считается:
//   RT-0  прогон состоялся      — спека записана (Write/Edit по technical_specification.md)
//   RT-1  приёмка вызвана       — вызов инструмента Skill с именем spec-review
//   RT-1b приёмка прочитана     — SKILL.md приёмки открыт Read'ом (другой механизм, считаем отдельно)
//   RT-2  делегирование         — после запуска приёмки есть вызов субагента (Agent/Task)
//   RT-3  не читал сам          — после запуска приёмки ведущий агент НЕ открывал артефакт
//
// ОКНО В RT-2/RT-3 ОБЯЗАТЕЛЬНО. Автор спеки легитимно читает и пишет technical_specification.md,
// пока он её автор. Нарушение — только чтение ПОСЛЕ того, как он надел шляпу проверяющего.
// Без окна грейдер покрасил бы красным каждый прогон, где скилл вообще отработал.

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const ARTIFACT = /technical_specification\.md$/i;
const REVIEW_SKILL_FILE = /[\\/]skills[\\/]spec-review[\\/]SKILL\.md$/i;

function toolEvents(streamPath) {
  const out = [];
  const raw = readFileSync(streamPath, 'utf8').split('\n');
  for (const line of raw) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    let ev;
    try { ev = JSON.parse(s); } catch { continue; }
    const content = ev?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      out.push({ name: String(block.name ?? ''), input: block.input ?? {} });
    }
  }
  return out;
}

// Путь у разных инструментов лежит в разных полях — собираем всё, что похоже на путь,
// иначе Read по file_path зачтётся, а Read по path молча нет.
function pathsOf(input) {
  const vals = [];
  for (const k of ['file_path', 'path', 'filePath', 'notebook_path']) {
    if (typeof input?.[k] === 'string') vals.push(input[k]);
  }
  return vals;
}

function skillNameOf(input) {
  for (const k of ['skill', 'name', 'skill_name']) {
    if (typeof input?.[k] === 'string') return input[k];
  }
  return '';
}

export function gradeRun(streamPath) {
  const ev = toolEvents(streamPath);

  const wroteSpec = ev.some(
    (e) => (e.name === 'Write' || e.name === 'Edit' || e.name === 'NotebookEdit') &&
           pathsOf(e.input).some((p) => ARTIFACT.test(p)),
  );

  const firedIdx = ev.findIndex(
    (e) => e.name === 'Skill' && /spec-review/i.test(skillNameOf(e.input)),
  );
  const readSkillIdx = ev.findIndex(
    (e) => e.name === 'Read' && pathsOf(e.input).some((p) => REVIEW_SKILL_FILE.test(p)),
  );

  // Точка, с которой агент считается проверяющим: что случилось раньше — вызов скилла
  // или чтение его инструкции. Если ни того ни другого, окна нет вовсе.
  const marks = [firedIdx, readSkillIdx].filter((i) => i >= 0);
  const startIdx = marks.length ? Math.min(...marks) : -1;
  const after = startIdx >= 0 ? ev.slice(startIdx + 1) : [];

  // ВЫЗОВЫ СУБАГЕНТА ЛЕЖАТ В ТОМ ЖЕ ПОТОКЕ, что и вызовы ведущего, и ничем в нём не
  // помечены. Субагент по промпту Шага 2 обязан прочитать чек-лист, артефакт и источник —
  // то есть после делегирования Read артефакта не просто законен, он предписан.
  // Первая редакция грейдера этого не учла и объявила нарушением все 10 прогонов из 10.
  // Поэтому окно «ведущий читает сам» закрывается ПЕРВЫМ вызовом субагента: всё, что
  // после, авторству ведущего не приписывается. Субагента не было вовсе — окно до конца
  // потока, и тогда Read артефакта действительно его.
  const relIdx = after.findIndex((e) => AGENT_TOOLS.has(e.name));
  const leadWindow = relIdx >= 0 ? after.slice(0, relIdx) : after;

  return {
    tools: ev.length,
    RT0_ran: wroteSpec,
    RT1_skill_called: firedIdx >= 0,
    RT1b_skill_read: readSkillIdx >= 0,
    RT2_delegated: startIdx >= 0 && relIdx >= 0,
    RT3_no_self_read:
      startIdx >= 0 &&
      !leadWindow.some((e) => e.name === 'Read' && pathsOf(e.input).some((p) => ARTIFACT.test(p))),
    toolNames: [...new Set(ev.map((e) => e.name))],
  };
}

function runsOf(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => /^run-\d+$/.test(f))
    .sort()
    .map((f) => ({ id: f, dir: join(dir, f), stream: join(dir, f, 'stream.jsonl') }));
}

function report(dir, seeded = false) {
  const all = runsOf(dir);
  const measured = [];
  let apiFail = 0, noStream = 0;
  for (const r of all) {
    if (existsSync(join(r.dir, '_api-failure.txt'))) { apiFail++; continue; }
    if (!existsSync(r.stream) || statSync(r.stream).size === 0) { noStream++; continue; }
    measured.push({ ...r, g: gradeRun(r.stream) });
  }

  console.log(`\nплечо: ${dir}`);
  console.log(`папок: ${all.length}, отказ API: ${apiFail}, без потока: ${noStream}, измерено: ${measured.length}`);
  if (!measured.length) return;

  // Прогон, не записавший спеку, до вопроса о приёмке не доехал — он «не измерено»,
  // а не «приёмка не сработала». Смешать эти два исхода значит покрасить чужой отказ.
  // В контрольном плече спека засеяна, а не написана: там этот гейт не применяется,
  // иначе он отсеял бы ВСЕ прогоны и напечатал идеальный ложный «нечего мерить».
  const valid = seeded ? measured : measured.filter((m) => m.g.RT0_ran);
  const stalled = measured.length - valid.length;
  if (stalled) console.log(`из них не дописали спеку (в счёт не идут): ${stalled}`);
  console.log('');

  for (const m of measured) {
    const g = m.g;
    const mark = (b) => (b ? 'да ' : 'НЕТ');
    console.log(
      `  ${m.id}  спека=${mark(g.RT0_ran)} скилл-вызван=${mark(g.RT1_skill_called)} ` +
      `инструкция-прочитана=${mark(g.RT1b_skill_read)} делегировал=${mark(g.RT2_delegated)} ` +
      `не-читал-сам=${mark(g.RT3_no_self_read)}  (вызовов: ${g.tools})`,
    );
  }

  const pct = (n) => `${n}/${valid.length}`;
  const cnt = (f) => valid.filter(f).length;
  console.log('\n=== ИТОГ (только доехавшие прогоны) ===');
  console.log(`  RT-1  приёмка вызвана как скилл:            ${pct(cnt((m) => m.g.RT1_skill_called))}`);
  console.log(`  RT-1b инструкция приёмки прочитана Read'ом: ${pct(cnt((m) => m.g.RT1b_skill_read))}`);
  console.log(`  RT-1* задействована хоть как-то:            ${pct(cnt((m) => m.g.RT1_skill_called || m.g.RT1b_skill_read))}`);
  const engaged = valid.filter((m) => m.g.RT1_skill_called || m.g.RT1b_skill_read);
  const pctE = (n) => `${n}/${engaged.length}`;
  console.log(`\n  из задействованных (${engaged.length}):`);
  console.log(`  RT-2  поднял субагента:                     ${pctE(engaged.filter((m) => m.g.RT2_delegated).length)}`);
  console.log(`  RT-3  не читал артефакт сам после запуска:  ${pctE(engaged.filter((m) => m.g.RT3_no_self_read).length)}`);
}

// --- самотест: грейдер обязан различать заведомо верный и заведомо сломанный поток ---
function line(name, input) {
  return JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
}
function selfTest() {
  const tmp = join(process.cwd(), '_skill-eval', '.selftest-trigger');
  rmSync(tmp, { recursive: true, force: true });

  const ideal = [
    line('Read', { file_path: '/sb/docs/ARS-57/business_requirements.md' }),
    line('Write', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Skill', { skill: 'spec-review' }),
    line('Agent', { prompt: 'проверь по чек-листу' }),
  ].join('\n');

  // Сломанный: приёмка «запущена», но субагента нет, а артефакт ведущий открыл сам —
  // ровно тот отказ, ради которого замер и ставится.
  const broken = [
    line('Write', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Skill', { skill: 'spec-review' }),
    line('Read', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
  ].join('\n');

  // Не доехал: спеки нет вовсе — обязан выпасть из счёта, а не в красное.
  const stalled = [line('Read', { file_path: '/sb/docs/ARS-57/business_requirements.md' })].join('\n');

  // Реальный поток контрольного плеча: после делегирования субагент читает чек-лист,
  // артефакт и источник. Это НЕ нарушение — это его работа. Случай заведён в самотест
  // после того, как первая редакция грейдера покрасила им 10 прогонов из 10.
  const withSubagent = [
    line('Write', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Skill', { skill: 'spec-review' }),
    line('Agent', { prompt: 'Прочитай чек-лист ... и проверь по нему файл ...' }),
    line('Read', { file_path: '/sb/.claude/skills/spec-review/reference/checklist-spec.md' }),
    line('Read', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Read', { file_path: '/sb/docs/ARS-57/business_requirements.md' }),
  ].join('\n');

  // Ведущий открыл артефакт САМ — до всякого делегирования. Вот это нарушение.
  const selfRead = [
    line('Write', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Skill', { skill: 'spec-review' }),
    line('Read', { file_path: '/sb/docs/ARS-57/technical_specification.md' }),
    line('Agent', { prompt: 'проверь' }),
  ].join('\n');

  const cases = [
    ['ideal', ideal, { RT0_ran: true, RT1_skill_called: true, RT2_delegated: true, RT3_no_self_read: true }],
    ['broken', broken, { RT0_ran: true, RT1_skill_called: true, RT2_delegated: false, RT3_no_self_read: false }],
    ['stalled', stalled, { RT0_ran: false, RT1_skill_called: false, RT2_delegated: false, RT3_no_self_read: false }],
    ['withSubagent', withSubagent, { RT0_ran: true, RT1_skill_called: true, RT2_delegated: true, RT3_no_self_read: true }],
    ['selfRead', selfRead, { RT0_ran: true, RT1_skill_called: true, RT2_delegated: true, RT3_no_self_read: false }],
  ];

  let bad = 0;
  for (const [name, body, want] of cases) {
    const d = join(tmp, name);
    mkdirSync(d, { recursive: true });
    const p = join(d, 'stream.jsonl');
    writeFileSync(p, body, 'utf8');
    const got = gradeRun(p);
    for (const [k, v] of Object.entries(want)) {
      const ok = got[k] === v;
      if (!ok) bad++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}.${k}: ждали ${v}, получили ${got[k]}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `\nСАМОТЕСТ ПРОВАЛЕН: ${bad}` : '\nСАМОТЕСТ ПРОЙДЕН: грейдер различает верный, сломанный и недоехавший поток.');
  process.exit(bad ? 1 : 0);
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') selfTest();
else if (args[0] === '--inspect') {
  for (const r of runsOf(args[1])) {
    if (!existsSync(r.stream)) continue;
    console.log(r.id, JSON.stringify(gradeRun(r.stream).toolNames));
  }
} else if (args[0]) report(args.filter((a) => a !== '--seeded')[0], args.includes('--seeded'));
else { console.error('нужен путь к папке плеча'); process.exit(1); }
