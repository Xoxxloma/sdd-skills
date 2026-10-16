#!/usr/bin/env node
// grade-meet.mjs — пробы meeting-intake: вход и разбор встречи против расшифровки и засева.
//
//   node grade-meet.mjs <каталог с песочницами> --fx VAC|ACC|LONG|NEW|REW|CHG|CR             вход (1.x)
//   node grade-meet.mjs <каталог с песочницами> --points --fx VAC|ACC|LONG|NEW|REW|CHG|CR|OUT  список (2.0)
//   node grade-meet.mjs --selftest            самопроверка режима входа
//   node grade-meet.mjs --selftest --points   самопроверка режима списка
//
// Грейдится ФАЙЛ в песочнице, а не отчёт: вход (`meeting-<дата>-bt|spec.md`) — по анкерам
// fixtures/MEET-*/expected.md; разбор (`meeting-<дата>.razbor.md`) — каждая цитата сверяется со
// строкой расшифровки ±2. Документ задачи из засева должен остаться нетронутым.
// Режим списка (`--points`, meeting-intake 2.0.0): вместо входа — список `meeting-<дата>.points.md` по форме
// meeting-intake/reference/output.md; ожидания входа перенесены на виды пунктов (см. раздел «список пунктов»).

import { resolve as pathResolve } from 'node:path'
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

export const FX = {
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
      { id: 'fr10', d: 'FR-10: отмена в день начала', sec: ['Решено', 'Открыто'], re: [/(FR-10|отмен)/i, /(день|дат[аеуы])\s+(его\s+|её\s+)?начал|первый день|наступ\S*\s+дат|до\s+начала/i] },
      { id: 'directors', d: 'директора → генеральный', sec: ['Решено', 'Открыто'], re: [/директор/i, /генеральн|гендир/i] },
      { id: 'minTerm', d: 'минимальный срок ежегодного — открыт', sec: ['Открыто'], re: [/ежегодн/i, /(3|тр[её]х|три)\s+(календарн|рабоч|дн)|минимальн\S*\s+срок|за сколько дн|сколько\s+дн|срок\S*\s+подач/i] },
      { id: 'loader', d: 'кто грузит изменения списка — открыт', sec: ['Открыто'], re: [/(изменени|обновлени)/i, /(загруж|грузит|залива|загрузк|внос|обновл)/i] },
      { id: 'list20', d: 'список до 20 октября', sec: null, re: [/(20|двадцат\S*)(-го)?\s+октябр|20\.10/i] },
    ],
    mustNot: [
      // «бумажные» тоже; «на бумаге … не будут / не принимают» — это и есть решение, не переигранное.
      { id: 'paper', d: '«директора на бумаге» (переиграно)', sec: null, re: [/директор/i, /бума[гж]/i], not: /не\s+будут|не\s+принима|нельзя|с\s+февраля|больше\s+не|вместо|а не/i },
      { id: 'hrPending', d: '«кадровик видит на согласовании» (переиграно)', sec: null, re: [/кадровик[^.]{0,80}(видит|видят|видны)[^.]{0,40}(^|[^а-яё])(и|также|тоже)([^а-яё]|$)[^.]{0,30}на согласовании/i], not: /только\s+согласованн|не\s+вид/i },
      // L125: «Это вот в БТ не надо. Это в спеку.» — проверка руководителя на момент нажатия.
      { id: 'impl', d: 'реализация во входе БТ', sec: null, re: [/(^|[^а-яё])(бэк(?!лог)|бэкенд|фронт|сокет|опраш|опрос|сервер|скрипт|ютиси)|UTC|храни(т|тся)\s+в\s+заявк|момент нажат/i] },
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
      { id: 'async', d: 'заведение фоном с повтором', sec: ['Решено'], re: [/(^|[^а-яё])фон|асинхрон|отдельн/i, /повтор/i] },
      // У предложения нет явного принятия → Шаг 6; «в открытые вопросы» — законный ответ.
      { id: 'alert', d: 'оповещение дежурному портала', sec: ['Решено', 'Сведения', 'Открыто'], re: [/(оповещ|алерт|уведом|тревог|сигнал)/i, /дежурн/i] },
      { id: 'dup', d: 'повторное заведение → идентификатор, выдан', sec: ['Решено'], re: [/(E_ACC_DUP|409|уже есть|уже существует|уже завед|повторн\S*\s+завед|существующ)/i, /(идентификатор|номер|айди|(^|[^a-z])id([^a-z]|$)|существующ\S*\s+(учётк\S*\s+)?из\s+отве|учётк\S*\s+из\s+(тела\s+)?ответа|из\s+ответа)/i, /выда(н|л|ч)/i] },
      { id: 'login', d: 'логин хранится', sec: ['Решено'], re: [/логин/i, /(хран|сохран)/i] },
      // «при открытии заявки запрашиваем данные учётки» — L123 «при открытии заявки дёргал гет аккаунт» (круг 3).
      { id: 'stateOnOpen', d: 'состояние при открытии заявки', sec: ['Решено'], re: [/(при открыт|открыва|открыти)/i, /(состояни|активн|данн\S*\s+учётк)/i] },
      { id: 'hideRevoke', d: 'при сбое кнопка «Отозвать доступ» скрыта', sec: ['Решено'], re: [/(отозвать доступ|отзыв\S*\s+доступ|кнопк\S*\s+отзыв)/i, /(скры|прячем|прячет|не показыва|нет|не вид)/i] },
      { id: 'syncRevoke', d: 'отзыв синхронный', sec: ['Решено'], re: [/(^|[^а-яё])синхронн/i, /(блокир|отзыв)/i] },
      { id: 'state422', d: 'повторная блокировка → запрос состояния', sec: ['Решено'], re: [/(E_ACC_STATE|422|повторн\S*\s+блокир|уже заблокир|неверн\S*\s+состояни|блокировк\S*[^.]{0,40}отве[тч]|отве[тч][^.]{0,40}блокир)/i, /(состояни|читаем|запрашива|провер)/i] },
      { id: 'codeFlag', d: 'код системы вместо признака', sec: ['Решено'], re: [/(^|[^а-яё])код/i, /признак|флаг/i] },
      // «служба информационной безопасности» из БТ — такая же опора, как «ИБ» встречи.
      { id: 'midStatus', d: 'промежуточный статус — к ИБ', sec: ['Расходится с БТ', 'Открыто'], re: [/статус/i, /(^|[^А-ЯЁа-яё])ИБ([^А-ЯЁа-яё]|$)|безопасност/] },
      { id: 'blocked', d: 'повторная заявка при заблокированной учётке — два варианта', sec: ['Расходится с БТ', 'Открыто'], re: [/заблокир/i, /очеред|обращени|заявк\S*\s+в\s+команд/i, /разблокир|снят\S*\s+блокир/i] },
    ],
    mustNot: [
      // `not` — законное противопоставление («фоном, а не синхронно»): пункт с ним не нарушение.
      { id: 'syncCreate', d: 'синхронное заведение решением', sec: ['Решено'], re: [/(завод|заведени|созда)[^.;,]{0,60}(^|[^а-яё])синхронн|(^|[^а-яё])синхронн[^.;,]{0,60}(завод|заведени|созда)|в том же запросе/i], not: /(^|[^а-яё])не\s+(синхронн|в том же запросе)/i },
      // Отрицание и довод («скрытого статуса нет», «подписку не делаем», «понадобился бы») — не решение.
      { id: 'hiddenStatus', d: 'скрытый внутренний статус решением', sec: ['Решено'], re: [/внутренн\S*\s+статус/i], not: /(^|[^а-яё])(нет|без|не\s+дела|не\s+нуж|не\s+ввод)([^а-яё]|$)/i },
      { id: 'asyncRevoke', d: 'блокировка фоном решением', sec: ['Решено'], re: [/(блокир|отзыв)[^.;,]{0,60}((^|[^а-яё])фон|асинхрон)|((^|[^а-яё])фон|асинхрон)[^.;,]{0,60}(блокир|отзыв)/i], not: /(^|[^а-яё])не\s+фон|отверг|отклон|не\s+дела|не\s+бер[её]|(^|[^а-яё])бы([^а-яё]|$)|(^|[^а-яё])без([^а-яё]|$)/i }, // «Блокировку фоновой задачей не берём» — nb-r6-reg run-1
      { id: 'busSub', d: 'подписка на увольнения решением', sec: ['Решено'], re: [/подпис[^.]{0,60}(увольн|событи|шин)/i], not: /не\s+дела|не\s+бер|не\s+нуж|(^|[^а-яё])без([^а-яё]|$)|не входит/i },
      // Упоминание отвергнутого варианта как довода («фоном не делаем, чтобы не вводить второй промежуточный
      // статус») — не решение.
      { id: 'midDecided', d: 'промежуточный статус решением', sec: ['Решено'], re: [/промежуточн/i], not: /отверг|отклон|не вводить|чтобы не|(^|[^а-яё])без([^а-яё]|$)|(^|[^а-яё])нет([^а-яё]|$)|(^|[^а-яё])бы([^а-яё]|$)/i },
      // `/api/v2` без `/accounts` — ссылка на доку ошибок, набранная в чате (L79), это опора.
      { id: 'leak', d: 'токен карточки idm без опоры', sec: null, re: [/\/api\/v2\/accounts|E_SYS_UNKNOWN|E_ACC_NOT_FOUND|idm\.client|employeeLogin|lockedAt|ENABLED|LOCKED|TERMINATED|targetSystemCode|hr\.employee\.dismissed|X-Idm-Client-Token|accountId|wiremock|(^|[^A-Za-z])(POST|GET)([^A-Za-z]|$)/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/(^|[^а-яё])е\s*акк|эй\s*си\s*эс|ай\s*ди\s*эм|вайр\s*мок|пост\s+аккаунт|гет\s+аккаунт|терминейтед|анлок|бэк\s*оф|таргет|аккаунт\s*айди|(^|[^а-яё])лок([^а-яё]|$)/i] },
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
      { id: 'groups', d: 'групповые заявки решением (переиграно)', sec: ['Решено'], re: [/группов/i], not: /вне проекта|не входит|не делаем|отдельн|отлож|кейс/i },
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
  // Фичу обсуждают с нуля: документов задачи нет, ключ только в чате. См. fixtures/MEET-NEW/expected.md.
  NEW: {
    key: 'HRS-311',
    kind: 'bt',
    // Документа задачи нет — папку входа самопроверка берёт отсюда, а не из засева.
    folder: 'docs/HRS-311',
    transcript: 'fixtures/MEET-NEW/seed/meeting-2026-10-08.txt',
    seed: { 'meeting-2026-10-08.txt': 'fixtures/MEET-NEW/seed/meeting-2026-10-08.txt' },
    etalon: { input: 'fixtures/MEET-NEW/etalon/meeting-2026-10-08-bt.md', razbor: 'fixtures/MEET-NEW/etalon/meeting-2026-10-08.razbor.md' },
    must: [
      { id: 'kinds', d: 'виды: с места работы и копия трудовой', sec: ['Решено'], re: [/с места работы/i, /трудов/i] },
      { id: 'format', d: 'формат на выбор: электронная или бумажная', sec: ['Решено'], re: [/электрон/i, /бумажн/i, /(выбор|выбира|(^|[^а-яё])сам)/i] },
      { id: 'term', d: 'срок 3 рабочих дня', sec: ['Решено'], re: [/(3|тр[её]х|три)\s+рабоч/i] },
      { id: 'executor', d: 'видят все специалисты, кто взял — исполнитель', sec: ['Решено'], re: [/специалист/i, /(взял|взят|исполнител)/i] },
      { id: 'notify', d: 'уведомление на портале', sec: ['Решено'], re: [/уведомл/i, /портал/i] },
      { id: 'cancel', d: 'отмена, пока не взяли в работу', sec: ['Решено'], re: [/отмен/i, /(не взял|не взят|в работу|возьм)/i] },
      { id: 'self', d: 'только для себя', sec: ['Решено'], re: [/(для себя|за другого|только себе)/i] },
      { id: 'sign', d: 'подпись — к юристам', sec: ['Открыто'], re: [/подпис/i, /юрист/i] },
      { id: 'salary', d: 'справка с зарплатой — к главному бухгалтеру', sec: ['Открыто'], re: [/(зарплат|заработн)/i, /(бухгалтер|главбух)/i] },
      // «2-НДФЛ в портал не берут» в «Решено» — то же решение (пилот 2026-10-14).
      // В «Не входит» — любое упоминание; в «Решено» — с отрицанием (два решения в одном пункте законны — Шаг 8).
      { id: 'ndfl', d: '2-НДФЛ не входит', sec: ['Не входит'], re: [/НДФЛ/i], alt: [{ sec: ['Решено'], re: [/НДФЛ/i, /(не входит|(^|[^а-яё])вне\s|не\s+бер|не\s+дела|не\s+тащ|как сейчас|бухгалтери)/i] }] },
      { id: 'former', d: 'бывшие сотрудники не входят', sec: ['Не входит'], re: [/(бывш|уволен)/i], alt: [{ sec: ['Решено'], re: [/(бывш|уволен)/i, /(как сейчас|письм|не входит|(^|[^а-яё])вне\s|нельзя|не\s+мог)/i] }] },
      { id: 'courier', d: 'курьер не входит', sec: ['Не входит'], re: [/курьер/i], alt: [{ sec: ['Решено'], re: [/курьер/i, /(не\s|(^|[^а-яё])вне\s|не входит|(^|[^а-яё])без\s)/i] }] },
    ],
    mustNot: [
      // Пункт «формат на выбор: электронная или бумажная» законно называет электронную.
      { id: 'onlyElectronic', d: '«только электронные» решением (переиграно после «итого»)', sec: ['Решено'], re: [/только\s+электрон/i], not: /бумажн/i },
      { id: 'fiveDays', d: '«пять рабочих дней» (переиграно)', sec: null, re: [/(5|пят\S*)\s+рабоч/i] },
      { id: 'ndflDecided', d: '2-НДФЛ видом справки в «Решено»', sec: ['Решено'], re: [/НДФЛ/i], not: /(^|[^а-яё])(не|без|кроме)\s|через бухгалтер/i },
      { id: 'impl', d: 'реализация во входе БТ', sec: null, re: [/(^|[^а-яё])(бэк(?!лог)|бэкенд|хранилищ|интеграц|зуп)|1С|S3/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/эйч\s*ар|эн\s*д[эе]\s*эф|пэ\s*д[эе]\s*эф/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/собак|кофемашин|(^|[^а-яё])демо/i] },
    ],
    razborMust: [
      // «Генерим на бэке… я так, для себя» — ни решения, ни сведения: «Отброшено» законно (пилот 2026-10-14).
      { id: 'tpl', level: 'warn', d: 'формирование справки на бэке — для спеки', re: /генерим|по шаблону на бэке|файлов\S*\s+хранилищ/i },
      { id: 'zup', d: 'данные о сотруднике из кадровой системы — для спеки', re: /зуп|кадров\S*\s+систем|должность и дата при[её]ма/i },
      { id: 'electronicKept', level: 'warn', d: 'переигранное «только электронные» не потеряно', re: /только электронн/i },
      { id: 'fiveKept', level: 'warn', d: 'переигранные «пять дней» не потеряны', re: /пять (рабочих )?дн|(^|[^0-9])5 рабоч/i },
    ],
  },
  // Вторая встреча по готовой спеке: закрывают её открытые вопросы. См. fixtures/MEET-REW/expected.md.
  REW: {
    key: 'ACS-208',
    kind: 'spec',
    transcript: 'fixtures/MEET-REW/seed/meeting-2026-10-14.txt',
    seed: {
      'docs/ACS-208/technical_specification.md': 'fixtures/MEET-REW/seed/docs/ACS-208/technical_specification.md',
      'docs/ACS-208/business_requirements.md': 'fixtures/MEET-REW/seed/docs/ACS-208/business_requirements.md',
      // Вход прошлой встречи лежит в папке: он не новый вход и не лишний файл.
      'docs/ACS-208/meeting-2026-10-09-spec.md': 'fixtures/MEET-REW/seed/docs/ACS-208/meeting-2026-10-09-spec.md',
      'meeting-2026-10-14.txt': 'fixtures/MEET-REW/seed/meeting-2026-10-14.txt',
    },
    etalon: { input: 'fixtures/MEET-REW/etalon/meeting-2026-10-14-spec.md', razbor: 'fixtures/MEET-REW/etalon/meeting-2026-10-14.razbor.md' },
    must: [
      { id: 'retry', d: 'повторы: 5 минут, вдвое, не больше 6 часов, сутки', sec: ['Решено'], re: [/(5|пят\S*)\s*мин/i, /(вдвое|удва|удво|в два раза)/i, /(6|шест\S*)\s*(час|ч([^а-яё]|$))/i, /сут(о?к|ки)/i] }, // «в течение суток» — 2026-10-14, nb-r3-reg run-1
      { id: 'alert', d: 'алерт в канал дежурной смены', sec: ['Решено'], re: [/portal-duty|дежурн/i, /(алерт|оповещ|канал)/i] },
      // Итог L73 «три, пятнадцать, тридцать» подталкивает к сжатой записи: «состояния — 3, блокировка — 15,
      // заведение — 30 секунд», «3 с / 15 с / 30 с». Единица — где угодно в пункте, число — рядом со словом.
      { id: 'tState', d: 'таймаут запроса состояния — 3 секунды', sec: ['Решено'], re: [/секунд|сек|\d\s*с([^а-яё]|$)/i, /состояни[^;.]{0,50}((^|[^0-9])3|тр[её]х|три)([^0-9]|$)|((^|[^0-9])3|тр[её]х|три)\s*(с|сек\S*|секунд\S*)[^;.]{0,50}состояни/i] },
      { id: 'tBlock', d: 'таймаут блокировки — 15 секунд', sec: ['Решено'], re: [/секунд|сек|\d\s*с([^а-яё]|$)/i, /(блокир|отзыв)[^;.]{0,50}(15|пятнадцат)|(15|пятнадцат\S*)\s*(с|сек\S*|секунд\S*)[^;.]{0,50}(блокир|отзыв)/i] },
      { id: 'tCreate', d: 'таймаут заведения — 30 секунд', sec: ['Решено'], re: [/секунд|сек|\d\s*с([^а-яё]|$)/i, /завед[^;.]{0,50}(30|тридцат)|(30|тридцат\S*)\s*(с|сек\S*|секунд\S*)[^;.]{0,50}завед/i] },
      { id: 'cache', d: 'кэш состояния — одна минута', sec: ['Решено'], re: [/к[эе]ш/i, /((^|[^0-9])1|одн\S*)\s+минут|минуту|60\s*(с|сек)/i] },
      { id: 'flag', d: 'флаг на подачу, выключен до заполнения', sec: ['Решено'], re: [/флаг/i, /(выключ|не включ|до заполн|пока)/i] },
      { id: 'domainLogin', d: 'при заведении — доменный логин и код системы', sec: ['Сведения', 'Решено'], re: [/доменн/i, /код\S*\s+систем/i] },
    ],
    mustNot: [
      { id: 'tabel', d: 'табельный номер (переиграно после «итого»)', sec: null, re: [/табельн/i], not: /(^|[^а-яё])(не\s+нужен|не\s+переда|не\s+использ|больше\s+не|вместо|а не|был\s+в\s+старой|не\s+хран)/i },
      // Отвергнутый вариант как довод («десять минут отклонили») — не решение.
      { id: 'tenMin', d: '«каждые десять минут» решением', sec: ['Решено'], re: [/(^|[^0-9])(10|десят\S*)\s+минут/i], not: /отклон|отверг|вместо|а не|не\s+кажд/i },
      // «до 8–10 секунд по понедельникам» — сведение, а не таймаут.
      { id: 'tenSec', d: '«десять секунд на всё» решением', sec: ['Решено'], re: [/(^|[^0-9–-])(10|десят\S*)\s+секунд/i], not: /8\s*[–-]\s*10|восьми|отклон|отверг|вместо|а не/i },
      { id: 'cache5', d: 'кэш на пять минут решением', sec: ['Решено'], re: [/к[эе]ш/i, /(^|[^0-9])(5|пят\S*)\s+минут/i], not: /отклон|отверг|вместо|а не|не\s+пят/i },
      { id: 'messenger', d: 'уведомление в мессенджер решением', sec: ['Решено'], re: [/мессенджер/i], not: /(^|[^а-яё])(не|вне)([^а-яё]|$)/i },
      { id: 'leak', d: 'токен карточки idm без опоры', sec: null, re: [/\/api\/v2\/accounts|E_SYS_UNKNOWN|E_ACC_NOT_FOUND|idm\.client|employeeLogin|lockedAt|targetSystemCode|X-Idm-Client-Token/] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/эй\s*си\s*эс|е\s*акк|портал\s*дьюти|(^|[^а-яё])тбд/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/переезд|принтер|(^|[^а-яё])этаж|(^|[^а-яё])демо/i] },
    ],
    razborMust: [
      { id: 'tabelKept', level: 'warn', d: 'переигранный табельный номер не потерян', re: /табельн/i },
      { id: 'tenMinKept', level: 'warn', d: '«каждые десять минут» не потеряно', re: /десят\S*\s+минут|10 минут/i },
      { id: 'cache5Kept', level: 'warn', d: 'кэш на пять минут не потерян', re: /пять минут|5 минут/i },
    ],
  },
  // Вторая встреча по отпускам: меняет записанное, последнее слово — после итогов внутри чужой темы.
  // См. fixtures/MEET-CHG/expected.md.
  CHG: {
    key: 'EMP-1207',
    kind: 'bt',
    transcript: 'fixtures/MEET-CHG/seed/meeting-2026-10-15.txt',
    seed: {
      'docs/EMP-1207/business_requirements.md': 'fixtures/MEET-CHG/seed/docs/EMP-1207/business_requirements.md',
      'meeting-2026-10-15.txt': 'fixtures/MEET-CHG/seed/meeting-2026-10-15.txt',
    },
    etalon: { input: 'fixtures/MEET-CHG/etalon/meeting-2026-10-15-bt.md', razbor: 'fixtures/MEET-CHG/etalon/meeting-2026-10-15.razbor.md' },
    headerMust: [['цель в шапке — правки БТ', /цель:\W*правки БТ/i]],
    must: [
      // Три календарных дня — именно у ежегодного (перепутанные виды отпуска — дефект).
      { id: 'fr3', d: 'ежегодный — за три календарных дня (изменение FR-3)', sec: ['Решено'], re: [/ежегодн[^.;]{0,120}((^|[^0-9])3|тр[её]х|три)\s+календарн/i] },
      { id: 'fr9', d: 'кадровик видит и отменённые (изменение FR-9)', sec: ['Решено'], re: [/отмен/i, /(кадр|согласованн|FR-9)/i] },
      { id: 'retention3', d: 'отклонённые и отозванные хранятся три года', sec: ['Решено'], re: [/(хран|удал|срок)/i, /((^|[^0-9])3|тр[её]х|три)\s+(год|лет)|тр[её]хлетн/i] },
    ],
    mustNot: [
      // «год» отдельным словом при хранении; «три года, а не год» — законно, «год, … три года» — нет.
      { id: 'retention1', d: 'хранение «год» (переиграно после итогов)', sec: null, re: [/хран/i, /(^|[^а-яё0-9])(1\s+)?год([^а-яё]|$)|один год/i], not: /(а не|вместо|не)\s+(1\s+|один\s+)?год([^а-яё]|$)/i },
      { id: 'fr9Inverted', d: 'отменённые в список не попадают (обратное решению)', sec: ['Решено'], re: [/отмен[^.;]{0,60}не\s+(попада|показыва|вид|вход)/i] },
      { id: 'otherTopic', d: 'чужая тема (командировки)', sec: null, re: [/суточн|командировк|бухгалтер/i] },
      { id: 'impl', d: 'реализация во входе БТ', sec: null, re: [/(^|[^а-яё])(бэк(?!лог)|джоб|сервер|крон)|раз в сутки/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/эф\s*эр|тысяч\S*\s+двести/i] },
      { id: 'noise', d: 'шум', sec: null, re: [/переговорк|кондиционер/i] },
    ],
    razborMust: [
      { id: 'cleanup', level: 'warn', d: 'очистка «джобой раз в сутки» — для спеки', re: /джоб|раз в сутки|чищу/i },
      { id: 'yearKept', level: 'warn', d: 'переигранный «год» не потерян', re: /хранятся год|год, наверное/i },
    ],
  },
  // Правка работающей функции, расшифровка в VTT, документов нет. См. fixtures/MEET-CR/expected.md.
  CR: {
    key: 'SUP-412',
    kind: 'bt',
    folder: 'docs/SUP-412',
    transcript: 'fixtures/MEET-CR/seed/support-sync-2026-10-16.vtt',
    seed: { 'support-sync-2026-10-16.vtt': 'fixtures/MEET-CR/seed/support-sync-2026-10-16.vtt' },
    etalon: { input: 'fixtures/MEET-CR/etalon/meeting-2026-10-16-bt.md', razbor: 'fixtures/MEET-CR/etalon/meeting-2026-10-16.razbor.md' },
    // Даты в расшифровке нет — имена файлов по дате из имени расшифровки (Шаг 3).
    fileDate: '2026-10-16',
    // Короткая встреча: законный минимальный разбор — около 9 цитат (проверка пробы 2026-10-14).
    minQuotes: 7,
    headerMust: [['цель в шапке — правка работающего', /цель:\W*правк\S*\s+работающ/i]],
    must: [
      // Правка работающего — «как сейчас → как должно стать» (output.md): обе стороны.
      { id: 'sevenDays', d: 'автозакрытие — семь рабочих дней вместо трёх календарных', sec: ['Решено'], re: [/(7|сем\S*)\s+рабоч/i, /(3|тр[её]х|три)\s+календарн/i] },
      { id: 'reminder', d: 'письмо пользователю за рабочий день до закрытия', sec: ['Решено'], re: [/(письм|напомин|уведомл|сообщени|почт)/i, /(за\s+(1\s+|один\s+|одн\S*\s+)?рабоч\S*\s+д|(предыдущ|последн)\S*\s+рабоч)/i] },
    ],
    mustNot: [
      { id: 'fiveDays', d: '«пять рабочих дней» (переиграно)', sec: null, re: [/(^|[^0-9])(5|пят\S*)\s+рабоч/i], not: /а не|вместо|предлага|предлож|мало|отверг|не\s+пят|не\s+принят/i },
      { id: 'bugDecided', d: 'ошибка «Переоткрыть» решением', sec: ['Решено'], re: [/переоткр/i], not: /не в эту задачу|не входит|(^|[^а-яё])вне\s|отдельн/i },
      { id: 'impl', d: 'реализация во входе', sec: null, re: [/производственн\S*\s+календар|(^|[^а-яё])(сервис|крон|бэк(?!лог))/i] },
      { id: 'asr', d: 'форма на слух', sec: null, re: [/эс\s*ю\s*пи|четыреста\s+двенадцат/i] },
    ],
    razborMust: [
      { id: 'calendar', level: 'warn', d: 'производственный календарь — для спеки', re: /производственн\S*\s+календар/i },
      { id: 'fiveKept', level: 'warn', d: 'переигранные «пять рабочих» не потеряны', re: /пять рабочих/i },
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

// Пункт — строка «- …», «* …», «N. …» или «N) …» со строками-продолжениями. Подпункт с отступом — часть
// своего пункта: «1. Ежегодный (FR-3):⏎   - не раньше чем за три дня» — одно решение (проверка пробы 2026-10-14).
function items (lines) {
  const out = []
  const MARK = /^\s*(-|\*|\d+[.)])\s+/
  for (const l of lines) {
    if (/^ ?(-|\*|\d+[.)])\s+/.test(l)) out.push(l.replace(MARK, ''))
    else if (l.trim() && out.length) out[out.length - 1] += ' ' + l.trim().replace(MARK, '')
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
  // `alt` — тот же пункт законно лежит в другом разделе, но там нужны свои признаки (в «Решено» — отрицание).
  const hit = (c) => itemsOf(secs, c.sec).some(({ t }) => c.re.every((re) => re.test(t)))
  for (const m of fx.must) r.must[m.id] = hit(m) || (m.alt || []).some(hit)
  // Запреты и якоря — только по пунктам разделов: шапка законно несёт роли («бэкенд — …») и время встречи.
  const all = itemsOf(secs, null).map(({ t }) => t)
  for (const m of fx.mustNot) {
    const pool = m.sec ? itemsOf(secs, m.sec).map(({ t }) => t) : all
    r.mustNot[m.id] = pool.some((t) => m.re.every((re) => re.test(t)) && !(m.not && m.not.test(t)))
  }
  r.anchors = all.some((t) => /(^|[^A-Za-z])L\d+([^0-9]|$)|\d\d:\d\d:\d\d/.test(t))
  r.missing = fx.must.filter((m) => !r.must[m.id]).map((m) => m.d)
  // Шапка входа (цель Шага 5) — не пункт раздела, проверяется по всему тексту.
  for (const [d, re] of fx.headerMust || []) if (!re.test(text)) r.missing.push(d)
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
  // Время — любое: `11:07:01`, VTT `00:00:54.600`, диапазон `… --> …`, в скобках `[00:00:54]` (проверка пробы CR).
  const re = /L(\d+)(?:[–-]L?(\d+))?[ \t]+(?:\[?[\d:.,]+\]?(?:[ \t]*-->[ \t]*[\d:.,]+)?[ \t]+)?(?:[^:«»\n]{1,60}:[ \t]*)?«([^»]+)»/g
  for (const m of text.matchAll(re)) {
    const n = Number(m[1])
    const end = m[2] ? Math.max(n, Number(m[2])) : n
    const win = tLines.slice(Math.max(0, n - 3), end + 2).join(' ')
    // Точка или запятая в конце обрезанного куска — не выдумка: сверяется текст без хвостовой пунктуации.
    // Порог 2 символа: короткое принятие «Да.», «Ок.» — законная цитата.
    const parts = m[3].split(/…|\.\.\./).map(norm).map((p) => p.replace(/[.,;:!?]+$/, '').trim()).filter((p) => p.length >= 2)
    // Цитата без букв и цифр («?», «…») — не выдумка (ревью 1.1.0): сырой текст есть в окне — цитата сошлась; нет —
    // это не цитата, в счёт не идёт.
    if (!parts.length) {
      if (norm(m[3]) && win.includes(norm(m[3]))) r.quotes++
      continue
    }
    r.quotes++
    if (parts.every((p) => near(win, p))) continue
    if (parts.every((p) => near(full, p))) r.moved.push(`L${n} «${m[3].slice(0, 40)}»`)
    else r.bad.push(`L${n} «${m[3].slice(0, 50)}»`)
  }
  r.lost = fx.razborMust.filter((m) => m.level !== 'warn' && !m.re.test(text)).map((m) => m.d)
  r.lostWarn = fx.razborMust.filter((m) => m.level === 'warn' && !m.re.test(text)).map((m) => m.d)
  // Раздел «Во вход» третьим уровнем под своим оглавлением, записи — отдельным разделом (meet-new r1 run-4):
  // содержание и разделы на месте — раскладка журнала, предупреждение. Красный — когда раздела нет вовсе.
  r.heading = /^#{2,3} Во вход /m.test(text)
  r.layout = /^## Во вход /m.test(text)
  r.minQuotes = fx.minQuotes || 10
  r.pass = r.quotes >= r.minQuotes && !r.bad.length && !r.lost.length && r.heading
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
  // Вход и разбор прошлой встречи из засева — не результат прогона.
  const inputs = files.filter((f) => want.test(f) && !(f in fx.seed))
  const razbors = files.filter((f) => razborRe.test(f) && !(f in fx.seed))
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
  // Дата в именах файлов, когда её нет в расшифровке, — из имени расшифровки (CR).
  r.dateOk = !fx.fileDate || (!!r.inputPath && r.inputPath.endsWith(`/meeting-${fx.fileDate}-${fx.kind}.md`) && !!r.razborPath && r.razborPath.endsWith(`/meeting-${fx.fileDate}.razbor.md`))
  r.pass = inputs.length === 1 && razbors.length === 1 && !r.extra.length && !r.touched.length && !r.forbiddenReads.length && r.input.pass && r.razbor.pass && r.dateOk
  return r
}

// ---------- список пунктов (meeting-intake 2.0.0, режим --points) ----------
//
// 2.0.0 пишет вместо входа список `meeting-<дата>.points.md` (reference/output.md). Ожидания входа переносятся на
// виды пунктов: «Решено» → `[решено]`, «Открыто» → `[открыто]`, «Сведения» → `[сведение]`, «Не входит» →
// `[решено] не входит:` (или `[открыто] не входит ли …` — так output.md велит писать вне рамок, когда вынесший не
// назван). Слоя больше нет — список держит и требования, и реализацию: запрет слоя (`impl`) снят, анкеры разбора
// «для спеки» стали пунктами списка (вид любой: без явного принятия решение идёт через вопрос Шага 5). Запреты на
// переигранное и не принятое остаются; отменённое, которое раньше ловил только запрет слоя, получило свой запрет.
// Цели в 2.0.0 нет — проверка цели в шапке (`headerMust`) снята; сравнения с документом нет — `altOther` снят.

// «Расходится с БТ» в ACC — два открытых вопроса к ИБ (эталон разбора): в списке это `[открыто]`.
const KIND_OF = { 'Решено': 'решено', 'Открыто': 'открыто', 'Сведения': 'сведение', 'Не входит': 'не входит', 'Расходится с БТ': 'открыто' }
const RE_NOT_IN = /^не\s+входит/i

// Настройки режима списка по фикстурам. `toList` — анкеры разбора, которые теперь должны стоять в списке (уровень
// анкера сохраняется: красный остаётся красным, предупреждение — предупреждением); `dropNot` — снятые запреты;
// `patch` — анкер с другими признаками; `must`/`mustNot`/`warn` — новые. OUT — фикстура только режима списка.
const PT = {
  VAC: {
    etalon: { points: 'fixtures/MEET-VAC/etalon-2/meeting-2026-10-07.points.md', razbor: 'fixtures/MEET-VAC/etalon-2/meeting-2026-10-07.razbor.md' },
    dropNot: ['impl'],
    toList: ['nowCheck', 'onLoad', 'daysStored'],
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    patch: { noise: { d: 'шум (ноут, винда, школа)', re: [/(^|[^а-яё])(ноут|школ|винд)/i] } },
    side: [
      // «тестовый стенд не работает» (r7 run-1) — тот же ИФТ; «на стенде скриптом» (L128) — проверка задачи, не побочное.
      { id: 'ift', d: 'стенд ИФТ (L184, L231)', re: /(^|[^а-яё])ифт|стенд\S*\s+(не\s+работ|лежит|недоступ)/i },
      { id: 'perDiem', d: 'баг с суточными (L19)', re: /суточн/i },
    ],
    mustNot: [
      // Не принято L139–L141 и переиграно L148: раньше их ловил запрет слоя («опрос», «фронт»).
      { id: 'poll', d: '«опрашивать раз в минуту» решением (не принято L139–L141)', sec: ['Решено'], re: [/раз в минуту|опраш|(^|[^а-яё])опрос/i], not: /(^|[^а-яё])(не|без)\s|вместо|а не|отклон|отверг/i },
      { id: 'frontCount', d: '«число дней считает фронт» решением (переиграно L148)', sec: ['Решено'], re: [/(фронт|экран)[^.;]{0,30}счита|счита\S*[^.;]{0,30}(фронт|экран)/i], not: /а не|не на|вместо|бэк/i },
      { id: 'asrPt', d: 'форма на слух («ютиси»)', sec: null, re: [/ютиси/i] },
    ],
    // Аудит круга 1 (2026-10-15): L174–L177 — следствие правила дня начала. Предупреждение, не красный: прозвучало
    // возражением Литвинова, подтверждено одним «Да», в итог L217–L227 не вошло, решения за ним нет.
    warn: [
      { id: 'firstDay', d: 'в первый день отказа заявка в портале остаётся «согласована» (L174–L177)', sec: null, re: [/согласован/i, /перв\S*\s+д(ень|ня)|день\s+начала|начал\S*\s+отпуск|не\s+пойд|не\s+выйд|отказ|откаж/i, /виси|висе|оста|в\s+портале|статус/i] },
    ],
  },
  ACC: {
    etalon: { points: 'fixtures/MEET-ACC/etalon-2/meeting-2026-10-09.points.md', razbor: 'fixtures/MEET-ACC/etalon-2/meeting-2026-10-09.razbor.md' },
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    patch: { noise: { d: 'шум (электричка, тоннель, ремонт)', re: [/ремонт|электричк|тоннел/i] } },
    side: [
      // «упала проверка в общей сборке» (r7 run-3) — пересказ L11–L12; слова «сборк» в расшифровке нет.
      { id: 'ci', d: 'красный пайплайн, линтер (L11–L12)', re: /гитлаб|линтер|пайплайн|сборк/i },
      { id: 'retro', d: 'перенос ретро (L188)', re: /(^|[^а-яё])ретро/i },
    ],
    // Аудит круга 1: «нам подписка не нужна» — «вычёркиваю» (L174–L175), в итогах дважды «шину не берём» (L205–L206).
    // extract.md: сказали, чего не делаем, — запись «вне рамок» → `[решено] не входит:` (или `[открыто] не входит ли`).
    must: [
      { id: 'busOut', d: '«шину не берём»: подписка на увольнения — не входит (L174–L175, L205–L206)', sec: ['Не входит'], re: [/(^|[^а-яё])шин|подпис|увольн/i] },
    ],
  },
  LONG: {
    etalon: { points: 'fixtures/MEET-LONG/etalon-2/meeting-2026-10-12.points.md', razbor: 'fixtures/MEET-LONG/etalon-2/meeting-2026-10-12.razbor.md' },
    toList: ['cache', 'tx'],
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    dropNot: ['impl', 'otherTopic'],
    patch: { noise: { d: 'шум (столовая)', re: [/(^|[^а-яё])столов/i] } },
    side: [
      { id: 'trips', d: 'отчёт по командировкам (L1–L165)', re: /CSV|бухгалтер|командиров/i },
      // «Кнопка справа» (L138–L142), «Тема формы текстом» (L542–L545) — та же форма обратной связи (r7 run-1).
      { id: 'feedback', d: 'форма обратной связи (L1–L165, L541–L546)', re: /обратн\S*\s+связ|капч|справа|тем\S*\s+форм/i },
      { id: 'cert', d: 'сертификат стенда', re: /сертификат/i },
      // «Следующая встреча по пропускам… четверг не подошёл из-за релиза» (r3 run-1) — основная тема, релиз мимоходом.
      { id: 'release', d: 'процесс релиза', re: /(^|[^а-яё])релиз/i, not: /пропуск/i },
      { id: 'ift', d: 'стенд ИФТ (L58–L59)', re: /(^|[^а-яё])ифт|стенд\S*\s+(не\s+работ|лежит|недоступ)/i },
      // Следующая встреча по этой задаче (L642): без пометки — не красный (r4), с пометкой — не ложная (r7 run-1).
      { id: 'nextMeet', either: true, d: 'следующая встреча (L642)', re: /следующ\S*\s+встреч/i },
      { id: 'search', d: 'поиск по справочнику, баг «Ёлкин» (L1–L165, L487)', re: /(^|[^а-яё])(поиск|ёлкин|елкин)/i },
      // «Следующая встреча по пропускам в пятницу в 11:00 (в 10:00 у Мельникова планёрка)» (r4 run-1) — встреча по
      // основной теме, планёрка мимоходом; как «…из-за релиза» у `release`.
      { id: 'plan', d: 'планёрка (L648)', re: /планёрк/i, not: /пропуск/i },
    ],
    mustNot: [
      // Не принято L311–L313; раньше ловил запрет слоя.
      { id: 'messenger', d: 'уведомление в мессенджер или ботом решением (не принято L311–L313)', sec: ['Решено'], re: [/мессенджер|(^|[^а-яё])бот(а|ом|у|е|ы)?([^а-яё]|$)/i], not: /(^|[^а-яё])(не|без|вне)([^а-яё]|$)|отклон|отверг/i },
    ],
  },
  NEW: {
    etalon: { points: 'fixtures/MEET-NEW/etalon-2/meeting-2026-10-08.points.md', razbor: 'fixtures/MEET-NEW/etalon-2/meeting-2026-10-08.razbor.md' },
    dropNot: ['impl'],
    toList: ['tpl'],
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    patch: { noise: { d: 'шум (собака, кофемашина)', re: [/собак|кофемашин/i] } },
    side: [
      { id: 'demo', d: 'перенос демо (L116)', re: /(^|[^а-яё])демо/i },
    ],
    must: [
      // Анкер разбора `zup` искал слова цитат («должность и дата приёма у нас в зупе»); в пункте — пересказ.
      // «…уже есть в системе, из которой предлагают их брать» (r1 run-2) — факт на месте: «зуп» без опоры словами
      // «кадровая» назвать не обязательно, предмет держит первый признак.
      { id: 'zup', d: 'данные о сотруднике (должность, дата приёма) — в кадровой системе', sec: null, re: [/должност|дат\S*\s+при[её]м|данн\S*\s+(о\s+)?сотрудник/i, /кадров|зуп|систем/i] },
      // Аудит круга 1: L85–L86 «На почту дублировать?» — «Нет, только на портале. Почту мы не трогаем.» — прямой ответ.
      // В пункте об уведомлении «только на портале» или отдельным «не входит» (extract.md: сказали, чего не делаем).
      // «не входит: бывшие сотрудники — пишут на почту» — не про канал уведомлений (проверка на прогонах круга 1).
      { id: 'mailOut', d: '«только на портале, почту не трогаем» (L85–L86)', sec: ['Не входит'], re: [/почт/i, /уведомл|оповещ|дублир|не\s+трога/i], alt: [{ sec: ['Решено'], re: [/уведомл/i, /только\s+(на\s+)?портал|не\s+дублир|без\s+(дублир\S*\s+)?(на\s+)?почт|почт\S*[^.;]{0,30}не\s+(трога|дублир|шл|отправл)|не\s+(на\s+)?почт/i] }] },
    ],
    dropRazbor: ['zup'],
    mustNot: [
      // «Зуп» — форма на слух (expected.md); раньше его ловил запрет слоя.
      { id: 'asrPt', d: 'форма на слух («зуп»)', sec: null, re: [/(^|[^а-яё])зуп/i] },
    ],
  },
  REW: {
    etalon: { points: 'fixtures/MEET-REW/etalon-2/meeting-2026-10-14.points.md', razbor: 'fixtures/MEET-REW/etalon-2/meeting-2026-10-14.razbor.md' },
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    // Шума без сведений в REW нет: переезд, этаж, принтер — сведения об офисе (L7–L8), демо — расписание (L70).
    dropNot: ['noise'],
    side: [
      { id: 'move', d: 'переезд на шестой этаж, принтер (L7–L8)', re: /переезд|(^|[^а-яё])этаж|принтер/i },
      { id: 'demo', d: 'демо в четыре (L70)', re: /(^|[^а-яё])демо/i },
    ],
  },
  CHG: {
    etalon: { points: 'fixtures/MEET-CHG/etalon-2/meeting-2026-10-15.points.md', razbor: 'fixtures/MEET-CHG/etalon-2/meeting-2026-10-15.razbor.md' },
    // Побочные темы (решение 2026-10-15: что относится к теме, решает человек на сводке Шага 6): пункт такой темы
    // в списке — красный, только если его нет в строке «Похоже, не про …» ответов. Шум без решений и сведений — красный.
    dropNot: ['impl', 'otherTopic'],
    side: [
      { id: 'trips', d: 'суточные в командировках, EMP-1190 (L39–L46, L50–L52)', re: /суточн|командиров|бухгалтер/i },
    ],
    toList: ['cleanup'],
  },
  CR: {
    etalon: { points: 'fixtures/MEET-CR/etalon-2/meeting-2026-10-16.points.md', razbor: 'fixtures/MEET-CR/etalon-2/meeting-2026-10-16.razbor.md' },
    dropNot: ['impl'],
    toList: ['calendar'],
    // L70 «кнопка «Переоткрыть» в мобильной версии не нажимается» — чужая ошибка, «не в эту задачу» (expected.md).
    side: [
      { id: 'reopen', d: 'ошибка кнопки «Переоткрыть» (L70)', re: /переоткр|кнопк|ошибк/i }, // «Ильин заведёт эту ошибку отдельно» — r9 run-3
    ],
    // «Как сейчас → как должно стать» было правилом цели «правка работающего» (output.md 1.x); в 2.0.0 «как сейчас» —
    // своё `[сведение]`, поэтому три календарных дня ждём в любом пункте, семь рабочих — в `[решено]`.
    patch: { sevenDays: { d: 'автозакрытие — семь рабочих дней', re: [/(7|сем\S*)\s+рабоч/i] } },
    must: [
      { id: 'nowThree', d: 'как сейчас — три календарных дня', sec: null, re: [/(3|тр[её]х|три)\s+календарн/i] },
    ],
  },
  // Созвон-расспрос без решений: fixtures/MEET-OUT/expected.md (перенос MI-NB-OUT на 2.0.0).
  OUT: {
    key: null,
    folder: 'docs/_inbox',
    transcript: 'fixtures/MEET-OUT/seed/calls/2026-10-10-pvz-kak-seychas.txt',
    seed: { 'calls/2026-10-10-pvz-kak-seychas.txt': 'fixtures/MEET-OUT/seed/calls/2026-10-10-pvz-kak-seychas.txt' },
    etalon: { points: 'fixtures/MEET-OUT/etalon-2/meeting-2026-10-10.points.md', razbor: 'fixtures/MEET-OUT/etalon-2/meeting-2026-10-10.razbor.md' },
    minQuotes: 5,
    keyAsk: true,
    bareRed: true,
    stopCheck: true,
    must: [],
    count: [
      { d: '[сведение] … — со слов <кто>', min: 3, test: (it) => it.kind === 'сведение' && /[—–-]\s*со\s+слов\s+\S/i.test(it.t) },
      { d: '[открыто] … — ждёт: <названный человек или служба>', min: 1, test: (it) => it.kind === 'открыто' && /жд[её]т:\s*[^\s—–-]/i.test(it.t) },
    ],
    mustNot: [
      { id: 'decided', d: '[решено] в списке (решений на встрече нет)', sec: ['[решено]'], re: [/[\s\S]/] },
    ],
    warn: [
      { id: 'place', d: 'открытый вопрос про место под посылки', sec: ['Открыто'], re: [/мест/i, /посыл/i] },
      { id: 'sticker', d: 'открытый вопрос про наклейку крупнее', sec: ['Открыто'], re: [/наклейк/i, /крупн|больш|коробк/i] },
    ],
    // Полнота сведений (аудит круга 1: r1 meet-out run-1 выкинул L7–L16 и L50–L64, из 16 сведений осталось 8, оценщик
    // был зелёным). Перечень выведен из расшифровки до правки оценщика — 17 фактов расспроса «как сейчас»; пункт любого
    // вида, числа — цифрами или словами. Порог — 14 из 17 (80%): пункт может слить два факта или опустить мелочь, а
    // потеря целого куска созвона — это 5+ фактов. Критичные — красный и при пороге: на них держится вопрос созвона
    // (как принимать посылки на точке): люди, часы работы, пик, объём возвратов, лента принтера (L38 набрана в чате;
    // от неё зависит открытый вопрос о наклейке), место, передача водителю.
    factsMin: 14,
    facts: [
      { id: 'staff', critical: true, d: 'в смене один оператор, в пятницу и выходные двое (L8)', re: [/оператор/i, /пятниц|выходн/i] },
      { id: 'hours', critical: true, d: 'смена 12 часов, с 9 до 21 (L10)', re: [/(^|\D)12\s*час|двенадцат\S*\s+час|(^|\D)9\s*(:00)?\s*(до|[–—-])\s*21|девят\S*\s+до\s+(девят|21)/i] },
      { id: 'noDayOff', d: 'без выходных, закрыты только 1 января (L12)', re: [/без\s+выходн|1\s+января|перв\S*\s+января|ежедневн|каждый\s+день/i] },
      { id: 'peak', critical: true, d: 'пик вечером 18–21, очередь до 10, обычно 3–4 (L14, L16)', re: [/очеред|(^|[^а-яё])пик|загружен|наплыв/i, /вечер|(^|\D)18|шест\S*\s+до/i] },
      { id: 'checks', d: 'что проверяют при приёме: код, товар целый, бирки (L20–L22)', re: [/бирк|ношен|товар\S*[^.;]{0,40}(цел|осмотр|провер|смотр)|(осматрив|осмотр|провер|смотр)\S*[^.;]{0,30}товар/i] },
      { id: 'duration', d: 'приём возврата в среднем 3–5 минут (L24–L26)', re: [/минут/i, /(^|\D)[35](\D|$)|тр(и|ёх|ех)|пят/i] },
      { id: 'volume', critical: true, d: '20–30 возвратов в день на точку (L28–L29)', re: [/(^|\D)20\s*[–—-]\s*30|двадцат\S*\s*[–—-]?\s*тридцат/i] },
      { id: 'scanner', d: 'сканируют планшетом с камерой, ручной сканер — для выдачи (L31)', re: [/планшет|камер/i] },
      { id: 'noCode', d: 'без кода возврат не принимают (L33)', re: [/без\s+кода|код\S*[^.;]{0,40}не\s+приним|не\s+приним\S*[^.;]{0,40}без\s+код/i] },
      { id: 'tape', critical: true, d: 'термопринтер, лента 58 мм (L35–L39)', re: [/(^|\D)58(\D|$)|пятьдесят\s+восем/i] },
      { id: 'shelf', critical: true, d: 'стеллаж под возвраты в подсобке, наполовину пуст (L43–L44)', re: [/стеллаж|подсобк/i] },
      { id: 'seal', critical: true, d: 'мешок пломбируют, акт водителю, два экземпляра, месяц (L51–L52)', re: [/пломб|(^|[^а-яё])акт(а|е|ом|ы)?([^а-яё]|$)/i] },
      { id: 'noDriver', d: 'водитель не приезжает 1–2 раза в месяц, мешок лежит до следующего дня (L54–L55)', re: [/не\s+приезжа|не\s+при(ехал|едет)|раз\S*\s+в\s+месяц|до\s+следующего\s+дня/i] },
      { id: 'sortCenter', d: 'мешок — на региональный сортировочный центр, сортируют ночью (L57)', re: [/сортировоч|сортиру/i] },
      { id: 'delivery', d: 'по городу — на следующий день, межгород 2–4 дня, Дальний Восток до 10 (L59–L60)', re: [/межгород|дальн\S*\s+восток|по\s+городу/i] },
      { id: 'seller', d: 'возвраты едут на склад продавца (L62)', re: [/продавц/i] },
      { id: 'training', d: 'обучение: курс около часа, неделя со старшим (L64)', re: [/курс|обуч|новичок|новеньк|со\s+старш/i] },
    ],
    razborMust: [],
    // L61–L62 «Это по заказам, да? Не по возвратам.» — «По заказам.»: пометка сроков доставки — законна (r7 run-3).
    side: [
      { id: 'delivery', either: true, d: 'сроки доставки заказов (L59–L62)', re: /доставк|по\s+заказам/i }, // «Это сроки по заказам, не по возвратам» — r8 run-1
    ],
  },
}

// Вопрос о выборе темы (Шаг 2 после круга 1: «тему не спрашиваешь», созвон — одна тема). Красный во всех пробах.
// Формы из ответов круга 1: «Какую тему берём?», «На встрече две темы. Какую разбираем?», «Разбираем тему 1?»,
// «Выберите, какую из них разбирать», «…со всеми тремя темами вместе, одним списком?» + варианты «Только тема 2».
// Не вопрос темы: «Тема одна…», «…в выбор не идёт», «Как назвать тему записи?», «какая тема стояла в приглашении?».
const RE_THEME_WORD = /(^|[^а-яё])(тем(а|у|ы|е|ой|ам|ами|ах)|предмет\S*)([^а-яё]|$)/i
const RE_THEME_CHOICE = /(^|[^а-яё])(как|котор)(ую|ой|ие|их|ых|ые)\s+(из\s+(них|тем)|(\S+\s+)?(тем|предмет))|тем(у|ы)\s+\d|(^|[^а-яё])(все|всеми|обе|обеими|тремя|двумя|одну|только|вместе)([^а-яё]|$)|разбира|бер[её]м|возьм|выбира/i
// Без слова между: «Какую цель берём?» (вопрос цели 1.x) — не тема; проверено на 1078 ответах 1.x.
const RE_WHICH_BARE = /^[\s*_]*(как|котор)(ую|ой)\s+(разбира|бер|возьм|выбира)|(как|котор)(ую|ой)\s+из\s+них/i
// «Какую из тем …?» — «тем» без окончания (родительный падеж), признак слова RE_THEME_WORD его не берёт.
const RE_WHICH_OF_THEMES = /(как|котор)(ую|ой|ие|их)\s+из\s+тем([^а-яё]|$)/i
const RE_THEME_PICK = /выбер(и|ите)[^.!?\n]{0,40}(тем(а|у|ы)|предмет|какую|котор)|выбрать\s+нужно\s+одну|выбор\s+(\S+\s+)?тем/i
const RE_THEME_OPTION = /^\s*([-*•]|\d+[.)])\s*(\*\*)?\s*(только\s+)?тем(а|у)\s+\d/im
// Сводка Шага 6: «Похоже, не про <главная тема> (K): 1. <суть> (<предмет побочной темы>) …» и варианты «Записать N
// пунктов», «Записать без этих K», «Поправить». Блок — строка «Похоже, не про» и следующие строки до вариантов,
// заголовка или абзаца не-списка. Возвращает номера строк блока.
const RE_SIDE_HEAD = /Похоже,?\s+не\s+про/i
const RE_SIDE_STOP = /^\s*(\d+[.)]\s*)?[*_]*\s*(Вариант|Что делаем|Записать\s+(\d|все|без)|Поправить|Сначала разобрать|«Записать)/i
const RE_LIST_LINE = /^\s*(\d+[.)]|[-*•])\s/
function sideBlockLines (lines) {
  const out = new Set()
  for (let i = 0; i < lines.length; i++) {
    if (!RE_SIDE_HEAD.test(lines[i])) continue
    out.add(i)
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]
      if (RE_SIDE_STOP.test(l) || RE_SIDE_HEAD.test(l) || /^\s*(#{1,6}\s|\*\*[^*\n]+\*\*\s*$)/.test(l)) break
      if (!l.trim()) {
        const next = lines.slice(j + 1).find((x) => x.trim())
        if (next && RE_LIST_LINE.test(next) && !RE_SIDE_STOP.test(next)) continue
        break
      }
      out.add(j)
    }
  }
  return out
}
// Текст блоков «Похоже, не про …» всех ходов: что скилл показал человеку как побочное.
export function sideShown (text) {
  const lines = lf(text).split('\n')
  return [...sideBlockLines(lines)].sort((a, b) => a - b).map((i) => lines[i]).join('\n')
}
// Раздел «Не вносим» разбора: туда уходят побочные, которые человек не взял.
const notInSection = (razbor) => ((razbor || '').split(/^## «?Не вносим»?[^\n]*$/m)[1] || '').split(/^## /m)[0]

// Побочные темы: пункт в списке без показа в «Похоже, не про …» — красный (агент сам решил, что это про тему);
// показан — решил человек, зелёный в обе стороны; показан, но нет ни в списке, ни в «Не вносим» — предупреждение.
export function sideCheck (items, fx, shown, razbor) {
  const r = { red: [], warn: [], shown: [], falseMark: [] }
  const notIn = notInSection(razbor)
  const isSide = (t) => (fx.side || []).some((s) => s.re.test(t))
  for (const s of fx.side || []) {
    // «не входит: <чужое>» — граница этой задачи, пометка не обязательна (r6 meet-cr: «ошибку с кнопкой ведут отдельно»).
    const inList = items.filter((it) => s.re.test(it.t) && !(s.not && s.not.test(it.t)) && !/^\s*не\s+входит/i.test(it.t))
    const isShown = !!shown && s.re.test(shown)
    if (isShown) r.shown.push(s.id)
    if (inList.length && !isShown && !s.either) r.red.push(`${s.d} — в списке без строки «Похоже, не про …»: «${inList[0].t.slice(0, 60)}»`)
    if (isShown && !inList.length && !s.re.test(notIn)) r.warn.push(`${s.d} — показана в «Похоже, не про …», но нет ни в списке, ни в «Не вносим»`)
  }
  // Ложная пометка (круг 6: «число дней», «место под посылки» в «не про тему»): пункт строки «Похоже, не про …»,
  // не похожий ни на одну побочную тему и не шум, — пункт самой задачи; «Записать без этих K» его потеряет.
  const noise = (fx.mustNot || []).filter((m) => m.id === 'noise').flatMap((m) => m.re)
  const shownItems = new Set(lf(shown || '').split(/\n\s*[-*•]\s+|(?:^|[\s;:])\d+[.)]\s+/).slice(1).map((x) => x.trim()).filter(Boolean))
  for (const t of shownItems) if (!isSide(t) && !noise.some((re) => re.test(t))) r.falseMark.push(t.slice(0, 60))
  return r
}

export function themeQuestion (text0) {
  // Строка «Похоже, не про …» и вариант «Записать без этих K» — вопрос о побочных пунктах, не выбор темы.
  const lines0 = lf(text0).split('\n')
  const block = sideBlockLines(lines0)
  const text = lines0.filter((l, i) => !block.has(i) && !/без\s+эт(их|ого|ой)/i.test(l)).join('\n')
  const qs = text.match(/[^.!?\n]*\?/g) || []
  const hasTheme = RE_THEME_WORD.test(text)
  const q = qs.find((s) => (RE_THEME_WORD.test(s) && RE_THEME_CHOICE.test(s)) || RE_WHICH_OF_THEMES.test(s) || (hasTheme && RE_WHICH_BARE.test(s)))
  if (q) return q.trim()
  const m = text.match(RE_THEME_PICK) || text.match(RE_THEME_OPTION)
  return m ? m[0].trim() : null
}

// Фикстура режима списка: настройки PT поверх FX.
export function ptFx (name) {
  const p = PT[name]
  if (!p) return null
  const b = FX[name] || {}
  const patch = (m) => ({ ...m, ...((p.patch || {})[m.id] || {}) })
  const toList = (b.razborMust || []).filter((m) => (p.toList || []).includes(m.id))
  return {
    name,
    key: 'key' in p ? p.key : b.key,
    folder: p.folder || b.folder,
    transcript: p.transcript || b.transcript,
    seed: p.seed || b.seed,
    fileDate: p.fileDate || b.fileDate,
    minQuotes: p.minQuotes || b.minQuotes,
    etalon: p.etalon,
    must: [...(b.must || []).map(patch), ...toList.filter((m) => m.level !== 'warn').map((m) => ({ id: m.id, d: m.d, sec: null, re: [m.re] })), ...(p.must || [])],
    mustNot: [...(b.mustNot || []).filter((m) => !(p.dropNot || []).includes(m.id)).map(patch), ...(p.mustNot || [])],
    warn: [...toList.filter((m) => m.level === 'warn').map((m) => ({ id: m.id, d: m.d, sec: null, re: [m.re] })), ...(p.warn || [])],
    count: p.count || [],
    facts: p.facts || [],
    factsMin: p.factsMin || 0,
    razborMust: p.razborMust || (b.razborMust || []).filter((m) => !(p.toList || []).includes(m.id) && !(p.dropRazbor || []).includes(m.id)),
    keyAsk: !!p.keyAsk,
    bareRed: !!p.bareRed,
    stopCheck: !!p.stopCheck,
    side: p.side || [],
  }
}

// Пункт — строка `- [вид] <текст> · L<n>`. Строка-пункт другой формы (без хвоста, с другим маркером) — в `bad`.
const RE_ITEM_START = /^\s*([-*•]|\d+[.)])\s/
// Диапазон или список строк и точка после `L<n>` — пункт читается, но хвост не по форме: предупреждение.
const RE_ITEM = /^- \[([^\]\n]+)\]\s+(.+?)\s*·\s*L(\d+)((?:\s*[–,-]\s*L?\d+)*)\s*([.;]?)\s*$/
const KINDS3 = ['решено', 'открыто', 'сведение']

export function parsePoints (text) {
  const lines = lf(text).replace(/^\uFEFF/, '').split('\n')
  const r = { title: lines[0] || '', head: [], items: [], bad: [], other: [] }
  let seenItem = false
  lines.forEach((l, i) => {
    if (i === 0 || !l.trim()) return
    if (RE_ITEM_START.test(l)) {
      seenItem = true
      const m = l.match(RE_ITEM)
      if (m) r.items.push({ kind: m[1].trim().toLowerCase(), t: m[2], L: Number(m[3]), extraL: !!m[4] || !!m[5], raw: l })
      else r.bad.push(l)
      return
    }
    if (/^>/.test(l) && !seenItem) r.head.push(l)
    else r.other.push(l)
  })
  return r
}

// `sec` — разделы входа (через KIND_OF) или вид пункта как есть в скобках: `[решено]` — любой `[решено]`, и «не входит» тоже.
const kindIs = (it, k) => {
  if (/^\[.+\]$/.test(k)) return it.kind === k.slice(1, -1)
  if (k === 'решено') return it.kind === 'решено' && !RE_NOT_IN.test(it.t)
  if (k === 'не входит') return (it.kind === 'решено' && RE_NOT_IN.test(it.t)) || (it.kind === 'открыто' && /^не\s+входит\s+ли/i.test(it.t))
  return it.kind === k
}
const poolOf = (items, secs) => (secs ? items.filter((it) => secs.some((s) => kindIs(it, KIND_OF[s] || s))) : items)

// Латиница и коды — только с опорой (правило 5 скилла): токен с цифрой, `_ . / :`, дефисом или camelCase — код;
// его нет в расшифровке, документах задачи из засева и ключе — красный. Простое латинское слово без опоры
// («PDF», «ID») — предупреждение: жаргон понятен принимающему скиллу (решение 2026-10-13 в MEET-ACC/expected.md).
const RE_LAT_TOKEN = /[A-Za-z0-9][A-Za-z0-9_./:-]*[A-Za-z0-9]|[A-Za-z]/g
const isCode = (tok) => /[0-9_./:]/.test(tok) || /[a-z][A-Z]/.test(tok) || /[A-Za-z]-[A-Za-z0-9]/.test(tok)
// Токен в опоре — целым словом: «FR-1» не опирается на «FR-10». Поиск по строке, без сборки регулярки из токена.
function hasToken (corpusLower, tok) {
  const t = tok.toLowerCase()
  for (let i = corpusLower.indexOf(t); i >= 0; i = corpusLower.indexOf(t, i + 1)) {
    const before = i ? corpusLower[i - 1] : ''
    const after = corpusLower[i + t.length] || ''
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true
  }
  return false
}
// Утверждение о несказанном (output.md: «месяц не назвали», «сроков не обсуждали» — в списке нет) — ПРЕДУПРЕЖДЕНИЕ.
// Оценщик 1.x это правило не мерил; на 268 входах прошлых прогонов оно сработало бы в 11 пунктах из 4488, и красный
// перекрасил бы круги, зелёные по прежней мерке (строгость пробы ≠ дефект скилла). Поле `ждёт: [ответственный]
// не назван` — то же, что `ждёт: —`, не утверждение о встрече (без этого исключения срабатываний было 28).
// Только прошедшее время и краткие причастия: «статус не называть «Отказ»» — не о встрече.
const RE_UNSAID = /(^|[^а-яё])(не|ни)\s+(был[оаи]?\s+)?(назвал|назван|обсуждал|обсудил|оговорил|оговаривал|прозвучал|упоминал|упомянул|озвучил|озвучен|говорил|сказал)/i
const RE_ANCHOR_TEXT = /(^|[^A-Za-z])L\d+([^0-9]|$)|\d\d:\d\d:\d\d/
const RE_LINK = /(^|[^а-яё])вместо:|отвечает\s+на:/i
const RE_DECIDER = /[—–-]\s*реш(ил|ила|или):\s*[^\s—–-]/i

// ctx: { tRaw — строки расшифровки как есть, corpus — опора для латиницы в нижнем регистре, quoteLines — номера
// строк цитат разбора (Set) или null }.
export function gradePoints (text, fx, ctx) {
  const p = parsePoints(text)
  const r = { items: p.items, form: [], warn: [], must: {}, mustNot: {}, missing: [], violations: [] }
  const short = (s) => `«${s.slice(0, 60)}»`
  if (!/^# Пункты:\s*\S/.test(p.title)) r.form.push('первая строка не «# Пункты: …»')
  for (const h of ['Источник', 'Задача', 'Встреча']) if (!p.head.some((l) => l.startsWith(`> ${h}:`))) r.form.push(`в шапке нет «> ${h}:»`)
  if (!p.items.length) r.form.push('пунктов «- [вид] … · L<n>» нет')
  if (p.bad.length) r.form.push(`пункт не по форме «- [вид] … · L<n>» (${p.bad.length}): ${short(p.bad[0])}`)
  if (p.other.length) r.warn.push(`строки вне формы списка (${p.other.length}): ${short(p.other[0])}`)
  const zadacha = p.head.find((l) => l.startsWith('> Задача:'))
  if (zadacha && !zadacha.includes(fx.key || '—')) r.warn.push(`в шапке ${short(zadacha)}, ждали ${fx.key || '—'}`)
  for (const it of p.items) {
    if (!KINDS3.includes(it.kind)) r.form.push(`вид не из трёх (решено, открыто, сведение): ${short(it.raw)}`)
    if (it.kind === 'решено' && !RE_DECIDER.test(it.t)) r.form.push(`у [решено] нет «— решил: <кто>»: ${short(it.raw)}`)
    const line = ctx.tRaw[it.L - 1]
    if (it.L < 1 || line === undefined || !line.trim()) r.form.push(`ссылка на несуществующую строку расшифровки L${it.L}`)
    else if (ctx.quoteLines && !ctx.quoteLines.has(it.L)) r.warn.push(`L${it.L} — не строка цитат разбора`)
    if (it.extraL) r.warn.push(`хвост пункта не «· L<n>»: ${short(it.raw.slice(-30))}`)
    if (RE_ANCHOR_TEXT.test(it.t)) r.form.push(`номер строки или время в тексте пункта: ${short(it.raw)}`)
    if (RE_LINK.test(it.t)) r.form.push(`«вместо:» или «отвечает на:» в пункте: ${short(it.raw)}`)
    if (RE_UNSAID.test(it.t.replace(/жд[её]т:[^;.()]*?не\s+назван\S*/gi, 'ждёт: —'))) r.warn.push(`утверждение о несказанном: ${short(it.raw)}`)
    if (it.kind === 'открыто' && !/жд[её]т:/i.test(it.t)) r.warn.push(`у [открыто] нет «ждёт:»: ${short(it.raw)}`)
    if (it.kind === 'сведение' && !/со\s+слов/i.test(it.t)) r.warn.push(`у [сведение] нет «со слов»: ${short(it.raw)}`)
    // `L<n>` в тексте — якорь, его ловит своя проверка выше.
    for (const tok of new Set((it.t.match(RE_LAT_TOKEN) || []).filter((x) => /[A-Za-z]/.test(x) && !/^L\d+$/.test(x)))) {
      if (hasToken(ctx.corpus, tok)) continue
      if (isCode(tok)) r.form.push(`код без опоры (нет в расшифровке и документах задачи): ${tok}`)
      else r.warn.push(`латиница без опоры: ${tok}`)
    }
  }
  const hit = (c) => poolOf(p.items, c.sec).some((it) => c.re.every((re) => re.test(it.t)))
  for (const m of fx.must) r.must[m.id] = hit(m) || (m.alt || []).some(hit)
  for (const m of fx.mustNot) r.mustNot[m.id] = poolOf(p.items, m.sec).some((it) => m.re.every((re) => re.test(it.t)) && !(m.not && m.not.test(it.t)))
  r.missing = fx.must.filter((m) => !r.must[m.id]).map((m) => m.d)
  for (const c of fx.count) { const n = p.items.filter(c.test).length; if (n < c.min) r.missing.push(`${c.d}: ${n}, нужно ≥${c.min}`) }
  r.violations = fx.mustNot.filter((m) => r.mustNot[m.id]).map((m) => m.d)
  for (const m of fx.warn) if (!hit(m)) r.warn.push('в списке нет: ' + m.d)
  // Полнота сведений: факт покрыт, если хоть один пункт (любого вида) несёт все его признаки.
  r.facts = { covered: [], lost: [] }
  for (const f of fx.facts) (p.items.some((it) => f.re.every((re) => re.test(it.t))) ? r.facts.covered : r.facts.lost).push(f)
  if (fx.facts.length) {
    const crit = r.facts.lost.filter((f) => f.critical)
    if (crit.length) r.missing.push('критичные сведения: ' + crit.map((f) => f.d).join('; '))
    if (r.facts.covered.length < fx.factsMin) r.missing.push(`сведений расшифровки в списке ${r.facts.covered.length} из ${fx.facts.length}, нужно ≥${fx.factsMin}`)
    const minor = r.facts.lost.filter((f) => !f.critical)
    if (minor.length) r.warn.push('нет сведений: ' + minor.map((f) => f.d).join('; '))
  }
  r.pass = !r.form.length && !r.missing.length && !r.violations.length
  return r
}

// Строки `цитаты:` с номерами строк, но без текста в «…» (Шаг 7: номер без текста — Read и текст дословно).
const bareQuoteLines = (text) => text.split('\n').filter((l) => /^\s*цитаты:/.test(l) && /L\d+/.test(l) && !/«[^»]+»/.test(l))

export function gradeRazborPt (text, fx, tLines, nItems) {
  const r = gradeRazbor(text, fx, tLines)
  // Список у разбора один: имя файла в заголовке раздела не обязательно (пилот 2026-10-15: «## В список» без имени).
  r.heading = /^#{2,3} В список(\s|$)/m.test(text)
  r.layout = /^## В список(\s|$)/m.test(text)
  const marks = new Set([...text.matchAll(/в\s+список:\s*п\.\s*(\d+)/g)].map((m) => Number(m[1])))
  r.unmarked = []
  for (let i = 1; i <= nItems; i++) if (!marks.has(i)) r.unmarked.push(i)
  r.strayMarks = [...marks].filter((n) => n < 1 || n > nItems)
  r.bare = bareQuoteLines(text)
  // Номера строк цитат записей — с ними сверяется `L<n>` пункта (output.md: первая строка цитат записи).
  r.quoteLines = new Set()
  for (const l of text.split('\n')) if (/^\s*цитаты:/.test(l)) for (const m of l.matchAll(/(^|[^A-Za-z])L(\d+)/g)) r.quoteLines.add(Number(m[2]))
  r.pass = r.quotes >= r.minQuotes && !r.bad.length && !r.lost.length && r.heading && !(fx.bareRed && r.bare.length)
  return r
}

// Ходы прогона: `answer-NN.md`; ходов нет — `answer.md`.
function turnsOf (dir) {
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).sort() : []
  if (names.length) return names.map((f) => ({ n: Number(f.match(/\d+/)[0]), text: read(join(dir, f)) }))
  return existsSync(join(dir, 'answer.md')) ? [{ n: 1, text: read(join(dir, 'answer.md')) }] : []
}

// Писал ли ход список: Write/Edit по пути `*.points.md` в потоке хода. Потока хода нет — `null`.
function wroteList (dir, n) {
  const names = (n === 1 ? ['stream.jsonl', 'stream-01.jsonl'] : [`stream-${String(n).padStart(2, '0')}.jsonl`]).filter((f) => existsSync(join(dir, f)))
  if (!names.length) return null
  for (const f of names) {
    for (const line of read(join(dir, f)).split('\n')) {
      let e; try { e = JSON.parse(line) } catch { continue }
      const content = e && e.message && Array.isArray(e.message.content) ? e.message.content : []
      for (const c of content) {
        if (!c || c.type !== 'tool_use' || !c.input) continue
        if (['Write', 'Edit', 'MultiEdit'].includes(c.name) && /\.points\.md$/.test(String(c.input.file_path || ''))) return true
        if (c.name === 'Bash' && /\.points\.md/.test(String(c.input.command || '')) && /(>>|>\s*\S*\.points\.md|tee\s)/.test(String(c.input.command || ''))) return true
      }
    }
  }
  return false
}

// Вопрос о ключе (из grade-minb.mjs, MI-NB-OUT): Шаг 2 2.0.0 — «ключ не нашёлся — `—`, не спрашиваешь».
const RE_KEY_ASK = /ключ\S*\s+задач\S*\s*\?|как(ой|ов)\s+(у\s+(неё|задачи)\s+)?ключ|если\s+(его\s+)?(ещё\s+)?нет\s*[—–-]+\s*так\s+и\s+напишите|назов\S*\s+ключ|укаж\S*\s+ключ/i
// Ход-стоп: хвост ответа — «решений нет» или стоп Шага 2 «нет ни решений, ни сведений», вопроса нет, список в ходе не
// писан. Со сведениями это ошибка; реплика стенда доводит диалог до записи и прячет стоп (MI-NB-OUT, ревью 1.1.0).
const RE_STOP_TAIL = /нет\s+ни\s+решений|решени\S*[^.!?\n]{0,30}?\s(нет|не\s+было)([^а-яё]|$)/i
const RE_ASKS = /\?|вариант\S*\s*:|ответьте|выберите/i

function stopTurns (dir) {
  const turns = turnsOf(dir)
  const last = turns.length ? turns[turns.length - 1].n : 0
  return turns.filter((t) => {
    if (!RE_STOP_TAIL.test(t.text.trim().slice(-200)) || RE_ASKS.test(t.text)) return false
    const wrote = wroteList(dir, t.n)
    return wrote === null ? t.n !== last : !wrote
  }).map((t) => t.n)
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

function ptCtx (fx) {
  const raw = readFileSync(join(HERE, fx.transcript), 'utf8')
  const docs = Object.entries(fx.seed).filter(([rel]) => rel.startsWith('docs/')).map(([, src]) => read(join(HERE, src)))
  return {
    tRaw: lf(raw).replace(/^\uFEFF/, '').split('\n'),
    tLines: transcriptTexts(raw),
    corpus: [lf(raw), ...docs, fx.key || ''].join('\n').toLowerCase(),
  }
}

export function gradeRunPt (dir, fx) {
  const r = {}
  const seeded = existsSync(join(dir, '_seeded.txt')) ? new Set(read(join(dir, '_seeded.txt')).split('\n').filter(Boolean)) : new Set()
  const files = listFiles(dir)
  const where = fx.key ? `^docs/(.+/)?${esc(fx.key)}/` : `^${esc(fx.folder)}/`
  const listRe = new RegExp(where + 'meeting-[^/]+\\.points\\.md$')
  const razborRe = new RegExp(where + 'meeting-[^/]+\\.razbor\\.md$')
  const lists = files.filter((f) => listRe.test(f) && !(f in fx.seed))
  const razbors = files.filter((f) => razborRe.test(f) && !(f in fx.seed))
  r.extra = files.filter((f) => !lists.includes(f) && !razbors.includes(f) && !seeded.has(f) && !(f in fx.seed) && !(!f.includes('/') && STAND.test(f)))
  r.touched = Object.entries(fx.seed).filter(([rel, src]) => !existsSync(join(dir, rel)) || read(join(dir, rel)) !== read(join(HERE, src))).map(([rel]) => rel)
  r.listPath = lists[0] || null
  r.razborPath = razbors[0] || null
  const ctx = ptCtx(fx)
  const listText = lists.length === 1 ? read(join(dir, lists[0])) : null
  r.razbor = razbors.length === 1 ? gradeRazborPt(read(join(dir, razbors[0])), fx, ctx.tLines, listText ? parsePoints(listText).items.length : 0) : null
  r.list = listText !== null ? gradePoints(listText, fx, { ...ctx, quoteLines: r.razbor ? r.razbor.quoteLines : null }) : null
  const uses = toolUses(dir)
  r.forbiddenReads = uses.filter((u) => ['Read', 'Grep', 'Glob', 'Bash'].includes(u.name) && RE_FORBIDDEN_READ.test(Object.values(u.input).filter((v) => typeof v === 'string').join(' ').replace(RE_EXCLUDE_ARG, '')))
    .map((u) => `${u.sub ? 'субагент' : 'ведущий'} ${u.name} ${JSON.stringify(u.input).slice(0, 90)}`)
  r.agents = uses.filter((u) => !u.sub && (u.name === 'Agent' || u.name === 'Task')).length
  r.dateOk = !fx.fileDate || (!!r.listPath && r.listPath.endsWith(`/meeting-${fx.fileDate}.points.md`) && !!r.razborPath && r.razborPath.endsWith(`/meeting-${fx.fileDate}.razbor.md`))
  r.sameBase = !r.listPath || !r.razborPath || r.listPath.replace(/\.points\.md$/, '') === r.razborPath.replace(/\.razbor\.md$/, '')
  const turns = turnsOf(dir)
  const dialog = turns.map((t) => t.text).join('\n')
  r.keyAsked = fx.keyAsk && RE_KEY_ASK.test(dialog)
  r.stops = fx.stopCheck ? stopTurns(dir) : []
  // Вопрос темы — по ходам: «темы» в одном ходе и «Какую разбираем?» в другом не складываются.
  r.themeAsked = turns.map((t) => ({ n: t.n, q: themeQuestion(t.text) })).filter((x) => x.q)
  r.side = sideCheck(r.list ? r.list.items : [], fx, sideShown(dialog), razbors.length === 1 ? read(join(dir, razbors[0])) : '')
  r.pass = lists.length === 1 && razbors.length === 1 && !r.extra.length && !r.touched.length && !r.forbiddenReads.length &&
    r.list.pass && r.razbor.pass && r.dateOk && !r.keyAsked && !r.stops.length && !r.themeAsked.length && !r.side.red.length && !r.side.falseMark.length
  r.lists = lists.length
  r.razbors = razbors.length
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
    // Подменяется цитата со строкой, а не первая «ёлочка» файла: в `суть` бывают названия в кавычках (CR).
    ck('выдуманная цитата — поймана', gradeRazbor(raz.replace(/(L\d+ [\d:]+ [^:«\n]+: «)[^»]{20,}»/, '$1Это мы точно решили, записываю»'), fx, tl).bad.length, 1)
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
    ck('нет раздела «Во вход» — красный', gradeRazbor(raz.replace(/^## Во вход .*$/m, '## Разное'), fx, tl).pass, false)
    const sub = gradeRazbor(raz.replace(/^## Во вход /m, '### Во вход '), fx, tl)
    ck('«Во вход» подразделом — зелёный с предупреждением', `${sub.pass}/${sub.layout}`, 'true/false')

    const sandbox = mkdtempSync(join(tmpdir(), 'grade-meet-'))
    try {
      for (const [rel, src] of Object.entries(fx.seed)) { mkdirSync(join(sandbox, rel, '..'), { recursive: true }); writeFileSync(join(sandbox, rel), read(join(HERE, src))) }
      const folder = fx.folder || Object.keys(fx.seed)[0].replace(/\/[^/]+$/, '')
      mkdirSync(join(sandbox, folder), { recursive: true })
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
    const RANGE = { VAC: [54, 57, 'А, да. Мы его собираем.… Человек 40 без руководителя получается.'], ACC: [29, 32, 'Ну как сказать.… Массовые заведения после кадровых приказов'], LONG: [279, 283, 'Я.… Я спрошу, но думаю, это нормально.'], NEW: [28, 30, 'Вот по два эн дэ эф эл я сразу скажу.… Я бы её в портал не тащил.'], REW: [78, 79, 'Стоп, подождите.… Доменный логин и код системы.'], CHG: [47, 48, 'Кстати, простите, по отпускам ещё.… Отклонённые и отозванные заявки, три года.'], CR: [91, 94, 'Итого. Первое.… За один рабочий день до закрытия письмо пользователю.'] }[name]
    ck('цитата-диапазон на несколько строк — сходится', gradeRazbor(raz.replace(/^## Отброшено/m, `#99 сведение · БТ · проба\n   цитаты: L${RANGE[0]}–L${RANGE[1]} 00:00:00 Кто: «${RANGE[2]}»\n\n## Отброшено`), fx, tl).bad.length, 0)
    ck('поле на следующей строке не читается цитатой', gradeRazbor(raz.replace(/^## Отброшено/m, '#98 сведение · БТ · проба\n   итог: L201\n   опора: «как прозвучало» → X\n\n## Отброшено'), fx, tl).bad.length, 0)
    // Ревью 1.1.0: цитата без букв — сырой текст против окна; нет в окне — не цитата и не выдумка.
    const lq = (q) => { const x = gradeRazbor(raz.replace(/^## Отброшено/m, `#97 сведение · БТ · проба\n   оговорка: ${q}\n\n## Отброшено`), fx, tl); return `${x.quotes - gr.quotes}/${x.bad.length}` }
    ck('цитата «?» не на своей строке — не выдумка и не в счёт', lq('L9000 «?»'), '0/0')
    ck('цитата «…» — не выдумка и не в счёт', lq('L1 «…»'), '0/0')
    const qLine = tl.findIndex((l) => l.includes('?')) + 1
    ck(`цитата «?» на строке с «?» (L${qLine}) — сошлась`, lq(`L${qLine} «?»`), '1/0')
    if (name === 'VAC') {
      ck('«директора на бумаге» — пойман', gradeInput(add('Директора пишут заявление на бумаге, как раньше.'), fx).mustNot.paper, true)
      ck('реализация во входе БТ — поймана', gradeInput(add('Число дней считает бэк и хранит в заявке.'), fx).mustNot.impl, true)
      ck('«кадровик видит и на согласовании» — пойман', gradeInput(add('Кадровик видит и заявки на согласовании.'), fx).mustNot.hrPending, true)
      ck('форма на слух — поймана', gradeInput(add('Эф эр 3 не меняется.'), fx).mustNot.asr, true)
      ck('шум — пойман', gradeInput(add('ИФТ лежит до обеда.'), fx).mustNot.noise, true)
      ck('нет FR-10 — красный', gradeInput(drop(/FR-10/), fx).must.fr10, false)
      ck('срок ежегодного решением, а не открытым — красный', gradeInput(drop(/ежегодн/).replace('## Решено\n', '## Решено\n0. Ежегодный отпуск — не раньше чем за 3 календарных дня.\n'), fx).must.minTerm, false)
      ck('«вопрос» не считается «опросом»', gradeInput(inp + '\n## Открыто\n- Вопрос о сроке.\n', fx).mustNot.impl, false)
      ck('«в день его начала» — засчитано (круг 3)', gradeInput(drop(/FR-10/).replace('## Решено\n', '## Решено\n0. Кадровик не может отменить согласованный отпуск в день его начала: считается дата, без времени суток.\n'), fx).must.fr10, true)
      ck('«бумажные заявления» директоров — пойманы', gradeInput(add('Директора и замы, как раньше, подают бумажные заявления.'), fx).mustNot.paper, true)
      ck('«на бумаге директора не будут» — законно', gradeInput(add('Писать заявления на бумаге директора не будут.'), fx).mustNot.paper, false)
      ck('«кадровик видит только согласованные» — законно', gradeInput(add('Кадровик видит только согласованные отпуска, заявки на согласовании ему не видны.'), fx).mustNot.hrPending, false)
      ck('«на момент нажатия» во входе БТ — пойман', gradeInput(add('При согласовании проверяется, что нажавший — руководитель на момент нажатия.'), fx).mustNot.impl, true)
      ck('«обновления списка» — засчитаны', gradeInput(drop(/груз|загруж|залива/).replace('## Открыто\n', '## Открыто\n- Кто вносит обновления списка руководителей — ждёт: отдел кадров.\n'), fx).must.loader, true)
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
    } else if (name === 'NEW') {
      ck('«только электронные» решением — пойман', gradeInput(drop(/бумажн/).replace('## Решено\n', '## Решено\n0. Справки только электронные.\n'), fx).mustNot.onlyElectronic, true)
      ck('нет бумажной на выбор — красный', gradeInput(drop(/бумажн/), fx).must.format, false)
      ck('«пять рабочих дней» — пойман', gradeInput(add('Срок — пять рабочих дней.'), fx).mustNot.fiveDays, true)
      ck('2-НДФЛ видом справки — пойман', gradeInput(add('Виды справок: с места работы, копия трудовой и 2-НДФЛ.'), fx).mustNot.ndflDecided, true)
      ck('«кроме 2-НДФЛ» в Решено — законно', gradeInput(add('Виды справок — все, кроме 2-НДФЛ.'), fx).mustNot.ndflDecided, false)
      ck('реализация во входе БТ — поймана', gradeInput(add('Файл формируется на бэке и лежит в файловом хранилище.'), fx).mustNot.impl, true)
      ck('форма на слух — поймана', gradeInput(add('Два эн дэ эф эл не делаем.'), fx).mustNot.asr, true)
      ck('шум — пойман', gradeInput(add('Собака передаёт привет.'), fx).mustNot.noise, true)
      ck('подпись решением, а не открытым — красный', gradeInput(drop(/юрист/), fx).must.sign, false)
      ck('«2-НДФЛ — вне проекта» в «Не входит» — засчитано', gradeInput(drop(/НДФЛ/).replace('## Не входит\n', '## Не входит\n- 2-НДФЛ — вне проекта.\n'), fx).must.ndfl, true)
      ck('бывшие в «Решено» с «как сейчас» — засчитано', gradeInput(drop(/бывш/).replace('## Решено\n', '## Решено\n0. Только для себя; бывшие сотрудники — как сейчас, письмом.\n'), fx).must.former, true)
      ck('«доставка курьером» в «Решено» без отрицания — красный', gradeInput(drop(/курьер/).replace('## Решено\n', '## Решено\n0. Бумажную справку привозит курьер.\n'), fx).must.courier, false)
    } else if (name === 'CHG') {
      ck('хранение «год» — поймано', gradeInput(inp.replace(/хранятся три года/, 'хранятся год'), fx).mustNot.retention1, true)
      ck('«три года, а не год» — законно', gradeInput(add('Хранение — три года, а не год.'), fx).mustNot.retention1, false)
      ck('нет трёх лет — красный', gradeInput(inp.replace(/хранятся три года/, 'хранятся год'), fx).must.retention3, false)
      ck('изменение FR-3 потеряно — красный', gradeInput(drop(/ежегодн/), fx).must.fr3, false)
      ck('чужая тема — поймана', gradeInput(add('Суточные считаем по календарным дням командировки.'), fx).mustNot.otherTopic, true)
      ck('джоба во входе БТ — поймана', gradeInput(add('Удаляет джоба раз в сутки.'), fx).mustNot.impl, true)
      ck('перепутанные виды отпуска — красный', gradeInput(drop(/ежегодн/).replace('## Решено\n', '## Решено\n0. Ежегодный — со следующего дня; без сохранения зарплаты — за три календарных дня.\n'), fx).must.fr3, false)
      ck('«отменённые не попадают» — поймано', gradeInput(add('Отменённые отпуска в список кадровика не попадают.'), fx).mustNot.fr9Inverted, true)
      ck('«год, … три года» — поймано', gradeInput(add('Отклонённые хранятся год, отозванные — три года.'), fx).mustNot.retention1, true)
      ck('«удаляются через три года» — засчитано', gradeInput(inp.replace(/хранятся три года, потом удаляются/, 'удаляются через три года'), fx).must.retention3, true)
      ck('подпункты одного решения — засчитаны', gradeInput(drop(/ежегодн/).replace('## Решено\n', '## Решено\n0. Минимальный срок подачи (FR-3):\n   - ежегодный — не раньше чем через три календарных дня;\n   - без сохранения — со следующего дня.\n'), fx).must.fr3, true)
      ck('цель «новый БТ» — красный', gradeInput(inp.replace('цель: правки БТ', 'цель: новый БТ'), fx).pass, false)
    } else if (name === 'CR') {
      ck('цель «новый БТ» — красный', gradeInput(inp.replace('цель: правка работающего', 'цель: новый БТ'), fx).pass, false)
      ck('«пять рабочих дней» — пойман', gradeInput(add('Автозакрытие — пять рабочих дней.'), fx).mustNot.fiveDays, true)
      ck('ошибка «Переоткрыть» решением — поймана', gradeInput(add('Кнопку «Переоткрыть» в мобильной версии чиним.'), fx).mustNot.bugDecided, true)
      ck('производственный календарь — пойман', gradeInput(add('Рабочие дни — по производственному календарю.'), fx).mustNot.impl, true)
      ck('нет напоминания — красный', gradeInput(drop(/напомин/i), fx).must.reminder, false)
      ck('«**цель:** правка работающей функции» — засчитано', gradeInput(inp.replace('цель: правка работающего', '**цель:** правка работающей функции'), fx).pass, true)
      ck('«пять рабочих предлагали — мало» — законно', gradeInput(add('Семь рабочих дней вместо трёх календарных (пять рабочих предлагали — мало).'), fx).mustNot.fiveDays, false)
      ck('«предложение про пять рабочих не принято» — законно (круг 2 run-4)', gradeInput(add('Семь рабочих дней вместо трёх календарных. Предложение про пять рабочих дней не принято.'), fx).mustNot.fiveDays, false)
      ck('ошибка «не в эту задачу» в Решено — законно', gradeInput(add('Ошибка кнопки «Переоткрыть» — не в эту задачу, заводится отдельно.'), fx).mustNot.bugDecided, false)
      ck('семь рабочих без «как сейчас» — красный', gradeInput(inp.replace('через три календарных дня, если пользователь молчит', 'по-старому'), fx).must.sevenDays, false)
      const vtt = raz.replace(/(L40 )00:00:54( Захарова Ольга: «)/, '$100:00:54.600$2')
      ck('время VTT с миллисекундами — цитата считается', gradeRazbor(vtt, fx, tl).quotes, gradeRazbor(raz, fx, tl).quotes)
      ck('выдуманная цитата с временем VTT — поймана', gradeRazbor(raz.replace(/L40 00:00:54 Захарова Ольга: «[^»]+»/, 'L40 00:00:54.600 Захарова Ольга: «Это мы точно решили, записываю»'), fx, tl).bad.length, 1)
      const sb = mkdtempSync(join(tmpdir(), 'grade-meet-'))
      try {
        for (const [rel, src] of Object.entries(fx.seed)) { mkdirSync(join(sb, rel, '..'), { recursive: true }); writeFileSync(join(sb, rel), read(join(HERE, src))) }
        mkdirSync(join(sb, fx.folder), { recursive: true })
        writeFileSync(join(sb, fx.folder, 'meeting-support-sync-bt.md'), inp)
        writeFileSync(join(sb, fx.folder, 'meeting-support-sync.razbor.md'), raz)
        ck('дата не из имени расшифровки — красный', gradeRun(sb, fx).dateOk, false)
      } finally { rmSync(sb, { recursive: true, force: true }) }
    } else if (name === 'REW') {
      ck('табельный номер — пойман', gradeInput(inp.replace('доменный логин сотрудника', 'табельный номер сотрудника'), fx).mustNot.tabel, true)
      ck('«доменный логин, а не табельный» — законно', gradeInput(inp.replace('доменный логин сотрудника', 'доменный логин сотрудника, а не табельный номер'), fx).mustNot.tabel, false)
      ck('«каждые десять минут» — пойман', gradeInput(add('Повтор заведения — каждые 10 минут сутки.'), fx).mustNot.tenMin, true)
      ck('«10 секунд на всё» — пойман', gradeInput(add('Таймаут на все вызовы — 10 секунд.'), fx).mustNot.tenSec, true)
      ck('«до 8–10 секунд» — не таймаут', gradeInput(add('По понедельникам система отвечает до 8–10 секунд.'), fx).mustNot.tenSec, false)
      ck('кэш на пять минут — пойман', gradeInput(add('Кэш состояния — 5 минут.'), fx).mustNot.cache5, true)
      ck('пауза 5 минут без кэша — не «кэш 5 минут»', gradeInput(inp, fx).mustNot.cache5, false)
      ck('мессенджер решением — пойман', gradeInput(add('Владельцу — уведомление в мессенджер о новой заявке.'), fx).mustNot.messenger, true)
      ck('токен карточки — пойман', gradeInput(add('При заведении портал шлёт employeeLogin и targetSystemCode.'), fx).mustNot.leak, true)
      ck('шум — пойман', gradeInput(add('Принтер на шестом этаже не работает.'), fx).mustNot.noise, true)
      ck('нет кэша на минуту — красный', gradeInput(drop(/кэшир/), fx).must.cache, false)
      const short = drop(/Таймауты/).replace('## Решено\n', '## Решено\n0. Таймауты вызовов: запрос состояния — 3, блокировка — 15, заведение — 30 секунд.\n')
      const g = gradeInput(short, fx)
      ck('сжатые таймауты «3, 15, 30 секунд» — засчитаны', `${g.must.tState}/${g.must.tBlock}/${g.must.tCreate}`, 'true/true/true')
      ck('«13 секунд» — не «3 секунды»', gradeInput(drop(/Таймауты/).replace('## Решено\n', '## Решено\n0. Запрос состояния — 13 секунд.\n'), fx).must.tState, false)
      ck('«табельный номер не передаётся» — законно', gradeInput(add('При заведении — доменный логин; табельный номер не передаётся.'), fx).mustNot.tabel, false)
      ck('«8 – 10 секунд» — не таймаут', gradeInput(add('По понедельникам система отвечает до 8 – 10 секунд.'), fx).mustNot.tenSec, false)
      ck('повторы без «сутки» — красный', gradeInput(inp.replace('; повторяем сутки', ''), fx).must.retry, false)
      const sandbox2 = mkdtempSync(join(tmpdir(), 'grade-meet-'))
      try {
        for (const [rel, src] of Object.entries(fx.seed)) { mkdirSync(join(sandbox2, rel, '..'), { recursive: true }); writeFileSync(join(sandbox2, rel), read(join(HERE, src))) }
        writeFileSync(join(sandbox2, 'docs/ACS-208', fx.etalon.input.split('/').pop()), inp)
        writeFileSync(join(sandbox2, 'docs/ACS-208', fx.etalon.razbor.split('/').pop()), raz)
        ck('вход прошлой встречи из засева — не второй вход', gradeRun(sandbox2, fx).pass, true)
      } finally { rmSync(sandbox2, { recursive: true, force: true }) }
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
      ck('«Блокировку фоновой задачей не берём» — не «блокировка фоном»', gradeInput(add('Блокировка при отзыве синхронная. Блокировку фоновой задачей не берём.'), fx).mustNot.asyncRevoke, false)
      ck('отвергнутый вариант как довод — не «промежуточный статус»', gradeInput(why, fx).mustNot.midDecided, false)
      ck('«асинхронно, а не в том же запросе» — законно', gradeInput(add('Учётка заводится асинхронно, а не в том же запросе.'), fx).mustNot.syncCreate, false)
      ck('«кнопка скрыта, статус не меняется» — не скрытый статус', gradeInput(add('Кнопка «Отозвать доступ» скрыта, статус заявки не меняется.'), fx).mustNot.hiddenStatus, false)
      ck('«синхронная блокировка, не фоном» — законно', gradeInput(add('Отзыв — синхронная блокировка, не фоном.'), fx).mustNot.asyncRevoke, false)
      ck('«заводит фоновая задача, а отзыв синхронный» — законно', gradeInput(add('Учётку заводит фоновая задача; отзыв — синхронная блокировка.'), fx).mustNot.asyncRevoke, false)
      ck('ссылка на доку ошибок /api/v2 — не утечка', gradeInput(inp.replace('## Сведения\n', '## Сведения\n- Коды ошибок — в документации https://wiki.corp/idm/api/v2#errors.\n'), fx).mustNot.leak, false)
      ck('«кнопки отзыва доступа нет» — засчитано', gradeInput(drop(/Отозвать доступ/).replace('## Решено\n', '## Решено\n0. Состояние учётки узнать не удалось — кнопки отзыва доступа нет.\n'), fx).must.hideRevoke, true)
      ck('«служба информационной безопасности» — засчитано', gradeInput(inp.replace(/решает: ИБ/g, 'решает: служба информационной безопасности'), fx).must.midStatus, true)
      const as = gradeInput(drop(/синхронная блокировка/).replace('## Решено\n', '## Решено\n0. Отзыв доступа — асинхронная блокировка.\n'), fx)
      ck('«асинхронная блокировка» — не синхронная, поймана', `${as.must.syncRevoke}/${as.mustNot.asyncRevoke}`, 'false/true')
      ck('«считает, что выдали» — засчитано', gradeInput(drop(/E_ACC_DUP с идентификатором/).replace('## Решено\n', '## Решено\n0. На повторное заведение портал берёт идентификатор существующей учётки и считает, что выдали.\n'), fx).must.dup, true)
      ck('«уже есть учётка — берём существующую из ответа, выданным» — засчитано (круг 2 run-3)', gradeInput(drop(/E_ACC_DUP с идентификатором/).replace('## Решено\n', '## Решено\n0. Если у сотрудника в системе уже есть учётка, берём существующую из ответа и считаем доступ выданным.\n'), fx).must.dup, true)
      ck('«при открытии заявки запрашиваем данные учётки» — засчитано (круг 3)', gradeInput(drop(/при открытии заявки/).replace('## Решено\n', '## Решено\n0. При открытии заявки запрашиваем данные учётки в системе управления учётками.\n'), fx).must.stateOnOpen, true)
      ck('«при блокировке система отвечает ошибкой состояния» — засчитано (круг 3)', gradeInput(drop(/E_ACC_STATE: тогда/).replace('## Решено\n', '## Решено\n0. Если при блокировке система отвечает ошибкой состояния, запрашиваем состояние учётки; заблокирована — доступ отозван.\n'), fx).must.state422, true)
      ck('«скрытого внутреннего статуса нет» — законно', gradeInput(add('Скрытого внутреннего статуса нет: статус заявки показываем как есть.'), fx).mustNot.hiddenStatus, false)
      ck('«подписку на увольнения не делаем» в Решено — законно', gradeInput(add('Подписку на событие увольнения не делаем.'), fx).mustNot.busSub, false)
    }
  }
  console.log(bad === 0 ? '\nсамопроверка: ok' : `\nсамопроверка: ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// Самопроверка режима списка. Эталоны — fixtures/MEET-*/etalon-2/: список собран из эталонного разбора по таблице
// output.md (все слои, уже записанное тоже; отменённое, не принятое и поручения — нет), разбор — тот же, в форме 2.0.0.
// По каждой фикстуре: отменённое в список, пропавший пункт (у ACC и REW — пункт спеки, у VAC, LONG, NEW — бывший
// анкер разбора «для спеки»).
const PT_CASE = {
  VAC: { cancel: '- [решено] Директора пишут заявление на бумаге, как раньше — решил: Литвинов И. П. · L64', cancelId: 'paper', drop: /момент нажатия/, dropId: 'nowCheck' },
  ACC: { cancel: '- [решено] Учётку заводим синхронно в том же запросе — решил: Карпенко О. В. · L23', cancelId: 'syncCreate', drop: /фоновая задача/, dropId: 'async' },
  LONG: { cancel: '- [решено] Групповые заявки — до пяти посетителей, одно решение на заявку — решил: Гаврилов П. И. · L244', cancelId: 'groups', drop: /кешируют/, dropId: 'cache' },
  NEW: { cancel: '- [решено] Справки только электронные — решил: Кузьмина Т. П. · L38', cancelId: 'onlyElectronic', drop: /Должность и дата приёма/, dropId: 'zup' },
  REW: { cancel: '- [решено] При заведении портал передаёт табельный номер и код системы — решил: Соколова А. Н. · L76', cancelId: 'tabel', drop: /кэшируется/, dropId: 'cache' },
  CHG: { cancel: '- [решено] Отклонённые и отозванные хранятся год, потом удаляются — решил: Соколова Е. В. · L30', cancelId: 'retention1', drop: /три года/, dropId: 'retention3', dropWarn: /раз в сутки/ },
  CR: { cancel: '- [решено] Автозакрытие — через пять рабочих дней — решил: Захарова О. · L31', cancelId: 'fiveDays', drop: /семь рабочих/, dropId: 'sevenDays', dropWarn: /производственного календаря/ },
  OUT: { cancel: '- [решено] Посылки кладём на стеллаж возвратов — решил: Гаврилов О. П. · L44', cancelId: 'decided', drop: /^- \[открыто\]/ },
}

function selftestPoints () {
  let bad = 0
  const ck = (n, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}: ${got} (ожидалось ${want})`) }
  const has = (arr, s) => arr.some((x) => x.includes(s))
  for (const name of Object.keys(PT)) {
    console.log(`\n${name} (список)`)
    const fx = ptFx(name)
    const C = PT_CASE[name]
    const pts = read(join(HERE, fx.etalon.points))
    const raz = read(join(HERE, fx.etalon.razbor))
    const ctx = ptCtx(fx)
    const nItems = parsePoints(pts).items.length
    const gr = gradeRazborPt(raz, fx, ctx.tLines, nItems)
    const g = (text) => gradePoints(text, fx, { ...ctx, quoteLines: gr.quoteLines })
    const firstL = parsePoints(pts).items[0].L
    const add = (line) => pts.replace(/\n*$/, '\n') + line + '\n'
    const drop = (re) => pts.split('\n').filter((l) => !(/^- \[/.test(l) && re.test(l))).join('\n')
    const e = g(pts)
    ck('эталон списка — зелёный', e.pass, true)
    if (!e.pass) console.log('     ', e.form, e.missing, e.violations)
    ck('эталон списка — без предупреждений', e.warn.length, 0)
    if (e.warn.length) console.log('     ', e.warn)
    ck('эталон разбора — зелёный', gr.pass, true)
    if (!gr.pass) console.log('     ', gr.quotes, gr.bad, gr.lost, gr.heading, gr.bare.length)
    ck('у каждого пункта есть запись «в список: п.<N>»', gr.unmarked.length, 0)
    console.log(`      пунктов: ${nItems}, цитат в разборе: ${gr.quotes}`)

    // Красные: каждый случай — ровно одна причина, и та, что задумана (красный не по той причине — провал проверки).
    const why = (res) => [...res.form, ...res.missing, ...res.violations]
    const only = (res, s) => `${why(res).length}/${has(why(res), s)}`
    const firstDec = pts.split('\n').find((l) => /^- \[решено\]/.test(l))
    if (firstDec) ck('нет «решил:» у [решено] — красный', only(g(pts.replace(firstDec, firstDec.replace(/ — решил: [^·]+/, ' '))), 'решил'), '1/true')
    ck('отменённое в списке — красный', only(g(add(C.cancel)), fx.mustNot.find((m) => m.id === C.cancelId).d), '1/true')
    const code = g(add(`- [сведение] Код ошибки E_VAC_404 пишется в поле leave_days — со слов Кравца Д. О. · L${firstL}`))
    ck('слово из несказанного (код без опоры) — красный', `${why(code).length}/${has(code.form, 'E_VAC_404')}/${has(code.form, 'leave_days')}`, '2/true/true')
    const unsaid = g(add(`- [открыто] Месяц запуска на встрече не назвали — ждёт: — · L${firstL}`))
    ck('утверждение о несказанном («не назвали») — зелёный с предупреждением', `${unsaid.pass}/${has(unsaid.warn, 'несказанн')}`, 'true/true')
    const filler = g(add(`- [открыто] Кто отвечает за справочник — ждёт: ответственный не назван · L${firstL}`))
    ck('«ждёт: ответственный не назван» — не утверждение о несказанном', has(filler.warn, 'несказанн'), false)
    const firstItem = pts.split('\n').find((l) => /^- \[/.test(l))
    ck('ссылка на несуществующую строку — красный', only(g(pts.replace(firstItem, firstItem.replace(/· L\d+\s*$/, '· L9999'))), 'несуществующую строку'), '1/true')
    const dropped = g(drop(C.drop))
    if (C.dropId) ck(`пропал пункт (${C.dropId}) — красный`, `${dropped.must[C.dropId]}/${has(dropped.missing, fx.must.find((m) => m.id === C.dropId).d)}/${dropped.pass}`, 'false/true/false')
    else ck('пропали открытые вопросы — красный', only(dropped, '[открыто]'), '1/true')
    if (C.dropWarn) { const dw = g(drop(C.dropWarn)); ck('пропал пункт спеки уровня предупреждения — зелёный с предупреждением', `${dw.pass}/${has(dw.warn, 'в списке нет')}`, 'true/true') }
    ck('вид [мысль] — красный', only(g(add(`- [мысль] Может, сделать иначе · L${firstL}`)), 'вид не из трёх'), '1/true')
    ck('пункт без «· L<n>» — красный', only(g(add('- [сведение] Что-то сказали — со слов Иванова И.')), 'не по форме'), '1/true')
    ck('номер строки в тексте пункта — красный', only(g(pts.replace(firstItem, firstItem.replace(/ — /, ` (L${firstL}) — `))), 'номер строки или время'), '1/true')
    ck('«вместо:» в пункте — красный', only(g(add(`- [сведение] Иначе — со слов Иванова И.; вместо: 2026-10-06 №1 «Старое» · L${firstL}`)), 'вместо'), '1/true')
    ck('первая строка не «# Пункты:» — красный', only(g(pts.replace(/^# Пункты:/, '# Встреча:')), 'первая строка'), '1/true')
    ck('нет «> Встреча:» — красный', only(g(pts.replace(/^> Встреча:.*\n/m, '')), '> Встреча:'), '1/true')
    const pdf = g(add(`- [сведение] Справку отдают в формате PDF — со слов Иванова И. · L${firstL}`))
    ck('простое латинское слово без опоры — зелёный с предупреждением', `${pdf.pass}/${has(pdf.warn, 'PDF')}`, 'true/true')
    const dot = g(pts.replace(firstItem, firstItem.replace(/\s*$/, '.')))
    ck('точка после L<n> — зелёный с предупреждением', `${dot.pass}/${has(dot.warn, 'хвост')}`, 'true/true')
    ck('«ждёт: не назван» — не утверждение о несказанном', has(g(add(`- [открыто] Кто отвечает за справочник — ждёт: не назван · L${firstL}`)).warn, 'несказанн'), false)
    ck('«статус не называть так» — не утверждение о несказанном', has(g(add(`- [сведение] Статус лучше не называть «Отказ» — со слов Иванова И. · L${firstL}`)).warn, 'несказанн'), false)
    const extraLine = g(pts.replace(/\n- \[/, '\n## Решено\n- ['))
    ck('лишняя строка вне формы — предупреждение, не красный', `${extraLine.pass}/${has(extraLine.warn, 'вне формы')}`, 'true/true')
    const noOpen = g(add(`- [открыто] Кто отвечает за справочник · L${firstL}`))
    ck('[открыто] без «ждёт:» — предупреждение', `${noOpen.pass}/${has(noOpen.warn, 'ждёт')}`, 'true/true')
    // Строка расшифровки есть, но ни одна запись разбора её не цитирует.
    const freeL = ctx.tRaw.findIndex((l, i) => l.trim() && !gr.quoteLines.has(i + 1)) + 1
    const notQuoted = g(add(`- [сведение] Что-то рассказали — со слов Иванова И. · L${freeL}`))
    ck(`L${freeL} не строка цитат разбора — зелёный с предупреждением`, `${notQuoted.pass}/${has(notQuoted.warn, 'не строка цитат')}`, 'true/true')

    // Разбор.
    ck('«Во вход» вместо «В список» — красный', gradeRazborPt(raz.replace(/^## В список /m, '## Во вход '), fx, ctx.tLines, nItems).pass, false)
    ck('выдуманная цитата — поймана', gradeRazborPt(raz.replace(/(L\d+ [\d:]+ [^:«\n]+: «)[^»]{20,}»/, '$1Это мы точно решили, записываю»'), fx, ctx.tLines, nItems).bad.length, 1)
    const unm = gradeRazborPt(raz.replace(/^ {3}в список: п\.1\n/m, ''), fx, ctx.tLines, nItems)
    ck('нет пометки «в список: п.1» — зелёный с предупреждением', `${unm.pass}/${unm.unmarked.join(',')}`, 'true/1')
    const bare = gradeRazborPt(raz.replace(/^( {3}цитаты: )L(\d+)[^\n]*$/m, '$1L$2'), fx, ctx.tLines, nItems)
    ck(`строка «цитаты:» без текста — ${fx.bareRed ? 'красный' : 'предупреждение'}`, `${bare.bare.length}/${bare.pass}`, `1/${!fx.bareRed}`)

    // Песочница.
    const sandbox = mkdtempSync(join(tmpdir(), 'grade-meet-pt-'))
    try {
      const folder = fx.folder || (Object.keys(fx.seed).find((k) => k.startsWith('docs/')) || '').replace(/\/[^/]+$/, '')
      const base = fx.etalon.points.split('/').pop().replace(/\.points\.md$/, '')
      const put = (rel, text) => { mkdirSync(join(sandbox, rel, '..'), { recursive: true }); writeFileSync(join(sandbox, rel), text) }
      for (const [rel, src] of Object.entries(fx.seed)) put(rel, read(join(HERE, src)))
      put(`${folder}/${base}.points.md`, pts)
      put(`${folder}/${base}.razbor.md`, raz)
      const run = () => gradeRunPt(sandbox, fx)
      ck('песочница с эталоном — зелёная', run().pass, true)
      if (!run().pass) { const x = run(); console.log('     ', x.extra, x.touched, x.list && x.list.form, x.razbor && x.razbor.pass) }
      const seedRel = Object.keys(fx.seed)[0]
      put(seedRel, read(join(HERE, fx.seed[seedRel])) + '\nправка\n')
      ck('засев тронут — красный', run().pass, false)
      put(seedRel, read(join(HERE, fx.seed[seedRel])))
      put(`${folder}/${base}-bt.md`, '# Встреча\n\n## Решено\n1. x\n')
      ck('вход 1.x рядом со списком — лишний файл, красный', `${run().extra.length}/${run().pass}`, '1/false')
      rmSync(join(sandbox, folder, `${base}-bt.md`))
      rmSync(join(sandbox, folder, `${base}.points.md`))
      ck('списка нет — красный', `${run().lists}/${run().pass}`, '0/false')
      const other = fx.key ? 'docs/_inbox' : 'docs/ABC-1'
      put(`${other}/${base}.points.md`, pts)
      ck('список не в той папке — красный', run().pass, false)
      rmSync(join(sandbox, other), { recursive: true, force: true })
      put(`${folder}/${base}.points.md`, pts)
      put('notes/x/notebook.md', '# Ноут\n')
      ck('запись в ноут — лишний файл, красный', run().pass, false)
      rmSync(join(sandbox, 'notes'), { recursive: true, force: true })
      writeFileSync(join(sandbox, 'answer.md'), 'отчёт'); writeFileSync(join(sandbox, '_seeded.txt'), Object.keys(fx.seed).join('\n'))
      ck('файлы стенда в корне — не лишние', run().pass, true)
      const ev = (input, sub) => JSON.stringify({ type: 'assistant', parent_tool_use_id: sub ? 'toolu_1' : null, message: { content: [{ type: 'tool_use', id: 'x', name: 'Read', input }] } })
      writeFileSync(join(sandbox, 'stream-03.jsonl'), ev({ file_path: 'C:\\sb\\services\\idm.md' }, true) + '\n')
      ck('субагент читал services/ — красный', run().pass, false)
      rmSync(join(sandbox, 'stream-03.jsonl'))
      if (fx.fileDate) {
        rmSync(join(sandbox, folder), { recursive: true, force: true })
        put(`${folder}/meeting-support-sync.points.md`, pts)
        put(`${folder}/meeting-support-sync.razbor.md`, raz)
        ck('дата не из имени расшифровки — красный', `${run().dateOk}/${run().pass}`, 'false/false')
        rmSync(join(sandbox, folder), { recursive: true, force: true })
        put(`${folder}/${base}.points.md`, pts)
        put(`${folder}/${base}.razbor.md`, raz)
      }
      // Вопрос темы — красный во всех пробах (Шаг 2 после круга 1: «тему не спрашиваешь»).
      writeFileSync(join(sandbox, 'answer-01.md'), 'Встреча разобрана на две темы.\n\n**Какую тему разбираем?** Рекомендую первую.')
      writeFileSync(join(sandbox, 'answer-02.md'), 'Записано: список и разбор.')
      ck('вопрос о выборе темы — красный', `${run().themeAsked.map((x) => x.n).join(',')}/${run().pass}`, '1/false')
      writeFileSync(join(sandbox, 'answer-01.md'), 'Тема одна: заявка. Остальное — связь и оборудование, в выбор не идёт.\n\nЗаписать пункты? Варианты: «Записать», «Поправить».')
      ck('«Тема одна… в выбор не идёт» и сводка — не вопрос темы', `${run().themeAsked.length}/${run().pass}`, '0/true')
      if (fx.keyAsk) {
        writeFileSync(join(sandbox, 'answer-01.md'), 'Ключ задачи? если его ещё нет — так и напишите')
        ck('спрошен ключ задачи — красный', `${run().keyAsked}/${run().pass}`, 'true/false')
      }
      rmSync(join(sandbox, 'answer-01.md')); rmSync(join(sandbox, 'answer-02.md'))
      if (fx.stopCheck) {
        const wr = (p) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'w', name: 'Write', input: { file_path: p, content: 'x' } }] } })
        writeFileSync(join(sandbox, 'answer-01.md'), 'Карта готова. На встрече нет ни решений, ни сведений.')
        writeFileSync(join(sandbox, 'stream-01.jsonl'), '')
        writeFileSync(join(sandbox, 'stream-02.jsonl'), wr(`C:/sb/${folder}/${base}.points.md`) + '\n')
        ck('ход-стоп «нет ни решений, ни сведений» без записи — красный', `${run().stops.join(',')}/${run().pass}`, '1/false')
        writeFileSync(join(sandbox, 'answer-01.md'), 'Решений на встрече нет, есть сведения. Записать 17 пунктов?')
        ck('«решений нет» с вопросом — не стоп', `${run().stops.length}/${run().pass}`, '0/true')
      }
    } finally { rmSync(sandbox, { recursive: true, force: true }) }

    // Свои случаи фикстур.
    if (name === 'VAC') {
      const fd = g(drop(/первый день отпуска/))
      ck('нет следствия L174–L177 — зелёный с предупреждением', `${fd.pass}/${has(fd.warn, 'первый день')}`, 'true/true')
      ck('«в первый день отказа заявка висит согласованной» — засчитано', has(g(drop(/первый день отпуска/).replace(/\n*$/, '\n') + '- [сведение] Если сотрудник отказался в первый день, заявка в портале висит как согласованная — со слов Литвинова И. П. · L176\n').warn, 'первый день'), false)
      ck('шум (« Кравца ноут обновляется, …») — красный', g(add('- [сведение] У Кравца ноут обновляется, винда — со слов Кравца Д. О. · L11')).mustNot.noise, true)
      ck('побочная тема (ИФТ) — не шум; без «Похоже, не про» — красный, показана — нет', `${g(add('- [сведение] Стенд ИФТ так и не поднялся — со слов Кравца Д. О. · L231')).mustNot.noise}/${sideCheck(parsePoints(add('- [сведение] Стенд ИФТ так и не поднялся — со слов Кравца Д. О. · L231')).items, fx, '', raz).red.length}/${sideCheck(parsePoints(add('- [сведение] Стенд ИФТ так и не поднялся — со слов Кравца Д. О. · L231')).items, fx, sideShown('Похоже, не про главное (1): 1. Стенд ИФТ так и не поднялся — со слов Кравца Д.'), raz).red.length}`, 'false/1/0')
      // Живая строка r6 meet-vac run-1: пункты отпусков в «не про тему» — ложные, ИФТ — побочное.
      const R6_VAC = '**Похоже, не про отпуска, БТ (K=3):** 1. число в меню при загрузке (счётчик меню); 2. дни календарные, с 1 по 10 мая — 10 (число дней); 3. стенд ифт лежит (стенд ИФТ).\n\nЧто делаем?'
      ck('r6 vac run-1: ложных пометок 2, ИФТ — не ложная', sideCheck([], fx, sideShown(R6_VAC), raz).falseMark.join(' | '), 'число в меню при загрузке (счётчик меню); | дни календарные, с 1 по 10 мая — 10 (число дней);')
      ck('пометка списком по строкам: суточные и шум — не ложные', sideCheck([], fx, sideShown('Похоже, не про отпуска (2):\n- баг с суточными висит (командировки)\n- у Кравца ноут обновляется\n\nВарианты: «Записать 40 пунктов»'), raz).falseMark.length, 0)
      ck('«опрашивать раз в минуту» решением — пойман', g(add('- [решено] Счётчик опрашиваем раз в минуту — решил: Кравец Д. О. · L139')).mustNot.poll, true)
      ck('«без опроса, при загрузке» — законно', g(add('- [решено] Без опроса раз в минуту: счётчик обновляется при загрузке — решил: Ершов А. С. · L138')).mustNot.poll, false)
      ck('«число дней считает фронт» — пойман', g(add('- [решено] Число дней считает фронт — решил: Кравец Д. О. · L144')).mustNot.frontCount, true)
      ck('«считается на сервере, а не на фронте» — законно', g(add('- [решено] Число дней считается на сервере, а не на фронте — решил: Ершов А. С. · L148')).mustNot.frontCount, false)
      ck('итог L150–L154 «бэк хранит, в черновике фронт считает для показа» — законно (r6 run-1)', g(add('- [решено] число дней хранится в заявке и считается на бэке; в черновике фронт считает для показа, при сохранении бэк пересчитывает — решил: Ершов · L148')).mustNot.frontCount, false)
      ck('«ютиси» — форма на слух', g(add('- [сведение] Серверы в ютиси — со слов Кравца Д. О. · L93')).mustNot.asrPt, true)
      ck('реализация в списке — законна (слоя нет)', g(add('- [решено] Число дней считает бэк и хранит в заявке — решил: Ершов А. С. · L148')).pass, true)
      ck('FR-10 — опора в БТ, не «код без опоры»', has(e.form, 'FR-10'), false)
      ck('FR-99 — код без опоры', has(g(add('- [решено] В FR-99 — пример — решил: Ершов А. С. · L179')).form, 'FR-99'), true)
      ck('кадровик видит и на согласовании — пойман', g(add('- [решено] Кадровик видит и заявки на согласовании — решил: Литвинов И. П. · L212')).mustNot.hrPending, true)
    } else if (name === 'ACC') {
      ck('токен карточки employeeLogin — пойман дважды (утечка и код)', `${g(add('- [решено] Портал шлёт employeeLogin — решил: Фомин Г. А. · L116')).mustNot.leak}/${has(g(add('- [решено] Портал шлёт employeeLogin — решил: Фомин Г. А. · L116')).form, 'employeeLogin')}`, 'true/true')
      ck('ссылка на доку ошибок /api/v2 — опора в чате', g(add('- [сведение] Коды ошибок — в документации wiki.corp/idm/api/v2 — со слов Зуева Т. Р. · L79')).pass, true)
      ck('«Расходится с БТ» → [открыто]: промежуточный статус решением — пойман', g(add('- [решено] Промежуточный статус называется «Согласована» — решил: Соколова А. Н. · L47')).mustNot.midDecided, true)
      ck('шум («уев в электричке, связь мо…») — красный', g(add('- [сведение] Зуев в электричке, связь может пропасть — со слов Зуева Т. Р. · L4')).mustNot.noise, true)
      ck('побочная тема (ретро) — не шум; без «Похоже, не про» — красный, показана — нет', `${g(add('- [сведение] Ретро перенесли с пятницы на понедельник — со слов Мартынова Р. Е. · L188')).mustNot.noise}/${sideCheck(parsePoints(add('- [сведение] Ретро перенесли с пятницы на понедельник — со слов Мартынова Р. Е. · L188')).items, fx, '', raz).red.length}/${sideCheck(parsePoints(add('- [сведение] Ретро перенесли с пятницы на понедельник — со слов Мартынова Р. Е. · L188')).items, fx, sideShown('Похоже, не про главное (1): 1. Ретро перенесли с пятницы на понедельник — со с'), raz).red.length}`, 'false/1/0')
      ck('подписка «не входит» — законна', g(pts).mustNot.busSub, false)
      const noBus = drop(/подписка на событие увольнения/)
      ck('нет «шину не берём» — красный', only(g(noBus), 'шину не берём'), '1/true')
      ck('только сведение «на кадровый топик подписываться не дают» — красный (r1 run-1)', g(noBus.replace(/\n*$/, '\n') + '- [сведение] На кадровый топик событий об увольнении клиентам подписываться не дают — со слов Зуева Т. Р. · L176\n').must.busOut, false)
      ck('«[открыто] не входит ли подписка на шину» — засчитано', g(noBus.replace(/\n*$/, '\n') + '- [открыто] не входит ли подписка на шину увольнений — ждёт: — · L174\n').must.busOut, true)
    } else if (name === 'LONG') {
      ck('мессенджер решением — пойман', g(add('- [решено] Уведомление заявителю — через бота в мессенджере — решил: Лебедев К. · L311')).mustNot.messenger, true)
      ck('«почтой, без бота» — законно', g(add('- [решено] Уведомления почтой, без бота — решил: Сафина Р. М. · L314')).mustNot.messenger, false)
      ck('групповые «не входит» — законно', g(pts).mustNot.groups, false)
      const csv = parsePoints(add('- [решено] Выгрузка в CSV через точку с запятой — решил: Белкин О. А. · L29')).items
      ck('стендап (CSV) в списке без «Похоже, не про» — красный', sideCheck(csv, fx, '', raz).red.length, 1)
      ck('стендап (CSV) показан в «Похоже, не про» — зелёный', sideCheck(csv, fx, 'Похоже, не про пропуск для посетителя (1): 1. Выгрузка отчёта по командировкам в CSV (отчёт по командировкам)', raz).red.length, 0)
      // Живая строка r4 meet-long run-1, стр. 84: следующая встреча по основной теме — не побочное.
      const nextMeet = parsePoints(add('- [решено] Следующая встреча по пропускам в пятницу в 11:00 (в 10:00 у Мельникова планёрка) — решил: Орлова · L646')).items
      ck('r4: «следующая встреча по пропускам… планёрка» без «Похоже, не про» — не побочное', sideCheck(nextMeet, fx, '', raz).red.length, 0)
      ck('планёрка без встречи по пропускам — побочное, без вопроса красный', sideCheck(parsePoints(add('- [сведение] У Мельникова по утрам в десять планёрка — со слов Мельникова С. В. · L648')).items, fx, '', raz).red.length, 1)
      ck('столовая — шум, красный', g(add('- [сведение] Столовая сегодня работает — со слов Лебедева К. · L480')).mustNot.noise, true)
      ck('ИФТ — побочная тема, не шум', g(add('- [сведение] Стенд ИФТ лежит — со слов Ткачук И. О. · L59')).mustNot.noise, false)
    } else if (name === 'NEW') {
      ck('шум (« Сидоренко собака, может з…») — красный', g(add('- [сведение] У Сидоренко собака, может залаять — со слов Сидоренко П. · L7')).mustNot.noise, true)
      ck('побочная тема (демо) — не шум; без «Похоже, не про» — красный, показана — нет', `${g(add('- [сведение] Демо в четверг переносили — со слов Сидоренко П. · L116')).mustNot.noise}/${sideCheck(parsePoints(add('- [сведение] Демо в четверг переносили — со слов Сидоренко П. · L116')).items, fx, '', raz).red.length}/${sideCheck(parsePoints(add('- [сведение] Демо в четверг переносили — со слов Сидоренко П. · L116')).items, fx, sideShown('Похоже, не про главное (1): 1. Демо в четверг переносили — со слов Сидоренко П'), raz).red.length}`, 'false/1/0')
      ck('«зуп» — форма на слух', g(add('- [сведение] Данные о сотруднике — из зупа — со слов Кузьминой Т. П. · L54')).mustNot.asrPt, true)
      const viaOpen = g(drop(/курьером/).replace(/\n*$/, '\n') + '- [открыто] не входит ли доставка справки курьером — ждёт: — · L110\n')
      ck('«[открыто] не входит ли …» засчитано за «Не входит»', `${viaOpen.must.courier}/${viaOpen.pass}`, 'true/true')
      ck('2-НДФЛ видом справки — пойман', g(add('- [решено] Виды справок: с места работы, копия трудовой и 2-НДФЛ — решил: Лебедева И. С. · L22')).mustNot.ndflDecided, true)
      ck('«пять рабочих дней» — пойман', g(add('- [решено] Срок — пять рабочих дней — решил: Кузьмина Т. П. · L61')).mustNot.fiveDays, true)
      const noMail = drop(/дублирование уведомления на почту/)
      ck('нет «почту не трогаем» — красный', only(g(noMail), 'почту не трогаем'), '1/true')
      ck('«не входит: почту не трогаем» без слова «уведомление» — зелёный (r3 run-1)', g(noMail.replace(/\n*$/, '\n') + '- [решено] не входит: почту не трогаем — решил: Ахмедова · L86\n').must.mailOut, true)
      ck('«бывшие — пишут на почту» в «не входит» — не про уведомления, красный (pilot, r1 run-1)', g(noMail.replace(/\n*$/, '\n') + '- [решено] не входит: бывшие сотрудники — пишут на почту, как сейчас — решил: Лебедева И. С. · L106\n').must.mailOut, false)
      ck('«уведомление только на портале, на почту не дублируем» — засчитано (r1 run-2)', g(noMail.replace(/уведомление на портале — и для/, 'уведомление только на портале, на почту не дублируем — и для')).must.mailOut, true)
      ck('«должность и дата приёма есть в системе» — засчитано (r1 run-2)', g(pts.replace('хранятся в кадровой учётной системе', 'уже есть в системе, из которой предлагают их брать')).must.zup, true)
    } else if (name === 'REW') {
      ck('REW: шума без сведений нет — запрет шума снят', fx.mustNot.some((m) => m.id === 'noise'), false)
      ck('переезд на шестой этаж без «Похоже, не про» — красный', sideCheck(parsePoints(add('- [сведение] Команду перевезли на шестой этаж, принтер там не работает — со слов Мартынова Р. Е. · L8')).items, fx, '', raz).red.length, 1)
      ck('«каждые десять минут» — пойман', g(add('- [решено] Повтор заведения — каждые 10 минут сутки — решил: Фомин Г. А. · L16')).mustNot.tenMin, true)
      ck('portal-dutty — код без опоры', has(g(add('- [решено] Алерт в portal-dutty — решил: Карпенко О. В. · L25')).form, 'portal-dutty'), true)
      ck('мессенджер «не входит» — законно', g(pts).mustNot.messenger, false)
    } else if (name === 'CHG') {
      ck('«год, … три года» — поймано', g(add('- [решено] Отклонённые хранятся год, отозванные — три года — решил: Соколова Е. В. · L47')).mustNot.retention1, true)
      ck('реализация «джобой раз в сутки» в списке — законна', g(add('- [сведение] Очистку делает джоба раз в сутки — со слов Кравца Д. О. · L33')).pass, true)
      // Живые строки r3 meet-chg run-1 (старый скилл): командировки в списке, вопроса «Похоже, не про …» не было.
      const R3 = [
        '- [сведение] Суточные сейчас считаются по ночам в гостинице — со слов Кравца Д. О. · L42',
        '- [решено] Суточные считаются по календарным дням командировки, включая день отъезда и день приезда — решил: Ершов А. С. · L42',
        '- [сведение] Исправление суточных будет до пятницы — со слов Кравца Д. О. · L46',
        '- [открыто] Нужен ли перерасчёт старых командировок — ждёт: бухгалтерия · L50',
      ]
      const withTrips = pts.replace(/\n*$/, '\n') + R3.join('\n') + '\n'
      const R3_ANSWER = 'Это один созвон, разобран целиком.\n\n**Решено**\n- Суточные считаются по календарным дням командировки. Решил: Ершов · L42\n\n**Что делаем дальше?**\n1. **Записать 11 пунктов** (рекомендую)\n2. **Поправить**'
      const SHOWN = 'Похоже, не про заявку на отпуск (4):\n1. Суточные сейчас по ночам в гостинице (суточные в командировках)\n2. Суточные по календарным дням командировки (суточные в командировках)\n3. Исправление суточных до пятницы (суточные в командировках)\n4. Перерасчёт старых командировок — ждёт бухгалтерию (суточные в командировках)\n\nВарианты: «Записать 11 пунктов» (рекомендую), «Записать без этих 4», «Поправить».'
      const itemsTrips = parsePoints(withTrips).items
      ck('r3 chg run-1: командировки в списке без вопроса — красный', sideCheck(itemsTrips, fx, sideShown(R3_ANSWER), raz).red.length, 1)
      ck('рукописная сводка «Похоже, не про …» с этими пунктами, все в списке — зелёный', sideCheck(itemsTrips, fx, sideShown(SHOWN), raz).red.length, 0)
      const without = sideCheck(parsePoints(pts).items, fx, sideShown(SHOWN), raz)
      ck('показаны, взяты «без этих 4», но нет в «Не вносим» — предупреждение', `${without.red.length}/${without.warn.length}`, '0/1')
      const razNotIn = raz.replace(/^## «Не вносим»\n/m, '## «Не вносим»\n\n#30 сведение · суточные\n   суть: суточные считаются по ночам в гостинице\n   цитаты: L42 10:03:52 Кравец: «Считаем по ночам в гостинице, а надо по календарным дням поездки.»\n')
      ck('показаны, не взяты и лежат в «Не вносим» — без предупреждения', sideCheck(parsePoints(pts).items, fx, sideShown(SHOWN), razNotIn).warn.length, 0)
      ck('вопрос темы в сводке «Похоже, не про …» не ловится', themeQuestion(SHOWN), null)
      // Шаг 2 (2026-10-16): задачу встречи спрашивают гипотезой — это не выбор темы.
      ck('«Встреча про: …? (L4)» и «Тема встречи — …?» — не вопрос темы', `${themeQuestion('Встреча про: приём посылок от частных людей на пунктах выдачи? (L4)\n1. Да (рекомендую)\n2. Поправить')}/${themeQuestion('Тема встречи — приём посылок от частных людей? (L4)\n1. Да\n2. Поправить')}`, 'null/null')
      ck('«Записать все 15 или без этих 4 по другой теме?» — не вопрос темы', themeQuestion(SHOWN + '\n\nЗаписать все 15 пунктов или без этих 4 по другой теме?'), null)
      ck('кондиционер — шум, красный', g(add('- [сведение] В переговорке гудит кондиционер — со слов Кравца Д. О. · L4')).mustNot.noise, true)
      // То же в песочнице: ответ без строки «Похоже» — красный, со строкой — зелёный.
      const sbx = mkdtempSync(join(tmpdir(), 'grade-meet-side-'))
      try {
        const put = (rel, text) => { mkdirSync(join(sbx, rel, '..'), { recursive: true }); writeFileSync(join(sbx, rel), text) }
        for (const [rel, src] of Object.entries(fx.seed)) put(rel, read(join(HERE, src)))
        put('docs/EMP-1207/meeting-2026-10-15.points.md', withTrips)
        put('docs/EMP-1207/meeting-2026-10-15.razbor.md', raz)
        put('answer-01.md', R3_ANSWER)
        const a = gradeRunPt(sbx, fx)
        ck('песочница: командировки без вопроса — красный по побочной теме', `${a.side.red.length}/${a.pass}`, '1/false')
        put('answer-01.md', SHOWN)
        const b = gradeRunPt(sbx, fx)
        ck('песочница: со строкой «Похоже, не про …» — побочное зелёное, вопроса темы нет', `${b.side.red.length}/${b.themeAsked.length}`, '0/0')
      } finally { rmSync(sbx, { recursive: true, force: true }) }
    } else if (name === 'CR') {
      const noNow = g(pts.replace(' вместо трёх календарных', ''))
      ck('«как сейчас» отдельным [сведение] — засчитано', `${noNow.must.sevenDays}/${noNow.must.nowThree}/${noNow.pass}`, 'true/true/true')
      ck('«как сейчас» нигде — красный', g(drop(/Сейчас обращение/).replace(' вместо трёх календарных', '')).must.nowThree, false)
      ck('ошибка «Переоткрыть» решением — поймана', g(add('- [решено] Кнопку «Переоткрыть» в мобильной версии чиним — решил: Ильин М. · L70')).mustNot.bugDecided, true)
      ck('«Переоткрыть» — не входит — законно', g(add('- [решено] не входит: ошибка кнопки «Переоткрыть» — заводится отдельно — решил: Ильин М. · L70')).pass, true)
    } else if (name === 'OUT') {
      ck('[решено] не входит — тоже [решено], красный', g(add('- [решено] не входит: посылки крупнее 15 кг — решил: Гаврилов О. П. · L44')).mustNot.decided, true)
      ck('[открыто] не входит ли — не [решено]', g(add('- [открыто] не входит ли приём посылок крупнее 15 кг — ждёт: — · L44')).mustNot.decided, false)
      ck('две сведения — красный', g(pts.split('\n').filter((l) => !/^- \[сведение\]/.test(l)).join('\n') + '\n- [сведение] Один оператор — со слов Гаврилова О. П. · L8\n- [сведение] Лента 58 мм — со слов Гаврилова О. П. · L38\n').pass, false)
      ck('открытые только с «ждёт: —» — красный', g(pts.replace(/ждёт: Тихонова А\., региональный управляющий/, 'ждёт: —').replace(/ждёт: техподдержка точек/, 'ждёт: —')).pass, false)
      ck('нет вопроса про наклейку — предупреждение', has(g(drop(/наклейку крупнее/)).warn, 'наклейк'), true)
      // Полнота сведений.
      ck('эталон: сведений 17 из 17', `${e.facts.covered.length}/${e.facts.lost.length}`, '17/0')
      // r1 run-1: выкинуты L7–L16 и L50–L64 — остаётся 7 из 17, четыре критичных потеряны.
      const half = g(drop(/· L(8|10|14|51|54|57|62|64)\s*$/))
      ck('потеряна половина созвона (как r1 run-1) — красный', `${half.facts.covered.length}/${has(half.missing, 'критичные')}/${has(half.missing, 'из 17')}/${half.pass}`, '7/true/true/false')
      ck('потерян один критичный факт (пломба и акт) — красный при 16 из 17', only(g(drop(/пломбируют/)), 'критичные'), '1/true')
      const three = g(drop(/· L(54|62|64)\s*$/))
      ck('потеряны три некритичных — 14 из 17, зелёный с предупреждением', `${three.facts.covered.length}/${three.pass}/${has(three.warn, 'нет сведений')}`, '14/true/true')
      ck('четыре некритичных — 13 из 17, красный', only(g(drop(/· L(33|54|62|64)\s*$/)), 'из 17'), '1/true')
      const words = g(pts.replace('Смена — 12 часов, с 9 до 21', 'Смена двенадцать часов, с девяти до девяти').replace('Возвратов 20–30 в день', 'Возвратов двадцать–тридцать в день'))
      ck('числа словами («двенадцать часов», «двадцать–тридцать») — засчитаны', `${words.facts.covered.length}`, '17')
      // Вопрос темы — формулировки круга 1 и законные утверждения.
      const TQ = [
        ['На встрече две темы. Какую разбираем?\n\n1. Отпуска\n2. Суточные', true],
        ['Встреча разобрана по темам. Выберите, какую из них разбирать дальше.\n\n1. Автозакрытие', true],
        ['На встрече две темы, и по каждой есть решения или сведения. Выбрать нужно одну.', true],
        ['**Разбираем «Приём возвратов» со всеми тремя темами вместе, одним списком?**\n- Да, все три вместе\n- Только тема 1.', true],
        ['Есть и другие темы.\n\nРазбираем тему 1?', true],
        ['Какую из тем дописать?', true],
        ['Какой предмет разбираем первым?', true],
        ['Тема одна: HRS-311, заказ справок. Остальное — связь и оборудование, в выбор не идёт.', false],
        ['Тема «переезд, принтер, демо» без решений в выбор не шла.', false],
        ['Вторую тему, суточные в командировках, не разбирал: выбран был ключ EMP-1207.', false],
        ['Как назвать тему записи? Предлагаю «отмена записи».', false],
        ['Как называлась встреча, какая тема стояла в приглашении?', false],
        ['Выберите один вариант: «Записать 26 пунктов» или «Поправить».', false],
        ['На встрече: фоновая задача повторяет вызов. Оставляем? Варианты: «Оставляем», «В открытые вопросы», «Не вносим».', false],
        ['Тема одна. Какую цель берём, и верны ли роли?', false],
        ['Темы с решениями:\n1. Пропуска\n2. Отчёт\n\nКакую разбираем — 1, 2 или 3?', true],
      ]
      for (const [text, want] of TQ) ck(`вопрос темы ${want ? 'пойман' : 'не пойман'}: «${text.split('\n')[0].slice(0, 50)}»`, !!themeQuestion(text), want)
    }
  }
  console.log(bad === 0 ? '\nсамопроверка (список): ok' : `\nсамопроверка (список): ПРОВАЛОВ ${bad}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ---------- прогон ----------

// Импорт из другого оценщика (grade-ni.mjs) не должен запускать прогон.
const IS_MAIN = !!process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1])
const ARGS = process.argv.slice(2)
const POINTS = ARGS.includes('--points')
if (IS_MAIN && ARGS.includes('--selftest')) POINTS ? selftestPoints() : selftest()
if (IS_MAIN && POINTS) mainPoints()
else if (IS_MAIN) {
  const arg = process.argv[2]
  const fxName = process.argv[process.argv.indexOf('--fx') + 1]
  const fx = FX[fxName]
  if (!arg || !existsSync(arg) || !fx) { console.error('usage: node grade-meet.mjs <каталог с песочницами> [--points] --fx VAC|ACC|LONG|NEW|REW|CHG|CR|OUT | --selftest [--points]'); process.exit(1) }
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
      r.razbor && r.razbor.quotes < r.razbor.minQuotes && `В РАЗБОРЕ МЕНЬШЕ ${r.razbor.minQuotes} ЦИТАТ`,
      !r.dateOk && `ДАТА В ИМЕНАХ ФАЙЛОВ НЕ ${fx.fileDate}: ${r.inputPath || '—'}`,
      r.razbor && !r.razbor.heading && 'В РАЗБОРЕ НЕТ РАЗДЕЛА «Во вход»',
    ].filter(Boolean)
    const warns = [
      r.razbor && r.razbor.heading && !r.razbor.layout && 'разбор не по форме output.md: «Во вход» — подраздел, записи отдельно',
      r.razbor && r.razbor.moved.length && `номер строки не тот у ${r.razbor.moved.length}: ${r.razbor.moved.join('; ')}`,
      r.razbor && r.razbor.lostWarn.length && 'в журнале нет: ' + r.razbor.lostWarn.join('; '),
    ].filter(Boolean)
    console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  · ${notes.join(' · ')}${warns.length ? '\n         предупреждения: ' + warns.join(' · ') : ''}`)
  }
  console.log(`\n  ${green}/${measured}\tзелёных — вход по анкерам expected.md, цитаты разбора сходятся, документ задачи не тронут  ← КРИТЕРИЙ\n`)
}

function mainPoints () {
  const fxName = ARGS[ARGS.indexOf('--fx') + 1]
  const arg = ARGS.find((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--fx')
  const fx = ptFx(fxName)
  if (!arg || !existsSync(arg) || !fx) { console.error('usage: node grade-meet.mjs <каталог с песочницами> --points --fx VAC|ACC|LONG|NEW|REW|CHG|CR|OUT'); process.exit(1) }
  const runs = readdirSync(arg).filter((n) => /^run-\d+$/.test(n) && statSync(join(arg, n)).isDirectory()).sort()
  console.log(`\nпроба meet-${fxName.toLowerCase()} (список), ${arg}`)
  let measured = 0; let green = 0
  const SETTINGS = join(arg, '_settings.txt')
  const CAP = existsSync(SETTINGS) ? Number((read(SETTINGS).match(/потолок ходов: (\d+)/) || [])[1] || 0) : 0
  for (const n of runs) {
    const dir = join(arg, n)
    const ans = existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : ''
    if (existsSync(join(dir, '_api-failure.txt')) || existsSync(join(dir, '_api-failure-turn.txt')) || !ans.trim() || RE_API_FAILURE.test(ans.slice(0, 300))) { console.log(`  ${n}: НЕ ИЗМЕРЕНО`); continue }
    measured++
    const r = gradeRunPt(dir, fx)
    if (r.pass) green++
    const turns = readdirSync(dir).filter((f) => /^answer-\d+\.md$/.test(f)).length || 1
    const capHit = !r.listPath && CAP > 0 && turns >= CAP
    const stopped = /разбор не состоялся/i.test(ans)
    const L = r.list
    const R = r.razbor
    const notes = [
      `ходов: ${turns}, субагентов: ${r.agents}`,
      capHit && `УПЁРСЯ В ПОТОЛОК ${CAP} ХОДОВ — читать answer-*.md`,
      stopped && 'В ДИАЛОГЕ «разбор не состоялся» — читать answer-*.md',
      r.forbiddenReads.length && 'ЧИТАЛ services/ ИЛИ context/: ' + r.forbiddenReads.join('; '),
      r.lists !== 1 && (r.lists ? `СПИСКОВ ${r.lists}` : 'списка нет'),
      r.razbors !== 1 && (r.razbors ? `РАЗБОРОВ ${r.razbors}` : 'разбора нет'),
      r.extra.length && 'ЛИШНИЕ ФАЙЛЫ: ' + r.extra.join(', '),
      r.touched.length && 'ЗАСЕВ ТРОНУТ: ' + r.touched.join(', '),
      L && `пунктов: ${L.items.length}`,
      L && L.form.length && 'ФОРМА: ' + L.form.join('; '),
      L && L.missing.length && 'нет: ' + L.missing.join('; '),
      L && L.violations.length && 'НАРУШЕНО: ' + L.violations.join('; '),
      R && R.bad.length && 'ВЫДУМАННЫЕ ЦИТАТЫ: ' + R.bad.join('; '),
      R && R.lost.length && 'в разборе потеряно: ' + R.lost.join('; '),
      R && `цитат: ${R.quotes}`,
      R && R.quotes < R.minQuotes && `В РАЗБОРЕ МЕНЬШЕ ${R.minQuotes} ЦИТАТ`,
      R && !R.heading && 'В РАЗБОРЕ НЕТ РАЗДЕЛА «В список»',
      R && fx.bareRed && R.bare.length && `строк «цитаты:» без текста: ${R.bare.length}`,
      !r.dateOk && `ДАТА В ИМЕНАХ ФАЙЛОВ НЕ ${fx.fileDate}: ${r.listPath || '—'}`,
      r.keyAsked && 'СПРОШЕН КЛЮЧ ЗАДАЧИ',
      r.themeAsked.length && 'СПРОШЕНА ТЕМА: ' + r.themeAsked.map((x) => `ход ${x.n} «${x.q.slice(0, 70)}»`).join('; '),
      r.side.red.length && 'ПОБОЧНОЕ БЕЗ ВОПРОСА: ' + r.side.red.join('; '),
      r.side.falseMark.length && `ЛОЖНАЯ ПОМЕТКА «не про тему» (${r.side.falseMark.length}): ` + r.side.falseMark.map((t) => `«${t}»`).join('; '),
      r.side.shown.length && `показано «Похоже, не про …»: ${r.side.shown.join(', ')}`,
      L && fx.facts.length && `сведений: ${L.facts.covered.length}/${fx.facts.length}`,
      r.stops.length && `ход ${r.stops.join(', ')}: стоп на «решений нет» без записи и без вопроса`,
    ].filter(Boolean)
    const warns = [
      ...(L ? L.warn : []),
      R && R.heading && !R.layout && 'разбор не по форме output.md: «В список» — подраздел',
      R && R.unmarked.length && `пунктов без записи «в список: п.<N>»: ${R.unmarked.join(', ')}`,
      R && R.strayMarks.length && `пометки на несуществующие пункты: ${R.strayMarks.join(', ')}`,
      R && !fx.bareRed && R.bare.length && `строк «цитаты:» без текста: ${R.bare.length}`,
      R && R.moved.length && `номер строки не тот у ${R.moved.length}: ${R.moved.join('; ')}`,
      R && R.lostWarn.length && 'в журнале нет: ' + R.lostWarn.join('; '),
      ...r.side.warn,
      !r.sameBase && `имена списка и разбора разные: ${r.listPath} / ${r.razborPath}`,
    ].filter(Boolean)
    console.log(`  ${n}: ${r.pass ? 'зелёный' : 'красный'}  · ${notes.join(' · ')}${warns.length ? '\n         предупреждения: ' + warns.join(' · ') : ''}`)
  }
  console.log(`\n  ${green}/${measured}\tзелёных — список по форме и анкерам expected.md, цитаты разбора сходятся, засев не тронут  ← КРИТЕРИЙ\n`)
}
