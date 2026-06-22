<!-- EARS REQUIREMENTS — atomic, each verifiable by one or two tests. Cover MANDATORY:
     happy path, loading, empty result, error, boundary values, keyboard/focus for interactive UI.
     Tag every requirement [поведенческое] (testable in a hook/function) or [визуальное] (checked
     by eye) — the plan needs this for its "проверка" column. Keywords:
       СИСТЕМА ДОЛЖНА            — always
       ПОКА … СИСТЕМА ДОЛЖНА     — state
       КОГДА … СИСТЕМА ДОЛЖНА    — event
       ЕСЛИ … ТО СИСТЕМА ДОЛЖНА  — unwanted condition
     Add 2–3 Given/When/Then acceptance examples for the riskiest R (races, errors, debounce).
     This is the spec layer: implementation detail (files, components) lives in plan.md, not here.
     Remove this comment when filling in. -->

---
id: F-N
source: feature.md
services: [<service names from system/manifest.yaml, or as resolved without a manifest>]
---

# F-N — Требования (EARS)

## Требования

- **R-1** [поведенческое] — СИСТЕМА ДОЛЖНА <наблюдаемое поведение нормального пути>.
- **R-2** [поведенческое] — ПОКА <условие/состояние> СИСТЕМА ДОЛЖНА <что делает>.
- **R-3** [поведенческое] — КОГДА <событие> СИСТЕМА ДОЛЖНА <реакция>.
- **R-4** [поведенческое] — ЕСЛИ <нежелательное условие> ТО СИСТЕМА ДОЛЖНА <как обрабатывает>.
- **R-5** [поведенческое] — ПОКА идёт загрузка СИСТЕМА ДОЛЖНА <состояние загрузки>.
- **R-6** [поведенческое] — ЕСЛИ результат пуст ТО СИСТЕМА ДОЛЖНА <пустое состояние>.
- **R-7** [поведенческое] — ЕСЛИ запрос завершился ошибкой ТО СИСТЕМА ДОЛЖНА <обработка ошибки>.
- **R-8** [поведенческое] — КОГДА <граничное значение> СИСТЕМА ДОЛЖНА <поведение на границе>.
- **R-9** [поведенческое] — КОГДА фокус на <элементе> и нажата <клавиша> СИСТЕМА ДОЛЖНА <навигация/действие>.
- **R-10** [визуальное] — СИСТЕМА ДОЛЖНА <как выглядит/что отрисовано> (проверяется глазами).

<!-- Нумеруй R-1, R-2, … подряд; одно требование — один проверяемый факт. -->

## Примеры приёмки (Дано / Когда / Тогда)

<!-- 2–3 примера на самые рискованные R: гонки, ошибки, дебаунс и т.п. -->

### Пример A — R-<n>
- **Дано** <исходное состояние>
- **Когда** <действие/событие>
- **Тогда** <ожидаемый наблюдаемый результат>
