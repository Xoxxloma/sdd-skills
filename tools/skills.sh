#!/usr/bin/env bash
# skills.sh — установить или обновить скиллы в репозитории со спеками одной командой.
#
#   bash tools/skills.sh                 # → ./.gigacode/skills
#   bash tools/skills.sh .claude/skills  # → другая папка
#
# Клонирует репозиторий со скиллами во временную папку и копирует из его .gigacode/ каждую папку,
# в которой есть SKILL.md, вместе с её reference/, в .gigacode/skills/ репозитория со спеками. Папки на «_» (стенд) и файлы верхнего уровня
# не копирует. Повторный запуск обновляет установленные скиллы на месте, чужие папки не трогает.
#
# Нужны только git и bash (на Windows — Git Bash). Запускать через `bash …`, а не `./…`: в
# корпоративных образах запуск файлов из домашней папки бывает запрещён, а bash читает скрипт как текст.
#
# Скопируйте этот файл в свой репозиторий со спеками (например, AI-SDD/tools/skills.sh). Адрес
# репозитория со скиллами задан ниже один раз; переопределяется переменными окружения.
set -euo pipefail

REPO="${SDD_SKILLS_REPO:-https://onework.sigma.sbrf.ru.sc/ai-security-department/AI-SDD-SKILLS.git}"
REF="${SDD_SKILLS_REF:-}"            # ветка или тег; пусто — ветка по умолчанию
DEST="${1:-.gigacode/skills}"

command -v git >/dev/null || { echo "нужен git"; exit 1; }

SRC="$(mktemp -d "${TMPDIR:-/tmp}/sdd-skills.XXXXXX")"
trap 'rm -rf "$SRC"' EXIT

echo "скиллы: $REPO${REF:+ #$REF}"
git clone -q --depth 1 ${REF:+--branch "$REF"} "$REPO" "$SRC"
[ -d "$SRC/.gigacode" ] || { echo "в репозитории со скиллами нет папки .gigacode/"; exit 1; }

mkdir -p "$DEST"
count=0
for dir in "$SRC"/.gigacode/*/; do
  name="$(basename "$dir")"
  case "$name" in _*) continue ;; esac
  [ -f "$dir/SKILL.md" ] || continue
  rm -rf "$DEST/$name"
  cp -R "$dir" "$DEST/$name"
  version="$(grep -m1 '^version:' "$dir/SKILL.md" | sed 's/^version:[[:space:]]*//')"
  printf '  %-28s %s\n' "$name" "${version:-—}"
  count=$((count + 1))
done
[ "$count" -gt 0 ] || { echo "в .gigacode/ не нашлось ни одной папки со SKILL.md"; exit 1; }
echo "установлено в $DEST: $count скиллов; точка входа — analyst-workspace"
