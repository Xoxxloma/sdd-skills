# Оператор-кабинет — Design Document

> Живой источник правды по дизайну. Система-источник — библиотека + тема проекта.
> Значения берутся из неё, не изобретаются.

## Metadata
- Created: 2026-06-02
- System of record: Chakra UI 2 + тема проекта
- Theme / tokens location: `src/theme.ts`
- Analyzed at commit: a1b2c3d

## System of Record
- State: A — library + project theme
- Library / version: Chakra UI 2
- Theme / token source: `src/theme.ts` (`extendTheme`)
- Provider / setup location: `src/app/providers.tsx`
- How the project customizes it: `extendTheme` — palette `brand`, spacing по шкале Chakra,
  `radii.md` переопределён.

## Design Domains (sourced from the system of record)
- Typography: варианты темы (`heading`, `body`, `caption`) из `src/theme.ts`
- Color: палитра `brand.50…900` + семантические `bg.surface`, `text.muted`
- Spacing: шкала Chakra (`space` 1–12), шаг 4px
- Visual details: `radii.md`, `shadows.card`
- Motion: `transition.duration.normal`

## Components
- Library / system components in use: Chakra `Button`, `Table`, `Modal`, `Checkbox`, `Select`
- Project wrappers: `PriceField` (обёртка над `Input` с форматированием суммы)

### Component Registry (deviations — project component preferred over the library)

| Need | Use this project component | Instead of |
|------|----------------------------|------------|
| Выбор оператора | `OperatorPicker` (`shared/ui/OperatorPicker.tsx`) | Chakra `Select` |
| Числовой ввод | `NumberInput` (`shared/ui/NumberInput.tsx`) | Chakra `Input` |
| Сумма / деньги | `PriceField` | Chakra `Input` |

## Design Context (from the user, not the code)
- Target audience & usage context: операторы поддержки, работа целый день в одном окне
- Tone / product personality: профессиональный b2b-дашборд, без декора
- Brand constraints: палитра `brand` фиксирована
- Priority surfaces: экран заказов

## Conventions
- Naming / file layout for UI: компоненты фичи — в `features/<name>/`, общие — в `shared/ui/`
- How new components are added: сначала проверить Registry и `shared/ui`, потом библиотеку
- Rule for non-standard elements: собирать из Chakra-примитивов с токенами темы; новые
  значения не изобретать.

## Known Drift
- В `features/limits/LimitForm.tsx` два хардкодных отступа `12px` вместо шкалы `space`.
