#!/usr/bin/env bash
# Генератор фикстуры RS-SMALL — репа, которую резать НЕ надо. Анти-овертриггер к RS-MONO.
# Вызов: ./make.sh <куда>   (по умолчанию ./out)
set -eu
OUT="${1:-./out}"
R="$OUT/tariff-api"
rm -rf "$OUT"; mkdir -p "$R/internal" "$OUT/specs/services"
mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"
echo "module tariff-api" > "$R/go.mod"

# 46 исходников, разложены по слоям — то есть структура «как у монолита», а размера нет.
for pkg in handler store domain; do
  mkdir -p "$R/internal/$pkg"
  i=0
  while [ "$i" -lt 15 ]; do
    case "$pkg" in
      handler) cat > "$R/internal/handler/tariff$i.go" <<EOF
package handler

// GET /v1/tariffs/$i
func Tariff${i}(w http.ResponseWriter, r *http.Request) {}
EOF
        ;;
      store)  echo "package store

type Tariff${i}Store struct{}" > "$R/internal/store/tariff$i.go" ;;
      domain) echo "package domain

type Tariff$i struct{ ID string }" > "$R/internal/domain/tariff$i.go" ;;
    esac
    i=$(( i + 1 ))
  done
done
echo "package main

func main() {}" > "$R/main.go"

cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services: []
EOF

echo "RS-SMALL собрана в $OUT"
find "$R" -name '*.go' | wc -l | sed 's/^/  исходников: /'
