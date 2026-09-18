#!/usr/bin/env bash
# skills.sh — установить или обновить скиллы в репозитории со спеками одной командой:
#
#   bash tools/skills.sh                 # → ./.gigacode
#   bash tools/skills.sh .claude/skills  # → другая папка
#
# Запускать именно через `bash …`, а не `./tools/skills.sh`: в корпоративных образах запуск файлов из
# домашней папки и /tmp бывает запрещён (noexec), а bash и node читают скрипты как текст.
# По той же причине здесь нет npx: он кладёт пакет в ~/.npm/_npx и запускает его оттуда по shebang.
#
# Скопируйте этот файл в свой репозиторий со спеками (например, AI-SDD/tools/skills.sh) — адрес
# репозитория со скиллами задан ниже один раз; переопределяется переменными окружения.
set -euo pipefail

REPO="${SDD_SKILLS_REPO:-https://onework.sigma.sbrf.ru.sc/ai-security-department/AI-SDD-SKILLS.git}"
REF="${SDD_SKILLS_REF:-}"            # ветка или тег; пусто — ветка по умолчанию
DEST="${1:-.gigacode}"

command -v git  >/dev/null || { echo "нужен git";  exit 1; }
command -v node >/dev/null || { echo "нужен node 12+"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 12 ] || { echo "нужен node 12+, найден $(node -v)"; exit 1; }

SRC="$(mktemp -d "${TMPDIR:-/tmp}/sdd-skills.XXXXXX")"
trap 'rm -rf "$SRC"' EXIT

echo "скиллы: $REPO${REF:+ #$REF}"
git clone -q --depth 1 ${REF:+--branch "$REF"} "$REPO" "$SRC"
node "$SRC/install.mjs" "$DEST"
