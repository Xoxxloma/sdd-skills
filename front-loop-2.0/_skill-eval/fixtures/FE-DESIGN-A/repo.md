# FE-DESIGN-A — state A fixture (library + project theme)

Для design-baseline: библиотека MUI + собственная тема проекта → **state A**.

## Файловое дерево
```
src/
  theme.ts                     # createTheme(...) — кастомная палитра/spacing/typography
  main.tsx                     # ThemeProvider theme={theme}
  components/
    NumberInput.tsx            # проектная обёртка: числовой ввод вместо MUI TextField
    OrderCard.tsx
```

## package.json (фрагмент)
```json
{ "dependencies": { "react": "18.3.0", "@mui/material": "5.15.0", "@emotion/react": "11.11.0" } }
```

## src/theme.ts (фрагмент)
```ts
export const theme = createTheme({
  palette: { primary: { main: "#2E5AAC" }, background: { default: "#F7F8FA" } },
  spacing: 8,
  shape: { borderRadius: 10 },
  typography: { fontFamily: "Golos Text, sans-serif" },
});
```

## Ключевое
- Система-источник: MUI 5, темизирована в `src/theme.ts` (createTheme).
- `NumberInput` — проектная замена MUI TextField для числового ввода (registry-девиация).
- Есть init-файл `CLAUDE.md` в корне (без Design-указателя).

## Ответы пользователя (гейты пройдены)
- **Это система-источник?** Да, MUI 5 + `src/theme.ts` — канон.
- **Аудитория/тон:** внутренний инструмент операторов; тон — деловой, плотный, без украшательств.
- **Бренд:** только primary `#2E5AAC`.
