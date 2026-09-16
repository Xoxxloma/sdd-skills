#!/usr/bin/env bash
# seed.sh — собирает песочницу пробы `sm-real` из РЕАЛЬНЫХ реп пользователя.
#
#   ./seed.sh <куда> <first|scan>
#
# Фикстура своего дерева не держит намеренно: она про то, как скилл ведёт себя на настоящем
# коде, а копия 424 файлов в репозитории стенда была бы вторым источником правды и разъехалась
# бы с оригиналом на первом же коммите в repairy. Дерево собирается из источников на каждый
# прогон; источники при этом ТОЛЬКО ЧИТАЮТСЯ.
#
# Раскладка (соседи лежат РЯДОМ со спек-репой, а не внутри неё):
#
#   <куда>/
#   ├── AI-SDD/                     ← рабочая директория прогона
#   │   └── services/manifest.yaml  ← только в плече `scan`
#   ├── repairy-api/    backend   ← цель скана
#   ├── repairy-web/    frontend  ← цель скана
#   ├── resonance-api/  backend
#   └── resonance-web/  frontend  ← `.git` ФАЙЛОМ: worktree-форма
#
# `resonance-web` в worktree-форме — сторож одного дефекта: Шаг 1.1 требует ДВА глоба
# (`**/.git/HEAD` для обычного клона и `**/.git` для worktree), Шаг 2.1 называет только первый.
# Обычный клон находится файлом внутри папки `.git`, worktree — самим файлом `.git`, поэтому
# прогон с одним глобом теряет ровно этот сервис. Целью скана он не является: его потеря видна
# числом и ничего другого в замере не портит.
set -u

DEST="${1:?куда: путь к песочнице}"
ARM="${2:?плечо: first | scan | rescan | keyed}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="${SM_REAL_SRC:-/c/Users/Konstantin/projects}"

REPAIRY="$SRC_ROOT/repairy"
RESONANCE="$SRC_ROOT/resonance"
for d in "$REPAIRY/apps/api" "$REPAIRY/apps/web" "$RESONANCE/backend" "$RESONANCE/frontend"; do
  [ -d "$d" ] || { echo "нет источника: $d"; exit 1; }
done

# Мусор сборки и зависимости не едут: они не код сервиса, а на слабой модели съедают окно.
# `.env` ЕДЕТ НАМЕРЕННО — правило «секреты не копируются» проверяется только там, где секреты есть.
EXCL="--exclude=node_modules --exclude=dist --exclude=dist.zip --exclude=dev-dist
--exclude=.next --exclude=.turbo --exclude=.git --exclude=coverage
--exclude=playwright-report --exclude=test-results --exclude=.playwright-mcp
--exclude=report.html --exclude=*.log --exclude=@repairy"

copy() {  # copy <откуда> <куда>
  local from="$1" to="$2"
  mkdir -p "$to"
  # shellcheck disable=SC2086
  ( cd "$from" && tar cf - $EXCL . ) | ( cd "$to" && tar xf - )
}

rm -rf "$DEST"
mkdir -p "$DEST/AI-SDD"

copy "$REPAIRY/apps/api"    "$DEST/repairy-api"
copy "$REPAIRY/apps/web"    "$DEST/repairy-web"
copy "$RESONANCE/backend"   "$DEST/resonance-api"
copy "$RESONANCE/frontend"  "$DEST/resonance-web"

# Патч кода поверх засева — «маленькая фича» для плеча keyed (SM_REAL_PATCH, пути вида a/repairy-api/…).
# Источники не трогаются: патч ложится только на копию в песочнице.
if [ -n "${SM_REAL_PATCH:-}" ]; then
  ( cd "$DEST" && patch -p1 -s < "$SM_REAL_PATCH" ) || { echo "патч не лёг: $SM_REAL_PATCH"; exit 1; }
  find "$DEST" -name "*.orig" -delete
  echo "патч наложен: $(basename "$SM_REAL_PATCH")"
fi

# Маркер репозитория. Без него `Glob **/.git/HEAD` не найдёт кандидатов и мерить будет нечего.
# Заводится файлами, а не `git init`: скилл сам git не запускает и в `.git` не заглядывает —
# для него это просто признак «отдельный репозиторий, а не случайная папка рядом».
for s in repairy-api repairy-web resonance-api; do
  mkdir -p "$DEST/$s/.git"
  echo "ref: refs/heads/main" > "$DEST/$s/.git/HEAD"
done
# Worktree-форма: `.git` — ФАЙЛ, и `HEAD` внутри него нет.
printf 'gitdir: ../.gitworktrees/resonance-web\n' > "$DEST/resonance-web/.git"

if [ "$ARM" = scan ] || [ "$ARM" = rescan ] || [ "$ARM" = keyed ]; then
  mkdir -p "$DEST/AI-SDD/services"
  cp "$HERE/manifest.yaml" "$DEST/AI-SDD/services/manifest.yaml"
fi

# Плечо `rescan`: поверх манифеста — прежние карточки из SM_RESCAN_CARDS (по умолчанию карточки
# фикстуры BR-REAL). Копия ложится и в `_prev/` рядом с песочницей — с ней сравнивается результат.
# Дата `scanned` сдвигается в прошлое (SM_RESCAN_DATE): с сегодняшней ведущий решает, что карточку
# собрал этот же прогон, и пропускает гард (2026-09-15-rescan, rescan-2).
if [ "$ARM" = rescan ] || [ "$ARM" = keyed ]; then
  PREV="${SM_RESCAN_CARDS:-$HERE/../BR-REAL/services}"
  mkdir -p "$DEST/../_prev"
  for c in repairy-api repairy-web; do
    [ -f "$PREV/$c.md" ] || { echo "нет прежней карточки: $PREV/$c.md"; exit 1; }
    cp "$PREV/$c.md" "$DEST/AI-SDD/services/$c.md"
    cp "$PREV/$c.md" "$DEST/../_prev/$c.md"
    perl -pi -e "s/^scanned: .*/scanned: ${SM_RESCAN_DATE:-2026-06-01}/" "$DEST/AI-SDD/services/$c.md" "$DEST/../_prev/$c.md"
  done
fi

echo "песочница собрана: $DEST   плечо: $ARM"
for s in repairy-api repairy-web resonance-api resonance-web; do
  printf '  %-14s %4s файлов  .git: %s\n' "$s" \
    "$(find "$DEST/$s" -type f -not -path '*/.git/*' -not -name .git | wc -l)" \
    "$( [ -d "$DEST/$s/.git" ] && echo папка || echo ФАЙЛ )"
done
