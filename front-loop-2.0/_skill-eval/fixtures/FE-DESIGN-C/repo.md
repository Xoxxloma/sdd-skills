# FE-DESIGN-C — state C: проектные токены БЕЗ UI-библиотеки

Tailwind с кастомными токенами, НЕТ компонентной библиотеки → **state C**. Проверка: state=C
(не путает с A/B), документирует проектные токены, НЕ навязывает библиотечный концепт, НЕ
выдумывает `createTheme`.

## Дерево
```
src/
  main.tsx
  components/                  # свои компоненты на tailwind-классах, без UI-библиотеки
tailwind.config.ts
src/index.css                  # @tailwind base/components/utilities
```

## package.json
```json
{ "dependencies": { "react": "18.3.0" },
  "devDependencies": { "tailwindcss": "3.4.0", "postcss": "8.4.0", "autoprefixer": "10.4.0" } }
```
Никакого `@mui`, `@chakra-ui`, `antd`.

## tailwind.config.ts (фрагмент)
```ts
export default {
  theme: { extend: {
    colors: { accent: "#6D28D9", surface: "#0B1020" },
    spacing: { xs: "4px", sm: "8px", md: "16px" },
    borderRadius: { card: "14px" },
    fontFamily: { sans: ["Inter Tight", "sans-serif"] },
  } },
};
```

## Ключевое
- Источник — **проектные токены Tailwind** в `tailwind.config.ts` (extend). Библиотеки компонентов нет.
- Компоненты свои, стилизованы tailwind-классами (`bg-accent`, `rounded-card`, `p-md`).
- init-файл `CLAUDE.md` в корне.

## Ответы пользователя (гейты пройдены)
- Состояние: верно, библиотеки нет, но есть Tailwind-токены — это источник.
- Аудитория/тон: продукт для разработчиков; тон — тёмный, техно.
