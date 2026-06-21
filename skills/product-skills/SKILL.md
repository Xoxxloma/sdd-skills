---
name: product-skills
description: Entry point and dispatcher for the product-skills bundle — explains the whole skill set, detects how far the current product/ workspace has progressed, and tells you exactly which command to run next. Also bootstraps a new workspace (creates product/manifest.yaml from the bundled example). Use this when you don't know where to start, want a map of the available commands, or need to set up the workspace. It routes; it does not run the stages itself (use product-pipeline to auto-run the chain).
version: 1.0.0
user-invocable: true
argument-hint: "[workspace-path] [--init]"
---

Единая точка входа в набор **product-skills**: ориентирует и маршрутизирует. Показывает карту команд, определяет по состоянию `product/` «где ты сейчас», подсказывает следующий шаг и при необходимости создаёт рабочий каталог. **Сам стадии не исполняет** — для автопрогона цепочки с гейтами есть `/product-pipeline`; этот скилл говорит, *что* вызвать, а не делает работу за стадии.

## Inputs / outputs
- Читает: рабочий каталог (по умолчанию `./product/`, или путь первым аргументом) — что уже создано.
- Пишет (только при сетапе): `product/manifest.yaml` из образца `reference/manifest.example.yaml` (этого скилла) — и больше ничего. Никаких артефактов стадий не трогает.
- Read-only на исходники сервисов.

## Карта набора (что когда вызывать)

| Команда | Делает | Вход → Выход |
|---|---|---|
| `/system-map` | Карта системы по манифесту. | `manifest.yaml` → `system/` |
| `/propose-improvements` | Бэклог улучшений по линзам (тактика, снизу вверх). | `system/` → `backlog/improvements.md` (IMP) |
| `/vision-audit` *(опц.)* | Стратегический аудит (видение R/Y/G + SDLC-разрывы + ресёрч). | `vision/` + `system/` → `vision/vision-audit.md` (OPP) |
| `/vision-to-backlog` *(опц.)* | Мост: OPP → тот же бэклог как IMP (линза `strategy`). | `vision/vision-audit.md` → `backlog/improvements.md` |
| `/draft-requirement IMP-NNN` | IMP → бизнес/тех требование. | IMP → `requirements/REQ-NNN.md` |
| `/system-requirements REQ-NNN` | REQ → системные требования. | REQ → `system-requirements/SYS-NNN.md` |
| `/implementation-plan SYS-NNN` | SYS → план реализации. | SYS → `plans/PLAN-NNN.md` |
| `/product-pipeline` | Оркестратор: гонит всю цепочку с гейтами, ведёт `traceability.md`. | — |
| `/impeccable` | Сторонний UI-аудит (используется `propose-improvements`). | — |

Поток (сквозной номер `IMP-007 → REQ-007 → SYS-007 → PLAN-007`):
```
manifest.yaml → /system-map ─┬───────────────────────► /propose-improvements ─┐
                             └─ (опц.) /vision-audit ─► /vision-to-backlog ────┤
                                                                               ▼
                                              backlog/improvements.md (IMP) → (выбор) →
                                /draft-requirement → /system-requirements → /implementation-plan
```

## Procedure

### 1. Резолв рабочего каталога
Определить каталог (аргумент или `./product/`). Прочитать, что в нём есть.

### 2. Сетап, если нужно (`--init` или пустой каталог)
- Если `product/manifest.yaml` отсутствует (или передан `--init`): создать каталог `product/` и записать `product/manifest.yaml`, скопировав образец `reference/manifest.example.yaml` (этого скилла). Сообщить пользователю, что нужно вписать реальные пути сервисов (`name → path → type`).
- Не сканировать и не угадывать сервисы молча — это работа `system-map`; здесь только болванка манифеста.

### 3. Определить состояние и подсказать следующий шаг
Проверить наличие артефактов (сверху вниз) и вывести «ты сейчас здесь → дальше вызови …»:
```
есть product/system/system-map.md?            нет → Next: /system-map
есть product/backlog/improvements.md?         нет → Next: /propose-improvements  (или опц. /vision-audit → /vision-to-backlog)
выбран ли IMP для развёртывания?              да  → Next: /draft-requirement IMP-NNN
есть REQ без SYS / SYS без PLAN?              да  → Next: /system-requirements REQ-NNN  /  /implementation-plan SYS-NNN
ничего не выбрано после бэклога?              →   человек выбирает IMP (гейт)
```
Учесть опциональную vision-ветку: если есть `product/vision/vision-audit.md` с неперенесёнными OPP — подсказать `/vision-to-backlog`.

### 4. Маршрутизация
Назвать **одну** рекомендуемую следующую команду (и 1-2 альтернативы, если развилка — например «тактика `/propose-improvements` или стратегия `/vision-audit`»). Если пользователь хочет «прогнать всё сразу» — направить на `/product-pipeline`.

## Notes
- Это **диспетчер**, а не оркестратор: держи вывод тонким (карта/состояние/следующий шаг), реальную работу делают стадии. `/product-pipeline` — для автопрогона; этот скилл — для ориентации и сетапа.
- Единственная запись — `product/manifest.yaml` при сетапе. Остальное read-only.
- Контракт артефактов и сквозные ID — общие с остальными скиллами (см. README бандла).
