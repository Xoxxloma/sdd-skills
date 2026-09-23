# Анализ сущностей service-map 2.0, шаг 4

**Маркерный гейт**: код дал 0 маркеров. Опись содержит 18 блоков `###` в «Владеет данными». Блоков больше маркеров — это не недочитанный модуль (маркер не 0.5х, а 0), но сигнал о типе данных. Исключение проверяется двумя грепами по описи на паттерны `\([^)]*\)\s*$` (скобки в конце) и маркеры таблицы внутри них. В присланной описи скобок в конце строк нет — исключение не применяется.

**Вывод**: все 18 классов записаны в «Владеет данными» как сущности, но маркеров хранения в коде нет. Это DTO, а не сущности.

---

## Добор субагента

NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating — маркера хранения в коде нет: убери из «Владеет данными», поля — строками в блоки ручек; каждой ручке, где в `сущности:` стояло имя из списка выше, перепиши на `→ не сущность, агрегат по …` или `→ не сущность, ответ <сервис>`.

---

СУЩНОСТИ: ДОБОР