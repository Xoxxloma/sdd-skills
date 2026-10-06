# Продолжение service-map-2.0

Полная область плана сохранена. Прежняя серия и три подтверждённых красных круга не перезаписываются. Новая серия разрешена возобновлением цели владельцем; ошибки измерения не расходуют её лимит.

Исправлена подготовка файла-сторожа в SM-SPLIT. Грейдер отделяет предварительные лексические совпадения от полного поключевого смыслового аудита с цитатами и хешами: без аудита итог неизмерен. Проверки грейдера 40/40.

Добавлены проверка переноса после каждого блока и кандидаты потери явных HTTP-кодов в непустом блоке. Это ограниченный детектор, не доказательство полной сохранности фактов. Кандидаты проверяет читающий в существующем бюджете; тесты 15/15.

Дальше: независимая тройка SM-FACTS и смысловой аудит; реализация остальных этапов остаётся необходимой.

Новая тройка SM-FACTS завершена с одним штатным добором на каждую пробу; первые файлы сохранены как first-card.md/first-opis.md. Круг 1 красный по отсутствующей действующей операции изменения адреса в пробе 1 после двух попыток, проверено вручную на точных исходниках пробы. Лексические оценки остальных проб не заменяют смыслового аудита.

SM-SPLIT после исправления подготовки: 543 проверки, 510 ok, ошибок 0, 8 неоднозначностей, 2 не измерены, 23 справочных. Направленные проверки 19/19, семантические 13/13.

Начат этап 5: contracts.sh/contracts.mjs независимо извлекают корневые SDL-операции, RPC в service-блоках и OpenAPI JSON, учитывают локальные ссылки и серверные префиксы, дают семиколоночную диагностику. Проверки 26/26. YAML, включение в основную волну и SM-MONO-SPEC пока не выполнены.

Продолжение: сборщик теперь поддерживает ограниченный профиль YAML, сравнение всех первичных
частей и остатка до головы, CHECK_DECLARATIONS объединяет независимую диагностику с полным
отчётом check.sh. Скриптовая матрица 35/35. Модельная SM-MONO-SPEC не выполнена. Подстановки
одиночного и частей явно передают объявления и префикс; исключения подтверждаются по подключениям.

Этап 6: реализованы refill.sh/refill.mjs и refill.md, подключён явный вход «Дочитать». Пакеты до
25 ключей, не больше четырёх, приоритет изменяющим; остаток сохраняется. Применяются только
существующие однозначные ключи с подтверждением автора, цитатой и хешем реального источника
в разрешённой репе. Сначала копия и проверки; незадетые блоки, заметки и scanned защищены
побайтовой сверкой. Ограничения обновляются частично; сбой позднего пакета сохраняет принятые.
29/29 скриптовых проверок. Это механика, а не измеренное качество чтения.

Грейдер быстрого обновления больше не оценивает сохранность процентом совпавших длинных строк:
сравнивает все незадетые блоки и остальной текст. Факты и трасса требуют отдельных подробных
аудитов с хешами. Без входов/аудита результат не измерен; слово Write в тексте — лишь кандидат,
с подтверждённой записью рабочей карточки его не смешиваем. 26/26 проверок грейдера.

Обнаружены два ошибочных ожидания эталона SM-FACTS: HTTP 400/409 для GraphQL с неизвестным
адаптером. Эталон исправлен на подтверждённые доменные ошибки HOLD_REASON/NOT_HELD; прежний
эталон сохранён в measurement-fixes/sm-facts-before-graphql-domain.json. Это дефект измерения,
не новый красный круг. Подтверждённый пропуск REST-операции в новой серии этим не затронут.
Грейдер фактов 42/42, кандидаты переноса 17/17. Прежние аудиты с другим хешем эталона не
выдаются за проверку новой редакции.

Подготовлена SM-REFILL: 124 ключа в четырёх явно подключённых семействах; человек выбирает
24 операции с 43 независимыми фактами. 77 файлов исходников; инфраструктура не исполняется.
Эталон не передаётся читающим; источники в диагностике не подсказаны. Модельные тройки,
полный смысловой аудит, K и общая финальная матрица всё ещё необходимы. Счётчик новой серии
SM-FACTS остаётся 1; общий регресс не зелёный, цель активна, установка не выполнена.


2026-10-06: после обсуждения с владельцем отдельный скрипт дозаполнения исключён из рабочего
скилла. Дочитывание выполняет агент через Edit на подготовленной копии; ведущий использует
существующие check.sh, quality.sh и promote.sh. JSON с ручными хешами/цитатами больше не требуется.
Эксперимент сохранён в `../../experiments/refill-script/` относительно этой папки запуска.

Историческая тройка refill-round-1 завершена: проба 2 применила 24 блока; пробы 1 и 3 отклонены
проверкой цитат (потерянные кавычки / несмежные строки). Эти отказы не считаются красным кругом
потери фактов; исходные карточки отклонённых проб сохранены. Полный смысловой аудит не завершён.
Пробы архивного протокола не принимают новый режим агентских правок; нужна новая тройка на
одном снимке с независимой проверкой фактов и всей незатронутой области. Общий регресс не зелёный.

Уточнение владельца: другие скиллы не менять. Отменены только добавленные абзацы в business-requirements-doc и technical-spec-doc; git diff обоих файлов пуст. План теперь допускает только проверку совместимости карточки с неизменными потребителями. Склейка: 15/15, старый TSV конфликтов очищается при чистой сборке; кандидаты попадают в check/quality. Новая тройка дочитывания агентом завершила первое чтение, полный аудит и возможный добор ещё не выполнены.

SM-REFILL-agent, круг 1: после штатного добора факты 42/43, 43/43, 42/43; источник проверен отдельно, выдумок 0. Пробы 1 и 2 прошли сохранность, partial quality/check и продвижение. Проба 3 не продвинута: потеряны строки сущности у двух выбранных GraphQL ключей и одна завершающая пустая строка нетронутого блока; рабочая карточка сохранена. Red-decision привязан к реальным байтам, это отказ по контракту сохранности, не ошибка грейдера и не потеря бизнес-фактов. Новый счётчик sm-refill-agent=1, sm-facts=1. Добавлены общие правила раздельной проверки обязательности результата/полей и повторной сверки после последнего Edit; новая редакция ещё не проверена поведением. Требование языковой переносимости закреплено в плане: успех JS-фикстуры недостаточен; других скиллов не меняем. Грейдер фактов 46/46; directed 19/19, semantic 13/13, transfer 17/17 после интеграции TSV конфликтов.

### 2026-10-06T07:56:44.550Z: Python/Go holdout first reading

Existing analytic Python and Go fixtures were copied unchanged. Trial 1 source sets (20 Python files, 7 Go files) and both original cards match the frozen baseline. Independent preservation review found changed selected entity metadata and removal of the protected final newline; own inventories contain precise predicates that were generalized in card text. First outputs and first-check.json were preserved before a single dobor. The second author call is running; no final verdict or skill red-round increment. Trials 2 and 3 have not started. This is selected-block behavior, not proof of complete language/framework support.

### 2026-10-06T08:11:20.026Z: Holdout complete and explicit cross-section checks

Python/Go round 1 used three Luna medium authors, each with exactly two calls. All six original cards and all 20+7 source files per trial remain unchanged. Python facts: 8/9, 8/9, 9/9; Go: 6/6 in all trials. Direction of ascending slot sorting was lost in Python trials 1 and 2; trial 2 changed the unselected final block through EOF normalization in both cards after final dobor. The red decision is bound to exact candidate/oracle SHAs and source-set verification. No third author call or manual repair was used. This is selected-block transfer, not complete language/framework support.

Added check-links.awk behind CHECK_CROSS_SECTIONS=1 for complete cards, routed from SKILL.md. Explicit entity output/aggregate references and role references produce source-review candidates through CHECK_REPORT/CHECK_LISTS and persisted quality warnings. Exact names are used without programming-language suffix assumptions; foreign responses and unknown links are preserved. Unsupported complex/prose references and semantic event/message matching remain review work. New checks 13/13; assembly 15/15; directed 19/19; semantic 13/13; transfer 17/17; fact grader 46/46. Latest instructions now explicitly preserve sort direction and early-return order, constrain Edit boundaries, and allow selected unknown placeholders to be clarified from confirmed sources. These latest instructions have no new behavioral acceptance yet. Other skills/original service-map diffs are empty; refill runtime scripts remain absent.

### 2026-10-06T08:13:06.675Z: Holdout round 2 launched

Three cold Luna medium readers started with the latest frozen skill snapshot. Source files, original cards and the hidden oracle are byte-identical to round 1. The prompt permits clarifying a selected unknown link from confirmed source; it still requires preserving confirmed facts and all unselected bytes. No expected answers, previous findings or history were sent. All three exact handles were verified running. Round 1 remains immutable except the clarified textual scope in red-decision.json; its fact and EOF evidence is preserved.

### 2026-10-06T08:22:27.732Z: Corrected EOF attribution

A controlled tools.apply_patch call changed only an interior fact line but normalized the untouched final block from two LF to one LF. Before/after and the exact patch were archived under measurement-fixes/apply-patch-eof-2026-10-06. Earlier attribution of matching lone EOF changes to the skill was incorrect. Raw probe outputs and decisions remain preserved; the correction supersedes their EOF-as-skill-failure component. These effects do not spend red rounds. Exact preservation is not accepted until the editor behavior is accounted for. Independent missing Python sort directions keep language round 1 red; removed metadata rows keep refill agent round 1 red. No card/source was repaired to create green acceptance.

### 2026-10-06T08:29:09.367Z: Language round 2 reviewed; full fact round 2 running

Language authors exhausted exactly two calls each. Final Python fact coverage 9/9,8/9,9/9; Go6/6 in all trials. Python trial2 additionally falsely reports provided list_for_clinic implementation as absent; raw appointments_service.py was re-read to confirm the contradiction. The exact SQL direction was explicitly treated as unspecified despite its standard default; this is semantic review, not an ASC regex requirement. Round 2 red evidence is bound to the candidate/oracle SHAs and does not rely on EOF. In-memory counterfactual review isolated lone editor EOF effects in trials1/3; no output file was repaired, no copy promoted, no exact-byte acceptance claimed. Trial2 terminal outputs preserve outside bytes.

Added a generic read-facts clarification: a missing lower adapter does not erase known visible expression/type/default semantics, and the actual missing call must be named separately from available forwarding methods. Prepared fresh full SM-FACTS round2 with31keys/53facts, date2026-10-06, complete20-file skill snapshot, frozen oracle and identical19-file source sets. Existing prepare-sm-facts.mjs now takes an explicit date and records all snapshot/oracle hashes and two-call budget. Three cold Luna medium readers are running. One retired task-name collision started no author call and spent no red round. K, summaries, declarations, keyed update, consumers and same-revision final regression remain outstanding.
