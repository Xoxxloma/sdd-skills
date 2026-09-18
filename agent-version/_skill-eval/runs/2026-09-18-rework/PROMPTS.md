# Промпты раунда

Гейт: `run-sm-gate.sh` режет текст скилла по якорям из указанного `SKILL.md` перед каждым вариантом;
снимок текста каждого плеча лежит в `sm-gate*/_skill-snapshot.md`. Финальный — `_skills/service-map.SKILL.md`.

Тир A: `make-sm86-prompt.sh <SKILL.md> <card.template.md> fixtures/SM-SWITCH{,2}/repo.md /work/navigator-api "navigator, consolidate, dispatch-web"`.
Промежуточные промпты пассов 1–2 удалены (восстанавливаются из `sm-gate*/_skill-snapshot.md` того же
времени), финальные — `prompt-switch-3.md`, `prompt-switch2-3.md`, собраны из `_skills/`.
