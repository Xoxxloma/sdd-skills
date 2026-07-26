# FE-BROWN — brownfield frontend snapshot (fixture)

Текстовый снимок репозитория для проб. Проба даёт это субагенту как «кодовую базу».

## Файловое дерево

```
src/
  main.tsx                     # entry: собирает провайдеры, тянет /config до первого рендера
  app/
    router.tsx                 # react-router, 12 роутов
    providers.tsx              # QueryClientProvider + AuthProvider + ThemeProvider
  features/
    orders/                    # экран заказов, фильтры, экспорт
    limits/                    # экран лимитов
    auth/                      # логин, refresh
  entities/
    session/                   # модель сессии, useSession
    order/
  shared/
    api/client.ts              # axios-инстанс, интерцептор refresh-токена
    ui/                        # 27 примитивов: Button, Input, Select, Modal, ...
package.json
tsconfig.json
CONTRIBUTING.md
```

## package.json (фрагмент)

```json
{
  "dependencies": {
    "react": "18.3.1", "react-dom": "18.3.1", "react-router-dom": "6.24.0",
    "@tanstack/react-query": "5.51.1", "zustand": "4.5.4", "axios": "1.7.2",
    "dayjs": "1.11.11", "clsx": "2.1.1", "zod": "3.23.8", "react-hook-form": "7.52.1",
    "@radix-ui/react-dialog": "1.1.1", "recharts": "2.12.7"
  },
  "scripts": { "dev": "vite", "build": "vite build", "test": "vitest", "lint": "eslint ." }
}
```

## Ключевые файлы

`src/shared/api/client.ts`:
```ts
const DEV_TOKEN = "eyJhbGciOiJIUzI1NiJ9.devfixture.doNotShip"; // локальная разработка
export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL });
apiClient.interceptors.response.use(ok, refreshOn401);
```

`src/app/router.tsx` — роуты: `/login`, `/orders`, `/orders/:id`, `/limits`, `/admin/*`
(гард `role === 'admin'`), и др. Роль читается из `useSession().role`: `'operator' | 'admin'`.

`CONTRIBUTING.md` содержит: «Все запросы к API — только через `shared/api/client.ts`;
прямой fetch запрещён (ломает refresh-токен)».

Внешние интеграции: backend REST API (через axios-клиент); загрузка `/config` на старте.

## Ответы пользователя (гейт уже пройден — используй как есть)

- **Продукт/назначение:** внутренний кабинет оператора для работы с заказами и лимитами
  клиентов; аудитория — операторы поддержки и админы.
- **DEV_TOKEN в client.ts:** намеренная тест-фикстура для локальной разработки, НЕ утечка.
- **Роли:** `operator` — видит и фильтрует заказы/лимиты; `admin` — плюс раздел `/admin`
  (управление пользователями).
- **Канонично:** данные с сервера — только через react-query; локальный UI-стейт — zustand.
- **Роль `/config`-fetch:** подтягивает фичефлаги до первого рендера — обязательный шаг.
```
