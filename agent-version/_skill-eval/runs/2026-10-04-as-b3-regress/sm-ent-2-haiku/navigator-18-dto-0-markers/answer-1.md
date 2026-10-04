**Анализ по двум правилам:**

### Сверка сверху (Правило 1)
- Маркеры `ключ` класса «сущности» по Шагу 3.1: **0**
- Блоков `###` в «Владеет данными»: **18**

**18 > 0** — нарушение. Разведчик нашёл маркер `@Entity`, но grep вернул ноль совпадений при наличии 18 блоков. Это требует добора.

### Сущности у ручек (Правило 2)
- Блоков без строки `сущности:`: **0** ✓

Проблем нет.

---

**Текст добора:**

NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating — маркера хранения `@Entity` в коде не найден: убери из «Владеет данными», поля — строками в блоки ручек; строку `сущности:` каждой затронутой ручки перепиши на `→ не сущность, агрегат по …` или `→ не сущность, ответ <сервис>`.

СУЩНОСТИ: ДОБОР