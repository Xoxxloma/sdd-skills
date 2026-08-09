// Прогон, записавший файл ЗА пределы своей песочницы, — отказ стенда, а не нарушение скилла.
//
//   node check-escape.mjs <папка-песочницы>      # ставит _escaped.txt, если утёк
//   node check-escape.mjs <плечо> --scan         # проверяет все run-* плеча, ничего не пишет
//
// ЗАЧЕМ. 2026-08-08: `readybt-p4/run-11` не нашёл `task-decomposition-doc` в реестре песочницы,
// сделал разрез сам и записал три детских БТ по абсолютным путям в `_skill-eval/fixtures/`.
// Последствий два, и оба хуже самого факта: испорченный вход для всех последующих плеч и
// негодное измерение для этого. Пункт «оркестратор сам файлов не пишет» на таком прогоне
// красный, но красный он не про скилл.
//
// Разбираем ТОЛЬКО JSON и ТОЛЬКО пишущие вызовы: `Read`, `Glob` и загрузка скилла законно
// несут пути наружу песочницы (сам скилл лежит в репозитории), и проверка регуляркой по
// сырому потоку пометила бы каждый прогон.

import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WRITERS = new Set(['Write', 'Edit', 'NotebookEdit']);

// Пути в потоке приезжают в трёх видах: `C:\...`, `/c/...` и относительные. Приводим к одному:
// нижний регистр, прямые слэши, срезанный префикс диска.
const norm = (p) => String(p || '')
  .replace(/\\/g, '/')
  .replace(/^([a-zA-Z]):\//, '/$1/')
  .replace(/^\/([a-zA-Z])\//, '/$1/')
  .toLowerCase();

export function escapedWrites(sandboxDir) {
  const stream = join(sandboxDir, 'stream.jsonl');
  const files = existsSync(stream)
    ? [stream]
    : ['turn1.jsonl', 'turn2.jsonl'].map((f) => join(sandboxDir, f)).filter(existsSync);
  if (!files.length) return null;

  const inside = norm(resolve(sandboxDir));
  const out = [];
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const s = line.trim();
      if (!s.startsWith('{')) continue;
      let e;
      try { e = JSON.parse(s); } catch { continue; }
      const c = e?.message?.content;
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (b?.type !== 'tool_use' || !WRITERS.has(b.name)) continue;
        const p = b.input?.file_path ?? b.input?.path ?? b.input?.notebook_path ?? '';
        const np = norm(p);
        // Относительный путь разрешается от рабочей директории, а она и есть песочница.
        if (!np || (!np.startsWith('/') && !/^[a-z]:/.test(norm(p)))) continue;
        if (!np.startsWith(inside)) out.push(`${b.name}\t${p}`);
      }
    }
  }
  return out;
}

const args = process.argv.slice(2);
const target = args[0];
if (!target) { console.log('нужен путь'); process.exit(0); }

if (args.includes('--scan')) {
  let bad = 0;
  for (const r of readdirSync(target).filter((f) => /^run-\d+$/.test(f)).sort()) {
    const d = join(target, r);
    if (!statSync(d).isDirectory()) continue;
    const esc = escapedWrites(d);
    if (esc && esc.length) { bad++; console.log(`УТЁК ${d}\n  ${esc.join('\n  ')}`); }
  }
  console.log(bad ? `утёкших прогонов: ${bad}` : `утёкших нет: ${target}`);
  process.exit(0);
}

const esc = escapedWrites(target);
if (esc && esc.length) {
  writeFileSync(join(target, '_escaped.txt'),
    `утёк за песочницу ${target}\n${esc.join('\n')}\n`, 'utf8');
  console.log(`  УТЁК ЗА ПЕСОЧНИЦУ, помечен, в счёт не идёт: ${target}`);
}
