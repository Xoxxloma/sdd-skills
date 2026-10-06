# Directed comparison of parsed card and inventory. Invoked by check.sh only.
# Card: class/key/raw-body/line/section/semantic/fields/service/unchecked.
# Inventory: key/facts/source-present/class/source/line/service/facts-without-source.
# stdout: complete seven-column TSV; legacy: compact diagnostics consumed by check.sh.
BEGIN { FS = OFS = "\t" }
function canonical(c, k) {
  if (c == "контракт" && k ~ /^(query|mutation|subscription) /) sub(/\(.*\)$/, "", k)
  return k
}
function noq(k) { sub(/\?[A-Za-z_][^=?\/ ]*=.*$/, "", k); return k }
function callbare(k) {
  if (k !~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / && k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k)
  return k
}
function clean(s) { gsub(/[\t\r\n]/, " ", s); return s }
function row(category, c, k, source, line, description) {
  print category, (c == "" ? "неизвестен" : c), clean(k), clean(source), clean(cardfile), line + 0, clean(description)
}
function candidate(c, k, mode,   j,id,dk,mk,count,result) {
  count = 0; result = ""
  for (j = 1; j <= nd; j++) {
    id = order[j]; if (c != "" && classes[id] != c) continue
    dk = keys[id]
    mk = classes[id] == "потребляет" ? api[id] : dk
    if (mode == "exact" && dk != k && !(classes[id] == "потребляет" && api[id] == k)) continue
    if (mode == "role" && !(classes[id] == "роли" && dk == k)) continue
    if (mode == "query" && (used[id] || noq(mk) != noq(k))) continue
    if (mode == "call" && (used[id] || classes[id] != "контракт" || sections[id] ~ /^## Публичный API/ || callbare(dk) != callbare(k))) continue
    count++; result = id
  }
  # A frontend inventory lists calls, whereas its table may name several providers of that call.
  # This confirms presence of the call, without inferring which provider the source refers to.
  ambiguous = count > 1 && c != "потребляет"
  return count == 1 || (count > 1 && c == "потребляет") ? result : ""
}
FILENAME == ARGV[1] {
  c = $1; k = canonical(c, $2); id = c SUBSEP k
  if (!(id in bodies)) { order[++nd] = id; classes[id] = c; keys[id] = k; lines[id] = $4; sections[id] = $5; bodies[id] = 0 }
  if ($3 > bodies[id]) bodies[id] = $3
  value = NF >= 6 ? $6 : $3
  if (value > semantics[id]) semantics[id] = value
  if ($7 > fields[id]) fields[id] = $7
  if ($8 > cardservice[id]) cardservice[id] = $8
  if ($9 > unchecked[id]) unchecked[id] = $9
  repeats[id]++
  if (c == "потребляет") { split(k, a, " :: "); api[id] = a[2] }
  next
}
{
  c = $4; k = canonical(c, $1); oid = c SUBSEP k
  if (!(oid in ofacts)) { oo[++no] = oid; okey[oid] = k; oc[oid] = c; osrc[oid] = $3; opath[oid] = $5; oline[oid] = $6; ofacts[oid] = 0 }
  if ($2 > ofacts[oid]) ofacts[oid] = $2
  if ($7 > oservice[oid]) oservice[oid] = $7
  if ($8 > factnosrc[oid]) factnosrc[oid] = $8
  if ($3 > osrc[oid]) { osrc[oid] = $3; opath[oid] = $5 }
}
END {
  # Exact and class-aware matches take priority over aliases.
  for (i = 1; i <= no; i++) {
    oid = oo[i]; c = oc[oid]; k = okey[oid]
    hit = candidate(c, k, "exact"); oa[oid] = ambiguous
    if (hit == "" && !oa[oid] && c == "контракт") { hit = candidate("потребляет", k, "exact"); oa[oid] = ambiguous }
    if (hit == "" && !oa[oid] && (c == "роли" || c == "")) {
      tail = k; sub(/.*\./, "", tail)
      if (tail != k) { hit = candidate("роли", tail, "role"); oa[oid] = ambiguous }
    }
    if (hit != "") { matches[oid] = hit; used[hit] = 1 }
  }
  for (i = 1; i <= no; i++) {
    oid = oo[i]; if (oid in matches || oa[oid]) continue
    c = oc[oid]; k = okey[oid]; hit = candidate(c, k, "query")
    if (hit == "" && !ambiguous && c == "контракт") hit = candidate("потребляет", k, "query")
    if (hit == "" && !ambiguous && (c == "контракт" || c == "")) hit = candidate(c, k, "call")
    oa[oid] = ambiguous
    if (hit != "") { matches[oid] = hit; used[hit] = 1 }
  }
  for (i = 1; i <= no; i++) {
    oid = oo[i]; c = oc[oid]; k = okey[oid]; hit = matches[oid]
    if (hit == "") {
      print "MISS", k > legacy; print "CLS", "без пары" > legacy
      if (oa[oid]) row("не-проверено", c, k, opath[oid], 0, "Несколько возможных пар; класс ключа требует проверки по источнику")
      else if (!osrc[oid]) row("справка", c, k, "", 0, "Строка описи без пары и без источника; пропуск не доказан")
      else row(c == "бизнес" ? "проверить-форму" : "добор-ключ", c, k, opath[oid], 0, "Ключ с источником из описи не найден в карточке; проверить по коду")
      continue
    }
    c = classes[hit]; print "CLS", c > legacy
    sources[hit] = osrc[oid] ? opath[oid] : ""
    if (osrc[oid] && oservice[oid] && cardservice[hit] && !unchecked[hit] && ofacts[oid] == 0 && semantics[hit] == 0 && c == "контракт") lawful[hit] = 1
    if (!osrc[oid]) row("проверить-форму", c, keys[hit], "", lines[hit], "Совпавший ключ описи без источника: подтвердить по файлу либо снять неподтвержденное")
    if (factnosrc[oid]) row("не-проверено", c, keys[hit], opath[oid], lines[hit], "У фактов описи отсутствуют источники; сам ключ не подтверждает поведение")
    if (ofacts[oid] > 0 && semantics[hit] == 0 && c !~ /^(экраны|роли|зависит|потребляет)$/) {
      print "EMPTY", k > legacy
      row("добор-факт", c, keys[hit], opath[oid], lines[hit], "Факт найден в описи, соответствующий блок карточки пуст")
      factlost[hit] = 1
    }
  }
  for (j = 1; j <= nd; j++) {
    id = order[j]; c = classes[id]; k = keys[id]
    if (unchecked[id]) row("не-проверено", c, k, sources[id], lines[id], "Поведение блока проверено не полностью; отсутствие фактов не установлено")
    cardcount[c]++; if (semantics[id] > 0) withbody[c]++
    if (lawful[id]) { lawfulcount[c]++; row("справка", c, k, sources[id], lines[id], "Служебный блок: назначение явно подтверждено в карточке и описи с источником") }
    if (semantics[id] == 1 && c ~ /^(контракт|задачи|топики)$/) row("справка", c, k, sources[id], lines[id], "Одна строка факта; это не доказательство полноты поведения")
    if (c == "сущности") row("справка", c, k, sources[id], lines[id], "Поля " (fields[id] + 0) ", строки семантики " (semantics[id] + 0) "; схема не доказывает полноту поведения")
    if (c == "контракт") {
      protocol = k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) / ? "REST" : k ~ /^(query|mutation|subscription) / ? "GraphQL" : sections[id] ~ /^## Публичный API/ ? "lib" : k ~ /^(rpc )?[A-Za-z_][A-Za-z0-9_.]*[.\/]/ ? "RPC" : "неизвестен"
      protocolcount[protocol]++
    }
    if (!used[id] && c !~ /^(зависит|потребляет)$/) {
      print "EXTRA", c ": " k > legacy
      row("справка", c, k, "", lines[id], "Блок есть в карточке, пары в описи нет; опись ради него не дописывать")
    }
    if (semantics[id] == 0 && c ~ /^(контракт|задачи|топики|сущности|бизнес)$/ && !factlost[id] && !lawful[id]) {
      if (c ~ /^(контракт|задачи|топики)$/) print "NOFACT", c ": " k > legacy
      row("пустой-блок", c, k, sources[id], lines[id], "В карточке нет фактов; отсутствие поведения в коде не установлено")
      if (sources[id] == "") row("не-проверено", c, k, "", lines[id], "Источник для дочитывания не установлен")
    }
    if (repeats[id] > 1) {
      print "DUP", k > legacy
      row("проверить-форму", c, k, "", lines[id], "Повтор одного ключа; проверить и объединить дубли по источнику")
    }
    # Library overloads retain distinct signatures. Backend calls may be aliases.
    b = callbare(k); other = c SUBSEP b
    if (c == "контракт" && sections[id] !~ /^## Публичный API/ && b != k && other in bodies) {
      print "DUP", b " ~ " k > legacy
      row("проверить-форму", c, k, "", lines[id], "Операция представлена с аргументами и без; проверить идентичность")
    }
    if (c == "контракт" && sections[id] !~ /^## Публичный API/ && k !~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|query|mutation|subscription) / && k !~ /^(rpc )?[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*(\(.*\))?$/)
      row("проверить-форму", c, k, "", lines[id], "У ключа контракта нет типа операции")
  }
  split("контракт сущности задачи топики бизнес экраны роли зависит потребляет", cc, " ")
  for (i = 1; i <= 9; i++) print "CARD", cc[i], cardcount[cc[i]] + 0, withbody[cc[i]] + 0, lawfulcount[cc[i]] + 0 > legacy
  split("REST GraphQL RPC lib неизвестен", pp, " ")
  for (i = 1; i <= 5; i++) print "PROTO", pp[i], protocolcount[pp[i]] + 0 > legacy
  close(legacy)
}
