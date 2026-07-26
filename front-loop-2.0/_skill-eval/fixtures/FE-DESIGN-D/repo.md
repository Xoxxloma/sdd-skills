# FE-DESIGN-D — state D fixture (no library, no token system)

Для design-baseline: НЕТ UI-библиотеки и НЕТ токен-системы → **state D**. Проверка: скилл
НЕ изобретает домены, ставит `TBD`, шлёт в generate-theme, НЕ регистрирует указатель.

## Файловое дерево
```
src/
  main.tsx
  App.tsx
  components/
    Card.tsx                   # <div style={{ padding: 16, background: "#fff" }}>
    Button.tsx                 # <button style={{ borderRadius: 4, background: "#3366ff" }}>
  styles.css                   # разрозненные хардкод-значения, без переменных
```

## package.json (фрагмент)
```json
{ "dependencies": { "react": "18.3.0", "react-dom": "18.3.0" } }
```
Никакого `@mui`, `antd`, `tailwindcss`. `styles.css` — обычный CSS с хардкод-hex и px,
без CSS custom properties и без design-token модуля.

## Ключевое
- UI-библиотеки нет; токен-системы (Tailwind/CSS-vars/theme-файла) нет.
- Значения (цвета, отступы, радиусы) захардкожены inline и в `styles.css`.
- Есть init-файл `CLAUDE.md` в корне.

## Ответы пользователя (гейты пройдены)
- **Подтверждение состояния:** верно, ни библиотеки, ни токенов нет.
- **Аудитория/тон:** лендинг для стартапа; тон — дружелюбный, современный.
