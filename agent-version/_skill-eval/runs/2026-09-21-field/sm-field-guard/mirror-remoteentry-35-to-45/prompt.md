Ты — ведущий агент скилла `service-map` на Шаге 4. Черновик карточки прошёл проверки, и перед продвижением ты считаешь гард на утоньшение. Ниже — правило гарда из твоего скилла, дословно, и перечни ключей, которые дали грепы.

### Гард (Шаг 4)

**Гард на утоньшение — маршрутизатор записи, а не разрешение на неё.** Он отвечает не «писать или
нет», а «куда писать», и отвечает формулой: у тебя нет места, где ты решаешь.

**Зачем он вообще.** Все проверки выше сверяют субагента с его же описью. Не дочитал модуль —
модуля нет ни в карточке, ни в описи, и числа сходятся идеально. Единственная независимая точка
отсчёта — **прежняя карточка на диске**; гард сравнивает с ней. Прежней карточки нет — гарда нет,
и от недочитанного модуля на первом скане защищает только маркерный гейт.

**Считается по ключам, по классам, по таблице — не на глаз.** Ключ — заголовок блока `###` или
названная колонка таблицы:

| Класс | Где ключ |
|---|---|
| контракт | `###` в «Публичный контракт» / «Публичный API» |
| сущности | `###` в «Владеет данными» |
| задачи | `###` в «Фоновые задачи» |
| топики | `###` в «События» (направление плюс топик) |
| экраны | первая колонка «Экраны» |
| потребляемые API | первая и вторая колонки «Потребляемые API» (сервис плюс вызов) |
| роли | первая колонка «Роли и доступ» |
| зависит от | первая колонка «Зависит от» |

**Не считаются вовсе:** «Бизнес-правила» (их заголовки меняются при приведении формы к шаблону —
это переформатирование, и оно у тебя уже гейтится против описи), «Что умеет для пользователя»
(строки, не ключи), «Кто меня потребляет» (пуста по конструкции до Шага 5). Ключ нормализуй:
без бэктиков, пробелы схлопнуты, регистр HTTP-глагола приведён к верхнему.

По каждому классу `c` возьми множества ключей прежней карточки и черновика и посчитай **было_c,
исчезло_c, появилось_c**. Дополнительно по каждому классу с блоками: **опустело_c** — ключ цел, тело
блока было непустым, стало пустым (по счёту строк `- ` под заголовком).

**Правило маршрута — одно на все классы:**

```
В КАРМАН, если хоть у одного класса c:
    (исчезло_c ≥ 3  и  3·исчезло_c > было_c)
 или (опустело_c ≥ 3  и  3·опустело_c > было_c)
Иначе — ПОВЕРХ.
```

Три ключа из четырёх — карман; два из восьмидесяти девяти — поверх; тридцать три из сорока восьми
— карман; один из двух — поверх, с именем в отчёте. Слов «законно», «форма», «урезали», «не
дочитал» в правиле нет — и в твоём рассуждении их быть не должно: ты не отличишь одно от другого,
потому что кода не видел, а решение, принятое вслепую, останавливало годные карточки и всё равно
обходилось рассуждением.

- **ПОВЕРХ** → продвижение в `services/<name>.md`. Исчезнувшие и опустевшие ключи — **именами в
  отчёт** (Шаг 6), сколько бы их ни было. Названная именами потеря молчаливой не является.
- **В КАРМАН** → продвижение в **`services/_pending/<name>.md`**. Прежняя карточка остаётся
  **байт-в-байт, включая `scanned`**: прочтения, которому можно верить, не состоялось. В отчёт —
  строка `ГАРД` с числами и именами и вопрос человеку: урезали сервис или скан не дочитал?
  Принять кандидата — переместить файл поверх; отклонить — удалить. **Ты сам ни того, ни другого
  не делаешь** и в `_pending/` ничего не правишь: это его решение, и он принимает его тогда, когда
  читает отчёт, а не посреди прогона.

Работа субагента не теряется ни при каком исходе — и поэтому нет мотива обходить гард.

**Появилось ≈ исчезло по одному классу** (например, весь контракт сменил префикс) — это
переименование, а не потеря; правило всё равно отправит в карман, и строка отчёта обязана это
назвать: «появилось 96, исчезло 96 — похоже на переименование».

**И восстанавливать из прежней карточки ничего не смей.** Прежнюю карточку ты не склеиваешь с
черновиком и строк из неё не переносишь. Правило прежней формулировки на Шаге 3 — не то же самое:
там прежний текст читает субагент, у которого есть код. Здесь у тебя кода нет, и любая перенесённая
тобой строка — утверждение о сервисе, которого ты не видел.


---

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

Посчитай гард по правилу выше: по каждому классу назови было / исчезло / появилось и сработал ли порог. Последней строкой ответа — ровно одно из двух: `ГАРД: ПОВЕРХ` либо `ГАРД: В КАРМАН`.
