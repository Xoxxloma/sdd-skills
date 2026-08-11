#!/usr/bin/env bash
# Генератор фикстуры RS-MONO — монолит, который не берётся одним сканом.
#
# Почему генератор, а не файлы в репе: фикстуре нужен РАЗМЕР (567 исходников), а замер порога
# Шага 2 на трёх файлах вырождается. Класть 567 заглушек в git — дороже, чем 60 строк скрипта.
#
# Вызов:  ./make.sh <куда>      →  <куда>/rentalcore/ и <куда>/specs/
# По умолчанию <куда> = ./out (в .gitignore стенда).
set -eu
OUT="${1:-./out}"
R="$OUT/rentalcore"
rm -rf "$OUT"; mkdir -p "$R/src" "$OUT/specs/services"

# --- маркер репозитория и сборка -------------------------------------------------
mkdir -p "$R/.git"; echo "ref: refs/heads/main" > "$R/.git/HEAD"
cat > "$R/package.json" <<'EOF'
{ "name": "rentalcore", "private": true,
  "scripts": { "start": "nest start", "build": "nest build" },
  "dependencies": { "@nestjs/core": "*", "@nestjs/graphql": "*", "typeorm": "*" } }
EOF

# --- ЛОВУШКА ШАГА 4: REST-контракт лежит НАВЕРХУ, вне доменных папок ---------------
mkdir -p "$R/src/controllers"
for n in orders fleet customers billing pricing reporting maintenance staff \
         contracts inventory dispatch health; do
  cat > "$R/src/controllers/$n.controller.ts" <<EOF
import { Controller, Get, Post } from '@nestjs/common';

@Controller('/api/$n')
export class ${n}Controller {
  @Get() list() {}
  @Post() create() {}
}
EOF
done

# --- доменные, инфраструктурные и сквозные пакеты ----------------------------------
# формат: <папка> <файлов> <класс>
#   dom  — резолверы + сущности + слои (домен)
#   docs — только резолверы, сущностей нет (тоже домен: есть что положить в карточку)
#   infra— потребители очереди и интеграции (инфра со своей поверхностью)
#   cross— ни контракта, ни сущностей (сквозное, куском быть не должно)
PKGS="
orders 180 dom
fleet 90 dom
customers 55 dom
billing 60 dom
pricing 30 dom
reporting 25 docs
integrations 40 infra
notifications 20 infra
common 35 cross
exceptions 12 cross
config 8 cross
"

# --- матрица связности: <откуда> <куда> <сколько ссылок> ---------------------------
# Кластеры заданы намеренно, чтобы правильный разрез был известен ЗАРАНЕЕ (см. expected.md):
#   A: orders+billing+pricing+customers   B: fleet+reporting   C: integrations+notifications
# Связи между кластерами — единицы, внутри — десятки. Ссылки на common есть у всех и
# на разрез не влияют: сквозное в куски не идёт.
LINKS="
orders customers 40
orders pricing 25
orders billing 20
billing customers 30
billing pricing 18
fleet reporting 22
reporting fleet 15
integrations notifications 20
notifications integrations 11
fleet orders 3
reporting orders 2
integrations orders 2
"

links_for() {  # печатает строки `<куда> <сколько>` для пакета $1
  echo "$LINKS" | while read -r a b n; do
    [ "${a:-}" = "$1" ] && printf '%s %s\n' "$b" "$n"
  done
}

# Кладёт в папку $1 ровно столько файлов-ссылок, сколько велит матрица.
emit_links() {
  d="$1"; b="$R/src/modules/$d"; mkdir -p "$b/services"
  links_for "$d" | while read -r target n; do
    [ -z "${target:-}" ] && continue
    j=0
    while [ "$j" -lt "$n" ]; do
      cat > "$b/services/${d}_to_${target}_$j.ts" <<EOF
import { ${target}Service } from '../../$target/services/${target}0.service';
import { helper0 } from '../common/common0.util';
export class ${d}To${target}$j { run(s: ${target}Service) { return helper0(s); } }
EOF
      j=$(( j + 1 ))
    done
  done
}

emit_dom() {  # $1 dir, $2 count, $3 with_entities(yes|no)
  d="$1"; c="$2"; ent="$3"; b="$R/src/modules/$d"
  mkdir -p "$b/resolvers" "$b/services" "$b/repositories" "$b/dto"
  [ "$ent" = yes ] && mkdir -p "$b/entities"
  i=0
  while [ "$i" -lt "$c" ]; do
    case $(( i % 5 )) in
      0) cat > "$b/resolvers/$d$i.resolver.ts" <<EOF
import { Resolver, Query, Mutation } from '@nestjs/graphql';
@Resolver('$d')
export class ${d}${i}Resolver {
  @Query() ${d}List() {}
  @Mutation() ${d}Update() {}
}
EOF
         ;;
      1) if [ "$ent" = yes ]; then cat > "$b/entities/$d$i.entity.ts" <<EOF
import { Entity, Column, PrimaryColumn } from 'typeorm';
@Entity('${d}_$i')
export class ${d}${i} {
  @PrimaryColumn() id: string;
  @Column({ nullable: true }) note: string | null;
}
EOF
         else echo "export const ${d}View$i = () => null;" > "$b/dto/$d$i.view.ts"; fi ;;
      2) echo "export class ${d}${i}Service { run() {} }" > "$b/services/$d$i.service.ts" ;;
      3) echo "export class ${d}${i}Repository { find() {} }" > "$b/repositories/$d$i.repository.ts" ;;
      4) echo "export interface ${d}${i}Dto { id: string }" > "$b/dto/$d$i.dto.ts" ;;
    esac
    i=$(( i + 1 ))
  done
}

emit_infra() { d="$1"; c="$2"; b="$R/src/modules/$d"; mkdir -p "$b/consumers" "$b/clients"
  i=0; while [ "$i" -lt "$c" ]; do
    if [ $(( i % 2 )) -eq 0 ]; then cat > "$b/consumers/$d$i.consumer.ts" <<EOF
import { EventPattern } from '@nestjs/microservices';
export class ${d}${i}Consumer {
  @EventPattern('rental.$d.$i') handle() {}
}
EOF
    else echo "export class ${d}${i}Client { call() {} }" > "$b/clients/$d$i.client.ts"; fi
    i=$(( i + 1 )); done; }

emit_cross() { d="$1"; c="$2"; b="$R/src/modules/$d"; mkdir -p "$b"
  i=0; while [ "$i" -lt "$c" ]; do
    echo "export const ${d}Helper$i = (x: unknown) => x;" > "$b/$d$i.util.ts"
    i=$(( i + 1 )); done; }

echo "$PKGS" | while read -r name count kind; do
  [ -z "${name:-}" ] && continue
  case "$kind" in
    dom)   emit_dom  "$name" "$count" yes ;;
    docs)  emit_dom  "$name" "$count" no  ;;
    infra) emit_infra "$name" "$count" ;;
    cross) emit_cross "$name" "$count" ;;
  esac
  [ "$kind" != cross ] && emit_links "$name"
done

# сквозное с настоящими маркерами обработки ошибок — чтобы Шаг 4 не принял его за домен
cat > "$R/src/modules/exceptions/http.filter.ts" <<'EOF'
import { Catch } from '@nestjs/common';
@Catch()
export class HttpFilter { /* 409 — повтор номера договора; 422 — закрытая аренда */ }
EOF

# --- спек-репа: манифест ЕСТЬ, но монолита в нём нет -------------------------------
cat > "$OUT/specs/services/manifest.yaml" <<'EOF'
# Слепок соседних сервисов. Этот файл ведёт человек.
services:
  - name: geo
    path: ../geo-service
    type: backend
EOF
mkdir -p "$OUT/geo-service/.git"; echo "ref: refs/heads/main" > "$OUT/geo-service/.git/HEAD"
echo "module geo" > "$OUT/geo-service/go.mod"

echo "RS-MONO собрана в $OUT"
find "$R" -name '*.ts' | wc -l | sed 's/^/  исходников: /'
