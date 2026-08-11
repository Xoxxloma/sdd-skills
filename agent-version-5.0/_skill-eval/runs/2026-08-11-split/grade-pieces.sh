#!/usr/bin/env bash
# grade-pieces.sh — грейд прогонов `service-map` на SM-PIECES.
#
#   ./grade-pieces.sh [каталог песочниц]
#
# Грейдится ДИСК, а не формулировка отчёта: карточки, их ключи и содержимое блоков.
# Единственная проба по тексту — SM-64 (реплика про соседей), у неё артефакта нет.
#
# ТРИ ПРАВИЛА, БЕЗ КОТОРЫХ ГРЕЙД ВРЁТ (все три поймал пилот 2026-08-11 на себе):
#
#  1. НЕТ КАРТОЧЕК — НЕ «КРАСНОЕ», А «НЕ ИЗМЕРЕНО». Прогон, оборвавшийся до Шага 4, ничего
#     не сообщает о правилах, которые проверяются по карточке. Считать это провалом — значит
#     красить обрыв раннера в дефект скилла.
#  2. ЗАПРЕЩАЮЩАЯ ПРОВЕРКА НА ПУСТОМ МЕСТЕ ЗЕЛЁНОЙ НЕ БЫВАЕТ. «Чужие ключи не размазались»
#     на нуле карточек выполняется само собой. Такие пробы гейтятся наличием артефакта.
#  3. SM-64 МЕРИТСЯ ТОЛЬКО НА ПРОБЕ `pieces`. На `pieces-scan` ответ про соседа дан в промпте
#     заранее, и требовать там «geo назван» — значит грейдить собственный засев.
#
# И общее: запускать только после завершения ВСЕХ прогонов.
set -u
OUT="${1:-$(cd "$(dirname "$0")" && pwd)/sandbox}"

pass() { printf '  \033[32mOK  \033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m—   \033[0m %s\n' "$1"; }
note() { printf '       %s\n' "$1"; }

tot_ok=0; tot_fail=0; tot_skip=0
chk()  { if [ "$1" = 1 ]; then pass "$2"; tot_ok=$((tot_ok+1)); else fail "$2"; tot_fail=$((tot_fail+1)); fi; }
miss() { skip "$1 — не измерено"; tot_skip=$((tot_skip+1)); }

for sb in "$OUT"/pieces-*; do
  [ -d "$sb" ] || continue
  [ -s "$sb/answer.md" ] || { echo "$(basename "$sb") — ответа нет, не измерено"; continue; }
  name="$(basename "$sb")"
  echo "== $name"
  S="$sb/w/specs/services"
  A="$sb/answer.md"
  cards=$(find "$S" -name '*.md' 2>/dev/null | wc -l)
  note "карточек в services/: $cards"

  case "$name" in
    pieces-scan-*) is_scan=1 ;;
    *)             is_scan=0 ;;
  esac

  if [ "$cards" -eq 0 ]; then
    # Прогон до записи не дошёл. Всё, что проверяется по карточке, — не измерено.
    miss "SM-65 ключи из обеих папок"
    miss "SM-65b старая форма path"
    miss "SM-66a факт из корня репы"
    miss "SM-66b чужие ключи не размазались"
    note "причина обрыва — см. actions.log и хвост answer.md"
  else
    # --- SM-65: кусок из двух папок через запятую собран в ОДНУ карточку со всеми ключами
    if [ -f "$S/rental-orders.md" ]; then
      n=0
      for k in "GET /api/orders" "POST /api/orders" "POST /api/orders/close" "GET /api/pricing/quote"; do
        grep -qF "$k" "$S/rental-orders.md" && n=$((n+1))
      done
      chk "$([ "$n" -eq 4 ] && echo 1 || echo 0)" "SM-65 ключи из обеих папок в rental-orders.md ($n/4)"
      grep -qF ", ../rentalcore" "$S/rental-orders.md" && note "ВНИМАНИЕ: следы неразобранной запятой в карточке"
    else
      chk 0 "SM-65 карточка rental-orders.md не записана, хотя другие есть"
    fi

    # --- SM-65b: старая форма (path без запятой) не сломана
    if [ -f "$S/rental-fleet.md" ]; then
      n=0
      for k in "GET /api/fleet" "POST /api/fleet/decommission"; do
        grep -qF "$k" "$S/rental-fleet.md" && n=$((n+1))
      done
      chk "$([ "$n" -eq 2 ] && echo 1 || echo 0)" "SM-65b старая форма path цела ($n/2)"
    else
      chk 0 "SM-65b карточка rental-fleet.md не записана, хотя другие есть"
    fi

    # --- SM-66a: факт из корня репы доехал (коды ошибок лежат в common/errors.ts)
    if [ -f "$S/rental-orders.md" ]; then
      c=0
      grep -qE '\b409\b' "$S/rental-orders.md" && c=$((c+1))
      grep -qE '\b422\b' "$S/rental-orders.md" && c=$((c+1))
      chk "$([ "$c" -ge 1 ] && echo 1 || echo 0)" "SM-66a коды ошибок из общей папки доехали ($c/2)"
    else
      miss "SM-66a факт из корня репы"
    fi

    # --- SM-66b: ключей из common в карточках быть НЕ должно (гейтится наличием карточек)
    # Карточка `rental-common` исключена намеренно: её `path` И ЕСТЬ `common`, поэтому её
    # ключи — законно ключи common. Проба про размазывание чужих ключей по ДРУГИМ кускам.
    # (Что такой карточки быть не должно вовсе — отдельная правка SM-67, она не внесена.)
    bad=0
    for f in "$S"/rental-*.md; do
      [ -f "$f" ] || continue
      case "$(basename "$f")" in rental-common.md) continue ;; esac
      grep -qE '^### .*(toWire|ERROR_HTTP_CODE|RentalError)' "$f" && bad=$((bad+1))
    done
    chk "$([ "$bad" -eq 0 ] && echo 1 || echo 0)" "SM-66b чужие ключи не размазались ($bad карточек)"

    # --- SM-67 (правка НЕ внесена): фиксируем факт, красным не считаем
    if [ -f "$S/rental-common.md" ]; then
      note "SM-67 (не внесена): rental-common.md записан — ожидаемо для текущей версии"
    else
      note "SM-67: rental-common.md не записан"
    fi
  fi

  # --- SM-64: по тексту, и ТОЛЬКО на пробе `pieces`
  if [ "$is_scan" -eq 1 ]; then
    skip "SM-64 не применима к pieces-scan (ответ про соседа дан в промпте)"
  else
    ask_mono=0; named_geo=0
    grep -qiE 'rentalcore.*(нов|допис)|нов.*rentalcore' "$A" && ask_mono=1
    grep -qiE 'geo-service' "$A" && named_geo=1
    chk "$([ "$ask_mono" -eq 0 ] && echo 1 || echo 0)" "SM-64a монолит не объявлен новым соседом"
    chk "$named_geo" "SM-64b geo-service назван новым соседом"
  fi
done

echo
echo "ИТОГО: OK $tot_ok / FAIL $tot_fail / не измерено $tot_skip"
