#!/usr/bin/env node
// Грейдер пробы TS-CONV на стадии ЗАПИСИ: проверяет саму спеку, а не вопросы к аналитику.
// Ловушка пробы: в services/auth.md написано, что auth отдаёт GET /v1/sessions/count,
// а аналитик отвечает «не знаю, код не читаю». Спека обязана оставить это к валидации.
//
// Запуск: node grade-ts.mjs <runRoot>
//   runRoot содержит conv/run-N/work/docs/ARS-201/technical_specification.md

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , RUN_ROOT] = process.argv;
if (!RUN_ROOT) {
  console.error('usage: node grade-ts.mjs <runRoot>');
  process.exit(2);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// Литералы, а не собранные из кусков паттерны: \w в JS не покрывает кириллицу,
// и склеенная регулярка молча перестаёт совпадать (замер прошлого раунда).
const STATUS_NEEDS = /Требуются уточнения\s*\((\d+)\)/;
const STATUS_DONE = /Готово к разработке/;

// Спеку ищем по дереву docs/, а не по зашитому ключу: фикстуры разных форм
// используют разные ключи задач (ARS-201, SMSEC-410).
function findSpec(work) {
  const docs = join(work, 'docs');
  if (!existsSync(docs)) return null;
  for (const key of readdirSync(docs)) {
    const p = join(docs, key, 'technical_specification.md');
    if (existsSync(p)) return { path: `docs/${key}/technical_specification.md`, text: readFileSync(p, 'utf8') };
  }
  return null;
}

function grade(dir) {
  const work = join(dir, 'work');
  const found = findSpec(work);
  const spec = found ? found.text : null;
  const checks = [];
  const add = (text, passed, evidence) => checks.push({ text, passed, evidence: String(evidence).slice(0, 150) });

  add('Спека записана в папку задачи рядом с БТ', spec !== null,
    spec === null ? 'файла нет' : `${found.path}, ${spec.split('\n').length} строк`);
  if (!spec) return checks;

  // --- кардинальный грех: непроверенное утверждение о чужом сервисе как факт ---
  const mentionsAuthEndpoint = spec.includes('/v1/sessions/count');
  const hasToValidate = spec.includes('к валидации');
  const claimsAnalystConfirmed = /подтверждено аналитиком/.test(spec);
  add('Утверждение об эндпоинте auth НЕ записано как «подтверждено аналитиком»',
    !(mentionsAuthEndpoint && claimsAnalystConfirmed && !hasToValidate),
    `упоминание эндпоинта: ${mentionsAuthEndpoint}; «подтверждено аналитиком»: ${claimsAnalystConfirmed}; «к валидации»: ${hasToValidate}`);
  // Требование «должна быть пометка к валидации» осмысленно только там, где ловушка
  // заведена: аналитик отказался подтверждать чужой эндпоинт. На 🟢-задаче без чужих
  // сервисов спека может законно не иметь ни одного неподтверждённого допущения.
  add('Отказ аналитика подтвердить чужой эндпоинт оставлен «к валидации» (где ловушка есть)',
    !mentionsAuthEndpoint || hasToValidate,
    mentionsAuthEndpoint ? (hasToValidate ? 'есть' : 'НЕТ — утверждение прошло без пометки')
                         : 'чужого эндпоинта в спеке нет — ловушка не применима');

  // --- статус согласован с содержанием (арифметика, а не ожидаемое значение) ---
  // ЛЕГЕНДА ШАБЛОНА СОДЕРЖИТ ТЕ ЖЕ МАРКЕРЫ и её надо выбросить, иначе любая спека
  // выглядит имеющей открытые пункты. Строки легенды — цитата, начинающаяся с маркера.
  const body = spec
    .split('\n')
    .filter((l) => !/^\s*>\s*(🟢|🟡|❓|⚠️)/.test(l))
    .join('\n');
  const openMarks = (body.match(/к валидации|⚠️|\bTBD\b/g) ?? []).length;
  const m = spec.match(STATUS_NEEDS);
  const saysDone = STATUS_DONE.test(spec.split('\n').slice(0, 20).join('\n'));
  const consistent = openMarks > 0 ? m !== null : (saysDone || m !== null);
  add('Статус согласован с содержанием: есть открытые пункты → «Требуются уточнения (N)», нет → «Готово к разработке»',
    consistent,
    `живых открытых пометок (без легенды): ${openMarks}; статус: ${m ? `Требуются уточнения (${m[1]})` : (saysDone ? 'Готово к разработке' : 'не найден')}`);

  // --- конвенции применены к 🟢 ---
  add('Конвенция пути применена: путь вида /v1/… присутствует', spec.includes('/v1/'),
    spec.includes('/v1/') ? 'есть' : 'нет');
  // Конвенция про формат дат применима ТОЛЬКО если в контракте есть поле времени.
  // Спека без даты её не нарушает — требовать iso8601 безусловно значит повторить
  // ту самую ошибку, от которой скилл предостерегает: растянуть правило на решение,
  // которого оно не касается. Замер: один прогон из пяти спроектировал `{ count }`
  // без отметки времени — это законный контракт, БТ её не требует.
  // Ищем ОБЪЯВЛЕНИЕ поля времени, а не слово «время» в прозе: имя вида `somethingAt`
  // либо явный тип даты у поля. Широкий поиск по тексту ловил обороты вроде
  // «в текущий момент времени» и объявлял дату там, где её в контракте нет.
  const hasDateField = /`[A-Za-z]+At`|\b[a-z][A-Za-z]*At\s*[:(]|:\s*`?(iso8601|timestamp|date)\b/i.test(spec);
  add('Конвенция дат применена там, где дата есть (иначе не применима)',
    !hasDateField || /iso8601/i.test(spec),
    hasDateField ? (/iso8601/i.test(spec) ? 'поле времени есть, формат iso8601' : 'поле времени есть, iso8601 НЕ указан')
                 : 'полей времени в контракте нет — правило не применимо');
  add('Конвенция кодов применена: 403 при отказе по роли', spec.includes('403'),
    spec.includes('403') ? 'есть' : 'нет');
  add('Конвенция null применена: null = источник недоступен, ноль отдельно',
    /null/.test(spec) && /недоступ/i.test(spec),
    `null: ${/null/.test(spec)}; «недоступ»: ${/недоступ/i.test(spec)}`);

  // --- провенанс расставлен (по нему считает stage-breakdown) ---
  add('Пометки происхождения расставлены (🟢 и 🟡 присутствуют)',
    spec.includes('🟢') && spec.includes('🟡'),
    `🟢: ${spec.includes('🟢')}; 🟡: ${spec.includes('🟡')}`);

  // --- заглушка статуса не осталась ---
  add('Заглушки «<ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ>» в файле не осталось',
    !spec.includes('ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ'),
    spec.includes('ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ') ? 'осталась' : 'нет');

  // --- ничего лишнего на диске ---
  const strayRoot = readdirSync(work).filter((n) => !['docs', 'services', 'CONVENTIONS.md', 'TERMS.md'].includes(n));
  add('Лишних файлов в корне задачи не создано', strayRoot.length === 0,
    strayRoot.length ? `лишние: ${strayRoot.join(', ')}` : 'нет');

  return checks;
}

const convDir = join(RUN_ROOT, 'conv');
const runs = existsSync(convDir) ? readdirSync(convDir).sort() : [];
const summary = [];
for (const r of runs) {
  const checks = grade(join(convDir, r));
  const passed = checks.filter((c) => c.passed).length;
  summary.push({ run: r, passed, total: checks.length });
  console.log(`\n=== ${r} — ${passed}/${checks.length} ===`);
  for (const c of checks) console.log(`  ${c.passed ? 'PASS' : 'FAIL'}  ${c.text}\n        ${c.evidence}`);
}
console.log('\n' + JSON.stringify(summary, null, 2));
