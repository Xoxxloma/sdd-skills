---
name: vision-to-backlog
description: Use after a vision audit to feed strategic opportunities into the improvement backlog — converts each vetted OPP-NNN from vision-audit.md into an IMP item in the existing backlog, continuing the IMP numbering and citing the originating opportunity, so strategic gaps flow into the same requirement pipeline as tactical improvements. Bridge stage of the product-skills pipeline; reads product/vision/vision-audit.md and product/system, appends to product/backlog/improvements.md.
version: 1.0.0
user-invocable: true
argument-hint: "[workspace-path] [--priority high|med|low]"
---

Тонкий **мост** из стратегического аудита в общий бэклог: переносит выжившие возможности `OPP-NNN` из `vision-audit.md` в `product/backlog/improvements.md` как обычные `IMP-NNN`. Так стратегические разрывы (сверху вниз) попадают в **тот же** конвейер требований, что и тактические улучшения от `propose-improvements` (снизу вверх). **Не плодит параллельный бэклог/roadmap** — `improvements.md` остаётся единственным бэклогом.

## Inputs / outputs
- Читает: `product/vision/vision-audit.md` — список `OPP-NNN` (если файла нет → стоп: «сначала `/vision-audit`»).
- Читает: `product/backlog/improvements.md` — чтобы узнать текущий max IMP (может ещё не существовать).
- Читает: `product/system/services/*.md` + `system-map.md` — чтобы аккуратно заполнить `Service(s)` и `Evidence` каждого IMP.
- Пишет: `product/backlog/improvements.md` — **дозаписывает** новые IMP в **точном формате `propose-improvements`** (см. ниже) и перестраивает верхнюю priority-таблицу.
- Пишет (только эта правка): таблицу `OPP → IMP` в `product/vision/vision-audit.md`.
- Read-only на исходники сервисов; пишет только в `product/`.

## Procedure
1. **Загрузить возможности.** Прочитать `OPP-NNN` из `vision-audit.md`. Брать только **выжившие** (не из раздела SKIPPED). Если задан `--priority` — отфильтровать по нему.
2. **Идемпотентность.** Прочитать таблицу `OPP → IMP` в `vision-audit.md`: уже сопоставленные OPP **пропустить** (не дублировать). Прочитать `improvements.md`, найти текущий **max IMP-NNN**.
3. **Собрать поля** для каждой переносимой OPP (из её карточки + карточек сервисов): `What` (конкретное изменение), `Why` (ценность/исход + стратегическая рамка), `Service(s)`, `Size` (S|M; если эпик — пометить «epic — split before requirement»), `Risk` (low|med), `Impact` (low|med|high из приоритета OPP).
4. **Сформировать блок IMP** в формате, идентичном `propose-improvements` (continue-from-max нумерация, **никогда не перенумеровывать** существующие):
   ```
   ### IMP-NNN — <короткий заголовок>
   - **Lens:** strategy
   - **Service(s):** <имена>
   - **What:** 1-2 предложения — конкретное изменение.
   - **Why:** ценность / какой исход приближает.
   - **Evidence:** vision-audit.md OPP-NNN (<пункт видения / SDLC-исход X>)   ← обязательно цитирует исходную OPP
   - **Size:** S | M    **Risk:** low | med    **Impact:** low | med | high
   ```
   `Lens` всегда `strategy` (происхождение из vision-audit; см. список линз в `propose-improvements`). `Evidence` **обязан** ссылаться на `OPP-NNN`.
5. **Дозаписать и пересортировать.** Добавить блоки в `improvements.md`. Перестроить верхнюю **priority-таблицу** (ID · title · lens · impact · size · risk), сортировка impact↓, затем size↑ (мелкие победы выше) — с учётом и старых, и новых строк.
6. **Обновить соответствие.** Записать пары `OPP-NNN → IMP-NNN` в таблицу `OPP → IMP` в `vision-audit.md` (единственная правка этого файла).
7. **Report.** Напечатать: сколько OPP перенесено, сколько пропущено (уже сопоставлены / SKIPPED / отфильтрованы), новые IMP-id. Завершить: **Next:** выбрать пункт и `/draft-requirement IMP-NNN`.

## Notes
- Это **единственный** второй писатель `improvements.md` (помимо `propose-improvements`). Формат блока и нумерация **идентичны** — иначе ломается контракт бэклога.
- Запускать **последовательно** с `propose-improvements`, не параллельно: оба продолжают одну IMP-последовательность (continue-from-max), параллельный запуск даст коллизию номеров.
- Гейт сохраняется: скилл только наполняет бэклог; **какой IMP вести дальше — выбирает человек** (как и после `propose-improvements`).
- Идемпотентен: повторный запуск не дублирует уже перенесённые OPP.
