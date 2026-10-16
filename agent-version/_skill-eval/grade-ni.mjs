#!/usr/bin/env node
// grade-ni.mjs — пробы notes-to-intent: готовый список пунктов → вход для БТ или спеки (fixtures/NI-*).
//
//   node grade-ni.mjs <каталог проб> --fx VAC|ACC|NEW|CHG|CR|REW|MR-NEW|MR-CHG|NB-IN|NB-ANS|NB-PICK [--verbose]
//   node grade-ni.mjs --selftest
//
// Грейдится ФАЙЛ в песочнице: вход `<папка>/<основа списка>-(bt|spec).md` (notes-to-intent/reference/intent.md).
// Три слоя проверок:
// 1. Ожидания исходной пробы на том же материале, импортом: MEET → gradeInput (grade-meet.mjs), MR → gradeNEW /
//    gradeCHG (grade-mr.mjs), NB → gradeInputIN / gradeInputANS (grade-minb.mjs). Адаптации — у `gradeContent`.
// 2. Место КАЖДОГО пункта списка (`PTS`, после круга 2): карта «строка пункта → допустимые места», выведенная из
//    текста скилла (layout.md, check.md, intent.md, SKILL.md Шаги 4–7) и документов засева. Пункт во входе — в
//    допустимом разделе; не во входе — место берётся из ответов прогона (сводка Шага 6, вопрос Шага 5, отчёт: «для
//    спеки — K (…)», «уже записано — K (…)», «вне документов …», «не взяты», номера `P<n>`), последнее упоминание
//    старше; место не установлено — пропуск `[сведение]` и `[решено]`/`[открыто]`, у которых есть место во входе, —
//    красный.
// 3. Дословность (Шаг 7): «со слов <кто>» у сведения, пометки «по памяти» («не помню», «не уверен»), числа пункта
//    (в том числе «вместо 24»), роли в «решали:» / «решает:» только из шапки списка — красный; потерянные «решил:»,
//    «ждёт:», «(на встрече: …)» — предупреждение.
// Общие: вход ровно один и там, где велит intent.md; документы задачи и список байт в байт; лишних файлов нет; ссылок
// на источник (`L<n>`, `<дата> №<n>`) нет; в шапке `> Задача: <KEY> · цель: <цель>`; services/ и context/ не
// читались. Отказ API — «НЕ ИЗМЕРЕНО».

import { resolve as pathResolve, join, relative, basename } from 'node:path'
import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { gradeInput, FX as MEET } from './grade-meet.mjs'
import { gradeNEW, gradeCHG } from './grade-mr.mjs'
import { gradeInputIN, gradeInputANS } from './grade-minb.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const lf = (s) => s.replace(/\r\n/g, '\n')
const read = (p) => lf(readFileSync(p, 'utf8'))
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const yo = (s) => s.replace(/ё/g, 'е').replace(/Ё/g, 'Е')
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
// Граница слова для кириллицы — `(^|[^а-яё])`: `\b` в JS только ASCII.
const w = (stem, flags = 'i') => new RegExp('(^|[^а-яёa-z])' + stem, flags)
const any = (...rs) => ({ test: (s) => rs.some((r) => r.test(s)) })

// ---------- места ----------

const R = 'Решено'; const O = 'Открыто'; const N = 'Не входит'; const S = 'Сведения'; const X = 'Расходится с БТ'
const SEC = [R, O, N, S, X]
const OTHER = 'другой слой'; const DONE = 'уже записано'; const OUT = 'вне документов'; const THOUGHT = 'не взята'
const isSec = (p) => SEC.includes(p)

// Карта пунктов: номер строки списка → допустимые места (первое — основное) и ключ, по которому пункт узнаётся во входе
// и в сводке (все регулярки ключа — в одной строке входа или в одном куске сводки). `why` — почему мест несколько.
// Основание мест — правила скилла после круга 2:
// - слой БТ — что видит и может пользователь, в том числе при сбое; сведения о том, как бизнес работает сейчас;
//   кто заводит или обновляет данные, без которых требование не работает (layout.md);
// - спека — как сделано у нас: хранение, сервер, фон, повторы, заглушки, стенды; обмен с другими системами — подписка
//   на события, шина, запрос состояния (layout.md);
// - вне документов — только процесс команды: оценка, инструменты, встречи, статус документа (layout.md, check.md 2);
// - чужая система — «Сведения» в любом входе; `уже записано` — не во входе (intent.md);
// - во входе спеки пункта слоя БТ нет — «для БТ» (решение пользователя после круга 2: «спека делается на основании БТ»);
// - прямая пометка «(на встрече: …)» старше признаков (layout.md).
// `s` — ключ для сводки, если суть там короче, чем пункт во входе (иначе — `k`).
const P = (at, k, why, s) => ({ at, k, why, s })
export const PTS = {
  VAC: {
    6: P([DONE, S], [w('бумажн')], 'БТ §5.2: бумажные заявления с февраля, срок 31 января', [any(w('бумажн'), /31\s+январ/i)]),
    7: P([O], [any(w('груз'), w('загруж'), w('залива'))]),
    8: P([S], [any(/(^|\D)40(\D|$)/, w('сорок'))]),
    9: P([R, O], [w('директор'), w('генеральн')], 'Шаг 5: решил не заказчик — «Оставляем?» (в «Решено») или «В открытые вопросы»'),
    10: P([S], [any(/20\s*октябр/i, w('табельн'))]),
    11: P([DONE, S], [w('москов')], 'БТ §1.2: по московскому времени'),
    12: P([O], [w('ежегодн')]),
    13: P([OUT], [any(w('оценк'), w('откат'))]),
    14: P([OTHER], [any(/момент\s+нажат/i, w('нажавш'))]),
    15: P([R, OTHER, DONE], [any(w('живо'), /при\s+загрузк/i, /на\s+согласование/i)], 'видимое поведение (БТ, FR-7 молчит о живом обновлении) или «опрос» (спека)'),
    16: P([OTHER], [any(w('сервер'), /в\s+заявк/i)]),
    17: P([DONE, S], [w('праздник')], 'БТ FR-1, §3.2: календарные дни, праздники вне проекта'),
    18: P([DONE, S], [any(/задним\s+числом/i, /после\s+даты\s+начала/i)], 'БТ FR-8'),
    19: P([DONE, N], [w('начавш')], 'БТ §3.2: отзыв из начавшегося отпуска вне проекта'),
    20: P([R], [any(/FR-10/i, /в\s+день\s+(его\s+)?начала/i)]),
    21: P([S], [any(w('администратор'), /роль\s+кадровик/i)]),
    22: P([DONE, S], [any(/отдельн\S*\s+рол/i, /роли\s+руководител/i)], 'БТ §5.3, FR-7'),
    23: P([OTHER, OUT], [any(w('серы'), w('бейдж'))], 'пометка «не в требования» не называет документ', [any(w('серы'), w('бейдж'), w('цвет'), w('отозван'))]),
    24: P([DONE, N], [w('черновик')], 'БТ §3.2: удаление черновиков вне проекта'),
    25: P([DONE, R], [/только\s+согласованн/i], 'БТ FR-9'),
  },
  ACC: {
    6: P([S], [any(w('понедельник'), /8\s*[–-]\s*10/)]),
    7: P([S], [any(/429/, /20\s+запрос/i)]),
    8: P([R], [w('фонов')]),
    9: P([O, OTHER], [any(w('промежуточн'), /которого\s+в\s+БТ\s+нет/i, /«Согласована»/)], 'пометка встречи «в спецификацию» против слоя БТ — в обе стороны (решение пользователя 2026-10-15)'),
    10: P([R], [any(w('нараста'), w('дежурн'))]),
    11: P([R], [any(w('идентификатор'), /повторн\S*\s+заведени/i)]),
    12: P([S], [any(w('администратор'), w('админ'))]),
    13: P([OTHER], [any(/повторн\S*\s+заявк/i, /заблокированн\S*\s+уч[её]тк/i)], 'слой БТ: во входе спеки нет (после круга 2)'),
    14: P([S], [any(w('уволенн'), w('восстановленн'), /новый\s+логин/i)]),
    15: P([R], [any(/логин[^.;]{0,60}(хран|ответ)/i, /(хран|ответ)[^.;]{0,60}логин/i)]),
    16: P([R], [any(/при\s+открыти/i, /открыти\S*\s+заявк/i)]),
    17: P([OTHER], [any(/не\s+удалось/i, /отозвать\s+доступ/i)], 'что видит пользователь при сбое — слой БТ (после круга 2)'),
    18: P([R], [w('синхронн')]),
    19: P([R], [any(/повторн\S*\s+блокир/i, /422/, w('неактивн'))]),
    20: P([R], [w('признак')]),
    21: P([S, OTHER, X], [w('выгрузк')], 'чужая система (её коды) или зависимость от данных — слой БТ; меняет порядок ведения справочника из БТ — «Расходится с БТ» (intent.md)'),
    22: P([S], [w('токен')]),
    23: P([N], [w('подписк')], 'обмен с другими системами — спека (после круга 2)'),
    24: P([S, OUT], [w('стенд')], 'поведение чужой системы или инструмент команды'),
    25: P([R], [any(w('заглушк'), /для\s+тестов/i, w('мок'))]),
    26: P([DONE, OTHER], [any(/владел\S*[^.;]{0,40}смен/i, /смен\S*[^.;]{0,40}владел/i, /видит\s+новый/i)], 'БТ: заявки видит новый владелец'),
  },
  NEW: {
    6: P([S], [any(/общий\s+ящик/i, /(^|\D)300(\D|$)/, w('трёхсот'), w('трехсот'))]),
    7: P([R], [w('трудов')]),
    8: P([N, R], [/НДФЛ/i]),
    9: P([OTHER], [any(w('хранилищ'), /на\s+бэке/i)]),
    10: P([O], [w('подпис')]),
    11: P([OTHER], [any(/кадров\S*\s+систем/i, w('интеграц'), /дат\S*\s+при[её]ма/i)]),
    12: P([R], [/(3|тр[её]х|три)\s+рабоч/i]),
    13: P([R], [any(w('исполнител'), /все\s+специалист/i)]),
    14: P([R], [any(w('администратор'), /роль\s+специалист/i)]),
    15: P([N, R], [w('переназнач')]),
    16: P([R], [w('уведомлени')]),
    17: P([R], [w('отмен')]),
    18: P([S], [any(/30\s*%/, w('тридцат'))]),
    19: P([O], [any(/кто\s+готовит/i, /главн\S*\s+бухгалтер/i, w('главбух'))]),
    20: P([R], [any(/для\s+себя/i, /за\s+другого/i)]),
    21: P([N, R], [any(w('бывш'), w('уволен'))]),
    22: P([N, R], [w('курьер')]),
    23: P([S], [any(/шаблоны\s+справок\s+у/i, /шаблон\S*[^.;]{0,40}(есть|в\s+ворде)/i)]),
    24: P([R], [any(w('выбира'), w('выбор'), w('формат'))]),
  },
  CHG: {
    6: P([R], [any(/FR-3/i, w('ежегодн'))]),
    7: P([DONE, S], [w('праздник')], 'пометка «не меняется, так и в БТ»; БТ FR-1, §3.2'),
    8: P([R], [any(/FR-9/i, w('отмен[её]нн'))]),
    9: P([DONE, R], [any(w('ближайш'), w('сортир'))], 'пометка «остаётся, как в БТ»; БТ FR-7'),
    10: P([DONE, N], [w('черновик')], 'БТ §3.2'),
    11: P([OTHER], [any(w('бэк'), /раз\s+в\s+сутки/i, w('джоб'))]),
    12: P([R], [/(3|тр[её]х|три)\s+(год|лет)/i]),
  },
  CR: {
    // «Как сейчас» — в «Сведениях» или парой «как сейчас → как должно стать» в «Решено» (intent.md). Ключ во входе —
    // «если пользователь молчит» или «сейчас … календарных» в одной строке: «вместо трёх календарных» в пункте L40 —
    // его собственный «как сейчас», не этот пункт (круг 2, cr run-1: «закрывается автоматически через семь рабочих
    // вместо трёх календарных» без «как сейчас», а сам пункт — «вне документов»). В сводке суть короче — ключ по
    // «календарн».
    6: P([S, R], [any(w('молч'), /сейчас[^→.;]{0,80}календарн/i)], '«как сейчас» — в «Сведениях» или парой в «Решено»', [any(w('молч'), /календарн/i)]),
    7: P([R], [/(7|сем\S*)\s+рабоч/i]),
    8: P([R], [any(w('напомин'), w('письм'))]),
    9: P([N, R], [/В\s+работе/i]),
    10: P([OTHER], [w('производственн')]),
  },
  REW: {
    6: P([DONE, OTHER], [any(/не\s+ответил/i, w('промежуточн'), w('заблокир'))], 'слой БТ во входе спеки не идёт; в спеке — открытые вопросы 1, 2'),
    7: P([R], [any(/(5|пят\S*)\s*мин/i, w('вдвое'), w('удва'))]),
    8: P([R], [any(/portal-duty/i, w('дежурн'))]),
    9: P([R], [any(w('таймаут'), w('секунд'))]),
    10: P([R], [/к[эе]ш/i]),
    11: P([R], [w('флаг')]),
    12: P([DONE, OTHER], [w('мессенджер')], 'слой БТ, уже в БТ §3.2'),
    13: P([DONE], [any(w('идентификатор'), /повторн\S*\s+заведени/i, /E_ACC_DUP/)]),
    14: P([S, R], [w('доменн')]),
  },
  'MR-NEW': {
    6: P([THOUGHT], [any(/мест\S*\s+в\s+очеред/i, w('позици'))]),
    7: P([R], [any(/мест\s+нет/i, w('вста[её]т'), w('группов'))]),
    8: P([R], [w('пуш'), any(/30/, w('тридцат'), w('полчас'))]),
    9: P([R, N], [/SMS|СМС/i]),
    10: P([O], [w('лимит')]),
    11: P([O], [any(/нужен\s+ли/i, /на\s+платн/i, /платн\S*[^.;]{0,60}финанс/i)]),
    12: P([S], [any(/15\s*%/, w('пятнадцат'))]),
    13: P([O, OUT], [any(/к\s+которому/i, w('уточнит'), /к\s+какому\s+сроку/i)], 'срок поручения: процесс команды или ожидание ответа'),
    14: P([O], [any(w('закры'), /(2|два|двух)\s*час/i)]),
    15: P([OUT], [any(/начал\S*\s+встреч/i, w('экран'))]),
  },
  'MR-CHG': {
    6: P([THOUGHT], [any(w('предупрежд'), /осталась\s+одна/i, w('оставш'))]),
    7: P([R], [any(/12\s*час/i, w('двенадцат'))]),
    8: P([R], [w('лимит'), any(w('поменял'), w('измен'), /меня(ет|ем|ется|ют)/i)]),
    9: P([O], [/ДМС/]),
    10: P([O], [any(w('пуш'), /push/i)]),
    11: P([DONE, O, N], [w('колл')], 'БТ §2: колл-центр вне объёма'),
    12: P([O], [w('значени'), any(/жд[её]т/i, /жд[её]м/i)]),
    13: P([OUT, O, OTHER], [any(w('гусев'), w('сч[её]тчик'))], 'срок поручения; где хранится счётчик — спека'),
  },
  'NB-IN': {
    6: P([S], [any(w('возврат'), /не\s+принима/i)]),
    7: P([R], [any(w('оплат'), /плат[ия]т/i, w('денег'))]),
    8: P([THOUGHT], [any(/трек\S*[^.;]{0,40}чек/i, /чек[^.;]{0,40}трек/i)]),
    9: P([S], [/180/]),
    10: P([S], [any(/(^|\D)19/, w('машин'), w('забира'), w('вывоз'))]),
    11: P([O], [any(w('внутри'), w('вложени'), w('вскрыв'), w('содержим'))]),
    12: P([THOUGHT], [any(/экран\S*\s+оператор/i, w('наклейк'))]),
    13: P([R], [any(/только\s+в\s+пункт/i, /где\s+есть\s+вес/i, /с\s+весами/i, /не\s+во\s+всех/i)]),
    14: P([R, N], [any(/15\s*кг/i, w('пятнадцат'))]),
    15: P([S], [/1\s?200/]),
  },
  'NB-ANS': {
    6: P([S, R], [any(w('отказыва'), /не\s+принима/i)], '«как сейчас» — в «Сведениях» или парой в «Решено»'),
    7: P([R], [any(/принима\S*,?\s+если/i, /если\s+покупк/i, /в\s+истори\S*\s+(покупок\s+)?по\s+карт/i)]),
    8: P([R], [any(w('деньг'), /с\s+которой\s+(платил|оплач)/i)]),
    9: P([S], [any(w('касс[аеуы]'), /последн\S*\s+год/i, /12\s*месяц/i)]),
    10: P([S, R], [/отч[её]т/i], 'потребность бухгалтерии: сведение или требование'),
    11: P([O], [w('акт')]),
    12: P([R], [w('паспорт')]),
  },
}
PTS['NB-PICK'] = { ...PTS['NB-IN'], 12: P([O], PTS['NB-IN'][12].k) }

// ---------- фикстуры ----------

export const FX = {
  VAC: { src: 'meet', key: 'EMP-1207', kind: 'bt', folder: 'docs/EMP-1207', list: 'docs/EMP-1207/meeting-2026-10-07.points.md', goal: /^правки\s+БТ/i, goalName: 'правки БТ', wrongGoal: 'новый БТ', etalon: 'fixtures/MEET-VAC/etalon/meeting-2026-10-07-bt.md' },
  // После круга 2: промежуточный статус, повторная заявка при заблокированной учётке и «кнопка скрыта при сбое» — слой БТ,
  // во входе спеки их быть не должно; анкеры исходной пробы на них сняты, место меряет `PTS`.
  ACC: { src: 'meet', key: 'ACS-208', kind: 'spec', folder: 'docs/ACS-208', list: 'docs/ACS-208/meeting-2026-10-09.points.md', goal: /^нов\S*\s+спек/i, goalName: 'новая спека', wrongGoal: 'правки БТ', etalon: 'fixtures/MEET-ACC/etalon/meeting-2026-10-09-spec.md', dropMust: ['midStatus', 'blocked', 'hideRevoke'] },
  NEW: { src: 'meet', key: 'HRS-311', kind: 'bt', folder: 'docs/HRS-311', list: 'docs/HRS-311/meeting-2026-10-08.points.md', goal: /^новый\s+БТ/i, goalName: 'новый БТ', wrongGoal: 'правка работающего', etalon: 'fixtures/MEET-NEW/etalon/meeting-2026-10-08-bt.md' },
  CHG: { src: 'meet', key: 'EMP-1207', kind: 'bt', folder: 'docs/EMP-1207', list: 'docs/EMP-1207/meeting-2026-10-15.points.md', goal: /^правки\s+БТ/i, goalName: 'правки БТ', wrongGoal: 'новый БТ', etalon: 'fixtures/MEET-CHG/etalon/meeting-2026-10-15-bt.md' },
  CR: { src: 'meet', key: 'SUP-412', kind: 'bt', folder: 'docs/SUP-412', list: 'docs/SUP-412/meeting-2026-10-16.points.md', goal: /^правк\S*\s+работающ/i, goalName: 'правка работающего', wrongGoal: 'новый БТ', etalon: 'fixtures/MEET-CR/etalon/meeting-2026-10-16-bt.md' },
  REW: { src: 'meet', key: 'ACS-208', kind: 'spec', folder: 'docs/ACS-208', list: 'docs/ACS-208/meeting-2026-10-14.points.md', goal: /^правки\s+спеки/i, goalName: 'правки спеки', wrongGoal: 'новая спека', etalon: 'fixtures/MEET-REW/etalon/meeting-2026-10-14-spec.md' },
  'MR-NEW': { src: 'mr', key: 'FIT-412', kind: 'bt', folder: 'docs/FIT-412', list: 'docs/FIT-412/meeting-2026-10-14.points.md', goal: /^новый\s+БТ/i, goalName: 'новый БТ', wrongGoal: 'правка работающего', etalon: 'fixtures/NI-MR-NEW/etalon/meeting-2026-10-14-bt.md', thought: 'Показывать клиенту его место в очереди' },
  'MR-CHG': { src: 'mr', key: 'MED-77', kind: 'bt', folder: 'docs/MED-77', list: 'docs/MED-77/meeting-2026-10-14.points.md', goal: /^(правки\s+БТ|правк\S*\s+работающ)/i, goalName: 'правки БТ или правка работающего', wrongGoal: 'новый БТ', etalon: 'fixtures/NI-MR-CHG/etalon/meeting-2026-10-14-bt.md', thought: 'Предупреждать пациента, что у него осталась одна отмена' },
  'NB-IN': { src: 'nb', key: 'PVZ-318', kind: 'bt', folder: 'docs/PVZ-318', list: 'notes/посылки-от-частных-лиц/notebook-2026-10-15.points.md', goal: /^новый\s+БТ/i, goalName: 'новый БТ', wrongGoal: 'правки спеки', etalon: 'fixtures/NI-NB-IN/etalon/notebook-2026-10-15-bt.md', thought: 'Печатать трек-номер прямо на чеке приёмки' },
  'NB-ANS': { src: 'nb', key: 'RET-214', kind: 'bt', folder: 'docs/RET-214', list: 'notes/возврат-товара-без-чека/notebook-2026-10-15.points.md', goal: /^(новый\s+БТ|правк\S*\s+работающ)/i, goalName: 'новый БТ или правка работающего', wrongGoal: 'правки спеки', etalon: 'fixtures/NI-NB-ANS/etalon/notebook-2026-10-15-bt.md' },
  // Тот же список, что NB-IN; аналитик берёт один набросок (fixtures/NI-NB-PICK/w-turn2.txt).
  'NB-PICK': { src: 'nb', key: 'PVZ-318', kind: 'bt', folder: 'docs/PVZ-318', list: 'notes/посылки-от-частных-лиц/notebook-2026-10-15.points.md', goal: /^новый\s+БТ/i, goalName: 'новый БТ', wrongGoal: 'правки спеки', etalon: 'fixtures/NI-NB-PICK/etalon/notebook-2026-10-15-bt.md', thought: 'Печатать трек-номер прямо на чеке приёмки', pick: true },
}

const seedDirOf = (name) => join(HERE, 'fixtures', 'NI-' + name, 'seed')

// Пункты списка: номер строки файла, вид, текст без ссылки ` · …` в конце.
export function listPoints (name) {
  const lines = read(join(seedDirOf(name), FX[name].list)).split('\n')
  return lines.map((l, i) => {
    const m = l.match(/^- \[(решено|открыто|сведение|мысль|набросок)\] (.*?)(?: · [^·]+)?$/)
    return m && { n: i + 1, kind: m[1], text: m[2] }
  }).filter(Boolean)
}
const listHead = (name) => read(join(seedDirOf(name), FX[name].list)).split('\n').filter((l) => /^> /.test(l)).join('\n')

// ---------- разбор входа ----------

function sections (text) {
  const out = {}
  let cur = null
  for (const line of text.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) { cur = m[1]; out[cur] = []; continue }
    if (cur) out[cur].push(line)
  }
  return out
}

// Пункт — «- …», «* …», «N. …», «N) …» со строками-продолжениями (как в grade-meet.mjs).
function items (lines) {
  const out = []
  const MARK = /^\s*(-|\*|\d+[.)])\s+/
  for (const l of lines) {
    if (/^ ?(-|\*|\d+[.)])\s+/.test(l)) out.push(l.replace(MARK, ''))
    else if (l.trim() && out.length) out[out.length - 1] += ' ' + l.trim().replace(MARK, '')
  }
  return out
}

const normSec = (s) => {
  const t = s.replace(/[*_]/g, '').trim().toLowerCase()
  if (t.startsWith('решено')) return R
  if (t.startsWith('открыт')) return O
  if (t.startsWith('не входит')) return N
  if (t.startsWith('сведени')) return S
  if (t.startsWith('расходится')) return X
  return s
}
const allItems = (text) => Object.entries(sections(text)).flatMap(([sec, lines]) => items(lines).map((t) => ({ sec: normSec(sec), raw: sec, t })))

// ---------- сводка в ответах прогона ----------

// Где скилл сам назвал место пункта, которого нет во входе: его метки из Шагов 5–7 («для спеки — K (…)», «уже
// записано — K (…)», «вне документов …», «не взяты», «это спека (N):»). Разбор — по строкам ответа (круг 3: кусок «от
// метки до следующей метки» перескакивал строку и отдавал суть чужой метке):
// - метка с числом 0 («уже записано — 0», «Другой слой, уже записано, вне документов: 0.») места не даёт;
// - скобка «(…)» — ближайшей метки перед ней;
// - строка без скобок с одной меткой — целиком её («- Мысль про трек-номер на чеке не взята: 1.»); меток несколько —
//   от метки до следующей;
// - строка кончается «:» — список под ней (нумерованный или маркированный) — последней метки строки.
// В куске пункт узнаётся по `P<n>`, по ключу из `PTS` или по основам слов (`bestPoint`): суть в сводке короче пункта
// («порядок заявок у руководителя», «дни календарные»). Ходы — по порядку, последнее упоминание старше.
const CAT_RES = [
  [OTHER, /(^|[^а-яё])для\s+(БТ|спек[а-яё]*)\**\s*(\(|[—–:-]|\d)|это\s+(спека|БТ)\s*\(|друг(ой|ого)\s+сло[йя]/gi],
  [DONE, /уже\s+записан[а-яё]*/gi],
  [OUT, /вне\s+документов|[«"]не\s+вносим[»"]\s*[—–:-]\s*\d/gi],
  [THOUGHT, /не\s+взят[а-яё]*|наброск[а-яё]*\s+во\s+вход\s+не\s+беру/gi],
]
// Основа слова — без окончания: не длиннее 5 букв и на 2 короче слова, не короче 3 («заявок», «заявки» → «заяв»);
// основы совпадают, если одна — начало другой. Служебные слова и слова самих меток не считаются.
const STOP_W = new Set(['что', 'как', 'это', 'для', 'или', 'все', 'при', 'без', 'так', 'уже', 'она', 'они', 'его', 'нет', 'есть', 'если', 'только', 'когда', 'после', 'через', 'тот', 'там', 'где', 'кто', 'чем', 'ещё', 'еще', 'этот', 'этом'])
const STOP_P = ['спек', 'записан', 'документ', 'вносим', 'взят', 'мысл', 'наброс']
const stems = (s) => new Set((yo(s).toLowerCase().match(/[а-яa-z0-9]+/g) || [])
  .filter((x) => x.length >= 3 && !STOP_W.has(x) && !STOP_P.some((p) => x.startsWith(p)))
  .map((x) => x.slice(0, Math.min(5, Math.max(3, x.length - 2)))))
// Пункт, на который похож кусок сводки: не меньше двух общих основ, доля общих в куске не меньше половины, и он один
// лучший (ничья — не пункт).
export function bestPoint (piece, pts) {
  const a = stems(piece)
  if (a.size < 2) return null
  let best = null; let bs = 0; let bc = 0; let second = 0
  for (const p of pts) {
    const b = [...stems(mainText(p.text))]
    let c = 0
    for (const x of a) if (b.some((y) => y.startsWith(x) || x.startsWith(y))) c++
    const sc = c / a.size
    if (sc > bs) { second = bs; bs = sc; bc = c; best = p } else if (sc > second) second = sc
  }
  return bc >= 2 && bs >= 0.5 && bs > second ? best : null
}
const RE_LIST_ITEM = /^\s*(\d+[.)]|[-*•])\s/
// Места в документе, названные в тексте: «FR-7», «§3.2» / «3.2».
const docRefs = (t) => new Set([...(t || '').matchAll(/FR-\d+|(?:§\s*)?(?<![\d.])\d+\.\d+(?![\d.])/gi)].map((m) => m[0].toUpperCase().replace(/^§\s*/, '')))

// Раскладка, которую скилл получил от субагента Шага 2 («рубрика прочитана: раскладка» и строки `P<n> <слой> · <место>`),
// — из потоков прогона; последняя старше. Нет — пустая карта.
export function layoutOf (dir) {
  const out = new Map()
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir).filter((n) => /^stream(-\d+)?\.jsonl$/.test(n)).sort()) {
    for (const line of read(join(dir, f)).split('\n')) {
      let e; try { e = JSON.parse(line) } catch { continue }
      const content = e && e.message && Array.isArray(e.message.content) ? e.message.content : []
      for (const c of content) {
        if (!c || c.type !== 'text' || !/^\s*рубрика прочитана: раскладка/.test(c.text || '')) continue
        for (const m of c.text.matchAll(/^P(\d+)\s+(БТ|спека|чужая система|вне документов)\s*·\s*(.+)$/gm)) out.set(Number(m[1]), { layer: m[2], doc: m[3].trim() })
      }
    }
  }
  return out
}

// Место пункта в документе: из раскладки прогона, иначе из причины в `PTS` («БТ FR-7», «БТ §3.2»).
const docPlace = (name, n, layout) => (layout && layout.get(n) ? layout.get(n).doc : PTS[name][n].why || '')

// `opts.inInput` — номера пунктов, найденных во входе; `opts.layout` — раскладка прогона (`layoutOf`).
export function summaryPlaces (turns, name, opts = {}) {
  const pts = listPoints(name)
  const map = PTS[name]
  const layout = opts.layout || new Map()
  const inInput = opts.inInput || new Set()
  const place = new Map()
  const counts = {}
  const take = (seg, cat) => {
    const nums = new Set([...seg.matchAll(/(^|[^A-Za-z])P(\d+)/g)].map((m) => Number(m[2])))
    for (const p of pts) if (nums.has(p.n) || (map[p.n].s || map[p.n].k).every((re) => re.test(seg))) place.set(p.n, cat)
    for (const piece of seg.split(/[,;]/)) { const p = bestPoint(piece, pts); if (p) place.set(p.n, cat) }
    // Кусок называет место в документе («порядок списка у руководителя (FR-7)»), и это место — ровно у одного пункта.
    for (const ref of docRefs(seg)) {
      const hit = pts.filter((p) => docRefs(docPlace(name, p.n, layout)).has(ref))
      if (hit.length === 1) place.set(hit[0].n, cat)
    }
  }
  for (const text of turns) {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const marks = []
      for (const [cat, re] of CAT_RES) for (const m of line.matchAll(re)) marks.push({ at: m.index, end: m.index + m[0].length, cat })
      if (!marks.length) continue
      marks.sort((a, b) => a.at - b.at)
      for (const mk of marks) {
        const c = line.slice(mk.end, mk.end + 45).match(/^[^(\d\n]*?(\d+)/)
        mk.zero = !!c && c[1] === '0'
        if (c) counts[mk.cat] = Number(c[1])
      }
      const live = marks.filter((mk) => !mk.zero)
      const groups = [...line.matchAll(/\(([^()]*)\)/g)]
      // Одна метка в строке — строка целиком её, и скобки до метки тоже («… (FR-7) и … (3.2) — уже записаны в БТ»).
      if (live.length === 1 && marks.length === 1) take(line, live[0].cat)
      else if (groups.length) {
        for (const g of groups) {
          const mk = marks.filter((x) => x.end <= g.index).pop()
          if (mk && !mk.zero) take(g[1], mk.cat)
        }
      } else marks.forEach((mk, j) => { if (!mk.zero) take(line.slice(mk.at, j + 1 < marks.length ? marks[j + 1].at : line.length), mk.cat) })
      // Список под строкой, которая кончается «:».
      if (live.length && /:\s*\**\s*$/.test(line)) {
        const cat = live[live.length - 1].cat
        for (let j = i + 1; j < lines.length && RE_LIST_ITEM.test(lines[j]); j++) take(lines[j], cat)
      }
    }
  }
  // Счёт как покрытие: «уже записано — K», и пунктов вне входа с местом «уже записано» по раскладке прогона (нет её — по
  // `PTS`) ровно K — это они; суть которых сводка назвала иначе, место по счёту не меняют.
  const k = counts[DONE]
  if (k > 0) {
    const cand = pts.filter((p) => !inInput.has(p.n) && (layout.size ? /^уже\s+записано/i.test((layout.get(p.n) || {}).doc || '') : PTS[name][p.n].at.includes(DONE)))
    if (cand.length === k) for (const p of cand) if (!place.has(p.n)) place.set(p.n, DONE)
  }
  return place
}

// ---------- дословность (Шаг 7) ----------

const NUM_WORD = { 1: 'од(ин|на|ну|ного|ной|ним)', 2: 'дв(а|е|ух)', 3: 'тр(и|[её]х)', 4: 'четыр', 5: 'пят', 6: 'шест', 7: 'сем', 8: 'восем', 10: 'десят', 12: 'двенадцат', 15: 'пятнадцат', 20: 'двадцат', 24: 'двадцат\\S*\\s+четыр', 30: 'тридцат', 40: 'сорок' }
const hasNum = (t, n) => new RegExp('(^|[^\\d])' + esc(n) + '([^\\d]|$)').test(t) || (NUM_WORD[n] && w(NUM_WORD[n]).test(t))
// Основной текст пункта: без хвоста «— решил: / — со слов / — ждёт:» и без пометок «(на встрече: …)».
const mainText = (t) => t.split(/\s+—\s+(решил|ждёт|со\s+слов)/)[0].replace(/\(на встрече:[^)]*\)/g, '')
const stem = (word) => yo(word).slice(0, Math.max(4, word.length - 2)).toLowerCase()

export function literalChecks (p, found) {
  const red = []
  const warn = []
  const all = found.map((x) => x.t).join(' \n ')
  const tag = `P${p.n} «${p.text.slice(0, 40)}»`
  const inS = found.filter((x) => x.sec === S)
  const sl = p.text.match(/со\s+слов\s+([А-ЯЁ][а-яё-]+)/)
  if (p.kind === 'сведение' && sl && inS.length && !inS.some((x) => /со\s+слов/i.test(x.t) && yo(x.t).toLowerCase().includes(stem(sl[1])))) red.push(`${tag}: потеряно «со слов ${sl[1]}»`)
  for (const mark of ['не помню', 'не уверен']) if (p.text.includes(mark) && !all.includes(mark)) red.push(`${tag}: потеряна пометка «${mark}»`)
  const nums = [...new Set((mainText(p.text).match(/\d+/g) || []))]
  const lost = nums.filter((n) => !hasNum(all, n))
  if (lost.length) red.push(`${tag}: потеряно число ${lost.join(', ')}`)
  const vm = mainText(p.text).match(/вместо\s+(\S+)(\s+\S+)?/)
  if (vm) {
    const word = [vm[1], vm[2] || ''].map((s) => s.trim().replace(/[^\dА-Яа-яЁё]/g, '')).sort((a, b) => b.length - a.length)[0]
    if (word && !/^\d+$/.test(word) && !yo(all).toLowerCase().includes(stem(word))) red.push(`${tag}: потеряно «вместо ${vm[1]}…» («как сейчас»)`)
  }
  const dec = p.text.match(/—\s+решил:\s+([А-ЯЁ][а-яё-]+)/)
  if (dec && !yo(all).toLowerCase().includes(stem(dec[1]))) warn.push(`${tag}: нет «решил: ${dec[1]}»`)
  const wt = p.text.match(/—\s+ждёт:\s+([^;—]+)/)
  if (wt && wt[1].trim() !== '—' && !/жд[её]т/i.test(all)) warn.push(`${tag}: нет «ждёт: ${wt[1].trim()}»`)
  if (/\(на встрече:/.test(p.text) && !/на\s+встрече/i.test(all)) warn.push(`${tag}: нет пометки «(на встрече: …)»`)
  return { red, warn }
}

// Роли: «решали: <роль — имя>» в шапке входа и «решает: <кто>» в пунктах — только то, что есть в шапке списка (Шаг 4).
export function roleChecks (text, name) {
  const red = []
  const lh = yo(listHead(name)).toLowerCase()
  const lt = yo(read(join(seedDirOf(name), FX[name].list))).toLowerCase()
  const head = text.split(/^## /m)[0]
  const rm = head.match(/решали\**\s*:\s*([^\n]+)/i)
  const meet = /^> Встреча:/m.test(listHead(name))
  for (const part of rm ? rm[1].split(/;\s*/) : []) {
    const dash = part.split(/\s+—\s+/)
    if (dash.length < 2) continue
    const role = dash[0].replace(/[*_]/g, '').trim()
    const words = yo(role).toLowerCase().split(/[^а-яa-z]+/).filter((x) => x.length >= 4)
    if (!meet || !words.every((x) => lh.includes(x.slice(0, 5)))) red.push(`роль «${role}» в «решали:» — её нет в шапке списка`)
  }
  for (const { t } of allItems(text)) {
    const m = t.match(/реша(ет|ют)\**\s*:\s*([^;.\n]+)/i)
    if (!m) continue
    const words = yo(m[2]).toLowerCase().split(/[^а-яa-z]+/).filter((x) => x.length >= 2)
    if (!words.some((x) => lt.includes(x.slice(0, 5)))) red.push(`«решает: ${m[2].trim()}» — такого нет в списке`)
  }
  return red
}

// ---------- место каждого пункта ----------

export function placeChecks (text, name, turns = [], layout = new Map()) {
  const red = []
  const warn = []
  const rows = []
  const its = allItems(text)
  const foundOf = (n) => its.filter((x) => PTS[name][n].k.every((re) => re.test(x.t)))
  const inInput = new Set(listPoints(name).filter((p) => foundOf(p.n).length).map((p) => p.n))
  const place = summaryPlaces(turns, name, { inInput, layout })
  const fx = FX[name]
  for (const p of listPoints(name)) {
    const spec = PTS[name][p.n]
    const tag = `P${p.n} «${p.text.slice(0, 40)}»`
    const found = foundOf(p.n)
    // Мысли и наброски во входе ноута меряет классификатор grade-minb.mjs (ниже), здесь — только у MR и в сводке.
    const skipThought = fx.src === 'nb' && (p.kind === 'мысль' || p.kind === 'набросок')
    let where
    if (found.length) {
      const secs = [...new Set(found.map((x) => x.sec))]
      where = secs.join(' + ')
      const bad = secs.filter((s) => !spec.at.includes(s))
      if (bad.length && !skipThought) red.push(`${tag} — во входе в «${bad.join('», «')}», место: ${spec.at.join(' | ')}`)
      const lc = literalChecks(p, found)
      red.push(...lc.red)
      warn.push(...lc.warn)
    } else {
      const c = place.get(p.n)
      where = c ? `сводка: ${c}` : 'не найден'
      if (c && !spec.at.includes(c)) red.push(`${tag} — не во входе, по сводке «${c}», место: ${spec.at.join(' | ')}`)
      else if (!c && spec.at.some(isSec) && ['решено', 'открыто', 'сведение'].includes(p.kind)) red.push(`${tag} — нет во входе, место в сводке не названо (место: ${spec.at.join(' | ')})`)
    }
    rows.push({ n: p.n, kind: p.kind, where, at: spec.at })
  }
  red.push(...roleChecks(text, name))
  return { red, warn, rows }
}

// ---------- содержание входа ----------

// Классификатор мысли и наброска — тот же, что в grade-minb.mjs (RE_THOUGHT / RE_SKETCH не экспортируются).
export function thoughtKind (t) {
  const r = gradeInputIN('## Решено\n1. ' + t + '\n').red
  return r.includes('мысль в «Решено»') ? 'мысль' : r.includes('набросок в «Решено»') ? 'набросок' : null
}

// Сообщения исходных оценщиков, которые заменены своей проверкой или неприменимы. MR: цель — общая проверка шапки;
// «протокол разрезан» (8 у NEW, 7 у CHG) — требование к разбору meeting-intake, разбора нет. NB: цель — шапка; мысль и
// набросок — правило ниже; якоря — общая проверка ссылок; шапка формы meeting-intake 1.1.0 — своя форма intent.md.
export const DROP_MR = ['1: цель в шапке', '8: протокол разрезан', '7: протокол разрезан']
const DROP_NB_RED = [/^цель в шапке/, /^(мысль|набросок) в /, /^якорь во входе/]
const DROP_NB_WARN = [/^заголовок не «# Ноут/, /^нет строки «> Ноут:/]

// Только импортированные ожидания (для эталонов исходных проб в самопроверке).
export function importedChecks (text, name) {
  const fx = FX[name]
  const red = []
  const warn = []
  if (fx.src === 'meet') {
    const mfx = MEET[name]
    const r = gradeInput(text, mfx)
    const skip = new Set([...(mfx.headerMust || []).map(([d]) => d), ...(fx.dropMust || []).map((id) => mfx.must.find((m) => m.id === id).d)])
    red.push(...r.missing.filter((d) => !skip.has(d)).map((d) => 'нет: ' + d))
    red.push(...r.violations.filter((v) => v !== 'якоря или время во входе').map((v) => 'нарушено: ' + v))
  } else if (fx.src === 'mr') {
    // Второй аргумент был разбор meeting-intake — его нет: исключения критерия 6 (NEW, 15%) и 5 (CHG, пуш), державшиеся
    // на ответе аналитика в разборе, не действуют.
    const g = (name === 'MR-NEW' ? gradeNEW : gradeCHG)(text, null)
    red.push(...g.red.filter((m) => !DROP_MR.some((d) => m.startsWith(d))))
    warn.push(...g.warn)
  } else {
    // Разбора нет и «для другого документа» больше не законно для сведений о бизнесе (layout.md после круга 2: объёмы,
    // расписания, «как сейчас» — слой БТ): `sv*` без раздела «Сведения» — красный.
    const g = (name === 'NB-ANS' ? gradeInputANS : gradeInputIN)(text, '')
    red.push(...g.red.filter((m) => !DROP_NB_RED.some((re) => re.test(m))))
    warn.push(...g.warn.filter((m) => !DROP_NB_WARN.some((re) => re.test(m))))
    // Новое правило (TL;DR 3, Шаг 5): мысли и наброски по умолчанию во вход не идут; взятые — только в «Открыто» с
    // «(предложение аналитика)».
    const found = allItems(text).map((x) => ({ ...x, k: thoughtKind(x.t) })).filter((x) => x.k)
    for (const x of found) {
      if (!(x.k === 'набросок' && fx.pick)) { red.push(`${x.k} во входе (по умолчанию не берётся): «${x.t.slice(0, 60)}»`); continue }
      if (x.sec !== O) red.push(`выбранный набросок в «${x.sec}», а не в «Открыто»`)
      else if (!/предложени\S*\s+аналитик/i.test(x.t)) red.push(`выбранный набросок без пометки «(предложение аналитика)»: «${x.t.slice(0, 60)}»`)
    }
    if (fx.pick && !found.some((x) => x.k === 'набросок')) red.push('выбранного аналитиком наброска нет во входе')
  }
  return { red, warn }
}

export function gradeContent (text, name, turns = [], layout = new Map()) {
  const fx = FX[name]
  const imp = importedChecks(text, name)
  const pl = placeChecks(text, name, turns, layout)
  const h = headerChecks(text, fx)
  const red = [...imp.red, ...pl.red, ...h.red, ...refChecks(text)]
  const warn = [...imp.warn, ...pl.warn, ...h.warn]
  return { red, warn, rows: pl.rows, pass: !red.length }
}

function headerChecks (text, fx) {
  const red = []
  const warn = []
  const head = text.split(/^## /m)[0]
  const lines = head.split('\n')
  const keyLine = lines.find((l) => /^>\s*\**\s*Задача\**\s*:/i.test(l))
  if (!keyLine) red.push('в шапке нет строки «> Задача: …»')
  else if (!new RegExp('(^|[^A-Za-z0-9-])' + esc(fx.key) + '([^A-Za-z0-9-]|$)').test(keyLine)) red.push(`в строке «> Задача:» нет ключа ${fx.key}`)
  const gm = head.match(/цель\**\s*:\s*\**\s*([^\n·;|]+)/i)
  if (!gm) red.push(`в шапке нет цели (ждём «${fx.goalName}»)`)
  else if (!fx.goal.test(gm[1].replace(/\*/g, '').trim())) red.push(`цель в шапке «${gm[1].replace(/\*/g, '').trim()}», ждём «${fx.goalName}»`)
  else if (keyLine && !/цель\**\s*:/i.test(keyLine)) warn.push('цель не в строке «> Задача:» (intent.md: «> Задача: … · цель: …»)')
  if (!/^# (Встреча|Ноут)/m.test(head)) warn.push('заголовок не по intent.md: «# <Встреча <дата> | Ноут <тема>>[: <предмет>]»')
  if (!lines.some((l) => /^>\s*\**\s*Список\**\s*:/i.test(l) && l.includes(fx.list))) warn.push(`нет строки «> Список: ${fx.list}»`)
  return { red, warn }
}

// Ссылки на источник во входе (TL;DR 2, intent.md): `L<n>` и `№<n>` — во всём файле, кроме строк с путями
// («> Список:», «> Источник:»); время с секундами — только в пунктах (в шапке законно, как в grade-meet.mjs).
function refChecks (text) {
  const red = []
  const body = text.split('\n').filter((l) => !/^>\s*\**\s*(Список|Источник)\**\s*:/i.test(l))
  const lRef = body.find((l) => /(^|[^A-Za-z])L\d+([^0-9]|$)/.test(l))
  if (lRef) red.push(`ссылка L<n> во входе: «${lRef.trim().slice(0, 60)}»`)
  const nRef = body.find((l) => /№\s*\d/.test(l))
  if (nRef) red.push(`ссылка «<дата> №<n>» во входе: «${nRef.trim().slice(0, 60)}»`)
  const tRef = allItems(text).find(({ t }) => /\d\d:\d\d:\d\d/.test(t))
  if (tRef) red.push(`время с секундами в пункте: «${tRef.t.slice(0, 60)}»`)
  return red
}

// ---------- песочница ----------

function listFiles (dir, base = dir, dot = false) {
  const out = []
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!dot && e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(p, base, dot))
    else out.push(relative(base, p).split('\\').join('/'))
  }
  return out
}

const isStand = (f) => (!f.includes('/') && /^(answer(-\d+)?\.md|stream(-\d+)?\.jsonl|_[^/]*)$/.test(f)) || f.startsWith('_twin/')
const RE_FORBIDDEN_READ = /(^|[\s/\\"'=])(services|context)[/\\]/
const RE_EXCLUDE_ARG = /(-not|!)\s+-(i?path|name)\s+(["'])[^"']*\3/g

function toolUses (dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir).filter((n) => /^stream(-\d+)?\.jsonl$/.test(n)).sort()) {
    for (const line of read(join(dir, f)).split('\n')) {
      let e; try { e = JSON.parse(line) } catch { continue }
      const content = e && e.message && Array.isArray(e.message.content) ? e.message.content : []
      // События субагентов идут в потоке ведущего с `parent_tool_use_id`.
      for (const c of content) if (c && c.type === 'tool_use') out.push({ name: c.name, input: c.input || {}, sub: !!e.parent_tool_use_id })
    }
  }
  return out
}

// Ответы ходов по порядку: `answer-NN.md`; ходов нет — `answer.md`.
function dialogTurns (dir) {
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).sort() : []
  if (names.length) return names.map((f) => read(join(dir, f)))
  return existsSync(join(dir, 'answer.md')) ? [read(join(dir, 'answer.md'))] : []
}

const listBase = (fx) => basename(fx.list).replace(/\.points\.md$/, '')
export const inputRel = (fx) => `${fx.folder}/${listBase(fx)}-${fx.kind}.md`

// Прогон в счёт: есть ответ, нет пометки отказа API от пула, ответ не начинается с сообщения об отказе.
export function measured (dir) {
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  return !(existsSync(join(dir, '_api-failure.txt')) || existsSync(join(dir, '_api-failure-turn.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300)))
}

export function gradeRun (dir, name) {
  const fx = FX[name]
  const red = []
  const warn = []
  const seedDir = seedDirOf(name)
  const seedFiles = listFiles(seedDir, seedDir, true)
  const seeded = new Set(seedFiles)
  if (existsSync(join(dir, '_seeded.txt'))) for (const l of read(join(dir, '_seeded.txt')).split('\n')) if (l.trim()) seeded.add(l.trim())
  const touched = seedFiles.filter((rel) => !existsSync(join(dir, rel)) || read(join(dir, rel)) !== read(join(seedDir, rel)))
  if (touched.length) red.push('засев тронут (документ задачи или список): ' + touched.join(', '))
  const files = listFiles(dir)
  const want = inputRel(fx)
  const RE_IN = new RegExp('(^|/)' + esc(listBase(fx)) + '[.-]?(points-)?(bt|spec)(-\\d+)?\\.md$')
  const inputs = files.filter((f) => RE_IN.test(f) && !seeded.has(f))
  if (!inputs.includes(want)) red.push(`нет входа ${want}`)
  const stray = inputs.filter((f) => f !== want)
  if (stray.length) red.push('вход не там или не той цели: ' + stray.join(', '))
  const extra = files.filter((f) => !seeded.has(f) && !isStand(f) && !inputs.includes(f))
  if (extra.length) red.push('лишние файлы: ' + extra.join(', '))
  let rows = []
  if (inputs.includes(want)) {
    const c = gradeContent(read(join(dir, want)), name, dialogTurns(dir), layoutOf(dir))
    red.push(...c.red)
    warn.push(...c.warn)
    rows = c.rows
  }
  const uses = toolUses(dir)
  const forbidden = uses.filter((u) => ['Read', 'Grep', 'Glob', 'Bash'].includes(u.name) && RE_FORBIDDEN_READ.test(Object.values(u.input).filter((v) => typeof v === 'string').join(' ').replace(RE_EXCLUDE_ARG, '')))
  if (forbidden.length) red.push('читал services/ или context/: ' + forbidden.map((u) => `${u.sub ? 'субагент' : 'ведущий'} ${u.name} ${JSON.stringify(u.input).slice(0, 80)}`).join('; '))
  const turns = existsSync(dir) ? readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).length || 1 : 0
  const agents = uses.filter((u) => !u.sub && (u.name === 'Agent' || u.name === 'Task')).length
  return { red, warn, rows, pass: !red.length, hasInput: inputs.includes(want), turns, agents }
}

// ---------- самопроверка ----------

// Список → вход по основному месту каждого пункта (`PTS`, первое место): вид → раздел intent.md, ссылка ` · …` снята,
// «решил / ждёт / со слов» и пометки — как в пункте. Пункт с основным местом вне входа не идёт; набросок с местом
// «Открыто» — с «(предложение аналитика)». Это и есть «вход по правилам скилла»: он обязан пройти все проверки.
export function fromList (name) {
  const fx = FX[name]
  const secs = { [R]: [], [O]: [], [N]: [], [S]: [], [X]: [] }
  for (const p of listPoints(name)) {
    const at = PTS[name][p.n].at[0]
    if (!isSec(at)) continue
    let t = p.text
    if (p.kind === 'мысль' || p.kind === 'набросок') { secs[O].push(`${t} (предложение аналитика) — ждёт: —`); continue }
    let sec = p.kind === 'открыто' ? O : p.kind === 'сведение' ? S : R
    if (p.kind === 'решено' && /^не входит:\s*/i.test(t)) { sec = N; t = t.replace(/^не входит:\s*/i, '') }
    secs[at === X ? X : sec].push(t)
  }
  const head = listHead(name).split('\n')
  const subject = read(join(seedDirOf(name), fx.list)).split('\n')[0].replace(/^# Пункты:\s*/, '')
  const meet = head.find((l) => /^> (Встреча|Ноут):/.test(l))
  const date = (meet.match(/\d{4}-\d\d-\d\d/) || [''])[0]
  const title = fx.src === 'nb' ? `# Ноут ${meet.replace(/^> Ноут:\s*/, '').split(' · ')[0]}` : `# Встреча ${date}: ${subject}`
  let out = `${title}\n\n> Задача: ${fx.key} · цель: ${fx.goalName.split(' или ')[0]}\n> Документ: —\n${meet}\n> Список: ${fx.list}\n`
  for (const [sec, its] of Object.entries(secs)) if (its.length) out += `\n## ${sec}\n` + its.map((t, i) => (sec === R ? `${i + 1}. ${t}` : `- ${t}`)).join('\n') + '\n'
  return out
}

// Сводка Шага 6 к `fromList`: пункты с основным местом вне входа — по номерам в своих строках.
export function summaryOf (name) {
  const by = {}
  for (const p of listPoints(name)) { const at = PTS[name][p.n].at[0]; if (!isSec(at)) (by[at] ||= []).push('P' + p.n) }
  const label = { [OTHER]: FX[name].kind === 'bt' ? 'для спеки' : 'для БТ', [DONE]: 'уже записано', [OUT]: 'вне документов и «не вносим»', [THOUGHT]: 'мысли и наброски не взяты' }
  return 'Не идёт во вход: ' + (Object.entries(by).map(([c, ps]) => `${label[c]} — ${ps.length} (${ps.join(', ')})`).join(', ') || '0') + '.'
}

const addItem = (text, sec, line) => (new RegExp('^## ' + esc(sec) + '\\s*$', 'm').test(text)
  ? text.replace(new RegExp('^(## ' + esc(sec) + '\\s*\\n)', 'm'), `$1- ${line}\n`)
  : text.replace(/\n*$/, `\n\n## ${sec}\n- ${line}\n`))
const setGoal = (text, goal) => text.replace(/(цель\**\s*:\s*\**\s*)[^\n·;|*]+/i, `$1${goal}`)
const dropLine = (text, re) => text.split('\n').filter((l) => !re.test(l)).join('\n')
// Строка входа, в которой лежит пункт `n` (по ключу из PTS).
const lineOf = (text, name, n) => text.split('\n').find((l) => /^(\d+\.|-)\s/.test(l) && PTS[name][n].k.every((re) => re.test(l)))

// Прогоны круга 2 (если лежат на диске): аудит глазами решил, какие из них обязаны быть красными и какие — зелёными.
const R2 = 'runs/2026-10-15-loop-r2-ni-'
const R2_MUST = [
  ['NB-IN', 'nb-in', 'run-1', false, /P6 .*вне документов|P9 .*вне документов|P10 .*вне документов/],
  ['CR', 'cr', 'run-1', false, /P6 .*вне документов/],
  ['ACC', 'acc', 'run-1', false, /P23 .*(другой слой|место)/],
  ['MR-CHG', 'mr-chg', 'run-1', false, /потеряно число 24|не помню/],
  ['REW', 'rew', 'run-1', true, null],
  ['VAC', 'vac', 'run-1', true, null],
]
// Круг 3: ложные красные разбора сводки — зелёные, а пункт — на месте, названном в сводке.
const R3 = 'runs/2026-10-15-loop-r3-ni-'
const R3_MUST = [
  ['CHG', 'chg', 'run-2', 9, 'сводка: ' + DONE],
  ['VAC', 'vac', 'run-3', 17, 'сводка: ' + DONE],
  ['NB-PICK', 'nb-pick', 'run-1', 8, 'сводка: ' + THOUGHT],
]
// Круг 4: суть пункта в сводке узнаётся только по месту в документе и по счёту.
const R4 = 'runs/2026-10-15-loop-r4-ni-'
const R4_MUST = [['CHG', 'chg', 'run-1', 9, 'сводка: ' + DONE]]

function selftest () {
  let bad = 0
  const ck = (n, got, want, info) => {
    const ok = got === want
    if (!ok) bad++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`)
    if (!ok && info) console.log('         ', String(info).slice(0, 600))
  }
  // По умолчанию — со сводкой правильного прогона: без неё пропуск пункта «уже записано» законно красный.
  let SUM = []
  const G = (text, name, turns = SUM) => gradeContent(text, name, turns)
  for (const [name, fx] of Object.entries(FX)) {
    SUM = [summaryOf(name)]
    console.log(`\n${name}`)
    const pts = listPoints(name)
    ck('карта мест покрывает каждый пункт списка', pts.filter((p) => !PTS[name][p.n]).map((p) => 'P' + p.n).join(','), '')
    const own = pts.filter((p) => pts.filter((q) => PTS[name][q.n].k.every((re) => re.test(p.text))).length !== 1 || !PTS[name][p.n].k.every((re) => re.test(p.text)))
    ck('ключ каждого пункта узнаёт ровно его в списке', own.map((p) => 'P' + p.n).join(','), '')
    const et = read(join(HERE, fx.etalon))
    const g0 = importedChecks(et, name)
    ck('эталон исходной пробы — импортированные ожидания зелёные', !g0.red.length, true, g0.red.join(' | '))
    const ok = fromList(name)
    const g1 = G(ok, name)
    ck('вход по правилам скилла (основное место каждого пункта) со сводкой — зелёный', g1.pass, true, g1.red.join(' | '))
    const outMust = pts.filter((p) => !isSec(PTS[name][p.n].at[0]) && PTS[name][p.n].at.some(isSec) && ['решено', 'открыто', 'сведение'].includes(p.kind))
    if (outMust.length) ck(`тот же вход без сводки — красный: место ${outMust.map((p) => 'P' + p.n).join(', ')} не установить`, outMust.every((p) => G(ok, name, []).red.some((m) => m.startsWith(`P${p.n} `))), true)
    // Испорченные варианты.
    ck('ссылка L57 в пункте — красный', G(addItem(ok, O, 'Кто утверждает — ждёт: — · L57'), name).pass, false)
    ck('ссылка «2026-10-14 №2» в пункте — красный', G(addItem(ok, S, 'Пропуск на неделю · 2026-10-14 №2'), name).pass, false)
    ck('время с секундами в пункте — красный', G(addItem(ok, S, 'Начали в 11:02:41'), name).pass, false)
    ck(`неверная цель «${fx.wrongGoal}» — красный`, G(setGoal(ok, fx.wrongGoal), name).pass, false)
    ck('нет ключа в «> Задача:» — красный', G(ok.replace(new RegExp(esc(fx.key), 'g'), 'XXX-1'), name).pass, false)
    if (fx.thought) ck('мысль из списка во входе — красный', G(addItem(ok, O, `${fx.thought} (предложение аналитика) — ждёт: —`), name).pass, false)
    // Место пункта: первый пункт с местом во входе пропал; пропал, а сводка назвала его не там; переехал в чужой раздел.
    const p1 = pts.find((p) => isSec(PTS[name][p.n].at[0]) && !PTS[name][p.n].at.some((a) => !isSec(a)) && lineOf(ok, name, p.n))
    const l1 = lineOf(ok, name, p1.n)
    const gone = ok.replace(l1 + '\n', '')
    ck(`P${p1.n} пропал, в сводке не назван — красный`, G(gone, name).red.some((m) => m.startsWith(`P${p1.n} `) && /не названо/.test(m)), true)
    ck(`P${p1.n} пропал, сводка «вне документов» — красный`, G(gone, name, [`Не идёт во вход: вне документов и «не вносим» — 1 (P${p1.n}).`]).red.some((m) => m.startsWith(`P${p1.n} `)), true)
    const wrongSec = PTS[name][p1.n].at.includes(S) ? N : S
    ck(`P${p1.n} в «${wrongSec}» — красный`, G(addItem(gone, wrongSec, l1.replace(/^(\d+\.|-)\s+/, '')), name).red.some((m) => m.startsWith(`P${p1.n} `)), true)
    const pOut = pts.find((p) => !isSec(PTS[name][p.n].at[0]) && !PTS[name][p.n].at.some(isSec) && p.kind !== 'мысль' && p.kind !== 'набросок')
    if (pOut) ck(`P${pOut.n} (место: ${PTS[name][pOut.n].at.join(' | ')}) во входе — красный`, G(addItem(ok, pOut.kind === 'открыто' ? O : pOut.kind === 'сведение' ? S : R, pOut.text), name).red.some((m) => m.startsWith(`P${pOut.n} `)), true)
    const sv = pts.find((p) => p.kind === 'сведение' && /со\s+слов/.test(p.text) && lineOf(ok, name, p.n) && PTS[name][p.n].at[0] === S)
    if (sv) {
      const l = lineOf(ok, name, sv.n)
      ck(`P${sv.n}: «со слов» потеряно — красный`, G(ok.replace(l, l.replace(/\s+—\s+со\s+слов.*$/, '')), name).red.some((m) => /со слов/.test(m)), true)
    }
    const nm = pts.find((p) => /\d/.test(mainText(p.text)) && lineOf(ok, name, p.n) && !/FR-\d/.test(p.text))
    if (nm) {
      const l = lineOf(ok, name, nm.n)
      const d = mainText(nm.text).match(/\d+/)[0]
      const l2 = l.replace(new RegExp('(^|[^\\d])' + d + '(?![\\d])', 'g'), '$1N')
      if (PTS[name][nm.n].k.every((re) => re.test(l2))) ck(`P${nm.n}: число ${d} потеряно — красный`, G(ok.replace(l, l2), name).red.some((m) => /потеряно число/.test(m)), true)
    }
    ck('роль, которой нет в шапке списка, в «решали:» — красный', G(ok.replace(/^(> Список:)/m, '> решали: директор по продукту — Петров И.\n$1').replace(/\n> решали:/, ' · решали:'), name).red.some((m) => /роль/.test(m)), true)

    const sb = mkdtempSync(join(tmpdir(), 'grade-ni-'))
    try {
      const seedDir = seedDirOf(name)
      const seedFiles = listFiles(seedDir, seedDir, true)
      for (const rel of seedFiles) { mkdirSync(join(sb, rel, '..'), { recursive: true }); writeFileSync(join(sb, rel), readFileSync(join(seedDir, rel))) }
      writeFileSync(join(sb, '_seeded.txt'), seedFiles.join('\n') + '\n')
      writeFileSync(join(sb, 'answer.md'), summaryOf(name))
      const want = inputRel(fx)
      mkdirSync(join(sb, fx.folder), { recursive: true })
      writeFileSync(join(sb, want), ok)
      const g = () => gradeRun(sb, name)
      const r0 = g()
      ck('песочница со входом по правилам — зелёная', r0.pass, true, r0.red.join(' | '))
      const docRel = seedFiles.find((f) => /(business_requirements|technical_specification)\.md$/.test(f))
      if (docRel) {
        const t = read(join(sb, docRel))
        writeFileSync(join(sb, docRel), t + '\nправка\n')
        ck('документ задачи тронут — красный', g().pass, false)
        writeFileSync(join(sb, docRel), t)
      }
      const lt = read(join(sb, fx.list))
      writeFileSync(join(sb, fx.list), lt.replace('- [', '- [x] ['))
      ck('список тронут — красный', g().pass, false)
      writeFileSync(join(sb, fx.list), lt)
      writeFileSync(join(sb, fx.folder, 'notes.md'), 'x')
      ck('лишний файл — красный', g().red.some((m) => m.startsWith('лишние файлы')), true)
      rmSync(join(sb, fx.folder, 'notes.md'))
      const otherKind = fx.kind === 'bt' ? 'spec' : 'bt'
      const wrong = want.replace(new RegExp('-' + fx.kind + '\\.md$'), `-${otherKind}.md`)
      rmSync(join(sb, want)); writeFileSync(join(sb, wrong), ok)
      ck(`вход -${otherKind} вместо -${fx.kind} — красный`, g().pass, false)
      rmSync(join(sb, wrong))
      writeFileSync(join(sb, want.replace(/-(bt|spec)\.md$/, '.points-$1.md')), ok)
      ck('вход «<основа>.points-bt.md» (круг 2, ni-vac run-2) — красный и назван', g().red.some((m) => /вход не там/.test(m)), true)
      rmSync(join(sb, want.replace(/-(bt|spec)\.md$/, '.points-$1.md')))
      mkdirSync(join(sb, 'docs/_inbox'), { recursive: true })
      writeFileSync(join(sb, 'docs/_inbox', basename(want)), ok)
      ck('вход в docs/_inbox при известном ключе — красный', g().pass, false)
      rmSync(join(sb, 'docs/_inbox'), { recursive: true, force: true })
      writeFileSync(join(sb, want), ok)
      const ev = (input, sub) => JSON.stringify({ type: 'assistant', parent_tool_use_id: sub ? 'toolu_1' : null, message: { content: [{ type: 'tool_use', id: 'x', name: 'Read', input }] } })
      writeFileSync(join(sb, 'stream-02.jsonl'), ev({ file_path: 'C:\\sb\\services\\idm.md' }, true) + '\n')
      ck('субагент читал services/ — красный', g().pass, false)
      rmSync(join(sb, 'stream-02.jsonl'))
      writeFileSync(join(sb, 'answer.md'), 'API Error: 529 overloaded')
      ck('отказ API в ответе — НЕ ИЗМЕРЕНО', measured(sb), false)
    } finally { rmSync(sb, { recursive: true, force: true }) }

    // Случаи аудита круга 2 — синтетически, по одному на фикстуру, где они были.
    if (name === 'NB-IN') {
      const t = [6, 9, 10].reduce((s, n) => s.replace(lineOf(s, name, n) + '\n', ''), ok)
      const turns = ['**Не идёт во вход:** для спеки — 0, уже записано — 0, вне документов и «не вносим» — 3 (сейчас пункты посылки не принимают, ~180 заказов в день и пик до 400, машина забирает раз в день после 19:00), мысли и наброски не взяты — 2 (трек-номер на чеке, экран оператора).']
      const r = G(t, name, turns).red
      ck('три сведения о бизнесе «вне документов» (nb-in run-1) — красный по каждому', [6, 9, 10].every((n) => r.some((m) => m.startsWith(`P${n} `) && /вне документов/.test(m))), true, r.join(' | '))
      const r2 = G(ok.replace(lineOf(ok, name, 9) + '\n', ''), name, ['Для спеки — 1 пункт (около 180 заказов в день, пик до 400).']).red
      ck('«180 заказов» «для спеки» (nb-in run-2, run-3) — красный: объёмы — слой БТ', r2.some((m) => /^P9 .*другой слой/.test(m)), true, r2.join(' | '))
      ck('мысль и набросок «не взяты» по сводке, не во входе — зелёный', G(ok, name, ['мысли и наброски не взяты — 2 (трек-номер на чеке, экран оператора)']).pass, true)
    }
    if (name === 'CR') {
      const t = ok.replace(lineOf(ok, name, 6) + '\n', '')
      const r = G(t, name, ['- Для спеки — 1 (производственный календарь).\n- Вне документов — 1 (сейчас закрытие через три календарных дня).']).red
      ck('«как сейчас — три календарных» «вне документов» (cr run-1) — красный', r.some((m) => m.startsWith('P6 ') && /вне документов/.test(m)), true, r.join(' | '))
      const pair = ok.replace(lineOf(ok, name, 6) + '\n', '').replace(lineOf(ok, name, 7), '1. Как сейчас: обращение закрывается автоматически через три календарных дня, если пользователь молчит → как должно стать: через семь рабочих дней вместо трёх календарных — решил: Захарова О.')
      ck('«как сейчас» парой в «Решено» — зелёный', G(pair, name).pass, true, G(pair, name).red.join(' | '))
    }
    if (name === 'ACC') {
      const t = ok.replace(lineOf(ok, name, 23) + '\n', '')
      const r = G(t, name, ['- для БТ — 1 (подписка на увольнение не входит)\n- уже записано — 1 (сменился владелец системы — FR-3)']).red
      ck('«подписка на событие увольнения» «для БТ» (acc run-1) — красный', r.some((m) => m.startsWith('P23 ')), true, r.join(' | '))
      for (const n of [9, 13, 17]) ck(`P${n} (слой БТ) во входе спеки ${n === 9 ? 'в «Расходится с БТ»' : ''} — красный`, G(addItem(ok, n === 17 ? R : X, listPoints(name).find((p) => p.n === n).text), name).red.some((m) => m.startsWith(`P${n} `)), true)
      // P9 — в обе стороны (решение пользователя 2026-10-15): в «Открыто» входа спеки и «для БТ» по сводке — зелёный.
      const l9 = lineOf(ok, name, 9)
      ck('P9 в «Открыто» входа спеки — зелёный', l9 !== undefined && G(ok, name).pass, true)
      ck('P9 не во входе, сводка «для БТ» — зелёный', G(ok.replace(l9 + '\n', ''), name, [summaryOf(name) + '\n- для БТ — 1 (P9)']).pass, true)
    }
    if (name === 'MR-CHG') {
      const l7 = lineOf(ok, name, 7)
      ck('«12 часов вместо 24» → «12 часов» (mr-chg run-1) — красный', G(ok.replace(l7, l7.replace(' вместо 24', '')), name).red.some((m) => /потеряно число 24/.test(m)), true)
      const l12 = lineOf(ok, name, 12)
      ck('«не помню» → «не помнят» (mr-chg run-1) — красный', G(ok.replace(l12, l12.replace('не помню', 'не помнят')), name).red.some((m) => /не помню/.test(m)), true)
    }
    if (name === 'MR-NEW') {
      const t = ok.replace(lineOf(ok, name, 12) + '\n', '')
      ck('15% «вне документов» (mr-new run-2, run-3) — красный', G(t, name, ['- вне документов и «не вносим» — 3 (отмены записи на 15% занятий; срок уточнения; кто начал встречу)']).red.some((m) => m.startsWith('P12 ')), true)
      const l12 = lineOf(ok, name, 12)
      ck('15% без «не уверен» — красный', G(ok.replace(l12, l12.replace(' (по памяти, не уверен)', '')), name).red.some((m) => /не уверен|15%/.test(m)), true)
    }
    if (name === 'REW') ck('уже записанные P6, P12, P13 по номерам в отчёте (rew run-1) — зелёный', G(ok, name, ['**Счёт по списку:** 5 пунктов в «Решено», 1 в «Сведениях», 3 уже записано (P6, P12, P13), для БТ 0.']).pass, true)
    if (name === 'NB-PICK') {
      const l = lineOf(ok, name, 12)
      ck('набросок без пометки — красный', G(ok.replace(l, l.replace(' (предложение аналитика)', '')), name).pass, false)
      ck('наброска нет — красный', G(ok.replace(l + '\n', ''), name).pass, false)
    }
  }

  console.log('\nобщие')
  ck('классификатор: мысль про трек на чеке', thoughtKind('Печатать трек-номер на чеке приёмки'), 'мысль')
  ck('классификатор: набросок экрана оператора', thoughtKind('Экран оператора: скан, вес, наклейка'), 'набросок')
  ck('сводка: «для спеки — 1 (…)» → другой слой', summaryPlaces(['для спеки — 1 (рабочие дни из производственного календаря)'], 'CR').get(10), OTHER)
  ck('сводка: «вход для БТ или спеки» — не метка слоя', summaryPlaces(['Пишу вход для БТ или спеки по производственного календаря.'], 'CR').get(10), undefined)
  ck('сводка: последнее упоминание старше', summaryPlaces(['вне документов — 1 (P10)', 'для спеки — 1 (P10)'], 'CR').get(10), OTHER)
  ck('сводка: вариант «Не вносим» в вопросе — не метка', summaryPlaces(['Варианты: «Оставляем»; «Не вносим»\nПроизводственный календарь'], 'CR').get(10), undefined)
  // Круг 3: три ложных красных разбора сводки (строки дословно из ответов прогонов).
  const chg = summaryPlaces(['- уже записано — 3 (число дней календарные и праздники не вычитаются, порядок заявок у руководителя, удаление черновиков не входит)'], 'CHG')
  ck('сводка: «порядок заявок у руководителя» → P9 уже записано (r3 ni-chg run-2)', [7, 9, 10].map((n) => chg.get(n)).join(','), [DONE, DONE, DONE].join(','))
  const vac = summaryPlaces(['- уже записано — 7 (срок до 31 января, дни календарные, согласование после даты начала, отзыв из начавшегося отпуска не входит, отдельной роли руководителя нет, удаление черновиков не входит, кадровик видит только согласованные);'], 'VAC')
  ck('сводка: «дни календарные» → P17, не P12 (r3 ni-vac run-3)', `${vac.get(17)}/${vac.get(12)}`, `${DONE}/undefined`)
  ck('сводка: все семь «уже записано» VAC узнаны', [6, 17, 18, 19, 22, 24, 25].every((n) => vac.get(n) === DONE), true)
  const pick = ['**Не во вход:** для спеки — 0, уже записано — 0, вне документов и «не вносим» — 0, мысли и наброски не взяты — 1 (трек-номер на чеке приёмки).', '- Другой слой, уже записано, вне документов: 0.\n- Мысль про трек-номер на чеке не взята: 1.']
  ck('сводка: скобка — ближайшей метки, «— 0» места не даёт (r3 ni-nb-pick run-1, ход 2)', summaryPlaces([pick[0]], 'NB-PICK').get(8), THOUGHT)
  ck('сводка: «вне документов: 0.» не перескакивает строку (r3 ni-nb-pick run-1, ход 3)', summaryPlaces([pick[1]], 'NB-PICK').get(8), THOUGHT)
  ck('сводка: оба хода подряд — P8 «не взята»', summaryPlaces(pick, 'NB-PICK').get(8), THOUGHT)
  ck('сводка: метка «— 0» со скобкой — места нет', summaryPlaces(['вне документов — 0 (трек-номер на чеке приёмки)'], 'NB-PICK').get(8), undefined)
  ck('сводка: «это спека (2):» — список ниже её', summaryPlaces(['Во вход БТ не беру — это спека (2):\n1. формирование файла по шаблону\n2. интеграция с кадровой системой\n\nТак?'], 'NEW').get(11), OTHER)
  ck('основы: «заявок» и «заявки» — одна основа', bestPoint('порядок заявок у руководителя', listPoints('CHG'))?.n, 9)
  ck('основы: ничья — не пункт («как сейчас работают пункты выдачи»: P6 и P9)', bestPoint('как сейчас работают пункты выдачи', listPoints('NB-IN')), null)
  ck('основы: одно общее слово — не пункт', bestPoint('календарные', listPoints('VAC')), null)
  // Круг 4 (r4 ni-chg run-1): суть P9 в сводке — «порядок списка у руководителя», общая основа одна. Строки дословно.
  const r4a = '- Календарные дни без вычета праздников, порядок списка у руководителя (FR-7) и «удаление черновиков не входит» (3.2) — уже записаны в БТ.'
  const r4b = '- уже записано — 3 (календарные дни без вычета праздников, порядок списка у руководителя, удаление черновиков не входит)'
  const lay4 = new Map([[6, { layer: 'БТ', doc: 'меняет: FR-3' }], [7, { layer: 'БТ', doc: 'уже записано: FR-1 и 3.2 Не входит в проект' }], [8, { layer: 'БТ', doc: 'меняет: FR-9' }], [9, { layer: 'БТ', doc: 'уже записано: FR-7' }], [10, { layer: 'БТ', doc: 'уже записано: 3.2 Не входит в проект' }], [11, { layer: 'спека', doc: 'документа нет' }], [12, { layer: 'БТ', doc: 'новое' }]])
  const in4 = new Set([6, 8, 12])
  ck('место в документе: «(FR-7)» и раскладка «P9 · уже записано: FR-7» → P9 (r4, ход 2)', summaryPlaces([r4a], 'CHG', { inInput: in4, layout: lay4 }).get(9), DONE)
  ck('место в документе без раскладки — по причине в PTS («БТ FR-7») → P9', summaryPlaces([r4a], 'CHG', { inInput: in4 }).get(9), DONE)
  ck('скобки до метки — строка с одной меткой целиком её: P7, P10 тоже «уже записано»', [7, 10].map((n) => summaryPlaces([r4a], 'CHG', { inInput: in4 }).get(n)).join(','), [DONE, DONE].join(','))
  ck('«3.2» у двух пунктов (P7, P10) — по месту не узнаётся (счёт 1 при трёх кандидатах — тоже нет)', (() => { const pl = summaryPlaces(['- уже записано — 1 (раздел 3.2)'], 'CHG', { inInput: in4, layout: lay4 }); return pl.get(7) === undefined && pl.get(10) === undefined })(), true)
  ck('счёт «уже записано — 1» и вне входа один такой пункт — покрытие', summaryPlaces(['- уже записано — 1 (раздел 3.2)'], 'CHG', { inInput: new Set([6, 7, 8, 9, 11, 12]), layout: lay4 }).get(10), DONE)
  ck('счёт «уже записано — 3» = три пункта «уже записано» по раскладке → P9 покрыт (r4, ход 3)', summaryPlaces([r4b], 'CHG', { inInput: in4, layout: lay4 }).get(9), DONE)
  ck('счёт без раскладки — по местам PTS (P7, P9, P10) → P9 покрыт', summaryPlaces([r4b], 'CHG', { inInput: in4 }).get(9), DONE)
  ck('счёт «уже записано — 2» при трёх кандидатах — не покрытие', summaryPlaces([r4b.replace('— 3', '— 2').replace(', порядок списка у руководителя', '')], 'CHG', { inInput: in4, layout: lay4 }).get(9), undefined)
  ck('счёт не перекрывает место, названное сводкой', summaryPlaces([r4b, '- для спеки — 1 (P9)'], 'CHG', { inInput: in4, layout: lay4 }).get(9), OTHER)

  // Прогоны круга 2 на диске — вердикты аудита.
  const have = R2_MUST.filter(([, p]) => existsSync(join(HERE, `${R2}${p}`)))
  if (!have.length) console.log('\nпрогоны круга 2 не найдены — проверка на них пропущена')
  else console.log('\nпрогоны круга 2 (вердикты аудита)')
  for (const [name, p, run, want, re] of have) {
    const r = gradeRun(join(HERE, `${R2}${p}/ni-${p}/${run}`), name)
    ck(`ni-${p} ${run} — ${want ? 'зелёный' : 'красный'}${re ? ' и с названной ошибкой' : ''}`, r.pass === want && (!re || r.red.some((m) => re.test(m))), true, r.red.join(' | '))
  }
  for (const [round, base, list] of [[3, R3, R3_MUST], [4, R4, R4_MUST]]) {
    const have = list.filter(([, p]) => existsSync(join(HERE, `${base}${p}`)))
    if (!have.length) { console.log(`\nпрогоны круга ${round} не найдены — проверка на них пропущена`); continue }
    console.log(`\nпрогоны круга ${round} (ложные красные разбора сводки)`)
    for (const [name, p, run, n, where] of have) {
      const r = gradeRun(join(HERE, `${base}${p}/ni-${p}/${run}`), name)
      const row = r.rows.find((x) => x.n === n)
      ck(`ni-${p} ${run} — зелёный, P${n} → «${where}»`, `${r.pass}/${row && row.where}`, `true/${where}`, r.red.join(' | '))
    }
  }
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ---------- прогон ----------

const IS_MAIN = !!process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1])
if (IS_MAIN) {
  const arg = process.argv[2]
  if (arg === '--selftest') selftest()
  const fxName = process.argv[process.argv.indexOf('--fx') + 1]
  const fx = FX[fxName]
  const verbose = process.argv.includes('--verbose')
  if (!arg || !existsSync(arg) || !fx) { console.error(`usage: node grade-ni.mjs <каталог проб> --fx ${Object.keys(FX).join('|')} [--verbose] | --selftest`); process.exit(1) }
  const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
  console.log(`\nпроба ni-${fxName.toLowerCase()}, ${arg}`)
  const SETTINGS = join(arg, '_settings.txt')
  const CAP = existsSync(SETTINGS) ? Number((read(SETTINGS).match(/потолок ходов: (\d+)/) || [])[1] || 0) : 0
  let n = 0; let green = 0
  for (const run of runs) {
    const dir = join(arg, run)
    if (!measured(dir)) { console.log(`  ${run}: НЕ ИЗМЕРЕНО`); continue }
    n++
    const r = gradeRun(dir, fxName)
    if (r.pass) green++
    const capHit = !r.hasInput && CAP > 0 && r.turns >= CAP
    console.log(`  ${run}: ${r.pass ? 'ЗЕЛЁНЫЙ' : 'КРАСНЫЙ — ' + r.red.join('; ')}`)
    console.log(`         ходов: ${r.turns}, субагентов: ${r.agents}${capHit ? ` · УПЁРСЯ В ПОТОЛОК ${CAP} ХОДОВ — читать answer-*.md` : ''}`)
    if (r.warn.length) console.log(`         предупреждения: ${r.warn.join(' · ')}`)
    if (verbose) for (const row of r.rows) console.log(`         P${row.n} [${row.kind}] → ${row.where}   (место: ${row.at.join(' | ')})`)
  }
  console.log(`\nИТОГ ${fxName}: ${green}/${n}  ← место каждого пункта, дословность, ожидания исходной пробы, засев не тронут`)
}
