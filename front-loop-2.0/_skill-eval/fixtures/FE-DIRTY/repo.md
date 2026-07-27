# FE-DIRTY — brownfield snapshot с грязным рабочим деревом (fixture)

Проба Scan baseline. Смысл фикстуры: то, что лежит на диске, НЕ совпадает с коммитом,
и расхождение затрагивает три архитектурно значимых факта.

## git

```
$ git rev-parse --short HEAD
7c41ab9

$ git log -1 --format=%s
chore: disable local dev overrides before release

$ git status --porcelain
 M vite.config.ts
 M src/shared/api/client.ts
 M src/mocks/server.ts
```

## Файловое дерево

```
src/
  main.tsx                     # entry: провайдеры, /config до первого рендера
  app/router.tsx               # react-router: /login, /orders, /orders/:id, /limits
  features/orders|limits|auth/
  entities/session/            # useSession
  shared/api/client.ts         # axios-инстанс, интерцептор refresh
  shared/ui/                   # 24 примитива
  mocks/server.ts              # msw-мок бэкенда для локальной разработки
vite.config.ts
package.json
CONTRIBUTING.md
```

## package.json (фрагмент)
```json
{ "dependencies": { "react": "18.3.1", "react-router-dom": "6.24.0",
  "@tanstack/react-query": "5.51.1", "zustand": "4.5.4", "axios": "1.7.2",
  "@originjs/vite-plugin-federation": "1.3.5", "msw": "2.3.1" },
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest", "lint": "eslint ." } }
```

## Три изменённых файла — диск против коммита

### `vite.config.ts`

На диске (рабочее дерево):
```ts
export default defineConfig({
  plugins: [react(), federation({ name: "operatorCabinet", exposes: { "./Orders": "./src/features/orders" } })],
});
```

В коммите (`git show HEAD:vite.config.ts`):
```ts
export default defineConfig({
  // plugins: [react(), federation({ name: "operatorCabinet", exposes: { "./Orders": "./src/features/orders" } })],
  plugins: [react()],
});
```

### `src/shared/api/client.ts`

На диске:
```ts
const DEV_TOKEN = "eyJhbGciOiJIUzI1NiJ9.devfixture.doNotShip";
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL });
apiClient.interceptors.request.use(withToken(DEV_TOKEN));
```

В коммите:
```ts
const DEV_TOKEN = "";
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL });
apiClient.interceptors.request.use(withToken(DEV_TOKEN));
```

### `src/mocks/server.ts`

На диске: `export const ENABLED = false;`
В коммите: `export const ENABLED = true;`

## Прочее (одинаково на диске и в коммите)

- `CONTRIBUTING.md`: «Все запросы к API — только через `shared/api/client.ts`; прямой fetch
  запрещён (ломает refresh-токен)».
- Роль из `useSession().role`: `'operator' | 'admin'`; `/admin/*` за гардом.
- Внешние интеграции: backend REST API через axios-клиент; загрузка `/config` на старте.

## Ответы пользователя (гейт уже пройден — используй как есть)

- **Продукт/назначение:** внутренний кабинет оператора для работы с заказами и лимитами;
  аудитория — операторы поддержки и админы.
- **Три изменённых файла:** это мои локальные правки для разработки, я их не коммитил.
- **Module Federation:** в проде модуль должен монтироваться в host-shell как remote;
  в коммите плагин пока отключён, включение — незакрытая задача.
- **DEV_TOKEN:** намеренная тест-фикстура для локальной разработки, НЕ утечка.
- **Роли:** `operator` — видит и фильтрует заказы/лимиты; `admin` — плюс раздел `/admin`.
