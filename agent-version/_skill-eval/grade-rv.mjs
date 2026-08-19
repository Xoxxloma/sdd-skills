// Грейдер проб RV — приёмка артефактов скиллом `spec-review`.
// Ключи ответов — `keys/RV-CLEAN.md`, `keys/RV-DIRTY.md`, `keys/RV-LOOP.md`.
//
// Грейдится ФАЙЛ отчёта (outputs/report.md), а не формулировка в чате: урок репы —
// на одной и той же пробе грейд по отчёту и грейд по файлам расходились втрое.
//
// Регулярки только литеральные. Собирать их из строк здесь нельзя: `\Z` в JS — это буква Z,
// и на этом уже терялись пятнадцать пунктов (см. память «Ловушки стенда»).
//
// Запуск: node agent-version/_skill-eval/grade-rv.mjs <папка-итерации>
// Раскладка: <итерация>/eval-N-<вид>/<любая-папка-прогона>/outputs/report.md
// Виды: spec-dirty | spec-clean | spec-loop | bt-design | bt-clean | stage-cut | stage-clean

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const iterDir = process.argv[2];
if (!iterDir) {
  console.error('нужен путь к папке итерации');
  process.exit(1);
}

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ---------------------------------------------------------------- разбор отчёта

// Объявленное число нарушений. Две законные формы, обе описаны в скилле:
// счётная строка «нарушений: N» и прозаическое «нарушений записанных правил нет».
function declaredCount(t) {
  const m = t.match(/нарушени[^\n:]*:\s*(\d+)/i);
  if (m) return Number(m[1]);
  if (/нарушени[^.\n]*(нет|не найдено|не обнаружено|отсутству)/i.test(t)) return 0;
  return null;
}

// Счётная строка «утверждений, стоящих только на памяти аналитика: N».
function memoryCount(t) {
  const m = t.match(/на памяти аналитика[^\n\d]*(\d+)/i);
  return m ? Number(m[1]) : null;
}

// Число отвеченных вопросов исполнителя: «ответов из файла: K из 10».
function answersOutOfTen(t) {
  const m = t.match(/(\d+)\s*(?:из|\/)\s*10/);
  return m ? Number(m[1]) : null;
}

// Есть ли в отчёте хоть одна цитата из файла — признак, что файл открывали.
function hasQuotes(t) {
  return /[«"`][^\n«"`]{12,}[»"`]/.test(t);
}

// Эхо-строка приёма: без неё чек-лист мог быть не открыт вовсе.
function hasEcho(t) {
  return /чек-лист прочитан/i.test(t);
}

// Сработал ли пункт 10 (открытая развилка). Единственный наблюдаемый след — слово «развилка»
// из его рекомендации. Символ ❓ для этого не годится: он бывает в цитате легенды.
function flaggedFork(t) {
  return /развилк/i.test(t);
}

// ---------------------------------------------------------------- проверки по видам

const CHECKS = {
  // ---- спека с нарушениями класса «выдумка и трассировка» (RV-DIRTY)
  'spec-dirty'(t) {
    const tokens = {
      int3: /INT-3/.test(t),
      valid: /к валидации/i.test(t),
      int1: /INT-1/.test(t),
      provenance: /[Пп]роисхождени/.test(t),
      fr2: /FR-2/.test(t),
      status: /Готово к оценке/.test(t),
    };
    return {
      'RV-1.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-1.1 конкретика под «к валидации» найдена (INT-3)': tokens.int3 && tokens.valid,
      'RV-1.2 карточка без пометки происхождения найдена (INT-1)': tokens.int1 && tokens.provenance,
      'RV-1.3 FR-2 без строки приёмки в §7 найден': tokens.fr2,
      'RV-1.4 статус вне словаря спеки найден': tokens.status,
      'RV-1.5 объявлено ровно 4 нарушения': declaredCount(t) === 4,
      'RV-1.6 счётная строка = 1 (INT-2 не в перечне)': memoryCount(t) === 1,
      'RV-1.7 в отчёте есть цитаты из файла': hasQuotes(t),
      'RV-1.8 легенда ❓ не объявлена развилкой': !flaggedFork(t),
      _detail: `нарушений=${declaredCount(t)} память=${memoryCount(t)}`,
    };
  },

  // ---- корректная спека: контроль на ложные срабатывания (RV-CLEAN)
  'spec-clean'(t) {
    const n = declaredCount(t);
    return {
      'RV-2.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-2.1 нарушений объявлено 0': n === 0,
      'RV-2.2 счётная строка = 1': memoryCount(t) === 1,
      'RV-2.3 INT-2 не объявлена нарушением': !(n > 0 && /INT-2/.test(t)),
      'RV-2.4 легенда ❓ не объявлена развилкой': !flaggedFork(t),
      _detail: `нарушений=${n} память=${memoryCount(t)}`,
    };
  },

  // ---- спека с дефектом живого прогона петли (RV-LOOP)
  'spec-loop'(t) {
    const int1 = /INT-1/.test(t);
    return {
      'RV-7.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-7.1 статус вне словаря спеки найден': /Готово к оценке/.test(t),
      'RV-7.2 🟢 без транспорта найден': int1 && /транспорт|метод и путь|путь[^\n]*не|нет[^\n]*(?:пути|метода)|Контракт \(запрос\)/i.test(t),
      'RV-7.3 🟢 без примера ответа найден': int1 && /пример|json/i.test(t),
      'RV-7.4 🟢 без авторизации найден': /авториз|кто вправе|доступ[^\n]*не (?:задан|определ|указан)/i.test(t),
      'RV-7.5 объявлено ровно 4 нарушения': declaredCount(t) === 4,
      'RV-7.6 счётная строка = 1': memoryCount(t) === 1,
      'RV-7.7 в отчёте есть цитаты из файла': hasQuotes(t),
      'RV-7.8 легенда ❓ не объявлена развилкой': !flaggedFork(t),
      _detail: `нарушений=${declaredCount(t)} память=${memoryCount(t)}`,
    };
  },

  // ---- БТ с проектированием и TBD (RV-DIRTY)
  'bt-design'(t) {
    const design = [
      ['POST /api/bookings', /\/api\/bookings/.test(t)],
      ['Kafka', /Kafka/i.test(t)],
      ['BookingDto', /BookingDto/.test(t)],
      ['IN_PROGRESS', /IN_PROGRESS/.test(t)],
    ];
    const hit = design.filter(([, ok]) => ok);
    return {
      'RV-3.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-3.1 названо >=3 из 4 технических токенов': hit.length >= 3,
      'RV-3.2 названы все 4 токена': hit.length === 4,
      'RV-3.3 TBD при закрытом статусе найден': /TBD/.test(t) && /Готово к оценке/.test(t),
      // Токены можно вынести одним пунктом или четырьмя — обе формы законны, поэтому
      // проверяем нижнюю границу, а не точное число. Точное число здесь наказывало бы
      // более подробный отчёт.
      'RV-3.4 объявлено >= 2 нарушений': (declaredCount(t) ?? 0) >= 2,
      'RV-3.5 в отчёте есть цитаты из файла': hasQuotes(t),
      _detail: `токенов=${hit.length}/4 (${hit.map(([n]) => n).join(', ')}) нарушений=${declaredCount(t)}`,
    };
  },

  // ---- корректный БТ: контроль на ложные срабатывания (RV-CLEAN)
  'bt-clean'(t) {
    const n = declaredCount(t);
    return {
      'RV-5.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-5.1 нарушений объявлено 0': n === 0,
      'RV-5.2 §4.5 «не применимо» не объявлена нарушением': !(n > 0 && /4\.5|слайс/i.test(t)),
      'RV-5.3 нет придуманных технических токенов': !/Kafka|BookingDto|IN_PROGRESS|\/api\//i.test(t),
      _detail: `нарушений=${n}`,
    };
  },

  // ---- файл задачи с дырами (RV-DIRTY)
  'stage-cut'(t) {
    // Главный якорь: путь /v1/rooms/occupancy в проверяемом файле ОТСУТСТВУЕТ.
    // Появился в отчёте — значит достроен из общих знаний, а не прочитан. Это красный,
    // даже если всё остальное верно.
    const invented = /\/v1\/rooms\/occupancy/.test(t) || /\/rooms\/occupancy/.test(t);
    const k = answersOutOfTen(t);
    // «в файле нет» именно про вопрос 1 (куда отдаю): ищем строку блока «без ответа»,
    // начинающуюся с единицы. Проверка на любое вхождение фразы засчитывала бы
    // вопросы 8 и 10 вместо первого.
    const gapQ1 = /^\s*1[.)]\s.*(в файле нет|нет в файле)/im.test(t);
    return {
      'RV-4.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-4.1 путь не достроен из общих знаний': !invented,
      'RV-4.2 счёт ответов K из 10 назван': k !== null,
      'RV-4.3 K = 7 (6 тоже принимается)': k === 7 || k === 6,
      'RV-4.4 вопрос 1 (куда отдаю) помечен «в файле нет»': gapQ1,
      'RV-4.5 названа нехватка авторизации': /авториз|вправе вызвать/i.test(t),
      'RV-4.6 названа нехватка секции «Чего этот этап НЕ делает»': /НЕ делает/.test(t),
      _detail: `K=${k} достроенный путь=${invented ? 'ДА' : 'нет'}`,
    };
  },

  // ---- ТИР B, ветка «автор»: самопроверка Шага 5 `technical-spec-doc` по своему же документу.
  // Проверяются ровно те же находки, что у приёмки, — форма отчёта другая (ни счётной строки,
  // ни эхо-строки у автора нет), поэтому формальные пункты сюда не входят. Сравнивается
  // ТОЛЬКО одно: назвал ли он настоящее нарушение своего документа.
  'author-loop'(t) {
    const int1 = /INT-1/.test(t);
    const found = [
      /Готово к оценке|статус/i.test(t) && /словар|Готово к разработке|Требуются уточнения/i.test(t),
      int1 && /транспорт|метод и путь|Контракт \(запрос\)|нет[^\n]*(?:пути|метода)|путь[^\n]*не/i.test(t),
      int1 && /пример|json/i.test(t),
      /авториз|кто вправе|доступ[^\n]*не (?:задан|определ|указан)/i.test(t),
    ];
    return {
      'RV-9.1 статус вне словаря спеки назван': found[0],
      'RV-9.2 🟢 без транспорта назван': found[1],
      'RV-9.3 🟢 без примера ответа назван': found[2],
      'RV-9.4 🟢 без авторизации назван': found[3],
      'RV-9.5 названо хотя бы одно из четырёх': found.some(Boolean),
      'RV-9.6 названы все четыре': found.every(Boolean),
      _detail: `нашёл ${found.filter(Boolean).length}/4`,
    };
  },

  'author-dirty'(t) {
    const found = [
      /INT-3/.test(t) && /к валидации/i.test(t),
      /INT-1/.test(t) && /[Пп]роисхождени/.test(t),
      /FR-2/.test(t),
      /Готово к оценке/.test(t),
    ];
    return {
      'RV-10.1 конкретика под «к валидации» названа (INT-3)': found[0],
      'RV-10.2 карточка без пометки происхождения названа (INT-1)': found[1],
      'RV-10.3 FR-2 без строки приёмки назван': found[2],
      'RV-10.4 статус вне словаря спеки назван': found[3],
      'RV-10.5 названо хотя бы одно из четырёх': found.some(Boolean),
      'RV-10.6 названы все четыре': found.every(Boolean),
      _detail: `нашёл ${found.filter(Boolean).length}/4`,
    };
  },

  // ---- прогон уровня СКИЛЛА: меряется оркестрация, а не детекция.
  // Эхо-строка здесь не проверяется: она стоит в ответе субагента, а в отчёт аналитику по
  // форме Шага 3 не входит. Проверка на неё красила бы верную работу — поймано на пилоте.
  // Делегирование наблюдается не отсюда, а грепом по транскрипту прогона (вызов Agent).
  orchestration(t) {
    return {
      'RV-8.1 форма отчёта: артефакт, тип, число': /артефакт:/i.test(t) && /тип:/i.test(t) && declaredCount(t) !== null,
      'RV-8.2 объявлено ровно 4 нарушения': declaredCount(t) === 4,
      'RV-8.3 счётная строка = 1': memoryCount(t) === 1,
      'RV-8.4 в отчёте есть цитаты из файла': hasQuotes(t),
      'RV-8.5 легенда ❓ не объявлена развилкой': !flaggedFork(t),
      'RV-8.6 INT-2 не объявлена нарушением': !/INT-2/.test(t),
      _detail: `нарушений=${declaredCount(t)} память=${memoryCount(t)}`,
    };
  },

  // ---- целый файл задачи: контроль на ложные срабатывания (RV-CLEAN)
  'stage-clean'(t) {
    const k = answersOutOfTen(t);
    return {
      'RV-6.0 эхо-строка «чек-лист прочитан»': hasEcho(t),
      'RV-6.1 K = 10': k === 10,
      'RV-6.2 ни один вопрос не помечен «в файле нет»': !/в файле нет/i.test(t),
      'RV-6.3 нехватки секций не заявлено': !/секций не хватает:\s*(?!нет)\S/i.test(t),
      'RV-6.4 транспорт процитирован из файла': /\/v1\/rooms\/occupancy/.test(t),
      _detail: `K=${k}`,
    };
  },
};

// ---------------------------------------------------------------- обход прогонов

const evalDirs = isDir(iterDir)
  ? readdirSync(iterDir).filter((f) => /^eval-\d+-/.test(f)).sort()
  : [];

if (!evalDirs.length) {
  console.error(`в ${iterDir} нет папок eval-N-*`);
  process.exit(1);
}

const summary = [];

for (const ed of evalDirs) {
  const kind = ed.replace(/^eval-\d+-/, '');
  const check = CHECKS[kind];
  if (!check) {
    console.error(`!! нет проверок для «${kind}» — пропускаю`);
    continue;
  }

  const evalPath = join(iterDir, ed);
  const runDirs = readdirSync(evalPath)
    .map((f) => join(evalPath, f))
    .filter((p) => isDir(p))
    .sort();

  const perCheck = new Map(); // имя проверки -> число прошедших
  let counted = 0;

  for (const runDir of runDirs) {
    const report = read(join(runDir, 'outputs', 'report.md'));
    if (!report.trim()) {
      // «не измерено ≠ провалено»: прогона нет — в знаменатель не идёт.
      console.error(`!! ${ed}/${runDir.split(/[\\/]/).pop()}: отчёта нет, не грейдится`);
      continue;
    }
    const res = check(report);
    const detail = res._detail;
    delete res._detail;
    const entries = Object.entries(res);
    const passed = entries.filter(([, v]) => v).length;
    counted += 1;
    for (const [name, ok] of entries) perCheck.set(name, (perCheck.get(name) ?? 0) + (ok ? 1 : 0));

    console.log(`\n${ed} / ${runDir.split(/[\\/]/).pop()}  —  ${passed}/${entries.length}   ${detail}`);
    for (const [name, ok] of entries) console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);

    writeFileSync(
      join(runDir, 'grading.json'),
      JSON.stringify(
        {
          run_id: `${ed}-${runDir.split(/[\\/]/).pop()}`,
          expectations: entries.map(([text, ok]) => ({ text, passed: ok, evidence: detail })),
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  if (counted) summary.push({ eval: ed, counted, perCheck });
}

console.log('\n=== СВОДКА ПО ПУНКТАМ (прошло / прогонов) ===');
for (const s of summary) {
  console.log(`\n${s.eval}   прогонов: ${s.counted}`);
  for (const [name, ok] of s.perCheck) {
    const mark = ok === s.counted ? 'OK  ' : ok === 0 ? 'FAIL' : '~~~ ';
    console.log(`  ${mark} ${String(ok).padStart(2)}/${s.counted}  ${name}`);
  }
}
