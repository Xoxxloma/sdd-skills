#!/usr/bin/env node
// skills.mjs — установить или обновить скиллы одной командой, кроссплатформенно (Windows, macOS, Linux):
//
//   node tools/skills.mjs                 # → ./.gigacode
//   node tools/skills.mjs .claude/skills  # → другая папка
//
// То же, что tools/skills.sh, но без bash: клонирует репозиторий со скиллами во временную папку и
// запускает его install.mjs. Нужны git и node 12+. Адрес и ветка — переменные SDD_SKILLS_REPO и
// SDD_SKILLS_REF; адрес по умолчанию задан ниже. Скопируйте файл в свой репозиторий со спеками.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmdirSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = process.env.SDD_SKILLS_REPO || 'https://onework.sigma.sbrf.ru.sc/ai-security-department/AI-SDD-SKILLS.git';
const REF = process.env.SDD_SKILLS_REF || '';
const DEST = process.argv[2] || '.gigacode';

const major = Number(process.versions.node.split('.')[0]);
if (major < 12) { console.error(`нужен node 12+, найден ${process.version}`); process.exit(1); }

const src = mkdtempSync(join(tmpdir(), 'sdd-skills-'));
const rmDir = (p) => { if (!existsSync(p)) return; if (fs.rmSync) fs.rmSync(p, { recursive: true, force: true }); else rmdirSync(p, { recursive: true }); };
try {
  console.log(`скиллы: ${REPO}${REF ? ' #' + REF : ''}`);
  execFileSync('git', ['clone', '-q', '--depth', '1', ...(REF ? ['--branch', REF] : []), REPO, src], { stdio: 'inherit' });
  const installer = join(src, 'install.mjs');
  if (!existsSync(installer)) { console.error('в репозитории со скиллами нет install.mjs в корне'); process.exit(1); }
  execFileSync(process.execPath, [installer, DEST], { stdio: 'inherit' });
} finally {
  rmDir(src);
}
