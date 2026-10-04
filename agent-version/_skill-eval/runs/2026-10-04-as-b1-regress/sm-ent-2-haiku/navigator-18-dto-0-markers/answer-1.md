Проверяю две проверки:

### Сверка сверху (маркер vs блоки в описи)
Маркер `ключ` класса «сущности» даёт: **0 совпадений**
Блоков `###` в «Владеет данными»: **18**

Критерий: блоков не больше маркеров. Здесь 18 > 0 — нарушение.

Правило на этот случай: "Маркер сущностей у разведчика есть, а греп дал ноль при блоках в «Владеет данными» — **добор на все блоки**."

Маркер есть (строка разведчика есть), греп дал ноль, блоки есть — спускаю добор.

### Сущности у ручек
В выданных 6 блоках все имеют строку `сущности:` с именами из списка. Остальные 7 блоков не видны.

---

**Текст добора для субагента:**

NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating — маркера хранения в коде не найдено. Убери из «Владеет данными», опиши поля строками в блоки ручек; строку `сущности:` затронутых ручек перепиши на `→ не сущность, DTO` или `→ не сущность, ответ <сервис>`.

СУЩНОСТИ: ДОБОР