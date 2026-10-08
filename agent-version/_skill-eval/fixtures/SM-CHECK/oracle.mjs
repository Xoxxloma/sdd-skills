// Независимый оракул для service-map-2.0/reference/check.sh.
// Написан по контракту (бриф задачи + service-map/SKILL.md «Гард на утоньшение» + card.template.md),
// БЕЗ чтения check.sh. Считает те же числа, что скрипт печатает.
//
//   node oracle.mjs <опись> <черновик> [<прежняя>]   → JSON с числами
//
// Решения там, где контракт молчит (каждое — кандидат в «неоднозначность контракта»):
//  A1. Строка описи без отступа, начинающаяся с «#», «⟹» или «(», ключом не является
//      («(нет — тип backend)» — пометка, а не ключ). «справочник:» ключа не даёт (контракт).
//  A2. «Без файла-источника» проверяется только у строк-ключей (верхний уровень), не у фактов:
//      гейт SKILL.md — «в описи против каждого ключа стоит файл». Файл — в хвосте после
//      последнего « — » есть токен с «/» или «имя.расш».
//  A3. «состояние: X.поле …» → «объект X», X = первое слово после «состояние:», до первой точки.
//  A4. Пара ключа описи в черновике: блоки (контракт, топики, задачи, сущности, бизнес),
//      первая колонка «Экраны»/«Роли и доступ»/«Зависит от», ВТОРАЯ колонка (вызов) «Потребляемых API».
//      «Нет в описи» считается только по классам описи из брифа: контракт, сущности, задачи,
//      топики, бизнес-правила, экраны, роли.
//  A5. Группы «Что умеет»: HTTP-ключи контракта по префиксу пути (ведущие «api»/«vN» + следующий
//      сегмент, параметр «:x»/«{x}» обрывает), плюс каждая фоновая задача и каждый потребляемый топик.
//  A6. [уточнено координатором] Строка таблицы, у которой первая ячейка после нормализации — «—»
//      (пустая форма «| — | | |» и строка знания «| — | не определено: … |»), ключом не является
//      ни в одном классе и в «строк таблиц» не считается.
//  A7. Гард — по МНОЖЕСТВАМ ключей (SKILL.md: «возьми множества ключей»): дубли строк — один ключ.
//  A8. [уточнено координатором] Ключ роли («Роли и доступ») — текст ячейки до первого « — »;
//      область в скобках остаётся частью ключа. Одинаково для прежней карточки и черновика;
//      в описи ключ роли — как у любой строки: до « — ». Другие таблицы не режутся.
//  A10. [уточнено координатором] Строка описи без отступа, начинающаяся с «<!--» (строка свежести части), ключом не является.
//  A9. [уточнено координатором] Строка описи без « — » — ключ без файла, кроме подписи вида
//      «Эндпоинты:» (строка кончается двоеточием).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEP = ' — ';
const VERB = /^(get|post|put|patch|delete|head|options)$/i;

export function norm(s) {
  let t = String(s ?? '').replace(/[`«»]/g, '').replace(/\s+/g, ' ').trim();
  const sp = t.indexOf(' ');
  const first = sp < 0 ? t : t.slice(0, sp);
  if (VERB.test(first)) t = first.toUpperCase() + (sp < 0 ? '' : t.slice(sp));
  return t;
}

function headKey(h) {
  const i = h.indexOf(SEP);
  return norm(i < 0 ? h : h.slice(0, i));
}

function splitLines(text) {
  return String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.replace(/\r$/, ''));
}

// ---------- карточка (черновик или прежняя) ----------

const BLOCK_SECTIONS = {
  'Публичный контракт': 'контракт',
  'Публичный API': 'контракт',
  'Владеет данными': 'сущности',
  'Фоновые задачи': 'задачи',
  'События': 'топики',
  'Бизнес-правила': 'бизнес',
};
const TABLE_SECTIONS = {
  'Экраны': 'экраны',
  'Роли и доступ': 'роли',
  'Зависит от': 'зависит',
  'Потребляемые API': 'api',
  'Состояние и данные': 'состояние',   // фронт: что хранится — пара строкам описи, в «нет в описи» не идёт
};

function cells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}
const isSep = (r) => {
  const c = cells(r);
  return c.length > 0 && c.every((x) => /^:?-+:?$/.test(x));
};
// пустая форма и строка знания: первая ячейка после нормализации — «—» (A6)
const isDashRow = (r) => norm(cells(r)[0]) === '—';
// ключ роли: до первого « — », скобка с областью остаётся (A8)
const roleKey = (c) => headKey(c[0]);

export function parseCard(text) {
  const blocks = { контракт: [], сущности: [], задачи: [], топики: [], бизнес: [] };
  const rawRows = { экраны: [], роли: [], зависит: [], api: [], состояние: [] };
  let sec = null;
  let cur = null;
  for (const line of splitLines(text)) {
    const h = line.match(/^#{1,2} (.*)$/);
    if (h) {
      sec = line.startsWith('## ') ? h[1].trim() : null;
      cur = null;
      continue;
    }
    if (line.startsWith('### ')) {
      const cls = BLOCK_SECTIONS[sec];
      cur = cls ? { header: line.slice(4), body: false } : null;
      if (cls) blocks[cls].push(cur);
      continue;
    }
    if (cur && line.startsWith('- ')) cur.body = true;
    const t = TABLE_SECTIONS[sec];
    if (t && line.startsWith('|')) rawRows[t].push(line);
  }
  const tables = {};
  for (const [t, rows] of Object.entries(rawRows)) {
    tables[t] = [];
    rows.forEach((r, i) => {
      if (isSep(r)) return;
      if (i + 1 < rows.length && isSep(rows[i + 1])) return; // строка заголовка
      if (isDashRow(r)) return;
      tables[t].push(cells(r));
    });
  }
  return { blocks, tables };
}

function blockMap(list) {
  const m = new Map();
  for (const b of list) {
    const k = headKey(b.header);
    m.set(k, (m.get(k) ?? false) || b.body);
  }
  return m;
}
function bizKey(header) {
  const k = headKey(header);
  if (k.startsWith('сообщение')) return { kind: 'msg', key: k };
  if (k.startsWith('ограничение')) return { kind: 'lim', key: k };
  return { kind: 'obj', key: 'объект ' + k };
}

export const GUARD_CLASSES = ['контракт', 'сущности', 'задачи', 'топики', 'экраны', 'потребляемые API', 'роли', 'зависит от'];

function guardKeys(card) {
  const rowMap = (rows, f) => new Map(rows.map((c) => [f(c), false]));
  return {
    'контракт': blockMap(card.blocks.контракт),
    'сущности': blockMap(card.blocks.сущности),
    'задачи': blockMap(card.blocks.задачи),
    'топики': blockMap(card.blocks.топики),
    'экраны': rowMap(card.tables.экраны, (c) => norm(c[0])),
    'потребляемые API': rowMap(card.tables.api, (c) => norm(c[0]) + ' :: ' + norm(c[1] ?? '')),
    'роли': rowMap(card.tables.роли, roleKey),
    'зависит от': rowMap(card.tables.зависит, (c) => norm(c[0])),
  };
}

// ---------- опись ----------

function hasFile(line) {
  const i = line.lastIndexOf(SEP);
  if (i < 0) return false;
  const tail = line.slice(i + SEP.length);
  return /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]|[A-Za-z0-9_-]+\.[A-Za-z][A-Za-z0-9]{0,5}(?![A-Za-z0-9])/.test(tail);
}

export function parseOpis(text) {
  const keys = new Map(); // key -> {kind, fact}
  const nofile = [];
  const totals = [];
  let cur = null;
  for (const line of splitLines(text)) {
    if (line.trim() === '') continue;
    if (line.trim().startsWith('⟹')) { totals.push(line.trim()); cur = null; continue; }
    if (/^\s/.test(line)) {
      if (cur && line.trim().startsWith('·')) cur.fact = true;
      continue;
    }
    if (line.startsWith('<!--')) { cur = null; continue; } // строка свежести части — не ключ (A10)
    if (line.startsWith('#') || line.startsWith('(') || line.startsWith('>')) { cur = null; continue; } // «> пройдено: …» остатка — не ключ
    if (line.startsWith('справочник:')) { cur = null; continue; }
    const i = line.indexOf(SEP);
    if (i < 0 && line.trim().endsWith(':')) { cur = null; continue; } // подпись «Эндпоинты:» (A9)
    const kt = i < 0 ? line : line.slice(0, i);
    let key;
    let kind = 'other';
    if (kt.startsWith('состояние:')) {
      const rest = norm(kt.slice('состояние:'.length));
      key = 'объект ' + rest.split(' ')[0].split('.')[0];
      kind = 'obj';
    } else if (kt.startsWith('сообщение:')) {
      key = norm('сообщение ' + kt.slice('сообщение:'.length));
      kind = 'msg';
    } else if (kt.startsWith('ограничение:')) {
      key = norm('ограничение ' + kt.slice('ограничение:'.length));
      kind = 'lim';
    } else {
      key = norm(kt.replace(/^[Рр]оль:\s*/, '')); // «роль: OWNER» ↔ строка таблицы «OWNER»
    }
    if (!hasFile(line)) nofile.push(key);
    if (!keys.has(key)) keys.set(key, { kind, fact: false });
    cur = keys.get(key);
  }
  return { keys, nofile, totals };
}

// ---------- группы «Что умеет» ----------

function pathPrefix(p) {
  const out = [];
  for (const s of p.split('/').filter(Boolean)) {
    if (/^[:{]/.test(s)) break;
    out.push(s);
    if (!/^(api|v\d+)$/i.test(s)) break;
  }
  return '/' + out.join('/');
}

// ---------- всё вместе ----------

export function analyze(opisText, draftText, prevText) {
  const d = parseCard(draftText);
  const o = parseOpis(opisText);
  { // ключ описи вызовом при том же ключе без скобок — один ключ (после склейки частей бывают оба)
    const callBare = (k) => (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(k) || !/[^ (]\(.*\)$/.test(k) ? k : k.replace(/\(.*\)$/, ''));
    for (const [k, v] of [...o.keys]) { const b = callBare(k); if (b !== k && o.keys.has(b)) { if (v.fact) o.keys.get(b).fact = true; o.keys.delete(k); } }
  }

  const cnt = (list) => [list.length, list.filter((b) => b.body).length, list.filter((b) => !b.body).length];
  const topicDir = (b) => headKey(b.header).split(' ')[0];
  const biz = d.blocks.бизнес.map((b) => bizKey(b.header));
  const draft = {
    'контракт': cnt(d.blocks.контракт),
    'сущности': cnt(d.blocks.сущности),
    'задачи': cnt(d.blocks.задачи),
    'топики': [d.blocks.топики.length,
      d.blocks.топики.filter((b) => topicDir(b) === 'потребляет').length,
      d.blocks.топики.filter((b) => topicDir(b) === 'публикует').length],
    'бизнес': ['obj', 'msg', 'lim'].map((k) => biz.filter((x) => x.kind === k).length),
    'таблицы': [d.tables.экраны.length, d.tables.роли.length, d.tables.зависит.length, d.tables.api.length],
  };

  const okinds = [...o.keys.values()].map((v) => v.kind);
  const opis = {
    'ключей': o.keys.size,
    'бизнес': ['obj', 'msg', 'lim'].map((k) => okinds.filter((x) => x === k).length),
    'без файла': o.nofile.length,
    'итоги': o.totals,
  };

  // индекс ключей черновика: ключ -> {cls, blocks}
  const idx = new Map();
  const classKeys = { контракт: new Set(), сущности: new Set(), задачи: new Set(), топики: new Set(), бизнес: new Set(), экраны: new Set(), роли: new Set() };
  const add = (cls, key, block) => {
    if (classKeys[cls]) classKeys[cls].add(key);
    if (!idx.has(key)) idx.set(key, { cls, blocks: [] });
    const e = idx.get(key);
    if (e.cls === cls && block) e.blocks.push(block);
  };
  for (const b of d.blocks.контракт) add('контракт', headKey(b.header), b);
  for (const b of d.blocks.топики) add('топики', headKey(b.header), b);
  for (const b of d.blocks.задачи) add('задачи', headKey(b.header), b);
  for (const b of d.blocks.сущности) add('сущности', headKey(b.header), b);
  for (const b of d.blocks.бизнес) add('бизнес', bizKey(b.header).key, b);
  for (const c of d.tables.экраны) add('экраны', norm(c[0]));
  for (const c of d.tables.роли) add('роли', roleKey(c));
  for (const c of d.tables.api) add('потребляет', norm(c[1] ?? ''));
  for (const c of d.tables.зависит) add('зависит', norm(c[0]));
  for (const c of d.tables.состояние ?? []) add('состояние', norm(c[0]));

  // Пара ключу описи: точная; иначе — без хвоста параметров запроса («…/filter?field=x» ↔ «…/filter»),
  // и только среди ключей черновика, оставшихся без точной пары: «?action=list» и «?action=delete»
  // не сливаются.
  const noq = (k) => k.replace(/\?[A-Za-z_][^=?/ ]*=.*$/, '');
  const pair = new Map();
  const taken = new Set();
  for (const k of o.keys.keys()) if (idx.has(k)) { pair.set(k, k); taken.add(k); }
  const free = new Map();
  for (const k of idx.keys()) if (!taken.has(k) && !free.has(noq(k))) free.set(noq(k), k);
  for (const k of o.keys.keys()) {
    if (pair.has(k)) continue;
    const dk = free.get(noq(k));
    if (dk !== undefined && !taken.has(dk)) { pair.set(k, dk); taken.add(dk); }
  }
  // третий проход — ключ контракта без HTTP-глагола сводится без хвоста в скобках («query goal(id)», «Svc.Assign(Req)»)
  const HTTP = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /;
  const nop = (k) => (HTTP.test(k) || !/[^ (]\(.*\)$/.test(k) ? k : k.replace(/\(.*\)$/, '')); // хвост-вызов: скобка без пробела перед ней
  const freeP = new Map();
  for (const [k, e] of idx) if (!taken.has(k) && e.cls === 'контракт' && !freeP.has(nop(k))) freeP.set(nop(k), k);
  for (const k of o.keys.keys()) {
    if (pair.has(k)) continue;
    const dk = freeP.get(nop(k));
    if (dk !== undefined && !taken.has(dk)) { pair.set(k, dk); taken.add(dk); }
  }
  // четвёртый проход — операция GraphQL с типом и без него («mutation saveTask» ↔ «saveTask»)
  const bop = (k) => nop(k).replace(/^(query|mutation|subscription) /, '');
  const freeO = new Map();
  for (const [k, e] of idx) if (!taken.has(k) && e.cls === 'контракт' && !freeO.has(bop(k))) freeO.set(bop(k), k);
  for (const k of o.keys.keys()) {
    if (pair.has(k)) continue;
    const dk = freeO.get(bop(k));
    if (dk !== undefined && !taken.has(dk)) { pair.set(k, dk); taken.add(dk); }
  }
  const dups = [...idx].filter(([k, e]) => e.cls === 'контракт' && nop(k) !== k && idx.get(nop(k))?.cls === 'контракт').length;
  const byClass = {};
  let missingInDraft = 0;
  let factEmpty = 0;
  const emptyList = [];
  for (const [k, v] of o.keys) {
    const e = pair.has(k) ? idx.get(pair.get(k)) : undefined;
    if (!e) { missingInDraft++; byClass['без пары'] = (byClass['без пары'] ?? 0) + 1; continue; }
    byClass[e.cls] = (byClass[e.cls] ?? 0) + 1;
    if (v.fact && e.blocks.length > 0 && e.blocks.every((b) => !b.body)) { factEmpty++; emptyList.push(k); }
  }
  let missingInOpis = 0;
  for (const set of Object.values(classKeys)) for (const k of set) if (!taken.has(k)) missingInOpis++;

  const groups = new Set();
  for (const k of classKeys.контракт) {
    const m = k.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\S+)/);
    if (m) groups.add(pathPrefix(m[2]));
  }
  for (const k of classKeys.задачи) groups.add('задача ' + k);
  for (const k of classKeys.топики) if (k.startsWith('потребляет')) groups.add(k);

  // перечень добора (SKILL.md 3.0.8): ключ описи с источником без блока и ключ описи без источника
  // при блоке в карточке (оба — кроме «Бизнес-правил»), факт описи при пустом блоке, один ключ двумя
  // блоками. Сверка запись не останавливает.
  const nofile = new Set(o.nofile);
  const missSrc = [...o.keys].filter(([k, v]) => !pair.has(k) && v.kind === 'other' && !nofile.has(k)).length;
  const pairNoSrc = [...o.keys].filter(([k, v]) => pair.has(k) && v.kind === 'other' && nofile.has(k)).length;
  // ключи карточки по классам — для маркерного гейта: ключ контракта вызовом при том же ключе
  // без скобок — один ключ; перегрузки без голого ключа — разные.
  const cardKeys = {};
  for (const c of ['контракт', 'сущности', 'задачи', 'топики', 'экраны']) {
    const set = classKeys[c];
    cardKeys[c] = [...set].filter((k) => !(c === 'контракт' && nop(k) !== k && set.has(nop(k)))).length;
  }
  draft['ключи'] = cardKeys;
  // пункты перечня добора списками — для раскладки по авторам (не поле сравнения)
  const METH = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) |^(query|mutation|subscription) |^[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*$/;
  const items = {
    ADD: [...o.keys].filter(([k, v]) => !pair.has(k) && v.kind === 'other' && !nofile.has(k)).map(([k]) => [k]),
    NOSRC: [...o.keys].filter(([k, v]) => pair.has(k) && v.kind === 'other' && nofile.has(k)).map(([k]) => [k]),
    EMPTY: emptyList.map((k) => [k]),
    DUP: [...idx].filter(([k, e]) => e.cls === 'контракт' && nop(k) !== k && idx.get(nop(k))?.cls === 'контракт').map(([k]) => [nop(k), k]),
    nometh: [...classKeys.контракт].filter((k) => !METH.test(k)).map((k) => [k]),
  };
  const sverka = {
    'добор': `${missSrc}/${pairNoSrc}/${factEmpty}/${dups}`,
    'нет в черновике': missingInDraft,
    'нет в описи': missingInOpis,
    'факт, пустой блок': factEmpty,
    'по классам': byClass,
    'групп': groups.size,
  };

  let guard = null;
  let fired = [];
  let route = null;
  if (prevText !== null && prevText !== undefined) {
    const P = guardKeys(parseCard(prevText));
    const N = guardKeys(d);
    guard = {};
    for (const c of GUARD_CLASSES) {
      const p = P[c];
      const n = N[c];
      const was = p.size;
      const gone = [...p.keys()].filter((k) => !n.has(k)).length;
      const appeared = [...n.keys()].filter((k) => !p.has(k)).length;
      const emptied = [...p.keys()].filter((k) => n.has(k) && p.get(k) && !n.get(k)).length;
      guard[c] = [was, gone, appeared, emptied];
      if ((gone >= 3 && 3 * gone > was) || (emptied >= 3 && 3 * emptied > was)) fired.push(c);
    }
    route = fired.length ? 'В _pending' : 'ПОВЕРХ';
  }
  return { 'черновик': draft, 'опись': opis, 'сверка': sverka, 'гард': guard, 'сработал': fired, 'маршрут': route, _items: items };
}

// ---------- «== КАНДИДАТЫ ПРОВЕРОК» ----------
// Решения там, где контракт раздела молчит:
//  C1. [уточнено координатором] Роль «—» (первая ячейка «—»: пустая форма, строка знания)
//      и пустая роль переключателем не считаются.
//  C2. «Хвост-файл»: строка секции кончается `\S+/<имя>.<буквы>` (+ «`», «)», пробелы);
//      абсолютный путь «/v1/x.csv» тоже подходит. Строки до первого «## » не смотрятся.
//      [уточнено] Заголовки «### …» не кандидаты.
//  C3. «Секрет» ищется во всех строках вне ограждений, включая шапку до первого «## »;
//      [уточнено] кроме заголовков «### …».
//  C5. [уточнено] Порядок секций в «порядок блоков нарушен:» не задан — сравнивается как множество.
//  C4. Ключ порядка у HTTP-блока — «путь + пробел + ГЛАГОЛ».

const hasCode = (s) => {
  const t = s.replace(/`[^`]*`/g, '');
  return / \/[a-z]/.test(t) || /\b(GET|POST|PUT|PATCH|DELETE)\b/.test(t) || /\b[a-z]+[A-Z][A-Za-z]*\b/.test(t) || /[a-z]+\.[a-z-]+\.[a-z-]+/.test(t);
};
const isSepRow = (l) => /^\s*\|[\s:|-]*-[\s:|-]*\|?\s*$/.test(l);

export function manifestNames(text) {
  if (text === null) return null;
  const out = [];
  for (const l of splitLines(text)) {
    const m = l.match(/^\s*(?:-\s*)?name:\s*["']?([^"'\s#]+)/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function findManifest(draftPath) {
  const d = path.dirname(draftPath);
  for (const p of [path.join(d, '..', 'manifest.yaml'), path.join(d, 'manifest.yaml')]) if (fs.existsSync(p)) return p;
  return null;
}

export function candidates(text, names) {
  const raw = splitLines(text);
  const vis = [];
  let fence = false;
  let sec = null;
  raw.forEach((s, i) => {
    if (/^\s*```/.test(s)) { fence = !fence; return; }
    if (fence) return;
    if (s.startsWith('## ')) sec = s.slice(3).trim();
    vis.push({ n: i + 1, s, sec });
  });
  const inSec = (p) => vis.filter((v) => v.sec !== null && p(v.sec));
  const dataRows = (p) => {
    const out = [];
    let seen = false;
    let cur = null;
    for (const v of inSec(p)) {
      if (v.sec !== cur) { cur = v.sec; seen = false; }
      if (v.s.startsWith('## ')) continue;
      if (isSepRow(v.s)) { seen = true; continue; }
      if (seen && v.s.trimStart().startsWith('|')) out.push({ ...v, c0: cells(v.s)[0] ?? '' });
    }
    return out;
  };
  const blocks = (p) => {
    const out = [];
    let cur = null;
    for (const v of inSec(p)) {
      if (v.s.startsWith('## ')) { cur = null; continue; }
      if (v.s.startsWith('### ')) { cur = { n: v.n, header: v.s.slice(4), body: [], sec: v.sec }; out.push(cur); continue; }
      if (cur) cur.body.push(v.s);
    }
    return out;
  };
  const isBR = (s) => s === 'Бизнес-правила';
  const isContract = (s) => s === 'Публичный контракт' || s === 'Публичный API';
  const nm = names ?? [];
  const r = {};

  r['бр.заголовки'] = inSec(isBR).filter((v) => v.s.startsWith('### ') && !/^`[^`]+`/.test(v.s.slice(4)) && !v.s.slice(4).startsWith('сообщение «') && !v.s.slice(4).startsWith('ограничение «')).map((v) => v.n);
  r['бр.код'] = inSec(isBR).filter((v) => hasCode(v.s)).map((v) => v.n);
  const roles = dataRows((s) => s === 'Роли и доступ').map((v) => {
    const c = v.c0.replace(/`/g, '');
    const i = c.indexOf(SEP);
    return (i < 0 ? c : c.slice(0, i)).trim();
  }).filter((x) => x !== '' && x !== '—');
  r['бр.ограничения'] = blocks(isBR).filter((b) => b.header.startsWith('ограничение')).filter((b) => {
    const t = ['### ' + b.header, ...b.body].join('\n');
    return !nm.some((x) => t.includes(x)) && !roles.some((x) => t.includes(x));
  }).map((b) => b.n);
  r['назначение'] = inSec((s) => s === 'Назначение').filter((v) => v.s.trim() !== '' && (hasCode(v.s) || v.s.includes('`'))).map((v) => v.n);
  r['что умеет'] = dataRows((s) => s.startsWith('Что умеет')).filter((v) => hasCode(v.c0)).map((v) => v.n);
  r['стек'] = inSec((s) => s === 'Стек').filter((v) => /[0-9]/.test(v.s) && !isSepRow(v.s)).map((v) => v.n);
  r['слипшиеся'] = dataRows((s) => ['Экраны', 'Роли и доступ', 'Зависит от', 'Потребляемые API'].includes(s)).filter((v) => v.c0.includes(', ')).map((v) => v.n);
  r['не из манифеста'] = dataRows((s) => s === 'Зависит от' || s === 'Потребляемые API').filter((v) => {
    const c = v.c0.replace(/`/g, '').trim();
    return c !== '—' && !nm.includes(c) && !v.s.includes('вне манифеста');
  }).map((v) => v.n);
  r['манифест'] = names === null ? 'нет' : 'есть';
  // [уточнено координатором] строки-заголовки «### …» — ключи: ни хвост-файл, ни секрет
  r['хвост-файл'] = vis.filter((v) => v.sec !== null && !v.s.startsWith('### ') && /\S+\/[^\s\/]+\.[A-Za-z]+[`)]*\s*$/.test(v.s)).map((v) => v.n);
  r['секрет'] = vis.filter((v) => !v.s.startsWith('### ') && /[A-Za-z0-9+\/=_-]{21,}/.test(v.s.replace(/`[^`]*`/g, ''))).map((v) => v.n);
  r['события'] = blocks((s) => s === 'События').length;
  r['брокер'] = inSec((s) => s === 'Стек').some((v) => /kafka|rabbit|nats|amqp|sqs|pubsub|pub\/sub|брокер/.test(v.s.toLowerCase())) ? 'да' : 'нет';
  r['без сущностей'] = blocks(isContract).filter((b) => {
    const k = headKey(b.header).toLowerCase();
    if (/health|metrics|ready|live|version|docs|swagger|openapi/.test(k)) return false;
    return !b.body.some((l) => l.startsWith('сущности:'));
  }).map((b) => b.n);
  const order = [];
  const secs = [...new Set(vis.filter((v) => v.sec !== null && !isBR(v.sec) && v.s.startsWith('### ')).map((v) => v.sec))];
  for (const s of secs) {
    const bl = blocks((x) => x === s);
    const key = (h) => {
      let k = h.replace(/`/g, '');
      const i = k.indexOf(SEP);
      k = (i < 0 ? k : k.slice(0, i)).trim();
      const m = isContract(s) && k.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.*)$/i);
      return m ? `${m[2]} ${m[1].toUpperCase()}` : k;
    };
    for (let i = 1; i < bl.length; i++) {
      if (Buffer.compare(Buffer.from(key(bl[i].header)), Buffer.from(key(bl[i - 1].header))) < 0) { order.push(`${s} (строка ${bl[i].n})`); break; }
    }
  }
  r['порядок'] = order.length ? order : 'соблюдён';
  return r;
}

// ---------- маркеры по плану и префикс (SKILL.md 3.0.8, шаг 2) ----------
// Контракт: файл плана plan.sh — строки «итог/часть/файл» через табуляцию; ожидание класса — «итог» по
// сервису либо «часть NN»; ключи карточки по классам против пометок: меньше половины — гейт не пройден,
// больше вдвое — маркер видит не всё. По файлам: ключ описи ссылается на файл, если путь плана кончается
// путём из хвоста строки-ключа описи (слово с «/» либо с расширением). Ключей меньше пометок — дефицит.
// Префикс: путь ключа REST равен префиксу либо начинается с «префикс/»; иначе — ключ без префикса.

function readEnv(envPath) {
  const env = {};
  if (!envPath) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function opisSources(opisText) {
  const tok = new Map();
  const declared = new Set();
  for (let raw of String(opisText).split(/\r?\n/)) {
    if (raw.startsWith('> объявлено без реализации: ')) {
      if (declared.has(raw)) continue;
      declared.add(raw);
      raw = raw.slice('> объявлено без реализации: '.length);
    }
    if (!raw || /^[ \t]/.test(raw) || /^(#|⟹|\(|>|-|```|<!--)/.test(raw)) continue;
    const i = raw.indexOf(SEP);
    if (i < 0) continue;
    const seen = new Set();
    for (let w of raw.slice(i + SEP.length).split(/[\s+,;]+/)) {
      w = w.replace(/[`()]/g, '').replace(/\\/g, '/').replace(/^\.\//, '');
      if (!/\//.test(w) && !/\.[A-Za-z0-9]+$/.test(w)) continue;
      if (!seen.has(w)) { seen.add(w); tok.set(w, (tok.get(w) ?? 0) + 1); }
    }
  }
  return tok;
}

const nopK = (k) => (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(k) || !/[^ (]\(.*\)$/.test(k) ? k : k.replace(/\(.*\)$/, ''));

// ключи карточки по классам с тем же правилом, что у сервиса: вызов при голом ключе — один ключ
function keyCounts(cardText) {
  const d = parseCard(cardText);
  const sets = {
    контракт: new Set(d.blocks.контракт.map((b) => headKey(b.header))),
    сущности: new Set(d.blocks.сущности.map((b) => headKey(b.header))),
    задачи: new Set(d.blocks.задачи.map((b) => headKey(b.header))),
    топики: new Set(d.blocks.топики.map((b) => headKey(b.header))),
    экраны: new Set(d.tables.экраны.map((c) => norm(c[0])).filter((k) => k && k !== '—')),
  };
  const out = {};
  for (const [c, set] of Object.entries(sets)) out[c] = [...set].filter((k) => !(c === 'контракт' && nopK(k) !== k && set.has(nopK(k)))).length;
  return out;
}

// папка частей: ключи карточки каждой части; авторы блоков и ключей описи (часть NN, голова)
function readParts(dir) {
  const parts = new Map(); const card = new Map(); const opis = new Map(); const pbody = [];
  const add = (m, k, a) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(a); };
  for (const name of fs.readdirSync(dir).sort()) {
    const m = name.match(/^(?:part-(\d+)|(head))\.md$/);
    if (!m) continue;
    const a = m[1] ?? 'голова';
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const d = parseCard(text);
    for (const c of ['контракт', 'сущности', 'задачи', 'топики']) for (const b of d.blocks[c]) add(card, headKey(b.header), a);
    for (const b of d.blocks.бизнес) add(card, bizKey(b.header).key, a);
    for (const c of d.tables.экраны) add(card, norm(c[0]), a);
    for (const c of d.tables.роли) add(card, roleKey(c), a);
    if (m[1]) parts.set(a, keyCounts(text));
    if (m[1]) for (const b of d.blocks.контракт) pbody.push({ a, key: headKey(b.header), body: b.body });
    const op = path.join(dir, name.replace(/\.md$/, '.opis.md'));
    if (fs.existsSync(op)) for (const k of parseOpis(fs.readFileSync(op, 'utf8')).keys.keys()) add(opis, k, a);
  }
  const notes = fs.readdirSync(dir).filter((n) => /^(part-.*|head)\.opis\.md$/.test(n)).map((n) => fs.readFileSync(path.join(dir, n), 'utf8'));
  return { parts, card, opis, notes, pbody };
}

// Пустота по частям: у части больше половины блоков контракта без фактов — её ключи, пустые и в
// склеенной карточке, идут ей в добор.
function partEmptyItems(pbody, draftText) {
  const draftBody = new Map();
  for (const b of parseCard(draftText).blocks.контракт) { const k = headKey(b.header); draftBody.set(k, (draftBody.get(k) ?? false) || b.body); }
  const byPart = new Map();
  for (const r of pbody) { if (!byPart.has(r.a)) byPart.set(r.a, []); byPart.get(r.a).push(r); }
  const keys = new Set();
  for (const rows of byPart.values()) {
    if (2 * rows.filter((r) => r.body).length >= rows.length) continue;
    for (const r of rows) if (!r.body && draftBody.get(r.key) === false) keys.add(r.key);
  }
  return [...keys].sort().map((k) => [k]);
}

// Блок контракта у ключа с пометкой «объявлено без реализации» — пункт добора автору блока.
// Сравнение без хвоста-вызова у не-HTTP ключей и без имён параметров пути.
function declItems(opisTexts, contractKeys) {
  const NOTE = '> объявлено без реализации: ';
  const same = (k) => nopK(k).replace(/\{[^}]*\}/g, '{}');
  const declared = new Set(opisTexts.flatMap(splitLines).filter((l) => l.startsWith(NOTE)).map((l) => {
    const s = l.slice(NOTE.length); const i = s.indexOf(SEP);
    return same(norm(i < 0 ? s : s.slice(0, i)));
  }));
  return [...new Set(contractKeys.filter((k) => declared.has(same(k))))].sort().map((k) => [k]);
}

// Пометка не становится ключом описи. Владение — по файлу, затем по ближайшей папке плана;
// неоднозначный относительный хвост и отсутствие владельца дают «без хозяина».
function missedItems(planText, opisTexts) {
  const clean = (p) => {
    let s = path.posix.normalize(p.replace(/`/g, '').trim().replace(/\\/g, '/')).replace(/\/$/, '');
    if (process.platform === 'win32') s = s.replace(/^\/([a-zA-Z])\//, (_, d) => d.toUpperCase() + ':/');
    return s.replace(/^([a-zA-Z]):/, (_, d) => d.toUpperCase() + ':');
  };
  const absolute = (p) => /^(\/|[A-Za-z]:)/.test(p);
  const match = (source, owned) => source === owned || (!absolute(source) && owned.endsWith('/' + source));
  const entries = String(planText).split(/\r?\n/).map((l) => l.split('\t')).flatMap((r) => {
    if (r[0] === 'файл' && r[4] && r[4] !== '-') return [{ p: clean(r[1]), folder: false, a: r[4] }];
    if (r[0] === 'путь') return [{ p: clean(r[1]), folder: r[2] === 'папки', a: r[3] }];
    return [];
  });
  const notes = new Set(opisTexts.flatMap(splitLines).filter((l) => l.startsWith('> пропущено частью: ')).map((l) => l.slice('> пропущено частью: '.length)));
  return [...notes].map((note) => {
    const at = note.indexOf(SEP);
    if (at < 0) return [note, 'без хозяина'];
    const source = clean(note.slice(at + SEP.length));
    const candidates = [];
    for (const e of entries) {
      if (!e.folder) { if (match(source, e.p)) candidates.push({ a: e.a, score: source.length + 1 }); continue; }
      for (let q = path.posix.dirname(source); q !== '.' && q !== '/'; q = path.posix.dirname(q)) {
        if (match(q, e.p)) { candidates.push({ a: e.a, score: q.length }); break; }
      }
    }
    const best = Math.max(-1, ...candidates.map((c) => c.score));
    const owners = new Set(candidates.filter((c) => c.score === best).map((c) => c.a));
    return [note, owners.size === 1 ? [...owners][0] : 'без хозяина'];
  });
}

function markers(planText, parts, cardKeys, opisText) {
  const rows = String(planText).split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  if (!rows.length) return { 'гейт': 'плана нет', 'классы': {}, _gate: '', _owners: [] };
  const want = new Map(); const pwant = new Map();
  const files = new Map(); // путь → {n, own}
  for (const r of rows) {
    if (r[0] === 'итог') want.set(r[1], (want.get(r[1]) ?? 0) + Number(r[2]));
    if (r[0] === 'часть') pwant.set(`${r[1]}\t${r[2]}`, (pwant.get(`${r[1]}\t${r[2]}`) ?? 0) + Number(r[3]));
    if (r[0] === 'файл') { const f = files.get(r[1]) ?? { n: 0, own: r[4] }; f.n += Number(r[3]); files.set(r[1], f); }
  }
  const cls = {}; const bad = [];
  const verdict = (label, gw, g, e) => {
    if (2 * g < e) { cls[label] = `${g}/${e} не пройден`; bad.push(`${gw}${g} из ${e}`); }
    else cls[label] = `${g}/${e} пройден${g > 2 * e ? ', вдвое' : ''}`;
  };
  for (const [c, e] of want) { if (!(c in cardKeys)) { cls[c] = 'нет класса'; continue; } verdict(c, c + ' ', cardKeys[c], e); }
  if (parts) for (const [key, e] of pwant) {
    const [nn, c] = key.split('\t');
    const label = `части ${nn}, ${c}`;
    if (!parts.has(nn) || !(c in parts.get(nn))) { cls[label] = 'нет класса'; continue; }
    verdict(label, `часть ${nn}, ${c} `, parts.get(nn)[c], e);
  }
  const gate = want.size === 0 && !(parts && pwant.size) ? 'пометок-ключей в плане нет — гейта нет' : (bad.length ? `НЕ ПРОЙДЕН — ${bad.join('; ')}` : 'пройден');
  const tok = opisSources(opisText);
  const deficit = []; const owners = [];
  for (const [f, { n, own }] of files) {
    let m = 0;
    for (const [t, k] of tok) if (f === t || f.endsWith('/' + t)) m += k;
    if (m < n) { deficit.push(`${f.split('/').pop()}(${own}) ${n}/${m}`); owners.push(own); }
  }
  return { 'гейт': gate, 'классы': cls, 'файлов': `${files.size}/${deficit.length}`, 'дефицит': deficit, _gate: gate, _owners: owners };
}

export function analyzeFiles(opisPath, draftPath, prevPath, envPath) {
  const rd = (p) => fs.readFileSync(p, 'utf8');
  const res = analyze(rd(opisPath), rd(draftPath), prevPath ? rd(prevPath) : null);
  const mp = findManifest(draftPath);
  res['кандидаты'] = candidates(rd(draftPath), mp ? manifestNames(rd(mp)) : null);
  const env = readEnv(envPath);
  const rel = (v) => path.join(path.dirname(envPath), v);
  const P = env.CHECK_PARTS ? readParts(rel(env.CHECK_PARTS)) : null;
  let noPfx = [];
  if (env.CHECK_PREFIX) {
    const p = '/' + env.CHECK_PREFIX.replace(/\/$/, '').replace(/^\//, '');
    const keys = new Set(parseCard(rd(draftPath)).blocks.контракт.map((b) => headKey(b.header)));
    noPfx = [...keys].filter((k) => { const m = k.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\S+)/); return m && m[2] !== p && !m[2].startsWith(p + '/'); });
    res['черновик']['без префикса'] = noPfx.length;
  }
  let mk = null;
  if (env.CHECK_PLAN) {
    const planPath = rel(env.CHECK_PLAN);
    mk = markers(fs.existsSync(planPath) ? rd(planPath) : '', P ? P.parts : null, res['черновик']['ключи'], rd(opisPath));
    res['маркеры'] = { 'гейт': mk['гейт'], 'классы': mk['классы'], ...('файлов' in mk ? { 'файлов': mk['файлов'], 'дефицит': mk['дефицит'] } : {}) };
  }
  // исход: маркеры, доставка тела контракта, гард — и перечень добора по авторам
  const mg = mk && mk._gate ? mk._gate : 'плана нет — сверки маркеров нет';
  const [nb, bb] = res['черновик']['контракт'];
  const bodyFail = nb > 0 && 2 * bb < nb;
  const fail = [];
  if (mg.startsWith('НЕ ПРОЙДЕН')) fail.push('маркеры: ' + mg.replace(/^НЕ ПРОЙДЕН — /, ''));
  if (bodyFail) fail.push(`тело у ${bb} из ${nb} блоков контракта`);
  const route = res['маршрут'];
  const it = res._items;
  const ownerPlan = env.CHECK_PLAN && fs.existsSync(rel(env.CHECK_PLAN)) ? rd(rel(env.CHECK_PLAN)) : '';
  const contractKeys = parseCard(rd(draftPath)).blocks.контракт.map((b) => headKey(b.header));
  const lists = { ...it, NOPFX: noPfx.map((k) => [k]), MARKFILE: (mk?._owners ?? []).map((o) => [o]), MISSED: missedItems(ownerPlan, [rd(opisPath), ...(P?.notes ?? [])]), DECL: declItems([rd(opisPath), ...(P?.notes ?? [])], contractKeys), PARTEMPTY: P ? partEmptyItems(P.pbody, rd(draftPath)) : [] };
  const dobor = {};
  const look = (m, k) => m.get(k) ?? m.get(nopK(k)) ?? null;
  for (const [cat, list] of Object.entries(lists)) for (const item of list) {
    let A;
    if (cat === 'MISSED') A = new Set([item[1]]);
    else if (!P) A = new Set(['читающий']);
    else if (cat === 'MARKFILE') A = new Set([item[0]]);
    else if (cat === 'DUP') A = new Set([...(look(P.card, item[0]) ?? []), ...(look(P.card, item[1]) ?? [])]);
    else if (['ADD', 'NOSRC', 'EMPTY'].includes(cat)) A = look(P.opis, item[0]) ?? look(P.card, item[0]);
    else A = look(P.card, item[0]) ?? look(P.opis, item[0]);
    if (!A || !A.size) A = new Set(['без хозяина']);
    for (const a of A) { const l = /^\d+$/.test(a) ? `часть ${a}` : a; dobor[l] = (dobor[l] ?? 0) + 1; }
  }
  res['исход'] = {
    'маркеры': mg,
    'тело': nb === 0 ? 'блоков контракта нет — сверки нет' : (bodyFail ? `НЕ ПРОЙДЕН — тело у ${bb} из ${nb} блоков контракта, меньше половины` : `пройден — тело у ${bb} из ${nb} блоков контракта`),
    'гард': route ?? 'прежней карточки нет',
    'исход': fail.length ? `гейт не пройден — ${fail.join('; ')}` : route === 'В _pending' ? 'в _pending — гард' : route ? 'записать поверх' : 'записать',
    'добор': dobor,
  };
  res['пропуски'] = {};
  for (const [note, owner] of lists.MISSED) (res['пропуски'][owner] ??= []).push(note);
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [, , a, b, c] = process.argv;
  if (!a || !b) {
    console.error('usage: node oracle.mjs <опись> <черновик> [<прежняя>]');
    process.exit(2);
  }
  console.log(JSON.stringify(analyzeFiles(a, b, c), null, 1));
}
