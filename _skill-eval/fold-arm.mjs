#!/usr/bin/env node
// fold-arm.mjs — свернуть плечо без грейдера в ОДИН файл, ничего не потеряв.
//
//   node _skill-eval/fold-arm.mjs <плечо> [--apply]
//
// ЗАЧЕМ ИМЕННО СВЕРНУТЬ, А НЕ ГРЕЙДИТЬ. У части плеч раунда `2026-08-06-refactor` (br1, br2,
// bs1, q1) грейдера не существует, а написать его задним числом, не зная точной формулировки
// пробы, значит выдать правдоподобные числа неизвестной верности. По правилу репы грейдер
// обязан валидироваться на известном результате; здесь известного результата нет. Числа,
// которые нельзя проверить, хуже отсутствия чисел — на них потом сошлются.
//
// Поэтому здесь не вердикт, а компактификация: 10 файлов по прогону → 1 файл на плечо, текст
// ответов сохраняется ДОСЛОВНО и целиком. Плюс механическая шапка по каждому прогону — только
// то, что видно из файловой системы и не требует суждения:
//   - какие документы прогон записал (это и есть ответ проб семейства BR: «пишет или спрашивает»);
//   - длина ответа и есть ли в нём вопросительные знаки (грубый признак «спросил, а не написал»).
//
// Считать это грейдом нельзя, и в шапке файла так и написано.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';

const arm = process.argv[2];
const apply = process.argv.includes('--apply');
if (!arm || !existsSync(arm)) { console.error('нужна папка плеча'); process.exit(1); }

const runs = readdirSync(arm).filter((f) => /^run-\d+$/.test(f)).sort();
if (!runs.length) { console.error('в папке нет прогонов run-NN'); process.exit(1); }

function docsOf(dir) {
  const out = [];
  (function walk(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (n.endsWith('.md')) out.push(`${relative(dir, p).replace(/\\/g, '/')} (${st.size} б)`);
    }
  })(join(dir, 'docs'));
  return out;
}

const parts = [];
const head = [];
for (const r of runs) {
  const d = join(arm, r);
  const ans = existsSync(join(d, 'answer.md')) ? readFileSync(join(d, 'answer.md'), 'utf8') : '';
  const docs = docsOf(d);
  head.push(`| ${r} | ${docs.length ? docs.join('; ') : '—'} | ${ans.length} | ${(ans.match(/\?/g) || []).length} |`);
  parts.push(`## ${r}\n\n**записал:** ${docs.length ? docs.join('; ') : 'ничего'}\n\n${ans || '_(ответа нет)_'}`);
}

const body = `# ${arm} — свёрнутое плечо

**Это НЕ отчёт грейдера.** Для этой пробы грейдера не существует, и вердикт здесь не выносится.
Ниже — механические признаки, видимые из файловой системы, и дословные ответы всех прогонов.
Кто будет разбирать: числа в таблице ничего не доказывают, читать надо ответы.

| прогон | записанные документы | длина ответа | «?» в ответе |
|---|---|---|---|
${head.join('\n')}

Прогонов: ${runs.length}. Свёрнуто при уборке 2026-08-07; исходные папки \`run-NN\` удалены,
их единственное содержимое (\`answer.md\` и записанные документы) перенесено сюда.

---

${parts.join('\n\n---\n\n')}
`;

const out = `${arm}-ANSWERS.md`;
if (apply) {
  writeFileSync(out, body, 'utf8');
  for (const r of runs) rmSync(join(arm, r), { recursive: true, force: true });
  try { if (!readdirSync(arm).length) rmSync(arm, { recursive: true, force: true }); } catch {}
}
console.log(`${apply ? 'свёрнуто' : 'план'}: ${arm} — ${runs.length} прогонов → ${out}`);
