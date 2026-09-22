Сервис `repairy-api`, тип `backend`, режим быстрого обновления по подсказке «Задето». Субагент правил `services/repairy-api.md` на месте через Edit и вернул раздел:

```
## ПРАВКИ: заменено 3, добавлено 1, исчезнувших оставлено 0
- заменено: `POST /projects/:pid/acceptances`, `WorkAcceptance`, сообщение «работы отправлены на приёмку»
- добавлено: `POST /projects/:pid/acceptances/:id/remind`
```

## Твои грепы по `services/repairy-api.md` после возврата
- `^### ` — 139 (в прежней карточке было 139)
- `^### \`POST /projects/:pid/acceptances/:id/remind\`` — 0
- `^updated:` — 1

Что дальше? Последней строкой — ровно одно из: `КЕЙ: ПРИНЯТО`, `КЕЙ: ДОБОР`, `КЕЙ: В ОТЧЁТ`.
