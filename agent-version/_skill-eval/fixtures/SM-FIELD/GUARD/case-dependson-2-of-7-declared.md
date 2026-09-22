Сервис `svc`, тип `backend`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику. Ключи уже нормализованы.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (13):
  GET /api/v1/navigator/informing/incident/statistic/categories
  GET /api/v1/navigator/informing/incident/statistic/damage
  GET /api/v1/navigator/informing/incidents-and-detentions
  GET /api/v1/navigator/uor/incidents
  GET /api/v1/navigator/uor/lost-search
  GET /api/v1/navigator/uor/security
  GET /api/v1/navigator/uor/detentions
  GET /api/v1/navigator/uor/social-engineering
  GET /api/v1/navigator/uor/incident-kinds
  GET /api/v1/navigator/femida/applications
  GET /api/v1/navigator/femida/damage
  GET /api/v1/navigator/antiterror-and-check
  GET /api/v1/navigator/dzo/report

зависит от (7):
  summary-ms-consolidate
  summary-ms-femida
  summary-ms-adjutant
  summary-ms-kpe-report
  summary-ms-audit
  summary-lib-api
  summary-ms-import

## ЧЕРНОВИК
контракт (13):
  GET /api/v1/navigator/informing/incident/statistic/categories
  GET /api/v1/navigator/informing/incident/statistic/damage
  GET /api/v1/navigator/informing/incidents-and-detentions
  GET /api/v1/navigator/uor/incidents
  GET /api/v1/navigator/uor/lost-search
  GET /api/v1/navigator/uor/security
  GET /api/v1/navigator/uor/detentions
  GET /api/v1/navigator/uor/social-engineering
  GET /api/v1/navigator/uor/incident-kinds
  GET /api/v1/navigator/femida/applications
  GET /api/v1/navigator/femida/damage
  GET /api/v1/navigator/antiterror-and-check
  GET /api/v1/navigator/dzo/report

зависит от (5):
  summary-ms-consolidate
  summary-ms-femida
  summary-ms-adjutant
  summary-ms-kpe-report
  summary-lib-api
