#!/usr/bin/env bash
# plan.sh — план нарезки большого сервиса на части по счёту пометок ключей.
#
#   bash plan.sh <counts.txt> <K> <w> <корень>[,<корень>…]
#
# counts.txt — вывод грепов ведущего по строкам разведчика, дословно, под заголовками:
#   ## <класс> :: <ключ|ориентир>
#   <путь>:<число>
# Вес файла = сумма совпадений строк `ключ` + w × сумма строк `ориентир`. Вес папки — сумма по её
# поддереву. Папки с ненулевым весом пакуются подряд по пути в части весом ≤ K; папка тяжелее K
# режется по своим подпапкам, а её собственные файлы — подряд по файлам; файл тяжелее K — отдельной
# частью. Всё с нулевым весом — «остаток». Только читает, печатает план в stdout.
set -u
COUNTS="${1:?counts.txt}"; K="${2:?K}"; W="${3:?w}"; ROOTS="${4:?корни через запятую}"
[ -f "$COUNTS" ] || { echo "НЕТ ФАЙЛА: $COUNTS"; exit 2; }
export LC_ALL=C

# Корни — через окружение: `awk -v` разбирает в значении обратные слеши, и путь `C:\Users\…` портится.
PLAN_ROOTS="$ROOTS" awk -v K="$K" -v W="$W" '
  # Путь к одному виду: прямые слеши, без хвостового слеша, диск `C:` в верхнем регистре; `/c/…` → `C:/…`.
  function np(p,   d) {
    gsub(/\\/, "/", p); sub(/\/+$/, "", p)
    if (p ~ /^\/[A-Za-z]\//) { d = toupper(substr(p, 2, 1)); p = d ":" substr(p, 3) }
    else if (p ~ /^[A-Za-z]:/) p = toupper(substr(p, 1, 1)) substr(p, 2)
    return p
  }
  function parent(p,   q) { q = p; sub(/\/[^\/]*$/, "", q); return q }
  function addw(path, w, cl, kind,   d) {
    fw[path] += w; isfile[path] = 1
    if (kind == "ключ") { fk[path, cl] += w; tot[cl] += w } else { orn[cl] += w }
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
    return out
  }
  function emit(kind, items, n, wsum,   i, line) {
    if (n == 0) return
    np_++
    line = sprintf("часть %02d вес %g", np_, wsum)
    cls = classes(items, n); if (cls != "") line = line " (" cls ")"
    line = line ": " kind " "
    for (i = 1; i <= n; i++) line = line (i > 1 ? "; " : "") items[i]
    print line
  }
  # Делит узел dir: дети-папки пакуются подряд, тяжёлые — рекурсивно; свои файлы — подряд.
  function cutdir(dir,   sp, ch, n, i, c, cur, nc, s, fl, nf, curf, ncf, sf) {
    n = 0
    for (c in kids) { split(c, sp, SUBSEP); if (sp[1] == dir) ch[++n] = sp[2] }
    sortlist(ch, n)
    nc = 0; s = 0; nf = 0
    for (i = 1; i <= n; i++) {
      c = ch[i]
      if (isfile[c]) { if (sw[c] > 0) fl[++nf] = c; continue }
      if (sw[c] == 0) continue
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
    nr = split(ENVIRON["PLAN_ROOTS"], rr, ",")
    for (i = 1; i <= nr; i++) { r = np(rr[i]); sub(/^[ \t]+/, "", r); sub(/[ \t]+$/, "", r); root[i] = r }
  }
  { sub(/\r$/, "") }
  /^## / {
    h = substr($0, 4); n = split(h, hp, " :: ")
    cl = hp[1]; kind = hp[n]; gsub(/^[ \t]+|[ \t]+$/, "", cl); gsub(/^[ \t]+|[ \t]+$/, "", kind)
    if (!(cl in seencl)) { seencl[cl] = 1; clist[++ncl] = cl }
    next
  }
  /:[0-9]+[ \t]*$/ && cl != "" {
    line = $0; sub(/[ \t]+$/, "", line)
    cnt = line; sub(/.*:/, "", cnt); path = substr(line, 1, length(line) - length(cnt) - 1)
    path = np(path); cnt += 0
    if (cnt == 0) next
    w = (kind == "ключ") ? cnt : W * cnt
    if (kind == "ключ") { ck[path, cl] += cnt; tot[cl] += cnt } else orn[cl] += cnt
    fw[path] += w; isfile[path] = 1
  }
  END {
    # Корень файла — самый длинный подходящий корень; файлы вне корней — в счёт не идут.
    for (p in fw) {
      best = ""
      for (i = 1; i <= nr; i++) if (index(p, root[i] "/") == 1 && length(root[i]) > length(best)) best = root[i]
      if (best == "") { outside += fw[p]; continue }
      sw[p] += fw[p]
      for (cc = 1; cc <= ncl; cc++) { cl = clist[cc]; if ((p, cl) in ck) for (q = parent(p); ; q = parent(q)) { ck[q, cl] += ck[p, cl]; if (q == best) break } }
      for (q = parent(p); ; q = parent(q)) { sw[q] += fw[p]; if (q == best) break }
      c = p; for (q = parent(c); ; q = parent(q)) { kids[q, c] = 1; if (q == best) break; c = q }
      total += fw[p]
    }
    line = "итог по классам:"
    for (c = 1; c <= ncl; c++) { cl = clist[c]; if (tot[cl] > 0) line = line " " cl " " tot[cl] "," }
    sub(/,$/, "", line); o = ""
    for (c = 1; c <= ncl; c++) { cl = clist[c]; if (orn[cl] > 0) o = o (o == "" ? "" : ", ") cl " " orn[cl] }
    if (o != "") line = line " | ориентир: " o
    print line
    if (outside > 0) printf "вне корней сервиса: вес %g — в план не вошло\n", outside
    if (total <= K) { printf "нарезка не нужна: вес %g ≤ K=%g\n", total, K; exit 0 }
    printf "вес сервиса %g при K=%g, w=%g\n", total, K, W
    for (i = 1; i <= nr; i++) {
      r = root[i]
      if (sw[r] == 0) continue
      if (sw[r] <= K) { one[1] = r; emit("папки", one, 1, sw[r]); continue }
      cutdir(r)
    }
    printf "частей %d; остаток — всё вне папок и файлов частей (пометок там нет)\n", np_
  }
' "$COUNTS"
