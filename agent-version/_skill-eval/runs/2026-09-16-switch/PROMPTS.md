# Промпты раунда

Промпты тира A в репозитории не хранятся: каждый собирается `make-sm86-prompt.sh` из текста скилла,
шаблона и фикстуры, и хранить его — дублировать фикстуру четыре раза.

| Плечо | `SKILL.md` | `card.template.md` |
|---|---|---|
| `before` | `git show 3c25438:agent-version/service-map/SKILL.md` | `git show 3c25438:agent-version/service-map/reference/card.template.md` |
| `after`, `after2` | промежуточные тексты, описаны в `STATE.md` («Что менялось между плечами») | — |
| `after3` | `_skills/service-map.SKILL.md` (= текст коммита) | `_skills/card.template.md` |

Аргументы одинаковые у всех плеч: сервис `/work/navigator-api`, тип `backend`, имена манифеста
`navigator, consolidate, dispatch-web`. Путь к шаблону в промпт идёт абсолютным — субагент читает
его с диска.
