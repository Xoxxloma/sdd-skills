// Грейдер петли, раунд 1 — service-map на фикстуре LOOP-FULL.
// Ключ ответов — README фикстуры. Проверки идут по ДИСКУ (что реально записано),
// а не по тексту ответа агента: ответ может обещать то, чего в файлах нет.
//
// Запуск: node agent-version/_skill-eval/grade-loop.mjs r1 <папка-раунда>
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const probe = process.argv[2];
const runsDir = process.argv[3];
if (!probe || !runsDir) {
  console.error('нужны имя пробы и путь к папке раунда');
  process.exit(1);
}
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// Прогоном считается папка, где есть services/ с хотя бы одной карточкой.
function runsOf(d) {
  if (!isDir(d)) return [];
  const all = readdirSync(d).filter((f) => /^run-\d+$/.test(f)).sort().map((f) => join(d, f));
  const done = all.filter((r) => isDir(join(r, 'specs', 'services')));
  const skipped = all.length - done.length;
  if (skipped) console.error(`  !! ${skipped} из ${all.length} папок без services/ — не прогнаны.`);
  return done;
}

const CHECKS = {
  r1(run) {
    const svc = join(run, 'specs', 'services');
    const cards = isDir(svc) ? readdirSync(svc).filter((f) => /\.md$/.test(f)) : [];
    const manifest = read(join(svc, 'manifest.yaml'));
    const auth = read(join(svc, 'auth.md'));
    const api = read(join(svc, 'incident-api.md'));
    const web = read(join(svc, 'incident-web.md'));
    const all = auth + api + web;

    // ---- ГЛАВНОЕ: доехали ли факты, спрятанные в файлах (см. README фикстуры)
    const FACTS = [
      ['count null vs 0', /null[^\n]*(недоступ|источник)|источник[^\n]*null|sourceAvailable/i, auth],
      ['200 с флагом, не 5xx', /200[^\n]*(флаг|available)|не\s*5xx|вместо\s*5xx/i, auth],
      ['окно активности 15 минут', /15\s*(минут|мин\b)/i, auth],
      ['last_seen_at, не created_at', /last_?seen/i, auth],
      ['revoked не считаются активными', /revoked/i, auth],
      ['granularity hour|day|week', /hour[^\n]*day|granularity/i, auth],
      ['addressNormalized пуст до джобы', /addressNormalized|address_normalized/i, api],
      ['экспорт максимум 92 дня', /\b92\b/, api],
      ['409 на закрытый инцидент', /409/, api],
      ['zero и empty различаются', /zero/i, web],
      ['блок оборудования не рендерится', /оборудован/i, web],
    ];
    const hit = FACTS.filter(([, re, where]) => re.test(where));
    const miss = FACTS.filter(([, re, where]) => !re.test(where)).map(([n]) => n);

    // ---- гигиена карточки
    const secret = /8fH3kQ9pLm2ZxVb7/.test(all);                       // значение секрета
    const versions = /1\.9\.24|3\.3\.1|42\.7\.3|18\.3\.1/.test(all);    // номера версий
    const edgeApiToAuth = /auth/i.test(api);                            // incident-api -> auth
    const mirrorAtAuth = /incident-api/i.test(auth);                    // зеркало у auth
    const webIsFront = !/## Публичный контракт/.test(web) && /## Экраны/.test(web);
    const manifestOk = ['auth', 'incident-api', 'incident-web'].every((n) => manifest.includes(n));
    const noNotes = !/notes/.test(manifest);

    return {
      'R1.1 три карточки записаны': cards.filter((f) => f !== 'manifest.yaml').length === 3,
      'R1.2 манифест со всеми тремя': manifestOk,
      'R1.3 notes не выведено': noNotes,
      'R1.4 фактов из кода >= 9 из 11': hit.length >= 9,
      'R1.5 секрет не скопирован': !secret,
      'R1.6 версий нет в стеке': !versions,
      'R1.7 ребро incident-api -> auth': edgeApiToAuth,
      'R1.8 зеркало у auth': mirrorAtAuth,
      'R1.9 форма фронта ветвится верно': webIsFront,
      _detail: `карточек=${cards.length} фактов=${hit.length}/11${miss.length ? ' нет: ' + miss.join(', ') : ''}`,
    };
  },
};

const runs = runsOf(runsDir);
if (!runs.length) {
  console.error(`в ${runsDir} нет прогонов`);
  process.exit(1);
}
const totals = new Map();
let whole = 0;
console.log(`=== ${probe.toUpperCase()} — ${runs.length} прогонов ===`);
for (const r of runs) {
  const res = CHECKS[probe](r);
  const detail = res._detail;
  delete res._detail;
  const bad = Object.entries(res).filter(([, v]) => !v).map(([k]) => k);
  for (const [k, v] of Object.entries(res)) totals.set(k, (totals.get(k) || 0) + (v ? 1 : 0));
  if (!bad.length) whole++;
  console.log(`${r.split(/[\\/]/).pop()}: ${bad.length ? 'FAIL — ' + bad.join('; ') : 'PASS'}  [${detail}]`);
}
console.log('\n--- по пунктам ---');
for (const [k, v] of totals) console.log(`${v}/${runs.length}  ${k}`);
console.log(`\nПРОБА ЦЕЛИКОМ: ${whole}/${runs.length}`);
