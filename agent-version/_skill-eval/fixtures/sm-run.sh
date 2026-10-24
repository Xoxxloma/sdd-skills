# sm-run.sh — запуск скрипта скилла service-map-2.0 в самотестах; подключается точкой.
#   sm_run <путь к скрипту.sh> [ИМЯ=значение …] [аргументы …] — то же, что `env ИМЯ=значение … bash <скрипт> …`.
# SM_RUNNER=ps1 — тот же вызов так, как его делает агент на Windows: `powershell -File reference/run.ps1 <имя.sh>`,
# переменные — словами после имени скрипта, пути — в форме Windows с `\`. Автоконвертацию путей MSYS выключаем:
# префикс `/api` путём не станет, пути конвертируются здесь — только существующие или с существующей папкой.
# Конвертируется только путь с диском (`/c/…`); `/tmp/…` и прочие пути MSYS — как есть: в той же форме они
# стоят внутри файлов фикстур (counts.txt), а у агента на Windows обе стороны — в форме Windows.
sm_winpath() {
  local p="$1" d
  case "$p" in /[A-Za-z]/*) ;; *) printf '%s' "$p"; return ;; esac
  d="$(dirname "$p")"
  if [ -e "$p" ] || { [ "$d" != / ] && [ -d "$d" ]; }; then cygpath -w "$p"; else printf '%s' "$p"; fi
}
sm_run() {
  local s="$1" a vars=() args=(); shift
  if [ "${SM_RUNNER:-}" != ps1 ]; then
    while [ $# -gt 0 ] && [[ "$1" =~ ^[A-Z][A-Z0-9_]*= ]]; do vars+=("$1"); shift; done
    env ${vars[@]+"${vars[@]}"} bash "$s" "$@"; return
  fi
  for a in "$@"; do
    if [[ "$a" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then args+=("${BASH_REMATCH[1]}=$(sm_winpath "${BASH_REMATCH[2]}")")
    else args+=("$(sm_winpath "$a")"); fi
  done
  MSYS2_ARG_CONV_EXCL='*' MSYS_NO_PATHCONV=1 powershell -NoProfile -ExecutionPolicy Bypass \
    -File "$(cygpath -w "$(dirname "$s")/run.ps1")" "$(basename "$s")" ${args[@]+"${args[@]}"}
}
