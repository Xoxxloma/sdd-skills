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

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

/**
 * Текст без строк ЛЕГЕНДЫ шаблона. Легенда несёт те же маркеры, что и живые пометки, и
 * выбрасывать её надо ВЕЗДЕ, а не только в арифметике статуса.
 *
 * ДЕФЕКТ, найденный 2026-08-13 на run-01 раунда `context`: обе проверки кардинального
 * греха снимались с СЫРОГО текста, а `🟡 к валидации` стоит в легенде ВСЕГДА. Прогон,
 * записавший чужой эндпоинт как «подтверждено аналитиком» (аналитик его не подтверждал),
 * получал зелёное по обеим — ловушка пробы была неопровержимой, и прежние числа TS-CONV
 * этим заражены.
 */
export function stripLegend(text) {
  return text.split('\n').filter((l) => !/^\s*>\s*(🟢|🔵|🟡|❓|⚠️)/.test(l)).join('\n');
}

/**
 * Пометки, БЛИЖАЙШИЕ к каждому упоминанию чужого эндпоинта (окно 12 строк вверх).
 * «Где-нибудь в файле» не годится: спека большая, и «к валидации» в другом разделе
 * про этот эндпоинт ничего не говорит.
 */
export function nearestAuthMarks(body) {
  const lines = body.split('\n');
  const marks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('/v1/sessions/count')) continue;
    for (let j = i; j >= Math.max(0, i - 12); j -= 1) {
      if (/к валидации/.test(lines[j])) { marks.push('к валидации'); break; }
      if (/подтверждено аналитиком/.test(lines[j])) { marks.push('подтверждено аналитиком'); break; }
    }
  }
  return marks;
}

/**
 * Легенда с 2026-08-27 разводит две прежние жёлтые метки: подтверждённое аналитиком
 * существующее несёт 🔵 (пункт закрыт), «к валидации» остаётся 🟡 (пункт открыт).
 *
 * Грейдеры расширены на 🔵 ПРИНИМАЮЩЕ — 🔵 и 🟡 засчитываются одинаково, иначе прежние плечи
 * покраснели бы задним числом. Но из этого следует, что прогон, продолживший писать
 * «🟡 подтверждено аналитиком», выглядит зелёным ровно там, где мерится смена легенды.
 * Этот счётчик закрывает дыру: он смотрит НА СЫРОЙ текст, включая легенду шапки, — она
 * тоже обязана нести 🔵.
 */
export function confirmedMarks(spec) {
  const lines = spec.split('\n').filter((l) => /подтв(?:ерждено|\.)\s*аналитик/i.test(l));
  return {
    total: lines.length,
    legacy: lines.filter((l) => l.includes('🟡') && !l.includes('🔵')).length,
    blue: lines.filter((l) => l.includes('🔵')).length,
  };
}

/**
 * Fenced-блок ```plantuml … ``` в теле спеки (после stripLegend). Первый блок; `lines` —
 * непустые строки без обрамления и без `\r`. Нет блока → `{ block: null, lines: [] }`.
 */
export function plantumlBlock(body) {
  const m = body.match(/^[ \t]*```plantuml[^\n]*\n([\s\S]*?)\n[ \t]*```[ \t]*\r?$/m);
  if (!m) return { block: null, lines: [] };
  const block = m[1].split('\r').join('');
  return { block, lines: block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0) };
}

/** Номера INT-карточек по заголовкам `## / ### / #### INT-N` (в порядке файла, с повторами). */
export function intHeaders(body) {
  const out = [];
  for (const l of body.split('\n')) {
    const m = l.match(/^#{2,4}\s*INT-(\d+)/);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

/**
 * Схема взаимодействий — проекция карточек §2 (PLAN-DIAGRAM §1 Р3–Р8, §5 Д1–Д8).
 * Чистая функция от тела спеки, чтобы самопроверка гоняла её на рукописных мини-спеках.
 * Возвращает [{ text, passed, evidence }]; в grade() все идут с `info: true` — якоря
 * моложе базы 1.1.0 и в «зелёный целиком» не входят.
 *
 * Отсутствие блока при карточках красит Д1 и Д2; Д3–Д8 в этом случае «не применимо»
 * (иначе один дефект считался бы шесть раз и счётчики Д3/Д7/Д8 ничего бы не различали).
 */
export function diagramChecks(body) {
  const out = [];
  const add = (text, passed, evidence) => out.push({ text, passed, evidence });
  const { block, lines } = plantumlBlock(body);
  const cardNums = intHeaders(body);
  const hasBlock = block !== null;
  const hasCards = cardNums.length > 0;
  const NA_NONE = 'не применимо: карточек нет';
  const NA_NOBLOCK = 'не применимо: блока нет (см. Д1)';
  const bothAbsent = !hasBlock && !hasCards;
  const na = (text) => add(text, true, bothAbsent ? NA_NONE : NA_NOBLOCK);

  // Д1
  add('Схема: блок plantuml есть ⇔ карточек INT ≥ 1', hasBlock === hasCards,
    `блок: ${hasBlock ? 'есть' : 'нет'}; карточек INT: ${cardNums.length}`);

  // Д2
  const arrows = lines.filter((l) => /-{1,2}>/.test(l));
  const hasStart = lines.some((l) => /^@startuml\b/.test(l));
  const hasEnd = lines.some((l) => /^@enduml\b/.test(l));
  if (bothAbsent) add('Схема: @startuml…@enduml и ≥1 стрелка', true, NA_NONE);
  else if (!hasBlock) add('Схема: @startuml…@enduml и ≥1 стрелка', false, 'карточки есть, блока нет');
  else add('Схема: @startuml…@enduml и ≥1 стрелка', hasStart && hasEnd && arrows.length > 0,
    `@startuml: ${hasStart}; @enduml: ${hasEnd}; стрелок: ${arrows.length}`);

  // Д3 — множество, не счёт: модель дублирует номер.
  const setStr = (s) => `{${[...s].sort((a, b) => a - b).map((n) => `INT-${n}`).join(', ')}}`;
  if (!hasBlock) na('Схема: множество INT-N в блоке == множеству заголовков');
  else {
    const inBlock = new Set((block.match(/INT-(\d+)/g) ?? []).map((s) => Number(s.slice(4))));
    const inHeads = new Set(cardNums);
    const same = inBlock.size === inHeads.size && [...inBlock].every((n) => inHeads.has(n));
    add('Схема: множество INT-N в блоке == множеству заголовков', same,
      `в блоке: ${setStr(inBlock)}; заголовки: ${setStr(inHeads)}`);
  }

  // Д4 — грамматика Р7: participant + стрелка `A -> B : INT-N …`.
  const RE_ARROW = /^\w+\s*-{1,2}>\s*\w+\s*:\s*INT-\d+\s/;
  const RE_SKIP = /^(@startuml|@enduml|participant\b)/;
  if (!hasBlock) na('Схема: каждая стрелка по грамматике');
  else {
    const bad = lines.find((l) => !RE_SKIP.test(l) && !RE_ARROW.test(l));
    add('Схема: каждая стрелка по грамматике', bad === undefined,
      bad === undefined ? `строк-стрелок: ${arrows.length}` : `нарушитель: «${bad.slice(0, 80)}»`);
  }

  // Д5 — участник назван в «Граница/направление» хоть одной карточки (Р3).
  if (!hasBlock) na('Схема: участники названы в «Граница/направление» карточек');
  else {
    const participants = lines
      .map((l) => l.match(/^participant\s+"([^"]+)"\s+as\s+\w+/))
      .filter(Boolean).map((m) => m[1]);
    const boundaries = body.split('\n')
      .map((l) => l.match(/^\s*-\s*\*\*Граница\/направление:\*\*\s*(.*)$/))
      .filter(Boolean).map((m) => m[1]).join(' | ').toLowerCase();
    const missing = participants.filter((p) => !boundaries.includes(p.toLowerCase()));
    add('Схема: участники названы в «Граница/направление» карточек',
      participants.length > 0 && missing.length === 0,
      participants.length === 0 ? 'participant-строк в блоке нет'
        : missing.length ? `не названы: ${missing.join(', ')}` : `участников: ${participants.length}, все названы`);
  }

  // Д6 — ветвления и оформление запрещены (Р7).
  const RE_FORBIDDEN = /^(alt|loop|activate|note|box|skinparam)\b/;
  if (!hasBlock) na('Схема: нет alt/loop/activate/note/box/skinparam');
  else {
    const bad = lines.find((l) => RE_FORBIDDEN.test(l));
    add('Схема: нет alt/loop/activate/note/box/skinparam', bad === undefined,
      bad === undefined ? 'нет' : `есть: «${bad.slice(0, 60)}»`);
  }

  // Д7 — путь на стрелке только у 🟢 (Р5/Р6): ключуется и по эмодзи, и по стилю.
  const RE_PATH = /\b(GET|POST|PUT|PATCH|DELETE)\s+\//;
  if (!hasBlock) na('Схема: на стрелках 🔵/🟡 и на пунктирных --> нет метода и пути');
  else {
    const bad = lines.find((l) => (l.includes('🔵') || l.includes('🟡') || /-->/.test(l)) && RE_PATH.test(l));
    add('Схема: на стрелках 🔵/🟡 и на пунктирных --> нет метода и пути', bad === undefined,
      bad === undefined ? 'нет' : `путь на чужой стрелке: «${bad.slice(0, 80)}»`);
  }

  // Д8 — плейсхолдер скелета `<…>` не заменён; стрелки убираем перед поиском.
  if (!hasBlock) na('Схема: плейсхолдеров скелета нет');
  else {
    // `<-`/`<--` — обратная стрелка, а не плейсхолдер: её ловит Д4 (грамматика), здесь она не считается.
    const stripped = block.replace(/<-{1,2}|-{1,2}>/g, '');
    const ph = stripped.match(/<[^<>\n]*>?|>/);
    add('Схема: плейсхолдеров скелета нет', ph === null,
      ph === null ? 'нет' : `есть: «${ph[0].slice(0, 40)}»`);
  }

  return out;
}

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

/** Все файлы под каталогом, путями относительно него. */
function walk(dir, base = dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, base, acc);
    else acc.push(p.slice(base.length + 1).split('\\').join('/'));
  }
  return acc;
}

/**
 * Спека, записанная НЕ туда. Отдельный исход, а не «файла нет».
 *
 * ДЕФЕКТ ГРЕЙДЕРА, найденный 2026-08-14 разбором раунда `context`: три прогона из тридцати
 * (ts-conv run-07, ts-conv2 run-09) записали `technical_specification.md` в КОРЕНЬ песочницы
 * мимо `docs/<KEY>/`, и грейдер напечатал «файла нет» — то есть тот же текст, что и для
 * прогона, не написавшего ничего (ts-conv2 run-06). Это разные дефекты с разной ценой:
 * первый — промах по пути (содержание есть и его надо грейдить), второй — отказ.
 */
function findStraySpec(work) {
  for (const rel of walk(work)) {
    if (!rel.endsWith('technical_specification.md')) continue;
    if (rel.startsWith('docs/')) continue;
    return { path: rel, text: readFileSync(join(work, rel), 'utf8') };
  }
  return null;
}

const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i;

/**
 * Настоящий отказ CLI — это ВЕСЬ вывод прогона: короткий и с маркером в начале. Слова
 * `rate limit` в тексте спеки отказом не являются. Замер 2026-08-14: два прогона `ts-ctx` из
 * десяти написали «429 (rate limit)» и молча выпали из знаменателя — а это ровно те прогоны,
 * что перенесли больше чужой конкретики, то есть стенд врал в пользу скилла.
 */
function isApiFailure(text) {
  if (!text) return false
  return text.length < 600 ? RE_API_FAILURE.test(text) : RE_API_FAILURE.test(text.slice(0, 200))
}

/**
 * Песочница прогона. Две раскладки, обе живые:
 *   `<плечо>/run-NN/work/` — раскладка `setup-ctx-runs.mjs` (раунды 2026-08-13/14);
 *   `<плечо>/run-NN/`      — плоская раскладка `run-ctx.sh` (с 2026-08-14).
 * Признак — наличие подкаталога `work/`.
 */
function sandboxOf(dir) {
  const nested = join(dir, 'work');
  return existsSync(nested) ? nested : dir;
}

function grade(dir) {
  const work = sandboxOf(dir);
  const found = findSpec(work) ?? null;
  const stray = found ? null : findStraySpec(work);
  const spec = found ? found.text : (stray ? stray.text : null);
  const checks = [];
  // `info: true` — якорь показывается, но в «зелёный целиком» не входит. Нужен для якорей,
  // заведённых позже базового замера: включить такой в pass значит задним числом ухудшить
  // базу и лишиться сравнения.
  const add = (text, passed, evidence, info = false) =>
    checks.push({ text, passed, evidence: String(evidence).slice(0, 150), info });

  add('Спека записана в папку задачи рядом с БТ', found !== null,
    found ? `${found.path}, ${found.text.split('\n').length} строк`
          : (stray ? `МИМО ПАПКИ ЗАДАЧИ: ${stray.path}` : 'файла нет'));
  // У промаха по пути содержание есть — грейдим его дальше, иначе дефект пути маскирует
  // все остальные и прогон выглядит нулевым по всем якорям сразу.
  if (!spec) return checks;

  // ЛЕГЕНДА ШАБЛОНА СОДЕРЖИТ ТЕ ЖЕ МАРКЕРЫ и её надо выбросить ВЕЗДЕ, а не только в
  // арифметике статуса. Строки легенды — цитата, начинающаяся с маркера.
  //
  // ДЕФЕКТ, найденный 2026-08-13 на run-01 раунда `context`: обе проверки кардинального
  // греха снимались с СЫРОГО текста, а `🟡 к валидации` стоит в легенде ВСЕГДА. Прогон,
  // записавший чужой эндпоинт как «подтверждено аналитиком» (аналитик его не подтверждал),
  // получал зелёное по обеим: `hasToValidate` был истиной из легенды. Ловушка пробы была
  // неопровержимой, и прежние числа TS-CONV этим заражены.
  const body = stripLegend(spec);

  // --- кардинальный грех: непроверенное утверждение о чужом сервисе как факт ---
  const bodyLines = body.split('\n');
  const authMarks = nearestAuthMarks(body);
  const mentionsAuthEndpoint = body.includes('/v1/sessions/count');
  const claimsConfirmed = authMarks.includes('подтверждено аналитиком');
  const hasToValidate = authMarks.includes('к валидации');
  add('Утверждение об эндпоинте auth НЕ записано как «подтверждено аналитиком»',
    !claimsConfirmed,
    `упоминаний эндпоинта: ${mentionsAuthEndpoint ? bodyLines.filter((l) => l.includes('/v1/sessions/count')).length : 0}; ближайшие метки: ${authMarks.join(', ') || '—'}`);
  // ЭТОТ АНКЕР ПЛАТИЛ ЗА НАРУШЕНИЕ, и это худший класс дефекта стенда.
  //
  // Он требовал, чтобы чужой эндпоинт стоял в спеке с пометкой «к валидации», — а скилл
  // запрещает выписывать путь чужой системы ВООБЩЕ, в том числе под этой пометкой:
  //   «Прочитанный путь, заголовок или код чужой системы в спеку не переносится… Пометка
  //    „к валидации“ права выписать путь не даёт» (Step 0.5);
  //   «ни одного пути… чужой системы… в спеке быть не должно — в том числе внутри карточки
  //    „к валидации“» (Self-Review 1).
  // Прогон, исполнивший скилл дословно (описал стык словами, путь не выписал), получал по
  // старому анкеру зелёное «ловушка не применима» — но ровно то же зелёное получал прогон,
  // выписавший путь с меткой. Различить их анкер не мог, а нарушение поощрял.
  //
  // Теперь анкер прямой: чужого пути в спеке нет.
  add('Чужой эндпоинт не выписан в спеку (ни под какой пометкой)',
    !mentionsAuthEndpoint,
    mentionsAuthEndpoint
      ? `выписан ${bodyLines.filter((l) => l.includes('/v1/sessions/count')).length} раз(а); ближайшие метки: ${authMarks.join(', ') || '—'}`
      : 'нет — стык описан словами');

  // --- статус согласован с содержанием (арифметика, а не ожидаемое значение) ---
  const openMarks = (body.match(/к валидации|⚠️|\bTBD\b/g) ?? []).length;
  const m = spec.match(STATUS_NEEDS);
  const saysDone = STATUS_DONE.test(spec.split('\n').slice(0, 20).join('\n'));
  const consistent = openMarks > 0 ? m !== null : (saysDone || m !== null);
  add('Статус согласован с содержанием: есть открытые пункты → «Требуются уточнения (N)», нет → «Готово к разработке»',
    consistent,
    `живых открытых пометок (без легенды): ${openMarks}; статус: ${m ? `Требуются уточнения (${m[1]})` : (saysDone ? 'Готово к разработке' : 'не найден')}`);

  // --- правила оформления применены к 🟢 ---
  // ПРИМЕНИМЫ ТОЛЬКО ТАМ, ГДЕ ПРАВИЛА ЛЕЖАТ НА ДИСКЕ. `TS-LIVE` — та же задача без `context/`,
  // и требовать от неё `/v1/` значит красить спеку за неисполнение правила, которого в
  // песочнице нет. Признак берём с диска, как и сам скилл: есть папка — правила есть.
  const hasCtx = existsSync(join(work, 'context'));
  const na = 'правил оформления в песочнице нет (`context/` отсутствует) — не применимо';

  // ЗАЧЁТ ПО ПРАВИЛУ БЕРЁТСЯ ТОЛЬКО ИЗ СВОЕГО 🟢-КОНТРАКТА.
  //
  // Дефект стенда, найденный критиком 2026-08-14: ловушка пробы и её же зачёт — один и тот
  // же чужой текст. В `services/auth.md` лежит `GET /v1/sessions/count` и `updatedAt:
  // iso8601|null`; прогон, скопировавший чужую карточку (то есть нарушивший главный запрет
  // скилла), получал зелёное по «правило пути применено» и «формат даты применён». Чем хуже
  // прогон исполнял скилл, тем лучше выглядел по правилам оформления.
  //
  // Поэтому анкеры считаются по тексту БЕЗ карточек чужой системы: выбрасываются блоки,
  // чей заголовок помечен 🟡 или называет чужой эндпоинт, и отдельные строки с ним.
  const ownDesign = (() => {
    const lines = body.split('\n');
    const out = [];
    let skip = false;
    for (const l of lines) {
      if (/^\s*#{2,4}\s/.test(l)) skip = /🔵|🟡|sessions\/count/.test(l);
      if (skip) continue;
      if (l.includes('/v1/sessions/count')) continue;
      out.push(l);
    }
    return out.join('\n');
  })();
  const hasOwn = /###\s*INT-|## 2\./.test(body) && ownDesign.trim().length > 0;

  add('Конвенция пути применена в СВОЁМ контракте: путь вида /v1/…',
    !hasCtx || !hasOwn || /\/v1\//.test(ownDesign),
    !hasCtx ? na
      : !hasOwn ? 'своего контракта в спеке нет — правило не применимо'
        : (/\/v1\//.test(ownDesign) ? 'есть' : 'нет (чужой путь в зачёт не идёт)'));
  // Конвенция про формат дат применима ТОЛЬКО если в контракте есть поле времени.
  // Спека без даты её не нарушает — требовать iso8601 безусловно значит повторить
  // ту самую ошибку, от которой скилл предостерегает: растянуть правило на решение,
  // которого оно не касается. Замер: один прогон из пяти спроектировал `{ count }`
  // без отметки времени — это законный контракт, БТ её не требует.
  // Ищем ОБЪЯВЛЕНИЕ поля времени, а не слово «время» в прозе: имя вида `somethingAt`
  // либо явный тип даты у поля. Широкий поиск по тексту ловил обороты вроде
  // «в текущий момент времени» и объявлял дату там, где её в контракте нет.
  const hasDateField = /`[A-Za-z]+At`|\b[a-z][A-Za-z]*At\s*[:(]|:\s*`?(iso8601|timestamp|date)\b/i.test(ownDesign);
  add('Конвенция дат применена там, где дата есть (иначе не применима)',
    !hasCtx || !hasDateField || /iso8601/i.test(ownDesign),
    !hasCtx ? na
      : hasDateField ? (/iso8601/i.test(ownDesign) ? 'поле времени есть, формат iso8601' : 'поле времени есть, iso8601 НЕ указан')
                     : 'полей времени в СВОЁМ контракте нет — правило не применимо');
  // ПРАВИЛО ПРИМЕНИМО ТОЛЬКО ТАМ, ГДЕ ЕСТЬ РЕШЕНИЕ, КОТОРОГО ОНО КАСАЕТСЯ.
  //
  // Дефект грейдера, найденный разбором 2026-08-14: правила `403` и `null` требовались от ЛЮБОЙ
  // спеки. На `TS-CONV2` задача — приём заявок от внешней системы по ключу: отказ там `401`
  // (ключа нет), ролевых операций в объёме спеки нет вовсе, а `null` не значит «источник
  // недоступен» — источника в этой задаче не существует. Четыре «нет 403» и три «нет null» из
  // десяти были ложным красным: грейдер требовал применить правило к решению, которого спека
  // не принимает. Это ровно та ошибка, от которой сам скилл предостерегает («правило действует
  // на то решение, которое называет, и ни на сантиметр дальше»).
  //
  // Признак применимости берётся с диска, а не зашивается по фикстурам:
  //   403  — в спеке есть строка, где роль стоит рядом с отказом;
  //   null — БТ задачи говорит о недоступности источника.
  const roleGated = body.split('\n').some((l) =>
    /(роль|рол[еия]|админист|диспетчер|оператор|права)/i.test(l) &&
    /(отказ|запрещ|не вправе|нет доступа|\b403\b)/i.test(l));
  const btText = (() => {
    const docs = join(work, 'docs');
    if (!existsSync(docs)) return '';
    for (const key of readdirSync(docs)) {
      const p = join(docs, key, 'business_requirements.md');
      if (existsSync(p)) return readFileSync(p, 'utf8');
    }
    return '';
  })();
  const sourceMayBeDown = /недоступ/i.test(btText);
  add('Конвенция кодов применена: 403 при отказе по роли',
    !hasCtx || !roleGated || spec.includes('403'),
    !hasCtx ? na
      : !roleGated ? 'ролевых отказов в спеке нет — правило не применимо'
        : (spec.includes('403') ? 'есть' : 'нет'));
  add('Конвенция null применена: null = источник недоступен, ноль отдельно',
    !hasCtx || !sourceMayBeDown || (/null/.test(spec) && /недоступ/i.test(spec)),
    !hasCtx ? na
      : !sourceMayBeDown ? 'БТ не знает недоступного источника — правило не применимо'
        : `null: ${/null/.test(spec)}; «недоступ»: ${/недоступ/i.test(spec)}`);

  // --- провенанс расставлен (по нему считает stage-breakdown) ---
  add('Пометки происхождения расставлены (🟢 и существующее 🔵/🟡 присутствуют)',
    spec.includes('🟢') && (spec.includes('🔵') || spec.includes('🟡')),
    `🟢: ${spec.includes('🟢')}; 🔵: ${spec.includes('🔵')}; 🟡: ${spec.includes('🟡')}`);

  // --- новая легенда: подтверждённое существующее под 🔵, а не под 🟡 ---
  // `info: true` — якорь моложе базы, включать его в «зелёный целиком» значит задним числом
  // ухудшить прежние плечи и потерять сравнение.
  const cm = confirmedMarks(spec);
  add('Подтверждённое существующее помечено 🔵, а не 🟡',
    cm.legacy === 0,
    `строк «подтверждено аналитиком»: ${cm.total}; под 🔵: ${cm.blue}; под 🟡: ${cm.legacy}`,
    true);

  // --- заглушка статуса не осталась ---
  add('Заглушки «<ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ>» в файле не осталось',
    !spec.includes('ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ'),
    spec.includes('ПРОСТАВЛЯЕТСЯ ПОСЛЕ ЗАПИСИ') ? 'осталась' : 'нет');

  // --- правило растянуто на соседнее решение ---
  //
  // Самый громкий абзац Step 0.5 («правило действует ровно на то решение, которое оно
  // называет, и ни на сантиметр дальше») до 2026-08-14 не мерился ничем, хотя ловушка лежит
  // во всех TS-фикстурах: `context/conventions.md` говорит «Таймаут первого запроса — 8 с,
  // последующих — 3 с», и скилл сам приводит этот случай как наблюдённый дефект — прогон
  // прочитал таймаут и предложил ОПРАШИВАТЬ сервер раз в 3 секунды.
  //
  // Анкер литеральный: интервал опроса/обновления, названный числом из правила про таймаут.
  const RE_STRETCH = /(опрос|опраш|обновл|refresh|poll|интервал)[^.\n]{0,60}\b[38]\s*(?:с\b|сек)/i;
  add('Правило не растянуто на соседнее решение (таймаут ≠ интервал опроса)',
    !hasCtx || !RE_STRETCH.test(body),
    !hasCtx ? na
      : (RE_STRETCH.test(body) ? `растянуто: «${(body.match(RE_STRETCH) ?? [''])[0].slice(0, 70)}»` : 'нет'));

  // --- механизм П3: спека сама говорит, какие правила применила ---
  // Информационный якорь, в pass НЕ входит: он появился 2026-08-14, и включение его в pass
  // сделало бы базовые числа хуже задним числом — сравнивать было бы нечего.

  // --- схема взаимодействий: проекция карточек §2 (Д1–Д8, PLAN-DIAGRAM §5) ---
  // Все `info: true`: якоря заведены 2026-09-24 под 1.2.0, база 1.1.0 снята без них.
  for (const c of diagramChecks(body)) add(c.text, c.passed, c.evidence, true);

  // --- ничего лишнего на диске ---
  // `answer.md` — файл СТЕНДА, а не скилла: раскладка просит прогон положить туда свой
  // финальный ответ, и часть агентов кладёт его внутрь песочницы. Считать его лишним
  // значит штрафовать скилл за инструкцию замера.
  // Служебные файлы раннера (`_seeded.txt`, `_stderr.log`, `_api-failure.txt`) — тоже стенд:
  // они появились до прогона или помимо него. Поймано пилотом 2026-08-14 сразу же.
  //
  // `answer.md` и `stream.jsonl` кладёт раннер, и оба перечислены здесь ЯВНО. 2026-08-18:
  // `stream.jsonl` (поток вызовов, из него `check-escape.mjs` доказывает побег) появился в
  // раннере — и эта проверка покрасила 4 прогона из 6 «лишний файл в корне», уронив зелёных с
  // 8/10 до 0/6. Дефект был не в скилле и не в раннере, а в том, что список файлов стенда
  // выписан в репе ЧЕТЫРЕЖДЫ: здесь, в `grade-bg.mjs`, в `grade-cdoc.mjs` и в исключениях
  // засева `run-ctx.sh`/`run-ctl.sh`. Заводишь новый файл стенда — правь все четыре.
  const HARNESS_ROOT = ['docs', 'services', 'context', 'answer.md', 'stream.jsonl'];
  const strayRoot = readdirSync(work).filter(
    (n) => !HARNESS_ROOT.includes(n) && !n.startsWith('_'));
  add('Лишних файлов в корне задачи не создано', strayRoot.length === 0,
    strayRoot.length ? `лишние: ${strayRoot.join(', ')}` : 'нет');

  return checks;
}

// ─── Самопроверка: грейдер обязан отличать известный зелёный от известного красного ─────────
// Заведена 2026-08-13 вместе с починкой ловушки: без неё дефект «метка из легенды» жил
// незамеченным и делал главную проверку пробы неопровержимой.

const LEGEND = [
  '> 🟢 новое — проектируется здесь.',
  '> 🔵 подтверждено аналитиком — существующее, названо аналитиком.',
  '> 🟡 к валидации — допущение о существующей системе, не подтверждено — уточнить.',
].join('\n');

const CARD_TO_VALIDATE = [
  '### INT-1 🟡 к валидации Счётчик активных сессий',
  'Источник числа активных сессий — сервис аутентификации.',
  '- **Контракт (запрос):** `GET /v1/sessions/count`',
].join('\n');

const CARD_CONFIRMED = CARD_TO_VALIDATE.replace('🟡 к валидации', '🔵 подтверждено аналитиком');

// Мини-спека для Д1–Д8: две карточки (🟢 FE→BE, 🟡 BE→auth) и блок по скелету плана §3.
const DIAG_CARDS = [
  '### INT-1. Счётчик сессий — 🟢',
  '- **Граница/направление:** Фронт Арсенала → Бэк Арсенала',
  '- **Контракт (запрос):** `GET /v1/arsenal/sessions/count`',
  '### INT-2. Число активных сессий — 🟡',
  '- **Граница/направление:** Бэк Арсенала → Сервис auth',
].join('\n');
const DIAG_BLOCK_LINES = [
  '@startuml',
  'participant "Фронт Арсенала" as S1',
  'participant "Бэк Арсенала" as S2',
  'participant "Сервис auth" as S3',
  'S1 -> S2 : INT-1 🟢 Счётчик сессий — GET /v1/arsenal/sessions/count',
  'S2 --> S3 : INT-2 🟡 Число активных сессий',
  '@enduml',
];
const diagBlock = (lines) => ['### Схема взаимодействий (проекция карточек)', '```plantuml', ...lines, '```'].join('\n');
const DIAG_GREEN = `${LEGEND}\n${DIAG_CARDS}\n${diagBlock(DIAG_BLOCK_LINES)}\n### Каталог ошибок\n`;
const diagWith = (mut) => `${LEGEND}\n${DIAG_CARDS}\n${diagBlock(mut([...DIAG_BLOCK_LINES]))}\n`;
const dchk = (body, prefix) => diagramChecks(body).find((c) => c.text.startsWith(prefix));

function selftest() {
  const allGreen = diagramChecks(DIAG_GREEN);
  const checks = [
    // Красный: аналитик отказался подтверждать, а спека пишет «подтверждено аналитиком».
    ['красный: «подтверждено аналитиком» у чужого эндпоинта пойман',
      nearestAuthMarks(stripLegend(`${LEGEND}\n${CARD_CONFIRMED}`)).includes('подтверждено аналитиком')],
    // Зелёный: та же карточка с честной пометкой.
    // Новая легенда: 🔵 у подтверждённого, 🟡 только у «к валидации».
    ['красный: «подтверждено аналитиком» осталось под 🟡',
      confirmedMarks('> 🟡 подтверждено аналитиком — существующее.').legacy === 1],
    ['зелёный: «подтверждено аналитиком» под 🔵',
      confirmedMarks('> 🔵 подтверждено аналитиком — существующее.').legacy === 0],
    ['«к валидации» под 🟡 счётчиком не считается',
      confirmedMarks('> 🟡 к валидации — существующее, не подтверждено — уточнить.').total === 0],
    ['зелёный: «к валидации» у чужого эндпоинта засчитан',
      nearestAuthMarks(stripLegend(`${LEGEND}\n${CARD_TO_VALIDATE}`)).includes('к валидации')],
    // Тот самый дефект: легенда одна, живых пометок нет — метки быть не должно.
    ['легенда без карточек метки не даёт',
      nearestAuthMarks(stripLegend(LEGEND)).length === 0],
    ['легенда + голое упоминание эндпоинта = метки нет',
      nearestAuthMarks(stripLegend(`${LEGEND}\nВызов \`GET /v1/sessions/count\` при загрузке панели.`)).length === 0],
    ['строки легенды вырезаны', !stripLegend(LEGEND).includes('к валидации')],

    // --- схема взаимодействий Д1–Д8 ---
    ['схема: хелперы — блок найден, 7 строк, заголовки [1, 2]',
      plantumlBlock(DIAG_GREEN).lines.length === 7 && intHeaders(DIAG_GREEN).join(',') === '1,2'],
    ['схема: хелперы — без блока { block: null, lines: [] }',
      plantumlBlock(DIAG_CARDS).block === null && plantumlBlock(DIAG_CARDS).lines.length === 0],
    ['зелёный: образцовая спека проходит все Д1–Д8',
      allGreen.length === 8 && allGreen.every((c) => c.passed)],
    ['зелёный: ни блока, ни карточек — все Д1–Д8 «не применимо»',
      diagramChecks(`${LEGEND}\n## 2. Взаимодействия\nне применимо: взаимодействий нет\n`).every((c) => c.passed)],
    ['красный Д1: карточки есть, блока нет',
      dchk(`${LEGEND}\n${DIAG_CARDS}\n`, 'Схема: блок plantuml').passed === false],
    ['красный Д1: блок есть, карточек нет',
      dchk(`${LEGEND}\n${diagBlock(DIAG_BLOCK_LINES)}\n`, 'Схема: блок plantuml').passed === false],
    ['красный Д2: карточки есть, блока нет',
      dchk(`${LEGEND}\n${DIAG_CARDS}\n`, 'Схема: @startuml').passed === false],
    ['красный Д2: без @enduml',
      dchk(diagWith((l) => l.filter((s) => s !== '@enduml')), 'Схема: @startuml').passed === false],
    ['красный Д2: без стрелок',
      dchk(diagWith((l) => l.filter((s) => !/->/.test(s))), 'Схема: @startuml').passed === false],
    ['зелёный Д3: повтор номера в блоке — множество то же',
      dchk(diagWith((l) => [...l.slice(0, 6), 'S1 -> S2 : INT-1 🟢 Счётчик сессий', '@enduml']), 'Схема: множество').passed === true],
    ['красный Д3: лишний номер INT-3 в блоке',
      dchk(diagWith((l) => [...l.slice(0, 6), 'S2 --> S3 : INT-3 🟡 Лишняя', '@enduml']), 'Схема: множество').passed === false],
    ['красный Д4: стрелка без двоеточия',
      dchk(diagWith((l) => { l[4] = 'S1 -> S2 INT-1 🟢 Счётчик сессий'; return l; }), 'Схема: каждая стрелка').passed === false],
    ['красный Д4: кириллический алиас',
      dchk(diagWith((l) => { l[5] = 'Бэк --> S3 : INT-2 🟡 Число активных сессий'; return l; }), 'Схема: каждая стрелка').passed === false],
    ['красный Д5: participant «Kafka» не назван ни в одной границе',
      dchk(diagWith((l) => { l[3] = 'participant "Kafka" as S3'; return l; }), 'Схема: участники').passed === false],
    ['красный Д5: participant-строк нет',
      dchk(diagWith((l) => l.filter((s) => !/^participant/.test(s))), 'Схема: участники').passed === false],
    ['красный Д6: alt в блоке',
      dchk(diagWith((l) => [...l.slice(0, 6), 'alt auth недоступен', 'end', '@enduml']), 'Схема: нет alt').passed === false],
    ['зелёный Д7: путь на 🟢-стрелке `->` разрешён',
      dchk(DIAG_GREEN, 'Схема: на стрелках').passed === true],
    ['красный Д7: путь на 🟡-стрелке',
      dchk(diagWith((l) => { l[5] = 'S2 --> S3 : INT-2 🟡 Число активных сессий — GET /v1/sessions/count'; return l; }), 'Схема: на стрелках').passed === false],
    ['красный Д7: путь на пунктирной `-->` без эмодзи',
      dchk(diagWith((l) => { l[5] = 'S2 --> S3 : INT-2 Число сессий — GET /v1/sessions/count'; return l; }), 'Схема: на стрелках').passed === false],
    ['красный Д8: плейсхолдер <имя карточки> остался',
      dchk(diagWith((l) => { l[5] = 'S2 --> S3 : INT-2 🟡 <имя карточки>'; return l; }), 'Схема: плейсхолдеров').passed === false],
    ['зелёный Д8: стрелки `->`/`-->` за плейсхолдер не считаются',
      dchk(DIAG_GREEN, 'Схема: плейсхолдеров').passed === true],
  ];
  let bad = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
    if (!ok) bad += 1;
  }
  console.log(bad === 0 ? '\nсамопроверка пройдена' : `\nсамопроверка ПРОВАЛЕНА: ${bad}`);
  process.exit(bad === 0 ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest();
if (!RUN_ROOT) {
  console.error('usage: node grade-ts.mjs <runRoot>');
  console.error('       node grade-ts.mjs --selftest');
  process.exit(2);
}

// Плечо лежит в одной из двух форм: `<плечо>/conv/run-NN/work` (раскладка `setup-ctx-runs.mjs`)
// либо `<плечо>/run-NN` (плоская, `run-ctx.sh`). Ни та, ни другая не «правильнее» — обе
// живут в `runs/`, и грейдер обязан читать прежние раунды после смены раннера.
const convDir = join(RUN_ROOT, 'conv');
const base = existsSync(convDir) ? convDir : RUN_ROOT;
const runs = existsSync(base) ? readdirSync(base).filter((n) => /^run-/.test(n)).sort() : [];

/**
 * ОТКАЗ РАННЕРА — «не измерено», а не «провалено». Правило репы, выведенное из круга
 * 2026-08-07: 56 байт «You've hit your session limit» в `answer.md` дали идеальный ложный
 * красный на главном анкере пробы по ВСЕМ двадцати прогонам плеча.
 */
function unmeasured(dir) {
  if (existsSync(join(dir, '_api-failure.txt'))) return 'отказ API';
  // Прогон записал результат ЗА пределы песочницы (обычно — в саму фикстуру по абсолютному
  // пути). Скилл в этот момент не измерялся: артефакт есть, но он не там, где его грейдят, и
  // он же портит вход соседним прогонам. Метка ставится руками при разборе инцидента.
  if (existsSync(join(dir, '_escaped.txt'))) return 'прогон вышел за песочницу';
  const ans = join(dir, 'answer.md');
  const empty = !existsSync(ans) || readFileSync(ans, 'utf8').trim() === '';
  if (existsSync(ans) && isApiFailure(readFileSync(ans, 'utf8'))) return 'отказ API в тексте ответа';
  // Пустой stdout И пустой диск — прогон не состоялся. Если спека на диске есть, прогон
  // измерен: артефакт важнее вывода, и молчаливая, но записанная спека — законный исход.
  if (empty && !findSpec(sandboxOf(dir)) && !findStraySpec(sandboxOf(dir))) return 'пустой ответ, на диске тоже пусто';
  return null;
}

/**
 * «Фантомная запись» — прогон ОТЧИТАЛСЯ о записанном файле, а файла нет. Это не то же самое,
 * что «ушёл в вопросы вместо записи»: второе по Step 3.5 законно (свой не заданный вопрос — это
 * ❓, а ❓ блокирует запись), первое — ложь артефакта, и она дороже всего остального в петле:
 * аналитик уходит с путём, по которому ничего нет.
 */
const RE_CLAIMS_WRITTEN = /(спек[аи]|спецификаци[ияю]|документ)[^.\n]{0,60}(записан|готов|создан|сохранён|сохранен)|(файл|путь)\s*:?\s*`?[^`\n]{0,20}docs\//i;

/**
 * ПЕРЕСПРАШИВАНИЕ ЗАКРЫТОГО ГЕЙТА — вопрос про то, что аналитик уже сказал в этой сессии.
 *
 * Анкеры литеральные и взяты из ответов аналитика в `TS-CONV/spec-prompt.txt`: частота
 * обновления, прочерк при недоступности, доступ только администратору, отказ подтвердить
 * источник. Вопрос засчитывается, только если знак вопроса стоит в ТОЙ ЖЕ строке — «где-то в
 * ответе есть слово „прочерк“ и где-то есть вопрос» ловило бы обычный пересказ.
 *
 * Дефект дорогой и прямой: аналитик отвечает второй раз на то же самое, а ход теряется —
 * все прогоны, переспросившие гейт, спеку в этот ход не написали.
 */
const REASKED_GATES = [
  { label: 'частота обновления', re: /раз в минуту|ежеминутн|60 сек/i },
  { label: 'прочерк при недоступности', re: /прочерк/i },
  { label: 'доступ только админу', re: /только админ|видит только админ/i },
  { label: 'источник не подтверждён', re: /не знаю|подтвердить не мог/i },
];

const summary = [];
for (const r of runs) {
  const dir = join(base, r);
  const why = unmeasured(dir);
  if (why) {
    summary.push({ run: r, measured: false, why });
    console.log(`\n=== ${r} — НЕ ИЗМЕРЕНО (${why}) ===`);
    continue;
  }
  const checks = grade(dir);
  const scored = checks.filter((c) => !c.info);
  const passed = scored.filter((c) => c.passed).length;
  const ansFile = join(dir, 'answer.md');
  const answerText = existsSync(ansFile) ? readFileSync(ansFile, 'utf8') : '';
  const noSpec = checks.some((c) => c.text === 'Спека записана в папку задачи рядом с БТ' && !c.passed);
  const reasked = REASKED_GATES.filter((g) =>
    answerText.split(/\r?\n/).some((l) => g.re.test(l) && l.includes('?'))).map((g) => g.label);
  summary.push({
    run: r, measured: true, passed, total: scored.length, checks,
    phantom: noSpec && RE_CLAIMS_WRITTEN.test(answerText),
    reasked,
  });
  console.log(`\n=== ${r} — ${passed}/${scored.length} ===`);
  for (const c of checks) console.log(`  ${c.info ? 'info' : c.passed ? 'PASS' : 'FAIL'}  ${c.text}\n        ${c.evidence}`);
  // Печатается ПОСЛЕ заголовка прогона. Стояло до — и строка уезжала под предыдущий прогон:
  // при разборе 2026-08-14 два прогона были обвинены в переспрашивании чужими словами.
  if (reasked.length) console.log(`  ИНФО  переспрошен закрытый гейт: ${reasked.join(', ')}`);
}

// ─── Счётчики: по одному на дефект, а не один «зелёный/красный» ────────────────────────────
// Один общий процент прячет разные поломки друг в друге: раунд 2026-08-14 показал, что
// «правило оформления не применено» жило внутри общего числа и стало видно только счётчиком.
const measured = summary.filter((s) => s.measured);
const hits = (text) => measured.filter((s) => s.checks.some((c) => c.text === text && !c.passed)).length;
const strayCount = measured.filter((s) =>
  s.checks.some((c) => c.text === 'Спека записана в папку задачи рядом с БТ' && /МИМО ПАПКИ/.test(c.evidence))).length;
const noSpec = measured.filter((s) =>
  s.checks.some((c) => c.text === 'Спека записана в папку задачи рядом с БТ' && c.evidence === 'файла нет')).length;
const green = measured.filter((s) => s.passed === s.total).length;
const pct = (n) => `${n} (${measured.length ? Math.round((n / measured.length) * 100) : 0}%)`;

console.log(`\nплечо: ${RUN_ROOT}`);
console.log(`измерено: ${measured.length} из ${runs.length}`);
console.log('\nСЧЁТЧИКИ (меньше — лучше, кроме последней строки):');
console.log(`  ${pct(noSpec)}\tспека не записана вовсе (часть из них — законный уход в вопросы)`);
console.log(`  ${pct(measured.filter((s) => s.phantom).length)}\t— из них ФАНТОМ: отчитался о записанном файле, файла нет`);
console.log(`  ${pct(measured.filter((s) => s.reasked.length > 0).length)}\tпереспрошен гейт, на который аналитик уже ответил`);
console.log(`  ${pct(strayCount)}\tспека записана мимо папки задачи`);
console.log(`  ${pct(hits('Утверждение об эндпоинте auth НЕ записано как «подтверждено аналитиком»'))}\tчужой эндпоинт выдан за подтверждённый (кардинальный грех)`);
console.log(`  ${pct(hits('Чужой эндпоинт не выписан в спеку (ни под какой пометкой)'))}\tчужой путь выписан в спеку (запрещён под любой пометкой)`);
console.log(`  ${pct(hits('Конвенция пути применена в СВОЁМ контракте: путь вида /v1/…'))}\tправило пути не применено в СВОЁМ контракте`);
console.log(`  ${pct(hits('Правило не растянуто на соседнее решение (таймаут ≠ интервал опроса)'))}\tправило растянуто на соседнее решение`);
console.log(`  ${pct(hits('Конвенция дат применена там, где дата есть (иначе не применима)'))}\tправило дат не применено`);
console.log(`  ${pct(hits('Конвенция кодов применена: 403 при отказе по роли'))}\tправило кодов не применено`);
console.log(`  ${pct(hits('Конвенция null применена: null = источник недоступен, ноль отдельно'))}\tправило null не применено`);
console.log(`  ${pct(hits('Статус согласован с содержанием: есть открытые пункты → «Требуются уточнения (N)», нет → «Готово к разработке»'))}\tстатус разошёлся с содержанием`);
console.log(`  ${pct(hits('Пометки происхождения расставлены (🟢 и существующее 🔵/🟡 присутствуют)'))}\tпометок происхождения нет`);
console.log(`  ${pct(hits('Подтверждённое существующее помечено 🔵, а не 🟡'))}\tподтверждённое осталось под 🟡 (прежняя легенда)`);
console.log(`  ${pct(hits('Схема: блок plantuml есть ⇔ карточек INT ≥ 1'))}\tсхема: блок plantuml не совпал с наличием карточек (info)`);
console.log(`  ${pct(hits('Схема: множество INT-N в блоке == множеству заголовков'))}\tсхема: номера INT в блоке ≠ заголовкам (info)`);
console.log(`  ${pct(hits('Схема: на стрелках 🔵/🟡 и на пунктирных --> нет метода и пути'))}\tсхема: путь на чужой стрелке (info)`);
console.log(`  ${pct(hits('Схема: плейсхолдеров скелета нет'))}\tсхема: плейсхолдер скелета остался (info)`);
console.log(`  ${pct(green)}\tзелёных целиком (все якоря сразу)`);
