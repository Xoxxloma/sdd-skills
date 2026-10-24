// Самотест reference/run.ps1 скилла service-map-2.0 — запуск скриптов на Windows через bash из Git for Windows.
//   node selftest-sm-run-ps1.mjs
// Только Windows: нужны powershell и Git for Windows. Моделей не запускает, пишет во временную папку.
// Эталон — тот же скрипт, запущенный bash.exe напрямую с путями `C:/…`; run.ps1 получает пути с `\`, папку с пробелом
// и кириллицей, переменные — словами после имени скрипта. Каждый случай — напрямую и в ConstrainedLanguage
// (обёртка, как в selftest-to-html-pack.mjs); вызов из cmd и из PowerShell — как у агента на Windows.
// Разбор аргументов — на копии run.ps1 с probe.sh рядом; вызов из настоящего Git Bash, который переписывает `/api`.
// Скриптовые самотесты целиком через run.ps1 — SM_RUNNER=ps1 у test-check.sh, test-split-scripts.sh и прочих.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = join(HERE, '..', 'service-map-2.0', 'reference');
const RUN = join(REF, 'run.ps1');
const CASE = join(HERE, 'fixtures', 'SM-CHECK', 'cases', 'states-changed-parts');
const GITBASH = join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe');
if (process.platform !== 'win32' || !existsSync(GITBASH)) { console.log('не Windows или нет Git for Windows — пропуск'); process.exit(0); }

const top = mkdtempSync(join(tmpdir(), 'sm-run-ps1-'));
const box = join(top, 'слепок сервиса');   // пробел и кириллица в пути
// не cpSync: в Node 24 на Windows он пишет кириллицу имени папки кракозябрами
const copyDir = (from, to) => { mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) (e.isDirectory() ? copyDir : (a, b) => writeFileSync(b, readFileSync(a)))(join(from, e.name), join(to, e.name)); };
copyDir(CASE, box);
writeFileSync(join(top, 'clm-run.ps1'), '\uFEFF# Запускает скрипт в ограниченном режиме языка, как на корпоративной машине.\n' +
  '$script = $args[0]\n$rest = @($args | Select-Object -Skip 1)\n' +
  "$ExecutionContext.SessionState.LanguageMode = 'ConstrainedLanguage'\n& $script @rest\nexit $LASTEXITCODE\n");

// копия run.ps1 с пробой рядом: проба печатает CHECK_PREFIX и свои аргументы
const probe = join(top, 'ref');
mkdirSync(probe);
writeFileSync(join(probe, 'run.ps1'), readFileSync(RUN));
writeFileSync(join(probe, 'probe.sh'), 'printf \'[%s]\\n\' "${CHECK_PREFIX-}" "$@"\n');
const PROBE = join(probe, 'run.ps1');

const fwd = (p) => p.replace(/\\/g, '/');
const ps = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'];
const ENGINES = {
  'напрямую': (args, run = RUN) => ['powershell', [...ps, run, ...args]],
  'ConstrainedLanguage': (args, run = RUN) => ['powershell', [...ps, join(top, 'clm-run.ps1'), run, ...args]],
};
const call = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'buffer', env: { ...process.env, ...env } });
  return { rc: r.status, out: r.stdout, err: r.stderr.toString('utf8') };
};
// та же команда строкой из Git Bash с автоконвертацией путей MSYS, как у агента, чья оболочка — Git Bash
const { MSYS_NO_PATHCONV, MSYS2_ARG_CONV_EXCL, ...msysEnv } = process.env;
const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const viaGitBash = (cmd, args) => call(GITBASH, ['-c', [cmd, ...args].map(q).join(' ')], msysEnv);
const bash = (script, args, env = {}) => call(GITBASH, [fwd(join(REF, script)), ...args], env);

let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ок    ' : 'ПРОВАЛ'} ${name}${ok || !detail ? '' : ' — ' + detail}`); if (!ok) failures++; };
const lastLine = (b) => b.toString('utf8').trim().split(/\r?\n/).pop();

// эталон: check.sh у нарезанного, перечень добора — файлом
const ref = bash('check.sh', [fwd(join(box, 'opis.md')), fwd(join(box, 'draft.md'))],
  { CHECK_PARTS: fwd(join(box, 'parts')), CHECK_LISTS: fwd(join(box, 'dobor.md')) });
// перечни добора: у нарезанного — файл на автора рядом с CHECK_LISTS (dobor-голова.md …)
const lists = () => readdirSync(box).filter((f) => f.startsWith('dobor')).sort().map((f) => f + '\n' + readFileSync(join(box, f), 'utf8')).join('\n');
const dropLists = () => readdirSync(box).filter((f) => f.startsWith('dobor')).forEach((f) => rmSync(join(box, f)));
const refList = lists();
check('эталон bash: вывод есть, ДОБОР есть, перечни есть', ref.rc === 0 && /ДОБОР/.test(ref.out.toString('utf8')) && refList !== '', ref.err);
dropLists();

for (const [engine, mk] of Object.entries(ENGINES)) {
  const args = ['check.sh', `CHECK_PARTS=${join(box, 'parts')}`, `CHECK_LISTS=${join(box, 'dobor.md')}`, join(box, 'opis.md'), join(box, 'draft.md')];
  let r = call(...mk(args));
  check(`${engine}: вывод байт в байт как у bash`, r.rc === 0 && r.out.equals(ref.out), `rc=${r.rc} ${r.err.slice(0, 300)}`);
  check(`${engine}: перечни добора по переменной — те же файлы`, lists() === refList);
  dropLists();

  const out = join(box, 'вывод сверки.txt');
  r = call(...mk([...args, '--out', out]));
  check(`${engine}: --out — файл байт в байт, в поток ничего`, r.rc === 0 && existsSync(out) && readFileSync(out).equals(ref.out) && r.out.length === 0,
    `rc=${r.rc} поток=${r.out.length} ${r.err.slice(0, 300)}`);
  rmSync(out, { force: true }); dropLists();

  r = call(...mk([join(REF, 'check.sh'), join(box, 'opis.md'), join(box, 'draft.md')]));
  check(`${engine}: имя скрипта полным путём — работает`, r.rc === 0 && /== ЧЕРНОВИК draft\.md/.test(r.out.toString('utf8')), r.err.slice(0, 300));

  const bad = bash('check.sh', [fwd(join(box, 'нет такой.md')), fwd(join(box, 'draft.md'))]);
  r = call(...mk(['check.sh', join(box, 'нет такой.md'), join(box, 'draft.md')]));
  check(`${engine}: код возврата скрипта (${bad.rc}) — наружу`, bad.rc !== 0 && r.rc === bad.rc, `rc=${r.rc}`);

  r = call(...mk(['check.sh', join(box, 'opis.md'), join(box, 'draft.md')]), { SM_BASH: join(top, 'нет', 'bash.exe') });
  check(`${engine}: SM_BASH в пустоту — error no-git-bash`, r.rc === 2 && lastLine(r.out) === 'service-map: error no-git-bash', `rc=${r.rc} «${lastLine(r.out)}»`);

  r = call(...mk(['check.sh', join(box, 'opis.md'), join(box, 'draft.md')]), { SM_BASH: 'C:\\Windows\\System32\\bash.exe' });
  check(`${engine}: bash из System32 (WSL) не берётся`, r.rc === 2 && lastLine(r.out) === 'service-map: error no-git-bash', `rc=${r.rc} «${lastLine(r.out)}»`);

  r = call(...mk(['check.sh', join(box, 'opis.md'), join(box, 'draft.md')]), { SM_BASH: 'C:/Windows/System32/bash.exe' });
  check(`${engine}: bash из System32 с «/» — тоже не берётся`, r.rc === 2 && lastLine(r.out) === 'service-map: error no-git-bash', `rc=${r.rc} «${lastLine(r.out)}»`);

  r = call(...mk(['check.sh', `SM_BASH=${join(top, 'нет', 'bash.exe')}`, join(box, 'opis.md'), join(box, 'draft.md')]));
  check(`${engine}: SM_BASH словом после скрипта — в счёт (в пустоту — error no-git-bash)`, r.rc === 2 && lastLine(r.out) === 'service-map: error no-git-bash', `rc=${r.rc} «${lastLine(r.out)}»`);

  r = call(...mk(['check.sh', `SM_BASH=${GITBASH}`, join(box, 'opis.md'), join(box, 'draft.md')]), { SM_BASH: join(top, 'нет', 'bash.exe') });
  check(`${engine}: SM_BASH словом важнее окружения`, r.rc === 0 && /== ЧЕРНОВИК draft\.md/.test(r.out.toString('utf8')), `rc=${r.rc} ${r.err.slice(0, 300)}`);

  r = viaGitBash(...mk(['probe.sh', 'CHECK_PREFIX=/api', '/api', '/c/Users/x'], PROBE));
  check(`${engine}: из Git Bash — «/api» доходит как «/api», «/c/…» как «C:/…»`, r.rc === 0 && r.out.toString('utf8') === '[/api]\n[/api]\n[C:/Users/x]\n', `rc=${r.rc} «${r.out.toString('utf8').trim()}» ${r.err.slice(0, 300)}`);

  r = call(...mk(['probe.sh', 'out=1.md'], PROBE));
  check(`${engine}: «имя=значение» строчными — аргумент, а не переменная`, r.rc === 0 && r.out.toString('utf8') === '[]\n[out=1.md]\n', `rc=${r.rc} «${r.out.toString('utf8').trim()}»`);

  for (const s of ['nope.sh', 'run.ps1', '']) {
    r = call(...mk(s ? [s] : []));
    const want = s ? 'service-map: error unknown-script' : 'service-map: error usage';
    check(`${engine}: «${s || 'без аргументов'}» — ${want.split(' ').pop()}`, r.rc === 2 && lastLine(r.out) === want, `rc=${r.rc} «${lastLine(r.out)}»`);
  }
}

// оболочки агента: команда строкой через cmd и через PowerShell — вывод тот же
const line = ['powershell', ...ps, `"${RUN}"`, 'check.sh', `"CHECK_PARTS=${join(box, 'parts')}"`, `"${join(box, 'opis.md')}"`, `"${join(box, 'draft.md')}"`].join(' ');
const plain = call('powershell', [...ps, RUN, 'check.sh', `CHECK_PARTS=${join(box, 'parts')}`, join(box, 'opis.md'), join(box, 'draft.md')]);
let r = spawnSync('cmd.exe', ['/d', '/s', '/c', `"${line}"`], { encoding: 'buffer', windowsVerbatimArguments: true });
check('оболочка cmd: вывод как напрямую', r.status === 0 && r.stdout.equals(plain.out), `rc=${r.status}`);
r = spawnSync('powershell', ['-NoProfile', '-Command', `& ${line}`], { encoding: 'buffer' });
const crlf = (b) => b.toString('utf8').replace(/\r\n/g, '\n');
check('оболочка PowerShell: вывод как напрямую (концы строк не в счёт)', r.status === 0 && crlf(r.stdout) === crlf(plain.out), `rc=${r.status} ${r.stderr.toString('utf8').slice(0, 300)}`);

rmSync(top, { recursive: true, force: true });
console.log(failures ? `\nпровалов: ${failures}` : '\nвсё сошлось');
process.exit(failures ? 1 : 0);
