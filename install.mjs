#!/usr/bin/env node
// Установщик скиллов: копирует папки <скилл>/ (SKILL.md + reference/) из .gigacode/ исходного репозитория в целевую папку.
//
//   npx github:Xoxxloma/sdd-skills                # → ./.gigacode
//   npx github:Xoxxloma/sdd-skills .claude/skills # → другая папка
//   npx github:Xoxxloma/sdd-skills#<ветка>        # конкретная ветка или тег
//
// Стенд (_skill-eval), CHANGELOG и планы не копируются: агенту они не нужны и весят больше скиллов.
// Повторный запуск обновляет установленные скиллы на месте; чужие папки в целевой не трогает.
// Нужен node 12+; зависимостей нет.
import * as fs from 'node:fs';
const { readdirSync, existsSync, statSync, mkdirSync, copyFileSync, readFileSync } = fs;
// fs.rmSync появился в node 14.14; до него — rmdirSync с recursive.
const rmDir = (p) => { if (!existsSync(p)) return; if (fs.rmSync) fs.rmSync(p, { recursive: true, force: true }); else fs.rmdirSync(p, { recursive: true }); };
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Скиллы в исходном репозитории лежат в .gigacode/ — той же папке, что и у аналитика.
// Копирование папки без fs.cpSync: его нет до node 16.7, а на рабочих станциях встречается node 12–14.
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const a = join(from, e.name), b = join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else copyFileSync(a, b);
  }
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), '.gigacode');
if (!existsSync(SRC)) { console.error(`рядом с install.mjs нет папки .gigacode/`); process.exit(1); }
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
  rmDir(to);
  copyDir(from, to);
  const text = readFileSync(join(to, 'SKILL.md'), 'utf8'); const head = text.startsWith('---') ? text.slice(3, text.indexOf('\n---', 3)) : '';
  const version = (head.match(/^version:\s*(\S+)/m) || [, '—'])[1];
  rows.push([name, version]);
}
const w = Math.max(...rows.map(([n]) => n.length));
console.log(`установлено в ${DEST}: ${rows.length} скиллов`);
for (const [n, v] of rows) console.log(`  ${n.padEnd(w)}  ${v}`);
console.log('точка входа — analyst-workspace; остальные вызывает он сам.');
