// Грейдер ts-cr-* (fixtures/TS-CR/README.md): спека в режиме мелкой правки.
//   node grade-cr-spec.mjs <плечо> --case=timeout|api
//   node grade-cr-spec.mjs --selftest
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const KEY = { timeout: 'UA-410', api: 'UA-420' };
const section = (spec, n) => (spec.split(new RegExp(`^## (~~)?${n}\\.`, 'm'))[2] ?? '').split(/^## /m)[0];
const sub = (spec, n) => (spec.split(new RegExp(`^### (~~)?${n.replace('.', '\\.')}\\.`, 'm'))[2] ?? '').split(/^###? /m)[0];

function grade(spec, kase) {
  const m = {};
  m['спека записана'] = spec.length > 0;
  m['тип «мелкая правка»'] = /мелкая правка/i.test(spec);
  const s2 = section(spec, 2);
  if (kase === 'timeout') {
    // «новых и изменённых …» — та же формула другими словами (база 2026-10-24, run-08).
    m['§2 неприменима (контракт не тронут)'] = !/^###\s+(~~)?INT-\d/m.test(s2) && /новых\s*(\/|и|или)\s*изменённых\s+взаимодействий\s+нет/.test(s2);
    m['§5.1 по существу: 10 с'] = /10\s*(с|сек)/.test(sub(spec, '5.1')) && !/^~~Не применимо/m.test(sub(spec, '5.1').trim());
  } else {
    m['§2 — карточка INT'] = /^###\s+INT-\d/m.test(s2);
    m['в карточке пример JSON'] = /```json/.test(s2);
    m['семантика null у черновика'] = /null/.test(s2);
  }
  const s62 = sub(spec, '6.2');
  m['§6.2 по существу'] = s62.trim().length > 0 && !/^~~Не применимо/m.test(s62.trim());
  m['статус проставлен'] = /Статус готовности:\*\*\s*(Готово к разработке|Требуются уточнения \(\d+\))/.test(spec) && !/ПРОСТАВЛЯЕТСЯ/.test(spec);
  return m;
}

function selftest() {
  const base = ['> **Статус готовности:** Готово к разработке', '**Тип:** мелкая правка'];
  const t = [...base, '## ~~2. Взаимодействия (ядро)~~', '~~Не применимо: новых/изменённых взаимодействий нет; задето: таймаут~~',
    '## 5. Нефункциональные требования', '### 5.1. Синхронность, кэш, производительность', 'Таймаут отправки 10 с.', '### 5.2. Надёжность',
    '## 6. Релиз', '### 6.2. Обратная совместимость', 'Отправка и ошибки прежние.', '### 6.3. Фиче-флаги', '## 7.'].join('\n');
  const a = [...base, '## 2. Взаимодействия (ядро)', '### INT-1. Список заявок — 🟢', '```json', '{ "approverName": null }', '```',
    '## 3. Backend', '## 6. Релиз', '### 6.2. Обратная совместимость', 'Старый фронт поле не показывает.', '### 6.3.', '## 7.'].join('\n');
  let fails = 0;
  for (const [k, v] of Object.entries(grade(t, 'timeout'))) if (!v) { fails++; console.log('  ✗ timeout провалил: ' + k); }
  for (const [k, v] of Object.entries(grade(a, 'api'))) if (!v) { fails++; console.log('  ✗ api провалил: ' + k); }
  const badA = a.replace('### INT-1. Список заявок — 🟢', '~~Не применимо: новых/изменённых взаимодействий нет~~').replace('```json', '').replace('{ "approverName": null }', '');
  if (grade(badA, 'api')['§2 — карточка INT'] !== false) { fails++; console.log('  ✗ api без карточки не пойман'); }
  console.log(fails ? `самотест: провалов ${fails}` : 'самотест: ✓');
  return fails;
}

const arg = process.argv[2];
if (arg === '--selftest') process.exit(selftest() ? 1 : 0);
if (selftest()) process.exit(1);
const kase = (process.argv.find((x) => x.startsWith('--case=')) ?? '--case=api').slice(7);
const runs = readdirSync(arg).filter((d) => /^run-\d+$/.test(d)).sort();
const tot = {};
let green = 0;
for (const r of runs) {
  const f = join(arg, r, 'coddoc', KEY[kase], 'technical_specification.md');
  const m = grade(existsSync(f) ? readFileSync(f, 'utf8').replace(/\r/g, '') : '', kase);
  const bad = Object.entries(m).filter(([, v]) => !v).map(([k]) => k);
  if (!bad.length) green++;
  for (const k of bad) tot[k] = (tot[k] ?? 0) + 1;
  console.log(`${r}: ${bad.length ? '✗ ' + bad.join(', ') : '✓'}`);
}
for (const [k, n] of Object.entries(tot)) console.log(`  ${n}/${runs.length}\t${k}`);
console.log(`  ${green}/${runs.length}\tзелёных`);
