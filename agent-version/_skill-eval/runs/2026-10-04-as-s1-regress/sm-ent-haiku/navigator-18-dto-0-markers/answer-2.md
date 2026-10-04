Проверю по двум правилам.

**Маркерный гейт**: счёт маркеров = **0**, в описи **18 блоков** сущностей. При маркере 0 гейт не срабатывает («это нижняя граница»). ✓

**Сверка сущностей сверху**: 
- Маркеров по коду: 0
- Блоков `###` в «Владеет данными»: 18
- Условие: блоков не больше маркеров → **18 > 0** → нарушение ✗

Исключение (маркер вне таблицы, Mongo) не применяется: это Spring, маркер не найден вообще.

**Требуемый добор:**

NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating — маркера хранения в коде нет: убери из «Владеет данными», поля — строками в блоки ручек; строку `сущности:` каждой затронутой ручки перепиши на `→ не сущность, агрегат по …` или `→ не сущность, ответ …`.

---
СУЩНОСТИ: ДОБОР