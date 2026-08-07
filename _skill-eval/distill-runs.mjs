#!/usr/bin/env node
// distill-runs.mjs — вытопить из песочниц то, что нужно для перегрейда, и выбросить остальное.
//
//   node _skill-eval/distill-runs.mjs <папка> [--apply]
//
// Без --apply только показывает, что будет сделано.
//
// ЧТО СОХРАНЯЕТСЯ ИЗ ПОТОКА (`*.jsonl`), для каждого — рядом с ним:
//   <base>.text.md   — ВЕСЬ текст ассистента, все сообщения хода подряд, не только финальное.
//   <base>.tools.txt — последовательность вызовов инструментов.
//
// **Весь текст, а не финальное сообщение — это не перестраховка.** В раунде 2026-08-07 я трижды
// мерил по слишком узкому срезу, и третий раз стоил ложного вывода: `claude -p` отдаёт как
// `result` только последнее сообщение хода, а строку приёмки оркестратор говорит раньше и потом
// продолжает работать. По финалу вышло «9 из 15 промолчали», по всему тексту — «промолчал 0».
// Сохранив только финал, я бы заморозил эту ошибку навсегда и никакой перегрейд её не поймал бы.
//
// ЧТО УДАЛЯЕТСЯ (восстановимо пересборкой песочницы):
//   *.jsonl            — сырой поток, из него уже вытоплено всё нужное
//   .claude/           — копия скилла, засеянная стендом в каждую песочницу
//   файлы, ПЕРЕЧИСЛЕННЫЕ В `_seeded.txt` — то есть ровно вход прогона
//   _stderr.log, _e*.log, сам _seeded.txt
//
// **`docs/` ЦЕЛИКОМ НЕ УДАЛЯЕТСЯ, И ЭТО ГЛАВНОЕ ПРАВИЛО ЭТОГО СКРИПТА.** В половине проб репы
// измеряемый артефакт — это и есть файл в `docs/`: пробы BR-3/BR-4 спрашивают «запишет ли скилл
// бизнес-требования», и `docs/CAF-318/business_requirements.md` в песочнице написан скиллом, а не
// засеян. В `runs/2026-08-06-refactor` файла засева нет вовсе — там ВСЁ содержимое `docs/` есть
// выход прогона. У меня в `arm-A-auto` засеян только БТ, а `technical_specification.md` создан
// прогоном, и по нему считалось, доехал ли прогон до конца.
// Отличить вход от выхода можно только по `_seeded.txt`. Нет его — считаем всё выходом и не
// трогаем: потерять измеренный артефакт дороже, чем оставить лишний мегабайт.
//
// НЕ ТРОГАЕТСЯ НИЧЕГО ПРОЧЕГО: answer.md, отчёты, STATE.md, промпты, _arms/, снимки скиллов.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const root = process.argv[2];
const apply = process.argv.includes('--apply');
if (!root || !existsSync(root)) { console.error('нужна существующая папка'); process.exit(1); }

const KILL_FILES = /^(_stderr\.log|_e\d\.log)$/;

let distilled = 0, killedFiles = 0, killedDirs = 0, bytes = 0, keptOutputs = 0;

// Песочница = папка, где лежит поток или answer.md. В ней и только в ней действует засев.
function seededOf(dir) {
  const p = join(dir, '_seeded.txt');
  if (!existsSync(p)) return null;
  return new Set(readFileSync(p, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
}

// Удаляет из песочницы ровно засеянное; всё прочее — выход прогона, остаётся.
function dropSeeded(sandbox) {
  const seeded = seededOf(sandbox);
  if (!seeded) return;                       // засева не было → всё содержимое есть выход
  for (const rel of seeded) {
    const p = join(sandbox, rel);
    if (!existsSync(p)) continue;
    let st; try { st = statSync(p); } catch { continue; }
    if (!st.isFile()) continue;
    bytes += st.size; killedFiles++;
    if (apply) rmSync(p, { force: true });
  }
  const sp = join(sandbox, '_seeded.txt');
  if (existsSync(sp)) { killedFiles++; if (apply) rmSync(sp, { force: true }); }
  // пустые каталоги после удаления входа
  if (apply) for (const d of ['docs', 'services', '.claude']) {
    const p = join(sandbox, d);
    try { if (existsSync(p) && readdirSync(p).length === 0) rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

function distill(p) {
  let text = [], tools = [];
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const s = l.trim(); if (!s.startsWith('{')) continue;
    let e; try { e = JSON.parse(s); } catch { continue; }
    const c = e?.message?.content;
    if (Array.isArray(c)) for (const b of c) {
      if (b?.type === 'tool_use') {
        const i = b.input ?? {};
        // ИМЯ БЕЗ АРГУМЕНТА БЕСПОЛЕЗНО ДЛЯ ПОЛОВИНЫ ПРОВЕРОК. Первая редакция сохраняла
        // только имена — и `grade-trigger.mjs`, который смотрит, ЧТО именно прочитано и
        // записано (артефакт или чек-лист), после вытопки перестал воспроизводиться.
        // Данные к тому моменту уже были удалены. Аргумент пишется рядом с именем.
        const arg = i.skill ?? i.file_path ?? i.path ?? i.pattern ?? '';
        tools.push(arg ? `${b.name}\t${arg}` : b.name);
      }
      if (e.type === 'assistant' && b?.type === 'text' && b.text) text.push(b.text);
    }
  }
  const base = join(dirname(p), basename(p).replace(/\.jsonl$/, ''));
  if (apply) {
    writeFileSync(`${base}.text.md`, text.join('\n\n---\n\n'), 'utf8');
    writeFileSync(`${base}.tools.txt`, tools.join('\n'), 'utf8');
  }
  distilled++;
}

function walk(dir) {
  const names = readdirSync(dir);
  const isSandbox = names.some((n) => n.endsWith('.jsonl') || n === 'answer.md' || n === '_seeded.txt');

  for (const name of names) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      // Копия скилла в песочнице всегда есть копия — её источник в репозитории.
      if (name === '.claude') {
        killedDirs++;
        if (apply) rmSync(p, { recursive: true, force: true });
        continue;
      }
      if (isSandbox && (name === 'docs' || name === 'services')) { keptOutputs++; continue; }
      walk(p);
    } else {
      if (name.endsWith('.jsonl')) {
        bytes += st.size; distill(p); killedFiles++;
        if (apply) rmSync(p, { force: true });
      } else if (KILL_FILES.test(name)) {
        bytes += st.size; killedFiles++;
        if (apply) rmSync(p, { force: true });
      }
    }
  }
  if (isSandbox) dropSeeded(dir);
}

walk(root);
console.log(`${apply ? 'СДЕЛАНО' : 'ПЛАН (без --apply)'} по ${root}`);
console.log(`  потоков вытоплено в .text.md + .tools.txt : ${distilled}`);
console.log(`  файлов удалено                            : ${killedFiles}`);
console.log(`  папок-копий удалено                       : ${killedDirs}`);
console.log(`  освобождено примерно                      : ${(bytes / 1048576).toFixed(1)} МБ (без учёта .claude)
  папок docs|services СОХРАНЕНО как выход      : ${keptOutputs}`);
