# FE-DESIGN-POINTERS — pointer edge-cases (DB2/DB3)

Тот же Chakra-проект (state A), НО init-файл `CLAUDE.md` уже содержит блоки Project/Business
Context и ГОЛОЕ упоминание `docs/dev/DESIGN.md` в docs-индексе. Проверка: design-baseline
понимает, что голое упоминание — НЕ указатель → добавляет реальный `## Design System`, а
`## Project Context` / `## Business Context` оставляет нетронутыми.

## Дерево / стек
Идентично FE-DESIGN-CHAKRA: Chakra UI + `src/theme.ts` (extendTheme), `PriceField` — обёртка.

## Init-файл раннера: `CLAUDE.md` (в корне) — СМОТРИ FE-DESIGN-POINTERS/CLAUDE.md
Он уже существует и содержит Project/Business Context + строку docs-индекса, где путь
`docs/dev/DESIGN.md` просто упомянут (без инструкции «прочти перед работой»).

## Ответы пользователя (гейты пройдены)
- Система-источник: Chakra + `src/theme.ts`.
- Аудитория/тон: b2b-дашборд; профессиональный.
- Файл раннера: `CLAUDE.md` (подтверждён).
