#!/usr/bin/env bash
# Независимые тесты скриптов нарезки service-map-2.0 (задача Б): plan.sh, assemble.sh, promote.sh.
# Моделей не запускает, пишет только во временную папку.
#   bash test-split-scripts.sh <папка со скриптами>
# Например: bash test-split-scripts.sh ../../../service-map-2.0/reference
# SM_SPLIT_KEEP=1 — не удалять временную папку (путь печатается). Нужны bash и node.
# Фазы: 0) оракул plan.sh (plan-oracle.mjs) против expect.json — проверка самого стенда; 1) plan.sh на
# синтетике cases/plan/*; 2) plan.sh на настоящих деревьях (NRS-TAIL, SM-MONO-DGS, repairy-api) против
# оракула, у обеих — и файл плана (пятый аргумент) против stdout; 3) assemble.sh на cases/assemble/*; 4) круговой: карточка repairy-api из as-base режется на
# голову и 3 части с дублями и склеивается обратно; 5) promote.sh. Сводка — compare.mjs.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL="$(cd "$HERE/../.." && pwd)"
SCR="${1:?папка со скриптами plan.sh, assemble.sh, promote.sh}"
SCR="$(cd "$SCR" && pwd)" || exit 2
command -v node >/dev/null 2>&1 || { echo "нужен node" >&2; exit 2; }
CARD="${SM_SPLIT_CARD:-$EVAL/runs/2026-10-04-as-base/sandbox/scan-1/w/AI-SDD/services/repairy-api.md}"

OUT="$(mktemp -d "${TMPDIR:-/tmp}/sm-split.XXXXXX")"
if [ -n "${SM_SPLIT_KEEP:-}" ]; then echo "временная папка: $OUT"; else trap 'rm -rf "$OUT"' EXIT; fi

# node — windows-процесс: пути ему отдаются в форме C:/…; posix-форма (для counts.txt в форме bash)
# передаётся без конвертации MSYS.
winp() { cygpath -m "$1" 2>/dev/null || { (cd "$1" 2>/dev/null && pwd -W 2>/dev/null) || echo "$1"; }; }
HEREW="$(winp "$HERE")"
nodex() { MSYS2_ARG_CONV_EXCL='*' MSYS_NO_PATHCONV=1 node "$@"; }
now_ms() { local t; t=$(date +%s%N 2>/dev/null); case "$t" in *N|'') echo $(( $(date +%s) * 1000 )) ;; *) echo $(( t / 1000000 )) ;; esac; }
# runs <папка> <скрипт> <аргументы…> → stdout, stderr, rc, ms в папке
runs() {
  local d="$1"; shift
  local t0 t1; t0=$(now_ms)
  bash "$@" >"$d/stdout" 2>"$d/stderr"; echo $? >"$d/rc"
  t1=$(now_ms); echo $(( t1 - t0 )) >"$d/ms"
}
args3() { local f="$1"; K=''; W=''; R=''; { IFS= read -r K; IFS= read -r W; IFS= read -r R; } < "$f"; K="${K%$'\r'}"; W="${W%$'\r'}"; R="${R%$'\r'}"; }

echo "скрипты: $SCR"
for s in plan.sh assemble.sh promote.sh; do [ -f "$SCR/$s" ] && echo "  $s — есть" || echo "  $s — НЕТ, его фазы не измерены"; done

# ─── plan.sh ───
for c in "$HERE"/cases/plan/*/; do
  name="$(basename "$c")"; d="$OUT/plan/$name"; mkdir -p "$d"
  nodex "$HEREW/prep.mjs" plan "$(winp "$c")" "$d" "$(winp "$d")" || { echo "prep $name не собрался" >&2; continue; }
  args3 "$d/args.txt"
  [ -f "$SCR/plan.sh" ] && runs "$d" "$SCR/plan.sh" "$d/counts.txt" "$K" "$W" "$R" "$d/plan.tsv"
done
mkdir -p "$OUT/real"
nodex "$HEREW/prep.mjs" real "$(winp "$EVAL")" "$OUT/real" "$(winp "$OUT/real")"
if [ -f "$SCR/plan.sh" ]; then
  for d in "$OUT"/real/real-*/; do
    [ -d "$d" ] || continue; d="${d%/}"
    args3 "$d/args.txt"
    runs "$d" "$SCR/plan.sh" "$d/counts.txt" "$K" "$W" "$R" "$d/plan.tsv"
  done
fi

# ─── assemble.sh ───
if [ -f "$SCR/assemble.sh" ]; then
  for c in "$HERE"/cases/assemble/*/; do
    name="$(basename "$c")"; case "$name" in _*) continue ;; esac
    d="$OUT/asm/$name"; mkdir -p "$d"
    nodex "$HEREW/prep.mjs" asm "$(winp "$c")" "$d" "$(winp "$d")" || { echo "prep $name не собрался" >&2; continue; }
    { IFS= read -r S; IFS= read -r DATE; } < "$d/args.txt"
    runs "$d" "$SCR/assemble.sh" "$d/parts" "${S%$'\r'}" "${DATE%$'\r'}" "$d/draft.md" "$d/opis.md"
  done
  if [ -f "$CARD" ]; then
    d="$OUT/roundtrip"; mkdir -p "$d"
    nodex "$HEREW/prep.mjs" roundtrip "$(winp "$CARD")" "$d" "$(winp "$d")" 2026-10-04
    { IFS= read -r S; IFS= read -r DATE; } < "$d/args.txt"
    runs "$d" "$SCR/assemble.sh" "$d/parts" "${S%$'\r'}" "${DATE%$'\r'}" "$d/draft.md" "$d/opis.md"
  else
    echo "кругового случая нет: не найдена карточка $CARD"
  fi
fi

# ─── promote.sh ───
if [ -f "$SCR/promote.sh" ]; then
  P="$OUT/promote"; mkdir -p "$P/_fakebin"
  nodex "$HEREW/prep.mjs" promote - "$P" "$(winp "$P")"
  # сбойный cp: пишет только первые 20 байт источника — копия заведомо расходится
  cat > "$P/_fakebin/cp" <<'EOF'
#!/usr/bin/env bash
echo "cp $*" >> "$SM_SPLIT_CP_MARK"
args=(); for a in "$@"; do case "$a" in -*) ;; *) args+=("$a") ;; esac; done
n=${#args[@]}; src="${args[0]}"; dst="${args[$((n-1))]}"
[ -d "$dst" ] && dst="$dst/$(basename "$src")"
head -c 20 "$src" > "$dst"
EOF
  chmod +x "$P/_fakebin/cp"
  while IFS='|' read -r name draft dest inject; do
    [ -n "$name" ] || continue; inject="${inject%$'\r'}"
    d="$P/$name"
    if [ "$inject" = 1 ]; then
      ( export SM_SPLIT_CP_MARK="$d/cp-used" PATH="$P/_fakebin:$PATH"; runs "$d" "$SCR/promote.sh" "$draft" "$dest" )
    else
      runs "$d" "$SCR/promote.sh" "$draft" "$dest"
    fi
  done < "$P/cases.txt"
fi

nodex "$HEREW/compare.mjs" "$(winp "$HERE")" "$(winp "$OUT")"
