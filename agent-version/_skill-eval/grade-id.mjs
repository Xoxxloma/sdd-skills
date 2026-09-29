#!/usr/bin/env node
// Грейдер `interaction-diagram` на фикстуре ID-DIAG: схема — проекция INT-карточек спеки.
//
//   node grade-id.mjs <папка-пробы> [--format=mmd|puml|ask]   — фикстура и формат из имени папки:
//     id-* → ID-DIAG, ring-* → ID-RING; суффикс mmd/puml/ask
//   node grade-id.mjs --selftest
//
// Истина — карточки спеки ФИКСТУРЫ (не песочницы: прогон мог её поправить, это отдельный красный).
// Карточка без `→` в «Граница/направление» стрелки не получает и обязана быть названа в отчёте (И13).
// Якоря И0–И13; «зелёный целиком» = все. Для `ask`: файла схемы нет, в ответе вопрос про формат.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = { id: 'ID-DIAG', ring: 'ID-RING' };
const fixDir = (k) => join(HERE, 'fixtures', FIXTURES[k]);
const specRel = (k) => {
  const key = readdirSync(join(fixDir(k), 'docs')).find((d) => existsSync(join(fixDir(k), 'docs', d, 'technical_specification.md')));
  return `docs/${key}/technical_specification.md`;
};
const norm = (s) => s.replace(/\r/g, '');
const read = (p) => (existsSync(p) ? norm(readFileSync(p, 'utf8')) : null);

const MARKS = ['🟢', '🔵', '🟡', '❓'];
const PATH_RE = /\b(GET|POST|PUT|PATCH|DELETE)\b[^\n]*\//;

/** Карточки `### INT-N. имя — маркер` и их «Граница/направление». */
export function parseCards(spec) {
  const lines = spec.split('\n');
  const cards = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^###\s+INT-(\d+)\.\s*(.*?)\s+—\s+(.*)$/);
    if (!m) continue;
    const mark = MARKS.find((e) => m[3].includes(e)) ?? null;
    let border = null;
    for (let j = i + 1; j < lines.length && !/^###?\s/.test(lines[j]); j += 1) {
      const b = lines[j].match(/\*\*Граница\/направление:\*\*\s*(.*)$/);
      if (b) { border = b[1]; break; }
    }
    cards.push({ n: Number(m[1]), name: m[2], mark, border, contract: contractOf(lines, i) });
  }
  return cards;
}

function contractOf(lines, i) {
  for (let j = i + 1; j < lines.length && !/^###?\s/.test(lines[j]); j += 1) {
    const c = lines[j].match(/\*\*Контракт \(запрос\):\*\*\s*(.*)$/);
    if (c) return c[1];
  }
  return '';
}

/** Стороны из «Граница/направление»: без «событие:», обратных кавычек и пояснений в скобках. */
export function sides(border) {
  if (!border || !border.includes('→')) return null;
  const clean = (s) => s.replace(/^\s*событие:\s*/i, '').replace(/`/g, '').replace(/\([^)]*\)/g, '').trim();
  const [a, b] = border.split('→');
  return [clean(a), clean(b)];
}

/** Блок схемы: Mermaid — из ```mermaid в .md, PlantUML — файл целиком. */
export function parseDiagram(text, format) {
  let body = text;
  if (format === 'mmd') {
    const m = text.match(/```mermaid\n([\s\S]*?)```/);
    if (!m) return null;
    body = m[1];
  } else if (!/@startuml[\s\S]*@enduml/.test(text)) return null;
  const parts = new Map(); // alias → имя
  const arrows = [];
  const other = [];
  for (const raw of body.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith("'") || l.startsWith('%%') || /^@(start|end)uml/.test(l) || l === 'sequenceDiagram') continue;
    let p;
    if (format === 'mmd') {
      p = l.match(/^(?:participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/);
      if (p) { parts.set(p[1], (p[2] ?? p[1]).trim()); continue; }
      const a = l.match(/^(\w+)\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?(\w+)\s*:\s*(.*)$/);
      if (a) { arrows.push({ from: a[1], to: a[3], dashed: a[2].startsWith('--'), label: a[4], line: l }); continue; }
    } else {
      p = l.match(/^(?:participant|actor)\s+"([^"]+)"\s+as\s+(\w+)$/) || l.match(/^(?:participant|actor)\s+(\S+)$/);
      if (p) { parts.set(p[2] ?? p[1], p[1]); continue; }
      const a = l.match(/^(\w+)\s*(<?-{1,2}>?)\s*(\w+)\s*:\s*(.*)$/);
      if (a) { arrows.push({ from: a[1], to: a[3], dashed: a[2].includes('--'), back: a[2].startsWith('<'), label: a[4], line: l }); continue; }
    }
    other.push(l);
  }
  return { parts, arrows, other };
}

export function gradeDiagram(text, format, cards) {
  const r = {};
  const d = text == null ? null : parseDiagram(text, format);
  r['И2 синтаксис'] = !!d && d.arrows.length > 0;
  if (!r['И2 синтаксис']) return r;
  const want = new Set(cards.filter((c) => sides(c.border)).map((c) => c.n));
  const nums = d.arrows.map((a) => Number((a.label.match(/^INT-(\d+)\b/) ?? [])[1] ?? NaN));
  r['И3 номера = карточкам'] = nums.every((n) => !Number.isNaN(n)) && nums.length === want.size && nums.every((n) => want.has(n));
  r['И4 только стрелки карточек'] = nums.every((n) => !Number.isNaN(n)) && !d.arrows.some((a) => a.back || a.from === a.to);
  r['И5 разметка без лишнего'] = d.other.length === 0 && !/\b(alt|loop|opt|par|note|activate|deactivate|box|rect|skinparam|autonumber)\b/.test(d.other.join('\n'));
  const borders = cards.map((c) => c.border ?? '').join('\n').replace(/`/g, '');
  const names = [...d.parts.values()];
  r['И6 участники из границ'] = names.length > 0 && names.every((nm) => borders.includes(nm) && !/[()]/.test(nm));
  let marks = true, dashed = true, noPath = true, greenPath = true, dir = true;
  d.arrows.forEach((a, k) => {
    const c = cards.find((x) => x.n === nums[k]);
    if (!c) return;
    if (!a.label.includes(c.mark) || MARKS.some((e) => e !== c.mark && a.label.includes(e))) marks = false;
    const green = c.mark === '🟢';
    if (a.dashed === green) dashed = false;
    if (!green && PATH_RE.test(a.label)) noPath = false;
    if (green) {
      const pm = c.contract.replace(/`/g, '').match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s*(?:\([^)]*\)\s*)?(\/\S+)/);
      if (pm && !(a.label.includes(pm[1]) && a.label.includes(pm[2]))) greenPath = false;
    }
    const s = sides(c.border);
    if (s && !(d.parts.get(a.from) === s[0] && d.parts.get(a.to) === s[1])) dir = false;
  });
  r['И7 эмодзи = заголовку'] = marks;
  r['И8 пунктир ⇔ не 🟢'] = dashed;
  r['И9 нет пути на 🔵/🟡'] = noPath;
  r['И10 путь у 🟢 из карточки'] = greenPath;
  r['И11 направление из границы'] = dir;
  r['И12 без плейсхолдеров'] = !/<[^>\n]*[а-яa-z][^>\n]*>/i.test(text.replace(/-->>|->>|-->|->|<--|<-/g, ''));
  return r;
}

const FILES = { mmd: 'interaction_diagram.md', puml: 'interaction_diagram.puml' };
const JUNK = new Set(['answer.md', 'stream.jsonl', '_seeded.txt', '_stderr.log', 'answer-02.md']);

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { if (e !== '.claude') walk(p); } else out.push(relative(root, p).replace(/\\/g, '/'));
    }
  };
  walk(root);
  return out;
}

/** Каждый номер без стрелки назван в ответе (INT-1 не засчитывается за INT-11). */
export const namedSkips = (answer, skipped) => {
  const said = new Set(answer.match(/INT-\d+/g) ?? []);
  return skipped.every((k) => said.has(k));
};

const NOT_SERVICES = new Set(['Покупатель', 'планшет группы']);

/** Стороны карточек, которых нет в таблице §1.2 (отчёт обязан их назвать). */
export function notInOverview(spec, cards) {
  const m = spec.match(/### 1\.2\.[\s\S]*?(?=\n###? )/);
  const overview = (m ? m[0] : '').replace(/`/g, '');
  const names = [...new Set(cards.flatMap((c) => sides(c.border) ?? []))];
  return names.filter((nm) => !overview.includes(nm));
}

export function gradeRun(runDir, format, fx = 'id') {
  const FIX = fixDir(fx);
  const SPEC_REL = specRel(fx);
  const fixFiles = new Set(listFiles(FIX));
  const spec = read(join(FIX, SPEC_REL));
  const cards = parseCards(spec);
  const answer = read(join(runDir, 'answer.md')) ?? '';
  const made = listFiles(runDir).filter((f) => !fixFiles.has(f) && !JUNK.has(f.split('/').pop()));
  const r = {};
  r['И0 спека не тронута'] = read(join(runDir, SPEC_REL)) === spec;
  if (format === 'ask') {
    r['А1 файла схемы нет'] = made.length === 0;
    r['А2 спросил формат'] = /mermaid/i.test(answer) && /plant\s*uml/i.test(answer);
    return { r, made };
  }
  const want = SPEC_REL.replace('technical_specification.md', FILES[format]);
  r['И1 файл рядом со спекой, других нет'] = made.length === 1 && made[0] === want;
  Object.assign(r, gradeDiagram(read(join(runDir, want)), format, cards));
  const skipped = cards.filter((c) => !sides(c.border)).map((c) => `INT-${c.n}`);
  if (skipped.length) r['И13 пропуск назван в отчёте'] = namedSkips(answer, skipped);
  // Люди и устройства вне §1.2 — законно (скилл их не называет); сервис под другим именем — обязан.
  const foreign = notInOverview(spec, cards).filter((nm) => !NOT_SERVICES.has(nm));
  if (foreign.length) r['И14 сервис не из §1.2 в отчёте'] = foreign.every((nm) => answer.includes(nm));
  return { r, made };
}

function selftest() {
  const FIX = fixDir('id');
  const SPEC_REL = specRel('id');
  const spec = read(join(FIX, SPEC_REL));
  const cards = parseCards(spec);
  let ok = true;
  const check = (label, cond) => { if (!cond) ok = false; console.log(`${cond ? 'ok ' : 'FAIL'} ${label}`); };
  check('карточек 6', cards.length === 6);
  check('маркеры 🟢🔵🔵🔵🟡🟢', cards.map((c) => c.mark).join('') === '🟢🔵🔵🔵🟡🟢');
  check('стороны INT-2 без скобок', JSON.stringify(sides(cards[1].border)) === JSON.stringify(['dispatch-api', 'objects-registry']));
  const good = {
    mmd: ['```mermaid', 'sequenceDiagram',
      '    participant S1 as dispatch-web', '    participant S2 as dispatch-api', '    participant S3 as objects-registry',
      '    participant S4 as notify', '    participant S5 as планшет группы',
      '    S1->>S2: INT-1 🟢 Создание заявки на выезд — POST /v1/dispatch-requests',
      '    S2-->>S3: INT-2 🔵 Получение данных объекта при создании заявки',
      '    S2-->>S4: INT-3 🔵 Событие «заявка создана»',
      '    S4-->>S5: INT-4 🔵 Push на планшет группе',
      '    S2-->>S4: INT-5 🟡 SMS ответственному по объекту',
      '    S1->>S2: INT-6 🟢 Список заявок для диспетчера/старшего — GET /v1/dispatch-requests', '```'].join('\n'),
  };
  good.puml = ['@startuml', 'participant "dispatch-web" as S1', 'participant "dispatch-api" as S2', 'participant "objects-registry" as S3',
    'participant "notify" as S4', 'participant "планшет группы" as S5',
    'S1 -> S2 : INT-1 🟢 Создание заявки на выезд — POST /v1/dispatch-requests',
    'S2 --> S3 : INT-2 🔵 Получение данных объекта при создании заявки',
    'S2 --> S4 : INT-3 🔵 Событие «заявка создана»', 'S4 --> S5 : INT-4 🔵 Push на планшет группе',
    'S2 --> S4 : INT-5 🟡 SMS ответственному по объекту',
    'S1 -> S2 : INT-6 🟢 Список заявок для диспетчера/старшего — GET /v1/dispatch-requests', '@enduml'].join('\n');
  for (const f of ['mmd', 'puml']) {
    const r = gradeDiagram(good[f], f, cards);
    check(`${f}: эталон зелёный целиком`, Object.values(r).every(Boolean));
    if (!Object.values(r).every(Boolean)) console.log(r);
  }
  // Известный красный: старый блок из run-05 раунда diag.
  const old = read(join(HERE, 'runs/2026-09-24-diag-d-v2/ts-diag/run-05/docs/DSP-330/technical_specification.md'));
  if (old) {
    const blk = old.match(/```plantuml\n([\s\S]*?)```/)[1];
    const r = gradeDiagram(blk, 'puml', cards);
    check('старый блок: И4 красный (ответные/служебные)', r['И4 только стрелки карточек'] === false);
    check('старый блок: И9 красный (путь на 🔵/🟡)', r['И9 нет пути на 🔵/🟡'] === false);
    check('старый блок: И6 красный (скобки в имени)', r['И6 участники из границ'] === false);
  } else console.log('skip: старого блока нет на диске');
  const mut = (f, from, to) => gradeDiagram(good[f].replace(from, to), f, cards);
  check('путь на 🔵 → И9 красный', mut('mmd', 'INT-2 🔵 Получение данных объекта при создании заявки', 'INT-2 🔵 Получение данных — GET /v2/objects/{id}')['И9 нет пути на 🔵/🟡'] === false);
  check('сплошная у 🟡 → И8 красный', mut('puml', 'S2 --> S4 : INT-5', 'S2 -> S4 : INT-5')['И8 пунктир ⇔ не 🟢'] === false);
  check('ответная стрелка → И4 красный', gradeDiagram(good.puml.replace('@enduml', 'S2 --> S1 : ответ\n@enduml'), 'puml', cards)['И4 только стрелки карточек'] === false);
  check('пропуск INT-6 → И3 красный', gradeDiagram(good.mmd.split('\n').filter((l) => !l.includes('INT-6')).join('\n'), 'mmd', cards)['И3 номера = карточкам'] === false);
  check('плейсхолдер → И12 красный', mut('mmd', 'as notify', 'as <сторона>')['И12 без плейсхолдеров'] === false);
  check('обратное направление → И11 красный', mut('puml', 'S4 --> S5', 'S5 --> S4')['И11 направление из границы'] === false);
  check('note → И5 красный', gradeDiagram(good.puml.replace('@enduml', 'note over S1 : x\n@enduml'), 'puml', cards)['И5 разметка без лишнего'] === false);
  // ID-RING: кольцо, встречные пары, два имени одного сервиса, карточка без направления.
  const ring = parseCards(read(join(fixDir('ring'), specRel('ring'))));
  check('ring: карточек 11, без направления одна (INT-11)', ring.length === 11 && ring.filter((c) => !sides(c.border)).map((c) => c.n).join() === '11');
  const P = ['Мобильное приложение', 'returns-api', 'warehouse-service', 'courier-gateway', 'billing', 'notify', 'Покупатель', 'бэкенд возвратов'];
  const A = [[1, 1, 2, '🟢 Оформление возврата — POST /v1/returns'], [2, 2, 3, '🔵 Бронь слота приёмки'], [3, 2, 4, '🟡 Заказ курьера у партнёра'],
    [4, 4, 2, '🟢 Статус курьера (вебхук) — POST /v1/returns/{returnId}/courier-status'], [5, 3, 5, '🔵 Товар принят на складе'],
    [6, 5, 2, '🟢 Результат возврата денег (колбэк) — POST /v1/returns/{returnId}/refund-status'],
    [7, 2, 6, '🟢 Событие смены статуса возврата — returns.status-changed'], [8, 6, 7, '🔵 SMS покупателю'],
    [9, 2, 5, '🟡 Запрос возврата денег'], [10, 8, 3, '🟡 Отмена брони слота']];
  const ringPuml = ['@startuml', ...P.map((n, i) => `participant "${n}" as S${i + 1}`),
    ...A.map(([n, f, t, l]) => `S${f} ${l.startsWith('🟢') ? '->' : '-->'} S${t} : INT-${n} ${l}`), '@enduml'].join('\n');
  const rr = gradeDiagram(ringPuml, 'puml', ring);
  check('ring: эталон зелёный целиком', Object.values(rr).every(Boolean));
  if (!Object.values(rr).every(Boolean)) console.log(rr);
  check('ring: склеил «бэкенд возвратов» с returns-api → И11 красный',
    gradeDiagram(ringPuml.replace('S8 --> S3 : INT-10', 'S2 --> S3 : INT-10'), 'puml', ring)['И11 направление из границы'] === false);
  check('ring: выбросил вебхук INT-4 как ответ → И3 красный',
    gradeDiagram(ringPuml.split('\n').filter((l) => !l.includes('INT-4 ')).join('\n'), 'puml', ring)['И3 номера = карточкам'] === false);
  check('ring: нарисовал INT-11 → И3 красный',
    gradeDiagram(ringPuml.replace('@enduml', 'S3 --> S5 : INT-11 ❓ Сверка остатков с 1С\n@enduml'), 'puml', ring)['И3 номера = карточкам'] === false);
  check('ring: путь из services/ на 🟡 INT-10 → И9 красный',
    gradeDiagram(ringPuml.replace('INT-10 🟡 Отмена брони слота', 'INT-10 🟡 Отмена брони слота — DELETE /internal/slots/{slotId}'), 'puml', ring)['И9 нет пути на 🔵/🟡'] === false);
  check('И14: ring вне §1.2 — Покупатель, бэкенд возвратов',
    notInOverview(read(join(fixDir('ring'), specRel('ring'))), ring).join() === 'Покупатель,бэкенд возвратов');
  check('И14: diag вне §1.2 — планшет группы', notInOverview(spec, cards).join() === 'планшет группы');
  check('И13: INT-1 не засчитан за INT-11', namedSkips('без стрелки: INT-1', ['INT-11']) === false
    && namedSkips('без стрелки: INT-11 — направление не решено', ['INT-11']));
  console.log(ok ? 'SELFTEST OK' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') selftest();
else if (args[0]) {
  const dir = args[0];
  const fmtArg = args.find((a) => a.startsWith('--format='));
  const base = dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  const bm = base.match(/^(id|ring)-(mmd|puml|ask)/) ?? [];
  const fx = bm[1] ?? 'id';
  const format = fmtArg ? fmtArg.slice(9) : bm[2];
  if (!format) { console.error('формат не определён: --format=mmd|puml|ask'); process.exit(1); }
  const runs = readdirSync(dir).filter((e) => /^run-\d+$/.test(e)).sort();
  const tally = {};
  let whole = 0;
  for (const run of runs) {
    const { r, made } = gradeRun(join(dir, run), format, fx);
    const green = Object.values(r).every(Boolean);
    if (green) whole += 1;
    for (const [k, v] of Object.entries(r)) tally[k] = (tally[k] ?? 0) + (v ? 1 : 0);
    const red = Object.entries(r).filter(([, v]) => !v).map(([k]) => k.split(' ')[0]);
    console.log(`${run}: ${green ? 'зелёный' : 'красный ' + red.join(',')}${made.length ? '  новые файлы: ' + made.join(', ') : ''}`);
  }
  console.log('---');
  for (const [k, v] of Object.entries(tally)) console.log(`${k}: ${v}/${runs.length}`);
  console.log(`зелёный целиком: ${whole}/${runs.length}`);
} else {
  console.error('usage: node grade-id.mjs <папка-пробы> [--format=mmd|puml|ask] | --selftest');
  process.exit(1);
}
