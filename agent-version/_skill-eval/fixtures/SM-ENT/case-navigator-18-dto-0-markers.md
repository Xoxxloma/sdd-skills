Сервис `summary-ms-navigator`, тип `backend`, стек Spring (маркеры из таблицы 3.1 применимы). Данные грепов:

## Счёт маркеров по коду (Шаг 3.1)
сущности `@Entity\b|^model |@Table\(`: 0

## Строки сущностей в описи (класс «сущности»; служебные и прочие классы опущены)
NavigatorRequestFilter — dto/NavigatorRequestFilter.java
CommonLabels — dto/CommonLabels.java
IncidentCategoryStatistic — dto/IncidentCategoryStatistic.java
IncidentDamageStatistic — dto/IncidentDamageStatistic.java
IncidentsAndDetentions — dto/IncidentsAndDetentions.java
UorIncident — dto/UorIncident.java
LostSearch — dto/LostSearch.java
UorSecurity — dto/UorSecurity.java
UorDetention — dto/UorDetention.java
UorSocialEngineering — dto/UorSocialEngineering.java
UorIncidentKind — dto/UorIncidentKind.java
UorFemidaApplication — dto/UorFemidaApplication.java
UorFemidaDamage — dto/UorFemidaDamage.java
UorFemidaReimbursedDamage — dto/UorFemidaReimbursedDamage.java
UorAntiterrorAndCheck — dto/UorAntiterrorAndCheck.java
Antiterror — dto/Antiterror.java
Check — dto/Check.java
PerformanceRating — dto/PerformanceRating.java

## Заголовки `###` в «Владеет данными» черновика (18)
### `NavigatorRequestFilter`
### `CommonLabels`
### `IncidentCategoryStatistic`
### `IncidentDamageStatistic`
### `IncidentsAndDetentions`
### `UorIncident`
### `LostSearch`
### `UorSecurity`
### `UorDetention`
### `UorSocialEngineering`
### `UorIncidentKind`
### `UorFemidaApplication`
### `UorFemidaDamage`
### `UorFemidaReimbursedDamage`
### `UorAntiterrorAndCheck`
### `Antiterror`
### `Check`
### `PerformanceRating`

## Блоки «Публичного контракта» черновика (выдержка, 6 из 13)
### `GET /api/v1/navigator/informing/incident/statistic/categories`
Срез за период.
сущности: → IncidentCategoryStatistic
- ответ маппится без исключения полей

### `GET /api/v1/navigator/informing/incident/statistic/damage`
Срез за период.
сущности: → IncidentDamageStatistic
- ответ маппится без исключения полей

### `GET /api/v1/navigator/uor/security`
Срез за период.
сущности: → UorSecurity
- ответ маппится без исключения полей

### `GET /api/v1/navigator/uor/detentions`
Срез за период.
сущности: → UorDetention
- ответ маппится без исключения полей

### `GET /api/v1/navigator/uor/femida/damage`
Срез за период.
сущности: → UorFemidaDamage
- ответ маппится без исключения полей

### `GET /api/v1/navigator/perfomance-rating`
Срез за период.
сущности: → PerformanceRating
- ответ маппится без исключения полей
