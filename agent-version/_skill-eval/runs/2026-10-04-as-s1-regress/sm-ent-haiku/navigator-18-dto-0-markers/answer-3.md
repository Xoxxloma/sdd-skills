Анализирую по двум правилам:

## Сверка сверху (сущности без маркера хранилища)

**Маркеры в коде:** 0 (@Entity, @Table, model)  
**Блоков "###" в описи:** 18

Правило: блоков не должно быть **больше** маркеров. Здесь 18 >> 0.

Исключение (маркер вне таблицы) не применяется — строки сущностей содержат пути `.java`, но ни один из них не помечен @Entity, @Table или model, и нет указаний на Mongo или подобное.

**Результат:** сущности есть в описи, но без маркера хранилища в коде. Нужен добор.

---

## Добор

NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating — маркера хранения в коде нет:

1. Убери из «Владеет данными» все 18 блоков.
2. Во всех блоках «Публичного контракта» перепиши строку `сущности: → <ClassName>` на `→ не сущность, ответ <сервис>` (если данные от другого MS) или `→ не сущность, агрегат по <поля>` (если локальная сборка) в зависимости от источника в коде.

---

`СУЩНОСТИ: ДОБОР`