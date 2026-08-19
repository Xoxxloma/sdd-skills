Твоя рабочая директория — `WORKDIR` (названа в конце). В ней лежит `services/` — репозиторий со
спеками.

Ты исполняешь скилл `service-map`. Его файлы:

- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\SKILL.md` — прочитай целиком и делай ровно то, что он говорит;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\card.template.md`;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\manifest.example.yaml`.

**Аргумент запуска:** `shipping`.

**Папка сервиса `../shipping-api` существует и доступна** — ветку «путь из манифеста не
существует» не применяй.

**Субагентов в этом прогоне нет: инструмент Agent не запускай ни разу.** Вместо запуска
сканирующего субагента сделай две вещи:

1. Запиши промпт, который ты бы ему передал, **целиком и дословно, ровно в том виде, в каком он
   ушёл бы субагенту**, в файл `subagent-prompt.txt` в своей рабочей директории. Ничего не
   сокращай и не заменяй многоточиями: это и есть предмет замера.
2. Считай, что субагент вернул содержимое файла
   `C:\Users\Konstantin\AppData\Local\Temp\claude\C--Users-Konstantin-projects-product-skills\795b70a7-5541-400a-8ece-1fd4f6d398e3\scratchpad\run31\stand\handoff\b2.md`, и доведи прогон до конца по скиллу.

Ничего, кроме названных файлов и файлов в своей рабочей директории, не читай и не пиши.

В конце выведи отчёт, которого требует скилл.
