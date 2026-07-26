# FE-DESIGN-CHAKRA — state A, НЕ-MUI библиотека (агностик-проба)

Chakra UI + проектная тема → **state A**. Проверка: документирует РЕАЛЬНУЮ систему (Chakra),
ноль утечки MUI (`createTheme`/`@mui`/`sx`-как-MUI не появляются).

## Дерево
```
src/
  theme.ts                     # extendTheme({...}) — Chakra
  main.tsx                     # <ChakraProvider theme={theme}>
  components/PriceField.tsx     # проектная обёртка вместо Chakra Input для цены
```

## package.json
```json
{ "dependencies": { "react": "18.3.0", "@chakra-ui/react": "2.8.0", "@emotion/react": "11.11.0", "framer-motion": "11.0.0" } }
```

## src/theme.ts
```ts
export const theme = extendTheme({
  colors: { brand: { 500: "#128A6B" } },
  space: { px: "1px", 1: "4px", 2: "8px" },
  radii: { md: "12px" },
  fonts: { body: "Manrope, sans-serif" },
});
```

## Ключевое
- Система-источник: Chakra UI, тема через `extendTheme` в `src/theme.ts`, провайдер `ChakraProvider`.
- `PriceField` — проектная замена Chakra `Input` для ввода цены (registry-девиация).
- init-файл `CLAUDE.md` в корне (без Design-указателя).

## Ответы пользователя (гейты пройдены)
- Система-источник? Да, Chakra + `src/theme.ts`.
- Аудитория/тон: b2b-дашборд аналитика; тон — спокойный, профессиональный.
- Бренд: `brand.500` = `#128A6B`.
