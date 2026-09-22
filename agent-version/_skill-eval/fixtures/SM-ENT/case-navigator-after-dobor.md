Сервис `summary-ms-navigator`, тип `backend`, стек Spring (маркеры из таблицы 3.1 применимы). Данные грепов:

## Счёт маркеров по коду (Шаг 3.1)
сущности `@Entity\b|^model |@Table\(`: 0

## Строки сущностей в описи (класс «сущности»; служебные и прочие классы опущены)
(строк сущностей нет; ⟹ сущностей 0)

## Заголовки `###` в «Владеет данными» черновика (0)
—

## Блоки «Публичного контракта» черновика (выдержка, 6 из 13)
### `GET /api/v1/navigator/informing/incident/statistic/categories`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`

### `GET /api/v1/navigator/informing/incident/statistic/damage`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`

### `GET /api/v1/navigator/uor/security`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`

### `GET /api/v1/navigator/uor/detentions`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`

### `GET /api/v1/navigator/uor/femida/damage`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`

### `GET /api/v1/navigator/perfomance-rating`
Срез за период.
сущности: → не сущность, ответ summary-ms-consolidate
- `labelDate`: `date`
- `bankName`: `string`
- `total`: `integer`
