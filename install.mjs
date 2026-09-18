#!/usr/bin/env node
// Установщик скиллов: копирует папки agent-version/<скилл>/ (SKILL.md + reference/) в целевую папку.
//
//   npx github:Xoxxloma/sdd-skills                # → ./.gigacode
//   npx github:Xoxxloma/sdd-skills .claude/skills # → другая папка
//   npx github:Xoxxloma/sdd-skills#<ветка>        # конкретная ветка или тег
//
// Стенд (_skill-eval), CHANGELOG и планы не копируются: агенту они не нужны и весят больше скиллов.
// Повторный запуск обновляет установленные скиллы на месте; чужие папки в целевой не трогает.
import { readdirSync, existsSync, statSync, mkdirSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), 'agent-version');
const DEST = resolve(process.cwd(), process.argv[2] || '.gigacode');

const skills = readdirSync(SRC).filter((d) => {
  const p = join(SRC, d);
  return statSync(p).isDirectory() && !d.startsWith('_') && existsSync(join(p, 'SKILL.md'));
});
if (!skills.length) { console.error(`в ${SRC} нет папок со SKILL.md`); process.exit(1); }

mkdirSync(DEST, { recursive: true });
const rows = [];
for (const name of skills) {
  const from = join(SRC, name), to = join(DEST, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  const text = readFileSync(join(to, 'SKILL.md'), 'utf8'); const head = text.startsWith('---') ? text.slice(3, text.indexOf('\n---', 3)) : '';
  const version = (head.match(/^version:\s*(\S+)/m) || [, '—'])[1];
  rows.push([name, version]);
}
const w = Math.max(...rows.map(([n]) => n.length));
console.log(`установлено в ${DEST}: ${rows.length} скиллов`);
for (const [n, v] of rows) console.log(`  ${n.padEnd(w)}  ${v}`);
console.log('точка входа — analyst-workspace; остальные вызывает он сам.');
