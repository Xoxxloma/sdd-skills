// SM-SWITCH — «Бизнес-правила» на чужом рубильнике: чужой флаг, ошибка в ответе, строка на поле,
// справочник, свёрнутые письма. Фикстура — fixtures/SM-SWITCH/repo.md, ожидания — её раздел
// «Что здесь проверяется» (BR-1 … BR-7).
//
// Что меряет. Только секцию «Бизнес-правила» части `## КАРТОЧКА` ответа субагента (тир A) либо
// карточки целиком, если частей нет. Опись читается одним числом — строкой `⟹` — и идёт
// отдельным столбцом: по ней нельзя красить зелёным, модель пишет её про себя сама.
//
// Запуск: node agent-version/_skill-eval/grade-sm-switch.mjs <папка-прогонов> [ещё папки…]
//         node agent-version/_skill-eval/grade-sm-switch.mjs --selftest
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const SELFTEST = args[0] === '--selftest';
if (!SELFTEST && !args.length) {
  console.error('нужно: <папка-прогонов> [ещё…]   либо   --selftest');
  process.exit(1);
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// Ожидания фикстуры.
const EXPECT = { objects: 1, values: 3, messages: 6, restrictions: 1 };
const STATE_TOKENS = ['NEW', 'ACCEPTED', 'CLOSED'];
const REF_TOKENS = ['LOW', 'NORMAL', 'HIGH'];
// Имена полей обеих сущностей — строка блока, начинающаяся с такого токена, есть строка на поле.
const FIELDS = ['id', 'incidentId', 'patrolId', 'status', 'priority', 'createdAt', 'acceptedAt', 'closedAt',
  'closedBy', 'closeReason', 'employeeId', 'category', 'byEmail', 'bySms', 'changedAt'];
// Шесть видов сообщений — якорь на каждый, ищется в заголовке И теле блока сообщения.
const MSG_ANCHORS = [
  ['назначен наряд', /assignment-created|назначен[а-яё]*\s+наряд|наряд[а-яё]*\s+назначен|нов[а-яё]*\s+назначени/i],
  ['назначение закрыто (письмо)', /assignment-closed|назначени[а-яё]*\s+закрыт|закрыт[а-яё]*\s+назначени/i],
  ['ежедневная сводка', /ежедневн|за\s+(прошедшие\s+)?сутки|daily/i],
  ['еженедельная сводка', /еженедельн|за\s+неделю|weekly/i],
  ['SMS старшему наряда', /\bSMS\b|СМС|смс/i],
  ['топик закрытия', /navigator\.assignment\.closed|топик|kafka|событи[ея]\s+в\s+шину|в\s+шину/i],
];

function section(text, title) {
  const m = text.match(new RegExp(`^##\\s+${title}\\s*$`, 'm'));
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^##\s+[^#]/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function blocks(sec) {
  const out = [];
  const re = /^###\s+(.+?)\s*$/gm;
  let m, prev = null;
  while ((m = re.exec(sec))) {
    if (prev) prev.body = sec.slice(prev.end, m.index);
    prev = { head: m[1], end: m.index + m[0].length, body: '' };
    out.push(prev);
  }
  if (prev) prev.body = sec.slice(prev.end);
  for (const b of out) b.rows = b.body.split('\n').filter((l) => /^\s*-\s+/.test(l));
  return out;
}

const firstToken = (row) => (row.match(/`([^`]+)`/) || [])[1] || '';

// Кодовый регистр по правилу Шага 4: пути, HTTP-глаголы, camelCase, вызовы — вне бэктиков; а в
// бэктиках — всё, что не значение перечисления и не имя вида/топика/сервиса.
const ALLOWED_TOKENS = /^([A-Z_]+|[a-z]+(-[a-z]+)+|[a-z]+(\.[a-z]+)+|consolidate|navigator|dispatch-web)$/;
function rowHasCode(row) {
  // «(`ACTIVE`, `expiresAt` сдвинут)» — форма примера шаблона: скобка с токеном состояния в счёт не идёт.
  row = row.replace(/\(([^)]*`(NEW|ACCEPTED|CLOSED)`[^)]*)\)/, '');
  const outside = row.replace(/`[^`]*`/g, ' ');
  if (/\(\)|\s\/[a-z]|\b(GET|POST|PUT|PATCH|DELETE)\b|\b[a-z]+[A-Z][A-Za-z]*\b|\.java\b|\.html\b/.test(outside)) return true;
  for (const m of row.matchAll(/`([^`]+)`/g)) if (!ALLOWED_TOKENS.test(m[1])) return true;
  return false;
}

export function grade(text) {
  const r = { measured: false };
  const cardPart = text.includes('## КАРТОЧКА') ? text.slice(text.indexOf('## КАРТОЧКА')) : text;
  const sec = section(cardPart, 'Бизнес-правила');
  if (sec === null) return r;
  r.measured = true;

  const all = blocks(sec);
  const msgs = all.filter((b) => /^сообщени/i.test(b.head));
  const restr = all.filter((b) => /^ограничени/i.test(b.head));
  const objs = all.filter((b) => !/^(сообщени|ограничени)/i.test(b.head));

  // BR-1 / BR-4: чужой флаг и булевы поля как состояние.
  r.foreignAsState = objs.filter((b) => /SwitchStatus|флаг|интеграц|Subscription/i.test(b.head)).length;
  r.restrictions = restr.length;
  r.restrictionNamesOwner = restr.filter((b) => /consolidate/i.test(b.head + b.body)).length;
  r.restrictionHasBool = restr.filter((b) => /`(true|false)`/.test(b.body)).length;

  // BR-2: ошибка в ответе как сообщение; код ошибки в секции.
  r.errorAsMessage = msgs.filter((b) => /отключен/i.test(b.head)).length;
  r.errorCodeInSection = /SYSTEM_ERROR/.test(sec) ? 1 : 0;

  // BR-3: блок Assignment — строки на значение.
  const asg = objs.find((b) => /^`?Assignment`?/.test(b.head));
  r.assignmentBlock = asg ? 1 : 0;
  r.stateTokens = asg ? STATE_TOKENS.filter((t) => new RegExp('`' + t + '`').test(asg.body)).length : 0;
  r.assignmentRows = asg ? asg.rows.length : 0;
  const objRows = objs.flatMap((b) => b.rows);
  r.fieldRows = objRows.filter((row) => FIELDS.includes(firstToken(row))).length;
  r.refRows = objRows.filter((row) => REF_TOKENS.includes(firstToken(row))).length;
  r.objects = objs.length;

  // BR-5 / BR-6: письма по видам, токен не в заголовке.
  r.messages = msgs.length;
  r.msgAnchors = MSG_ANCHORS.filter(([, re]) => msgs.some((b) => re.test(b.head + '\n' + b.body))).length;
  r.tokenInHead = msgs.filter((b) => /`/.test(b.head)).length;

  // BR-7: кодовый регистр по всем строкам секции.
  r.codeRows = all.flatMap((b) => b.rows).filter(rowHasCode).length;

  // Заражение примером шаблона (как SM-46): текст примера ограничения — чужая предметная область.
  r.poison = /одноразов[а-яё]*\s+код|user-profile/i.test(sec) ? 1 : 0;

  // Опись — отдельным числом.
  const inv = text.match(/⟹\s*состояний\s*(\d+)\s*\(значений\s*(\d+)\)\s*,\s*сообщений\s*(\d+)(?:\s*,\s*ограничений\s*(\d+))?/);
  r.inventory = inv ? `${inv[1]}(${inv[2]})/${inv[3]}/${inv[4] ?? '—'}` : '—';

  r.good =
    r.foreignAsState === 0 && r.restrictions === EXPECT.restrictions && r.restrictionHasBool === 0 &&
    r.errorAsMessage === 0 && r.errorCodeInSection === 0 &&
    r.assignmentBlock === 1 && r.stateTokens === 3 && r.fieldRows === 0 && r.refRows === 0 && r.objects === EXPECT.objects &&
    r.messages === EXPECT.messages && r.msgAnchors === 6 && r.tokenInHead === 0 &&
    r.codeRows === 0 && r.poison === 0;
  return r;
}

const COLS = [
  ['objects', 'объектов', (v) => v === EXPECT.objects],
  ['foreignAsState', 'чужое/булево как состояние', (v) => v === 0],
  ['restrictions', 'ограничений', (v) => v === EXPECT.restrictions],
  ['restrictionHasBool', 'true/false в ограничении', (v) => v === 0],
  ['errorAsMessage', 'ошибка как сообщение', (v) => v === 0],
  ['errorCodeInSection', 'SYSTEM_ERROR в секции', (v) => v === 0],
  ['stateTokens', 'значений Assignment /3', (v) => v === 3],
  ['assignmentRows', 'строк в Assignment', (v) => v >= 3],
  ['fieldRows', 'строк на поле', (v) => v === 0],
  ['refRows', 'строк справочника', (v) => v === 0],
  ['messages', 'сообщений', (v) => v === EXPECT.messages],
  ['msgAnchors', 'видов найдено /6', (v) => v === 6],
  ['tokenInHead', 'токен в заголовке', (v) => v === 0],
  ['codeRows', 'строк с кодом', (v) => v === 0],
  ['poison', 'пример шаблона', (v) => v === 0],
];

function report(dirs) {
  const rows = [];
  for (const dir of dirs) {
    if (!isDir(dir)) { console.error(`нет папки: ${dir}`); continue; }
    for (const name of readdirSync(dir).filter((n) => /^run-/.test(n)).sort()) {
      const ans = read(join(dir, name, 'answer.md'));
      if (!ans.trim()) { rows.push({ arm: basename(dir), run: name, r: { measured: false, why: 'пустой ответ' } }); continue; }
      const r = grade(ans);
      rows.push({ arm: basename(dir), run: name, r });
    }
  }
  console.log('плечо/прогон · ' + COLS.map(([, t]) => t).join(' · ') + ' · опись · итог');
  const armStats = {};
  for (const { arm, run, r } of rows) {
    const st = (armStats[arm] ||= { n: 0, measured: 0, good: 0 });
    st.n++;
    if (!r.measured) { console.log(`${arm}/${run}: не измерено${r.why ? ' — ' + r.why : ' — нет секции «Бизнес-правила»'}`); continue; }
    st.measured++; if (r.good) st.good++;
    const cells = COLS.map(([k, , ok]) => `${r[k]}${ok(r[k]) ? '' : '❌'}`);
    console.log(`${arm}/${run}: ${cells.join(' · ')} · ${r.inventory} · ${r.good ? '✅ годен' : '❌'}`);
  }
  console.log('\nитог по плечам:');
  for (const [arm, st] of Object.entries(armStats)) {
    const meas = rows.filter((x) => x.arm === arm && x.r.measured).map((x) => x.r);
    const med = (k) => { const v = meas.map((r) => r[k]).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : '—'; };
    console.log(`  ${arm}: годных ${st.good}/${st.measured} (прогонов ${st.n}) · медианы: сообщений ${med('messages')}, видов ${med('msgAnchors')}, строк на поле ${med('fieldRows')}, строк с кодом ${med('codeRows')}, чужое как состояние ${med('foreignAsState')}, ограничений ${med('restrictions')}`);
  }
}

// ─── Самопроверка ───────────────────────────────────────────────────────────────
const GREEN = `шаблон прочитан, тип: backend
## ОПИСЬ
состояние: Assignment.status NEW | ACCEPTED | CLOSED — domain/Assignment.java
сообщение: «назначен наряд на инцидент» — подписчикам — notify/SubscriberMailer.java
⟹ состояний 1 (значений 3), сообщений 6, ограничений 1
## КАРТОЧКА
## Бизнес-правила

### \`Assignment\` — назначение наряда на инцидент
- создано (\`NEW\`) — диспетчер назначает наряд; у инцидента может быть только одно незакрытое назначение; подписчикам категории уходит письмо, старшему наряда — SMS
- принято (\`ACCEPTED\`) — старший назначенного наряда подтверждает; только из «создано» и только свой наряд
- закрыто (\`CLOSED\`) — диспетчер или админ с причиной, только принятое; либо система при закрытии инцидента в consolidate — в любом статусе, без причины и без письма; закрытое обратно не открывается

### сообщение «назначен наряд на инцидент»
- при назначении; получают подписчики категории инцидента по e-mail (\`assignment-created\`); старший наряда не получает; нет подписок — не отправляется

### сообщение «назначение закрыто»
- при ручном закрытии (\`assignment-closed\`); подписчикам категории; при закрытии по событию consolidate не отправляется

### сообщение «ежедневная сводка назначений»
- ежедневно утром за прошедшие сутки; всем подписчикам по e-mail; пустая сводка не отправляется

### сообщение «еженедельная сводка назначений»
- в понедельник за неделю, только по закрытым; всем подписчикам по e-mail; пустая не отправляется

### сообщение «вам назначен инцидент» (SMS)
- при назначении; получает старший назначенного наряда независимо от подписок; повтор через 1 и 5 минут

### сообщение «назначение закрыто» — соседям
- при любом закрытии, ручном и системном; в шину, топик \`navigator.assignment.closed\`

### ограничение «интеграция с АС Навигатор отключена»
- условием управляет consolidate; пока оно действует, все запросы к данным навигатора отвергаются с этим сообщением; к данным сервис не обращается

## Стек
`;

const RED = `шаблон прочитан, тип: backend
## ОПИСЬ
⟹ состояний 3 (значений 8), сообщений 3
## КАРТОЧКА
## Бизнес-правила

### состояние — флаг доступности интеграции (\`SwitchStatus.status\`)
- доступна (\`false\`) — при каждом запросе checkApiIsAvailable() читает флаг у consolidate (/admin/navigator)
- отключена (\`true\`) — бросается SummaryBaseIntegrationException с кодом SYSTEM_ERROR

### \`Assignment\` — назначение
- \`status\` (\`AssignmentStatus\`) — статус назначения
- \`patrolId\` — табельный номер старшего наряда
- \`closedBy\` — кто закрыл
- низкий (\`LOW\`) — задаётся при создании и не меняется
- обычный (\`NORMAL\`) — задаётся при создании
- высокий (\`HIGH\`) — задаётся при создании

### \`Subscription\` — подписка
- \`byEmail\` — получать письма
- \`bySms\` — получать SMS

### сообщение «Интеграция с АС Навигатор отключена»
- при включённом флаге на любом эндпоинте /api/v1/navigator/*; получает UI

### сообщение «письма подписчикам» (\`SubscriberMailer\`)
- рассылка по назначениям и дайджестам (шаблоны Thymeleaf templates/mail/) и SMS через Sowa /sendsmsac/

### сообщение «закрытие» (\`navigator.assignment.closed\`)
- kafka.send при закрытии
`;

function selftest() {
  const g = grade(GREEN), r = grade(RED);
  const checks = [
    ['зелёный: измерен', g.measured],
    ['зелёный: объектов 1', g.objects === 1],
    ['зелёный: чужого как состояния 0', g.foreignAsState === 0],
    ['зелёный: ограничений 1, владелец назван', g.restrictions === 1 && g.restrictionNamesOwner === 1 && g.restrictionHasBool === 0],
    ['зелёный: ошибок как сообщений 0', g.errorAsMessage === 0 && g.errorCodeInSection === 0],
    ['зелёный: три значения Assignment', g.assignmentBlock === 1 && g.stateTokens === 3 && g.assignmentRows === 3],
    ['зелёный: строк на поле 0, справочника 0', g.fieldRows === 0 && g.refRows === 0],
    ['зелёный: сообщений 6, видов 6, токен в заголовке 0', g.messages === 6 && g.msgAnchors === 6 && g.tokenInHead === 0],
    ['зелёный: строк с кодом 0', g.codeRows === 0],
    ['зелёный: заражения нет', g.poison === 0],
    ['скобка с токеном состояния не считается кодом', rowHasCode('- принято (`ACCEPTED`, `acceptedAt` проставлен) — подтверждает старший наряда') === false],
    ['поле со значением вне скобки — код', rowHasCode('- письмо подписчикам с `byEmail=true`') === true],
    ['пример шаблона ловится', grade(GREEN.replace('условием управляет consolidate', 'условием управляет `user-profile`')).poison === 1],
    ['зелёный: опись прочитана', g.inventory === '1(3)/6/1'],
    ['зелёный: годен', g.good === true],
    ['красный: измерен', r.measured],
    ['красный: чужое/булево как состояние 2', r.foreignAsState === 2],
    ['красный: ограничений 0', r.restrictions === 0],
    ['красный: ошибка как сообщение 1, SYSTEM_ERROR 1', r.errorAsMessage === 1 && r.errorCodeInSection === 1],
    ['красный: значений Assignment 0', r.stateTokens === 0],
    ['красный: строк на поле 5, справочника 3', r.fieldRows === 5 && r.refRows === 3],
    ['красный: сообщений 3, видов < 6, токен в заголовке 2', r.messages === 3 && r.msgAnchors < 6 && r.tokenInHead === 2],
    ['красный: строк с кодом > 0', r.codeRows > 0],
    ['красный: опись без ограничений', r.inventory === '3(8)/3/—'],
    ['красный: не годен', r.good === false],
    ['нет секции → не измерено', grade('## КАРТОЧКА\n## Стек\n').measured === false],
  ];
  let bad = 0;
  for (const [name, ok] of checks) { console.log(`  ${ok ? '✔' : '✘'} ${name}`); if (!ok) bad++; }
  if (bad) { console.log(`\nсамопроверка ПРОВАЛЕНА: ${bad}`); process.exit(1); }
  console.log('\nсамопроверка пройдена');
}

if (SELFTEST) selftest(); else report(args);
