// grade-gql.mjs — грейд раунда «GraphQL: маршрут один, операций одиннадцать», фикстура SM-GQL.
//
//   node agent-version-5.0/_skill-eval/grade-gql.mjs <папка-песочниц>
//   node agent-version-5.0/_skill-eval/grade-gql.mjs --selftest
//
// Грейдится ДИСК: карточки `services/*.md` в песочнице, а не текст ответа агента.
//
// Правила те же, что у grade-async.mjs, и нарушение каждого уже портило замер:
//
//  1. НЕТ КАРТОЧКИ — НЕ «КРАСНОЕ», А «НЕ ИЗМЕРЕНО».
//  2. ЯКОРЬ ИЩЕТСЯ ВНУТРИ СВОЕЙ СЕКЦИИ (секции режутся по `^## `).
//  3. РЕГУЛЯРКИ — ЛИТЕРАЛАМИ, а не собранные из строк.
//  4. ЗАПУСКАТЬ ТОЛЬКО ПОСЛЕ ЗАВЕРШЕНИЯ ВСЕХ ПРОГОНОВ.
//
// Что здесь меряется сверх обычного: СХЛОПЫВАНИЕ. Карточка с одним блоком `POST /graphql`
// проходит все одиннадцать проверок Шага 4 и гард на утоньшение — числа в ней сходятся сами
// с собой. Поймать её можно только снаружи, зная настоящий инвентарь фикстуры.
//
// Проба `gql-before` гоняет тот же материал на скилле ДО правки 2026-08-13. Схлопнутый
// контракт там — ожидаемый результат, а не провал грейдера: это база сравнения.
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

const blocks = (text) => text.split('\n').filter((l) => /^### /.test(l));

/** Строки данных таблицы: без шапки, разделителя и пустой формы `| — | | |`. */
function tableRows(text) {
  return text
    .split('\n')
    .filter((l) => /^\s*\|/.test(l))
    // `\b` после кириллицы в JS не работает (граница слова определена по ASCII):
    // шапка отсекается по следующей трубе, а не по границе слова.
    .filter((l) => !/^\s*\|\s*(Сервис|Вызов|Роль|Что умеет|Возможность|Слой|Роут|Экран|Что хранится|Направление|Задача|Топик)\s*\|/i.test(l))
    .filter((l) => !/^\s*\|[-:\s|]+\|\s*$/.test(l))
    .filter((l) => l.replace(/[|\s—-]/g, '').length > 0);
}

/** Число ключей секции независимо от формы: блоки, иначе строки таблицы. */
function keyCount(text) {
  const b = blocks(text).length;
  return b > 0 ? b : tableRows(text).length;
}

// --- инвентарь фикстуры -------------------------------------------------------

// 11 операций. Имя ищется без регистра и без привязки к тому, как прогон оформил
// заголовок: `### query appointments`, `### \`appointments\``, `### Query.appointments`
// — это один и тот же ключ, и придираться к оформлению здесь нельзя.
const OPERATIONS = [
  'appointments', 'appointment', 'pets', 'vaccinationCard', 'clinics',
  'bookAppointment', 'cancelAppointment', 'registerPet', 'recordVaccination', 'transferPet',
  'appointmentStatusChanged',
];

// 8 из 11 вызывает фронт; три остальных в зеркале — выдумка.
const CONSUMED = [
  'appointments', 'appointment', 'pets', 'vaccinationCard', 'clinics',
  'bookAppointment', 'cancelAppointment', 'appointmentStatusChanged',
];
const NOT_CONSUMED = ['registerPet', 'recordVaccination', 'transferPet'];

/**
 * Сколько имён списка встречается в заголовках блоков.
 *
 * `appointment` — подстрока `appointments` и `appointmentStatusChanged`, поэтому
 * совпадение считается по ЦЕЛОМУ имени: соседние символы не должны быть буквами.
 * Без этого карточка с одним блоком `appointments` давала бы три ключа из одного.
 */
function namesIn(headers, names) {
  const hit = [];
  for (const n of names) {
    const re = new RegExp(`(^|[^A-Za-z])${n}([^A-Za-z]|$)`, 'i');
    if (headers.some((h) => re.test(h))) hit.push(n);
  }
  return hit;
}

// --- якоря --------------------------------------------------------------------
// Каждый — альтернативы написания ОДНОГО факта: грейдим факт, а не формулировку.

const OP_ANCHORS = [
  ['G1 выдача без отменённых', /отмен[её]нн[а-яё]*[^\n]*(не\s+(попада|отда|включ|вход)|исключ)|(не\s+(попада|отда|включ|вход)|исключ)[^\n]*отмен|status\s*<>\s*'?cancelled/i],
  ['G2 идемпотентность по ключу', /idempotencyKey|идемпотент/i],
  ['G3 SLOT_TAKEN', /SLOT_TAKEN/i],
  ['G4 окно отмены 2 часа', /TOO_LATE|дв[аух][^\n]*час|\b2\s*час/i],
  ['G5 weightKg null = не взвешивали', /weightKg[^\n]*(null|не\s+взвеш)|(null|не\s+взвеш)[^\n]*weightKg/i],
  ['G6 карта прививок за 3 года', /\b3\s*(года|лет)|тр[её]х\s*лет|VACCINATION_WINDOW/i],
  ['G7 transferPet гасит будущие приёмы', /будущ[а-яё]*\s+при[её]м|owner_transfer/i],
  ['G8 уникальность чипа', /CHIP_TAKEN|uq_pets_chip_id|чип[^\n]*уникал|уникал[^\n]*чип/i],
  ['G9 подписка фильтруется на сервере', /сво[её]й\s+клиник|фильтр[^\n]*клиник|клиник[^\n]*сервер/i],
  ['G10 питомец без чипа допустим', /без\s+чипа|частичн[а-яё]*\s+индекс|chip_id\s+IS\s+NOT\s+NULL/i],
];

const TOPIC_ANCHORS = [
  ['T1 тело события', /vaccineCode/i],
  ['T2 после коммита, возможен дубль', /дубл|после\s+коммит/i],
  ['T3 читаются только два поля', /игнорир|только[^\n]*(owner|владельц)/i],
  ['T4 ack после записи, идемпотентно', /ack|подтвержд[^\n]*посл|повтор\s+безопас|идемпотент/i],
];

const JOB_ANCHORS = [
  ['J1 cron 0 4 * * *', /0\s+4\s+\*\s+\*\s+\*/],
  ['J2 180 дней, пачками 500', /\b180\b|\b500\b/],
  ['J3 пропущенный не догоняется', /не\s+догон|не\s+наверст|пропущенн/i],
];

const WEB_ANCHORS = [
  ['W1 кэш карты прививок 5 минут', /5\s*мин|300/i],
  ['W2 idempotencyKey с клиента', /idempotencyKey|uuid/i],
  ['W3 фильтры переживают переход', /переж|между\s+экран|сохраня[^\n]*переход/i],
];

// Заражение: имена из примеров скилла и из правки шаблона 2026-08-13.
const POISON = [
  /auth\.session\.revoked/, /user\.blocked/, /expireSessions/, /purgeAudit/,
  /\/v1\/sessions/, /AuditEntry/, /ЧОП/, /ГБР/,
  /shipments/i, /createCarrier/i, /incidentUpdated/i, /IncidentService/i, /createInvoice/i,
];

// Точные номера версий из package.json и pyproject.toml — в «Стек» они идти не должны.
const VERSIONS = [/18\.3\.1/, /0\.235\.0/, /3\.10\.4/, /16\.8\.1/, /2\.0\.30/, /0\.111\.0/];

// --- грейд --------------------------------------------------------------------

function gradeApi(card) {
  const r = {};
  const contract = section(card, 'Публичный контракт');
  const events = section(card, 'События');
  const jobs = section(card, 'Фоновые задачи');
  const owns = section(card, 'Владеет данными');
  const consumers = section(card, 'Кто меня потребляет');
  const heads = blocks(contract);

  // SM-80 — схлопывание. Главное число раунда.
  r.contractBlocks = heads.length;
  r.opsFound = namesIn(heads, OPERATIONS);
  r.transportBlock = heads.some((h) => /\/graphql/i.test(h));
  r.healthz = heads.some((h) => /healthz/i.test(h));
  r.version = heads.some((h) => /version/i.test(h));
  r.v80 = r.opsFound.length === OPERATIONS.length && r.contractBlocks === 13 && !r.transportBlock
    ? 'зелено: 13 блоков, 11 операций поимённо'
    : r.opsFound.length <= 1
      ? `КРАСНО: схлопнуто — блоков ${r.contractBlocks}, операций ${r.opsFound.length}`
      : `частично: блоков ${r.contractBlocks}/13, операций ${r.opsFound.length}/11` +
        (r.transportBlock ? ', транспорт отдельным блоком' : '');

  // SM-81 — плотность операций
  r.opHits = OP_ANCHORS.filter(([, re]) => re.test(contract));

  // SM-82 — остальные классы ключей не съедены правкой
  r.topics = keyCount(events);
  r.jobs = jobs ? keyCount(jobs) : 0;
  r.entities = keyCount(owns);
  r.topicHits = TOPIC_ANCHORS.filter(([, re]) => re.test(events));
  r.jobHits = JOB_ANCHORS.filter(([, re]) => re.test(jobs));

  // SM-84 — зеркало: 8 строк, и ровно те операции, что вызывает фронт
  r.mirrorRows = keyCount(consumers);
  r.mirrorOps = namesIn(consumers.split('\n'), CONSUMED);
  r.mirrorInvented = namesIn(consumers.split('\n'), NOT_CONSUMED);
  r.mirrorTransport = /\/graphql/i.test(consumers);

  r.poison = POISON.filter((re) => re.test(card)).map(String);
  r.versions = VERSIONS.filter((re) => re.test(section(card, 'Стек'))).map(String);
  return r;
}

function gradeWeb(card) {
  const r = {};
  const consumed = section(card, 'Потребляемые API');
  const screens = section(card, 'Экраны');
  const state = section(card, 'Состояние и данные');
  const roles = section(card, 'Роли и доступ');
  const rows = tableRows(consumed);

  // SM-83 — вызов это операция, а не транспорт
  r.consumedRows = rows.length;
  r.consumedOps = namesIn(rows, CONSUMED);
  r.consumedTransport = rows.some((l) => /\/graphql/i.test(l));
  r.v83 = r.consumedOps.length === CONSUMED.length && !r.consumedTransport
    ? 'зелено: 8 строк-операций'
    : r.consumedOps.length <= 1
      ? `КРАСНО: схлопнуто — строк ${r.consumedRows}, операций ${r.consumedOps.length}`
      : `частично: операций ${r.consumedOps.length}/8` + (r.consumedTransport ? ', есть строка с /graphql' : '');

  r.screens = keyCount(screens);
  r.state = keyCount(state);
  r.webHits = WEB_ANCHORS.filter(([, re]) => re.test(card));

  // SM-85 — у фронта ролей нет.
  //
  // Пустот ДВЕ, и обе законны (правило «два вида пустоты» в card.template.md): голая форма
  // `| — | | |` и строка `| — | не определено: <где это на самом деле> |`. Вторая ДОРОЖЕ
  // первой — она говорит следующему автору спеки, где искать, — и грейдер, считающий её
  // непустой, штрафует за лучший ответ. Ровно этот ложный красный вылез на пилоте: прогон
  // написал «не определено: контроль доступа реализован в vetcare-api».
  //
  // Красных исходов три: секции нет вовсе; вместо формы фраза «ролей нет»; роли выдуманы.
  // Фраза ловится НЕ перечнем её написаний, а требованием таблицы: «ролей нет», «Ролей у
  // фронта нет», «секция неприменима» — вариантов бесконечно, и regexp по ним всегда отстаёт
  // (самопроверка поймала это сразу: `ролей нет` не совпало с «Ролей у фронта нет»).
  // Пустая форма обязана оставаться ТАБЛИЦЕЙ — по ней следующий скан сверяет ключи.
  r.hasRoles = roles !== '';
  const roleRows = tableRows(roles);
  r.rolesHasTable = /^\s*\|/m.test(roles);
  r.rolesInvented = /\badmin\b|\buser\b|\bvet\b|receptionist|\bowner\b/i.test(roles);
  r.rolesUndefined = roleRows.length === 1 && /не\s+определено/i.test(roles);
  r.rolesEmptyForm =
    r.hasRoles &&
    r.rolesHasTable &&
    !r.rolesInvented &&
    (roleRows.length === 0 || r.rolesUndefined);

  // Секций чужого типа у фронта быть не должно
  r.alienSections = ['Публичный контракт', 'События', 'Фоновые задачи', 'Владеет данными']
    .filter((s) => section(card, s) !== '');

  r.poison = POISON.filter((re) => re.test(card)).map(String);
  return r;
}

function report(name, api, web) {
  console.log(`== ${name}`);
  if (!api) {
    console.log('   карточки vetcare-api нет — НЕ ИЗМЕРЕНО (прогон не дошёл до Шага 4)');
    return null;
  }
  const a = gradeApi(api);
  const ok = (c) => (c ? '\x1b[32mOK  \x1b[0m' : '\x1b[31mFAIL\x1b[0m');
  console.log(`   SM-80 контракт: ${a.v80}`);
  console.log(`         блоков ${a.contractBlocks}/13, операций ${a.opsFound.length}/11, ` +
    `служебные: healthz ${a.healthz ? 'есть' : 'НЕТ'}, version ${a.version ? 'есть' : 'НЕТ'}, ` +
    `транспорт блоком: ${a.transportBlock ? 'ДА (красно)' : 'нет'}`);
  if (a.opsFound.length < OPERATIONS.length) {
    console.log(`         не доехали: ${OPERATIONS.filter((o) => !a.opsFound.includes(o)).join(', ')}`);
  }
  console.log(`   SM-81 плотность операций: ${a.opHits.length}/10 — ${a.opHits.map(([n]) => n.split(' ')[0]).join(' ') || '—'}`);
  console.log(`   SM-82 прочие классы: топиков ${a.topics}/2, задач ${a.jobs}/1, сущностей ${a.entities}/4; ` +
    `факты топиков ${a.topicHits.length}/4, задачи ${a.jobHits.length}/3`);
  console.log(`         ${ok(a.topics === 2)} топики   ${ok(a.jobs === 1)} задачи   ${ok(a.entities === 4)} сущности`);
  console.log(`   SM-84 зеркало: строк ${a.mirrorRows}/8, операций ${a.mirrorOps.length}/8` +
    (a.mirrorInvented.length ? `, \x1b[31mвыдумано ${a.mirrorInvented.join(', ')}\x1b[0m` : '') +
    (a.mirrorTransport ? ', \x1b[31mстрока с /graphql\x1b[0m' : ''));
  if (a.versions.length) console.log(`   \x1b[31mВЕРСИИ в «Стеке»: ${a.versions.join(', ')}\x1b[0m`);

  let w = null;
  if (web) {
    w = gradeWeb(web);
    console.log(`   SM-83 фронт: ${w.v83}`);
    console.log(`         экранов ${w.screens}/4, состояние ${w.state}/2, факты фронта ${w.webHits.length}/3`);
    console.log(`         роли: секция ${w.hasRoles ? 'есть' : 'ОТСУТСТВУЕТ'}, пустота ` +
      `${w.rolesEmptyForm ? (w.rolesUndefined ? 'да (не определено)' : 'да (голая форма)') : 'НЕТ'}` +
      (w.rolesInvented ? ' \x1b[31mроли выдуманы\x1b[0m' : '') +
      (w.alienSections.length ? `, \x1b[31mсекции чужого типа: ${w.alienSections.join(', ')}\x1b[0m` : ''));
  } else {
    console.log('   SM-83 карточки vetcare-web нет — не измерено');
  }

  const poison = [...new Set([...a.poison, ...(w ? w.poison : [])])];
  if (poison.length) console.log(`   \x1b[31mЗАРАЖЕНИЕ примером из шаблона: ${poison.join(', ')}\x1b[0m`);
  return { a, w };
}

// --- самопроверка на заведомо известных результатах ---------------------------

const API_GOOD = `## Публичный контракт

### \`query appointments\`
Приёмы клиники за период.
- отменённые в выдачу не попадают: \`status <> 'cancelled'\`
### \`query appointment\`
Один приём по идентификатору.
### \`query pets\`
Питомцы владельца.
- \`weightKg\` — \`null\` значит «не взвешивали», а не ноль
### \`query vaccinationCard\`
Карта прививок питомца.
- отдаётся только за последние 3 года, старшее — в архивном сервисе клиники
### \`query clinics\`
Справочник клиник сети.
### \`mutation bookAppointment\`
Запись питомца на приём.
- идемпотентна по \`idempotencyKey\`, ключ живёт 24 часа
- занятый слот — код \`SLOT_TAKEN\`
### \`mutation cancelAppointment\`
Отмена приёма.
- позже чем за 2 часа до слота — \`TOO_LATE\`
### \`mutation registerPet\`
Постановка питомца на учёт.
- повтор чипа — \`CHIP_TAKEN\`, уникальность держит индекс \`uq_pets_chip_id\`
- питомец без чипа допустим: индекс частичный
### \`mutation recordVaccination\`
Запись факта вакцинации.
### \`mutation transferPet\`
Передача питомца другому владельцу.
- все будущие приёмы отменяются с причиной \`owner_transfer\`
### \`subscription appointmentStatusChanged\`
Поток смен статуса приёма.
- события приходят только по своей клинике, фильтр стоит на сервере
### \`GET /healthz\`
Проверка живости.
### \`GET /version\`
Версия сборки.

## События

### потребляет \`crm.owner.merged\`
Слияние владельцев в CRM.
- читаются только два поля, остальные игнорируются
- ack вручную после записи в базу, повтор безопасен
### публикует \`vet.vaccination.recorded\`
Прививка записана.
- тело: petId, vaccineCode, doneAt, clinicId
- шлётся после коммита отдельным вызовом: при ретрае возможен дубль

## Фоновые задачи

### \`purgeCancelledAppointments\`
Чистка отменённых приёмов.
- расписание 0 4 * * *
- удаляет отменённые старше 180 дней пачками по 500
- пропущенный прогон не догоняется

## Владеет данными

### \`Appointment\`
Приём.
### \`Pet\`
Питомец.
### \`Vaccination\`
Прививка.
### \`Clinic\`
Клиника сети.

## Кто меня потребляет
| Сервис | Что вызывает | Зачем |
|---|---|---|
| \`vetcare-web\` | \`query appointments\` | расписание клиники |
| \`vetcare-web\` | \`query appointment\` | карточка приёма |
| \`vetcare-web\` | \`query pets\` | карточка питомца |
| \`vetcare-web\` | \`query vaccinationCard\` | карта прививок |
| \`vetcare-web\` | \`query clinics\` | выбор клиники |
| \`vetcare-web\` | \`mutation bookAppointment\` | запись на приём |
| \`vetcare-web\` | \`mutation cancelAppointment\` | отмена приёма |
| \`vetcare-web\` | \`subscription appointmentStatusChanged\` | живой список статусов |

## Стек
| Слой | Чем |
|---|---|
| Язык и фреймворк | Python, FastAPI, Strawberry |
`;

const API_COLLAPSED = `## Публичный контракт

### \`POST /graphql\`
Единая точка GraphQL: запросы и мутации по питомцам, приёмам и прививкам.
- ошибки: стандартные ответы фреймворка
### \`GET /healthz\`
Проверка живости.
### \`GET /version\`
Версия сборки.

## События

### потребляет \`crm.owner.merged\`
Слияние владельцев.
### публикует \`vet.vaccination.recorded\`
Прививка записана.

## Фоновые задачи

### \`purgeCancelledAppointments\`
Чистка отменённых приёмов.

## Владеет данными

### \`Appointment\`
Приём.
### \`Pet\`
Питомец.
### \`Vaccination\`
Прививка.
### \`Clinic\`
Клиника сети.

## Кто меня потребляет
| Сервис | Что вызывает | Зачем |
|---|---|---|
| \`vetcare-web\` | \`POST /graphql\` | все данные приложения |

## Стек
| Слой | Чем |
|---|---|
| Язык и фреймворк | Python 3.11, FastAPI 0.111.0, Strawberry |
`;

const WEB_GOOD = `## Экраны
| Роут | Экран | Что делает пользователь |
|---|---|---|
| \`/appointments\` | Расписание | фильтрует и открывает приём |
| \`/appointments/:id\` | Карточка приёма | отменяет и переносит |
| \`/clinics\` | Справочник клиник | выбирает клинику |
| \`/pets/:id\` | Карточка питомца | смотрит прививки |

## Потребляемые API
| Сервис | Вызов | Зачем |
|---|---|---|
| \`vetcare-api\` | \`query appointments\` | расписание клиники |
| \`vetcare-api\` | \`query appointment\` | карточка приёма |
| \`vetcare-api\` | \`query pets\` | питомцы владельца |
| \`vetcare-api\` | \`query vaccinationCard\` | карта прививок |
| \`vetcare-api\` | \`query clinics\` | выбор клиники |
| \`vetcare-api\` | \`mutation bookAppointment\` | запись на приём; ключ идемпотентности (uuid) генерится на клиенте и переживает ретрай сети |
| \`vetcare-api\` | \`mutation cancelAppointment\` | отмена приёма |
| \`vetcare-api\` | \`subscription appointmentStatusChanged\` | живые статусы в списке |

## Состояние и данные
| Что хранится | Где | Зачем |
|---|---|---|
| фильтры расписания | стор в памяти | переживают переход между экранами |
| карта прививок | кэш запросов, 5 минут | не дёргать сервер на каждом приёме |

## Роли и доступ
| Роль | Что может |
|---|---|
| — | |
`;

const WEB_COLLAPSED = `## Экраны
| Роут | Экран | Что делает пользователь |
|---|---|---|
| \`/appointments\` | Расписание | фильтрует и открывает приём |
| \`/appointments/:id\` | Карточка приёма | отменяет и переносит |
| \`/clinics\` | Справочник клиник | выбирает клинику |
| \`/pets/:id\` | Карточка питомца | смотрит прививки |

## Потребляемые API
| Сервис | Вызов | Зачем |
|---|---|---|
| \`vetcare-api\` | \`POST /graphql\` | все данные приложения |

## Состояние и данные
| Что хранится | Где | Зачем |
|---|---|---|
| фильтры расписания | стор в памяти | переживают переход между экранами |
| карта прививок | кэш запросов, 5 минут | не дёргать сервер на каждом приёме |
`;

// Три варианта секции «Роли и доступ» у фронта: законная вторая пустота, фраза и выдумка.
const WEB_ROLES_UNDEFINED = WEB_GOOD.replace(
  '| — | |',
  '| — | не определено: контроль доступа реализован в vetcare-api |'
);
const WEB_ROLES_PROSE = WEB_GOOD.replace(
  `| Роль | Что может |
|---|---|
| — | |`,
  'Ролей у фронта нет.'
);
const WEB_ROLES_INVENTED = WEB_GOOD.replace('| — | |', '| `admin` | всё |');

if (selftest) {
  console.log('САМОПРОВЕРКА ГРЕЙДЕРА — два заведомо известных результата\n');
  const g = report('заведомо полная карточка (ожидание: 13 блоков, 11 операций, зеркало 8)', API_GOOD, WEB_GOOD);
  console.log();
  const c = report('заведомо схлопнутая карточка (ожидание: КРАСНО, 1 операция, зеркало 1)', API_COLLAPSED, WEB_COLLAPSED);
  console.log();
  const checks = [
    ['полная: 13 блоков контракта', g.a.contractBlocks === 13],
    ['полная: 11 операций поимённо', g.a.opsFound.length === 11],
    ['полная: транспорт блоком НЕ выведен', g.a.transportBlock === false],
    ['полная: SM-80 зелёная', g.a.v80.startsWith('зелено')],
    ['полная: 10/10 фактов операций', g.a.opHits.length === 10],
    ['полная: 2 топика, 1 задача, 4 сущности', g.a.topics === 2 && g.a.jobs === 1 && g.a.entities === 4],
    ['полная: 4/4 факта топиков, 3/3 задачи', g.a.topicHits.length === 4 && g.a.jobHits.length === 3],
    ['полная: зеркало 8 строк и 8 операций', g.a.mirrorRows === 8 && g.a.mirrorOps.length === 8],
    ['полная: в зеркале нет невызываемых операций', g.a.mirrorInvented.length === 0],
    ['полная: фронт 8 строк-операций', g.w.consumedOps.length === 8 && g.w.v83.startsWith('зелено')],
    ['полная: 4 экрана, 2 строки состояния, 3/3 факта', g.w.screens === 4 && g.w.state === 2 && g.w.webHits.length === 3],
    ['полная: роли пустой формой', g.w.rolesEmptyForm === true],
    ['полная: секций чужого типа нет', g.w.alienSections.length === 0],
    ['полная: заражения нет', g.a.poison.length === 0 && g.w.poison.length === 0],
    ['полная: версий в «Стеке» нет', g.a.versions.length === 0],
    ['схлопнутая: SM-80 красная', c.a.v80.startsWith('КРАСНО')],
    ['схлопнутая: операций не больше одной', c.a.opsFound.length <= 1],
    ['схлопнутая: транспорт опознан блоком', c.a.transportBlock === true],
    ['схлопнутая: фактов операций 0', c.a.opHits.length === 0],
    ['схлопнутая: прочие классы целы (ключи не пострадали)', c.a.topics === 2 && c.a.jobs === 1 && c.a.entities === 4],
    ['схлопнутая: зеркало схлопнуто', c.a.mirrorRows === 1 && c.a.mirrorTransport === true],
    ['схлопнутая: фронт красный', c.w.v83.startsWith('КРАСНО')],
    ['схлопнутая: версии в «Стеке» пойманы', c.a.versions.length > 0],
    ['схлопнутая: экраны целы — правка не про них', c.w.screens === 4],
    // Два вида пустоты в «Ролях» — оба зелёные, фраза и выдумка — красные.
    // Случай с `не определено` пришёл с пилота: грейдер штрафовал за лучший ответ.
    ['вариант: роли «не определено» = пустота', gradeWeb(WEB_ROLES_UNDEFINED).rolesEmptyForm === true],
    ['вариант: фраза «ролей нет» = не пустота', gradeWeb(WEB_ROLES_PROSE).rolesEmptyForm === false],
    ['вариант: выдуманные роли = не пустота', gradeWeb(WEB_ROLES_INVENTED).rolesEmptyForm === false],
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

const sandboxes = readdirSync(runsDir).filter((f) => /^gql(-before)?-\d+$/.test(f)).sort();
if (!sandboxes.length) console.log('песочниц не найдено');

const tally = { after: [], before: [] };
for (const sb of sandboxes) {
  const dir = join(runsDir, sb);
  if (!isDir(dir)) continue;
  const S = join(dir, 'w', 'specs', 'services');
  const r = report(sb, read(join(S, 'vetcare-api.md')), read(join(S, 'vetcare-web.md')));
  if (r) tally[sb.startsWith('gql-before') ? 'before' : 'after'].push(r);
  console.log();
}

const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '—');
for (const [k, label] of [['before', 'ДО правки'], ['after', 'ПОСЛЕ правки']]) {
  const rs = tally[k];
  const total = sandboxes.filter((s) => (k === 'before' ? s.startsWith('gql-before') : !s.startsWith('gql-before'))).length;
  if (!total) continue;
  console.log(`ИТОГО ${label}: измерено ${rs.length} из ${total} прогонов`);
  if (!rs.length) continue;
  console.log(`  операций в контракте   ${avg(rs.map((r) => r.a.opsFound.length))}/11`);
  console.log(`  блоков контракта       ${avg(rs.map((r) => r.a.contractBlocks))}/13`);
  console.log(`  фактов операций        ${avg(rs.map((r) => r.a.opHits.length))}/10`);
  console.log(`  зеркало, операций      ${avg(rs.map((r) => r.a.mirrorOps.length))}/8`);
  console.log(`  фронт, операций        ${avg(rs.filter((r) => r.w).map((r) => r.w.consumedOps.length))}/8`);
  console.log(`  SM-80 зелёных ${rs.filter((r) => r.a.v80.startsWith('зелено')).length}, частичных ${rs.filter((r) => r.a.v80.startsWith('частично')).length}, красных ${rs.filter((r) => r.a.v80.startsWith('КРАСНО')).length}`);
  console.log(`  транспорт отдельным блоком: ${rs.filter((r) => r.a.transportBlock).length} из ${rs.length}`);
  console.log(`  прочие классы целы у ${rs.filter((r) => r.a.topics === 2 && r.a.jobs === 1 && r.a.entities === 4).length} из ${rs.length}`);
  console.log(`  заражений: ${rs.filter((r) => r.a.poison.length || (r.w && r.w.poison.length)).length}`);
  console.log();
}
