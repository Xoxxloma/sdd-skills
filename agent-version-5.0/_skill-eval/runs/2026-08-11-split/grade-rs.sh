#!/usr/bin/env bash
# grade-rs.sh — грейд прогонов `repo-split`.
#
#   ./grade-rs.sh [каталог песочниц]
#
# Артефакт скилла один — строки манифеста, и появляются они только после «да». Поэтому
# `rs-mono`/`rs-front` грейдятся ПО ТЕКСТУ предложения, а `rs-write` — ПО ДИСКУ.
#
# ЧИСЛА СВЕРЯЮТСЯ С `expected.md` ФИКСТУРЫ, а не с самим прогоном. Пилот 2026-08-11 показал,
# зачем: ответ печатал «сумма сошлась ✓» при полностью потерянной папке, потому что общее
# число было получено сложением найденного.
#
# ТРИ ПРАВИЛА ГРЕЙДА (все три поймал пилот на себе):
#   1. нет артефакта → «не измерено», а не «провалено»;
#   2. запрещающая проверка на пустом месте зелёной не бывает;
#   3. текстовый якорь требует ЧИСЛА, а не слова («связность» зеленела на «импорты не найдены»).
#
# Запускать только после завершения ВСЕХ прогонов.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/sandbox}"

pass() { printf '  \033[32mOK  \033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m—   \033[0m %s\n' "$1"; }
note() { printf '       %s\n' "$1"; }
tot_ok=0; tot_fail=0; tot_skip=0
chk()  { if [ "$1" = 1 ]; then pass "$2"; tot_ok=$((tot_ok+1)); else fail "$2"; tot_fail=$((tot_fail+1)); fi; }
miss() { skip "$1 — не измерено"; tot_skip=$((tot_skip+1)); }

# число в тексте в пределах ±20% от ожидаемого
near() { # $1 файл, $2 ожидание
  awk -v want="$2" '
    { while (match($0, /[0-9]+/)) {
        v = substr($0, RSTART, RLENGTH) + 0
        if (v >= want*0.8 && v <= want*1.2) { found=1 }
        $0 = substr($0, RSTART+RLENGTH) } }
    END { print (found ? 1 : 0) }' "$1"
}

grade_proposal() {  # $1 песочница, $2 репа, $3 всего ключей, $4 сквозные(рег), $5 ловушка(рег), $6 тип
  sb="$1"; repo="$2"; K="$3"; cross_re="$4"; trap_re="$5"; want_type="$6"
  A="$sb/answer.md"; M="$sb/w/specs/services/manifest.yaml"

  # RS-1 — по диску: манифест обязан быть цел
  if [ -f "$M" ] && ! grep -q "$repo-" "$M"; then chk 1 "RS-1 манифест не тронут до ответа"
  else chk 0 "RS-1 манифест тронут до ответа"; fi

  # RS-3 — кусков 3–5 В ОДНОМ ВАРИАНТЕ.
  # Ответ содержит два варианта; уникальные имена по всему файлу дают их сумму (было 8).
  # Имена кусков бывают составными (`frontdesk-fleet-reports`) — регулярка обязана допускать
  # дефисы, иначе один кусок считается за два и RS-3 краснеет на верном разрезе.
  n=$(awk -v re="${repo}-[a-z]+(-[a-z]+)*" '
    /[Вв]ариант/ { for (k in seen) delete seen[k]; c=0 }
    { s=$0
      while (match(s, re)) {
        nm = substr(s, RSTART, RLENGTH)
        if (!(nm in seen)) { seen[nm]=1; c++ }
        s = substr(s, RSTART+RLENGTH)
      }
      if (c > max) max = c }
    END { print max+0 }' "$A")
  chk "$([ "$n" -ge 3 ] && [ "$n" -le 5 ] && echo 1 || echo 0)" "RS-3 кусков 3–5 (насчитано $n)"

  # RS-4 — сквозные названы и куском не стали
  c=0; grep -qiE 'сквозн' "$A" && c=1
  chk "$c" "RS-4 сквозные названы"
  bad=0; grep -qE "$repo-($cross_re)\b" "$A" && bad=1
  chk "$([ "$bad" -eq 0 ] && echo 1 || echo 0)" "RS-4b сквозная не предложена куском"

  # RS-5 — ловушка (папка с ключами вне основного дерева) названа
  t=0; grep -qE "$trap_re" "$A" && t=1
  chk "$t" "RS-5 ловушка ($trap_re) названа, не потеряна молча"

  # RS-9/RS-16 — общее число названо и близко к посчитанному независимо
  chk "$(near "$A" "$K")" "RS-16 общее число ≈ $K (сверка с expected.md)"

  # RS-10 — связность предъявлена ЧИСЛАМИ
  m=0; grep -qE '[a-z][a-z-]* *(↔|→|->|--) *[a-z][a-z-]*[^0-9]{0,10}[0-9]+' "$A" && m=1
  none=0; grep -qiE '(ссыл|импорт)[а-я]* .{0,30}не (найден|обнаружен|удалось)' "$A" && none=1
  if [ "$m" -eq 1 ]; then chk 1 "RS-10 связность предъявлена числами"
  elif [ "$none" -eq 1 ]; then chk 0 "RS-10 связность не посчитана (прогон сам сообщил)"
  else chk 0 "RS-10 связность не предъявлена"; fi

  # RS-14 — тип кусков выведен по ключам
  ty=0; grep -qiE "$want_type" "$A" && ty=1
  chk "$ty" "RS-14 тип кусков — $want_type"

  # RS-7 — числа названы, лимит не выдуман
  lim=0; grep -qiE 'мерено|неизвестн|порога нет' "$A" && lim=1
  chk "$lim" "RS-7 сказано, что порога нет / предел не мерен"

  note "строка «не вошло»: $(grep -ciE 'не вошло' "$A")"
}

for sb in "$OUT"/rs-mono-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  echo "== $(basename "$sb")  (RS-MONO, бэк)"
  grade_proposal "$sb" rentalcore 389 'common|exceptions|config' 'controllers' 'backend'
  # RS-12 — события посчитаны: инфра не уехала в сквозные
  ev=1
  grep -qiE 'сквозн[а-я]*[^.]*(integrations|notifications)' "$sb/answer.md" && ev=0
  grep -qiE '(integrations|notifications)[^.]*сквозн' "$sb/answer.md" && ev=0
  chk "$ev" "RS-12 события посчитаны (integrations/notifications не в сквозных)"
  # RS-6 — домен без сущностей не выброшен
  r=0; grep -qE 'reporting' "$sb/answer.md" && r=1
  chk "$r" "RS-6 reporting в разрезе"
done

for sb in "$OUT"/rs-front-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  echo "== $(basename "$sb")  (RS-FRONT, фронт)"
  grade_proposal "$sb" frontdesk 200 'ui|utils' 'lib/api|api' 'frontend'
  # RS-13 — экраны посчитаны (ключ = имя файла, а не греп по содержимому)
  chk "$(near "$sb/answer.md" 129)" "RS-13 экраны посчитаны (≈129, не 258)"
  # RS-5b — слой клиентов чужих API не объявлен сквозным: там 30 ключей
  ap=1
  grep -qiE 'сквозн[^.]{0,80}\bapi\b' "$sb/answer.md" && ap=0
  grep -qiE '\bapi\b[^.]{0,40}сквозн' "$sb/answer.md" && ap=0
  chk "$ap" "RS-5b lib/api не объявлена сквозной (в ней 30 ключей)"
done

# --- rs-write: что записано на диск -------------------------------------------
for sb in "$OUT"/rs-write-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  echo "== $(basename "$sb")  (грейд по диску)"
  M="$sb/w/specs/services/manifest.yaml"
  [ -f "$M" ] || { chk 0 "RS-8 манифеста нет"; continue; }
  g=0; grep -qE '^\s*-\s*name:\s*geo\s*$' "$M" && grep -qE 'path:\s*\.\./geo-service' "$M" && g=1
  chk "$g" "RS-8a прежняя строка geo цела"
  nt=$(grep -c 'notes:' "$M")
  chk "$([ "$nt" -eq 0 ] && echo 1 || echo 0)" "RS-8b notes у новых строк не выведено ($nt)"
  lg=$(grep -n 'name: geo' "$M" | head -1 | cut -d: -f1)
  lr=$(grep -n 'name: rentalcore-' "$M" | head -1 | cut -d: -f1)
  if [ -n "$lg" ] && [ -n "$lr" ]; then
    chk "$([ "$lg" -lt "$lr" ] && echo 1 || echo 0)" "RS-8c новые строки в конце"
  else chk 0 "RS-8c порядок строк не определить"; fi
  yl=$(grep -cE '^\s*path:\s*$' "$M")
  chk "$([ "$yl" -eq 0 ] && echo 1 || echo 0)" "RS-11 path не списком YAML ($yl)"
  note "строк path с запятой: $(grep -cE '^\s*path:.*,' "$M"); кусков: $(grep -c 'name: rentalcore-' "$M")"
done

# --- rs-small: анти-овертриггер ------------------------------------------------
for sb in "$OUT"/rs-small-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  echo "== $(basename "$sb")"
  M="$sb/w/specs/services/manifest.yaml"; A="$sb/answer.md"
  cut=0; grep -qE 'tariff-api-' "$M" 2>/dev/null && cut=1
  chk "$([ "$cut" -eq 0 ] && echo 1 || echo 0)" "RS-2a малая репа не разрезана в манифесте"
  said=0; grep -qiE 'разрез не ну|одним сканом|резать не' "$A" && said=1
  chk "$said" "RS-2b сказано, что разрез не нужен"
done


# --- rs-alien: незнакомый стек → образцы и вопрос, а не отказ ------------------
for sb in "$OUT"/rs-alien-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  echo "== $(basename "$sb")  (RS-ALIEN, стек вне таблиц)"
  A="$sb/answer.md"; M="$sb/w/specs/services/manifest.yaml"
  refuse=0; grep -qiE 'не опознан.{0,40}(невозмож|отказ)|разрез невозмож' "$A" && refuse=1
  chk "$([ "$refuse" -eq 0 ] && echo 1 || echo 0)" "RS-15a не отказался из-за незнакомого стека"
  # RS-15b переформулирована после круга 3: скилл требует образцы и вопрос ТОЛЬКО когда ни один
  # маркер не сработал. На Rust агент вывел признак сам (`pub async fn`) — это не нарушение
  # правила, а его обход сверху. Гейт: признак, по которому считали, должен быть НАЗВАН —
  # либо образцами с вопросом, либо явным «считал по такому-то признаку».
  samp=0; grep -qE '(pub async fn|FromRow|fn [a-z_]+\(|признак|маркер|считал по)' "$A" && samp=1
  chk "$samp" "RS-15b признак подсчёта назван (образцами или явно)"
  wrote=0; grep -qE 'ledger-core-' "$M" 2>/dev/null && wrote=1
  chk "$([ "$wrote" -eq 0 ] && echo 1 || echo 0)" "RS-15d манифест не тронут"
done

echo
echo "ИТОГО: OK $tot_ok / FAIL $tot_fail / не измерено $tot_skip"
echo "Числа сверены с expected.md фикстур; правильность границ оценивает человек."
