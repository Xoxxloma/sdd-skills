Анализирую по двум правилам:

## Маркерный гейт
Разведчик указал маркер `@Entity\b` — **0 совпадений**
В описи — **18** сущностей

Детектор узкого маркера: 18 > 2 × 0 → **маркер видит 0 из 18 по описи — внешней сверки по классу сущности нет**

## Сверка сверху
Блоков в «Владеет данными»: **18**  
Сумма маркеров класса сущности: **0**

18 > 0 — нарушение. По правилу: "Маркер сущностей у разведчика есть, а греп дал ноль при блоках в «Владеет данными» — добор на все блоки."

---

**Текст добора субагенту:**

Маркер `@Entity` на всех 18 сущностях дал ноль, но все они в коде: NavigatorRequestFilter, CommonLabels, IncidentCategoryStatistic, IncidentDamageStatistic, IncidentsAndDetentions, UorIncident, LostSearch, UorSecurity, UorDetention, UorSocialEngineering, UorIncidentKind, UorFemidaApplication, UorFemidaDamage, UorFemidaReimbursedDamage, UorAntiterrorAndCheck, Antiterror, Check, PerformanceRating. Эти классы в dto/ могут быть помечены другими аннотациями (например, `@Data`, `@Getter`, `@Setter`, или быть plain POJO). Пересчитай маркер разведчика — используй то, что на самом деле стоит в коде на каждом классе, или расширь паттерн поиска.

---

СУЩНОСТИ: ДОБОР