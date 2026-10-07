#!/usr/bin/env bash
# plan.sh — план нарезки большого сервиса на части по счёту пометок ключей.
#
#   bash plan.sh <counts.txt> <K> <w> <корень>[,<корень>…] [<plan.tsv>]
#
# counts.txt — вывод грепов по строкам разведчика, дословно, под заголовками:
#   ## <класс> :: <ключ|ориентир>
#   <путь>:<число>
# Путь без корня (`./src/…`, `src/…`) при одном корне считается от него. ОТКАЗ, код 3 — файл счёта
# негоден, плана нет: нет заголовков или вид не `ключ|ориентир`; под заголовком путь к файлу без счёта
# (совпадение текстом, список файлов); весь счёт вне корней; корень есть на диске, а файла из счёта там нет.
# Тесты в план и в числа «к сверке» не идут: папки `test`/`tests` в корне сервиса, `src/test` и
# `__tests__` на любой глубине, файлы `*.test.*`/`*.spec.*` (js, ts) и `*_test.go|py`.
# Вес файла = сумма совпадений строк `ключ` + w × сумма строк `ориентир`. Вес папки — сумма по её
# поддереву. Часть образуют только папки и файлы с пометками `ключ`: они пакуются подряд по пути в
# части весом ≤ K; папка тяжелее K режется по своим подпапкам, а её собственные файлы — подряд по
# файлам; файл тяжелее K — отдельной частью. Всё остальное — «остаток»: список папок и «файлов прямо в
# папке» печатается по дереву корней на диске (без скрытых папок, `node_modules`, `__pycache__` и без
# `target`, `build`, `dist` в корне сервиса); дерева нет или пунктов больше 60 — остаток назван
# отрицанием. Читает и печатает план в stdout. С пятым аргументом ещё пишет тот же план для check.sh,
# строками через табуляцию (тесты и пути вне корней туда не идут, как и в «к сверке»):
#   итог  <класс> <пометок ключ>                         — по сервису;
#   часть <NN> <класс> <пометок ключ>                    — ожидание части;
#   файл  <путь> <класс> <пометок ключ> <NN части | ->   — каждый файл с пометками `ключ`.
#   путь  <путь части> <папки|файлы> <NN части>         — владение, включая файлы без пометок.
# При отказе файл плана остаётся пустым.
set -u
COUNTS="${1:?counts.txt}"; K="${2:?K}"; W="${3:?w}"; ROOTS="${4:?корни через запятую}"; TSV="${5:-}"
[ -f "$COUNTS" ] || { echo "НЕТ ФАЙЛА: $COUNTS"; exit 2; }
[ -n "$TSV" ] && { : > "$TSV" 2>/dev/null || { echo "файл плана не пишется: $TSV" >&2; TSV=""; }; }
export LC_ALL=C

# Файлы корней — для списка остатка и проверки путей счёта. Корня на диске нет — ни того, ни другого.
# Хвостовой слеш и -mindepth: сам корень обходится, даже если он ссылка или назван как сборочная папка.
LIST="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/plan.$$")"; : > "$LIST"; trap 'rm -f "$LIST"' EXIT
ONDISK=""
IFS=',' read -r -a RR <<< "$ROOTS"
for r in "${RR[@]}"; do
  r="${r#"${r%%[![:space:]]*}"}"; r="${r%"${r##*[![:space:]]}"}"
  [ -d "$r" ] || { ONDISK="$ONDISK,0"; continue; }
  ONDISK="$ONDISK,1"
  find "$r/" -mindepth 1 -type d \( -name '.?*' -o -name node_modules -o -name __pycache__ \) -prune \
    -o -type f -print 2>/dev/null >> "$LIST"
done
# `/c/…` — это диск `C:` только там, где такие пути бывают: в Windows-оболочке либо когда рядом есть
# путь в форме диска. На Linux `/u/work` остаётся папкой.
WIN=0
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; esac
case ",$ROOTS" in *,[A-Za-z]:[\\/]*|*,\ [A-Za-z]:[\\/]*) WIN=1 ;; esac
grep -q '^[A-Za-z]:[\\/]' "$COUNTS" 2>/dev/null && WIN=1

# Корни — через окружение: `awk -v` разбирает в значении обратные слеши, и путь `C:\Users\…` портится.
PLAN_ROOTS="$ROOTS" PLAN_LIST="$LIST" PLAN_ONDISK="${ONDISK#,}" PLAN_TSV="$TSV" awk -v K="$K" -v W="$W" -v WIN="$WIN" '
  # Путь к одному виду: прямые слеши, без хвостового слеша, диск `C:` в верхнем регистре; `/c/…` → `C:/…`;
  # двойные слеши схлопнуты, `/./` и `<папка>/../` раскрыты (ведущий собирает корень из `../<сервис>`).
  function np(p,   d) {
    gsub(/\\/, "/", p); gsub(/\/\/+/, "/", p); sub(/\/+$/, "", p)
    while (sub(/\/\.(\/|$)/, "/", p)) ;
    while (match(p, /\/[^\/]+\/\.\.(\/|$)/) && substr(p, RSTART + 1, 3) != "../") p = substr(p, 1, RSTART) substr(p, RSTART + RLENGTH)
    sub(/\/+$/, "", p)
    if (WIN && p ~ /^\/[A-Za-z]\//) { d = toupper(substr(p, 2, 1)); p = d ":" substr(p, 3) }
    else if (p ~ /^[A-Za-z]:/) p = toupper(substr(p, 1, 1)) substr(p, 2)
    return p
  }
  # Путь без корня — от единственного корня; корней несколько — остаётся как есть и уйдёт «вне корней».
  function full(p) {
    gsub(/\\/, "/", p)
    if (p ~ /^(\/|[A-Za-z]:)/) return np(p)
    while (sub(/^\.\//, "", p)) ;
    return np(nr == 1 ? root[1] "/" p : p)
  }
  function parent(p,   q) { q = p; sub(/\/[^\/]*$/, "", q); return q }
  function rootof(p,   i, best) {
    best = ""
    for (i = 1; i <= nr; i++) if (index(p, root[i] "/") == 1 && length(root[i]) > length(best)) best = root[i]
    return best
  }
  # Тест — только по устойчивым приметам: пакет `ru/bank/test` и `openapi.spec.yaml` тестами не считаются.
  function istest(rel,   s) {
    s = "/" tolower(rel)
    if (s ~ /^\/(test|tests)\// || s ~ /\/src\/test\// || s ~ /\/__tests__\//) return 1
    return (s ~ /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/ || s ~ /_test\.(go|py)$/)
  }
  function covered(p, r,   q) {
    if (p in cov) return 1
    for (q = parent(p); ; q = parent(q)) { if (q in cov) return 1; if (q == r || q == "" || q !~ /\//) return 0 }
  }
  # Сортировка вставками: списки детей короткие.
  function sortlist(arr, n,   i, j, t) {
    for (i = 2; i <= n; i++) { t = arr[i]; for (j = i - 1; j >= 1 && arr[j] > t; j--) arr[j + 1] = arr[j]; arr[j + 1] = t }
  }
  function classes(items, n,   i, c, s, out, cl) {
    out = ""
    for (c = 1; c <= ncl; c++) {
      cl = clist[c]; s = 0
      for (i = 1; i <= n; i++) s += ck[items[i], cl]
      if (s > 0) out = out (out == "" ? "" : ", ") cl " " s
    }
    for (c = 1; c <= ncl; c++) {
      cl = clist[c]; s = 0
      for (i = 1; i <= n; i++) s += co[items[i], cl]
      if (s > 0) out = out (out == "" ? "" : ", ") "ориентир " cl " " s
    }
    return out
  }
  function sums(arr, pre,   c, cl, out) {
    out = ""
    for (c = 1; c <= ncl; c++) { cl = clist[c]; if (arr[cl] > 0) out = out (out == "" ? "" : ", ") pre cl " " arr[cl] }
    return out
  }
  function emit(kind, items, n, wsum,   i, line, c, cl, s) {
    if (n == 0) return
    np_++
    line = sprintf("часть %02d вес %g", np_, wsum)
    cls = classes(items, n); if (cls != "") line = line " (" cls ")"
    line = line ": " kind " "
    for (i = 1; i <= n; i++) { cov[items[i]] = 1; partof[items[i]] = np_; partkind[items[i]] = kind; line = line (i > 1 ? "; " : "") items[i] }
    for (c = 1; c <= ncl; c++) { cl = clist[c]; s = 0; for (i = 1; i <= n; i++) s += ck[items[i], cl]; if (s > 0) partexp[np_, cl] = s }
    print line
  }
  # Номер части, которой принадлежит файл: сам файл либо ближайшая папка части; частей нет — «-».
  function partfor(p, r,   q) {
    if (p in partof) return sprintf("%02d", partof[p])
    for (q = parent(p); ; q = parent(q)) { if (q in partof) return sprintf("%02d", partof[q]); if (q == r || q == "" || q !~ /\//) return "-" }
  }
  # План для check.sh — строками через табуляцию; без пятого аргумента ничего не пишет.
  function dump(   f, c, cl, i, n, fl, p, v, paths, ns) {
    f = ENVIRON["PLAN_TSV"]; if (f == "") return
    n = 0; for (p in rt) if (fk[p] > 0) fl[++n] = p
    sortlist(fl, n)
    for (i = 1; i <= n; i++) for (c = 1; c <= ncl; c++) { cl = clist[c]; v[cl] += ck[fl[i], cl] }
    for (c = 1; c <= ncl; c++) { cl = clist[c]; if (v[cl] > 0) print "итог\t" cl "\t" v[cl] > f }
    for (i = 1; i <= np_; i++) for (c = 1; c <= ncl; c++) { cl = clist[c]; if ((i, cl) in partexp) printf "часть\t%02d\t%s\t%d\n", i, cl, partexp[i, cl] > f }
    ns = 0; for (p in partof) paths[++ns] = p; sortlist(paths, ns)
    for (i = 1; i <= ns; i++) { p = paths[i]; printf "путь\t%s\t%s\t%02d\n", p, partkind[p], partof[p] > f }
    for (i = 1; i <= n; i++) { p = fl[i]; for (c = 1; c <= ncl; c++) { cl = clist[c]; if (ck[p, cl] > 0) print "файл\t" p "\t" cl "\t" ck[p, cl] "\t" partfor(p, rt[p]) > f } }
    close(f)
  }
  # Делит узел dir: дети-папки с ключами пакуются подряд, тяжёлые — рекурсивно; свои файлы с ключами — подряд.
  function cutdir(dir,   sp, ch, n, i, c, cur, nc, s, fl, nf, curf, ncf, sf) {
    inner[dir] = 1
    n = 0
    for (c in kids) { split(c, sp, SUBSEP); if (sp[1] == dir) ch[++n] = sp[2] }
    sortlist(ch, n)
    nc = 0; s = 0; nf = 0
    for (i = 1; i <= n; i++) {
      c = ch[i]
      if (kw[c] == 0) continue
      if (isfile[c]) { fl[++nf] = c; continue }
      if (sw[c] > K) { if (nc) { emit("папки", cur, nc, s); delete cur; nc = 0; s = 0 }; cutdir(c); continue }
      if (s + sw[c] > K && nc) { emit("папки", cur, nc, s); delete cur; nc = 0; s = 0 }
      cur[++nc] = c; s += sw[c]
    }
    if (nc) emit("папки", cur, nc, s)
    ncf = 0; sf = 0
    for (i = 1; i <= nf; i++) {
      c = fl[i]
      if (sf + sw[c] > K && ncf) { emit("файлы", curf, ncf, sf); delete curf; ncf = 0; sf = 0 }
      curf[++ncf] = c; sf += sw[c]
    }
    if (ncf) emit("файлы", curf, ncf, sf)
  }
  BEGIN {
    n = split(ENVIRON["PLAN_ROOTS"], rr, ","); split(ENVIRON["PLAN_ONDISK"], od, ",")
    for (i = 1; i <= n; i++) {
      r = rr[i]; sub(/^[ \t]+/, "", r); sub(/[ \t]+$/, "", r); r = np(r)
      if (r in ondisk) continue                        # один корень дважды — один раз
      root[++nr] = r; ondisk[r] = od[i] + 0
    }
  }
  NR == 1 { sub(/^\357\273\277/, "") }
  { sub(/\r$/, "") }
  /^## / {
    h = substr($0, 4); n = split(h, hp, " :: ")
    cl = hp[1]; kind = hp[n]; gsub(/^[ \t]+|[ \t]+$/, "", cl); gsub(/^[ \t]+|[ \t]+$/, "", kind)
    sub(/[ \t]*\(.*$/, "", kind)                       # пометка счётчика: «ключ (без маски)» — всё равно ключ
    hdr++
    if (n < 2 || cl == "" || (kind != "ключ" && kind != "ориентир")) { badh++; if (badh1 == "") badh1 = substr($0, 1, 160) }
    if (!(cl in seencl)) { seencl[cl] = 1; clist[++ncl] = cl }
    next
  }
  cl == "" { next }
  /:[0-9]+[ \t]*$/ {
    line = $0; sub(/[ \t]+$/, "", line)
    cnt = line; sub(/.*:/, "", cnt); path = substr(line, 1, length(line) - length(cnt) - 1)
    path = full(path); cnt += 0
    if (cnt == 0) next
    if (kind == "ключ") { ck[path, cl] += cnt; tot[cl] += cnt; fw[path] += cnt; fk[path] += cnt }
    else { co[path, cl] += cnt; orn[cl] += cnt; fw[path] += W * cnt }
    isfile[path] = 1
    next
  }
  # Путь к файлу без счёта в конце — совпадение текстом либо список файлов: греп снят не в режиме счёта.
  /^[^ \t#].*\.[A-Za-z0-9]+:/ || (/[\/\\]/ && /\.[A-Za-z0-9]+[ \t]*$/) { bad++; if (bad1 == "") bad1 = substr($0, 1, 160) }
  END {
    if (hdr == 0) { print "ОТКАЗ: в файле счёта нет заголовков «## <класс> :: … :: ключ|ориентир»"; exit 3 }
    if (badh > 0) { printf "ОТКАЗ: заголовков не по форме «## <класс> :: … :: ключ|ориентир»: %d; первый: %s\n", badh, badh1; exit 3 }
    if (bad > 0) { printf "ОТКАЗ: счёт неполон — строк не по форме <путь>:<число>: %d; первая: %s\n", bad, bad1; exit 3 }
    # Корень на диске, а файла из счёта там нет — путь записан не от корня либо это не путь.
    for (p in fw) {
      best = rootof(p)
      if (best == "" || !ondisk[best]) continue
      if ((getline junk < p) < 0) { ghost++; if (ghost1 == "" || p < ghost1) ghost1 = p }
      close(p)
    }
    if (ghost > 0) { printf "ОТКАЗ: путей счёта, которых нет на диске: %d; первый: %s\n", ghost, ghost1; exit 3 }
    # Корень файла — самый длинный подходящий корень; файлы вне корней и тестовые — в план не идут.
    for (p in fw) {
      best = rootof(p)
      if (best == "") { outside += fw[p]; continue }
      if (istest(substr(p, length(best) + 2))) {
        tw += fw[p]; q = parent(p); if (!(q in tdir)) { tdir[q] = 1; tl[++ntl] = q }
        for (cc = 1; cc <= ncl; cc++) { cl = clist[cc]; tk[cl] += ck[p, cl]; to[cl] += co[p, cl] }
        continue
      }
      rt[p] = best; sw[p] += fw[p]; kw[p] += fk[p]
      for (cc = 1; cc <= ncl; cc++) {
        cl = clist[cc]
        if ((p, cl) in ck) for (q = parent(p); ; q = parent(q)) { ck[q, cl] += ck[p, cl]; if (q == best) break }
        if ((p, cl) in co) for (q = parent(p); ; q = parent(q)) { co[q, cl] += co[p, cl]; if (q == best) break }
      }
      for (q = parent(p); ; q = parent(q)) { sw[q] += fw[p]; kw[q] += fk[p]; if (q == best) break }
      c = p; for (q = parent(c); ; q = parent(q)) { kids[q, c] = 1; if (q == best) break; c = q }
      total += fw[p]; ktotal += fk[p]
    }
    if (outside > 0 && total == 0 && tw == 0) { printf "ОТКАЗ: все пути счёта вне корней сервиса (вес %g) — плана нет\n", outside; exit 3 }
    line = "итог по классам: " sums(tot, ""); o = sums(orn, "")
    if (o != "") line = line " | ориентир: " o
    print line
    if (outside > 0) printf "вне корней сервиса: вес %g — в план не вошло\n", outside
    if (tw > 0) {
      line = sums(tk, ""); o = sums(to, "ориентир ")
      sortlist(tl, ntl); line = "в тестовых папках: " line (line != "" && o != "" ? ", " : "") o " — в план и в сверку не идут: "
      for (i = 1; i <= ntl && i <= 5; i++) line = line (i > 1 ? "; " : "") tl[i]
      if (ntl > 5) line = line sprintf("; …и ещё %d", ntl - 5)
      print line
      for (cc = 1; cc <= ncl; cc++) { cl = clist[cc]; nk[cl] = tot[cl] - tk[cl]; no[cl] = orn[cl] - to[cl] }
      line = "к сверке: " sums(nk, ""); o = sums(no, "")
      if (o != "") line = line " | ориентир: " o
      print line
    }
    if (total <= K) { printf "нарезка не нужна: вес %g ≤ K=%g\n", total, K; dump(); exit 0 }
    if (ktotal == 0) { printf "нарезка не нужна: вес 0 ≤ K=%g по ключам (ориентир весит %g)\n", K, total; dump(); exit 0 }
    printf "вес сервиса %g при K=%g, w=%g\n", total, K, W
    for (i = 1; i <= nr; i++) {
      r = root[i]
      if (kw[r] == 0) continue
      if (sw[r] <= K) { one[1] = r; emit("папки", one, 1, sw[r]); continue }
      cutdir(r)
    }
    # Ориентир вне частей — остатку, числом и файлом.
    n = 0
    for (p in rt) if (kw[p] == 0 && !covered(p, rt[p]))
      for (cc = 1; cc <= ncl; cc++) { cl = clist[cc]; if (co[p, cl] > 0) ol[++n] = p " — " cl " " co[p, cl] }
    if (n > 0) {
      sortlist(ol, n); line = "остатку по ориентиру: "
      for (i = 1; i <= n && i <= 20; i++) line = line (i > 1 ? "; " : "") ol[i]
      if (n > 20) line = line sprintf("; …и ещё %d", n - 20)
      print line
    }
    # Остаток списком: папки целиком вне частей и «файлы прямо в папке» у разрезанных папок.
    seen = 0
    while ((getline f < ENVIRON["PLAN_LIST"]) > 0) {
      sub(/\r$/, "", f); if (f == "") continue
      seen = 1; f = np(f); r = rootof(f)
      if (r == "") continue
      rel = substr(f, length(r) + 2)
      if (rel ~ /^(target|build|dist)\// || istest(rel) || covered(f, r)) continue
      top = ""
      for (q = parent(f); ; q = parent(q)) { if (!(q in inner)) top = q; if (q == r) break }
      if (top == "") { q = parent(f); if (!(q in loose)) { loose[q] = 1; lo[++nl] = q } }
      else if (!(top in rem)) { rem[top] = 1; rl[++nrem] = top }
    }
    if (!seen) { printf "частей %d; остаток — всё вне папок и файлов частей (дерева корней на диске нет)\n", np_; dump(); exit 0 }
    if (nrem + nl == 0) { printf "частей %d; остаток — пусто: вне частей файлов нет\n", np_; dump(); exit 0 }
    if (nrem + nl > 60) { printf "частей %d; остаток — всё вне папок и файлов частей (пунктов больше 60 — список не печатается)\n", np_; dump(); exit 0 }
    sortlist(rl, nrem); sortlist(lo, nl)
    printf "частей %d; остаток — пунктов %d:\n", np_, nrem + nl
    for (i = 1; i <= nrem; i++) print "  папка " rl[i]
    for (i = 1; i <= nl; i++) print "  файлы прямо в " lo[i]
    dump()
  }
' "$COUNTS"
