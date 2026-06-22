# product-skills

Набор скиллов для конвейера **«понять большую систему → найти улучшения / оформить фичу → специфицировать → реализовать»**. Работает на любом большом приложении (в т.ч. из множества сервисов/папок).

Скиллы запускаются в **отдельном product-репозитории** (рабочий каталог = CWD): туда пишутся база знаний, бэклог и папки фич. **Анализируемая система — отдельно**, передаётся путём и read-only; единственное исключение — `implement-feature`, который пишет код в неё по пути из `system/manifest.yaml`.

## Что внутри (`skills/`)

| Скилл | Делает | Вход → Выход |
|---|---|---|
| **system-map** | Кеш-база знаний по системе: по агенту на сервис параллельно → карточки + синтез + граф зависимостей + `manifest.yaml`. Инкрементальна. | `<target-path>` → `system/` |
| **propose-improvements** | Аудит системы по трём трекам: **тех.качество** + **UX (impeccable)** + **новые фичи (vision)**. Каждое улучшение — отдельный БТ-файл. | `system/` → `backlog/F-N.feature.md` |
| **design-feature** | Человеко-ориентированный сосед: из брифа человека (с уточняющими вопросами) оформляет один БТ того же формата. | бриф → `backlog/F-N.feature.md` |
| **spec-feature** | Из БТ (номер `F-N` / путь / бриф) — EARS-требования + атомарный план; создаёт папку фичи с тремя файлами. | `F-N`/путь/бриф → `features/F-N/{feature,requirements,plan}.md` |
| **implement-feature** | Реализация по плану: одна задача за раз, тест на каждый поведенческий R-id, цикл самокоррекции. Пишет код в анализируемую систему. | `features/F-N/` → код в системе |
| **impeccable** | Сторонний скилл аудита/дизайна UI (Apache-2.0). Используется `propose-improvements` для UX-трека. | — |

Сквозной номер фичи **`F-N`** тянется из бэклога в папку фичи без изменения: `backlog/F-7.feature.md → features/F-7/`.

## Быстрый старт

### 0. Пререквизиты
- AI-харнесс с поддержкой скиллов: **Claude Code** (и совместимые — у каждого свой каталог скиллов).
- **Node.js ≥ 18** — нужен только для скриптов/CLI **impeccable**; остальные скиллы работают без него.
- **WebSearch** — опционально, только для трека «новые фичи» в `propose-improvements`; без него — флаг `--no-web` (деградация на анализ по карте + `COMPETITORS.md`).
- Доступ на **чтение** к папке(ам) анализируемой системы.

### 1. Установить скиллы
Скопировать содержимое `skills/` в каталог скиллов среды:
```
cp -r skills/*  <harness>/.claude/skills/        # Claude Code
# для других сред — соответствующий каталог: .agents/skills, .cursor/…, .gemini/… и т.д.
```

### 2. Проверить, что подхватились
Должны стать доступны команды:
`/system-map`, `/propose-improvements`, `/design-feature`, `/spec-feature`, `/implement-feature`, `/impeccable`.

### 3. Запустить (по стадиям)
```
/system-map /abs/path/to/system     # база знаний          → system/  (+ manifest.yaml)
/propose-improvements                # бэклог БТ аудитом    → backlog/F-N.feature.md
# или, для конкретной идеи человека:
/design-feature "хочу <фичу> …"      # один БТ из брифа     → backlog/F-N.feature.md

/spec-feature F-7                    # требования + план    → features/F-7/{feature,requirements,plan}.md
/implement-feature F-7               # реализация по плану  → код в анализируемой системе
```
Между стадиями — **гейты на человека**: какой `F-N` вести дальше и утверждение спеки/плана решает человек. Все артефакты (кроме кода) пишутся в текущий каталог.

> **Read-only на исходники анализируемой системы.** Скиллы `system-map` / `propose-improvements` / `design-feature` / `spec-feature` пишут только в рабочий каталог (CWD). Код в систему пишет **только** `implement-feature` — по пути из `system/manifest.yaml`, никогда в CWD.
>
> **impeccable** обычно ставится онлайн (`npx impeccable skills install`); здесь вложен офлайн-копией для закрытого контура (обновление при сети — `npx impeccable skills update`). CLI-детектор анти-паттернов требует `npx impeccable …`; в закрытом контуре работает анализ по reference-инструкциям.

## Рабочий стол артефактов (контракт между стадиями)

Каждая стадия читает базу знаний `system/` и артефакт предыдущей, пишет свой — в один рабочий каталог (CWD):

```
system/
  system-map.md            # синтез: каталог возможностей, сквозные сценарии
  services/<svc>.md        # карточка на сервис
  dependency-graph.mmd     # mermaid
  manifest.yaml            # ВЫХОД system-map: targetRoot + services[]{name,path,type} — где живёт код
.cache/map-state.json      # хэш/commit на сервис → инкрементальное обновление
backlog/
  F-1.feature.md           # БТ-кандидаты (один файл на улучшение; propose-improvements + design-feature)
  index.md                 # (опц.) priority-таблица
features/
  F-1/
    feature.md             # БТ (канон после промоушена)
    requirements.md        # EARS-требования (R-1…)
    plan.md                # план задач (T-1…)
VISION.md  COMPETITORS.md  # (опц.) входы трека «новые фичи» в propose-improvements
```
Анализируемая система — в другом месте (абсолютные пути в `system/manifest.yaml`).

### Нумерация и промоушен (`F-N`)
Единое пространство `F-N`. Следующий номер = `max(N)+1` по **сканированию обоих** `backlog/*.feature.md` и `features/F-*/`. Существующие **никогда не перенумеровываются**. `propose-improvements` и `design-feature` запускать **последовательно** (не параллельно — иначе коллизия номеров). При промоушене `spec-feature` сохраняет номер и помечает исходный `backlog/F-N.feature.md` как `status: promoted` (канон — в `features/F-N/`).

### GIGACODE / правила стека
`spec-feature` и `implement-feature` читают контекст модели и гейты из `GIGACODE.md` (если в проекте есть свой) либо из вложенного донора `GIGACODE_BASE.md`, и правила стека из `rules/react-ts.md` (или `.gigacode/rules/react-ts.md`). Свой `GIGACODE.md` заводится переносом недостающих блоков из `GIGACODE_BASE.md`.

## Памятка по стадиям
`system-map <path>` → `propose-improvements` (или `design-feature "<бриф>"`) → `spec-feature F-N` → `implement-feature F-N`. Сквозной номер `F-N` сохраняется на всём пути.
