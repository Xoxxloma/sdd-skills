// Грейдер archive-spec 2.0 (триггер ре-скана вместо вливания).
// Запуск: node agent-version/_skill-eval/grade-ar.mjs arbasic
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const probe = process.argv[2] || 'arbasic';
const base = join(process.cwd(), 'agent-version/_skill-eval');
const runsDir = join(base, 'runs/2026-07-31-stages', probe);
const fixture = join(base, 'fixtures/AR-BASIC');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

const runs = readdirSync(runsDir).filter((f) => /^run-\d+$/.test(f)).sort().map((f) => join(runsDir, f));
const tally = {};
const lines = [];

for (const run of runs) {
  const ans = read(join(run, 'answer.md'));
  // «Не измерено» ≠ «провалено». Если в песочнице прогона вообще нет `services/`, сверять
  // «карточки не тронуты» не с чем: сравнение пустой строки с содержимым фикстуры всегда даёт
  // «различается», и оба пункта красятся нулём на ровном месте. Такой прогон в эти два пункта
  // не входит — печатается предупреждение. (Тот же класс, что уже давал ложный красный на ST-4.)
  // Пустая `services/` считается так же, как отсутствующая: при уплотнении артефактов нетронутые
  // карточки удаляли как избыточные, и папка осталась пустым каркасом. Проверять надо наличие
  // самих файлов, а не директории.
  const hasServices = ['auth.md', 'incident-web.md', 'manifest.yaml']
    .every((f) => existsSync(join(run, 'services', f)));
  const cardsUntouched = hasServices
    ? ['auth.md', 'incident-web.md'].every(
        (f) => read(join(run, 'services', f)) === read(join(fixture, 'services', f))
      )
    : null;
  const manifestUntouched = hasServices
    ? read(join(run, 'services/manifest.yaml')) === read(join(fixture, 'services/manifest.yaml'))
    : null;
  if (!hasServices) console.error(`  !! ${run.split(/[\\/]/).pop()}: карточек в services/ нет (артефакт уплотнён) — AR-20.3 и AR-20.4 не измеряются.`);
  const callLine = (ans.match(/ВЫЗОВ:.*service-map.*/i) || [''])[0] || (/service-map\s+auth/i.test(ans) ? ans.match(/service-map[^\n]*/i)[0] : '');
  const res = {
    'AR-20.1 скан вызван по service-map': /service-map/i.test(ans),
    // NB: имена могут стоять и одной командой, и списком — считаем по всему ответу
    'AR-20.2 в скан отданы все три сервиса §1.2 (включая 🟡 к валидации geo)':
      /service-map/i.test(ans) && /auth/.test(ans) && /incident-web/.test(ans) && /geo/.test(ans),
    'AR-20.3 карточки сервисов не тронуты': cardsUntouched,
    'AR-20.4 манифест не тронут': manifestUntouched,
    'AR-21 депрекейт §6.2 назван в отчёте': /v1\/session/.test(ans) && /(notes|устарев|deprecated)/i.test(ans),
    'AR-22 клоны названы человеку до скана': /(подтян|клон)/i.test(ans),
    // NB: стем «архивир», а не «архивиру» — первая редакция искала несуществующую подстроку
    'AR-8 состав спеки назван': /(архивир|состав|подтвержд)/i.test(ans),
    'AR-23 .archived положен в папку спеки': existsSync(join(run, 'docs/ARS-57/.archived')),
    'AR-24 файла отчёта на диск нет': !existsSync(join(run, 'docs/ARS-57/ARCHIVE_REPORT.md')),
  };
  // null = «не измерено»: в знаменатель не идёт и провалом не считается.
  const failed = Object.entries(res).filter(([, v]) => v === false).map(([k]) => k);
  for (const [k, v] of Object.entries(res)) {
    if (v === null) continue;
    tally[k] = tally[k] || { pass: 0, total: 0 };
    tally[k].total++; if (v) tally[k].pass++;
  }
  lines.push(`${run.split(/[\\/]/).pop()}: ${failed.length ? 'FAIL — ' + failed.join('; ') : 'PASS'}`);
}

console.log(`\n=== ${probe.toUpperCase()} — ${runs.length} прогонов ===`);
lines.forEach((l) => console.log(l));
console.log('\n--- по пунктам ---');
for (const [k, v] of Object.entries(tally)) console.log(`${v.pass}/${v.total}  ${k}`);
console.log(`\nПРОБА ЦЕЛИКОМ: ${lines.filter((l) => l.includes(': PASS')).length}/${runs.length}`);
