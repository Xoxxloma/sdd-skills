#!/usr/bin/env bash
# Собирает заглушки ответа субагента из полной карточки, которая лежит в ../tree/.
#
# Зачем генерировать, а не хранить текстом: опись в заглушке обязана описывать ПОЛНУЮ карточку,
# а сама карточка в ответе — урезанную. Написанные руками, эти два числа разъезжаются при первой
# же правке дерева, и проба начинает мерить опечатку в фикстуре.
#
#   ./make.sh 2026-08-01      # дата, которую субагент поставит в scanned
#
# На выходе: a1.md, a2.md, b2.md. Заглушки b1 нет намеренно — вариант Б начинается с пустого
# ответа, а пустой ответ это отсутствие текста, не файл с текстом «пусто».

set -euo pipefail
cd "$(dirname "$0")"

CARD=../tree/services/shipping.md
TODAY="${1:?передай дату прогона: ./make.sh 2026-08-01}"

# «Заметки команды» в ответе субагента быть не должно: notes ему не передают (см. S3 в PLAN-SEAMS).
strip_notes() {
  awk '
    /^## Заметки команды/ { skip = 1; next }
    skip && /^## /        { skip = 0 }
    !skip
  '
}

# «Кто меня потребляет» субагент отдаёт ПУСТОЙ формой: секция производная, чужих карточек у него нет.
# Без этого заглушка тащит в ответ строку `tariff-admin` из прежней карточки — и тогда проба SM-24
# меряет не пересборку зеркал ведущим, а то, что он получил на входе.
blank_mirrors() {
  awk '
    /^## Кто меня потребляет/ { print; print "| Сервис | Что вызывает | Зачем |";
                                print "|---|---|---|"; print "| — | | |"; skip = 1; next }
    skip && /^## /            { skip = 0 }
    !skip
  '
}

# Убирает блоки ### по списку заголовков, разделённых символом |.
drop_blocks() {
  awk -v drop="$1" '
    BEGIN { n = split(drop, d, "|") }
    /^### / { skip = 0; for (i = 1; i <= n; i++) if ($0 == d[i]) skip = 1 }
    /^## /  { skip = 0 }
    !skip
  '
}

set_scanned() { sed "s/^scanned: .*/scanned: $TODAY/"; }

# --- опись: ключи и числа берутся из ПОЛНОЙ карточки -------------------------
section() { awk -v from="$1" -v to="$2" '$0 ~ from {f=1; next} f && $0 ~ to {f=0} f' "$CARD"; }

contract_keys=$(section '^## Публичный контракт' '^## События'     | grep '^### ' | sed 's/^### //')
entity_keys=$(  section '^## Владеет данными'    '^## Зависит от'   | grep '^### ' | sed 's/^### //')
facts=$( { section '^## Публичный контракт' '^## События'; section '^## Владеет данными' '^## Зависит от'; } | grep -c '^- ')
topics=$(grep -cE '^[|] (публикует|потребляет)' "$CARD")
roles=$(section '^## Роли и доступ' '^$' | grep -cE '^[|] `')

n_contract=$(printf '%s\n' "$contract_keys" | grep -c .)
n_entity=$(printf '%s\n' "$entity_keys" | grep -c .)

inventory() {
  printf 'шаблон прочитан, тип: backend\n\nОПИСЬ\n'
  printf '%s\n' "$contract_keys" | sed 's/^/  эндпоинт /'
  printf '%s\n' "$entity_keys"   | sed 's/^/  сущность /'
  printf '\nэндпоинтов %s, топиков %s, сущностей %s, ролей %s, семантик %s\n' \
    "$n_contract" "$topics" "$n_entity" "$roles" "$facts"
  printf '\n[второй уровень описи: те же %s фактов, разложенные по ключам выше]\n\nКАРТОЧКА\n' "$facts"
}

A1_DROP='### `PATCH /api/carriers/{id}`|### `GET /api/tariffs`|### `POST /api/tariffs`|### `PUT /api/tariffs/{id}`|### `GET /actuator/health`|### `GET /api/version`'
A2_DROP='### `GET /actuator/health`|### `GET /api/version`'

build() { { inventory; strip_notes < "$CARD" | blank_mirrors | drop_blocks "$1" | set_scanned; } > "$2"; }

build "$A1_DROP" a1.md
build "$A2_DROP" a2.md
build ''         b2.md

for f in a1 a2 b2; do
  printf '%s.md: блоков ### %s\n' "$f" "$(grep -c '^### ' $f.md)"
done
printf 'опись обещает: эндпоинтов %s, сущностей %s (итого блоков %s)\n' \
  "$n_contract" "$n_entity" "$((n_contract + n_entity))"
