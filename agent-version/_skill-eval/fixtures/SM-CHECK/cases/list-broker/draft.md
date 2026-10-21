# orders — backend

## Стек
- Java 17, Spring Boot
- Kafka

## Публичный контракт

### `GET /orders`
сущности: → не сущность, ответ orders
- список заказов

## События

### потребляет `orders.created`
- кладёт заказ в очередь сборки
