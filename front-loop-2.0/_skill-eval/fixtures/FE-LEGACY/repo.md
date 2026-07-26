# FE-LEGACY — current code snapshot (fixture)

Код, соответствующий legacy-доку (для Refine re-scan). По смыслу с момента дока ничего
не поменялось; код совпадает с описанным.

## Файловое дерево

```
src/
  main.tsx                     # провайдеры, /config до первого рендера
  pages/                       # роут-страницы (login, orders, limits, admin)
  features/                    # orders, limits, auth
  entities/session/            # useSession
  shared/api/client.ts         # axios, интерцептор refresh
CONTRIBUTING.md
package.json
```

## package.json (фрагмент)
```json
{ "dependencies": { "react": "18.3.1", "@tanstack/react-query": "5.51.1",
  "zustand": "4.5.4", "axios": "1.7.2", "zod": "3.23.8" },
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest", "lint": "eslint ." } }
```

## Ключевое
- `src/pages/` и `src/features/` — раздельные слои; `features/` не импортирует из `pages/`.
- `src/shared/api/client.ts`: `const DEV_TOKEN = "eyJhbGciOiJIUzI1NiJ9.devfixture.doNotShip";`
- Роль из `useSession().role`: `'operator' | 'admin'`; `/admin/*` за гардом.
- `CONTRIBUTING.md`: «все запросы к API — только через `shared/api/client.ts`».

## Ответы пользователя (Refine — settled не переспрашивать)
- Ничего из ранее подтверждённого не изменилось по смыслу.
