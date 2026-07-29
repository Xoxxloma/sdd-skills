#!/usr/bin/env bash
# Грейдер SM-BULK: считает инвентарь в карточке по секциям. Эталон: 48 / 12 / 9 / 7.
for f in "$@"; do
  echo "=== $f"
  echo -n "  контракт-блоков: "; awk '/^## Публичный контракт/{s=1;next} /^## /{s=0} s && /^### /{c++} END{print c+0}' "$f"
  echo -n "  события-строк:   "; awk '/^## События/{s=1;next} /^## /{s=0} s && /^\| *(публикует|потребляет)/{c++} END{print c+0}' "$f"
  echo -n "  сущностей:       "; awk '/^## Владеет данными/{s=1;next} /^## /{s=0} s && /^### /{c++} END{print c+0}' "$f"
  echo -n "  ролей-строк:     "; awk '/^## Роли и доступ/{s=1;next} /^## /{s=0} s && /^\|/ && !/^\| *Роль/ && !/^\|---/ && !/^\| *— *\|/{c++} END{print c+0}' "$f"
  echo -n "  версии:          "; grep -c 'v5\.0\.12\|chi v5\|go 1\.22\|pgx v5\|kafka-go v0' "$f"
  echo -n "  секрет:          "; grep -c '8Hq2LmX9pR4tVzKw1NcBd7YsAe3GfUj0' "$f"
  echo -n "  обобщение CRUD:  "; grep -ci 'CRUD' "$f"
  echo -n "  Заметки команды: "; grep -c '^## Заметки команды' "$f"
done
