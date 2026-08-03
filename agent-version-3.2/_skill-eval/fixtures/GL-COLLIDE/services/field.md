---
service: field
type: backend
repo: ../field-service
scanned: 2026-07-26
description: полевые бригады; владеет зонами покрытия
---
# field — backend

> Генерируется. Правки руками затираются.

## Назначение

Учёт полевых бригад и их зон покрытия.

## Владеет данными

### `CoverageZone`
Зона покрытия объектов охраны; единственный источник правды в системе.
- `id`: `string`
- `geometry`: `polygon`
