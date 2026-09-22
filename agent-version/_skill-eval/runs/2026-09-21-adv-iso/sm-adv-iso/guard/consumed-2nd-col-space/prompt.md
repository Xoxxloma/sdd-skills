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

Сервис `svc`, тип `frontend`. Прежняя карточка: есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику, **без нормализации — как стоят в файлах**.

## ПРЕЖНЯЯ КАРТОЧКА
потребляемые API (60):
  `repairy-api` · `GET /auth/list`
  `repairy-api` · `POST /auth/create`
  `repairy-api` · `PATCH /auth/update`
  `repairy-api` · `DELETE /auth/remove`
  `repairy-api` · `GET /auth/export`
  `repairy-api` · `POST /auth/search`
  `repairy-api` · `PATCH /auth/count`
  `repairy-api` · `DELETE /auth/bulk`
  `repairy-api` · `GET /auth/list-1`
  `repairy-api` · `POST /auth/create-1`
  `repairy-api` · `PATCH /auth/update-1`
  `repairy-api` · `DELETE /auth/remove-1`
  `repairy-api` · `GET /auth/export-1`
  `repairy-api` · `POST /auth/search-1`
  `repairy-api` · `PATCH /auth/count-1`
  `repairy-api` · `DELETE /auth/bulk-1`
  `repairy-api` · `GET /auth/list-2`
  `repairy-api` · `POST /auth/create-2`
  `repairy-api` · `PATCH /auth/update-2`
  `repairy-api` · `DELETE /auth/remove-2`
  `repairy-api` · `GET /auth/export-2`
  `repairy-api` · `POST /auth/search-2`
  `repairy-api` · `PATCH /auth/count-2`
  `repairy-api` · `DELETE /auth/bulk-2`
  `repairy-api` · `GET /auth/list-3`
  `repairy-api` · `POST /auth/create-3`
  `repairy-api` · `PATCH /auth/update-3`
  `repairy-api` · `DELETE /auth/remove-3`
  `repairy-api` · `GET /auth/export-3`
  `repairy-api` · `POST /auth/search-3`
  `repairy-api` · `PATCH /auth/count-3`
  `repairy-api` · `DELETE /auth/bulk-3`
  `repairy-api` · `GET /auth/list-4`
  `repairy-api` · `POST /auth/create-4`
  `repairy-api` · `PATCH /auth/update-4`
  `repairy-api` · `DELETE /auth/remove-4`
  `repairy-api` · `GET /auth/export-4`
  `repairy-api` · `POST /auth/search-4`
  `repairy-api` · `PATCH /auth/count-4`
  `repairy-api` · `DELETE /auth/bulk-4`
  `repairy-api` · `GET /auth/list-5`
  `repairy-api` · `POST /auth/create-5`
  `repairy-api` · `PATCH /auth/update-5`
  `repairy-api` · `DELETE /auth/remove-5`
  `repairy-api` · `GET /auth/export-5`
  `repairy-api` · `POST /auth/search-5`
  `repairy-api` · `PATCH /auth/count-5`
  `repairy-api` · `DELETE /auth/bulk-5`
  `repairy-api` · `GET /auth/list-6`
  `repairy-api` · `POST /auth/create-6`
  `repairy-api` · `PATCH /auth/update-6`
  `repairy-api` · `DELETE /auth/remove-6`
  `repairy-api` · `GET /auth/export-6`
  `repairy-api` · `POST /auth/search-6`
  `repairy-api` · `PATCH /auth/count-6`
  `repairy-api` · `DELETE /auth/bulk-6`
  `repairy-api` · `GET /auth/list-7`
  `repairy-api` · `POST /auth/create-7`
  `repairy-api` · `PATCH /auth/update-7`
  `repairy-api` · `DELETE /auth/remove-7`

## ЧЕРНОВИК
потребляемые API (60):
  repairy-api · GET  /auth/list
  repairy-api · POST  /auth/create
  repairy-api · PATCH  /auth/update
  repairy-api · DELETE  /auth/remove
  repairy-api · GET  /auth/export
  repairy-api · POST  /auth/search
  repairy-api · PATCH  /auth/count
  repairy-api · DELETE  /auth/bulk
  repairy-api · GET  /auth/list-1
  repairy-api · POST  /auth/create-1
  repairy-api · PATCH  /auth/update-1
  repairy-api · DELETE  /auth/remove-1
  repairy-api · GET  /auth/export-1
  repairy-api · POST  /auth/search-1
  repairy-api · PATCH  /auth/count-1
  repairy-api · DELETE  /auth/bulk-1
  repairy-api · GET  /auth/list-2
  repairy-api · POST  /auth/create-2
  repairy-api · PATCH  /auth/update-2
  repairy-api · DELETE  /auth/remove-2
  repairy-api · GET  /auth/export-2
  repairy-api · POST  /auth/search-2
  repairy-api · PATCH  /auth/count-2
  repairy-api · DELETE  /auth/bulk-2
  repairy-api · GET  /auth/list-3
  repairy-api · POST  /auth/create-3
  repairy-api · PATCH  /auth/update-3
  repairy-api · DELETE  /auth/remove-3
  repairy-api · GET  /auth/export-3
  repairy-api · POST  /auth/search-3
  repairy-api · PATCH  /auth/count-3
  repairy-api · DELETE  /auth/bulk-3
  repairy-api · GET  /auth/list-4
  repairy-api · POST  /auth/create-4
  repairy-api · PATCH  /auth/update-4
  repairy-api · DELETE  /auth/remove-4
  repairy-api · GET  /auth/export-4
  repairy-api · POST  /auth/search-4
  repairy-api · PATCH  /auth/count-4
  repairy-api · DELETE  /auth/bulk-4
  repairy-api · GET  /auth/list-5
  repairy-api · POST  /auth/create-5
  repairy-api · PATCH  /auth/update-5
  repairy-api · DELETE  /auth/remove-5
  repairy-api · GET  /auth/export-5
  repairy-api · POST  /auth/search-5
  repairy-api · PATCH  /auth/count-5
  repairy-api · DELETE  /auth/bulk-5
  repairy-api · GET  /auth/list-6
  repairy-api · POST  /auth/create-6
  repairy-api · PATCH  /auth/update-6
  repairy-api · DELETE  /auth/remove-6
  repairy-api · GET  /auth/export-6
  repairy-api · POST  /auth/search-6
  repairy-api · PATCH  /auth/count-6
  repairy-api · DELETE  /auth/bulk-6
  repairy-api · GET  /auth/list-7
  repairy-api · POST  /auth/create-7
  repairy-api · PATCH  /auth/update-7
  repairy-api · DELETE  /auth/remove-7

Посчитай гард по правилу выше: по каждому классу назови было / исчезло / появилось / опустело и сработал ли порог; исчезнувшие и опустевшие — именами. Последней строкой ответа — ровно одно из двух: `ГАРД: ПОВЕРХ` либо `ГАРД: В КАРМАН`.
