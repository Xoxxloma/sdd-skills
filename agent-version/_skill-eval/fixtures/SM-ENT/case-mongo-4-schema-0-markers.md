Сервис `orders-ms`, тип `backend`, стек Spring (маркеры из таблицы 3.1 применимы). Данные грепов:

## Счёт маркеров по коду (Шаг 3.1)
сущности `@Entity\b|^model |@Table\(`: 0

## Строки сущностей в описи (класс «сущности»; служебные и прочие классы опущены)
Order — schema/Order.java (@Schema)
Customer — schema/Customer.java (@Schema)
Invoice — schema/Invoice.java (@Schema)
Payment — schema/Payment.java (@Schema)

## Заголовки `###` в «Владеет данными» черновика (4)
### `Order`
### `Customer`
### `Invoice`
### `Payment`

## Блоки «Публичного контракта» черновика (выдержка, 6 из 13)
### `GET /api/orders`
Срез за период.
сущности: → Order
- ответ маппится без исключения полей

### `GET /api/customers`
Срез за период.
сущности: → Customer
- ответ маппится без исключения полей
