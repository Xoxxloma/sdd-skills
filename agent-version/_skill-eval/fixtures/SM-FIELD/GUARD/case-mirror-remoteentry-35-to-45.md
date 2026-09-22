Сервис `svc`, тип `backend`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику. Ключи уже нормализованы.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (36):
  GET /map/dynamic/cash-machines
  GET /map/dynamic/courtyard-cameras
  GET /map/dynamic/coverageInfo
  POST /map/dynamic/coverageInfo
  GET /map/dynamic/departments
  GET /map/dynamic/events
  GET /map/dynamic/gosb-statistics
  GET /map/dynamic/gosbsLayer
  GET /map/dynamic/investigation/{id}
  POST /map/dynamic/investigation
  DELETE /map/dynamic/investigation/{id}
  POST /map/dynamic/investigation/{id}/comment
  DELETE /map/dynamic/investigation/{id}/comment/{commentId}
  PATCH /map/dynamic/investigation/{investigationId}/point/{itemId}
  GET /map/dynamic/investigations
  GET /map/dynamic/manual-added-cameras
  POST /map/dynamic/camera
  GET /map/dynamic/private-security-company
  POST /map/dynamic/private-security-company
  PATCH /map/dynamic/private-security-company/{id}
  POST /map/dynamic/private-security-company/delete
  GET /map/dynamic/security-departments
  GET /map/dynamic/tb-statistics
  GET /map/dynamic/terbankLayer
  GET /map/dynamic/traffic-police-cameras
  GET /map/dynamic/twogis/2.0/catalog/branch/list
  GET /map/dynamic/twogis/3.0/items
  GET /map/dynamic/twogis/3.0/items/byid
  GET /map/dynamic/twogis/3.0/items/geocode
  GET /map/dynamic/twogis/3.0/markers
  GET /map/dynamic/twogis/3.0/suggests
  POST /map/dynamic/twogis/isochrone/2.0.0
  POST /map/dynamic/twogis/public_transport/2.0
  POST /map/dynamic/twogis/routing/7.0.0/global
  GET /map/prison
  GET /map/clusters/prison

кто меня потребляет (35):
  `summary-ui-geoanalytics` · GET dynamic/events
  `summary-ui-geoanalytics` · GET dynamic/departments
  `summary-ui-geoanalytics` · GET dynamic/security-departments
  `summary-ui-geoanalytics` · GET dynamic/cash-machines
  `summary-ui-geoanalytics` · GET dynamic/courtyard-cameras
  `summary-ui-geoanalytics` · GET dynamic/traffic-police-cameras
  `summary-ui-geoanalytics` · GET dynamic/manual-added-cameras
  `summary-ui-geoanalytics` · GET dynamic/private-security-company
  `summary-ui-geoanalytics` · GET dynamic/tb-statistics
  `summary-ui-geoanalytics` · GET dynamic/gosb-statistics
  `summary-ui-geoanalytics` · POST dynamic/camera
  `summary-ui-geoanalytics` · GET dynamic/investigations
  `summary-ui-geoanalytics` · GET dynamic/investigation/{id}
  `summary-ui-geoanalytics` · POST dynamic/investigation
  `summary-ui-geoanalytics` · DELETE dynamic/investigation/{id}
  `summary-ui-geoanalytics` · POST dynamic/investigation/{id}/comment
  `summary-ui-geoanalytics` · DELETE dynamic/investigation/{id}/comment/{commentId}
  `summary-ui-geoanalytics` · PATCH dynamic/investigation/{investigationId}/point/{itemId}
  `summary-ui-geoanalytics` · GET dynamic/gosbsLayer
  `summary-ui-geoanalytics` · GET dynamic/terbankLayer
  `summary-ui-geoanalytics` · GET dynamic/coverageInfo
  `summary-ui-geoanalytics` · POST dynamic/coverageInfo
  `summary-ui-geoanalytics` · POST dynamic/private-security-company
  `summary-ui-geoanalytics` · PATCH dynamic/private-security-company/{id}
  `summary-ui-geoanalytics` · POST dynamic/private-security-company/delete
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items/geocode
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items (forward q)
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/markers
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/suggests
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items/byid
  `summary-ui-geoanalytics` · GET dynamic/twogis/2.0/catalog/branch/list
  `summary-ui-geoanalytics` · POST dynamic/twogis/routing/7.0.0/global
  `summary-ui-geoanalytics` · POST dynamic/twogis/public_transport/2.0
  `summary-ui-geoanalytics` · POST dynamic/twogis/isochrone/2.0.0
  `summary-ui-web` · GET /svodka/geo/remoteEntry.js (Module Federation)

## ЧЕРНОВИК
контракт (36):
  GET /map/dynamic/cash-machines
  GET /map/dynamic/courtyard-cameras
  GET /map/dynamic/coverageInfo
  POST /map/dynamic/coverageInfo
  GET /map/dynamic/departments
  GET /map/dynamic/events
  GET /map/dynamic/gosb-statistics
  GET /map/dynamic/gosbsLayer
  GET /map/dynamic/investigation/{id}
  POST /map/dynamic/investigation
  DELETE /map/dynamic/investigation/{id}
  POST /map/dynamic/investigation/{id}/comment
  DELETE /map/dynamic/investigation/{id}/comment/{commentId}
  PATCH /map/dynamic/investigation/{investigationId}/point/{itemId}
  GET /map/dynamic/investigations
  GET /map/dynamic/manual-added-cameras
  POST /map/dynamic/camera
  GET /map/dynamic/private-security-company
  POST /map/dynamic/private-security-company
  PATCH /map/dynamic/private-security-company/{id}
  POST /map/dynamic/private-security-company/delete
  GET /map/dynamic/security-departments
  GET /map/dynamic/tb-statistics
  GET /map/dynamic/terbankLayer
  GET /map/dynamic/traffic-police-cameras
  GET /map/dynamic/twogis/2.0/catalog/branch/list
  GET /map/dynamic/twogis/3.0/items
  GET /map/dynamic/twogis/3.0/items/byid
  GET /map/dynamic/twogis/3.0/items/geocode
  GET /map/dynamic/twogis/3.0/markers
  GET /map/dynamic/twogis/3.0/suggests
  POST /map/dynamic/twogis/isochrone/2.0.0
  POST /map/dynamic/twogis/public_transport/2.0
  POST /map/dynamic/twogis/routing/7.0.0/global
  GET /map/prison
  GET /map/clusters/prison

кто меня потребляет (45):
  `summary-ui-geoanalytics` · GET dynamic/events
  `summary-ui-geoanalytics` · GET dynamic/departments
  `summary-ui-geoanalytics` · GET dynamic/security-departments
  `summary-ui-geoanalytics` · GET dynamic/cash-machines
  `summary-ui-geoanalytics` · GET dynamic/courtyard-cameras
  `summary-ui-geoanalytics` · GET dynamic/traffic-police-cameras
  `summary-ui-geoanalytics` · GET dynamic/manual-added-cameras
  `summary-ui-geoanalytics` · GET dynamic/private-security-company
  `summary-ui-geoanalytics` · GET dynamic/tb-statistics
  `summary-ui-geoanalytics` · GET dynamic/gosb-statistics
  `summary-ui-geoanalytics` · POST dynamic/camera
  `summary-ui-geoanalytics` · GET dynamic/investigations
  `summary-ui-geoanalytics` · GET dynamic/investigation/{id}
  `summary-ui-geoanalytics` · POST dynamic/investigation
  `summary-ui-geoanalytics` · DELETE dynamic/investigation/{id}
  `summary-ui-geoanalytics` · POST dynamic/investigation/{id}/comment
  `summary-ui-geoanalytics` · DELETE dynamic/investigation/{id}/comment/{commentId}
  `summary-ui-geoanalytics` · PATCH dynamic/investigation/{investigationId}/point/{itemId}
  `summary-ui-geoanalytics` · GET dynamic/gosbsLayer
  `summary-ui-geoanalytics` · GET dynamic/terbankLayer
  `summary-ui-geoanalytics` · GET dynamic/coverageInfo
  `summary-ui-geoanalytics` · POST dynamic/coverageInfo
  `summary-ui-geoanalytics` · POST dynamic/private-security-company
  `summary-ui-geoanalytics` · PATCH dynamic/private-security-company/{id}
  `summary-ui-geoanalytics` · POST dynamic/private-security-company/delete
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items/geocode
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items (forward q)
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/markers
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/suggests
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items/byid
  `summary-ui-geoanalytics` · GET dynamic/twogis/3.0/items (с building_id)
  `summary-ui-geoanalytics` · GET dynamic/twogis/2.0/catalog/branch/list
  `summary-ui-geoanalytics` · POST dynamic/twogis/routing/7.0.0/global
  `summary-ui-geoanalytics` · POST dynamic/twogis/public_transport/2.0
  `summary-ui-geoanalytics` · POST dynamic/twogis/isochrone/2.0.0
  `summary-ui-web` · GET /dynamic/events, /dynamic/departments, /dynamic/security-departments, /dynamic/cash-machines, /dynamic/courtyard-cameras, /dynamic/traffic-police-cameras, /dynamic/manual-added-cameras, /dynamic/private-security-company
  `summary-ui-web` · GET /dynamic/tb-statistics, /dynamic/gosb-statistics
  `summary-ui-web` · POST /dynamic/camera
  `summary-ui-web` · GET /dynamic/investigations, /dynamic/investigation/:id, POST /dynamic/investigation, DELETE /dynamic/investigation/:id, POST /dynamic/investigation/:id/comment, DELETE /dynamic/investigation/:id/comment/:commentId, PATCH /dynamic/investigation/:id/point/:itemId
  `summary-ui-web` · GET /dynamic/gosbsLayer, /dynamic/terbankLayer
  `summary-ui-web` · GET /dynamic/coverageInfo, POST
  `summary-ui-web` · GET /dynamic/twogis/3.0/items/byid, /dynamic/twogis/3.0/items, /dynamic/twogis/2.0/catalog/branch/list, /dynamic/twogis/3.0/items/geocode, /dynamic/twogis/3.0/markers, /dynamic/twogis/3.0/suggests
  `summary-ui-web` · POST /dynamic/twogis/routing/7.0.0/global
  `summary-ui-web` · POST /dynamic/twogis/public_transport/2.0
  `summary-ui-web` · POST /dynamic/twogis/get_hull
