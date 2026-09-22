Манифест `services/manifest.yaml`: `auth`, `geo`, `billing` (все `backend`). Аргументы запуска: `--refresh` НЕ передан, имён нет.

`Glob services/*.md` → `services/auth.md`, `services/geo.md`
`Glob services/_pending/*.md` → `services/_pending/geo.md`, `services/_pending/billing.md`

Из каких файлов на Шаге 5 достанешь строки «Потребляемые API» и «Зависит от»? Последней строкой ответа — ровно: `ИСТОЧНИКИ ШАГА 5: <имена файлов через запятую>`.
