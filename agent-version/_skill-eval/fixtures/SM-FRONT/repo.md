# Фикстура SM-FRONT — фронтовый репозиторий

Синтетический репозиторий. Подаётся модели как содержимое `/work/incident-web`; она работает с этим
текстом, а не ходит по диску. `type` в манифесте — `frontend`.

Проверяет ветвление формы карточки: у фронта должны появиться «Экраны», «Потребляемые API»,
«Состояние и данные» и НЕ должно быть «Публичный контракт» и «Владеет данными».

## `package.json`

```json
{
  "name": "incident-web",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": {
    "react": "^18.3.1", "react-router-dom": "^6.26.0",
    "@tanstack/react-query": "^5.51.0", "zustand": "^4.5.4",
    "axios": "^1.7.2", "@mui/material": "^5.16.0"
  }
}
```

## `src/router.tsx`

```tsx
<Route path="/incidents" element={<IncidentList />} />
<Route path="/incidents/:id" element={<IncidentCard />} />
<Route path="/incidents/:id/assign" element={<AssignSquad />} />
<Route path="/coverage" element={<CoverageMap />} />
<Route path="/settings/notifications" element={<NotificationSettings />} />
```

## `src/pages/IncidentList.tsx` (фрагменты)

Таблица инцидентов. Фильтры: статус, тип, период, ЧОП. Нажатие на строку открывает карточку.
Пагинация серверная.

## `src/pages/IncidentCard.tsx` (фрагменты)

Детали инцидента: адрес, время, тип, назначенная ГБР, история статусов. Кнопка «Назначить ГБР»
ведёт на `/incidents/:id/assign`.

## `src/pages/AssignSquad.tsx` (фрагменты)

Выбор ГБР из списка доступных, с расчётным временем прибытия. Подтверждение назначения.

## `src/pages/CoverageMap.tsx` (фрагменты)

Карта зон покрытия ЧОП, построение изохрон по времени прибытия.

## `src/pages/NotificationSettings.tsx` (фрагменты)

Настройка каналов уведомлений пользователя.

## `src/api/client.ts`

```ts
const api = axios.create({ baseURL: import.meta.env.VITE_INCIDENT_API })

export const getIncidents = (f: Filters) => api.get('/v1/incidents', { params: f })
export const getIncident = (id: string) => api.get(`/v1/incidents/${id}`)
export const assignSquad = (id: string, squadId: string) =>
  api.post(`/v1/incidents/${id}/assign`, { squadId })
export const getSquads = () => api.get('/v1/squads/available')
```

Комментарий в файле: `// /v1/squads/available живёт в billing, остальное — incident-api`

## `src/api/coverage.ts`

```ts
export const getIsochrone = (p: Point, minutes: number) =>
  axios.get(`${import.meta.env.VITE_GEO_API}/v1/isochrone`, { params: { ...p, minutes } })
```

Комментарий: `// geo-service, отдельный базовый URL`

## `src/store/filters.ts`

```ts
export const useFilters = create<FiltersState>()(persist(
  (set) => ({ status: null, type: null, period: 'week', chopId: null, set }),
  { name: 'incident-filters' }   // localStorage
))
```

## `src/store/dictionaries.ts`

Справочники ЧОП и типов инцидентов грузятся через react-query с `staleTime: 5 * 60 * 1000` и
переиспользуются на всех экранах.

## `src/auth/useRole.ts`

```ts
// роль приходит из хост-приложения через window.__SHELL_CONTEXT__
export type Role = 'analyst' | 'dispatcher' | 'viewer'
```

`AssignSquad` рендерится только при роли `dispatcher`. `NotificationSettings` доступен всем.
`CoverageMap` скрыт от `viewer`.

## Чего в репозитории НЕТ

Ни одного серверного обработчика, ни схемы БД, ни продюсера/консьюмера очередей. Сервис ничем не
владеет и наружу контрактов не отдаёт.
