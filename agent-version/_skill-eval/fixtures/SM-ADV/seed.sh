#!/usr/bin/env bash
# seed.sh (SM-ADV) — обёртка над fixtures/SM-REAL/seed.sh: тот же засев из реальных реп, плюс адверсарные добавки.
#
#   ./seed.sh <куда> <first|scan|rescan|keyed>
#
# Всё, что умеет SM-REAL/seed.sh (SM_REAL_PATCH, SM_RESCAN_CARDS, SM_RESCAN_DATE), работает как есть. Сверху:
#   SM_ADV_DROP="repairy-api/src/auth/auth.controller.ts …"  — файлы, удаляемые ПОСЛЕ засева и патча
#        (законная потеря контроллера; сам файл в фикстуру не копируется — удаляется из копии);
#   SM_ADV_PENDING=<файл>   — кладётся как services/_pending/repairy-api.md («кандидат прошлого прогона»);
#        копия — в <куда>/../_pending-seeded/repairy-api.md, с ней сверяет grade-sm-adv.mjs;
#   SM_ADV_CLONES=N         — N копий resonance-api под именами res-1…res-N рядом со спек-репой,
#        с .git/HEAD, и N строк в конец манифеста (плечо на объём контекста);
#   SM_ADV_MANIFEST=<файл>  — свой манифест вместо SM-REAL/manifest.yaml (кладётся после засева).
set -u
DEST="${1:?куда}"; ARM="${2:?плечо}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$HERE/../SM-REAL/seed.sh" "$DEST" "$ARM" || exit 1

if [ -n "${SM_ADV_DROP:-}" ]; then
  for f in $SM_ADV_DROP; do
    [ -f "$DEST/$f" ] || { echo "SM_ADV_DROP: нет файла $DEST/$f"; exit 1; }
    rm -f "$DEST/$f"; echo "удалён: $f"
  done
fi

if [ -n "${SM_ADV_MANIFEST:-}" ]; then
  mkdir -p "$DEST/AI-SDD/services"; cp "$SM_ADV_MANIFEST" "$DEST/AI-SDD/services/manifest.yaml"; echo "манифест: $SM_ADV_MANIFEST"
fi

if [ -n "${SM_ADV_PENDING:-}" ]; then
  [ -f "$SM_ADV_PENDING" ] || { echo "SM_ADV_PENDING: нет файла $SM_ADV_PENDING"; exit 1; }
  mkdir -p "$DEST/AI-SDD/services/_pending" "$DEST/../_pending-seeded"
  cp "$SM_ADV_PENDING" "$DEST/AI-SDD/services/_pending/repairy-api.md"
  cp "$SM_ADV_PENDING" "$DEST/../_pending-seeded/repairy-api.md"
  echo "кандидат прошлого прогона: services/_pending/repairy-api.md ($(grep -c '^### ' "$SM_ADV_PENDING") блоков)"
fi

if [ -n "${SM_ADV_CLONES:-}" ]; then
  [ -f "$DEST/AI-SDD/services/manifest.yaml" ] || { echo "SM_ADV_CLONES: манифеста нет (плечо $ARM)"; exit 1; }
  for i in $(seq 1 "$SM_ADV_CLONES"); do
    cp -r "$DEST/resonance-api" "$DEST/res-$i"
    mkdir -p "$DEST/res-$i/.git"; echo "ref: refs/heads/main" > "$DEST/res-$i/.git/HEAD"
    printf '  - name: res-%s\n    path: ../res-%s\n    type: backend\n' "$i" "$i" >> "$DEST/AI-SDD/services/manifest.yaml"
  done
  echo "клонов resonance-api: $SM_ADV_CLONES (res-1…res-$SM_ADV_CLONES), строк в манифесте: $(grep -c '^  - name:' "$DEST/AI-SDD/services/manifest.yaml")"
fi
