// Грейдер правок раунда «этапы работ» в service-map (SM-53, SM-56) и в оркестраторе (GUI-11).
// Запуск: node agent-version-3.2/_skill-eval/grade-sm-gui.mjs smrescan|gui11
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const probe = process.argv[2];
const base = join(process.cwd(), 'agent-version-3.2/_skill-eval');
const runsDir = join(base, 'runs/2026-07-31-stages', probe);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const runs = isDir(runsDir)
  ? readdirSync(runsDir).filter((f) => /^run-\d+$/.test(f)).sort().map((f) => join(runsDir, f))
  : [];

const CHECKS = {
  smrescan(run) {
    const ans = read(join(run, 'answer.md'));
    const card = read(join(run, 'specs/services/shipping.md'));
    const orig = read(join(base, 'fixtures/SM-RESCAN/tree/services/shipping.md'));
    // промпт субагенту — от заголовка до конца ответа или до следующего заголовка верхнего уровня
    const prompt = (ans.match(/ПРОМПТ СУБАГЕНТУ:[\s\S]{0,6000}/i) || [''])[0];
    const gone = ['cancel', '/v1/tariffs', 'waybills'];
    return {
      'SM-53.1 путь к прежней карточке передан субагенту': /services[\/\\]shipping\.md/.test(prompt),
      'SM-53.2 эхо-строка требует отчёт о прежней карточке': /прежняя карточка/i.test(prompt),
      'SM-53.3 порядок «сначала опись, потом карточка» передан': /(сначала опись|опись.*потом|порядок работы)/i.test(prompt),
      'SM-56.1 карточка НЕ перезаписана': card === orig,
      'SM-56.2 названо число исчезнувших ключей': /исчез/i.test(ans) && /\b3\b/.test(ans),
      'SM-56.3 названы имена исчезнувших ключей': gone.filter((g) => ans.includes(g)).length >= 2,
      _detail: `промпт=${prompt.length}б карточка ${card === orig ? 'цела' : 'ПЕРЕЗАПИСАНА'}`,
    };
  },
  // круг 2: разбиение исполняется на Шаге 5, а не предлагается вариантом Шага 6
  gui11b(run) {
    const ans = read(join(run, 'answer.md'));
    return {
      'GUI-11b.1 назван stage-breakdown-doc': /stage-breakdown-doc/.test(ans),
      'GUI-11b.2 скилл запущен, а не предложен': /ВЫЗОВ:\s*stage-breakdown-doc/i.test(ans),
      'GUI-11b.3 §2.5 прочитана — этапы названы': /(этап|2\.5)/i.test(ans) && /(приём|сопоставлен|отдач)/i.test(ans),
      'GUI-11b.4 разбиение не вынесено вариантом развилки':
        !/(вариант|опци)\D{0,40}разб/i.test(ans),
      _detail: `длина=${ans.length}б`,
    };
  },
  gui11(run) {
    const ans = read(join(run, 'answer.md'));
    const firstThird = ans.slice(0, Math.max(900, Math.floor(ans.length / 3)));
    return {
      'GUI-11.1 назван stage-breakdown-doc': /stage-breakdown-doc/.test(ans),
      'GUI-11.2 разбиение на этапы предложено первым вариантом': /(разбить|этап)/i.test(firstThird),
      'GUI-11.3 «доработать» не первым (статус «Готово к разработке»)':
        !/^\s*[-*1.]*\s*\*{0,2}доработать/im.test(firstThird),
      'GUI-11.4 вариантов не больше четырёх': (ans.match(/^\s*[-*]\s+\*\*/gm) || []).length <= 6,
      _detail: `длина=${ans.length}б`,
    };
  },
};

if (!CHECKS[probe] || !runs.length) {
  console.error(`нет пробы или прогонов: ${probe}`);
  process.exit(1);
}
const tally = {};
const lines = [];
for (const run of runs) {
  const res = CHECKS[probe](run);
  const detail = res._detail; delete res._detail;
  const failed = Object.entries(res).filter(([, v]) => !v).map(([k]) => k);
  for (const [k, v] of Object.entries(res)) {
    tally[k] = tally[k] || { pass: 0, total: 0 };
    tally[k].total++; if (v) tally[k].pass++;
  }
  lines.push(`${run.split(/[\\/]/).pop()}: ${failed.length ? 'FAIL — ' + failed.join('; ') : 'PASS'}  [${detail}]`);
}
console.log(`\n=== ${probe.toUpperCase()} — ${runs.length} прогонов ===`);
lines.forEach((l) => console.log(l));
console.log('\n--- по пунктам ---');
for (const [k, v] of Object.entries(tally)) console.log(`${v.pass}/${v.total}  ${k}`);
console.log(`\nПРОБА ЦЕЛИКОМ: ${lines.filter((l) => l.includes(': PASS')).length}/${runs.length}`);
