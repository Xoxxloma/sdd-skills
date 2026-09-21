#!/usr/bin/env bash
# skills.sh — установить или обновить скиллы в репозитории со спеками одной командой.
#
#   bash .gigacode/skills/analyst-skills-update/reference/skills.sh                 # → ./.gigacode/skills
#   bash .gigacode/skills/analyst-skills-update/reference/skills.sh .claude/skills  # → другая папка
#
# Клонирует репозиторий со скиллами во временную папку и копирует из его skills/ каждую папку,
# в которой есть SKILL.md, вместе с её reference/, в .gigacode/skills/ репозитория со спеками. Папки на «_» (стенд) и файлы верхнего уровня
# не копирует. Повторный запуск обновляет установленные скиллы на месте, чужие папки не трогает.
#
# Скрипт живёт внутри скилла analyst-skills-update и обновляется вместе с ним. Поскольку при этом
# перезаписывается его собственная папка, он сначала копирует себя во временный файл и работает из него.
#
# Нужны только git и bash (на Windows — Git Bash). Запускать через `bash …`, а не `./…`: в
# корпоративных образах запуск файлов из домашней папки бывает запрещён, а bash читает скрипт как текст.
#
# Адрес репозитория со скиллами задан ниже один раз; переопределяется переменными окружения.
set -euo pipefail

# Работаем из временной копии: оригинал лежит в папке, которую ниже удалим и перепишем.
if [ -z "${SDD_SKILLS_SELF:-}" ]; then
  SELF="$(mktemp "${TMPDIR:-/tmp}/sdd-skills-self.XXXXXX")"
  cp "$0" "$SELF"
  SDD_SKILLS_SELF="$SELF" exec bash "$SELF" "$@"
fi
trap 'rm -f "$SDD_SKILLS_SELF"' EXIT

REPO="${SDD_SKILLS_REPO:-https://api.sc-ci.sber.ru/ai-security-deparment/AI-SDD-SKILLS.git}"
REF="${SDD_SKILLS_REF:-}"            # ветка или тег; пусто — ветка по умолчанию
DEST="${1:-.gigacode/skills}"

command -v git >/dev/null || { echo "нужен git"; exit 1; }

SRC="$(mktemp -d "${TMPDIR:-/tmp}/sdd-skills.XXXXXX")"
trap 'rm -rf "$SRC" "$SDD_SKILLS_SELF"' EXIT

echo "скиллы: $REPO${REF:+ #$REF}"
git clone -q --depth 1 ${REF:+--branch "$REF"} "$REPO" "$SRC"
SKILLS="$SRC/skills"
[ -d "$SKILLS" ] || SKILLS="$SRC/.gigacode"
[ -d "$SKILLS" ] || { echo "в репозитории со скиллами нет папки skills/"; exit 1; }

mkdir -p "$DEST"
count=0
for dir in "$SKILLS"/*/; do
  name="$(basename "$dir")"
  case "$name" in _*) continue ;; esac
  [ -f "$dir/SKILL.md" ] || continue
  rm -rf "$DEST/$name"
  cp -R "$dir" "$DEST/$name"
  version="$(grep -m1 '^version:' "$dir/SKILL.md" | sed 's/^version:[[:space:]]*//')"
  printf '  %-28s %s\n' "$name" "${version:-—}"
  count=$((count + 1))
done
[ "$count" -gt 0 ] || { echo "в $(basename "$SKILLS")/ не нашлось ни одной папки со SKILL.md"; exit 1; }
echo "установлено в $DEST: $count скиллов; точка входа — analyst-workspace"
