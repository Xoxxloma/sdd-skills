// grade-async.mjs — грейд раунда «асинхронщина в карточке», фикстура SM-ASYNC.
//
//   node agent-version-5.0/_skill-eval/grade-async.mjs <папка-песочниц>
//   node agent-version-5.0/_skill-eval/grade-async.mjs --selftest
//
// Грейдится ДИСК: карточки `services/*.md` в песочнице, а не текст ответа агента.
//
// Четыре правила, без которых грейд врёт (все четыре ловились на прошлых раундах):
//
//  1. НЕТ КАРТОЧКИ — НЕ «КРАСНОЕ», А «НЕ ИЗМЕРЕНО». Прогон, оборвавшийся до Шага 4,
//     ничего не сообщает о правилах, которые проверяются по карточке.
//  2. ЯКОРЬ ИЩЕТСЯ ВНУТРИ СВОЕЙ СЕКЦИИ. Факт про идемпотентность, упомянутый в «Владеет
//     данными», не значит, что блок события его несёт. Секции режутся по `^## `.
//  3. РЕГУЛЯРКИ — ЛИТЕРАЛАМИ, а не собранные из строк. `new RegExp("\\Z")` — это литерал Z,
//     и такая проба зеленеет на пустом файле.
//  4. ЗАПУСКАТЬ ТОЛЬКО ПОСЛЕ ЗАВЕРШЕНИЯ ВСЕХ ПРОГОНОВ.
//
// Проба `async-before` гоняет тот же материал на скилле ДО правки. Там «События» — таблица,
// а секции «Фоновые задачи» нет вовсе: ключи считаются по строкам таблицы, якоря — по тексту
// секции. Это база сравнения, а не провал грейдера.
//
// Зеркал асинхронных рёбер здесь НЕ меряется: правка про них откачена 2026-08-12.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const selftest = argv.includes('--selftest');
const runsDir = argv.find((a) => !a.startsWith('--'));

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// --- разбор карточки ---------------------------------------------------------

/** Текст секции `## <имя>` до следующего `## `. Пусто, если секции нет. */
function section(card, name) {
  const lines = card.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** Заголовки блоков `### ` внутри текста секции. */
const blocks = (text) => text.split('\n').filter((l) => /^### /.test(l));

/** Строки данных таблицы: без шапки, разделителя и пустой формы `| — | | |`. */
function tableRows(text) {
  return text
    .split('\n')
    .filter((l) => /^\s*\|/.test(l))
    // `\b` после кириллицы НЕ работает: в JS граница слова определена по ASCII, и
    // «Направление |» её не даёт. Шапка отсекается по следующей трубе, а не по границе.
    .filter((l) => !/^\s*\|\s*(Направление|Сервис|Роль|Что умеет|Слой|Возможность|Задача|Топик|Что хранится|Роут|Вызов)\s*\|/i.test(l))
    .filter((l) => !/^\s*\|[-:\s|]+\|\s*$/.test(l))
    .filter((l) => l.replace(/[|\s—-]/g, '').length > 0);
}

/** Число ключей секции независимо от формы: блоки, иначе строки таблицы. */
function keyCount(text) {
  const b = blocks(text).length;
  return b > 0 ? b : tableRows(text).length;
}

/**
 * Тело блока, чей заголовок содержит подстроку. Пусто, если такого блока нет.
 *
 * Сравнение БЕЗ регистра, и это не мелочь: прогон назвал задачу по имени класса
 * (`SyncMeterCatalogJob`), точное вхождение `syncMeterCatalog` не сработало, и грейдер
 * объявил ключ потерянным там, где он на месте. Имя задачи в коде пишется по-разному —
 * функция, класс, ключ конфига, — и ключом остаётся то же самое.
 */
function block(text, needle) {
  const lines = text.split('\n');
  const n = needle.toLowerCase();
  const start = lines.findIndex((l) => /^### /.test(l) && l.toLowerCase().includes(n));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^### /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// --- якоря -------------------------------------------------------------------
// Каждый — альтернативы написания ОДНОГО факта: грейдим факт, а не формулировку.

const EVENT_ANCHORS = [
  ['T1 поля тела accepted', /takenAt/],
  ['T2 ключ партиции', /партиц|partitionKey/i],
  ['T3 после коммита, возможен дубль', /дубл|после\s+коммит/i],
  ['T4 enum reason', /out_of_range|meter_sealed/],
  ['T5 отклонённое не сохраняется', /в базу не пиш|не сохран|пары[^\n]*не буд/i],
  ['T6 closed шлётся один раз', /один раз|повторн[^\n]*не да[ёе]т|\b409\b/i],
  ['T7 группа консьюмера', /metering-billing/],
  ['T8 ручной коммит offset', /offset|коммит[^\n]*(ручн|после)|ручн[^\n]*коммит/i],
  ['T9 идемпотентность по invoiceId', /upsert|invoiceId/i],
  ['T10 читаются только два поля', /игнорир|только\s+`?accountId/i],
  ['T11 три ретрая, DLQ нет', /\b3\b[^\n]*(ретра|попыт)|тр[ёе]х[^\n]*попыт|DLQ|отбрасыв/i],
];

const JOB_ANCHORS = [
  ['J1 cron 0 2 1 * *', /0\s+2\s+1\s+\*\s+\*/],
  ['J2 пачками по 1000', /\b1000\b/],
  ['J3 пропущенный не догоняется', /не\s+догон|не\s+наверст|пропущенн/i],
  ['J4 cron 30 3 * * *', /30\s+3\s+\*\s+\*\s+\*/],
  ['J5 задача публикует событие', /metering\.account\.closed/],
];

const REST_ANCHORS = [
  ['R1 выдача без досчитанных', /submitted|досчитанн|origin/i],
  ['R2 повтор за период 409', /\b409\b/],
];

const POISON = [/auth\.session\.revoked/, /user\.blocked/, /expireSessions/, /purgeAudit/, /\/v1\/sessions/, /AuditEntry/];

// --- грейд --------------------------------------------------------------------

function gradeCards(meter, billing) {
  const r = {};
  const contract = section(meter, 'Публичный контракт');
  const events = section(meter, 'События');
  const jobs = section(meter, 'Фоновые задачи');
  const owns = section(meter, 'Владеет данными');

  // SM-68 — полнота классов ключей
  r.endpoints = keyCount(contract);
  r.topics = keyCount(events);
  r.jobs = jobs ? keyCount(jobs) : 0;
  r.entities = keyCount(owns);
  r.hasJobsSection = jobs !== '';

  // SM-69 / SM-70 / SM-73 — плотность, каждый якорь внутри своей секции
  r.eventHits = EVENT_ANCHORS.filter(([, re]) => re.test(events));
  r.jobHits = JOB_ANCHORS.filter(([, re]) => re.test(jobs));
  r.restHits = REST_ANCHORS.filter(([, re]) => re.test(contract));
  if (/estimated/.test(owns)) r.restHits = r.restHits.concat([['R3 origin=estimated', /x/]]);

  // SM-72 — задача без расписания: три исхода, а не два. Средний реален: факт назван
  // своими словами, литерала `не определено` нет, cron не выдуман.
  const sync = block(jobs, 'syncMeterCatalog') || block(jobs, 'sync');
  r.syncPresent = sync !== '';
  r.syncUndefined = /не определено/i.test(sync);
  // `\w` в JS не покрывает кириллицу: `внешн\w*\s+планировщик` не совпадает с «внешним
  // планировщиком» — тот же класс ошибки, что `\b` после кириллицы. Поймано на пуле:
  // прогон написал факт своими словами, а грейдер сказал «про расписание не сказано ничего».
  r.syncOutside = /вне\s+репозитор|внешн[а-яё]*\s+планировщик|в другом репозитории|инфраструктурн|не\s+в\s+коде/i.test(sync);
  r.syncInvented = /\d+\s+\d+\s+[\d*]+\s+[\d*]+\s+[\d*]+/.test(sync);
  r.v72 = !r.syncPresent
    ? 'КРАСНО: ключ потерян'
    : r.syncInvented
      ? 'КРАСНО: cron выдуман'
      : r.syncUndefined
        ? 'зелено: `не определено`'
        : r.syncOutside
          ? 'частично: факт своими словами, литерала «не определено» нет'
          : 'КРАСНО: про расписание не сказано ничего';

  // SM-79 — у сервиса без задач секция выходит ПУСТОЙ ФОРМОЙ, а не исчезает
  const bjobs = section(billing, 'Фоновые задачи');
  r.bHasJobsSection = billing !== '' && bjobs !== '';
  r.bJobsEmptyForm = r.bHasJobsSection && keyCount(bjobs) === 0 && !/задач нет|нет задач|отсутств/i.test(bjobs);
  r.bEndpoints = keyCount(section(billing, 'Публичный контракт'));
  r.bTopics = keyCount(section(billing, 'События'));

  r.poison = POISON.filter((re) => re.test(meter) || re.test(billing)).map(String);
  return r;
}

function report(name, meter, billing) {
  console.log(`== ${name}`);
  if (!meter) {
    console.log('   карточки metering-api нет — НЕ ИЗМЕРЕНО (прогон не дошёл до Шага 4)');
    return null;
  }
  const r = gradeCards(meter, billing || '');
  const ok = (c) => (c ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFAIL\x1b[0m');
  console.log(`   SM-68 ключи: эндпоинтов ${r.endpoints}/8, топиков ${r.topics}/5, задач ${r.jobs}/3, сущностей ${r.entities}/3`);
  console.log(`         ${ok(r.endpoints === 8)} эндпоинты   ${ok(r.topics === 5)} топики   ${ok(r.jobs === 3)} задачи   ${ok(r.entities === 3)} сущности`);
  console.log(`         секция «Фоновые задачи» ${r.hasJobsSection ? 'есть' : 'ОТСУТСТВУЕТ'}`);
  console.log(`   SM-69 факты событий: ${r.eventHits.length}/11 — ${r.eventHits.map(([n]) => n.split(' ')[0]).join(' ') || '—'}`);
  console.log(`   SM-70 факты задач:   ${r.jobHits.length}/5 — ${r.jobHits.map(([n]) => n.split(' ')[0]).join(' ') || '—'}`);
  console.log(`   SM-73 REST-контроль: ${r.restHits.length}/3`);
  console.log(`   SM-72 syncMeterCatalog: ${r.v72}`);
  if (billing) {
    console.log(`   SM-79 billing-worker: эндпоинтов ${r.bEndpoints}/2, топиков ${r.bTopics}/3, секция задач ${r.bHasJobsSection ? 'есть' : 'ОТСУТСТВУЕТ'}, пустая форма ${r.bJobsEmptyForm ? 'да' : 'нет'}`);
  } else {
    console.log('   SM-79 карточки billing-worker нет — не измерено');
  }
  if (r.poison.length) console.log(`   \x1b[31mЗАРАЖЕНИЕ примером из шаблона: ${r.poison.join(', ')}\x1b[0m`);
  return r;
}

// --- самопроверка на заведомо известных результатах ---------------------------

const GOOD = `## Публичный контракт
### \`GET /api/readings\`
Список показаний.
- выдача не включает досчитанные: origin = submitted
### \`POST /api/readings\`
Приём показания.
- повтор за период — \`409\`, reason duplicate
### \`GET /api/readings/{id}\`
Одно показание.
### \`GET /api/accounts\`
Список счетов.
### \`GET /api/accounts/{id}/history\`
История.
### \`POST /api/accounts/{id}/close\`
Закрытие счёта.
### \`GET /healthz\`
Живость.
### \`GET /api/version\`
Версия сборки.

## События
### потребляет \`billing.invoice.issued\`
Начисление выставлено.
- группа metering-billing, offset коммитится вручную после записи
- повтор безопасен: upsert по invoiceId
### потребляет \`crm.account.renamed\`
Абонента переименовали.
- читаются только accountId и name, прочие поля игнорируются
- 3 попытки, потом отбрасывается, DLQ нет
### публикует \`metering.account.closed\`
Счёт закрыт.
- шлётся один раз: повторное закрытие даёт 409 и события не даёт
### публикует \`metering.reading.accepted\`
Показание принято.
- тело: accountId, value, takenAt, source
- ключ партиции accountId
- шлётся после коммита, при ретрае возможен дубль
### публикует \`metering.reading.rejected\`
Показание отклонено.
- reason: out_of_range | duplicate | meter_sealed
- отклонённое в базу не пишется

## Фоновые задачи
### \`closeStaleAccounts\`
Закрытие спящих счетов.
- расписание 30 3 * * *
- публикует metering.account.closed
### \`estimateMissingReadings\`
Досчёт показаний.
- расписание 0 2 1 * *
- пачками по 1000
- пропущенный прогон не догоняется
### \`syncMeterCatalog\`
Синхронизация справочника приборов.
- не определено: расписание задаётся вне репозитория

## Владеет данными
### \`Account\`
- status: active | suspended | closed
### \`Reading\`
- origin: submitted | estimated — estimated значит досчитано задачей
### \`Meter\`
- verifiedAt: null у снятых с учёта
`;

const BILLING_GOOD = `## Публичный контракт
### \`GET /healthz\`
Живость.
### \`GET /api/queue-depth\`
Глубина очереди.

## События
### потребляет \`metering.account.closed\`
Счёт закрыт.
### потребляет \`metering.reading.accepted\`
Показание принято.
### публикует \`billing.invoice.issued\`
Начисление выставлено.

## Фоновые задачи
—

## Роли и доступ
| Роль | Что может |
|---|---|
| — | |
`;

const EMPTY = `## Публичный контракт
### \`GET /api/readings\`
Список показаний.
### \`POST /api/readings\`
Приём показания.

## События
| Направление | Топик | Когда |
|---|---|---|
| публикует | \`metering.reading.accepted\` | показание принято |
| потребляет | \`billing.invoice.issued\` | начисление выставлено |

## Владеет данными
### \`Account\`
Лицевой счёт.
`;

// Два исхода SM-72, которых не было в первой самопроверке и которые пул выдал сразу оба:
// задача названа по имени класса, и расписание описано своими словами без литерала.
const SYNC_VARIANTS = `## Фоновые задачи
### \`SyncMeterCatalogJob\`
Синхронизация справочника приборов.
- расписание: НЕ в коде — дёргается внешним планировщиком по HTTP-хуку (инфра-репозиторий)
`;

if (selftest) {
  console.log('САМОПРОВЕРКА ГРЕЙДЕРА — два заведомо известных результата\n');
  const g = report('заведомо полная карточка (ожидание: 8/5/3/3, 11/11, 5/5, 3/3)', GOOD, BILLING_GOOD);
  console.log();
  const e = report('заведомо пустая карточка старой формы (2 эндпоинта, 2 топика строками, задач нет)', EMPTY, '');
  console.log();
  const checks = [
    ['полная: 8 эндпоинтов', g.endpoints === 8],
    ['полная: 5 топиков', g.topics === 5],
    ['полная: 3 задачи', g.jobs === 3],
    ['полная: 3 сущности', g.entities === 3],
    ['полная: 11/11 фактов событий', g.eventHits.length === 11],
    ['полная: 5/5 фактов задач', g.jobHits.length === 5],
    ['полная: 3/3 REST', g.restHits.length === 3],
    ['полная: sync без выдуманного cron', g.syncInvented === false && g.syncUndefined === true],
    ['полная: заражения нет', g.poison.length === 0],
    ['полная: billing 2 эндпоинта, 3 топика', g.bEndpoints === 2 && g.bTopics === 3],
    ['полная: у billing секция задач есть и пуста по форме', g.bJobsEmptyForm === true],
    ['пустая: секции задач нет', e.hasJobsSection === false],
    ['пустая: топики посчитаны строками таблицы (2)', e.topics === 2],
    ['пустая: 0 фактов задач', e.jobHits.length === 0],
    ['пустая: 0 фактов событий', e.eventHits.length === 0],
    ['вариант: имя класса `SyncMeterCatalogJob` опознано как ключ', gradeCards(SYNC_VARIANTS, '').syncPresent === true],
    ['вариант: расписание своими словами = «частично», не «красно»', gradeCards(SYNC_VARIANTS, '').v72.startsWith('частично')],
  ];
  let bad = 0;
  for (const [n, v] of checks) {
    console.log(`  ${v ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${n}`);
    if (!v) bad++;
  }
  console.log(`\nсамопроверка: ${checks.length - bad}/${checks.length}`);
  process.exit(bad ? 1 : 0);
}

if (!runsDir) {
  console.error('нужен путь к папке песочниц (или --selftest)');
  process.exit(1);
}

const sandboxes = readdirSync(runsDir).filter((f) => /^async(-before)?-\d+$/.test(f)).sort();
if (!sandboxes.length) console.log('песочниц не найдено');

const tally = { after: [], before: [] };
for (const sb of sandboxes) {
  const dir = join(runsDir, sb);
  if (!isDir(dir)) continue;
  const S = join(dir, 'w', 'specs', 'services');
  const r = report(sb, read(join(S, 'metering-api.md')), read(join(S, 'billing-worker.md')));
  if (r) tally[sb.startsWith('async-before') ? 'before' : 'after'].push(r);
  console.log();
}

const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—');
for (const [k, label] of [['before', 'ДО правки'], ['after', 'ПОСЛЕ правки']]) {
  const rs = tally[k];
  const total = sandboxes.filter((s) => (k === 'before' ? s.startsWith('async-before') : !s.startsWith('async-before'))).length;
  if (!total) continue;
  console.log(`ИТОГО ${label}: измерено ${rs.length} из ${total} прогонов`);
  if (!rs.length) continue;
  console.log(`  события   ${avg(rs.map((r) => r.eventHits.length))}/11`);
  console.log(`  задачи    ${avg(rs.map((r) => r.jobHits.length))}/5`);
  console.log(`  REST      ${avg(rs.map((r) => r.restHits.length))}/3`);
  console.log(`  ключи целиком сошлись у ${rs.filter((r) => r.endpoints === 8 && r.topics === 5 && r.jobs === 3 && r.entities === 3).length} из ${rs.length}`);
  console.log(`  SM-72 зелёных ${rs.filter((r) => r.v72.startsWith('зелено')).length}, частичных ${rs.filter((r) => r.v72.startsWith('частично')).length}, красных ${rs.filter((r) => r.v72.startsWith('КРАСНО')).length}`);
  console.log(`  SM-79 пустая форма у billing: ${rs.filter((r) => r.bJobsEmptyForm).length} из ${rs.length}`);
  console.log(`  заражений: ${rs.filter((r) => r.poison.length).length}`);
  console.log();
}
