Манифест `services/manifest.yaml`: `auth`, `geo`, `billing` (все `backend`). Аргументы запуска: ничего: ни имён, ни `--refresh`.

`Glob services/*.md` → `services/auth.md`, `services/geo.md`
`Glob services/_pending/*.md` → `services/_pending/billing.md`

Шаг 2.2: кого перечитывать в этом прогоне? Последней строкой — ровно: `ПЕРЕЧИТАТЬ: <имена через запятую или «никого»>`.
