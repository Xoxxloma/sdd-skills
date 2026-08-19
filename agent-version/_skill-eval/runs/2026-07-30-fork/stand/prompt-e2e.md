Твоя рабочая директория — `WORKDIR` (названа в конце). В ней лежит `services/` — репозиторий со
спеками. Соседние репозитории сервисов лежат на уровень выше, рядом с ней.

Ты исполняешь скилл `service-map`. Его файлы:

- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\SKILL.md` — прочитай целиком и делай ровно то, что он говорит;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\card.template.md`;
- `C:\Users\Konstantin\projects\product-skills\agent-version-3.1\service-map\reference\manifest.example.yaml`.

**Аргумент запуска:** `shipping`.

Субагентов запускай как велит скилл — инструментом Agent, модель `haiku`. Свою рабочую директорию
субагенту передавай абсолютным путём.

Ничего вне своей рабочей директории и соседних папок сервисов не читай и не пиши, кроме файлов
скилла выше.

**Веди журнал `actions.log` в рабочей директории:** каждое действие строкой в момент совершения —
запуск субагента, каждая проверка, гард, запись файла, Шаг 5, отчёт.

В конце выведи отчёт, которого требует скилл.
