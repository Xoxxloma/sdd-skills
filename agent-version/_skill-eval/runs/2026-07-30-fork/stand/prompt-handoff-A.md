Твоя рабочая директория — `WORKDIR` (названа в конце). В ней лежит `services/` — репозиторий со
спеками.

Ты исполняешь скилл `service-map`. Его файлы:

- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\SKILL.md` — прочитай целиком и делай ровно то, что он говорит;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\card.template.md`;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\manifest.example.yaml`.

**Аргумент запуска:** `shipping`.

**Папка сервиса `../shipping-api` существует и доступна** — ветку «путь из манифеста не
существует» не применяй.

**Субагентов в этом прогоне нет: инструмент Agent не запускай ни разу.** Вместо каждого запуска
сканирующего субагента по сервису `shipping` считай, что он вернул готовый текст:

- первый запуск → содержимое файла `C:\Users\Konstantin\AppData\Local\Temp\claude\C--Users-Konstantin-projects-product-skills\795b70a7-5541-400a-8ece-1fd4f6d398e3\scratchpad\run31\stand\handoff\a1.md`
- второй запуск → содержимое файла `C:\Users\Konstantin\AppData\Local\Temp\claude\C--Users-Konstantin-projects-product-skills\795b70a7-5541-400a-8ece-1fd4f6d398e3\scratchpad\run31\stand\handoff\a2.md`
- третий и любой следующий → **пустой ответ** (субагент вернул пустоту)

Ничего, кроме названных файлов и файлов в своей рабочей директории, не читай и не пиши.

**Веди журнал `actions.log` в рабочей директории.** Каждое своё действие дописывай туда строкой
в момент совершения, в формате `N. что делаю`: каждый запуск субагента (и каким промптом — тем же
дословно или с добавкой, и какой именно), каждую проверку, гард, запись файла, Шаг 5, отчёт.
Журнал нужен, чтобы был виден порядок действий.

В конце выведи отчёт, которого требует скилл. Ничего сверх него выводить не надо: результат
грейдится по файлам на диске.
