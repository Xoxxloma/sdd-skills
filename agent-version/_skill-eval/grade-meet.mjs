#!/usr/bin/env node
// grade-meet.mjs — пробы meeting-intake: вход и разбор встречи против расшифровки и засева.
//
//   node grade-meet.mjs <каталог с песочницами> --fx VAC|ACC
//   node grade-meet.mjs --selftest
//
// Грейдится ФАЙЛ в песочнице, а не отчёт: вход (`meeting-<дата>-bt|spec.md`) — по анкерам
// fixtures/MEET-*/expected.md; разбор (`meeting-<дата>.razbor.md`) — каждая цитата сверяется со
// строкой расшифровки ±2. Документ задачи из засева должен остаться нетронутым.

import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const lf = (s) => s.replace(/\r\n/g, '\n')
const read = (p) => lf(readFileSync(p, 'utf8'))
const RE_API_FAILURE = /API Error|Request not allowed|Please run \/login|Credit balance|rate limit|session limit|usage limit/i
// Граница слова для кириллицы: `\b` в JS — только ASCII.
const w = (stem, flags = 'i') => new RegExp('(^|[^а-яёa-z])' + stem, flags)

const FX = {
  VAC: {
    key: 'EMP-1207',
    kind: 'bt',
    transcript: 'fixtures/MEET-VAC/seed/meeting-2026-10-07.txt',
    // Первым — документ задачи: самопроверка берёт по нему папку входа. Расшифровка — чтобы правку засева
    // в песочнице было видно.
    seed: {
      'docs/EMP-1207/business_requirements.md': 'fixtures/MEET-VAC/seed/docs/EMP-1207/business_requirements.md',
      'meeting-2026-10-07.txt': 'fixtures/MEET-VAC/seed/meeting-2026-10-07.txt',
    },
    etalon: { input: 'fixtures/MEET-VAC/etalon/meeting-2026-10-07-bt.md', razbor: 'fixtures/MEET-VAC/etalon/meeting-2026-10-07.razbor.md' },
    must: [
      // Номер FR не обязателен: Шаг 8 велит писать код словами, если его нет в сути записи.
      { id: 'fr10', d: 'FR-10: отмена в день начала', sec: ['Решено', 'Открыто'], re: [/(FR-10|отмен)/i, /(день|дат[аеуы])\s+начал|первый день|наступ\S*\s+дат/i] },
      { id: 'directors', d: 'директора → генеральный', sec: ['Решено', 'Открыто'], re: [/директор/i, /генеральн/i] },
      { id: 'minTerm', d: 'минимальный срок ежегодного — открыт', sec: ['Открыто'], re: [/ежегодн/i, /(3|тр[её]х|три)\s+(календарн|рабоч|дн)|минимальн\S*\s+срок|за сколько дн|срок\S*\s+подач/i] },
      { id: 'loader', d: 'кто грузит изменения списка — открыт', sec: ['Открыто'], re: [/изменени/i, /(загруж|грузит|залива|загрузк|внос|обновл)/i] },
      { id: 'list20', d: 'список до 20 октября', sec: null, re: [/(20|двадцат\S*)\s+октябр|20\.10/i] },
    ],
    mustNot: [
      { id: 'paper', d: '«директора на бумаге» (переиграно)', sec: null, re: [/директор/i, /бумаг/i] },
      { id: 'hrPending', d: '«кадровик видит на согласовании» (переиграно)', sec: null, re: [/кадровик[^.]{0,80}(видит|видят|видны)[^.]{0,40}(и|также|тоже)[^.]{0,30}на согласовании/i] },
      { id: 'impl', d: 'реализация во входе БТ', sec: null, re: [/(^|[^а-яё])(бэк(?!лог)|бэкенд|фронт|сокет|опраш|опрос|сервер|скрипт|ютиси)|UTC|храни(т|тся)\s+в\s+заявк/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/(^|[^а-яё])(ифт|ноут|школ|суточн|винд)/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/эф\s*эр|тысяч[аи]\s+двести|(^|[^а-яё])(три\s+два|один\s+два)([^а-яё]|$)/i] },
    ],
    razborMust: [
      // «Не потеряно» — есть запись в любой форме: цитатой, сутью или строкой-ссылкой (круг 5: «при
      // внутреннем «согласовано»» без слова «статус»). Поэтому анкеры — по смыслу, с синонимами.
      { id: 'nowCheck', d: 'проверка руководителя на момент нажатия', re: /момент нажат|при нажати|на момент согласован|руководител[^\n]{0,80}(провер|ошибк)/i },
      { id: 'onLoad', d: 'счётчик при загрузке', re: /при загрузк|при открыти\S*\s+страниц|без (живого|веб\s*сокет)/i },
      { id: 'daysStored', d: 'число дней хранится', re: /хран\S*[^\n]{0,30}(в заявке|на бэке|на сервере)|бэк хранит|на бэке/i },
      { id: 'paperKept', level: 'warn', d: 'переигранная «бумага» не потеряна', re: /бумаг/i },
      { id: 'drafts', level: 'warn', d: 'удаление черновиков', re: /удал\S*[^\n]{0,20}черновик|черновик\S*[^\n]{0,30}удал/i },
    ],
    // «Кто грузит изменения списка» — операционная загрузка: слой двоякий (expected.md, правка 2026-10-13).
    altOther: { loader: /открытый вопрос[\s\S]{0,400}?(грузит|загруж|залива)/i },
  },
  ACC: {
    key: 'ACS-208',
    kind: 'spec',
    transcript: 'fixtures/MEET-ACC/seed/meeting-2026-10-09.txt',
    seed: {
      'docs/ACS-208/business_requirements.md': 'fixtures/MEET-ACC/seed/docs/ACS-208/business_requirements.md',
      'meeting-2026-10-09.txt': 'fixtures/MEET-ACC/seed/meeting-2026-10-09.txt',
    },
    etalon: { input: 'fixtures/MEET-ACC/etalon/meeting-2026-10-09-spec.md', razbor: 'fixtures/MEET-ACC/etalon/meeting-2026-10-09.razbor.md' },
    must: [
      { id: 'async', d: 'заведение фоном с повтором', sec: ['Решено'], re: [/(^|[^а-яё])фон|асинхрон|отдельн\S*\s+задач/i, /повтор/i] },
      // У предложения нет явного принятия → Шаг 6; «в открытые вопросы» — законный ответ.
      { id: 'alert', d: 'оповещение дежурному портала', sec: ['Решено', 'Сведения', 'Открыто'], re: [/(оповещ|алерт|уведом|тревог|сигнал)/i, /дежурн/i] },
      { id: 'dup', d: 'повторное заведение → идентификатор, выдан', sec: ['Решено'], re: [/(E_ACC_DUP|409|уже есть|уже существует|уже завед)/i, /(идентификатор|номер|айди|(^|[^a-z])id([^a-z]|$))/i, /выдан/i] },
      { id: 'login', d: 'логин хранится', sec: ['Решено'], re: [/логин/i, /(хран|сохран)/i] },
      { id: 'stateOnOpen', d: 'состояние при открытии заявки', sec: ['Решено'], re: [/(при открыт|открыва|открыти)/i, /(состояни|активн)/i] },
      { id: 'hideRevoke', d: 'при сбое кнопка «Отозвать доступ» скрыта', sec: ['Решено'], re: [/(отозвать доступ|отзыв\S*\s+доступ|кнопк\S*\s+отзыв)/i, /(скры|прячем|прячет|не показыва|нет|не вид)/i] },
      { id: 'syncRevoke', d: 'отзыв синхронный', sec: ['Решено'], re: [/синхронн/i, /(блокир|отзыв)/i] },
      { id: 'state422', d: 'повторная блокировка → запрос состояния', sec: ['Решено'], re: [/(E_ACC_STATE|422|повторн\S*\s+блокир|уже заблокир|неверн\S*\s+состояни|блокировк\S*[^.]{0,40}ответ|ответ[^.]{0,40}блокир)/i, /(состояни|читаем|запрашива|провер)/i] },
      { id: 'codeFlag', d: 'код системы вместо признака', sec: ['Решено'], re: [/(^|[^а-яё])код/i, /признак/i] },
      // «служба информационной безопасности» из БТ — такая же опора, как «ИБ» встречи.
      { id: 'midStatus', d: 'промежуточный статус — к ИБ', sec: ['Расходится с БТ', 'Открыто'], re: [/статус/i, /(^|[^А-ЯЁа-яё])ИБ([^А-ЯЁа-яё]|$)|безопасност/] },
      { id: 'blocked', d: 'повторная заявка при заблокированной учётке — два варианта', sec: ['Расходится с БТ', 'Открыто'], re: [/заблокир/i, /очеред|обращени|заявк\S*\s+в\s+команд/i, /разблокир/i] },
    ],
    mustNot: [
      // `not` — законное противопоставление («фоном, а не синхронно»): пункт с ним не нарушение.
      { id: 'syncCreate', d: 'синхронное заведение решением', sec: ['Решено'], re: [/(завод|заведени|созда)[^.;,]{0,60}(^|[^а-яё])синхронн|(^|[^а-яё])синхронн[^.;,]{0,60}(завод|заведени|созда)|в том же запросе/i], not: /(^|[^а-яё])не\s+(синхронн|в том же запросе)/i },
      { id: 'hiddenStatus', d: 'скрытый внутренний статус решением', sec: ['Решено'], re: [/внутренн\S*\s+статус/i] },
      { id: 'asyncRevoke', d: 'блокировка фоном решением', sec: ['Решено'], re: [/(блокир|отзыв)[^.;,]{0,60}(^|[^а-яё])фон|(^|[^а-яё])фон[^.;,]{0,60}(блокир|отзыв)/i], not: /(^|[^а-яё])не\s+фон|отверг|отклон|не\s+дела/i },
      { id: 'busSub', d: 'подписка на увольнения решением', sec: ['Решено'], re: [/подпис[^.]{0,60}(увольн|событи|шин)/i] },
      // Упоминание отвергнутого варианта как довода («фоном не делаем, чтобы не вводить второй промежуточный
      // статус») — не решение.
      { id: 'midDecided', d: 'промежуточный статус решением', sec: ['Решено'], re: [/промежуточн/i], not: /отверг|отклон|не вводить|чтобы не/i },
      // `/api/v2` без `/accounts` — ссылка на доку ошибок, набранная в чате (L79), это опора.
      { id: 'leak', d: 'токен карточки idm без опоры', sec: null, re: [/\/api\/v2\/accounts|E_SYS_UNKNOWN|E_ACC_NOT_FOUND|idm\.client|employeeLogin|lockedAt|ENABLED|LOCKED|TERMINATED|targetSystemCode|hr\.employee\.dismissed|X-Idm-Client-Token|accountId|wiremock|(^|[^A-Za-z])(POST|GET)([^A-Za-z]|$)/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/е\s*акк|эй\s*си\s*эс|ай\s*ди\s*эм|вайр\s*мок|пост\s+аккаунт|гет\s+аккаунт|терминейтед|анлок|бэк\s*оф|таргет|аккаунт\s*айди|(^|[^а-яё])лок([^а-яё]|$)/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/гитлаб|линтер|пайплайн|ремонт|электричк|тоннел|(^|[^а-яё])ретро/i] },
    ],
    razborMust: [
      { id: 'syncKept', level: 'warn', d: 'синхронное заведение не потеряно', re: /в том же запросе|синхронно, в общем|(^|[^а-яё])синхронн\S*[^\n]{0,40}(завед|заводи|запрос)|(завед|заводи)\S*[^\n]{0,40}(^|[^а-яё])синхронн/i },
      { id: 'hiddenKept', level: 'warn', d: 'внутренний статус не потерян', re: /внутренн|внутри согласован/i },
      { id: 'token', level: 'warn', d: 'поручение по токену', re: /подаём сегодня|Глеб, сделаешь|(подаёт|подать|подаём)[^\n]{0,40}токен/i },
      { id: 'mock', d: 'заглушка для тестов', re: /(^|[^а-яё])мок|заглушк/i },
    ],
  },
  // Длинная встреча (660 строк, 3 окна карты, тема > 400 строк): см. fixtures/MEET-LONG/expected.md.
  LONG: {
    key: 'PSS-2210',
    kind: 'bt',
    transcript: 'fixtures/MEET-LONG/seed/meeting-2026-10-12.txt',
    seed: {
      'docs/PSS-2210/business_requirements.md': 'fixtures/MEET-LONG/seed/docs/PSS-2210/business_requirements.md',
      'meeting-2026-10-12.txt': 'fixtures/MEET-LONG/seed/meeting-2026-10-12.txt',
    },
    etalon: { input: 'fixtures/MEET-LONG/etalon/meeting-2026-10-12-bt.md', razbor: 'fixtures/MEET-LONG/etalon/meeting-2026-10-12.razbor.md' },
    must: [
      { id: 'deadline', d: 'срок подачи — до 18:00 рабочего дня перед визитом', sec: ['Решено'], re: [/(18|восемнадцат)/i, /(накануне|перед визит)/i] },
      { id: 'deputy', d: 'передача заместителю после 16:00', sec: ['Решено', 'Открыто'], re: [/заместител/i, /(16|шестнадцат)/i] },
      { id: 'notifyApplicant', d: 'уведомление заявителю при решении', sec: ['Решено'], re: [/заявител/i, /уведомл|оповещ|сообщени|письм/i, /(решени|согласова|отклон)/i] },
      { id: 'notifyContent', d: 'в уведомлении дата, время, ссылка', sec: ['Решено'], re: [/уведомл|оповещ|сообщени|письм/i, /(дата|время)/i, /ссылк/i] },
      { id: 'docOnlyBureau', d: 'номер документа видит только бюро', sec: ['Решено'], re: [/номер\S*\s+(документ|паспорт)/i, /только/i, /бюро/i] },
      { id: 'docType', d: 'паспорт РФ или иностранный, гражданство', sec: ['Решено'], re: [/иностран/i, /гражданств/i] },
      { id: 'purpose', d: 'цель визита из списка', sec: ['Решено'], re: [/цел\S*\s+визит/i, /(переговор|собеседовани|подрядчик|доставк)/i] },
      { id: 'hours', d: 'время визита — часы с 8 до 18', sec: ['Решено'], re: [/(час|время)/i, /(^|[^0-9])8([^0-9]|$)|восьми/i, /(18|восемнадцат)/i] },
      { id: 'rejectComment', d: 'комментарий при отклонении обязателен и виден заявителю', sec: ['Решено'], re: [/коммент/i, /обязател/i, /заявител/i] },
      { id: 'retention', d: 'хранение номера документа — к юристам', sec: ['Открыто'], re: [/(хран|сколько)/i, /юрист/i] },
      { id: 'urgent', d: 'срочный пропуск — вне проекта', sec: ['Не входит', 'Сведения', 'Решено'], re: [/срочн/i, /(вне проекта|не входит|пост|как сейчас|не через портал)/i] },
      { id: 'report', d: 'отчёт по визитам — в бэклог', sec: ['Не входит', 'Открыто'], re: [/отч[её]т/i, /визит/i] },
    ],
    mustNot: [
      { id: 'groups', d: 'групповые заявки решением (переиграно)', sec: ['Решено'], re: [/группов/i], not: /вне проекта|не входит|не делаем|отдельн|отлож/i },
      { id: 'passNumber', d: 'номер пропуска в уведомлении (не принято)', sec: ['Решено'], re: [/номер\S*\s+пропуск/i], not: /без номера|не видим|(^|[^а-яё])нет([^а-яё]|$)/i },
      { id: 'impl', d: 'реализация во входе БТ', sec: null, re: [/(^|[^а-яё])(кеш|кэш|таблиц|транзакц|мессенджер|маск|настройк)|(^|[^а-яё])(почт(а|ой|у|е|ы)?|бот(а|ом|у|е|ы)?)([^а-яё]|$)|десять цифр|производственн\S*\s+календар|справочник\S*\s+праздник/i] },
      { id: 'otherTopic', d: 'чужая тема во входе', sec: null, re: [/CSV|бухгалтер|командировк|обратн\S*\s+связ|капч|сертификат|(^|[^а-яё])релиз/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/(^|[^а-яё])(ифт|столов|ёлкин|елкин|планёрк)/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/пэ\s*эс\s*эс|двадцать\s+два\s+десять|эф\s*эр/i] },
    ],
    razborMust: [
      { id: 'groupsKept', level: 'warn', d: 'переигранные групповые не потеряны', re: /до пяти|группов/i },
      { id: 'cache', d: 'кеш руководителя — для спеки', re: /кеш|кэш/i },
      { id: 'tx', d: 'транзакция — для спеки', re: /транзакц/i },
      { id: 'passNumberKept', level: 'warn', d: 'номер пропуска — не принято', re: /номер\S*\s+пропуск/i },
    ],
  },
}

// ---------- вход ----------

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

// Пункт — строка «- …» или «N. …» со строками-продолжениями.
function items (lines) {
  const out = []
  for (const l of lines) {
    if (/^\s*(-|\d+\.)\s+/.test(l)) out.push(l.replace(/^\s*(-|\d+\.)\s+/, ''))
    else if (l.trim() && out.length) out[out.length - 1] += ' ' + l.trim()
  }
  return out
}

function itemsOf (secs, names) {
  const pick = names ? names : Object.keys(secs)
  return pick.flatMap((n) => (secs[n] ? items(secs[n]).map((t) => ({ sec: n, t })) : []))
}

export function gradeInput (text, fx) {
  const secs = sections(text)
  const r = { must: {}, mustNot: {} }
  for (const m of fx.must) r.must[m.id] = itemsOf(secs, m.sec).some(({ t }) => m.re.every((re) => re.test(t)))
  // Запреты и якоря — только по пунктам разделов: шапка законно несёт роли («бэкенд — …») и время встречи.
  const all = itemsOf(secs, null).map(({ t }) => t)
  for (const m of fx.mustNot) {
    const pool = m.sec ? itemsOf(secs, m.sec).map(({ t }) => t) : all
    r.mustNot[m.id] = pool.some((t) => m.re.every((re) => re.test(t)) && !(m.not && m.not.test(t)))
  }
  r.anchors = all.some((t) => /(^|[^A-Za-z])L\d+([^0-9]|$)|\d\d:\d\d:\d\d/.test(t))
  r.missing = fx.must.filter((m) => !r.must[m.id]).map((m) => m.d)
  r.violations = fx.mustNot.filter((m) => r.mustNot[m.id]).map((m) => m.d)
  if (r.anchors) r.violations.push('якоря или время во входе')
  r.pass = !r.missing.length && !r.violations.length
  return r
}

// ---------- разбор ----------

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim()

function transcriptTexts (raw) {
  return lf(raw).replace(/^\uFEFF/, '').split('\n').map((l) => {
    const m = l.match(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d - .+?: (.*)$/)
    return norm(m ? m[1] : l)
  })
}

// Опечатка в 1–2 символа («руководитель» вместо «руководителя») — не выдумка: сверка ловит выдуманную
// цитату, а не описку. Допуск — 5% длины, не меньше 1 символа; перестановка слов в допуск не влезает.
function near (win, p) {
  if (win.includes(p)) return true
  const k = Math.max(1, Math.floor(p.length * 0.05))
  if (p.length < 8) return false
  let prev = new Array(p.length + 1)
  let cur = new Array(p.length + 1)
  // Расстояние до лучшей подстроки окна (Селлерс): начало подстроки бесплатное.
  for (let j = 0; j <= p.length; j++) prev[j] = j
  for (let i = 1; i <= win.length; i++) {
    cur[0] = 0
    for (let j = 1; j <= p.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (win[i - 1] === p[j - 1] ? 0 : 1))
    }
    if (cur[p.length] <= k) return true;
    [prev, cur] = [cur, prev]
  }
  return false
}

// ДВА УРОВНЯ (2026-10-13, после кругов 1–9). Красный — то, что уходит дальше по пайплайну или делает
// разбор недостоверным: выдуманная цитата (её нет нигде в расшифровке), потеря записи для второго прогона.
// Предупреждение — точность журнала: цитата дословная, но с чужим номером строки; в журнале нет
// переигранного или поручения. Все-или-ничего по сотне цитат красило почти каждый круг при верном входе.
export function gradeRazbor (text, fx, tLines) {
  const r = { quotes: 0, bad: [], moved: [] }
  const full = tLines.join(' ')
  // Цитата — на ОДНОЙ строке записи: `[ \t]`, а не `\s`, иначе «итог: L201⏎ опора: «…»» читается цитатой.
  // Диапазон `L54–L57` — реплика на несколько строк (formats.md): окно от начала−2 до конца+2.
  const re = /L(\d+)(?:[–-]L?(\d+))?[ \t]+(?:[\d:]+[ \t]+)?(?:[^:«»\n]{1,60}:[ \t]*)?«([^»]+)»/g
  for (const m of text.matchAll(re)) {
    r.quotes++
    const n = Number(m[1])
    const end = m[2] ? Math.max(n, Number(m[2])) : n
    const win = tLines.slice(Math.max(0, n - 3), end + 2).join(' ')
    // Точка или запятая в конце обрезанного куска — не выдумка: сверяется текст без хвостовой пунктуации.
    // Порог 2 символа: короткое принятие «Да.», «Ок.» — законная цитата.
    const parts = m[3].split(/…|\.\.\./).map(norm).map((p) => p.replace(/[.,;:!?]+$/, '').trim()).filter((p) => p.length >= 2)
    if (parts.length && parts.every((p) => near(win, p))) continue
    if (parts.length && parts.every((p) => near(full, p))) r.moved.push(`L${n} «${m[3].slice(0, 40)}»`)
    else r.bad.push(`L${n} «${m[3].slice(0, 50)}»`)
  }
  r.lost = fx.razborMust.filter((m) => m.level !== 'warn' && !m.re.test(text)).map((m) => m.d)
  r.lostWarn = fx.razborMust.filter((m) => m.level === 'warn' && !m.re.test(text)).map((m) => m.d)
  r.heading = /^## Во вход /m.test(text)
  r.pass = r.quotes >= 10 && !r.bad.length && !r.lost.length && r.heading
  return r
}

// ---------- песочница ----------

function listFiles (dir, base = dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(p, base))
    else out.push(relative(base, p).split('\\').join('/'))
  }
  return out
}

// Файлы стенда в корне песочницы: их пишет пул, а не скилл.
const STAND = /^(answer(-\d+)?\.md|stream(-\d+)?\.jsonl|_[^/]*)$/
// Чтение `services/` и `context/` — нарушение правила 1 скилла, даже если ни один токен не утёк.
const RE_FORBIDDEN_READ = /(^|[\s/\\"'=])(services|context)[/\\]/
// Исключение в `find` (`-not -path "./services/*"`) — не чтение.
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

export function gradeRun (dir, fx) {
  const r = {}
  const seeded = existsSync(join(dir, '_seeded.txt')) ? new Set(read(join(dir, '_seeded.txt')).split('\n').filter(Boolean)) : new Set()
  const files = listFiles(dir)
  const want = new RegExp(`^docs/(.+/)?${fx.key}/meeting-[^/]+-${fx.kind}\\.md$`)
  const razborRe = new RegExp(`^docs/(.+/)?${fx.key}/meeting-[^/]+\\.razbor\\.md$`)
  const inputs = files.filter((f) => want.test(f))
  const razbors = files.filter((f) => razborRe.test(f))
  r.extra = files.filter((f) => !inputs.includes(f) && !razbors.includes(f) && !seeded.has(f) && !(f in fx.seed) && !(!f.includes('/') && STAND.test(f)))
  r.touched = Object.entries(fx.seed).filter(([rel, src]) => !existsSync(join(dir, rel)) || read(join(dir, rel)) !== read(join(HERE, src))).map(([rel]) => rel)
  r.inputPath = inputs[0] || null
  r.razborPath = razbors[0] || null
  r.input = inputs.length === 1 ? gradeInput(read(join(dir, inputs[0])), fx) : null
  r.razbor = razbors.length === 1 ? gradeRazbor(read(join(dir, razbors[0])), fx, transcriptTexts(readFileSync(join(HERE, fx.transcript), 'utf8'))) : null
  // Анкер с двояким слоем (expected.md): законно и во входе, и в разделе разбора «Для другого документа».
  if (r.input && r.razbor && fx.altOther) {
    const other = (read(join(dir, razbors[0])).split(/^## Для другого документа[^\n]*$/m)[1] || '').split(/^## /m)[0]
    for (const [id, re] of Object.entries(fx.altOther)) {
      if (!r.input.must[id] && re.test(other)) {
        r.input.must[id] = true
        r.input.missing = r.input.missing.filter((d) => d !== fx.must.find((m) => m.id === id).d)
        r.input.pass = !r.input.missing.length && !r.input.violations.length
      }
    }
  }
  const uses = toolUses(dir)
  r.forbiddenReads = uses.filter((u) => ['Read', 'Grep', 'Glob', 'Bash'].includes(u.name) && RE_FORBIDDEN_READ.test(Object.values(u.input).filter((v) => typeof v === 'string').join(' ').replace(RE_EXCLUDE_ARG, '')))
    .map((u) => `${u.sub ? 'субагент' : 'ведущий'} ${u.name} ${JSON.stringify(u.input).slice(0, 90)}`)
  r.agents = uses.filter((u) => !u.sub && (u.name === 'Agent' || u.name === 'Task')).length
  r.pass = inputs.length === 1 && razbors.length === 1 && !r.extra.length && !r.touched.length && !r.forbiddenReads.length && r.input.pass && r.razbor.pass
  return r
}

// ---------- самопроверка ----------

function selftest () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  for (const [name, fx] of Object.entries(FX)) {
    console.log(`\n${name}`)
    const inp = read(join(HERE, fx.etalon.input))
    const raz = read(join(HERE, fx.etalon.razbor))
    const tl = transcriptTexts(readFileSync(join(HERE, fx.transcript), 'utf8'))
    const gi = gradeInput(inp, fx)
    ck('эталон входа — зелёный', gi.pass, true)
    if (!gi.pass) console.log('     ', gi.missing, gi.violations)
    const gr = gradeRazbor(raz, fx, tl)
    ck('эталон разбора — зелёный', gr.pass, true)
    if (!gr.pass) console.log('     ', gr.quotes, gr.bad, gr.lost)
    ck('выдуманная цитата — поймана', gradeRazbor(raz.replace(/«([^»]{20,})»/, '«Это мы точно решили, записываю»'), fx, tl).bad.length, 1)
    const shifted = gradeRazbor(raz.replace(/L(\d+)( [\d:]+ [^:«\n]+: «)/, (_, n, rest) => `L${Number(n) + 40}${rest}`), fx, tl)
    ck('верная цитата на чужой строке — предупреждение, не красный', `${shifted.moved.length}/${shifted.bad.length}/${shifted.pass}`, '1/0/true')
    console.log(`      цитат в эталоне разбора: ${gr.quotes}`)
    const q1 = raz.match(/«([^»]{30,})»/)[1]
    const typo = q1.slice(0, 10) + (q1[10] === 'а' ? 'о' : 'а') + q1.slice(11)
    ck('опечатка в 1 букву — не выдумка', gradeRazbor(raz.replace(`«${q1}»`, `«${typo}»`), fx, tl).bad.length, 0)
    // Перестановка двух соседних длинных слов — как в круге 2 («сказать сейчас» вместо «сейчас сказать»).
    const words = q1.split(' ')
    const at = words.findIndex((w, i) => i + 1 < words.length && w.length >= 6 && words[i + 1].length >= 6)
    const swapped = at >= 0 ? [...words.slice(0, at), words[at + 1], words[at], ...words.slice(at + 2)].join(' ') : q1 + ' совершенно выдуманное продолжение'
    ck('перестановка длинных слов — поймана', gradeRazbor(raz.replace(`«${q1}»`, `«${swapped}»`), fx, tl).bad.length, 1)
    ck('якорь во входе — красный', gradeInput(inp.replace('## Решено\n', '## Решено\n0. L72 решили.\n'), fx).pass, false)

    const sandbox = mkdtempSync(join(tmpdir(), 'grade-meet-'))
    try {
      for (const [rel, src] of Object.entries(fx.seed)) { mkdirSync(join(sandbox, rel, '..'), { recursive: true }); writeFileSync(join(sandbox, rel), read(join(HERE, src))) }
      const folder = Object.keys(fx.seed)[0].replace(/\/[^/]+$/, '')
      writeFileSync(join(sandbox, folder, fx.etalon.input.split('/').pop()), inp)
      writeFileSync(join(sandbox, folder, fx.etalon.razbor.split('/').pop()), raz)
      ck('песочница с эталоном — зелёная', gradeRun(sandbox, fx).pass, true)
      const seedRel = Object.keys(fx.seed)[0]
      writeFileSync(join(sandbox, seedRel), read(join(sandbox, seedRel)) + '\nправка\n')
      ck('документ задачи тронут — красный', gradeRun(sandbox, fx).pass, false)
      writeFileSync(join(sandbox, seedRel), read(join(HERE, fx.seed[seedRel])))
      writeFileSync(join(sandbox, folder, 'business_requirements_v2.md'), 'x')
      ck('лишний файл — красный', gradeRun(sandbox, fx).extra.length, 1)
      rmSync(join(sandbox, folder, 'business_requirements_v2.md'))
      writeFileSync(join(sandbox, 'answer.md'), 'отчёт'); writeFileSync(join(sandbox, '_seeded.txt'), Object.keys(fx.seed).join('\n'))
      ck('файлы стенда в корне — не лишние', gradeRun(sandbox, fx).pass, true)
      writeFileSync(join(sandbox, 'notes.md'), 'x')
      ck('лишний файл в корне — пойман', gradeRun(sandbox, fx).extra.includes('notes.md'), true)
      rmSync(join(sandbox, 'notes.md'))
      const ev = (input, sub) => JSON.stringify({ type: 'assistant', parent_tool_use_id: sub ? 'toolu_1' : null, message: { content: [{ type: 'tool_use', id: 'x', name: 'Read', input }] } })
      writeFileSync(join(sandbox, 'stream.jsonl'), ev({ file_path: 'C:/sb/docs/' + fx.key + '/business_requirements.md' }, false) + '\n')
      ck('чтение документа задачи — законно', gradeRun(sandbox, fx).forbiddenReads.length, 0)
      writeFileSync(join(sandbox, 'stream-02.jsonl'), ev({ file_path: 'C:\\sb\\services\\idm.md' }, true) + '\n')
      ck('субагент читал services/ — пойман', gradeRun(sandbox, fx).forbiddenReads.length, 1)
      const bash = (command) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'y', name: 'Bash', input: { command } }] } })
      writeFileSync(join(sandbox, 'stream-02.jsonl'), bash('find . -name "*.md" -not -path "./services/*"') + '\n')
      ck('исключение services/ в find — не чтение', gradeRun(sandbox, fx).forbiddenReads.length, 0)
      writeFileSync(join(sandbox, 'stream-02.jsonl'), bash('cat services/idm.md') + '\n')
      ck('cat services/ относительным путём — пойман', gradeRun(sandbox, fx).forbiddenReads.length, 1)
    } finally { rmSync(sandbox, { recursive: true, force: true }) }

    const add = (line) => inp.replace('## Решено\n', `## Решено\n0. ${line}\n`)
    const drop = (re) => inp.split('\n').filter((l) => !re.test(l)).join('\n')
    ck('шапка с ролью «бэкенд» и временем с секундами — законна', gradeInput(inp.replace(/^> Встреча: .*$/m, '> Встреча: 2026-10-07 11:02:41–11:21:31 · решали: бэкенд — Иванов И. И.'), fx).pass, true)
    const RANGE = { VAC: [54, 57, 'А, да. Мы его собираем.… Человек 40 без руководителя получается.'], ACC: [29, 32, 'Ну как сказать.… Массовые заведения после кадровых приказов'], LONG: [279, 283, 'Я.… Я спрошу, но думаю, это нормально.'] }[name]
    ck('цитата-диапазон на несколько строк — сходится', gradeRazbor(raz.replace(/^## Отброшено/m, `#99 сведение · БТ · проба\n   цитаты: L${RANGE[0]}–L${RANGE[1]} 00:00:00 Кто: «${RANGE[2]}»\n\n## Отброшено`), fx, tl).bad.length, 0)
    ck('поле на следующей строке не читается цитатой', gradeRazbor(raz.replace(/^## Отброшено/m, '#98 сведение · БТ · проба\n   итог: L201\n   опора: «как прозвучало» → X\n\n## Отброшено'), fx, tl).bad.length, 0)
    if (name === 'VAC') {
      ck('«директора на бумаге» — пойман', gradeInput(add('Директора пишут заявление на бумаге, как раньше.'), fx).mustNot.paper, true)
      ck('реализация во входе БТ — поймана', gradeInput(add('Число дней считает бэк и хранит в заявке.'), fx).mustNot.impl, true)
      ck('«кадровик видит и на согласовании» — пойман', gradeInput(add('Кадровик видит и заявки на согласовании.'), fx).mustNot.hrPending, true)
      ck('форма на слух — поймана', gradeInput(add('Эф эр 3 не меняется.'), fx).mustNot.asr, true)
      ck('шум — пойман', gradeInput(add('ИФТ лежит до обеда.'), fx).mustNot.noise, true)
      ck('нет FR-10 — красный', gradeInput(drop(/FR-10/), fx).must.fr10, false)
      ck('срок ежегодного решением, а не открытым — красный', gradeInput(drop(/ежегодн/).replace('## Решено\n', '## Решено\n0. Ежегодный отпуск — не раньше чем за 3 календарных дня.\n'), fx).must.minTerm, false)
      ck('«вопрос» не считается «опросом»', gradeInput(inp + '\n## Открыто\n- Вопрос о сроке.\n', fx).mustNot.impl, false)
    } else if (name === 'LONG') {
      ck('групповые решением — пойманы', gradeInput(add('Групповые заявки — до пяти посетителей, одно решение на заявку.'), fx).mustNot.groups, true)
      ck('групповые «вне проекта» в Решено — законно', gradeInput(add('Групповые заявки остаются вне проекта, отдельной задачей.'), fx).mustNot.groups, false)
      ck('номер пропуска в уведомлении — пойман', gradeInput(add('В уведомлении — номер пропуска.'), fx).mustNot.passNumber, true)
      ck('«без номера пропуска» — законно', gradeInput(add('Уведомление без номера пропуска.'), fx).mustNot.passNumber, false)
      ck('«номера пропуска в уведомлении нет» — законно', gradeInput(add('Номера пропуска в уведомлении нет.'), fx).mustNot.passNumber, false)
      ck('кеш во входе БТ — пойман', gradeInput(add('Руководителя кешируем на сутки.'), fx).mustNot.impl, true)
      ck('чужая тема (CSV) — поймана', gradeInput(add('Выгрузка в CSV через точку с запятой.'), fx).mustNot.otherTopic, true)
      ck('форма на слух — поймана', gradeInput(add('Задача пэ эс эс двадцать два десять.'), fx).mustNot.asr, true)
      ck('шум — пойман', gradeInput(add('Столовая работает на втором этаже.'), fx).mustNot.noise, true)
      ck('срок подачи потерян — красный', gradeInput(drop(/накануне|перед визит/), fx).must.deadline, false)
      ck('хранение — решением, а не открытым — красный', gradeInput(drop(/юрист/).replace('## Решено\n', '## Решено\n0. Номер документа храним год — решили юристы.\n'), fx).must.retention, false)
      ck('«ботинок» и «почти» не считаются реализацией', gradeInput(add('Посетитель без ботинок почти не проходит.'), fx).mustNot.impl, false)
      ck('«почтой» и «бот» — реализация', gradeInput(add('Уведомление почтой, а не через бот.'), fx).mustNot.impl, true)
    } else {
      ck('токен карточки — пойман', gradeInput(add('Портал берёт accountId из тела ответа.'), fx).mustNot.leak, true)
      ck('POST латиницей — пойман', gradeInput(add('Заведение — POST в систему учёток.'), fx).mustNot.leak, true)
      ck('синхронное заведение решением — поймано', gradeInput(add('Учётка заводится синхронно в том же запросе.'), fx).mustNot.syncCreate, true)
      ck('промежуточный статус решением — пойман', gradeInput(add('Промежуточный статус называется «Согласована».'), fx).mustNot.midDecided, true)
      ck('блокировка фоном — поймана', gradeInput(add('Блокировка учётки идёт фоном.'), fx).mustNot.asyncRevoke, true)
      ck('форма на слух — поймана', gradeInput(add('Для тестов — вайр мок.'), fx).mustNot.asr, true)
      ck('шум — пойман', gradeInput(add('Линтер в гитлабе красный.'), fx).mustNot.noise, true)
      ck('нет «Отозвать доступ» — красный', gradeInput(drop(/Отозвать доступ/), fx).must.hideRevoke, false)
      ck('нет «Расходится с БТ» — красный', gradeInput(inp.replace(/## Расходится с БТ[\s\S]*$/, ''), fx).must.midStatus, false)
      ck('подписка в «Не входит» — законна', gradeInput(inp, fx).mustNot.busSub, false)
      const why = add('Отзыв синхронный; фоновую блокировку отвергли, чтобы не вводить второй промежуточный статус.')
      ck('отвергнутый вариант как довод — не «блокировка фоном»', gradeInput(why, fx).mustNot.asyncRevoke, false)
      ck('отвергнутый вариант как довод — не «промежуточный статус»', gradeInput(why, fx).mustNot.midDecided, false)
      ck('«асинхронно, а не в том же запросе» — законно', gradeInput(add('Учётка заводится асинхронно, а не в том же запросе.'), fx).mustNot.syncCreate, false)
      ck('«кнопка скрыта, статус не меняется» — не скрытый статус', gradeInput(add('Кнопка «Отозвать доступ» скрыта, статус заявки не меняется.'), fx).mustNot.hiddenStatus, false)
      ck('«синхронная блокировка, не фоном» — законно', gradeInput(add('Отзыв — синхронная блокировка, не фоном.'), fx).mustNot.asyncRevoke, false)
      ck('«заводит фоновая задача, а отзыв синхронный» — законно', gradeInput(add('Учётку заводит фоновая задача; отзыв — синхронная блокировка.'), fx).mustNot.asyncRevoke, false)
      ck('ссылка на доку ошибок /api/v2 — не утечка', gradeInput(inp.replace('## Сведения\n', '## Сведения\n- Коды ошибок — в документации https://wiki.corp/idm/api/v2#errors.\n'), fx).mustNot.leak, false)
      ck('«кнопки отзыва доступа нет» — засчитано', gradeInput(drop(/Отозвать доступ/).replace('## Решено\n', '## Решено\n0. Состояние учётки узнать не удалось — кнопки отзыва доступа нет.\n'), fx).must.hideRevoke, true)
      ck('«служба информационной безопасности» — засчитано', gradeInput(inp.replace(/решает: ИБ/g, 'решает: служба информационной безопасности'), fx).must.midStatus, true)
    }
  }
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ---------- прогон ----------

const arg = process.argv[2]
if (arg === '--selftest') selftest()
const fxName = process.argv[process.argv.indexOf('--fx') + 1]
const fx = FX[fxName]
if (!arg || !existsSync(arg) || !fx) { console.error('usage: node grade-meet.mjs <каталог с песочницами> --fx VAC|ACC | --selftest'); process.exit(1) }
const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
console.log(`\nпроба meet-${fxName.toLowerCase()}, ${arg}`)
let measured = 0; let green = 0
const SETTINGS = join(arg, '_settings.txt')
const CAP = existsSync(SETTINGS) ? Number((read(SETTINGS).match(/потолок ходов: (\d+)/) || [])[1] || 0) : 0
for (const n of runs) {
  const dir = join(arg, n)
  const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
  // Отказ API посреди диалога пул помечает отдельным файлом: такой прогон в знаменатель не идёт.
  if (existsSync(join(dir, '_api-failure.txt')) || existsSync(join(dir, '_api-failure-turn.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
  measured++
  const r = gradeRun(dir, fx)
  if (r.pass) green++
  const turns = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).length || 1
  // Упор в потолок без входа и законный стоп скилла посреди диалога — разбирать глазами: виноват может
  // быть скилл (вопросы по кругу), а может стенд (реплика не ответила на вопрос).
  const capHit = !r.inputPath && CAP > 0 && turns >= CAP
  const stopped = /разбор не состоялся/i.test(ans)
  const notes = [
    `ходов: ${turns}, субагентов: ${r.agents}`,
    capHit && `УПЁРСЯ В ПОТОЛОК ${CAP} ХОДОВ — читать answer-*.md`,
    stopped && 'В ДИАЛОГЕ «разбор не состоялся» — читать answer-*.md',
    r.forbiddenReads.length && 'ЧИТАЛ services/ ИЛИ context/: ' + r.forbiddenReads.join('; '),
    !r.inputPath && `входа -${fx.kind} нет`,
    !r.razborPath && 'разбора нет',
    r.extra.length && 'ЛИШНИЕ ФАЙЛЫ: ' + r.extra.join(', '),
    r.touched.length && 'ДОКУМЕНТ ЗАДАЧИ ТРОНУТ: ' + r.touched.join(', '),
    r.input && r.input.missing.length && 'нет: ' + r.input.missing.join('; '),
    r.input && r.input.violations.length && 'НАРУШЕНО: ' + r.input.violations.join('; '),
    r.razbor && r.razbor.bad.length && 'ВЫДУМАННЫЕ ЦИТАТЫ: ' + r.razbor.bad.join('; '),
    r.razbor && r.razbor.lost.length && 'в разборе потеряно для второго прогона: ' + r.razbor.lost.join('; '),
    r.razbor && `цитат: ${r.razbor.quotes}`,
  ].filter(Boolean)
  const warns = [
    r.razbor && r.razbor.moved.length && `номер строки не тот у ${r.razbor.moved.length}: ${r.razbor.moved.join('; ')}`,
    r.razbor && r.razbor.lostWarn.length && 'в журнале нет: ' + r.razbor.lostWarn.join('; '),
  ].filter(Boolean)
  console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  · ${notes.join(' · ')}${warns.length ? '\n         предупреждения: ' + warns.join(' · ') : ''}`)
}
console.log(`\n  ${green}/${measured}\tзелёных — вход по анкерам expected.md, цитаты разбора сходятся, документ задачи не тронут  ← КРИТЕРИЙ\n`)
