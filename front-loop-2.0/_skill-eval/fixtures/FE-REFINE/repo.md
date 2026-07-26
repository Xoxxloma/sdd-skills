# FE-REFINE — current code snapshot (fixture)

Текущее состояние кода на момент Refine. С момента создания дока изменилось:
**Redux Toolkit внедрён; `entities/` выделен отдельным слоем; экран отчётов всё ещё не начат.**

## Файловое дерево

```
src/
  main.tsx                     # entry
  app/
    store.ts                   # configureStore (Redux Toolkit)
  features/
    dashboard/
    filters/
  entities/                    # ВЫДЕЛЕН отдельным слоем
    dataset/
    filter/
  shared/
    api/client.ts
```

## package.json (фрагмент)

```json
{
  "dependencies": {
    "react": "18.3.0", "@reduxjs/toolkit": "2.2.0", "react-redux": "9.1.0",
    "react-router-dom": "6.24.0"
  }
}
```

## Ключевое
- `src/app/store.ts` — `configureStore` из `@reduxjs/toolkit`; слайсы в `entities/*/`.
- `entities/` теперь отдельный слой (dataset, filter), `features/` его импортируют.
- Экран отчётов (reports) в коде отсутствует — не начат.

## Ответы пользователя (Refine — переспрашивать settled не нужно)
- Ничего из ранее записанного не изменилось по смыслу; новых человеческих решений нет.
