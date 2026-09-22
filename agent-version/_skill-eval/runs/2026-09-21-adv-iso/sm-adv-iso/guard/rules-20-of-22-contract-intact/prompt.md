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

Сервис `svc`, тип `backend`. Прежняя карточка: есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику, **без нормализации — как стоят в файлах**.

## ПРЕЖНЯЯ КАРТОЧКА
контракт (96):
  `GET /api/v1/items/list`
  `POST /api/v1/items/create`
  `PATCH /api/v1/items/update`
  `DELETE /api/v1/items/remove`
  `GET /api/v1/items/export`
  `POST /api/v1/items/search`
  `PATCH /api/v1/items/count`
  `DELETE /api/v1/items/bulk`
  `GET /api/v1/items/list-1`
  `POST /api/v1/items/create-1`
  `PATCH /api/v1/items/update-1`
  `DELETE /api/v1/items/remove-1`
  `GET /api/v1/items/export-1`
  `POST /api/v1/items/search-1`
  `PATCH /api/v1/items/count-1`
  `DELETE /api/v1/items/bulk-1`
  `GET /api/v1/items/list-2`
  `POST /api/v1/items/create-2`
  `PATCH /api/v1/items/update-2`
  `DELETE /api/v1/items/remove-2`
  `GET /api/v1/items/export-2`
  `POST /api/v1/items/search-2`
  `PATCH /api/v1/items/count-2`
  `DELETE /api/v1/items/bulk-2`
  `GET /api/v1/items/list-3`
  `POST /api/v1/items/create-3`
  `PATCH /api/v1/items/update-3`
  `DELETE /api/v1/items/remove-3`
  `GET /api/v1/items/export-3`
  `POST /api/v1/items/search-3`
  `PATCH /api/v1/items/count-3`
  `DELETE /api/v1/items/bulk-3`
  `GET /api/v1/items/list-4`
  `POST /api/v1/items/create-4`
  `PATCH /api/v1/items/update-4`
  `DELETE /api/v1/items/remove-4`
  `GET /api/v1/items/export-4`
  `POST /api/v1/items/search-4`
  `PATCH /api/v1/items/count-4`
  `DELETE /api/v1/items/bulk-4`
  `GET /api/v1/items/list-5`
  `POST /api/v1/items/create-5`
  `PATCH /api/v1/items/update-5`
  `DELETE /api/v1/items/remove-5`
  `GET /api/v1/items/export-5`
  `POST /api/v1/items/search-5`
  `PATCH /api/v1/items/count-5`
  `DELETE /api/v1/items/bulk-5`
  `GET /api/v1/items/list-6`
  `POST /api/v1/items/create-6`
  `PATCH /api/v1/items/update-6`
  `DELETE /api/v1/items/remove-6`
  `GET /api/v1/items/export-6`
  `POST /api/v1/items/search-6`
  `PATCH /api/v1/items/count-6`
  `DELETE /api/v1/items/bulk-6`
  `GET /api/v1/items/list-7`
  `POST /api/v1/items/create-7`
  `PATCH /api/v1/items/update-7`
  `DELETE /api/v1/items/remove-7`
  `GET /api/v1/items/export-7`
  `POST /api/v1/items/search-7`
  `PATCH /api/v1/items/count-7`
  `DELETE /api/v1/items/bulk-7`
  `GET /api/v1/items/list-8`
  `POST /api/v1/items/create-8`
  `PATCH /api/v1/items/update-8`
  `DELETE /api/v1/items/remove-8`
  `GET /api/v1/items/export-8`
  `POST /api/v1/items/search-8`
  `PATCH /api/v1/items/count-8`
  `DELETE /api/v1/items/bulk-8`
  `GET /api/v1/items/list-9`
  `POST /api/v1/items/create-9`
  `PATCH /api/v1/items/update-9`
  `DELETE /api/v1/items/remove-9`
  `GET /api/v1/items/export-9`
  `POST /api/v1/items/search-9`
  `PATCH /api/v1/items/count-9`
  `DELETE /api/v1/items/bulk-9`
  `GET /api/v1/items/list-10`
  `POST /api/v1/items/create-10`
  `PATCH /api/v1/items/update-10`
  `DELETE /api/v1/items/remove-10`
  `GET /api/v1/items/export-10`
  `POST /api/v1/items/search-10`
  `PATCH /api/v1/items/count-10`
  `DELETE /api/v1/items/bulk-10`
  `GET /api/v1/items/list-11`
  `POST /api/v1/items/create-11`
  `PATCH /api/v1/items/update-11`
  `DELETE /api/v1/items/remove-11`
  `GET /api/v1/items/export-11`
  `POST /api/v1/items/search-11`
  `PATCH /api/v1/items/count-11`
  `DELETE /api/v1/items/bulk-11`

бизнес-правила (22):
  `Order` — статус
  `Customer` — этап
  `Invoice` — вид
  `Payment` — статус
  `Shipment` — этап
  `Carrier` — вид
  `Warehouse` — статус
  `Slot` — этап
  `Tariff` — вид
  `Zone` — статус
  `Route` — этап
  `Driver` — вид
  `Vehicle` — статус
  `Contract` — этап
  `Claim` — вид
  `Refund` — статус
  `Audit` — этап
  `Session` — вид
  `Token` — статус
  `Role` — этап
  `Order` — вид
  `Customer` — статус

## ЧЕРНОВИК
контракт (96):
  `GET /api/v1/items/list`
  `POST /api/v1/items/create`
  `PATCH /api/v1/items/update`
  `DELETE /api/v1/items/remove`
  `GET /api/v1/items/export`
  `POST /api/v1/items/search`
  `PATCH /api/v1/items/count`
  `DELETE /api/v1/items/bulk`
  `GET /api/v1/items/list-1`
  `POST /api/v1/items/create-1`
  `PATCH /api/v1/items/update-1`
  `DELETE /api/v1/items/remove-1`
  `GET /api/v1/items/export-1`
  `POST /api/v1/items/search-1`
  `PATCH /api/v1/items/count-1`
  `DELETE /api/v1/items/bulk-1`
  `GET /api/v1/items/list-2`
  `POST /api/v1/items/create-2`
  `PATCH /api/v1/items/update-2`
  `DELETE /api/v1/items/remove-2`
  `GET /api/v1/items/export-2`
  `POST /api/v1/items/search-2`
  `PATCH /api/v1/items/count-2`
  `DELETE /api/v1/items/bulk-2`
  `GET /api/v1/items/list-3`
  `POST /api/v1/items/create-3`
  `PATCH /api/v1/items/update-3`
  `DELETE /api/v1/items/remove-3`
  `GET /api/v1/items/export-3`
  `POST /api/v1/items/search-3`
  `PATCH /api/v1/items/count-3`
  `DELETE /api/v1/items/bulk-3`
  `GET /api/v1/items/list-4`
  `POST /api/v1/items/create-4`
  `PATCH /api/v1/items/update-4`
  `DELETE /api/v1/items/remove-4`
  `GET /api/v1/items/export-4`
  `POST /api/v1/items/search-4`
  `PATCH /api/v1/items/count-4`
  `DELETE /api/v1/items/bulk-4`
  `GET /api/v1/items/list-5`
  `POST /api/v1/items/create-5`
  `PATCH /api/v1/items/update-5`
  `DELETE /api/v1/items/remove-5`
  `GET /api/v1/items/export-5`
  `POST /api/v1/items/search-5`
  `PATCH /api/v1/items/count-5`
  `DELETE /api/v1/items/bulk-5`
  `GET /api/v1/items/list-6`
  `POST /api/v1/items/create-6`
  `PATCH /api/v1/items/update-6`
  `DELETE /api/v1/items/remove-6`
  `GET /api/v1/items/export-6`
  `POST /api/v1/items/search-6`
  `PATCH /api/v1/items/count-6`
  `DELETE /api/v1/items/bulk-6`
  `GET /api/v1/items/list-7`
  `POST /api/v1/items/create-7`
  `PATCH /api/v1/items/update-7`
  `DELETE /api/v1/items/remove-7`
  `GET /api/v1/items/export-7`
  `POST /api/v1/items/search-7`
  `PATCH /api/v1/items/count-7`
  `DELETE /api/v1/items/bulk-7`
  `GET /api/v1/items/list-8`
  `POST /api/v1/items/create-8`
  `PATCH /api/v1/items/update-8`
  `DELETE /api/v1/items/remove-8`
  `GET /api/v1/items/export-8`
  `POST /api/v1/items/search-8`
  `PATCH /api/v1/items/count-8`
  `DELETE /api/v1/items/bulk-8`
  `GET /api/v1/items/list-9`
  `POST /api/v1/items/create-9`
  `PATCH /api/v1/items/update-9`
  `DELETE /api/v1/items/remove-9`
  `GET /api/v1/items/export-9`
  `POST /api/v1/items/search-9`
  `PATCH /api/v1/items/count-9`
  `DELETE /api/v1/items/bulk-9`
  `GET /api/v1/items/list-10`
  `POST /api/v1/items/create-10`
  `PATCH /api/v1/items/update-10`
  `DELETE /api/v1/items/remove-10`
  `GET /api/v1/items/export-10`
  `POST /api/v1/items/search-10`
  `PATCH /api/v1/items/count-10`
  `DELETE /api/v1/items/bulk-10`
  `GET /api/v1/items/list-11`
  `POST /api/v1/items/create-11`
  `PATCH /api/v1/items/update-11`
  `DELETE /api/v1/items/remove-11`
  `GET /api/v1/items/export-11`
  `POST /api/v1/items/search-11`
  `PATCH /api/v1/items/count-11`
  `DELETE /api/v1/items/bulk-11`

бизнес-правила (2):
  `Order` — вид
  `Customer` — статус

Посчитай гард по правилу выше: по каждому классу назови было / исчезло / появилось / опустело и сработал ли порог; исчезнувшие и опустевшие — именами. Последней строкой ответа — ровно одно из двух: `ГАРД: ПОВЕРХ` либо `ГАРД: В КАРМАН`.
