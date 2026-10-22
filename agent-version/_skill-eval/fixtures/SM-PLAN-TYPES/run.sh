#!/usr/bin/env bash
# SM-PLAN-TYPES — plan.sh по типу сервиса и клиентская спека; таблица формы keys.awk против шаблона.
# Моделей не запускает: дерево с содержимым файлов собирается во временной папке, plan.sh — по нему.
#   bash run.sh [папка reference скилла] — печатает ОК или что разошлось. KEEP=1 — не удалять папку.
# Случаи: (а) frontend — «контракт» отброшен, «экраны» в итоге, нарезки нет; (б) backend вес 40 — части,
# fullstack вес 40 — нарезки нет; (в) клиентская спека объявлена — по ней ни «СПЕКА НЕ РАЗМЕЧЕНА», ни строк
# «операция», а неназванная серверная в том же дереве — в сверке; (г) спека не названа никак — «СПЕКА НЕ РАЗМЕЧЕНА» и строки «операция» (страховка серверной);
# (д) серверная `ключ` + клиентская объявлена — «операция» только серверной; (е) тип пустой и без
# аргумента — вывод одинаков; (ж) k_typesecs — как таблица порядка секций card.template.md.
HERE="$(cd "$(dirname "$0")" && pwd)"
REF="${1:-$HERE/../../../service-map-2.0/reference}"
PLAN="$REF/plan.sh"
OUT="$(mktemp -d)"; if [ -n "${KEEP:-}" ]; then echo "временная папка: $OUT"; else trap 'rm -rf "$OUT"' EXIT; fi
bad=0
has() { grep -q -F -- "$1" "$2" || { echo "нет строки ($3): $1"; bad=1; }; }
hasnt() { ! grep -q -F -- "$1" "$2" || { echo "лишняя строка ($3): $1"; bad=1; }; }
count() { local n; n=$(grep -c -- "$1" "$2"); [ "$n" -eq "$3" ] || { echo "строк «$1» ($4): $n, ждали $3"; bad=1; }; }

S="$OUT/svc"
mkdir -p "$S/web/src" "$S/api/a" "$S/api/b" "$S/spec" "$S/clients"
printf 'export const routes = [];\n' > "$S/web/src/App.jsx"
printf 'class A {}\n' > "$S/api/a/A.java"; printf 'class B {}\n' > "$S/api/b/B.java"
cat > "$S/spec/server.yaml" <<'EOF'
openapi: 3.0.1
paths:
  /nights:
    get:
      operationId: listNights
  /nights/{id}:
    get:
      operationId: getNight
EOF
cat > "$S/clients/weather-feed.yaml" <<'EOF'
openapi: 3.0.1
paths:
  /forecast:
    get:
      operationId: getForecast
  /cloud-alerts:
    get:
      operationId: getCloudAlerts
  /stations:
    get:
      operationId: getStations
EOF

run() {  # run <имя> <counts> [тип] — вывод в <имя>.out, план в <имя>.tsv
  local name="$1" counts="$2"; shift 2
  bash "$PLAN" "$counts" 30 1 "$S" "$OUT/$name.tsv" "$@" > "$OUT/$name.out" 2>&1
}

# (а) frontend: роуты, названные «контрактом», отброшены; «экраны» — в итоге; нарезки нет
cat > "$OUT/front.txt" <<EOF
## контракт :: \.get\( :: *.jsx :: ключ
$S/web/src/App.jsx:24
## экраны :: <Route\b :: *.jsx :: ключ
$S/web/src/App.jsx:9
## контроль :: контракт :: $S/web/src/App.jsx :: 24
EOF
run front "$OUT/front.txt" frontend
has "итог по классам: экраны 9" "$OUT/front.out" "а"
has "класс контракт: у типа frontend секции нет — пометок 24, не считаются" "$OUT/front.out" "а"
has "нарезка не нужна: тип frontend не режется" "$OUT/front.out" "а"
hasnt "УЗКИЙ МАРКЕР" "$OUT/front.out" "а"
count '^итог	контракт' "$OUT/front.tsv" 0 "а"
count '^итог	экраны	9' "$OUT/front.tsv" 1 "а"

# (а2) frontend и спеки в дереве: операции спеки — ключи контракта, у фронта их не ищут вовсе — ни
# «СПЕКА НЕ РАЗМЕЧЕНА», ни строк «операция», даже если разведчик назвал спеку «контрактом»
cat > "$OUT/front-spec.txt" <<EOF
## контракт :: ^\s+operationId: :: *.yaml :: $S/spec/server.yaml :: ключ
$S/spec/server.yaml:2
## экраны :: <Route\b :: *.jsx :: ключ
$S/web/src/App.jsx:9
EOF
run front-spec "$OUT/front-spec.txt" frontend
hasnt "СПЕКА НЕ РАЗМЕЧЕНА" "$OUT/front-spec.out" "а2"
count '^операция' "$OUT/front-spec.tsv" 0 "а2"
has "класс контракт: у типа frontend секции нет — пометок 2, не считаются" "$OUT/front-spec.out" "а2"

# (б) backend вес 40 — части; fullstack вес 40 — нарезки нет
cat > "$OUT/heavy.txt" <<EOF
## контракт :: @GetMapping\b :: *.java :: ключ
$S/api/a/A.java:20
$S/api/b/B.java:20
EOF
run heavy-back "$OUT/heavy.txt" backend
has "вес сервиса 40 при K=30" "$OUT/heavy-back.out" "б backend"
run heavy-full "$OUT/heavy.txt" fullstack
has "нарезка не нужна: тип fullstack не режется (вес 40)" "$OUT/heavy-full.out" "б fullstack"
count '^часть' "$OUT/heavy-full.tsv" 0 "б fullstack"

# (в) клиентская спека объявлена — не сверяется; серверная в том же дереве не названа — страховка остаётся
cat > "$OUT/client.txt" <<EOF
## контракт :: @GetMapping\b :: *.java :: ключ
$S/api/a/A.java:2
## клиентская спека :: $S/clients/weather-feed.yaml
EOF
run client "$OUT/client.txt" backend
hasnt "weather-feed.yaml" "$OUT/client.out" "в"
has "СПЕКА НЕ РАЗМЕЧЕНА: $S/spec/server.yaml" "$OUT/client.out" "в"
count '^операция' "$OUT/client.tsv" 2 "в"
count 'getForecast' "$OUT/client.tsv" 0 "в"
has "итог по классам: контракт 2" "$OUT/client.out" "в"

# (г) спека не названа никак — страховка: предупреждение и все операции дерева в сверку
cat > "$OUT/silent.txt" <<EOF
## контракт :: @GetMapping\b :: *.java :: ключ
$S/api/a/A.java:2
EOF
run silent "$OUT/silent.txt" backend
has "СПЕКА НЕ РАЗМЕЧЕНА" "$OUT/silent.out" "г"
count '^операция' "$OUT/silent.tsv" 5 "г"

# (д) серверная `ключ` + клиентская объявлена — операции только серверной
cat > "$OUT/both.txt" <<EOF
## контракт :: ^\s+operationId: :: *.yaml :: $S/spec/server.yaml :: ключ
$S/spec/server.yaml:2
## клиентская спека :: $S/clients/weather-feed.yaml
EOF
run both "$OUT/both.txt" backend
count '^операция' "$OUT/both.tsv" 2 "д"
count 'getForecast' "$OUT/both.tsv" 0 "д"

# (е) без типа и с пустым типом — один и тот же вывод (поведение до правки: классы все, нарезка по весу)
run notype "$OUT/heavy.txt"; run emptytype "$OUT/heavy.txt" ""
cmp -s "$OUT/notype.out" "$OUT/emptytype.out" || { echo "е: вывод без типа и с пустым типом различается"; bad=1; }
has "вес сервиса 40 при K=30" "$OUT/notype.out" "е"

# (ж) таблица формы keys.awk — как таблица порядка секций шаблона (секции классов пометок)
awk "$(cat "$REF/keys.awk")"'
  function cell(s) { gsub(/`/, "", s); gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  /^\| `backend` \| `frontend` \|/ { on = 1; n = split($0, h, "|"); for (i = 2; i < n; i++) ty[i] = cell(h[i]); next }
  on && /^\|[ \t:|-]*$/ { next }
  on && /^\|/ { n = split($0, c, "|"); for (i = 2; i < n; i++) { s = cell(c[i]); if (s != "—" && k_cls(s) ~ /^(контракт|сущности|задачи|топики|экраны|потребляет|состояние)$/) tpl[ty[i]] = tpl[ty[i]] "|" s } ; next }
  on && !/^\|/ { on = 0 }
  function norm(l,   a, n, i, j, t) { n = split(l, a, "|"); for (i = 2; i <= n; i++) for (j = i + 1; j <= n; j++) if (a[j] < a[i]) { t = a[i]; a[i] = a[j]; a[j] = t }; l = ""; for (i = 1; i <= n; i++) if (a[i] != "") l = l "|" a[i]; return l }
  END {
    split("backend frontend fullstack lib", T, " ")
    for (i = 1; i <= 4; i++) { t = T[i]; a = norm(tpl[t]); b = norm("|" k_typesecs(t))
      if (a != b) { printf "ж: тип %s — шаблон %s, keys.awk %s\n", t, a, b; bad = 1 } }
    exit bad
  }' "$REF/card.template.md" || bad=1

[ "$bad" -eq 0 ] && echo "ОК" || { echo "разошлось — см. выше"; exit 1; }
