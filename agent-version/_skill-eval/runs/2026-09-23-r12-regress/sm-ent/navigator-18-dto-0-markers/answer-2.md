## Разбор

**Сверка сверху.** Маркер сущностей по коду (`@Entity\b|^model |@Table\(`) = 0. Блоков `###` в «Владеет данными» — 18, не 0.

Проверяю исключение (маркер вне таблицы, Mongo-подобные): граппаю строки сущностей описи на `\([^)]*\)\s*$` — формат строк `Имя — dto/Имя.java`, скобок нет ни у одной. Первый греп даёт 0 совпадений, значит это не случай «маркер есть, но не из таблицы» — это чистый ноль без каких-либо аннотаций. Исключение не применяется.

Маркер по коду — ноль, блоки есть → **добор на все 18 блоков**.

Заодно: часть блоков «Публичного контракта» (минимум 6 показанных) ссылаются строкой `сущности:` на эти же 18 имён — после того как имена уйдут из «Владеет данными», эти строки станут выдумкой. Правило про сущности у ручек требует их переписать в рамках того же добора.

## Текст добора

> Класс «сущности»: по коду маркеров хранения (`@Entity`, `@Table`, `model`) — 0, в описи блоков «Владеет данными» — 18.
> `NavigatorRequestFilter`, `CommonLabels`, `IncidentCategoryStatistic`, `IncidentDamageStatistic`, `IncidentsAndDetentions`, `UorIncident`, `LostSearch`, `UorSecurity`, `UorDetention`, `UorSocialEngineering`, `UorIncidentKind`, `UorFemidaApplication`, `UorFemidaDamage`, `UorFemidaReimbursedDamage`, `UorAntiterrorAndCheck`, `Antiterror`, `Check`, `PerformanceRating` — маркера хранения в коде нет: убери все из «Владеет данными», поля — строками в блоки ручек, к которым они относятся.
> Строку `сущности:` каждой затронутой ручки перепиши на `→ не сущность, агрегат по периоду` или `→ не сущность, ответ summary-ms-navigator`. Известные по показанной выдержке: `GET /api/v1/navigator/informing/incident/statistic/categories`, `GET /api/v1/navigator/informing/incident/statistic/damage`, `GET /api/v1/navigator/uor/security`, `GET /api/v1/navigator/uor/detentions`, `GET /api/v1/navigator/uor/femida/damage`, `GET /api/v1/navigator/perfomance-rating` — но проверь все 13 блоков «Публичного контракта» на ссылки этими именами, не только показанные 6.

СУЩНОСТИ: ДОБОР