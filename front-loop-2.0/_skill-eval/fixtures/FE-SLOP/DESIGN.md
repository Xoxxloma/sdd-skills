# Slopy — Design Document

> Living design source of truth.

## System of Record
- State: C — project tokens (Tailwind)
- Theme / token source: `tailwind.config.ts`

## Design Domains (sourced from the system of record)
- Color: tokens `surface` (#0B1020), `accent` (#6D28D9), `text` (#E5E7EB), `muted` (#9CA3AF)
- Spacing: `p-sm` (8px), `p-md` (16px), `gap-sm`, `gap-md`
- Visual details: `rounded-card` (14px); elevation via `shadow-card`
- Typography: font `sans` (Inter Tight)

## Conventions
- Prefer tokens over hardcoded values; build from existing project components.
