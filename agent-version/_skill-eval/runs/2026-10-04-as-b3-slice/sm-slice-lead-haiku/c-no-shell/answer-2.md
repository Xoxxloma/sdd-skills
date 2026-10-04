## Разбор

Вес сервиса = 118 (контракт) + 37 (сущности) + 5 (задачи) = **160** > K=80 → требуется нарезка на части (Шаг 3.5). Однако командной строки нет: Bash и PowerShell запрещены окружением, скрипты `plan.sh`/`assemble.sh` запустить нельзя. По правилу 3.5: "Её нет ни у тебя, ни у субагента — нарезки нет: склеить части нечем. Читай одним субагентом по 3.2–3.4 и назови в отчёте «сервис крупнее K, нарезка без командной строки невозможна»". Применяю это правило ровно.

## Действия

ДЕЙСТВИЕ: Запустить читающего субагента скилла `service-map` одним вызовом с брифом из SKILL.md и подстановками для `greenhouse-sensors`.

Вызов (дословно по 3.3):
```
Вызов читающего субагента скилла `service-map`. Твой бриф — в файле `C:\Users\Konstantin\projects\product-skills\service-map\SKILL.md`:
блок от строки, которая начинается словами «Ты — читающий субагент скилла», до строки, которая
начинается словами «Ни чисел, ни пересказа», включительно. Найди обе строки `Grep` с `-n`,
прочитай блок `Read` с offset и limit и выполняй его дословно, с подстановками:
<пути> = C:\Users\Konstantin\projects\product-skills\agent-version\_skill-eval\runs\2026-10-04-as-b3-slice\sm-slice-lead-haiku\greenhouse-sensors;
<type> = backend;
<имена> = greenhouse-sensors;
<шаблон> = C:\Users\Konstantin\projects\product-skills\service-map\reference\card.template.md;
<прежняя> = C:\Users\Konstantin\projects\product-skills\service-map\services\greenhouse-sensors.md (нет — абзац «Прежняя карточка» пропусти);
<notes> = (нет — абзац про заметки пропусти);
<дата> = 2026-10-04;
<маркеры> = контракт не меньше 118, сущностей не меньше 37, задач не меньше 5;
<опись> = C:\Users\Konstantin\projects\product-skills\service-map\services\.work\greenhouse-sensors.opis.md;
<черновик> = C:\Users\Konstantin\projects\product-skills\service-map\services\.work\greenhouse-sensors.md.
```

## Отчёт

ОТЧЁТ: сервис крупнее K=80 (вес 160); нарезка без командной строки невозможна.

## Решение

РЕШЕНИЕ: ОДИН ЧИТАЮЩИЙ