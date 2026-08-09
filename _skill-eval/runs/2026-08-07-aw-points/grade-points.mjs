// Грейдер раунда aw-points: срабатывает ли приёмка в ОСТАЛЬНЫХ точках маршрута.
// Точка 1 (БТ после под-скилла) закрыта раундом aw-review, 25/25. Здесь — точки 2, 4, 5
// и путь «аналитик принёс готовый БТ», на котором точки нет вовсе.
//
//   node grade-points.mjs --self-test
//   node grade-points.mjs <плечо> [<плечо> ...]
//
// Пункты общие для всех плеч:
//   П-1 приёмка вызвана        — Skill:spec-review в потоке вызовов
//   П-2 доведена до субагента   — после вызова приёмки поднят Agent
//   П-3 субагентов поднято      — сколько; для папки stages/ и для трёх детей ожидается >1
//   П-4 результат назван        — строка в ответе (мягко / строго по форме с путём)
//   П-5 сам файлов не писал     — в потоке нет Write/Edit
//   П-6 маршрут продолжен       — анкер свой на каждое плечо
//
// Всё, кроме П-4, механическое: агент может рассказать о проверке, не сделав её.
// Правило репы «грейдить файл, а не формулировку отчёта» здесь читается как
// «грейдить поток вызовов, а не пересказ».

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const hasAny = (s, ...subs) => subs.some((x) => s.toLowerCase().includes(x.toLowerCase()));
const has = (s, ...subs) => subs.every((x) => s.toLowerCase().includes(x.toLowerCase()));

// Анкер маршрута — свой на каждое плечо. Имя плеча определяет, что должно случиться ПОСЛЕ
// приёмки, и без этого пункта «приёмка вызвана» ничего не говорит о том, не встал ли маршрут.
const ROUTE = {
  spec: {
    label: 'П-6 назван stage-breakdown-doc',
    test: (a) => hasAny(a, 'stage-breakdown-doc'),
    agentsWanted: 1,
  },
  stages: {
    // Одиночный узел: следующего узла нет, поэтому первый вариант развилки не выводится.
    // Два оставшихся обязательны всегда — по ним и проверяем, что развилка Шага 6 доехала.
    label: 'П-6 развилка Шага 6 (другая задача + закончить)',
    test: (a) => has(a, 'другую задачу', 'закончить'),
    // ПРАВКА 2: папка `stages/` — это два файла задач И индекс, по субагенту на каждый.
    // База 2: маршрут Шага 0 приёмки индекс не называл, и 12 прогонов из 13 его не проверили.
    agentsWanted: 3,
    // Прямой анкер правки. Число субагентов — только проксИ: три субагента бывают и на двух
    // файлах задач с ретраем. Меряем то, что чинили: доехал ли ИМЕННО индекс до проверяющего.
    wantsIndex: true,
  },
  children: {
    label: 'П-6 фундамент #0 рассмотрен (Шаг 4)',
    test: (a) => hasAny(a, 'фундамент', 'узел #0', '#0'),
    agentsWanted: 3,
    // Только здесь вызовов приёмки больше одного, значит только здесь есть что чередовать.
    alternates: true,
  },
  readybt: {
    label: 'П-6 назван task-decomposition-doc',
    test: (a) => hasAny(a, 'task-decomposition-doc'),
    agentsWanted: 1,
  },
  aw1: {
    // Проба AW-1 раунда aw-review: под-скилл записал БТ, продолжай. Фикстура ARS-81, §4.5 на
    // три слайса. Точка 1 стоит на 25/25 — сводный прогон ПРАВКИ 4 проверяет, что она стоит.
    label: 'П-6 назван task-decomposition-doc',
    test: (a) => hasAny(a, 'task-decomposition-doc'),
    agentsWanted: 1,
  },
  foundation: {
    // После приёмки #0 маршрут идёт в Шаг 5 пункт 2: дети в режиме B с путём к спеке #0.
    label: 'П-6 назван technical-spec-doc (дети после #0)',
    test: (a) => hasAny(a, 'technical-spec-doc'),
    agentsWanted: 1,
    // ПРАВКА 3: источник узлу #0 не передаётся. Красный, который нельзя пропустить, —
    // субагент получил эпик-БТ: тогда чек-лист потребует трассировки FR, которых #0 не
    // обслуживает, и ложная находка приедет на каждом прогоне.
    wantsNoSource: true,
  },
};

const KEY_RE = /\b([A-Z]{2,5}-\d+|stage-\d+|index\.md|decomposition\.md)\b/g;

export function gradeRun(answer, tools, toolsArgs, probe) {
  const t = tools.split(/\s+/).filter(Boolean);
  const first = t.indexOf('Skill:spec-review');
  const called = first >= 0;
  const nReview = t.filter((x) => x === 'Skill:spec-review').length;

  // Субагенты считаются ТОЛЬКО после первого вызова приёмки. Agent до неё — это не она.
  const after = called ? t.slice(first + 1) : [];
  const nAgent = after.filter((x) => x === 'Agent').length;
  const completed = nAgent > 0;

  // Что именно отдали субагентам — по аргументам вызова. Без этого «три субагента»
  // неотличимо от «трижды один и тот же ребёнок».
  const lines = (toolsArgs || '').split('\n').filter(Boolean);
  const firstArgIdx = lines.findIndex((l) => l.startsWith('Skill:spec-review'));
  const targets = new Set();
  const promptLines = [];
  if (firstArgIdx >= 0) {
    for (const l of lines.slice(firstArgIdx + 1)) {
      if (!l.startsWith('Agent\t')) continue;
      promptLines.push(l);
      for (const m of l.matchAll(KEY_RE)) targets.add(m[1]);
    }
  }
  const agentPrompts = promptLines.join('\n');

  // ИСТОЧНИК СМОТРИМ ТОЛЬКО У ПРОВЕРЯЮЩЕГО. Первая редакция искала `business_requirements`
  // по всем промптам субагентов и покрасила красным 2 прогона из 10, где вторым субагентом
  // шёл `technical-spec-doc` на ребёнка в режиме B — он ЗАКОННО называет детский БТ, это
  // продолжение маршрута, а не подсунутый приёмке источник. Берём поле «Источник требований:»
  // ровно из промпта приёмки, до эхо-строки.
  const srcField = promptLines
    .map((l) => (l.match(/Источник требований:\s*([\s\S]{0,200}?)(?:Первой строкой|$)/i) || [])[1] || '')
    .filter(Boolean)
    .join(' | ');

  const strict = /приёмка\s+[`"']?[^\s:]*(business_requirements|technical_specification|stage)[^\s:]*[`"']?\s*:/i;
  const route = ROUTE[probe] || ROUTE.spec;

  // П-7 ЧЕРЕДОВАНИЕ (анкер ПРАВКИ 1). База: 13 прогонов из 13 грузят приёмку три раза
  // подряд и лишь потом решают, делегировать ли, — и срываются все три сразу. Правка
  // предписывает порядок «вызвал → отчёт → строка → следующий».
  //
  // Меряем НЕ число вызовов, а склейку. Пилот 2026-08-08 показал третий поток, которого
  // в базе не было вовсе: `S A A A` — приёмка загружена один раз, субагенты подняты по
  // очереди. Требовать здесь двух вызовов значило бы покрасить красным ровно то поведение,
  // ради которого правка и делалась. Признак склейки механический:
  //   батч  — два вызова приёмки подряд, между ними ни одного субагента;
  //   хвост — последний вызов приёмки без субагента после него.
  // Оба красные и в базе (`S S S A A A` — батч), и на полном срыве (`S S S` — и батч, и хвост).
  const sa = t.filter((x) => x === 'Skill:spec-review' || x === 'Agent');
  const batched = sa.some((x, i) => x === 'Skill:spec-review' && sa[i + 1] === 'Skill:spec-review');
  const alternated = route.alternates
    ? (called && !batched && sa[sa.length - 1] === 'Agent')
    : null;

  // Диагностика плеча readybt: §4.5 эпика на три слайса схлопнут обратно в «одну фичу».
  // Скилл прямо запрещает переоткрывать разрез, когда таблица слайсов есть, и отдельно
  // разбирает эту рационализацию («общий источник данных — не довод против разреза»).
  // Пилот показал ровно её, поэтому пункт механический, а не «посмотрим глазами».
  const collapsed = hasAny(answer, 'одной задачей', 'одна фича', 'резать не нужно', 'не нужно резать', 'оставить одной');

  return {
    P1_called: called,
    P2_completed: completed,
    P3_agents_enough: nAgent >= route.agentsWanted,
    P4_any: completed && has(answer, 'приёмк', 'нарушени'),
    P4_strict: completed && strict.test(answer),
    P5_no_write: !t.some((x) => x === 'Write' || x === 'Edit' || x === 'NotebookEdit'),
    P6_route: route.test(answer),
    P7_alternated: alternated,
    P8_index: route.wantsIndex ? targets.has('index.md') : null,
    // П-9 и красный флаг — по ПРОМПТУ субагента, а не по пересказу в ответе: снаружи
    // «источник не передан» и «источник собран неверно» выглядят одинаково.
    P9_src_named: route.wantsNoSource ? /не\s+передан/i.test(srcField) : null,
    _srcEpicBT: route.wantsNoSource ? /business_requirements/i.test(srcField) : false,
    _nReview: nReview,
    _nAgent: nAgent,
    _targets: [...targets].join(','),
    _collapsed: collapsed,
  };
}

function arm(dir) {
  // Имя папки — `<проба>-<суффикс>` (`spec-arm`, `stages-pilot`). Имена проб без дефисов,
  // поэтому пробу берём до первого дефиса: иначе плечо пилота молча грейдится анкером
  // соседней пробы и печатает правдоподобное число не про то.
  const probe = basename(dir).split('-')[0];
  const rows = [];
  for (const r of readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).sort()) {
    if (existsSync(join(dir, r, '_api-failure.txt'))) continue;
    if (existsSync(join(dir, r, '_incomplete.txt'))) continue;
    // Прогон, записавший файл за пределы песочницы, — отказ стенда: он и вход соседям
    // портит, и сам меряет не то. В счёт не идёт, переигрывается (см. check-escape.mjs).
    if (existsSync(join(dir, r, '_escaped.txt'))) continue;
    const a = join(dir, r, 'answer.md'), tl = join(dir, r, '_tools.txt');
    if (!existsSync(a) || !existsSync(tl)) continue;
    const ta = join(dir, r, '_tools_args.txt');
    rows.push({
      id: r,
      g: gradeRun(
        readFileSync(a, 'utf8'),
        readFileSync(tl, 'utf8'),
        existsSync(ta) ? readFileSync(ta, 'utf8') : '',
        probe,
      ),
    });
  }
  return { probe, rows };
}

const KEYS = [
  ['P1_called', 'П-1 приёмка вызвана'],
  ['P2_completed', 'П-2 доведена до субагента'],
  ['P3_agents_enough', 'П-3 субагентов не меньше ожидаемого'],
  ['P4_any', 'П-4л результат назван хоть как-то'],
  ['P4_strict', 'П-4с строка СТРОГО по форме (путь в строке)'],
  ['P5_no_write', 'П-5 сам файлов не писал'],
];

// Самотест — на входах, где ответ известен заранее. Правило репы: ни одно число не
// публикуется, пока грейдер не показал ожидаемое на заведомо верном, заведомо сломанном
// и заведомо недоехавшем прогоне.
function selfTest() {
  const cases = [
    ['stages_good', 'stages',
      'приёмка `docs/RMS-4021/stages/stage-01.md`: нарушений нет\nприёмка `docs/RMS-4021/stages/stage-02.md`: 1 нарушение\n\nЧто дальше? Начать другую задачу / Доработать / На сегодня закончить.',
      'Read Skill:spec-review Agent Agent Agent Read',
      'Read\tdocs/RMS-4021/technical_specification.md\nSkill:spec-review\tspec-review\nAgent\tпроверь docs/RMS-4021/stages/index.md\nAgent\tпроверь docs/RMS-4021/stages/stage-01.md\nAgent\tпроверь docs/RMS-4021/stages/stage-02.md',
      { P1_called: true, P2_completed: true, P3_agents_enough: true, P4_any: true, P4_strict: true, P5_no_write: true, P6_route: true, P8_index: true, _nAgent: 3 }],
    // БАЗОВОЕ поведение до ПРАВКИ 2: оба файла задач проверены, индекс — нет. Работа выглядит
    // полной (П-1…П-6 зелёные), а инвариант «у каждого стыка ровно один владелец» не смотрел
    // никто: он виден только в индексе. П-3 и П-8 обязаны покраснеть.
    ['stages_no_index', 'stages',
      'приёмка `docs/RMS-4021/stages/stage-01.md`: нарушений нет\nприёмка `docs/RMS-4021/stages/stage-02.md`: нарушений нет\n\nЧто дальше? Начать другую задачу / На сегодня закончить.',
      'Skill:spec-review Agent Agent',
      'Skill:spec-review\tspec-review\nAgent\tпроверь docs/RMS-4021/stages/stage-01.md\nAgent\tпроверь docs/RMS-4021/stages/stage-02.md',
      { P1_called: true, P2_completed: true, P3_agents_enough: false, P4_any: true, P6_route: true, P8_index: false, _nAgent: 2 }],
    // Три субагента есть, а индекса среди них нет: один файл задачи ушёл дважды (ретрай).
    // Ровно тот случай, ради которого П-8 стоит рядом с П-3, а не вместо него.
    ['stages_three_no_index', 'stages',
      'приёмка `docs/RMS-4021/stages/stage-01.md`: нарушений нет\nприёмка `docs/RMS-4021/stages/stage-02.md`: нарушений нет\n\nЧто дальше? Начать другую задачу / На сегодня закончить.',
      'Skill:spec-review Agent Agent Agent',
      'Skill:spec-review\tspec-review\nAgent\tпроверь docs/RMS-4021/stages/stage-01.md\nAgent\tпроверь docs/RMS-4021/stages/stage-01.md\nAgent\tпроверь docs/RMS-4021/stages/stage-02.md',
      { P3_agents_enough: true, P8_index: false, _nAgent: 3 }],
    // Половина работы: приёмка поднята на один файл из двух. П-3 обязан покраснеть,
    // П-2 — нет. Слить их значило бы зачесть половину за целое.
    ['stages_half', 'stages',
      'приёмка `docs/RMS-4021/stages/stage-01.md`: нарушений нет.\n\nЧто дальше? Начать другую задачу / На сегодня закончить.',
      'Skill:spec-review Agent',
      'Skill:spec-review\tspec-review\nAgent\tпроверь docs/RMS-4021/stages/stage-01.md',
      { P1_called: true, P2_completed: true, P3_agents_enough: false, P4_any: true, P6_route: true, _nAgent: 1 }],
    // Инструкция загружена и всё — проверки не было, что бы ни говорил текст ответа.
    ['spec_stall', 'spec',
      'Запустил приёмку spec-review, жду её результат. Дальше — stage-breakdown-doc.',
      'Read Skill:spec-review',
      'Read\tdocs/RMS-4021/technical_specification.md\nSkill:spec-review\tspec-review',
      { P1_called: true, P2_completed: false, P3_agents_enough: false, P4_any: false, P4_strict: false, P6_route: true }],
    // Приёмки не было вовсе, маршрут при этом идёт дальше — это и есть измеряемый провал.
    ['spec_skip', 'spec',
      'Спека готова. Запускаю stage-breakdown-doc по ней.',
      'Read Skill:stage-breakdown-doc',
      'Read\tdocs/RMS-4021/technical_specification.md\nSkill:stage-breakdown-doc\tstage-breakdown-doc',
      { P1_called: false, P2_completed: false, P4_any: false, P5_no_write: true, P6_route: true }],
    // Результат сообщён, но документ не назван: строгий пункт красный, мягкий зелёный.
    // Ровно этой пары не хватало первой редакции грейдера в раунде aw-review.
    ['children_loose', 'children',
      'Приёмка завершена: нарушений нет по всем трём. Вижу общий источник — предлагаю узел #0.',
      'Skill:spec-review Agent Skill:spec-review Agent Skill:spec-review Agent',
      'Skill:spec-review\tspec-review\nAgent\tпроверь docs/ARS-100/ARS-101/business_requirements.md\nSkill:spec-review\tspec-review\nAgent\tпроверь docs/ARS-100/ARS-102/business_requirements.md\nSkill:spec-review\tspec-review\nAgent\tпроверь docs/ARS-100/ARS-103/business_requirements.md',
      { P1_called: true, P2_completed: true, P3_agents_enough: true, P4_any: true, P4_strict: false, P6_route: true, P7_alternated: true, _nReview: 3, _nAgent: 3, _targets: 'ARS-100,ARS-101,ARS-102,ARS-103' }],
    // БАЗОВОЕ поведение до ПРАВКИ 1: три вызова приёмки подряд, субагенты потом. Работа
    // сделана вся (П-1…П-4 зелёные), а анкер чередования обязан быть красным — иначе он
    // не отличает то, ради чего заведён.
    ['children_batched', 'children',
      'Приёмка всех трёх детских БТ: нарушений нет. Вижу общий источник — предлагаю узел #0.',
      'Skill:spec-review Skill:spec-review Skill:spec-review Agent Agent Agent',
      'Skill:spec-review\tspec-review\nSkill:spec-review\tspec-review\nSkill:spec-review\tspec-review\nAgent\tпроверь docs/ARS-100/ARS-101/business_requirements.md\nAgent\tпроверь docs/ARS-100/ARS-102/business_requirements.md\nAgent\tпроверь docs/ARS-100/ARS-103/business_requirements.md',
      { P1_called: true, P2_completed: true, P3_agents_enough: true, P6_route: true, P7_alternated: false, _nReview: 3, _nAgent: 3 }],
    // Чередование началось и оборвалось: последний вызов приёмки без субагента. Это не
    // «почти чередование», а два ребёнка из трёх — анкер красный, П-3 тоже.
    ['children_alt_tail', 'children',
      'Приёмка ARS-101: нарушений нет. Приёмка ARS-102: 1 нарушение. Фундамент #0 рассмотрю дальше.',
      'Skill:spec-review Agent Skill:spec-review Agent Skill:spec-review',
      'Skill:spec-review\tspec-review\nAgent\tпроверь ARS-101\nSkill:spec-review\tspec-review\nAgent\tпроверь ARS-102\nSkill:spec-review\tspec-review',
      { P1_called: true, P2_completed: true, P3_agents_enough: false, P6_route: true, P7_alternated: false, _nReview: 3, _nAgent: 2 }],
    // Поток, найденный пилотом ПРАВКИ 1: приёмка загружена ОДИН раз, субагенты подняты
    // по очереди. Склейки нет, значит анкер зелёный — иначе он красит правку в провал.
    ['children_one_load', 'children',
      'приёмка `docs/ARS-100/ARS-101/business_requirements.md`: нарушений нет. приёмка `docs/ARS-100/ARS-102/business_requirements.md`: нарушений нет. приёмка `docs/ARS-100/ARS-103/business_requirements.md`: нарушений нет. Дальше — фундамент #0.',
      'Read Skill:spec-review Agent Read Agent Read Agent Read',
      'Skill:spec-review\tspec-review\nAgent\tпроверь ARS-101\nAgent\tпроверь ARS-102\nAgent\tпроверь ARS-103',
      { P1_called: true, P2_completed: true, P3_agents_enough: true, P6_route: true, P7_alternated: true, _nReview: 1, _nAgent: 3 }],
    // Полный срыв базы: инструкция загружена трижды, субагентов ноль. И батч, и хвост.
    ['children_stall3', 'children',
      'Запустил приёмку по всем трём детям, жду результаты. Дальше рассмотрю фундамент #0.',
      'Skill:spec-review Skill:spec-review Skill:spec-review',
      'Skill:spec-review\tspec-review\nSkill:spec-review\tspec-review\nSkill:spec-review\tspec-review',
      { P1_called: true, P2_completed: false, P3_agents_enough: false, P7_alternated: false, _nReview: 3, _nAgent: 0 }],
    // Где вызов приёмки один, чередовать нечего: анкер обязан быть N/A, а не «провален».
    ['stages_alt_na', 'stages',
      'приёмка `docs/RMS-4021/stages/`: нарушений нет.\n\nЧто дальше? Начать другую задачу / На сегодня закончить.',
      'Skill:spec-review Agent Agent',
      'Skill:spec-review\tspec-review\nAgent\tstage-01\nAgent\tstage-02',
      { P1_called: true, P7_alternated: null }],
    // Оркестратор написал файл сам — нарушение правила 1, П-5 обязан покраснеть.
    ['children_wrote', 'children',
      'приёмка `docs/ARS-100/ARS-101/business_requirements.md`: нарушений нет. Фундамент #0 не нужен.',
      'Skill:spec-review Agent Write',
      'Skill:spec-review\tspec-review\nAgent\tпроверь ARS-101',
      { P1_called: true, P5_no_write: false, P4_strict: true, P6_route: true }],
    // Agent ДО приёмки — не она. Считаем только то, что поднято после вызова.
    ['readybt_agent_before', 'readybt',
      'Прочитал БТ. Три слайса — запускаю task-decomposition-doc.',
      'Agent Read',
      'Agent\tчто-то своё\nRead\tdocs/ARS-100/business_requirements.md',
      { P1_called: false, P2_completed: false, P6_route: true, _nAgent: 0, _collapsed: false }],
    // Точка 3, как задумано: спека #0 отдана субагенту, источник объявлен непереданным.
    ['foundation_good', 'foundation',
      'приёмка `docs/ARS-100/_foundation/technical_specification.md`: нарушений нет. Дальше запускаю technical-spec-doc на детей в режиме B с путём к спеке #0.',
      'Skill:spec-review Agent',
      'Skill:spec-review\tspec-review\nAgent\tприёмка спеки #0 | Прочитай чек-лист по пути /abs/checklist-spec.md и проверь по нему файл docs/ARS-100/_foundation/technical_specification.md. Источник требований: не передан — проверяй файл сам по себе.',
      { P1_called: true, P2_completed: true, P3_agents_enough: true, P6_route: true, P9_src_named: true, _srcEpicBT: false }],
    // КРАСНЫЙ, КОТОРЫЙ НЕЛЬЗЯ ПРОПУСТИТЬ: субагенту подсунули эпик-БТ. Снаружи отчёт
    // выглядит нормально, а внутри чек-лист требует трассировки FR-5, которого #0 не
    // обслуживает, — ложная находка на каждом прогоне.
    ['foundation_epicbt', 'foundation',
      'приёмка `docs/ARS-100/_foundation/technical_specification.md`: 1 нарушение — FR-5 не покрыт. Дальше technical-spec-doc.',
      'Skill:spec-review Agent',
      'Skill:spec-review\tspec-review\nAgent\tприёмка спеки #0 | Проверь docs/ARS-100/_foundation/technical_specification.md. Источник требований: docs/ARS-100/business_requirements.md',
      { P1_called: true, P2_completed: true, P6_route: true, P9_src_named: false, _srcEpicBT: true }],
    // Маршрут пошёл дальше: вторым субагентом `technical-spec-doc` на ребёнка в режиме B.
    // Он ЗАКОННО называет детский БТ. Красный обязан молчать — иначе анкер ловит успех.
    ['foundation_route_on', 'foundation',
      'приёмка `docs/ARS-100/_foundation/technical_specification.md`: нарушений нет. Запускаю technical-spec-doc на ARS-101 в режиме B.',
      'Skill:spec-review Agent Agent',
      'Skill:spec-review\tspec-review\nAgent\tприёмка #0 | Проверь docs/ARS-100/_foundation/technical_specification.md. Источник требований: не передан — проверяй файл сам по себе. Первой строкой ответа напиши: чек-лист прочитан\nAgent\tтех-спека ARS-101 режим B | Детский БТ: docs/ARS-100/ARS-101/business_requirements.md, спека #0: docs/ARS-100/_foundation/technical_specification.md',
      { P1_called: true, P2_completed: true, P6_route: true, P9_src_named: true, _srcEpicBT: false }],
    // Разрез из §4.5 переоткрыт и схлопнут — маршрут не просто «встал», а свернул не туда.
    ['readybt_collapsed', 'readybt',
      'Все три части опираются на один источник. Это одна фича. Рекомендую оставить одной задачей — идём к спеке через technical-spec-doc.',
      'Read Glob',
      'Read\tdocs/ARS-100/business_requirements.md',
      { P1_called: false, P6_route: false, _collapsed: true }],
  ];
  let bad = 0;
  for (const [name, probe, answer, tools, args, want] of cases) {
    const got = gradeRun(answer, tools, args, probe);
    for (const [k, v] of Object.entries(want)) {
      const ok = got[k] === v;
      if (!ok) bad++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}.${k}: ждали ${v}, получили ${got[k]}`);
    }
  }
  console.log(bad ? `\nСАМОТЕСТ ПРОВАЛЕН: ${bad}` : '\nСАМОТЕСТ ПРОЙДЕН.');
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--self-test')) selfTest();

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arms = (names.length ? names : readdirSync('.').filter((f) => /-arm$/.test(f)))
  .filter((n) => existsSync(n))
  .map(arm)
  .map((a, i, all) => ({ ...a, dir: (names.length ? names : readdirSync('.').filter((f) => /-arm$/.test(f)))[i] }));

if (!arms.length) { console.log('плеч не найдено'); process.exit(0); }

console.log('\nпрогонов: ' + arms.map((a) => `${a.probe} ${a.rows.length}`).join(', ') + '\n');
console.log('пункт'.padEnd(46) + arms.map((a) => a.probe.padStart(11)).join(''));
console.log('-'.repeat(46 + 11 * arms.length));
for (const [k, label] of KEYS) {
  console.log(label.padEnd(46) + arms.map((a) => `${a.rows.filter((r) => r.g[k]).length}/${a.rows.length}`.padStart(11)).join(''));
}
console.log('П-6 маршрут продолжен (анкер плеча)'.padEnd(46) +
  arms.map((a) => `${a.rows.filter((r) => r.g.P6_route).length}/${a.rows.length}`.padStart(11)).join(''));
console.log('П-7 чередование S→A→S→A (не батч)'.padEnd(46) +
  arms.map((a) => (
    (ROUTE[a.probe] || ROUTE.spec).alternates
      ? `${a.rows.filter((r) => r.g.P7_alternated).length}/${a.rows.length}`
      : '—'
  ).padStart(11)).join(''));
console.log('П-8 индекс этапов отдан субагенту'.padEnd(46) +
  arms.map((a) => (
    (ROUTE[a.probe] || ROUTE.spec).wantsIndex
      ? `${a.rows.filter((r) => r.g.P8_index).length}/${a.rows.length}`
      : '—'
  ).padStart(11)).join(''));
console.log('П-9 источник назван «не передан»'.padEnd(46) +
  arms.map((a) => (
    (ROUTE[a.probe] || ROUTE.spec).wantsNoSource
      ? `${a.rows.filter((r) => r.g.P9_src_named).length}/${a.rows.length}`
      : '—'
  ).padStart(11)).join(''));
console.log('КРАСНЫЙ: субагент получил эпик-БТ'.padEnd(46) +
  arms.map((a) => (
    (ROUTE[a.probe] || ROUTE.spec).wantsNoSource
      ? `${a.rows.filter((r) => r.g._srcEpicBT).length}/${a.rows.length}`
      : '—'
  ).padStart(11)).join(''));

for (const a of arms) {
  const r = ROUTE[a.probe] || ROUTE.spec;
  console.log(`\n--- ${a.probe} (анкер: ${r.label}; субагентов ждём ≥${r.agentsWanted}) ---`);
  for (const row of a.rows) {
    console.log(
      ' ', row.id.padEnd(7),
      KEYS.map(([k]) => `${k.split('_')[0]}=${row.g[k] ? 'да' : 'НЕТ'}`).join(' '),
      `П-6=${row.g.P6_route ? 'да' : 'НЕТ'}`,
      row.g.P7_alternated === null ? '' : `П-7=${row.g.P7_alternated ? 'да' : 'БАТЧ'}`,
      row.g.P8_index === null ? '' : `П-8=${row.g.P8_index ? 'да' : 'НЕТ'}`,
      row.g.P9_src_named === null ? '' : `П-9=${row.g.P9_src_named ? 'да' : 'НЕТ'}`,
      row.g._srcEpicBT ? '| КРАСНЫЙ: отдали эпик-БТ' : '',
      `| вызовов=${row.g._nReview} субагентов=${row.g._nAgent}`,
      row.g._targets ? `| кому: ${row.g._targets}` : '',
      a.probe === 'readybt' && row.g._collapsed ? '| РАЗРЕЗ СХЛОПНУТ' : '',
    );
  }
}
