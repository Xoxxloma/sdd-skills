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
В _pending, если хоть у одного класса c:
    (исчезло_c ≥ 3  и  3·исчезло_c > было_c)
 или (опустело_c ≥ 3  и  3·опустело_c > было_c)
Иначе — ПОВЕРХ.
```

Три ключа из четырёх — `_pending` (3 ≥ 3, 9 > 4); три из десяти — поверх (9 не больше 10); два из
восьмидесяти девяти — поверх; тридцать три из сорока восьми — `_pending`; один из двух — поверх, с
именем в отчёте. Оба условия считай числами, не на глаз. Слов «законно», «форма», «урезали», «не
дочитал» в правиле нет — и в твоём рассуждении их быть не должно: ты не отличишь одно от другого,
потому что кода не видел, а решение, принятое вслепую, останавливало годные карточки и всё равно
обходилось рассуждением.

- **ПОВЕРХ** → продвижение в `services/<name>.md`. Исчезнувшие и опустевшие ключи — **именами в
  отчёт** (Шаг 6), сколько бы их ни было. Названная именами потеря молчаливой не является.
- **В _pending** → продвижение в **`services/_pending/<name>.md`**. Прежняя карточка остаётся
  **как есть: `scanned` не двигается, ни одна секция из кода не трогается** — прочтения, которому
  можно верить, не состоялось. Единственное, что в ней меняет этот прогон, — «Кто меня
  потребляет» на Шаге 5, как у всех карточек слепка. В отчёт —
  строка `ГАРД` с числами и именами и вопрос человеку: урезали сервис или скан не дочитал?
  Принять кандидата — переместить файл поверх; отклонить — удалить. **Ты сам ни того, ни другого
  не делаешь** и в `_pending/` ничего не правишь: это его решение, и он принимает его тогда, когда
  читает отчёт, а не посреди прогона.

Работа субагента не теряется ни при каком исходе — и поэтому нет мотива обходить гард.

**Появилось ≈ исчезло по одному классу** (например, весь контракт сменил префикс) — это
переименование, а не потеря; правило всё равно отправит в `_pending`, и строка отчёта обязана это
назвать: «появилось 96, исчезло 96 — похоже на переименование».

**И восстанавливать из прежней карточки ничего не смей.** Прежнюю карточку ты не склеиваешь с
черновиком и строк из неё не переносишь. Правило прежней формулировки на Шаге 3 — не то же самое:
там прежний текст читает субагент, у которого есть код. Здесь у тебя кода нет, и любая перенесённая
тобой строка — утверждение о сервисе, которого ты не видел.


---

Сервис `svc`, тип `backend`. Прежняя карточка есть. Ниже — ключи по классам, как их дали грепы
`^### ` и `^\| ` по прежней карточке и по черновику. Ключи уже нормализованы.

## ПРЕЖНЯЯ КАРТОЧКА
потребляемые API (128):
  `billing` · GET /projects/0/estimate
  `billing` · GET /projects/1/estimate
  `billing` · GET /projects/2/estimate
  `billing` · GET /projects/3/estimate
  `billing` · GET /projects/4/estimate
  `billing` · GET /projects/5/estimate
  `billing` · GET /projects/6/estimate
  `billing` · GET /projects/7/estimate
  `billing` · GET /projects/8/estimate
  `billing` · GET /projects/9/estimate
  `billing` · GET /projects/10/estimate
  `billing` · GET /projects/11/estimate
  `billing` · GET /projects/12/estimate
  `billing` · GET /projects/13/estimate
  `billing` · GET /projects/14/estimate
  `billing` · GET /projects/15/estimate
  `billing` · GET /projects/16/estimate
  `billing` · GET /projects/17/estimate
  `billing` · GET /projects/18/estimate
  `billing` · GET /projects/19/estimate
  `billing` · GET /projects/20/estimate
  `billing` · GET /projects/21/estimate
  `billing` · GET /projects/22/estimate
  `billing` · GET /projects/23/estimate
  `billing` · GET /projects/24/estimate
  `billing` · GET /projects/25/estimate
  `billing` · GET /projects/26/estimate
  `billing` · GET /projects/27/estimate
  `billing` · GET /projects/28/estimate
  `billing` · GET /projects/29/estimate
  `billing` · GET /projects/30/estimate
  `billing` · GET /projects/31/estimate
  `billing` · GET /projects/32/estimate
  `billing` · GET /projects/33/estimate
  `billing` · GET /projects/34/estimate
  `billing` · GET /projects/35/estimate
  `billing` · GET /projects/36/estimate
  `billing` · GET /projects/37/estimate
  `billing` · GET /projects/38/estimate
  `billing` · GET /projects/39/estimate
  `billing` · GET /projects/40/estimate
  `billing` · GET /projects/41/estimate
  `billing` · GET /projects/42/estimate
  `billing` · GET /projects/43/estimate
  `billing` · GET /projects/44/estimate
  `billing` · GET /projects/45/estimate
  `billing` · GET /projects/46/estimate
  `billing` · GET /projects/47/estimate
  `billing` · GET /projects/48/estimate
  `billing` · GET /projects/49/estimate
  `billing` · GET /projects/50/estimate
  `billing` · GET /projects/51/estimate
  `billing` · GET /projects/52/estimate
  `billing` · GET /projects/53/estimate
  `billing` · GET /projects/54/estimate
  `billing` · GET /projects/55/estimate
  `billing` · GET /projects/56/estimate
  `billing` · GET /projects/57/estimate
  `billing` · GET /projects/58/estimate
  `billing` · GET /projects/59/estimate
  `billing` · GET /projects/60/estimate
  `billing` · GET /projects/61/estimate
  `billing` · GET /projects/62/estimate
  `billing` · GET /projects/63/estimate
  `billing` · GET /projects/64/estimate
  `billing` · GET /projects/65/estimate
  `billing` · GET /projects/66/estimate
  `billing` · GET /projects/67/estimate
  `billing` · GET /projects/68/estimate
  `billing` · GET /projects/69/estimate
  `billing` · GET /projects/70/estimate
  `billing` · GET /projects/71/estimate
  `billing` · GET /projects/72/estimate
  `billing` · GET /projects/73/estimate
  `billing` · GET /projects/74/estimate
  `billing` · GET /projects/75/estimate
  `billing` · GET /projects/76/estimate
  `billing` · GET /projects/77/estimate
  `billing` · GET /projects/78/estimate
  `billing` · GET /projects/79/estimate
  `billing` · GET /projects/80/estimate
  `billing` · GET /projects/81/estimate
  `billing` · GET /projects/82/estimate
  `billing` · GET /projects/83/estimate
  `billing` · GET /projects/84/estimate
  `billing` · GET /projects/85/estimate
  `billing` · GET /projects/86/estimate
  `billing` · GET /projects/87/estimate
  `billing` · GET /projects/88/estimate
  `billing` · GET /projects/89/estimate
  `billing` · GET /projects/90/estimate
  `billing` · GET /projects/91/estimate
  `billing` · GET /projects/92/estimate
  `billing` · GET /projects/93/estimate
  `billing` · GET /projects/94/estimate
  `billing` · GET /projects/95/estimate
  `billing` · GET /projects/96/estimate
  `billing` · GET /projects/97/estimate
  `billing` · GET /projects/98/estimate
  `billing` · GET /projects/99/estimate
  `billing` · GET /projects/100/estimate
  `billing` · GET /projects/101/estimate
  `billing` · GET /projects/102/estimate
  `billing` · GET /projects/103/estimate
  `billing` · GET /projects/104/estimate
  `billing` · GET /projects/105/estimate
  `billing` · GET /projects/106/estimate
  `billing` · GET /projects/107/estimate
  `billing` · GET /projects/108/estimate
  `billing` · GET /projects/109/estimate
  `billing` · GET /projects/110/estimate
  `billing` · GET /projects/111/estimate
  `billing` · GET /projects/112/estimate
  `billing` · GET /projects/113/estimate
  `billing` · GET /projects/114/estimate
  `billing` · GET /projects/115/estimate
  `billing` · GET /projects/116/estimate
  `billing` · GET /projects/117/estimate
  `billing` · GET /projects/118/estimate
  `billing` · GET /projects/119/estimate
  `billing` · GET /projects/120/estimate
  `billing` · GET /projects/121/estimate
  `billing` · GET /projects/122/estimate
  `billing` · GET /projects/123/estimate
  `billing` · GET /projects/124/estimate
  `billing` · GET /projects/125/estimate
  `billing` · GET /projects/126/estimate
  `billing` · GET /projects/127/estimate

## ЧЕРНОВИК
потребляемые API (125):
  `billing` · GET /projects/3/estimate
  `billing` · GET /projects/4/estimate
  `billing` · GET /projects/5/estimate
  `billing` · GET /projects/6/estimate
  `billing` · GET /projects/7/estimate
  `billing` · GET /projects/8/estimate
  `billing` · GET /projects/9/estimate
  `billing` · GET /projects/10/estimate
  `billing` · GET /projects/11/estimate
  `billing` · GET /projects/12/estimate
  `billing` · GET /projects/13/estimate
  `billing` · GET /projects/14/estimate
  `billing` · GET /projects/15/estimate
  `billing` · GET /projects/16/estimate
  `billing` · GET /projects/17/estimate
  `billing` · GET /projects/18/estimate
  `billing` · GET /projects/19/estimate
  `billing` · GET /projects/20/estimate
  `billing` · GET /projects/21/estimate
  `billing` · GET /projects/22/estimate
  `billing` · GET /projects/23/estimate
  `billing` · GET /projects/24/estimate
  `billing` · GET /projects/25/estimate
  `billing` · GET /projects/26/estimate
  `billing` · GET /projects/27/estimate
  `billing` · GET /projects/28/estimate
  `billing` · GET /projects/29/estimate
  `billing` · GET /projects/30/estimate
  `billing` · GET /projects/31/estimate
  `billing` · GET /projects/32/estimate
  `billing` · GET /projects/33/estimate
  `billing` · GET /projects/34/estimate
  `billing` · GET /projects/35/estimate
  `billing` · GET /projects/36/estimate
  `billing` · GET /projects/37/estimate
  `billing` · GET /projects/38/estimate
  `billing` · GET /projects/39/estimate
  `billing` · GET /projects/40/estimate
  `billing` · GET /projects/41/estimate
  `billing` · GET /projects/42/estimate
  `billing` · GET /projects/43/estimate
  `billing` · GET /projects/44/estimate
  `billing` · GET /projects/45/estimate
  `billing` · GET /projects/46/estimate
  `billing` · GET /projects/47/estimate
  `billing` · GET /projects/48/estimate
  `billing` · GET /projects/49/estimate
  `billing` · GET /projects/50/estimate
  `billing` · GET /projects/51/estimate
  `billing` · GET /projects/52/estimate
  `billing` · GET /projects/53/estimate
  `billing` · GET /projects/54/estimate
  `billing` · GET /projects/55/estimate
  `billing` · GET /projects/56/estimate
  `billing` · GET /projects/57/estimate
  `billing` · GET /projects/58/estimate
  `billing` · GET /projects/59/estimate
  `billing` · GET /projects/60/estimate
  `billing` · GET /projects/61/estimate
  `billing` · GET /projects/62/estimate
  `billing` · GET /projects/63/estimate
  `billing` · GET /projects/64/estimate
  `billing` · GET /projects/65/estimate
  `billing` · GET /projects/66/estimate
  `billing` · GET /projects/67/estimate
  `billing` · GET /projects/68/estimate
  `billing` · GET /projects/69/estimate
  `billing` · GET /projects/70/estimate
  `billing` · GET /projects/71/estimate
  `billing` · GET /projects/72/estimate
  `billing` · GET /projects/73/estimate
  `billing` · GET /projects/74/estimate
  `billing` · GET /projects/75/estimate
  `billing` · GET /projects/76/estimate
  `billing` · GET /projects/77/estimate
  `billing` · GET /projects/78/estimate
  `billing` · GET /projects/79/estimate
  `billing` · GET /projects/80/estimate
  `billing` · GET /projects/81/estimate
  `billing` · GET /projects/82/estimate
  `billing` · GET /projects/83/estimate
  `billing` · GET /projects/84/estimate
  `billing` · GET /projects/85/estimate
  `billing` · GET /projects/86/estimate
  `billing` · GET /projects/87/estimate
  `billing` · GET /projects/88/estimate
  `billing` · GET /projects/89/estimate
  `billing` · GET /projects/90/estimate
  `billing` · GET /projects/91/estimate
  `billing` · GET /projects/92/estimate
  `billing` · GET /projects/93/estimate
  `billing` · GET /projects/94/estimate
  `billing` · GET /projects/95/estimate
  `billing` · GET /projects/96/estimate
  `billing` · GET /projects/97/estimate
  `billing` · GET /projects/98/estimate
  `billing` · GET /projects/99/estimate
  `billing` · GET /projects/100/estimate
  `billing` · GET /projects/101/estimate
  `billing` · GET /projects/102/estimate
  `billing` · GET /projects/103/estimate
  `billing` · GET /projects/104/estimate
  `billing` · GET /projects/105/estimate
  `billing` · GET /projects/106/estimate
  `billing` · GET /projects/107/estimate
  `billing` · GET /projects/108/estimate
  `billing` · GET /projects/109/estimate
  `billing` · GET /projects/110/estimate
  `billing` · GET /projects/111/estimate
  `billing` · GET /projects/112/estimate
  `billing` · GET /projects/113/estimate
  `billing` · GET /projects/114/estimate
  `billing` · GET /projects/115/estimate
  `billing` · GET /projects/116/estimate
  `billing` · GET /projects/117/estimate
  `billing` · GET /projects/118/estimate
  `billing` · GET /projects/119/estimate
  `billing` · GET /projects/120/estimate
  `billing` · GET /projects/121/estimate
  `billing` · GET /projects/122/estimate
  `billing` · GET /projects/123/estimate
  `billing` · GET /projects/124/estimate
  `billing` · GET /projects/125/estimate
  `billing` · GET /projects/126/estimate
  `billing` · GET /projects/127/estimate

Посчитай гард по правилу выше: по каждому классу назови было / исчезло / появилось и сработал ли порог. Последней строкой ответа — ровно одно из двух: `ГАРД: ПОВЕРХ` либо `ГАРД: В _pending`.
