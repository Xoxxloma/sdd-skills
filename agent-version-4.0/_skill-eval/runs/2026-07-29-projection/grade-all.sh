#!/usr/bin/env bash
# Сводный грейдер раунда 2. Запускать из runs/2026-07-29-projection/sandbox/.
F=../../../fixtures
sec(){ awk '/^## Кто меня потребляет/{s=1} /^## Роли/{s=0} s' "$1"; }
p(){ printf "  %-16s %s\n" "$1" "$2"; }

echo "### LOOP-MERGE (AR-26 notes цел / AR-27 прочерк заменён)"
for d in LOOP-MERGE-*/; do d=${d%/}; g=$d/services/geo.md; [ -f "$g" ] || { echo "$d: НЕТ ФАЙЛА"; continue; }
  printf "%-16s notes=%s шапка=%s scanned=%s прочерк_соб=%s прочерк_роли=%s recalc=%s метка=%s\n" "$d" \
    $(grep -c '^## Заметки команды' $g) $(grep -c 'Генерируется' $g) $(grep -c 'scanned: 2026-07-25' $g) \
    $(awk '/^## События/{s=1;next} /^## /{s=0} s && /^\| *— *\|/{c++} END{print c+0}' $g) \
    $(awk '/^## Роли и доступ/{s=1;next} /^## /{s=0} s && /^\| *— *\|/{c++} END{print c+0}' $g) \
    $(grep -c 'coverage/recalc' $g) $([ -f $d/docs/ARS-88/.archived ] && echo Y || echo N); done

echo; echo "### AR-BASIC (AR-1/2/3/5/22/24)"
for d in AR-BASIC-*/; do d=${d%/}; au=$d/services/auth.md; [ -f "$au" ] || { echo "$d: НЕТ"; continue; }
  printf "%-16s блок1=%s lastIp=%s geo=%s устар=%s деп_в_отчёте=%s notes_в_отчёте=%s scanned=%s зеркало=%s журнал=%s метка=%s\n" "$d" \
    $(grep -c '^### `GET /v1/sessions/count`' $au) $(grep -c 'lastIp' $au) $(grep -c 'geo' $au) \
    $(grep -ci 'устаревш\|deprecat' $au) $(grep -ci 'v1/session' $d/_report.md 2>/dev/null || echo 0) \
    $(grep -ci 'notes' $d/_report.md 2>/dev/null || echo 0) $(grep -c 'scanned: 2026-07-20' $au) \
    $(diff <(sec $au) <(sec $F/AR-BASIC/services/auth.md) >/dev/null && echo цела || echo ТРОНУТА) \
    $(grep -c 'добавлено\|изменено с\|ARS-57' $au) $([ -f $d/docs/ARS-57/.archived ] && echo Y || echo N); done

echo; echo "### SM-GRAPH (SM-24 мёртвая / SM-25 безвызовное зеркало)"
for d in SM-GRAPH-*/; do d=${d%/}; up=$d/user-profile.md; au=$d/auth.md
  printf "%-16s зеркал_auth_—=%s legacy_в_auth=%s incident-web_в_auth=%s мёртвая_в_отчёте=%s\n" "$d" \
    $([ -f "$up" ] && grep -c '^| *`\?auth`\? *| *—' $up || echo НЕТФАЙЛА) \
    $([ -f "$au" ] && grep -c 'legacy-billing' $au || echo НЕТФАЙЛА) \
    $([ -f "$au" ] && grep -c 'incident-web' $au || echo -) \
    $(cat $d/report.md $d/_report.txt $d/_report.md 2>/dev/null | grep -ci 'legacy-billing'); done

echo; echo "### AR-NOCARD (AR-10 / AR-21)"
for d in AR-NOCARD-*/; do d=${d%/}
  printf "%-16s метка=%s notify_создан=%s service-map_в_отчёте=%s\n" "$d" \
    $([ -f $d/docs/ARS-70/.archived ] && echo Y || echo N) \
    $([ -f $d/services/notify.md ] && echo ДА || echo нет) \
    $(grep -ci 'service-map' $d/_report.md 2>/dev/null || echo 0); done

echo; echo "### AR-EPIC / AR-LATE (AR-20 листья / AR-25 поздняя спека)"
for d in AR-EPIC-*/; do d=${d%/}
  printf "%-16s _foundation=%s ARS-102=%s корень=%s ARS-103=%s\n" "$d" \
    $([ -f $d/docs/ARS-100/_foundation/.archived ] && echo Y || echo N) \
    $([ -f $d/docs/ARS-100/ARS-102/.archived ] && echo Y || echo N) \
    $([ -f $d/docs/ARS-100/.archived ] && echo Y || echo N) \
    $([ -f $d/docs/ARS-100/ARS-103/.archived ] && echo Y || echo N); done
for d in AR-LATE-*/; do d=${d%/}
  printf "%-16s ARS-103_метка=%s корень=%s влито_geo=%s зеркало_geo=%s\n" "$d" \
    $([ -f $d/docs/ARS-100/ARS-103/.archived ] && echo Y || echo N) \
    $([ -f $d/docs/ARS-100/.archived ] && echo Y || echo N) \
    $(grep -c 'coverage/report' $d/services/geo.md) \
    $(diff <(sec $d/services/geo.md) <(sec $F/AR-LATE/services/geo.md) >/dev/null && echo цело || echo ТРОНУТО); done
