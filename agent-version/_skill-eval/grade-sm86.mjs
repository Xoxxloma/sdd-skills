// SM-86 — перечень полей у сущностей: доезжает ли схема в «Владеет данными».
//
// Что меряет и чего НЕ меряет. Считает строки полей в ТЕЛЕ КАРТОЧКИ. Строку
// описи «⟹ сущностей N, из них с перечнем полей M» модель пишет про себя сама,
// поэтому она идёт вторым, отдельным числом: зелёным по ней красится честный
// отчёт о собственном недоборе. Расхождение двух чисел — само по себе диагноз.
//
// Форма из card.template.md: у блока сущности строки «- поле: тип» — это ПОЛЯ,
// строки «— ...» (em-dash) — факты семантики. Их считает SM-38, здесь они не в счёт.
//
// Запуск: node agent-version/_skill-eval/grade-sm86.mjs <папка-прогонов> bulk|neutral|hop
//         node agent-version/_skill-eval/grade-sm86.mjs --selftest
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const [runsDir, fixture] = process.argv.slice(2);
const SELFTEST = runsDir === '--selftest';
if (!SELFTEST && (!runsDir || !['bulk', 'neutral', 'hop'].includes(fixture))) {
  console.error('нужно: <папка-прогонов> bulk|neutral|hop   либо   --selftest');
  process.exit(1);
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// Инвентарь фикстур — из таблиц в их README.
const SPEC = {
  bulk: { entities: 9, fields: 60 },
  neutral: { entities: 6, fields: 45 },
  hop: { entities: 6, fields: 45 },
};

// Имена полей как якоря против правдоподобной выдумки: блок с шестью
// придуманными полями проходит счёт строк и валится здесь.
// `capacityKg` в якоря НЕ входит намеренно: он стоит примером в самом
// card.template.md, и его появление доказывает чтение шаблона, а не кода.
const NAMES = {
  bulk: [
    'assignedSquadId', 'districtId', 'mimeType', 'uploadedBy', 'closedBy',
    'releasedAt', 'recipients', 'objectType', 'defaultDistrictId', 'retentionDays',
  ],
  neutral: [
    'originSlotId', 'destinationAddress', 'declaredValue', 'licenseValidUntil',
    'licenseNumber', 'capacityPallets', 'pricePerKg', 'minPrice', 'validUntil', 'occupiedKg',
  ],
};



// Имя поля сверяется без учёта раскладки: фикстура `SM-BULK` на Go даёт `AssignedSquadID`,
// карточка законно пишет `assignedSquadId` или `assigned_squad_id` — это одно и то же поле, и
// придираться к разделителю значит красить зелёный прогон в красное. Круг 2026-08-27: прогон
// `bulk/run-3` написал все поля в snake_case и получил 2 якоря из 10 при 64 строках полей —
// счёт был неверен, а выглядел как правдоподобная выдумка.
const nameRe = (n) =>
  new RegExp(n.replace(/([a-z0-9])(?=[A-Z])/g, '$1[_ -]?'), 'i');

// Заражение примером из SKILL.md (SM-46): в описи скилла теперь стоит сущность
// с полями. Эти имена в фикстурах не встречаются, поэтому их появление в ответе
// означает, что модель переписала пример вместо чтения кода.
const POISON = [/trackingCode/i, /sealNumber/i, /licenseExpiresOn/i];

// `hop` — та же фикстура, что `neutral`, по инвентарю и именам: различие только в раскладке файлов.
const spec = SPEC[fixture];
const names = NAMES[fixture === 'hop' ? 'neutral' : fixture];

// «Владеет данными» — от своего заголовка до следующего «## ».
function ownSection(text) {
  const m = text.match(/^##\s+Владеет данными\s*$/m);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next);
}

// Блоки «### Имя» внутри секции; для каждого — число строк полей.
function blocks(section) {
  const out = [];
  const re = /^###\s+(.+?)\s*$/gm;
  let m, prev = null;
  while ((m = re.exec(section))) {
    if (prev) out.push({ name: prev.name, body: section.slice(prev.end, m.index) });
    prev = { name: m[1], end: m.index + m[0].length };
  }
  if (prev) out.push({ name: prev.name, body: section.slice(prev.end) });
  return out.map((b) => ({
    name: b.name,
    fields: b.body.split('\n').filter((l) => /^\s*-\s+\S/.test(l)).length,
  }));
}

// Что модель заявила о себе в описи. Кириллица мимо \w — классы явные.
function claimed(text) {
  const m = text.match(/сущност[а-яё]*\s+(\d+)[^\n]*?пол[а-яё]*\s+(\d+)/i);
  return m ? { entities: +m[1], withFields: +m[2] } : null;
}


// ── Самопроверка: четыре заведомо известных результата, без единого прогона ──────────────────
// Заведена до первого прогона и сразу нашла настоящую ошибку: в JS `\w` кириллицу не покрывает,
// и `сущност\w*` не совпадало ни с чем. Тот же класс дефекта, что `\b` после кириллицы в
// `grade-async.mjs`. Второй раз пригодилась на раскладке имён: `AssignedSquadID` в фикстуре
// против `assigned_squad_id` в карточке — одно поле, а строгий якорь давал 2 из 10.
function analyze(t, sp, ns) {
  const sec = ownSection(t);
  if (sec === null) return null;
  const bs = blocks(sec);
  return {
    entities: bs.length,
    withFields: bs.filter((b) => b.fields > 0).length,
    fields: bs.reduce((a, b) => a + b.fields, 0),
    hit: ns.filter((n) => nameRe(n).test(t)),
    poisoned: POISON.filter((re) => re.test(t)).map((re) => String(re).slice(1, -2)),
    claimed: claimed(t),
  };
}

if (SELFTEST) {
  const sp = SPEC.bulk, ns = NAMES.bulk;
  // Зелёная карточка собирается ИЗ САМОЙ ФИКСТУРЫ, а не пишется руками: иначе самопроверка
  // сверяет грейдер с моим представлением о фикстуре, а не с фикстурой.
  const fx = read(new URL('./fixtures/SM-BULK/repo.md', import.meta.url));
  const models = fx.split('## `internal/storage/models.go`')[1].split('\n## ')[0];
  let green = '## Владеет данными\n\n';
  for (const line of models.split('\n')) {
    const st = line.match(/^type (\w+) struct \{/);
    if (st) { green += `### \`${st[1]}\`\nСущность.\n`; continue; }
    const fl = line.match(/^\t(\w+)\s+([^\s/]+)/);
    if (fl) green += `- \`${fl[1]}\`: \`${fl[2]}\`\n`;
  }
  green += '\n## Зависит от\n';

  const red = '## Владеет данными\n\n—\n\nСервис данных не хранит.\n\n## Зависит от\n';
  const partial = '⟹ сущностей 9, из них с перечнем полей 9\n\n'
    + green.split('### `Squad`')[0] + '### `Squad`\nСущность.\n— статус ставит планировщик\n'
    + '### `Shift`\nСущность.\n### `Assignment`\nСущность.\n### `ReportSchedule`\nСущность.\n'
    + '### `AuditEntry`\nСущность.\n### `Settings`\nСущность.\n\n## Зависит от\n';
  const poisoned = '## Владеет данными\n\n### `Shipment`\nСущность.\n'
    + '- `trackingCode`: `string`\n- `sealNumber`: `string?`\n\n## Зависит от\n';

  const cases = [
    ['красный: секция прочерком', red, (r) => r.entities === 0 && r.fields === 0],
    ['зелёный: собран из фикстуры', green,
      (r) => r.entities === sp.entities && r.withFields === sp.entities
          && r.fields === sp.fields && r.hit.length === ns.length],
    ['частичный: опись врёт про себя', partial,
      (r) => r.withFields < sp.entities && r.claimed && r.claimed.withFields !== r.withFields],
    ['заражение примером из SKILL.md', poisoned, (r) => r.poisoned.length >= 2],
  ];
  let bad = 0;
  for (const [name, text, ok] of cases) {
    const r = analyze(text, sp, ns);
    const pass = r && ok(r);
    if (!pass) bad++;
    console.log(`${pass ? '  ok  ' : '  FAIL'} ${name}` +
      (r ? `  — сущностей ${r.entities}, с полями ${r.withFields}, полей ${r.fields}, `
         + `имён ${r.hit.length}, заражений ${r.poisoned.length}` : '  — секции нет'));
  }
  console.log(bad ? `\nСАМОПРОВЕРКА НЕ ПРОШЛА: ${bad} из ${cases.length}` : '\nсамопроверка: 4 из 4');
  process.exit(bad ? 1 : 0);
}


const runs = (isDir(runsDir) ? readdirSync(runsDir) : [])
  .filter((f) => /^run-\d+$/.test(f))
  .sort()
  .map((f) => join(runsDir, f))
  .filter((p) => existsSync(join(p, 'answer.md')));

if (!runs.length) {
  console.error(`в ${runsDir} нет прогонов с answer.md`);
  process.exit(1);
}

console.log(`=== SM-86 — ${runs.length} прогонов, фикстура ${fixture} `
  + `(${spec.entities} сущностей, ${spec.fields} полей) ===`);

let fullRuns = 0, sumWith = 0, sumFields = 0, sumNames = 0, lies = 0;
const perName = new Map(names.map((n) => [n, 0]));

for (const r of runs) {
  const t = read(join(r, 'answer.md'));
  const label = basename(r);
  const sec = ownSection(t);
  if (sec === null) {
    console.log(`${label}: секции «Владеет данными» нет вовсе`);
    continue;
  }
  const bs = blocks(sec);
  const withFields = bs.filter((b) => b.fields > 0).length;
  const total = bs.reduce((a, b) => a + b.fields, 0);
  const hit = names.filter((n) => nameRe(n).test(t));
  hit.forEach((n) => perName.set(n, perName.get(n) + 1));

  const poisoned = POISON.filter((re) => re.test(t)).map((re) => String(re).slice(1, -2));
  const full = bs.length === spec.entities && withFields === spec.entities;
  if (full) fullRuns++;
  sumWith += withFields; sumFields += total; sumNames += hit.length;

  const cl = claimed(t);
  let mismatch = '';
  if (cl && cl.withFields !== withFields) {
    lies++;
    mismatch = `  ⚠ опись заявила ${cl.withFields}, в карточке ${withFields}`;
  }
  console.log(
    `${label}: сущностей ${bs.length}/${spec.entities}, ` +
    `с полями ${withFields}/${spec.entities}, строк полей ${total}/${spec.fields}, ` +
    `имён ${hit.length}/${names.length}${full ? '  ✅' : ''}${mismatch}` +
    (poisoned.length ? `  ⚠ заражение примером: ${poisoned.join(', ')}` : '')
  );
}

console.log('\n--- по именам полей (в скольких прогонах доехало) ---');
for (const [n, c] of perName) console.log(`${c}/${runs.length}  ${n}`);
console.log(
  `\nПЕРВЫЙ ПРОХОД ЗЕЛЁНЫЙ: ${fullRuns}/${runs.length} прогонов ` +
  `(все ${spec.entities} сущностей с перечнем полей)\n` +
  `в среднем: сущностей с полями ${(sumWith / runs.length).toFixed(1)}/${spec.entities}, ` +
  `строк полей ${(sumFields / runs.length).toFixed(1)}/${spec.fields}, ` +
  `имён-якорей ${(sumNames / runs.length).toFixed(1)}/${names.length}\n` +
  `опись разошлась с телом карточки: ${lies}/${runs.length}`
);
