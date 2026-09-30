#!/usr/bin/env node
// Грейдер `interaction-diagram` 2.0.0: схема — проекция INT-карточек спеки.
//
//   node grade-id.mjs <папка-пробы> [--format=mmd|puml|ask]   — фикстура и формат из имени папки:
//     id-* → ID-DIAG, ring-* → ID-RING, dir-* → ID-DIR, rep-* → ID-REP; суффикс mmd/puml/ask
//   node grade-id.mjs --selftest
//
// Истина — карточки спеки ФИКСТУРЫ (не песочницы: прогон мог её поправить, это отдельный красный).
// Из карточки берутся только «Граница/направление» и «Контракт…» (запрос/событие).
// Стрелка по границе: `A → B` — A→B, `A ← B` — B→A, `A ↔ B` — двусторонняя, все сплошные;
// `событие:` — асинхронная. Имя участника — сторона до первой « (». Подпись — `INT-N` или
// `INT-N · <метод и путь | имя события>`; путь на стрелке = путь из контракта (нет там — нет и тут).
// Карточка без знака стрелки не рисуется и обязана быть названа в отчёте (И13).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = { id: 'ID-DIAG', ring: 'ID-RING', dir: 'ID-DIR', rep: 'ID-REP' };
const fixDir = (k) => join(HERE, 'fixtures', FIXTURES[k]);
const specRel = (k) => {
  const key = readdirSync(join(fixDir(k), 'docs')).find((d) => existsSync(join(fixDir(k), 'docs', d, 'technical_specification.md')));
  return `docs/${key}/technical_specification.md`;
};
const norm = (s) => s.replace(/\r/g, '');
const read = (p) => (existsSync(p) ? norm(readFileSync(p, 'utf8')) : null);

const PATH_RE = /\b(GET|POST|PUT|PATCH|DELETE)\b\s*(?:\([^)]*\)\s*)?(\/[^\s,;`]+)/;
const SIGNS = ['↔', '←', '→'];

/** Карточки `### INT-N. …`: граница, событие ли, путь из «Контракт (запрос|событие)» / «Контракт». */
export function parseCards(spec) {
  const lines = spec.split('\n');
  const cards = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^###\s+INT-(\d+)\./);
    if (!m) continue;
    let border = null;
    let contract = '';
    for (let j = i + 1; j < lines.length && !/^###?\s/.test(lines[j]); j += 1) {
      const b = lines[j].match(/\*\*Граница\/направление:\*\*\s*(.*)$/);
      if (b) border = b[1];
      const c = lines[j].match(/\*\*Контракт(?: \((?:запрос|событие)\))?:\*\*\s*(.*)$/);
      if (c) contract += ` ${c[1]}`;
    }
    const pm = contract.replace(/`/g, '').match(PATH_RE);
    cards.push({ n: Number(m[1]), border, event: /^\s*событие:/i.test(border ?? ''), path: pm ? [pm[1], pm[2]] : null });
  }
  return cards;
}

export const signOf = (border) => SIGNS.find((s) => border?.includes(s)) ?? null;

/** Стороны границы: без «событие:», обратных кавычек; имя — до первой « (». */
export function sides(border) {
  const k = signOf(border);
  if (!k) return null;
  const clean = (s) => s.replace(/^\s*событие:\s*/i, '').replace(/`/g, '').split(' (')[0].trim();
  const [a, b] = border.split(k);
  if (!clean(a) || !clean(b)) return null;
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
      const a = l.match(/^(\w+)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?(\w+)\s*:\s*(.*)$/);
      if (a) {
        arrows.push({ from: a[1], to: a[3], dashed: a[2].includes('--'), both: a[2].startsWith('<<'), async: a[2].endsWith(')'), label: a[4] });
        continue;
      }
    } else {
      p = l.match(/^(?:participant|actor)\s+"([^"]+)"\s+as\s+(\w+)$/) || l.match(/^(?:participant|actor)\s+(\S+)$/);
      if (p) { parts.set(p[2] ?? p[1], p[1]); continue; }
      const a = l.match(/^(\w+)\s*(<?-{1,2}>{0,2})\s*(\w+)\s*:\s*(.*)$/);
      if (a) {
        const both = a[2].startsWith('<') && a[2].endsWith('>');
        const rev = a[2].startsWith('<') && !both; // `A <- B` — то же, что `B -> A`
        arrows.push({ from: rev ? a[3] : a[1], to: rev ? a[1] : a[3], dashed: a[2].includes('--'), both, async: a[2].endsWith('>>'), label: a[4] });
        continue;
      }
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
  r['И4 только стрелки карточек'] = nums.every((n) => !Number.isNaN(n)) && !d.arrows.some((a) => a.from === a.to);
  r['И5 разметка без лишнего'] = d.other.length === 0;
  const allSides = new Set(cards.flatMap((c) => sides(c.border) ?? []));
  const names = [...d.parts.values()];
  r['И6 участники = стороны'] = names.length > 0 && names.every((nm) => allSides.has(nm)) && new Set(names).size === names.length;
  r['И10 алиасы S1, S2… по порядку'] = [...d.parts.keys()].every((k, j) => k === `S${j + 1}`);
  let label = true, kind = true, path = true, dir = true;
  d.arrows.forEach((a, k) => {
    const c = cards.find((x) => x.n === nums[k]);
    if (!c) return;
    const text = a.label.replace(/#59;/g, ';').replace(/#35;/g, '#').trim();
    const lm = text.match(/^INT-\d+(?:\s+·\s+(.+))?$/);
    if (!lm) label = false;
    const tail = lm?.[1] ?? '';
    if (c.path ? !(tail.includes(c.path[0]) && tail.includes(c.path[1])) : PATH_RE.test(tail)) path = false;
    const sign = signOf(c.border);
    if (a.dashed || a.async !== c.event || a.both !== (sign === '↔')) kind = false;
    const s = sides(c.border);
    const [f, t] = [d.parts.get(a.from), d.parts.get(a.to)];
    if (sign === '→' && !(f === s[0] && t === s[1])) dir = false;
    if (sign === '←' && !(f === s[1] && t === s[0])) dir = false;
    if (sign === '↔' && !((f === s[0] && t === s[1]) || (f === s[1] && t === s[0]))) dir = false;
  });
  r['И7 подпись INT-N [· токен]'] = label;
  r['И8 вид стрелки по границе'] = kind;
  r['И9 путь = карточке'] = path;
  r['И11 направление из границы'] = dir;
  r['И12 без плейсхолдеров'] = !/<[^>\n]*[а-яa-z][^>\n]*>/i.test(text.replace(/<<-->>|<<->>|<-->|<->|-->>|->>|-->|->|<--|<-/g, ''));
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

const NOT_SERVICES = new Set(['Покупатель', 'планшет группы', 'Браузер заказчика']);

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

/** Эталон по списку [номер, от, к, стрелка, подпись-хвост]. */
function build(format, parts, arrows) {
  const op = { '→': ['->>', '->'], '↔': ['<<->>', '<->'], '~': ['-)', '->>'] };
  const i = format === 'mmd' ? 0 : 1;
  const lines = arrows.map(([n, f, t, k, tail]) => {
    const lbl = `INT-${n}${tail ? ` · ${tail}` : ''}`;
    return format === 'mmd' ? `    S${f}${op[k][i]}S${t}: ${lbl}` : `S${f} ${op[k][i]} S${t} : ${lbl}`;
  });
  return format === 'mmd'
    ? ['```mermaid', 'sequenceDiagram', ...parts.map((p, j) => `    participant S${j + 1} as ${p}`), ...lines, '```'].join('\n')
    : ['@startuml', ...parts.map((p, j) => `participant "${p}" as S${j + 1}`), ...lines, '@enduml'].join('\n');
}

function selftest() {
  let ok = true;
  const check = (label, cond) => { if (!cond) ok = false; console.log(`${cond ? 'ok ' : 'FAIL'} ${label}`); };
  const green = (label, r) => { const g = Object.values(r).every(Boolean); check(label, g); if (!g) console.log(r); };

  // ID-DIAG: всё `→`, два события, пути в карточках 🔵/🟡 теперь идут на стрелку.
  const spec = read(join(fixDir('id'), specRel('id')));
  const cards = parseCards(spec);
  check('diag: карточек 6, события INT-3/4', cards.length === 6 && cards.filter((c) => c.event).map((c) => c.n).join() === '3,4');
  check('diag: путь INT-2 и INT-5 из контракта', cards[1].path?.join(' ') === 'GET /v2/objects/{id}' && cards[4].path?.join(' ') === 'POST /v1/notify');
  check('diag: стороны INT-2 без скобок', JSON.stringify(sides(cards[1].border)) === JSON.stringify(['dispatch-api', 'objects-registry']));
  const DP = ['dispatch-web', 'dispatch-api', 'objects-registry', 'notify', 'планшет группы'];
  const DA = [[1, 1, 2, '→', 'POST /v1/dispatch-requests'], [2, 2, 3, '→', 'GET /v2/objects/{id}'], [3, 2, 4, '~', 'dispatch-request.created'],
    [4, 4, 5, '~', ''], [5, 2, 4, '→', 'POST /v1/notify'], [6, 1, 2, '→', 'GET /v1/dispatch-requests']];
  const good = { mmd: build('mmd', DP, DA), puml: build('puml', DP, DA) };
  for (const f of ['mmd', 'puml']) green(`diag ${f}: эталон зелёный`, gradeDiagram(good[f], f, cards));
  const mut = (f, from, to) => gradeDiagram(good[f].replace(from, to), f, cards);
  check('путь убран с INT-2 → И9', mut('mmd', 'INT-2 · GET /v2/objects/{id}', 'INT-2')['И9 путь = карточке'] === false);
  check('чужой путь на INT-4 → И9', mut('mmd', 'S4-)S5: INT-4', 'S4-)S5: INT-4 · POST /v1/push')['И9 путь = карточке'] === false);
  check('имя карточки в подписи → И7', mut('mmd', 'INT-2 · GET', 'INT-2 Получение данных · GET')['И7 подпись INT-N [· токен]'] === false);
  check('эмодзи в подписи → И7', mut('mmd', 'INT-2 · GET', 'INT-2 🔵 · GET')['И7 подпись INT-N [· токен]'] === false);
  check('событие синхронной стрелкой → И8', mut('mmd', 'S2-)S4', 'S2->>S4')['И8 вид стрелки по границе'] === false);
  check('вызов пунктиром → И8', mut('puml', 'S2 -> S4 : INT-5', 'S2 --> S4 : INT-5')['И8 вид стрелки по границе'] === false);
  check('вызов асинхронной (puml ->>) → И8', mut('puml', 'S1 -> S2 : INT-1', 'S1 ->> S2 : INT-1')['И8 вид стрелки по границе'] === false);
  check('ответная стрелка → И4', gradeDiagram(good.puml.replace('@enduml', 'S2 -> S1 : ответ\n@enduml'), 'puml', cards)['И4 только стрелки карточек'] === false);
  check('пропуск INT-6 → И3', gradeDiagram(good.mmd.split('\n').filter((l) => !l.includes('INT-6')).join('\n'), 'mmd', cards)['И3 номера = карточкам'] === false);
  check('плейсхолдер → И12', mut('mmd', 'as notify', 'as <сторона>')['И12 без плейсхолдеров'] === false);
  check('обратное направление → И11', mut('puml', 'S2 -> S3', 'S3 -> S2')['И11 направление из границы'] === false);
  check('note → И5', gradeDiagram(good.puml.replace('@enduml', 'note over S1 : x\n@enduml'), 'puml', cards)['И5 разметка без лишнего'] === false);
  const old = read(join(HERE, 'runs/2026-09-24-diag-d-v2/ts-diag/run-05/docs/DSP-330/technical_specification.md'));
  if (old) {
    const r = gradeDiagram(old.match(/```plantuml\n([\s\S]*?)```/)[1], 'puml', cards);
    check('старый блок diag: И4 красный (ответные/служебные)', r['И4 только стрелки карточек'] === false);
  } else console.log('skip: старого блока нет на диске');

  // ID-RING: кольцо, встречные пары, «бэкенд возвратов», INT-11 без направления, «предположительно» пути.
  const ringSpec = read(join(fixDir('ring'), specRel('ring')));
  const ring = parseCards(ringSpec);
  check('ring: карточек 11, без направления одна (INT-11)', ring.length === 11 && ring.filter((c) => !sides(c.border)).map((c) => c.n).join() === '11');
  const RP = ['Мобильное приложение', 'returns-api', 'warehouse-service', 'courier-gateway', 'billing', 'notify', 'Покупатель', 'бэкенд возвратов'];
  const RA = [[1, 1, 2, '→', 'POST /v1/returns'], [2, 2, 3, '→', 'POST /internal/slots'], [3, 2, 4, '→', 'POST /partner/v3/pickups'],
    [4, 4, 2, '→', 'POST /v1/returns/{returnId}/courier-status'], [5, 3, 5, '~', ''],
    [6, 5, 2, '→', 'POST /v1/returns/{returnId}/refund-status'], [7, 2, 6, '~', 'returns.status-changed'], [8, 6, 7, '→', ''],
    [9, 2, 5, '→', 'POST /v2/refunds'], [10, 8, 3, '→', '']];
  const ringPuml = build('puml', RP, RA);
  green('ring: эталон зелёный', gradeDiagram(ringPuml, 'puml', ring));
  check('ring: склеил «бэкенд возвратов» с returns-api → И11',
    gradeDiagram(ringPuml.replace('S8 -> S3 : INT-10', 'S2 -> S3 : INT-10'), 'puml', ring)['И11 направление из границы'] === false);
  check('ring: выбросил вебхук INT-4 → И3',
    gradeDiagram(ringPuml.split('\n').filter((l) => !l.includes('INT-4 ')).join('\n'), 'puml', ring)['И3 номера = карточкам'] === false);
  check('ring: нарисовал INT-11 → И3',
    gradeDiagram(ringPuml.replace('@enduml', 'S3 -> S5 : INT-11\n@enduml'), 'puml', ring)['И3 номера = карточкам'] === false);
  check('ring: путь из services/ на INT-10 → И9',
    gradeDiagram(ringPuml.replace('INT-10', 'INT-10 · DELETE /internal/slots/{slotId}'), 'puml', ring)['И9 путь = карточке'] === false);
  check('И14: ring вне §1.2 — Покупатель, бэкенд возвратов', notInOverview(ringSpec, ring).join() === 'Покупатель,бэкенд возвратов');
  check('И14: diag вне §1.2 — планшет группы', notInOverview(spec, cards).join() === 'планшет группы');

  // ID-DIR: `←`, `↔`, событие, «UI (страница …)» = «UI», путь «предположительно», INT-7 без направления.
  const dirSpec = read(join(fixDir('dir'), specRel('dir')));
  const dir = parseCards(dirSpec);
  check('dir: карточек 7, без направления INT-7, событие INT-5', dir.length === 7
    && dir.filter((c) => !sides(c.border)).map((c) => c.n).join() === '7' && dir.filter((c) => c.event).map((c) => c.n).join() === '5');
  check('dir: «UI (страница …)» и «UI (браузер)» → UI', sides(dir[0].border)[0] === 'UI' && sides(dir[2].border).join() === 'UI,MinIO');
  check('dir: INT-3 без пути, INT-6 путь «предположительно»', dir[2].path === null && dir[5].path?.join(' ') === 'POST /scan');
  const XP = ['UI', 'reports-api', 'MinIO', 'av-scanner', 'notify'];
  const XA = [[1, 1, 2, '→', 'GET /v1/reports'], [2, 1, 2, '→', 'POST /v1/reports/{id}/file'], [3, 1, 3, '↔', ''],
    [4, 4, 2, '→', 'POST /v1/reports/{id}/scan-result'], [5, 2, 5, '~', 'report.ready'], [6, 2, 4, '→', 'POST /scan']];
  const dg = { mmd: build('mmd', XP, XA), puml: build('puml', XP, XA) };
  for (const f of ['mmd', 'puml']) green(`dir ${f}: эталон зелёный`, gradeDiagram(dg[f], f, dir));
  check('dir puml: `S2 <- S4` = `S4 -> S2`', Object.values(gradeDiagram(dg.puml.replace('S4 -> S2 : INT-4', 'S2 <- S4 : INT-4'), 'puml', dir)).every(Boolean));
  const dm = (from, to) => gradeDiagram(dg.mmd.replace(from, to), 'mmd', dir);
  check('← нарисован слева направо → И11', dm('S4->>S2: INT-4', 'S2->>S4: INT-4')['И11 направление из границы'] === false);
  check('← пунктиром → И8', dm('S4->>S2: INT-4', 'S4-->>S2: INT-4')['И8 вид стрелки по границе'] === false);
  check('↔ одной стороной → И8', dm('S1<<->>S3', 'S1->>S3')['И8 вид стрелки по границе'] === false);
  check('два участника UI → И6', gradeDiagram(dg.mmd.replace('    participant S3 as MinIO', '    participant S3 as MinIO\n    participant S6 as UI (браузер)'), 'mmd', dir)['И6 участники = стороны'] === false);
  check('путь «предположительно» не вынесен → И9', dm('INT-6 · POST /scan', 'INT-6')['И9 путь = карточке'] === false);
  check('алиас UI вместо S1 → И10', gradeDiagram(dg.mmd.replace(/S1/g, 'UI'), 'mmd', dir)['И10 алиасы S1, S2… по порядку'] === false);
  check('И14: dir вне §1.2 — UI, MinIO', notInOverview(dirSpec, dir).join() === 'UI,MinIO');
  // ID-REP: реалистичная спека repairy, полная форма шаблона.
  const repSpec = read(join(fixDir('rep'), specRel('rep')));
  const rp = parseCards(repSpec);
  check('rep: карточек 9, без направления INT-9, событие INT-6', rp.length === 9
    && rp.filter((c) => !sides(c.border)).map((c) => c.n).join() === '9' && rp.filter((c) => c.event).map((c) => c.n).join() === '6');
  check('rep: пути из контракта, не из «Авторизации»/«Триггера»', rp.map((c) => c.path?.join(' ') ?? '-').join('|')
    === 'POST /projects/:pid/payments/online|POST /v3/payments|-|POST /webhooks/yookassa|-|-|GET /projects/:pid/payments/online/:paymentId|POST /v3/refunds|-');
  const PP = ['repairy-web', 'repairy-api', 'ЮKassa', 'Браузер заказчика', 'S3-хранилище', 'repairy-telegram', 'YooKassa'];
  const PA = [[1, 1, 2, '→', 'POST /projects/:pid/payments/online'], [2, 2, 3, '→', 'POST /v3/payments'], [3, 4, 3, '↔', ''],
    [4, 3, 2, '→', 'POST /webhooks/yookassa'], [5, 2, 5, '→', ''], [6, 2, 6, '~', 'payment.succeeded'],
    [7, 1, 2, '→', 'GET /projects/:pid/payments/online/:paymentId'], [8, 2, 7, '→', 'POST /v3/refunds']];
  const pg = { mmd: build('mmd', PP, PA), puml: build('puml', PP, PA) };
  for (const f of ['mmd', 'puml']) green(`rep ${f}: эталон зелёный`, gradeDiagram(pg[f], f, rp));
  check('rep: склеил YooKassa с ЮKassa → И11', gradeDiagram(pg.mmd.replace('S2->>S7: INT-8', 'S2->>S3: INT-8'), 'mmd', rp)['И11 направление из границы'] === false);
  check('rep: GET из «Авторизации» на INT-4 → И9', gradeDiagram(pg.mmd.replace('INT-4 · POST /webhooks/yookassa', 'INT-4 · GET /v3/payments/{id}'), 'mmd', rp)['И9 путь = карточке'] === false);
  check('И14: rep вне §1.2 — repairy-telegram, YooKassa', notInOverview(repSpec, rp).filter((n) => n !== 'Браузер заказчика').join() === 'repairy-telegram,YooKassa');
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
  const bm = base.match(/^(id|ring|dir|rep)-(mmd|puml|ask)/) ?? [];
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
