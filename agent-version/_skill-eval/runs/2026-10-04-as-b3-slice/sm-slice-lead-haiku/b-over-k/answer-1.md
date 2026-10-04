## Разбор

Вес сервиса = контракт 96 + сущности 41 + задачи 6 + 0.5 × топики 9 = 143 + 4.5 = **147.5 > K=80**. По правилу 3.5, сервис крупный; читать его должны части, не один субагент. Порядок: счётчик → plan.sh → проверка сверки → читающие по частям и остаток → голова → склейка.

## Действия

ДЕЙСТВИЕ: Запустить счётчика субагента с брифом из 3.1; маркеры разведчика (четыре строки), пути сервиса `C:\Users\Konstantin\projects\product-skills\agent-version\_skill-eval\runs\2026-10-04-as-b3-slice\sm-slice-lead-haiku\ferry-booking`, результат в `C:\Users\Konstantin\projects\product-skills\agent-version\services\.work\ferry-booking\counts.txt`; ответ одной строкой `счёт: <counts>; итог: контракт N, сущности M, задачи K`

ДЕЙСТВИЕ: После счётчика запустить `bash <reference-path>/plan.sh "C:\Users\Konstantin\projects\product-skills\agent-version\services\.work\ferry-booking\counts.txt" 80 0.5 "C:\Users\Konstantin\projects\product-skills\agent-version\_skill-eval\runs\2026-10-04-as-b3-slice\sm-slice-lead-haiku\ferry-booking"` и вывести все строки плана (первая строка — итог, дальше план частей либо «нарезка не нужна»)

ДЕЙСТВИЕ: Сверить итоги из ответа счётчика с первой строкой вывода plan.sh по каждому классу (`ключ` и `ориентир`); если разошлись — назвать какой класс и числа

ДЕЙСТВИЕ: После проверки сверки — если plan.sh дал план нарезки (а не «не нужна»): запустить читающих субагентов параллельно по частям и остатку (не больше 6 одновременно) по 3.5

## Отчёт

ОТЧЁТ: ferry-booking: вес ≈148 > K=80 → нарезка на части

РЕШЕНИЕ: НАРЕЗКА