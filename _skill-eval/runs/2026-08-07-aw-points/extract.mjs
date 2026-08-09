// Вытопка прогонов раунда aw-points: из stream.jsonl в три плоских файла.
//
//   node extract.mjs [плечо ...]        # по умолчанию — все *-arm/ в этой папке
//
// answer.md      — ВЕСЬ текст ассистента хода, все сообщения подряд.
//                  Не только финальное: в раунде aw-review чтение одного финального
//                  сообщения дало ложный вывод «9 из 15 промолчали».
// _tools.txt     — последовательность имён вызовов, через пробел (формат grade-aw.mjs).
// _tools_args.txt — то же, но с аргументом: без него не отличить, ЧТО отдали приёмке.
//                  Первая редакция вытопки в раунде aw-review писала только имена, и две
//                  проверки по тем папкам больше не пересчитываются вовсе.

import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ARG_KEYS = ['skill', 'file_path', 'path', 'pattern', 'subagent_type', 'description', 'prompt'];

function argOf(name, input) {
  if (!input || typeof input !== 'object') return '';
  // У СУБАГЕНТА ПУТЬ ЛЕЖИТ В `prompt`, А НЕ В `description`. Раньше сюда попадало первое
  // непустое поле по списку, то есть `description` — короткая русская подпись вроде
  // «Проверить индекс этапов по чек-листу», в которой имени файла нет вовсе. Анкер, считающий
  // по этой строке, недосчитывает: 2026-08-08 плечо `stages` показало «индекс отдан 3/10» там,
  // где субагент его читал в семи прогонах. Правило репы «грейдить файл, а не формулировку»
  // здесь читается как «грейдить промпт субагента, а не его подпись».
  if (name === 'Agent') {
    const d = typeof input.description === 'string' ? input.description : '';
    const p = typeof input.prompt === 'string' ? input.prompt : '';
    return `${d} | ${p}`.replace(/\s+/g, ' ').slice(0, 600);
  }
  for (const k of ARG_KEYS) {
    if (typeof input[k] === 'string' && input[k]) {
      return input[k].replace(/\s+/g, ' ').slice(0, 200);
    }
  }
  return '';
}

function extractOne(dir) {
  const p = join(dir, 'stream.jsonl');
  if (!existsSync(p)) return false;

  // НЕДОЕХАВШИЙ ПРОГОН НЕ ВЫТАПЛИВАЕТСЯ. Поток без терминального события `result` — это
  // прогон, оборванный на середине хода (пул сняли, процесс убили, таймаут). Его текст
  // обрывается там, где агент ещё не дошёл до приёмки, и грейдер честно печатает «НЕТ»
  // по всем пунктам — то есть оборванный прогон выглядит снаружи ровно как провал скилла.
  // Правило репы «грейд только после того, как отработали ВСЕ прогоны» держится на этом
  // условии: без него «все» определяется по наличию файла, а не по завершённости.
  // Метку недоезда ставит раннер — он единственный видит код возврата и нотис CLI об
  // обрыве фоновых задач. Проверять по содержимому потока нельзя: приёмка поднимает
  // субагентов ФОНОВОЙ задачей, каждая из них кладёт в поток свой `result`, и условие
  // «есть терминальный result» у оборванного на середине хода выполняется.
  if (existsSync(join(dir, '_incomplete.txt'))) {
    console.log(`  пропуск (помечен недоехавшим): ${dir}`);
    return false;
  }
  const raw = readFileSync(p, 'utf8');
  if (!raw.includes('"type":"result"')) {
    console.log(`  пропуск (нет терминального result): ${dir}`);
    return false;
  }

  const text = [];
  const tools = [];
  const withArgs = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    let e;
    try { e = JSON.parse(s); } catch { continue; }
    const c = e?.message?.content;
    if (Array.isArray(c)) {
      for (const b of c) {
        // ТОЛЬКО СВОИ СЛОВА АГЕНТА. Первая редакция брала текстовые блоки из ЛЮБОГО
        // сообщения, включая `user`, — а туда приезжает результат загрузки скилла и отчёты
        // субагентов. В `readybt-p4/run-04` это 11 385 чужих символов против 1 004 своих.
        // Пункт «результат назван» ищет «приёмк» и «нарушени»: оба слова стоят в тексте
        // самого `spec-review`, значит пункт зеленел от факта ЗАГРУЗКИ скилла, а не от
        // того, что агент что-то сказал. Правило репы «грейдить файл, а не формулировку»
        // здесь означает «грейдить речь агента, а не то, что ему прислали».
        if (b?.type === 'text' && b.text && e.type === 'assistant') text.push(b.text);
        if (b?.type === 'tool_use') {
          const name = b.name === 'Skill' ? `Skill:${b.input?.skill}` : b.name;
          tools.push(name);
          withArgs.push(`${name}\t${argOf(b.name, b.input)}`);
        }
      }
    }
  }
  writeFileSync(join(dir, 'answer.md'), text.join('\n\n'), 'utf8');
  writeFileSync(join(dir, '_tools.txt'), tools.join(' '), 'utf8');
  writeFileSync(join(dir, '_tools_args.txt'), withArgs.join('\n'), 'utf8');
  return true;
}

const arms = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('.').filter((f) => /-arm$/.test(f) && statSync(f).isDirectory());

let n = 0;
for (const arm of arms) {
  if (!existsSync(arm)) { console.log(`нет плеча: ${arm}`); continue; }
  for (const r of readdirSync(arm).filter((f) => /^run-\d+$/.test(f)).sort()) {
    if (extractOne(join(arm, r))) n++;
  }
}
console.log(`извлечено прогонов: ${n} (плечи: ${arms.join(', ') || '—'})`);
