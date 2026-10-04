**Разбор:**
Часть 01 вернулась из добора с исправленным пустым блоком; по Шагу 3.5 правилу «После добора — склейка заново; перезапуск склейки бюджет не тратит» нужно пересклеить весь сервис и переменить check.sh по объединённым файлам. Прежде проверю свежесть файлов части 01.

**ДЕЙСТВИЕ:**
Glob path="services/.work/library-loans" pattern="part-01*"

**ДЕЙСТВИЕ:**
Grep path="services/.work/library-loans/part-01.opis.md" pattern="^<!-- service-map: часть 01 2026-10-04 -->"

Если оба файла существуют и первая строка соответствует:

**ДЕЙСТВИЕ:**
Bash: запустить `bash ../reference/assemble.sh "services/.work/library-loans" 4 2026-10-04 "services/.work/library-loans.md" "services/.work/library-loans.opis.md"` и вернуть вывод

**ДЕЙСТВИЕ:**
Glob path="services" pattern="library-loans.md"

**ДЕЙСТВИЕ:**
Если найдена прежняя карточка: `bash ../reference/check.sh "services/.work/library-loans.opis.md" "services/.work/library-loans.md" "services/library-loans.md"` и вернуть вывод полностью; если нет — без третьего аргумента

После получения вывода check.sh: проверить по Шагу 4 гейты (опись сама с собой, маркерный, полнота инвентаря, семантика, источники, пустота, остальные). По результату — добор либо гард, либо продвижение.

---

**РЕШЕНИЕ: СКЛЕЙКА ЗАНОВО**