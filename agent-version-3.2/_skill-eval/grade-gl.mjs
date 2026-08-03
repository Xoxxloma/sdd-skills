// Грейдер domain-glossary (сбор словаря из карточек service-map).
// Запуск: node agent-version-3.2/_skill-eval/grade-gl.mjs [basic|collide|empty]
//
// Читает из каждого прогона два артефакта:
//   GLOSSARY.md — то, что скилл записал на диск;
//   answer.md   — текст отчёта, который он вернул человеку.
// Разделение важно: половина требований скилла — про то, чего в ФАЙЛЕ быть не должно,
// а сказано об этом обязано быть в ОТЧЁТЕ. Проверять их по одному артефакту нельзя.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const probe = process.argv[2] || 'basic';
// Второй аргумент — каталог прогонов. Нужен, чтобы прогнать ТОТ ЖЕ грейдер по старой
// итерации: новая проверка обязана краснеть там, где дефект был, иначе она ничего не мерит.
const stamp = process.argv[3] || '2026-08-03-glossary';
const base = join(process.cwd(), 'agent-version-3.2/_skill-eval');
const runsDir = join(base, 'runs', stamp, `gl-${probe}`);
const fixtureByProbe = { collide: 'GL-COLLIDE', bulk: 'GL-BULK' };
const fixture = join(base, 'fixtures', fixtureByProbe[probe] || 'GL-BASIC');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

if (!existsSync(runsDir)) {
  console.error(`Нет каталога прогонов: ${runsDir}`);
  process.exit(1);
}
const runs = readdirSync(runsDir).filter((f) => /^run-\d+$/.test(f)).sort().map((f) => join(runsDir, f));
const tally = {};
const lines = [];

// Порядок терминов внутри секции. Ключ — жирная строка вида `**`Session`** — владеет ...`.
// Сортировка проверяется без учёта обратных кавычек: они часть формы, а не имени.
const termsOf = (section) =>
  [...section.matchAll(/^\*\*`?([^`*]+)`?\*\*/gm)].map((m) => m[1].trim());
// Секция режется ПОСТРОЧНО, а не регуляркой, собранной из строки. Первая редакция делала
// `new RegExp('...(?=^## |\\Z)')` — и это стоило целого прогона впустую: `\Z` в JS не «конец
// текста», а литерал `Z`, поэтому ленивая группа обрывалась на заглавной Z внутри
// `CoverageZone`, секция «Сущности» усыхала до первого термина, а последняя секция не
// находилась вообще. Пятнадцать пунктов покрасились красным на ровном месте.
const sectionOf = (text, title) => {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
};
const sorted = (a) => a.every((v, i) => i === 0 || a[i - 1].localeCompare(v, 'ru') <= 0);
// Абзац отчёта, начинающийся с заданного слова. Без конструирования регулярок — см. урок
// про `\Z` выше: сравнение строк здесь надёжнее и читается лучше.
const blockOf = (text, head) =>
  text.split(/\n\s*\n/).find((b) => b.trim().toLowerCase().startsWith(head)) || '';

for (const run of runs) {
  const name = run.split(/[\\/]/).pop();
  const ans = read(join(run, 'answer.md'));
  // Файл обязан лежать РЯДОМ с services/, а не внутри: у service-map на Шаге 5 стоит
  // проверка «services/*.md без строки в манифесте», и глоссарий внутри папки будет
  // всплывать сиротой в каждом её отчёте.
  const gloOutside = existsSync(join(run, 'GLOSSARY.md'));
  const gloInside = existsSync(join(run, 'services/GLOSSARY.md'));
  const glo = read(join(run, gloOutside ? 'GLOSSARY.md' : 'services/GLOSSARY.md'));
  const ents = sectionOf(glo, 'Сущности');
  const roles = sectionOf(glo, 'Роли');
  const human = sectionOf(glo, 'Термины предметной области');

  // Карточки и манифест — чужие артефакты. Скилл их только читает.
  const srcFiles = existsSync(join(fixture, 'services'))
    ? readdirSync(join(fixture, 'services'))
    : [];
  const srcUntouched = srcFiles.length
    ? srcFiles.every((f) => read(join(run, 'services', f)) === read(join(fixture, 'services', f)))
    : null;

  let res;
  if (probe === 'empty') {
    res = {
      'GL-0.1 файл не создан': !gloOutside && !gloInside,
      'GL-0.2 сказано, что слепка нет': /слепк\w* нет|нет карточек|собирать не из чего/i.test(ans),
      'GL-0.3 назван service-map как следующий шаг': /service-map/i.test(ans),
    };
  } else if (probe === 'basic') {
    res = {
      'GL-1.1 GLOSSARY.md записан рядом с services/, не внутри': gloOutside && !gloInside,
      'GL-1.2 сущности Session, AuditEntry, CoverageZone на месте':
        /\bSession\b/.test(ents) && /\bAuditEntry\b/.test(ents) && /\bCoverageZone\b/.test(ents),
      // PatrolRoute — блок без строки назначения. Определения нет → термина нет.
      'GL-2.1 PatrolRoute в файл НЕ попал': !/PatrolRoute/.test(glo),
      'GL-2.2 PatrolRoute назван в отчёте как термин без определения': /PatrolRoute/.test(ans),
      'GL-3.1 состояния Session перенесены': /active[^\n]*expired[^\n]*revoked/.test(ents),
      'GL-3.2 состояния CoverageZone перенесены': /active[^\n]*suspended/.test(ents),
      'GL-4.1 человеческое «говорим» влито из манифеста': /сессия пользователя/i.test(ents),
      'GL-4.2 человеческое «не говорим» влито из манифеста': /сеанс/i.test(ents) && /вход/i.test(ents),
      'GL-4.3 ЧОП и ГБР — в «Терминах предметной области»': /ЧОП/.test(human) && /ГБР/.test(human),
      'GL-4.4 ЧОП не стал сущностью': !/ЧОП/.test(ents),
      // «Состояние и данные» у фронта — то, что сервис кэширует, а не то, чем владеет.
      'GL-5.1 фильтры инцидентов из «Состояние и данные» не стали термином':
        !/фильтр\w* инцидент/i.test(ents),
      'GL-5.2 эндпоинтов в глоссарии нет': !/\/v1\//.test(glo),
      'GL-5.3 топиков в глоссарии нет': !/auth\.session\.revoked/.test(glo),
      // Экран не может быть ТЕРМИНОМ. Но сослаться на него в строке `_В интерфейсе_` скилл
      // вправе — это адрес, где термин виден человеку, и ради него бизнес-регистр и берётся.
      // Первая редакция запрещала роут во всём файле и красила красным законный выход.
      'GL-5.4 экраны не стали терминами':
        ![...termsOf(ents), ...termsOf(roles)].some((t) => t.startsWith('/')),
      'GL-6.1 шапка перечисляет scanned всех трёх карточек':
        /2026-07-28/.test(glo) && /2026-07-20/.test(glo) &&
        /auth/.test(glo.slice(0, 800)) && /geo/.test(glo.slice(0, 800)) && /incident-web/.test(glo.slice(0, 800)),
      'GL-7.1 роли security_analyst, analyst, operator на месте':
        /security_analyst/.test(roles) && /\banalyst\b/.test(roles) && /operator/.test(roles),
      // Роль сквозная: одно имя в двух карточках — одна роль с разными правами, а не две.
      // Первая редакция скилла давала два блока с одинаковым заголовком и объявляла это
      // коллизией; словарь на вопрос «что может эта роль» отвечал дважды.
      'GL-7.2 security_analyst — ОДИН термин, не два':
        termsOf(roles).filter((t) => t === 'security_analyst').length === 1,
      'GL-7.3 в блоке security_analyst названы оба сервиса':
        /security_analyst[\s\S]{0,300}auth/.test(roles) &&
        /security_analyst[\s\S]{0,300}incident-web/.test(roles),
      // GL-7.4 «роль не объявлена коллизией в отчёте» — УБРАН как невалидный, а не как неудобный.
      // Он искал имя роли в абзаце «Коллизии» и красил красным текст «security_analyst
      // коллизией НЕ считается: роль сквозная» — то есть ровно то поведение, которого мы
      // добивались. Отличить утверждение от его отрицания подстрокой нельзя.
      // Наблюдаемое следствие правки живёт в файле и проверяется GL-7.2: роль одним блоком,
      // а не двумя. Формулировку отчёта оценивает человек — механически она не грейдится.
      'GL-8.1 сущности отсортированы по алфавиту': sorted(termsOf(ents)),
      'GL-8.2 роли отсортированы по алфавиту': sorted(termsOf(roles)),
      'GL-9.1 карточки и манифест не тронуты': srcUntouched,
    };
  } else if (probe === 'bulk') {
    // Слепок на 10 карточек. Главный вопрос здесь не «есть ли форма», а СКОЛЬКО доехало:
    // ровно тот показатель, что просел у карточек на настоящем дереве (7.4 из 11).
    const WITH_DEF = ['Session', 'AuditEntry', 'CoverageZone', 'ServiceArea', 'Assignment',
                      'Request', 'Chop', 'Employee', 'ReportJob'];
    const NO_DEF = ['PatrolRoute', 'Notification', 'DeliveryAttempt'];
    const ROLES = ['security_analyst', 'analyst', 'operator', 'dispatcher', 'support_agent', 'buyer'];
    // Никакого new RegExp из строки — см. урок про `\Z`. Сравнение подстрок делает то же
    // самое и не может тихо развалиться на неожиданном символе внутри имени.
    const got = WITH_DEF.filter((e) => ents.includes(`**\`${e}\`**`) || ents.includes(`**${e}**`));
    const roleTerms = termsOf(roles);
    console.error(`  .. ${name}: сущностей ${got.length}/${WITH_DEF.length}` +
      (got.length < WITH_DEF.length ? ` — нет: ${WITH_DEF.filter((e) => !got.includes(e)).join(', ')}` : '') +
      `; ролей ${roleTerms.length} (ожидание 6)`);
    res = {
      'GL-1.1 GLOSSARY.md записан рядом с services/, не внутри': gloOutside && !gloInside,
      'GL-20.1 все 9 определённых сущностей доехали': got.length === WITH_DEF.length,
      'GL-20.2 ни одна сущность без определения не записана': !NO_DEF.some((e) => glo.includes(e)),
      'GL-20.3 все три термина без определения названы в отчёте': NO_DEF.every((e) => ans.includes(e)),
      'GL-21.1 оба Request в файле со своими владельцами':
        /Request[\s\S]{0,150}support/.test(ents) && /Request[\s\S]{0,150}procurement/.test(ents),
      'GL-21.2 коллизия Request названа в отчёте':
        /Request/.test(ans) && /(коллиз|одно имя|совпад)/i.test(ans),
      'GL-22.1 роли не задвоены (6 уникальных)':
        roleTerms.length === new Set(roleTerms).size && ROLES.every((r) => roleTerms.includes(r)),
      'GL-22.2 «не определено» из notify не стало ролью': !/не определено/i.test(roles),
      'GL-23.1 ЧОП, ГБР, PatrolUnit — в «Терминах предметной области»':
        ['ЧОП', 'ГБР', 'PatrolUnit'].every((t) => human.includes(t)),
      'GL-23.2 говорим/не говорим из манифеста влиты в Session':
        /сессия сотрудника/i.test(ents) && /сеанс/i.test(ents),
      'GL-24.1 legacy-billing и Invoice не попали в глоссарий': !/legacy-billing|Invoice/.test(glo),
      'GL-24.2 legacy-billing назван в отчёте': /legacy-billing/.test(ans),
      'GL-25.1 эндпоинтов, топиков и роутов среди терминов нет':
        ![...termsOf(ents), ...roleTerms].some((t) => t.startsWith('/') || t.includes('.')),
      'GL-25.2 formatCoverage из lib не стал термином': !/formatCoverage/.test(glo),
      'GL-26.1 шапка перечисляет даты сканов': (glo.slice(0, 900).match(/2026-\d\d-\d\d/g) || []).length >= 5,
      'GL-26.2 самая старая карточка названа в отчёте': /2026-05-14/.test(ans) || /report-worker[^\n]*стар/i.test(ans),
      'GL-27.1 сущности отсортированы по алфавиту': sorted(termsOf(ents)),
      'GL-27.2 роли отсортированы по алфавиту': sorted(roleTerms),
      'GL-28.1 карточки и манифест не тронуты': srcUntouched,
    };
  } else {
    res = {
      'GL-1.1 GLOSSARY.md записан рядом с services/, не внутри': gloOutside && !gloInside,
      // Точная коллизия: одно имя, два владельца, разные определения. Оба остаются.
      'GL-10.1 оба Request в файле': (glo.match(/\bRequest\b/g) || []).length >= 2,
      'GL-10.2 у обоих Request назван свой владелец':
        /Request[\s\S]{0,120}support/.test(ents) && /Request[\s\S]{0,120}procurement/.test(ents),
      'GL-10.3 определения обоих Request различаются':
        /обращени/i.test(ents) && /закупк/i.test(ents),
      'GL-10.4 коллизия Request названа в отчёте':
        /Request/.test(ans) && /(коллиз|одно имя|совпад)/i.test(ans),
      // Синонимы — суждение. Скилл предъявляет кандидатов и НЕ сводит их сам.
      'GL-11.1 CoverageZone и ServiceArea оба остались в файле':
        /CoverageZone/.test(ents) && /ServiceArea/.test(ents),
      'GL-11.2 пара названа кандидатами в синонимы в отчёте':
        /CoverageZone/.test(ans) && /ServiceArea/.test(ans) && /синоним/i.test(ans),
      'GL-12.1 legacy-billing не попал в глоссарий': !/legacy-billing|Invoice/.test(glo),
      'GL-12.2 legacy-billing назван в отчёте как карточка вне манифеста':
        /legacy-billing/.test(ans) && /манифест/i.test(ans),
      'GL-13.1 PatrolUnit назван в отчёте как запись без термина': /PatrolUnit/.test(ans),
      'GL-13.2 PatrolUnit не выдуман сущностью': !/PatrolUnit/.test(ents),
      'GL-4.3 ГБР — в «Терминах предметной области»': /ГБР/.test(human),
      'GL-6.2 самая старая карточка названа в отчёте': /2026-06-30/.test(ans) || /procurement[^\n]*стар/i.test(ans),
      'GL-8.1 сущности отсортированы по алфавиту': sorted(termsOf(ents)),
      'GL-9.1 карточки и манифест не тронуты': srcUntouched,
    };
  }

  // null = «не измерено»: в знаменатель не идёт и провалом не считается.
  const failed = Object.entries(res).filter(([, v]) => v === false).map(([k]) => k);
  for (const [k, v] of Object.entries(res)) {
    if (v === null) continue;
    tally[k] = tally[k] || { pass: 0, total: 0 };
    tally[k].total++; if (v) tally[k].pass++;
  }
  lines.push(`${name}: ${failed.length ? 'FAIL — ' + failed.join('; ') : 'PASS'}`);
}

console.log(`\n=== GL-${probe.toUpperCase()} — ${runs.length} прогонов ===`);
lines.forEach((l) => console.log(l));
console.log('\n--- по пунктам ---');
for (const [k, v] of Object.entries(tally)) console.log(`${v.pass}/${v.total}  ${k}`);
console.log(`\nПРОБА ЦЕЛИКОМ: ${lines.filter((l) => l.includes(': PASS')).length}/${runs.length}`);
