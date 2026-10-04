**Разбор**:
- Вес сервиса 237 (контракт 139 + сущности 88 + задачи 7 + 0.5×топики 6) > K=80 → **нарезка обязательна** (правило 3.5)
- План уже подготовлен `plan.sh`: 4 части + остаток (5 читающих)
- Командная строка есть → склейка скриптом возможна
- 5 субагентов ≤ 6 лимит параллельно

Применяю: раздел 3.5, абзац «Кто что читает» — нарезка готова, запускаю части + остаток параллельно.

**Действия**:

ДЕЙСТВИЕ: Запустить 5 читающих субагентов параллельно (один на часть):
- **Часть 01** (вес 74): папки C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/analytics; C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/billing → files part-01.opis.md, part-01.md
- **Часть 02** (вес 79): папка C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/consignment → files part-02.opis.md, part-02.md
- **Часть 03** (вес 57): папки C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/dispatch; C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/tariff → files part-03.opis.md, part-03.md
- **Часть 04** (вес 27): папки C:/work/cargo-yard/src/main/java/ru/cargoyard/legacy; C:/work/cargo-yard/src/main/java/ru/cargoyard/v2/exchange → files part-04.opis.md, part-04.md
- **Остаток** (часть 05): всё вне папок частей → files part-05.opis.md, part-05.md

Каждый с брифом 3.3 (подстановки: <пути> = папки части, <корень> = C:/work/cargo-yard, <маркеры> = числа части из плана) + блок 3.5 про нарезку (NN, S=4, свои пути).

ДЕЙСТВИЕ: Ждать возврата всех 5 субагентов (проверка 3.4: файлы есть, дата свежая, эхо-строка `<!-- service-map: часть NN <дата> -->`).

ДЕЙСТВИЕ: После 5 частей запустить **голову** (брив раздел 3.5, после «Голова — после частей»; писать services/.work/cargo-yard/head.md, head.opis.md).

ДЕЙСТВИЕ: После головы запустить склейку: `bash "reference/assemble.sh" "services/.work/cargo-yard" 5 2026-10-04 "services/.work/cargo-yard.md" "services/.work/cargo-yard.opis.md"`.

ДЕЙСТВИЕ: После склейки → Шаг 4 (check.sh по склеенным файлам).

**РЕШЕНИЕ: НАРЕЗКА**