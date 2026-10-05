# SM-MONO-SPEC — правда фикстуры

Репа `casedesk`: дерево SM-MONO-DGS плюс надстройка `make.sh` этой папки. Числа напечатаны `make.sh`
по собранному дереву.

| Класс | Правда | Откуда |
|---|---|---|
| контракт | **148** | 120 базы (104 DGS + 16 REST с аннотациями) + 28 операций `openapi.yaml`, реализованных в `v2/{checks,findings,sanctions,templates,groups}/web/*DeskApiController.java` (`implements …DeskApi`, без аннотаций маршрутов) |
| сущности | **60** | как в базе |
| задачи | **10** | как в базе |
| топики | **12** | `src/main/resources/application.yaml`, как в базе |

## Чего в карточке быть не должно

| Что | Сколько | Где |
|---|---|---|
| операции, объявленные без реализации | 2 | `GET /api/desk/archive/{id}`, `POST /api/desk/archive/{id}/restore` — только в `openapi.yaml` |
| топики тестового конфига | 4 | `kontrol.test.intake.v1`, `kontrol.test.reopen.v1`, `kontrol.test.status.v1`, `kontrol.test.finding.v1` — `src/test/resources/application.yaml` |
| один ключ дважды | 0 повторов | операция объявлена в `resources/`, реализована в папке модуля |

Счёт по аннотациям маршрутов видит 16 REST-операций из 44.
