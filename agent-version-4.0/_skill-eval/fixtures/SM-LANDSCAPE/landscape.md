# Фикстура SM-LANDSCAPE — соседний каталог

Синтетический ландшафт. Подаётся модели как результат листинга: она НЕ ходит по диску, а работает
с этим текстом как с содержимым соседних папок.

Текущая директория — `/work/specs` (репозиторий со спеками, кода нет).
Соседние папки — в `/work`.

## Листинг `/work`

```
/work/specs                 <- текущая директория
/work/auth-service
/work/billing
/work/incident-web
/work/notify-worker
/work/shared-ui
/work/legacy-reports
/work/design-tokens-archive
/work/tmp-experiments
```

## Что лежит в корне каждой папки

### `/work/auth-service` (есть `.git`)
```
go.mod  main.go  Dockerfile  README.md  internal/  migrations/
```

### `/work/billing` (есть `.git`)
```
pom.xml  Dockerfile  src/  README.md
```

### `/work/incident-web` (есть `.git`)
```
package.json  vite.config.ts  index.html  tsconfig.json  src/  public/
```

### `/work/notify-worker` (есть `.git`)
```
package.json  tsconfig.json  src/  Dockerfile
```
`package.json` содержит `"main": "dist/index.js"`, скрипты `start` и `build`, зависимости
`kafkajs`, `pino`. Бандлера нет, `index.html` нет.

### `/work/shared-ui` (есть `.git`)
```
package.json  rollup.config.js  src/  README.md
```
`package.json` содержит `"exports"`, `"peerDependencies": { "react": "^18" }`, скрипта запуска
сервера нет.

### `/work/legacy-reports` (есть `.git`)
```
requirements.txt  manage.py  reports/  README.md
```

### `/work/design-tokens-archive` (`.git` НЕТ)
```
tokens.json  README.md
```

### `/work/tmp-experiments` (`.git` НЕТ)
```
scratch.py  notes.txt
```

## Что здесь проверяется

- `design-tokens-archive` и `tmp-experiments` без `.git` — в кандидаты не попадают.
- `notify-worker` — `package.json` без бандлера и без `index.html`: это backend на Node, а не
  frontend. Маркер `package.json` сам по себе тип не определяет.
- `shared-ui` — `exports` + `peerDependencies` + нет запускаемого сервера: это `lib`.
- `legacy-reports` — Python-бэкенд; проверяет, что список маркеров не ограничен JS/Go/Java.
- Шесть кандидатов с `.git`, и ни один нельзя записать в манифест без подтверждения аналитика.
