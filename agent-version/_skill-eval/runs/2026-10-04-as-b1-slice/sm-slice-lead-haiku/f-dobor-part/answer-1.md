**Разбор**

Check.sh выявил ключ `POST /api/visits/:id/cancel`: факт в описи есть, блок в черновике пустой. Греп по `part-*.opis.md` назвал номер — `part-02.opis.md:17`. По правилам 3.4 для нарезанных сервисов добор правит ту часть, чей ключ. Часть 02 прогонялась один раз, бюджет (два на часть) позволяет добор — это второй прогон. Перечень для добора: ключ `POST /api/visits/:id/cancel`, блок в черновике пуст, факт в описи есть.

**Действия**

ДЕЙСТВИЕ: запусти читающего субагента для части 02 с брифом части 02 (NN = 02, пути и файлы из плана) плюс блок Добор; перечень: `POST /api/visits/:id/cancel — блок в черновике пуст, в описи факт; добавить содержание блока`

ДЕЙСТВИЕ: проверь возврат по первой строке файла `services/.work/vetclinic-api/part-02.md` — `<!-- service-map: часть 02 <дата> -->`

ДЕЙСТВИЕ: запусти `assemble.sh` заново: `bash "<…/reference/assemble.sh>" "services/.work/vetclinic-api" <S+1> 2026-10-04 "services/.work/vetclinic-api.md" "services/.work/vetclinic-api.opis.md"`

ДЕЙСТВИЕ: запусти `check.sh` по сводным файлам: `bash "<…/reference/check.sh>" "services/.work/vetclinic-api.opis.md" "services/.work/vetclinic-api.md" "<путь прежней карточки если есть>"`

**РЕШЕНИЕ: ДОБОР — часть 02**