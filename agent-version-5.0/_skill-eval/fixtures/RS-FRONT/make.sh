#!/usr/bin/env bash
# Генератор фикстуры RS-FRONT — фронтовый монолит, который не берётся одним сканом.
#
# Стек намеренно НЕ тот, что в первых строках таблиц скилла: SvelteKit с файловой
# маршрутизацией. Ключи здесь считаются ИМЕНАМИ ФАЙЛОВ (`+page.svelte`), а не грепом по
# аннотациям — если скилл умеет только грепать содержимое, фронт он не посчитает вовсе.
#
# Ловушка, парная к `src/controllers` в RS-MONO: ВСЕ вызовы чужих API лежат в `src/lib/api/`,
# вне разделов роутов. Разрез по одним роутам теряет весь слой интеграции молча.
#
# Вызов:  ./make.sh <куда>      →  <куда>/frontdesk/ и <куда>/specs/
set -eu
OUT="${1:-./out}"
R="$OUT/frontdesk"
rm -rf "$OUT"; mkdir -p "$R/src/routes" "$R/src/lib" "$OUT/specs/services"
mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"

cat > "$R/package.json" <<'EOF'
{ "name": "frontdesk", "private": true,
  "scripts": { "dev": "vite dev", "build": "vite build" },
  "devDependencies": { "@sveltejs/kit": "*", "svelte": "*", "vite": "*" } }
EOF
cat > "$R/svelte.config.js" <<'EOF'
import adapter from '@sveltejs/adapter-node';
export default { kit: { adapter: adapter() } };
EOF

# --- разделы роутов: <раздел> <экранов> <сторов> ------------------------------------
SECTIONS="
orders 40 12
fleet 25 8
customers 18 6
billing 15 5
reports 12 4
admin 10 3
settings 6 2
auth 3 1
"

# связность: раздел → раздел (через $lib/features соседа)
LINKS="
orders customers 34
orders billing 21
billing customers 26
fleet reports 19
reports fleet 12
admin settings 14
settings admin 8
fleet orders 2
reports orders 2
"

emit_section() {  # $1 раздел, $2 экранов, $3 сторов
  s="$1"; scr="$2"; st="$3"
  mkdir -p "$R/src/routes/$s" "$R/src/lib/features/$s"
  i=0
  while [ "$i" -lt "$scr" ]; do
    if [ "$i" -eq 0 ]; then dir="$R/src/routes/$s"; else dir="$R/src/routes/$s/view$i"; mkdir -p "$dir"; fi
    cat > "$dir/+page.svelte" <<EOF
<script lang="ts">
  import { ${s}Store$((i % st)) } from '\$lib/features/$s/${s}$((i % st)).store';
  import { Button } from '\$lib/ui/button';
</script>
<h1>$s — экран $i</h1>
EOF
    cat > "$dir/+page.ts" <<EOF
import { load${s}$i } from '\$lib/api/${s}Client.js';
export const load = async () => load${s}$i();
EOF
    i=$(( i + 1 ))
  done
  j=0
  while [ "$j" -lt "$st" ]; do
    cat > "$R/src/lib/features/$s/${s}$j.store.ts" <<EOF
import { writable } from 'svelte/store';
export const ${s}Store$j = writable({ items: [], loading: false });
EOF
    j=$(( j + 1 ))
  done
}

echo "$SECTIONS" | while read -r s scr st; do
  [ -z "${s:-}" ] && continue
  emit_section "$s" "$scr" "$st"
done

# --- ЛОВУШКА: весь слой вызовов чужих API вне разделов роутов -----------------------
mkdir -p "$R/src/lib/api"
for s in orders fleet customers billing reports admin settings auth; do
  cat > "$R/src/lib/api/${s}Client.js" <<EOF
// сгенерированный клиент сервиса $s
export const load${s} = () => fetch('/api/$s');
export const save${s} = () => fetch('/api/$s', { method: 'POST' });
EOF
done
i=0
while [ "$i" -lt 14 ]; do
  cat > "$R/src/lib/api/legacy$i.js" <<EOF
export const legacyCall$i = () => fetch('/legacy/$i');
EOF
  i=$(( i + 1 ))
done

# --- сквозное: ключей нет ----------------------------------------------------------
mkdir -p "$R/src/lib/ui" "$R/src/lib/utils"
i=0; while [ "$i" -lt 40 ]; do
  echo "export const Ui$i = () => null;" > "$R/src/lib/ui/ui$i.ts"; i=$(( i + 1 )); done
i=0; while [ "$i" -lt 20 ]; do
  echo "export const util$i = (x) => x;" > "$R/src/lib/utils/util$i.ts"; i=$(( i + 1 )); done
echo "export const Button = () => null;" > "$R/src/lib/ui/button.ts"

# --- связность между разделами -----------------------------------------------------
echo "$LINKS" | while read -r a b n; do
  [ -z "${a:-}" ] && continue
  mkdir -p "$R/src/lib/features/$a"
  k=0
  while [ "$k" -lt "$n" ]; do
    cat > "$R/src/lib/features/$a/link_${b}_$k.ts" <<EOF
import { ${b}Store0 } from '\$lib/features/$b/${b}0.store';
export const use${b}$k = () => ${b}Store0;
EOF
    k=$(( k + 1 ))
  done
done

# --- спек-репа ---------------------------------------------------------------------
cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: geo
    path: ../geo-service
    type: backend
EOF
mkdir -p "$OUT/geo-service/.git"; echo "ref: refs/heads/main" > "$OUT/geo-service/.git/HEAD"
echo "module geo" > "$OUT/geo-service/go.mod"

echo "RS-FRONT собрана в $OUT"
echo "  экранов (+page.svelte): $(find "$R/src/routes" -name '+page.svelte' | wc -l)"
echo "  сторов (writable):      $(grep -rl 'writable(' "$R/src/lib/features" | wc -l)"
echo "  вызовов API (fetch):    $(grep -rhoE 'fetch\(' "$R/src/lib/api" | wc -l)"
echo "  файлов всего:           $(find "$R/src" -type f | wc -l)"
