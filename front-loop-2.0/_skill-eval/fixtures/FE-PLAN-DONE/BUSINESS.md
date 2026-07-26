# Оператор-кабинет — Business Document

> Живой бизнес-источник правды. Core стабилен; Capabilities ведёт sync; Scenarios — от
> пользователя.

## Metadata
- Created: 2026-06-01
- Audience: analyst / product / non-developer
- Last code re-scan: 2026-06-01 @ a1b2c3d
- Last synced: 2026-07-10

## Product
Кабинет оператора поддержки: работа с заказами и лимитами клиентов.

## Users & Roles
- Оператор — работает с заказами и лимитами.
- Админ — плюс управление пользователями.

## Business Entities
| Entity | What it means to the business |
|--------|-------------------------------|
| Заказ | Обращение клиента, которое оператор ведёт до закрытия |
| Лимит | Ограничение по клиенту, которое оператор контролирует |

## Capabilities
| Capability | For which user/role | Notes |
|------------|---------------------|-------|
| Просмотр списка заказов | Оператор | |
| Экспорт заказов | Оператор | |

## Business Scenarios
| Scenario | Role | Capabilities involved | Purpose |
|----------|------|-----------------------|---------|
| Утренний обзон | Оператор | просмотр заказов | обзвонить клиентов по открытым заказам |

## Scope
- In scope: заказы, лимиты.
- Explicitly out of scope: биллинг.
