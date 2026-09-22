Манифест `services/manifest.yaml`: `auth`, `geo`, `billing` (все `backend`). Аргументы запуска: `--refresh`.

`Glob services/*.md` → `services/auth.md`, `services/geo.md`
`Glob services/_pending/*.md` → `services/_pending/billing.md`

Черновик `billing` прошёл проверки; прежней карточки `services/billing.md` нет. Куда идёт продвижение и что ты делаешь со старым `services/_pending/billing.md`? Последней строкой — ровно: `СТАРЫЙ КАНДИДАТ: ОСТАВЛЯЮ` либо `СТАРЫЙ КАНДИДАТ: УДАЛЯЮ` либо `СТАРЫЙ КАНДИДАТ: ПЕРЕЗАПИСЫВАЮ`.
