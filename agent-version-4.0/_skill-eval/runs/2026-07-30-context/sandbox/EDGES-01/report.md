# Backward Edges Collection Report

## Summary
Backward edges successfully collected from snapshot. All edges symmetric and consistent.

## Processing Summary
- **Manifest entries processed:** 4 (auth, geo, incident-api, incident-web)
- **Cards updated:** 4
- **Edges collected:** 7 total (geo→auth: 2, incident-api→auth: 1, incident-api→geo: 1, incident-web→auth: 1, incident-web→geo: 1, incident-web→incident-api: 1)

## Backward Edges Collected

### auth.md
Consumers rebuilt from manifest dependencies:
- geo | — | проверка блокировки пользователя
- geo | — | получение роли для фильтрации районов
- incident-api | — | проверка сессии диспетчера
- incident-web | GET /v1/sessions/count | плашка активных сессий в шапке

Previous stale entries (stale-01 to stale-15) were removed — they represented orphaned edges from services outside the current manifest.

### geo.md
Consumers rebuilt from manifest dependencies:
- incident-api | — | район по адресу инцидента
- incident-web | GET /v1/districts | выпадающий список районов

### incident-api.md
Consumers rebuilt from manifest dependencies:
- incident-web | GET /v1/incidents | список инцидентов

### incident-web.md
No consumers. Section maintained in empty state (single dash).

## External References
- incident-web has edge to API-шлюз (external system, not in manifest) — correctly excluded from mirroring

## Cards Outside Manifest
- services/legacy-reports.md — no entry in manifest, not processed. Contains dependency on auth but source service is outside the manifest snapshot.

## Symmetry Verification
✓ All forward dependencies have matching backward edges:
- auth: consumed by geo (2), incident-api (1), incident-web (1)
- geo: consumed by incident-api (1), incident-web (1)
- incident-api: consumed by incident-web (1)
- incident-web: no consumers

## Status
Snapshot complete. Backward edges ready for downstream consumption by technical-spec-doc and business-requirements-doc.
