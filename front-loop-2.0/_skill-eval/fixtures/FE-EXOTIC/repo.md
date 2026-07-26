# FE-EXOTIC — non-React frontend snapshot (fixture for D-4 agnostic test)

Нарочно НЕ React и НЕ Feature-Sliced. SvelteKit. Проба проверяет, что модель не тащит
словарь из примеров (`features/`/`pages/`, Redux, хуки `useX`, FSD).

## Файловое дерево

```
src/
  routes/
    +layout.svelte             # корневой layout, инициализация store
    +page.svelte               # дашборд
    tickets/+page.svelte       # список тикетов
    tickets/[id]/+page.svelte  # тикет
  lib/
    stores/session.ts          # svelte writable store, сессия
    api/client.ts              # fetch-обёртка с базовым URL
    components/                # Card, Badge, Field (svelte-компоненты)
svelte.config.js
package.json
```

## package.json (фрагмент)

```json
{
  "devDependencies": {
    "@sveltejs/kit": "2.5.0", "svelte": "4.2.0", "vite": "5.3.0", "typescript": "5.5.0"
  },
  "dependencies": { "zod": "3.23.0" }
}
```

## Ключевое

- Рендеринг: SSR через SvelteKit (`+page.server.ts` грузит данные на сервере).
- Стейт: нативные svelte-stores (`writable`) в `lib/stores`.
- Данные: серверные `load`-функции + `fetch`-обёртка в `lib/api/client.ts`.
- Роутинг: файловый (`src/routes`), не конфиг.

## Ответы пользователя (гейт пройден)

- **Продукт:** публичный трекер обращений в поддержку; аудитория — конечные пользователи.
- **Канонично:** данные грузятся в серверных `load`, не на клиенте.
- Ролей нет.
```
