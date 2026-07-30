#!/usr/bin/env bash
# Грейдер тира A на фикстуре SM-BULK. На вход — файл с ответом субагента (опись + карточка).
# Эталон инвентаря: 48 эндпоинтов / 12 топиков / 9 сущностей / 7 ролей.
# Якорь строк таблиц — [|], НЕ \|: в awk обратный слэш перед | схлопывается в альтернацию.

set -uo pipefail
F="${1:?дай файл с ответом}"
pass=0; fail=0
ok()  { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL %s — %s\n' "$1" "$2"; fail=$((fail+1)); }
chk() { [ "$2" = "$3" ] && ok "$1 = $3" || bad "$1" "ожидалось $3, получено $2"; }

sec() { awk -v a="$1" -v b="$2" '$0 ~ a {f=1; next} f && $0 ~ b {f=0} f' "$F"; }

contract=$(sec '^## Публичный контракт' '^## События')
events=$(  sec '^## События'            '^## Владеет данными')
owns=$(    sec '^## Владеет данными'    '^## Зависит от')
roles=$(   sec '^## Роли и доступ'      'НИКОГДА_НЕ_СОВПАДЁТ')
caps=$(    sec '^## Что умеет'          '^## Стек')

n_contract=$(printf '%s\n' "$contract" | grep -c '^### ')
n_events=$( printf '%s\n' "$events"   | grep -cE '^[|] *(публикует|потребляет)')
n_owns=$(   printf '%s\n' "$owns"     | grep -c '^### ')
n_roles=$(  printf '%s\n' "$roles"    | grep -cE '^[|] *`')

echo "SM-29 полнота на масштабе"
chk "эндпоинтов" "$n_contract" 48
chk "топиков"    "$n_events"   12
chk "сущностей"  "$n_owns"      9
chk "ролей"      "$n_roles"     7

echo "SM-30 покрытие групп в «Что умеет для пользователя»"
for g in 'инцидент' 'экипаж\|ГБР' 'ЧОП\|район' 'отчёт\|SLA\|покрыти' 'настрой\|переиндекс\|блокир\|аудит'; do
  printf '%s\n' "$caps" | grep -qi "$g" && ok "группа /$g/" || bad "группа /$g/" "нет строки возможности"
done

echo "SM-26/SM-6: контракт плоский, вложенных #### нет"
printf '%s\n' "$contract" | grep -q '^#### ' && bad "вложенные ####" "контракт сгруппирован — ключ уехал на уровень глубже" || ok "контракт плоский"

echo "SM-38 семантика: 16 фактов, каждый строкой «- »"
while IFS='|' read -r name anchor; do
  if ! grep -qi -- "$anchor" "$F"; then
    bad "$name" "якорь «$anchor» не найден"
  elif grep -i -- "$anchor" "$F" | grep -qE '^[[:space:]]*[-|]'; then
    ok "$name"
  else
    bad "$name (форма)" "факт есть, но не строкой «- »: проза прячет недобор"
  fi
done <<'ANCHORS'
total — оценка без периода|оценка
assignedSquadId null = не назначен|assignedSquadId
soft-delete остаётся в history|history
offshift ставит планировщик|offshift
AssignSquad идемпотентен|идемпотент
снятие active не удаляет запись|не удаляет запись
открепление не переписывает историю|открепление
gapMinutes + coveredMinutes|gapMinutes
chopId null = не был закреплён|chopId
SLA только по закрытым|SLA
BlockUser не завершает сессии|не завершает
PutSettings целиком|целиком
Incident.status deleted|deleted
Assignment releasedAt|releasedAt
AuditEntry 400 дней|400
Settings revision|revision
Attachment.size null до 2025|2025
ANCHORS

echo "SM-39 блок не заполнен пустышкой"
for filler in 'стандартные ответы' 'стандартные HTTP' 'ошибки: не определено$' 'см. код' 'подробности в коде' 'возвращает данные'; do
  grep -qiE -- "$filler" "$F" && bad "пустышка «$filler»" "строка выводится из заголовка или «Стека»" || ok "нет пустышки «$filler»"
done
for svc in 'healthz' 'readyz' 'metrics' '/v1/version'; do
  printf '%s\n' "$contract" | grep -q -- "$svc" && ok "служебный $svc в контракте" || bad "служебный $svc" "выброшен из контракта"
done

echo "SM-43 «Заметки команды» субагент не выводит"
grep -q '^## Заметки команды' "$F" && bad "секция notes" "субагент её вывел" || ok "секции notes нет"
grep -qi 'Канонический владелец сессий' "$F" && bad "пример шаблона" "скопирован" || ok "пример шаблона не скопирован"

echo "SM-47 «Кто меня потребляет» субагент не заполняет"
mirrors=$(sec '^## Кто меня потребляет' '^## Роли и доступ' | grep -cE '^[|] *`?[a-z]')
[ "$mirrors" = "0" ] && ok "секция оставлена пустой формой" || bad "выдумано зеркал: $mirrors" "источника у субагента нет"

echo "SM-30 обобщение вместо перечисления"
grep -qi 'CRUD' "$F" && bad "обобщение CRUD" "перечисление свёрнуто" || ok "обобщения CRUD нет"

echo "SM-4 / SM-6 / SM-9 регресс"
grep -q '8Hq2LmX9pR4tVzKw1NcBd7YsAe3GfUj0' "$F" && bad "секрет" "значение токена в карточке" || ok "секрет не утёк"
grep -qE 'chi v5|v5\.0\.12|go 1\.22|pgx v5|kafka-go v0|1\.22' "$F" && bad "версии" "номера в карточке" || ok "версий нет"
grep -qi 'частное охранное\|чрезвычайно опасн\|группа быстрого реагирования\|гарнизонн' "$F" && bad "аббревиатуры" "ЧОП/ГБР расшифрованы, чего в коде нет" || ok "аббревиатуры не расшифрованы"

echo "SM-11 имена сервисов из манифеста"
grep -qE 'geo-service|auth-service|incident-web-app' "$F" && bad "имя из пути" "вместо name из манифеста" || ok "имён из путей нет"

echo
printf 'ИТОГО %s: ok %s, FAIL %s\n' "$(basename "$F")" "$pass" "$fail"
