# Отчёт о сборке обратных рёбер

## Статус выполнения

Обратные рёбра собраны для всех 4 сервисов, присутствующих в манифесте.

## Детали работы

**Карточки в манифесте:** 4 (auth, geo, incident-api, incident-web)

**Карточка вне манифеста:** legacy-reports (скан 2026-05-14, не включается в граф)

### Собранные рёбра

**auth** получил 4 входящих ребра:
- geo (2 раза, backend-to-backend, вызов не записан)
- incident-api (backend-to-backend, вызов не записан)
- incident-web (фронтенд → бэкенд, `GET /v1/sessions/count`)

**geo** получил 2 входящих ребра:
- incident-api (backend-to-backend, вызов не записан)
- incident-web (фронтенд → бэкенд, `GET /v1/districts`)

**incident-api** получил 1 входящее ребро:
- incident-web (фронтенд → бэкенд, `GET /v1/incidents`)

**incident-web** входящих рёбер не получил (никто его не потребляет из манифеста)

### Проверка симметрии

Все рёбра верны:
- ✓ geo → auth соответствует auth ← geo (в geo есть "Зависит от auth" дважды)
- ✓ incident-api → auth соответствует auth ← incident-api (в incident-api есть "Зависит от auth")
- ✓ incident-api → geo соответствует geo ← incident-api (в incident-api есть "Зависит от geo")
- ✓ incident-web → auth соответствует auth ← incident-web (в incident-web есть "Потребляемые API auth")
- ✓ incident-web → geo соответствует geo ← incident-web (в incident-web есть "Потребляемые API geo")
- ✓ incident-web → incident-api соответствует incident-api ← incident-web (в incident-web есть "Потребляемые API incident-api")

### Замечания

1. В incident-web указана зависимость от "API-шлюза", которого нет в манифесте. Это внешняя система, зеркало не создаётся.

2. legacy-reports указан в "Зависит от auth", но поскольку сам legacy-reports не входит в манифест слепка, его рёбра не обрабатываются согласно инструкции.

3. Все рёбра backend-to-backend имеют прочерк вместо вызова, так как бэкенд-сервисы содержат вызовы только в секции "Зависит от", где колонка вызова не предусмотрена.

## Итог

Граф связей полностью и корректно собран. Слепок готов для использования.
