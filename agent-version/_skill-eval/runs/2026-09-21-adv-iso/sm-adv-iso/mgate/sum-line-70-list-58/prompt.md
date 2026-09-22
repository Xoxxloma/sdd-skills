Ты — ведущий агент скилла `service-map`. Перед запуском субагента ты снял маркерный счёт (Шаг 3.1), субагент вернул опись, и теперь ты прогоняешь маркерный гейт (Шаг 4). Ниже — текст скилла про это, дословно.

### Маркерный счёт (Шаг 3.1)

#### 3.1 Маркерный счёт — до запуска, по коду, грепом

Ты не читаешь код, но посчитать его ты можешь. Прежде чем запускать субагента, сними по папке
сервиса **число совпадений** маркеров каждого класса (`Grep` с `output_mode="count"`, по всем
путям куска сразу). Маркеры по стеку, определённому на Шаге 1.2:

| Класс | Маркер (регэксп) | Гейт |
|---|---|---|
| эндпоинты, Spring | `@(Get\|Post\|Put\|Patch\|Delete\|Request)Mapping\(` | да |
| эндпоинты, Nest | `@(Get\|Post\|Put\|Patch\|Delete)\(` | да |
| эндпоинты, Express / chi / Gin | `\.(get\|post\|put\|patch\|delete\|Get\|Post\|Put\|Patch\|Delete\|GET\|POST\|PUT\|PATCH\|DELETE)\(` | нет — ориентир |
| операции GraphQL / gRPC | `^\s*(type Query\|type Mutation\|type Subscription\|rpc )` | нет — ориентир |
| сущности | `@Entity\b\|^model \|@Table\(\|CREATE TABLE` | да |
| фоновые задачи | `@Scheduled\(\|@Cron\(\|cron\.schedule\(\|schedule\.every` | да |
| топики | `@KafkaListener\|@RabbitListener\|@EventPattern\|@KafkaHandler` | да |

Это **не инвентарь, а нижняя граница**, и только у маркеров-декораторов: один `@GetMapping` — один
ключ, редко два. Маркеры-вызовы (`.get(`, `.post(`, `type Query`) считают и чужое — HTTP-клиент,
`map.get`, тесты, — и на живом коде дают вдвое больше правды; по ним гейта нет, число идёт в бриф
как ориентир. Класс, у которого маркер дал ноль или помечен «ориентир», сверки не получает и
ничего не блокирует. Числа идут в бриф субагенту и в гейт Шага 4. Считаешь один раз на сервис.

Стек не из таблицы — маркеров нет, счёт пропущен, скажи об этом в отчёте одной строкой.


### Маркерный гейт и правила обхода (Шаг 4)

**Второе — маркерный гейт (ГЕЙТ): опись против кода, класс за классом, только по маркерам с пометкой «да» в таблице 3.1.** Число ключей класса в
описи против числа маркеров этого класса с Шага 3.1. Опись меньше **двух третей** маркеров — субагент
не дочитал: добор с перечнем «класс X: по коду не меньше N, в описи M — найди недостающие, начни с
файлов, где маркер встречается». Маркер дал ноль — сверки нет. Это единственная проверка, которая
видит недочитанный модуль **на первом скане**: все остальные сверяют субагента с его же описью, и
недочитанный модуль отсутствует в обеих.

**Три правила обхода, общие для всех гейтов.** Каждое выглядит как аккуратность, и каждое даёт
записанную карточку, которая врёт о сервисе.

- **Число описи берётся как есть, вычитать нельзя ничего.** «Эндпоинтов 20, из них два служебных,
  значит ждём 18» — это поправка на то, чего не хватило. Уменьшил ожидаемое число, чтобы оно
  сошлось с полученным, — гейт не пройден.
- **Сверяются числа, а не объяснения.** «В карточке 42 плюс шесть не развёрнуты — значит 48» не
  сходится: **42 против 48**. Объяснённое расхождение остаётся расхождением, оно просто получило
  имя, и знаешь ты про эти шесть ровно потому, что они не доехали.
- **Недостающее не дописывается тобой.** Кода ты не видел, метода и пути не знаешь; собранный по
  имени ключа блок будет безупречен по форме и сочинён целиком, а отличить его потом нельзя
  ничем. Возвращает недостающее добор — у того, у кого код.


### Бюджет

**Бюджет: не больше двух прогонов субагента на сервис.** Первый и, если понадобился, ещё один.
Второй — единственный, и он один **на все причины**: пустой ответ, отказ, нет файлов, не сошлись
числа на Шаге 4, пустое тело больше чем у половины блоков. Исключение одно — второй добор по
строкам с кодом в «Бизнес-правилах», число 4 гейта Шага 4.


### Вторая попытка

**Вторая попытка не помогла — прекрати.** Третьей не делай ни по какой причине. Прежняя карточка,
если была, остаётся байт-в-байт, включая `scanned` — прочтения не состоялось. Рабочие файлы
оставь на месте, сервис — в отчёт с числами. Карточки не было — её и не будет в этом прогоне.


---

Сервис `svc`, тип `backend`, стек: NestJS, Prisma. Прежней карточки нет.

## Маркерный счёт (Шаг 3.1) — `Grep output_mode="count"` по папке сервиса
- эндпоинты: `@(Get|Post|Put|Patch|Delete)\(` → **96**

## Итоги описи субагента (строки `⟹` файла описи)
- ⟹ эндпоинтов 70, из них с фактами 52

## Список ключей описи (первый уровень, как дал греп `^[A-Z]+ /` по файлу описи)
- GET /projects/list — http/ProjectsController.ts
- POST /projects/create — http/ProjectsController.ts
- PATCH /projects/update — http/ProjectsController.ts
- DELETE /projects/remove — http/ProjectsController.ts
- GET /projects/export — http/ProjectsController.ts
- POST /projects/search — http/ProjectsController.ts
- PATCH /projects/count — http/ProjectsController.ts
- DELETE /projects/bulk — http/ProjectsController.ts
- GET /projects/list-1 — http/ProjectsController.ts
- POST /projects/create-1 — http/ProjectsController.ts
- PATCH /projects/update-1 — http/ProjectsController.ts
- DELETE /projects/remove-1 — http/ProjectsController.ts
- GET /projects/export-1 — http/ProjectsController.ts
- POST /projects/search-1 — http/ProjectsController.ts
- PATCH /projects/count-1 — http/ProjectsController.ts
- DELETE /projects/bulk-1 — http/ProjectsController.ts
- GET /projects/list-2 — http/ProjectsController.ts
- POST /projects/create-2 — http/ProjectsController.ts
- PATCH /projects/update-2 — http/ProjectsController.ts
- DELETE /projects/remove-2 — http/ProjectsController.ts
- GET /projects/export-2 — http/ProjectsController.ts
- POST /projects/search-2 — http/ProjectsController.ts
- PATCH /projects/count-2 — http/ProjectsController.ts
- DELETE /projects/bulk-2 — http/ProjectsController.ts
- GET /projects/list-3 — http/ProjectsController.ts
- POST /projects/create-3 — http/ProjectsController.ts
- PATCH /projects/update-3 — http/ProjectsController.ts
- DELETE /projects/remove-3 — http/ProjectsController.ts
- GET /projects/export-3 — http/ProjectsController.ts
- POST /projects/search-3 — http/ProjectsController.ts
- PATCH /projects/count-3 — http/ProjectsController.ts
- DELETE /projects/bulk-3 — http/ProjectsController.ts
- GET /projects/list-4 — http/ProjectsController.ts
- POST /projects/create-4 — http/ProjectsController.ts
- PATCH /projects/update-4 — http/ProjectsController.ts
- DELETE /projects/remove-4 — http/ProjectsController.ts
- GET /projects/export-4 — http/ProjectsController.ts
- POST /projects/search-4 — http/ProjectsController.ts
- PATCH /projects/count-4 — http/ProjectsController.ts
- DELETE /projects/bulk-4 — http/ProjectsController.ts
- GET /projects/list-5 — http/ProjectsController.ts
- POST /projects/create-5 — http/ProjectsController.ts
- PATCH /projects/update-5 — http/ProjectsController.ts
- DELETE /projects/remove-5 — http/ProjectsController.ts
- GET /projects/export-5 — http/ProjectsController.ts
- POST /projects/search-5 — http/ProjectsController.ts
- PATCH /projects/count-5 — http/ProjectsController.ts
- DELETE /projects/bulk-5 — http/ProjectsController.ts
- GET /projects/list-6 — http/ProjectsController.ts
- POST /projects/create-6 — http/ProjectsController.ts
- PATCH /projects/update-6 — http/ProjectsController.ts
- DELETE /projects/remove-6 — http/ProjectsController.ts
- GET /projects/export-6 — http/ProjectsController.ts
- POST /projects/search-6 — http/ProjectsController.ts
- PATCH /projects/count-6 — http/ProjectsController.ts
- DELETE /projects/bulk-6 — http/ProjectsController.ts
- GET /projects/list-7 — http/ProjectsController.ts
- POST /projects/create-7 — http/ProjectsController.ts

Прогони маркерный гейт по каждому классу: назови число маркеров, число описи, порог ⅔ и сошлось ли. Последней строкой ответа — ровно одно из: `МАРКЕРНЫЙ ГЕЙТ: ПРОЙДЕН`, `МАРКЕРНЫЙ ГЕЙТ: ДОБОР — <перечень>`, `МАРКЕРНЫЙ ГЕЙТ: ПРЕКРАТИТЬ`.
