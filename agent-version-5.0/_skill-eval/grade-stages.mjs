// Грейдер проб раунда «этапы работ» (2026-07-31).
// Оценка строковыми проверками по артефактам на диске — как принято в репе.
// Запуск: node agent-version-3.2/_skill-eval/grade-stages.mjs <probe> [runsDir]
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const probe = process.argv[2];
const runsDir = process.argv[3] || join(process.cwd(), 'agent-version-3.2/_skill-eval/runs/2026-07-31-stages');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const lower = (s) => (s || '').toLowerCase();

function stageDir(run, task) {
  return join(run, task, 'stages');
}
function stageFiles(run, task) {
  const d = stageDir(run, task);
  if (!isDir(d)) return [];
  return readdirSync(d).filter((f) => /^stage-\d+\.md$/i.test(f)).sort();
}
// owns: [INT-1, "Оборудование"] -> набор ключей
function ownsOf(text) {
  const m = (text || '').match(/^owns:\s*\[(.*?)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["'«]|["'»]$/g, '').trim())
    .filter(Boolean);
}
// Прогоном считается только папка, в которой есть answer.md.
// Песочницы создаются пачкой ДО запуска, поэтому пустая run-NN — это «ещё не гоняли»,
// а не «прогон провалился». Без этого фильтра восемь заготовленных папок дают
// восемь провалов, и проба выглядит красной, ни разу не будучи измеренной.
function runsOf(probeName) {
  const d = join(runsDir, probeName);
  if (!isDir(d)) return [];
  const all = readdirSync(d)
    .filter((f) => /^run-\d+$/.test(f))
    .sort()
    .map((f) => join(d, f));
  const done = all.filter((r) => existsSync(join(r, 'answer.md')));
  const skipped = all.length - done.length;
  if (skipped > 0) {
    console.error(`  !! ${probeName}: ${skipped} из ${all.length} папок без answer.md — не прогнаны, в счёт не идут.`);
  }
  return done;
}

// Разрез задачи «оборудование» — общее тело для ST-1 (ARS-122, §2.5 есть)
// и ST-8 (ARS-125, та же спека без §2.5). Ожидаемый результат в обоих случаях
// одинаков: 3 этапа, 4 стыка, у каждого ровно один производитель.
// Метки якорей НЕ различаются по пробе намеренно — числа сравниваются строкой в строку.
function equipmentCut(run, task, probe) {
  const idx = read(join(stageDir(run, task), 'index.md'));
  const files = stageFiles(run, task);
  const ans = read(join(run, 'answer.md')) || '';
  const spec = read(join(run, task, 'technical_specification.md')) || '';
  const bodies = files.map((f) => read(join(stageDir(run, task), f)) || '');
  const inv = ['INT-1', 'INT-2', 'Оборудование', 'Привязка'];
  const flat = bodies.map(ownsOf).flat();
  const norm = (s) => s.replace(/[«»"']/g, '').trim();
  const covered = inv.filter((k) => flat.some((o) => norm(o) === k));
  const dup = inv.filter((k) => flat.filter((o) => norm(o) === k).length > 1);

  // контракт скопирован дословно, а не пересказан
  const all = bodies.join('\n');
  const contractFields = ['externalId', 'occurredAt', 'matchedAt', 'items'];
  const fieldsPresent = contractFields.filter((f) => all.includes(f));
  const jsonFences = (all.match(/```json/g) || []).length;

  // ноль изобретений — все camelCase-идентификаторы из файлов этапов есть в спеке.
  // ВАЖНО: проверка сверяется со спекой в песочнице прогона. Спеки там нет — проверку
  // выполнить НЕЧЕМ, и её результат не «ноль» и не «провал», а отсутствие наблюдения.
  // Молчаливый ноль здесь уже давал ложный красный при перегрейде архивных прогонов:
  // песочницы почистили, спека исчезла, и все идентификаторы стали «выдуманными».
  const specMissing = !spec;
  const ids = [...new Set((all.match(/`[a-z][a-zA-Z0-9_]{3,}`/g) || []).map((s) => s.slice(1, -1)))];
  const invented = specMissing ? [] : ids.filter((i) => !spec.includes(i));
  if (specMissing) {
    console.error(
      `  !! ${probe} ${run}: в песочнице нет ${task}/technical_specification.md — ` +
        'ST-4.1 не измерена (не путать с провалом). Копию спеки из прогона удалять нельзя.'
    );
  }

  return {
    'ST-1.1 index.md записан': !!idx,
    'ST-1.2 файлов этапов >= 3': files.length >= 3,
    'ST-1.3 все 4 стыка присвоены (owns)': covered.length === 4,
    'ST-1.4 ни один стык не задвоен': dup.length === 0,
    // «реестр» — по содержанию, а не по слову: инвентарь назван и все стыки перечислены
    'ST-1.5 реестр выведен в ответе': /(реестр|инвентар)/i.test(ans) && inv.filter((k) => ans.includes(k)).length >= 3,
    'ST-6.1 поля контракта скопированы': fieldsPresent.length >= 3,
    'ST-6.2 JSON-пример перенесён': jsonFences >= 1,
    ...(specMissing ? {} : { 'ST-4.1 ноль выдуманных идентификаторов': invented.length === 0 }),
    _detail: `${probe} ${task}: файлов=${files.length} owns=${JSON.stringify(flat)} задвоено=${dup} поля=${fieldsPresent} json=${jsonFences} выдумано=${specMissing ? 'НЕ ИЗМЕРЕНО (нет спеки в песочнице)' : invented}`,
  };
}

const CHECKS = {
  // ST-1 / ST-4 / ST-6 — общий артефакт на ARS-122
  st1(run) {
    return equipmentCut(run, 'ARS-122', 'ST-1');
  },

  // ST-8 — тот же разрез на ARS-125: побайтовая копия ARS-122 БЕЗ §2.5.
  // Прямой контроль к ST-1: единственная разница входа — отсутствие подсказки-таблицы.
  // Якоря те же и метки те же (ST-1.x), чтобы числа сравнивались строкой в строку.
  st8(run) {
    return equipmentCut(run, 'ARS-125', 'ST-8');
  },

  // ST-2 — ловушка слоя на ARS-124 (INT-2 = 🟡, стык ровно один)
  st2(run) {
    const task = 'ARS-124';
    const idx = read(join(stageDir(run, task), 'index.md')) || '';
    const files = stageFiles(run, task);
    const ans = read(join(run, 'answer.md')) || '';
    const bodies = files.map((f) => read(join(stageDir(run, task), f)) || '');
    const flat = bodies.map(ownsOf).flat().map((s) => s.replace(/[«»"']/g, '').trim());
    const int2Owned = flat.some((o) => o === 'INT-2');
    const na = /не применимо/i.test(idx) || /не применимо/i.test(ans);
    return {
      'ST-2.1 этапов не больше одного': files.length <= 1,
      'ST-2.2 «не применимо» либо один этап': na || files.length === 1,
      'ST-2.3 INT-2 не присвоен этапу (внешний)': !int2Owned,
      'ST-2.4 ложный §2.5 не скопирован': !(lower(idx + ans).includes('отображение индикатора') && files.length >= 2),
      // NB: «расхожд», не «расход» — первая редакция грейдера искала несуществующую подстроку
      'ST-2.5 расхождение с §2.5 названо': /2\.5/.test(ans) && /(расхожд|не совпад|поправ|отлич|вместо|дефект|против)/i.test(ans),
      _detail: `файлов=${files.length} owns=${JSON.stringify(flat)} na=${na}`,
    };
  },

  // ST-3 — пустой инвентарь на ARS-123
  st3(run) {
    const task = 'ARS-123';
    const idx = read(join(stageDir(run, task), 'index.md')) || '';
    const files = stageFiles(run, task);
    const ans = read(join(run, 'answer.md')) || '';
    return {
      'ST-3.1 индекс записан': idx.length > 0,
      'ST-3.2 файлов этапов нет': files.length === 0,
      // ДЛИНА ПРИЧИНОЙ НЕ ЯВЛЯЕТСЯ. Прежняя редакция мерила «причину по существу» условием
      // «индекс длиннее 60 символов», а обязательный скелет короткого индекса всегда длиннее —
      // то есть пункт был зелёным при любом содержании, включая запрещённый пересказ правила
      // («не применимо: инвентарь пуст»). Меряем то, что правило и запрещает: причина не может
      // состоять из одного лишь повторения условия, за ним должно стоять утверждение о работе.
      'ST-3.3 «не применимо» с причиной': (() => {
        const m = idx.match(/не применимо\s*[:—-]?\s*([^\n]*)/i);
        if (!m) return false;
        const reason = m[1].replace(/\s+/g, ' ').trim();
        const restatesRule = /^(инвентар\S*\s+пуст\S*|стык\S*\s+нет|нет\s+стык\S*|разрез\S*\s+не\s+нужен|делить\s+нечего)[\s.,;]*$/i.test(reason);
        return reason.length >= 20 && !restatesRule;
      })(),
      'ST-3.4 этапы не выдуманы': !/(подготовить данные|отрисовать|покрыть тестами|написать тесты)/i.test(idx + ans),
      _detail: `файлов=${files.length} индекс=${idx.length}б`,
    };
  },

  // ST-5 — правка аналитика применяется (ARS-122, просили 2 этапа)
  st5(run) {
    const task = 'ARS-122';
    const files = stageFiles(run, task);
    const bodies = files.map((f) => read(join(stageDir(run, task), f)) || '');
    const ans = read(join(run, 'answer.md')) || '';
    const owns = bodies.map(ownsOf).map((a) => a.map((s) => s.replace(/[«»"']/g, '').trim()));
    const first = owns[0] || [];
    const second = owns[1] || [];
    return {
      'ST-5.1 ровно два этапа': files.length === 2,
      'ST-5.2 первый владеет приёмом и сопоставлением': first.includes('INT-1') && first.some((o) => /Привязка/.test(o)),
      'ST-5.3 второй владеет отдачей': second.includes('INT-2'),
      'ST-5.4 правка не оспорена обратно до трёх': !/рекомендую всё же (раздел|разбить)/i.test(ans),
      _detail: `файлов=${files.length} owns=${JSON.stringify(owns)}`,
    };
  },

  // ST-7 — entry guard: дали только БТ
  st7(run) {
    const task = 'ARS-120';
    const files = stageFiles(run, task);
    const ans = read(join(run, 'answer.md')) || '';
    const dirs = isDir(join(run, task)) ? readdirSync(join(run, task)) : [];
    return {
      'ST-7.1 файлы этапов не записаны': files.length === 0,
      'ST-7.2 папка stages не создана': !isDir(stageDir(run, task)),
      'ST-7.3 отказ назван и указан technical-spec-doc': /technical-spec-doc|тех-спек|техническ\w+ специфик/i.test(ans),
      'ST-7.4 БТ не тронут': dirs.includes('business_requirements.md'),
      _detail: `в папке: ${dirs.join(',')}`,
    };
  },
};

CHECKS.st3b = CHECKS.st3; // круг 2 после правки якоря пути

if (!CHECKS[probe]) {
  console.error(`неизвестная проба: ${probe}. Доступны: ${Object.keys(CHECKS).join(', ')}`);
  process.exit(1);
}

const runs = runsOf(probe);
if (!runs.length) {
  console.error(`нет прогонов в ${join(runsDir, probe)}`);
  process.exit(1);
}

const tally = {};
const lines = [];
for (const run of runs) {
  const res = CHECKS[probe](run);
  const detail = res._detail;
  delete res._detail;
  const failed = Object.entries(res).filter(([, v]) => !v).map(([k]) => k);
  for (const [k, v] of Object.entries(res)) {
    tally[k] = tally[k] || { pass: 0, total: 0 };
    tally[k].total++;
    if (v) tally[k].pass++;
  }
  lines.push(`${run.split(/[\\/]/).pop()}: ${failed.length ? 'FAIL — ' + failed.join('; ') : 'PASS'}  [${detail}]`);
}

console.log(`\n=== ${probe.toUpperCase()} — ${runs.length} прогонов ===`);
lines.forEach((l) => console.log(l));
console.log('\n--- по пунктам ---');
for (const [k, v] of Object.entries(tally)) console.log(`${v.pass}/${v.total}  ${k}`);
const fullPass = lines.filter((l) => l.includes(': PASS')).length;
console.log(`\nПРОБА ЦЕЛИКОМ (все пункты): ${fullPass}/${runs.length}`);
