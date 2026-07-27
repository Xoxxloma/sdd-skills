# FE-LEGACY-CANON — current code snapshot (fixture)

Код под legacy-док с §9 в формате 1.0 («Canonical patterns» / «Anti-patterns to avoid»).
По смыслу с момента дока ничего не поменялось; код совпадает с описанным. Рабочее дерево
чистое.

## git

```
$ git rev-parse --short HEAD
b52d907

$ git status --porcelain
(пусто)
```

## Файловое дерево

```
src/
  main.tsx                     # провайдеры, /config до первого рендера
  pages/                       # receiving, inventory, writeoff
  features/receiving|inventory|writeoff/
  entities/session/            # useSession
  shared/api/client.ts         # axios, интерцептор refresh
  shared/ui/                   # 19 примитивов
  shared/export/toCsv.ts       # papaparse.unparse + BOM
CONTRIBUTING.md
package.json
```

## package.json (фрагмент)
```json
{ "dependencies": { "react": "18.3.1", "@tanstack/react-query": "5.51.1",
  "zustand": "4.5.4", "axios": "1.7.2", "papaparse": "5.4.1", "zod": "3.23.8" },
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest", "lint": "eslint ." } }
```

## Ключевое

- `src/shared/` не импортирует из `features/`/`pages/` — проверено по импортам.
- `src/shared/export/toCsv.ts`: `papaparse.unparse(rows, { quotes: true, delimiter: ";" })`,
  в начало файла дописывается BOM.
- Компоненты, читающие zustand-стор, обёрнуты в `observer(...)`.
- Роль из `useSession().role`: `'keeper' | 'shift_lead'`; `/writeoff` за гардом.
- `CONTRIBUTING.md` содержит ровно одно правило: «Все запросы к API — только через
  `shared/api/client.ts`; прямой fetch запрещён (ломает refresh-токен)».

## Ответы пользователя (Refine — settled не переспрашивать)

- Ничего из ранее подтверждённого не изменилось по смыслу.
- Правило про `shared/api/client.ts` — да, действующее и обязательное.
