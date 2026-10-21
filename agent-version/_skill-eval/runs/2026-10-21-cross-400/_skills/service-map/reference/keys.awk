# keys.awk — ключ по шаблону (card.template.md, «Ключи строк»), один для assemble.sh и check.sh.
# Только функции: скрипт ставит текст файла впереди своей awk-программы.
#
# Ключ блока по классу: «контракт» — метод и путь (одно слово: пометка после пробела в ключ не входит) без
# строки запроса (хвост после «?», в котором нет «/») либо тип операции и имя без аргументов; «топики» — направление и топик: топик — текст в бэктиках,
# без них — единственное слово после направления; общая обвязка брокера — «транспорт» и имя тем же
# правилом; «сущности», «задачи» — имя одним словом. Заголовок,
# который к ключу не сводится, — "" (вызывающий берёт его как есть и называет «ключ не опознан»).

function k_norm(s,   v) {
  gsub(/`/, "", s); gsub(/«|»/, "", s); gsub(/\r/, "", s)
  sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); gsub(/[ \t]+/, " ", s)
  v = s; sub(/ .*/, "", v)
  if (toupper(v) ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) s = toupper(v) substr(s, length(v) + 1)
  return s
}
function k_canon(cls, h,   k, d, rest) {
  k = k_norm(h)
  if (cls == "контракт") {
    if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) {   # путь — одно слово: пометка после пробела не ключ
      d = k; sub(/ .*/, "", d); rest = substr(k, length(d) + 2); sub(/ .*/, "", rest); k = d " " rest
      if (match(k, /\?[^\/]*$/)) k = substr(k, 1, RSTART - 1); return k
    }
    if (k ~ /^(query|mutation|subscription|rpc) /) { sub(/[ ]*\(.*\)$/, "", k); return k }
    if (k ~ /^[A-Za-z_][A-Za-z0-9_.]*[.\/][A-Za-z_][A-Za-z0-9_]*(\(.*\))?$/) return k
    return ""
  }
  if (cls == "топики") {
    d = k; sub(/ .*/, "", d)
    if (d !~ /^(публикует|потребляет|транспорт)$/) return ""
    if (match(h, /`[^`]+`/)) return d " " substr(h, RSTART + 1, RLENGTH - 2)
    rest = substr(k, length(d) + 2)
    return (rest != "" && rest !~ / /) ? d " " rest : ""
  }
  if (cls == "сущности" || cls == "задачи") return (k != "" && k !~ / /) ? k : ""
  return k
}
# Ключ строки описи: класс — по виду строки (у описи секций нет); не сводится — как есть.
function k_opis(h,   k, c) {
  k = k_norm(h)
  if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|query|mutation|subscription|rpc) /) { c = k_canon("контракт", h); return c == "" ? k : c }
  if (k ~ /^(публикует|потребляет|транспорт) /) { c = k_canon("топики", h); return c == "" ? k : c }
  return k
}
# Ключ контракта вызовом («query night(id)», «Dome.Close(Req)») без скобок; у HTTP — как есть.
function k_bare(k) { if (k ~ /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /) return k; if (k ~ /[^ (]\(.*\)$/) sub(/\(.*\)$/, "", k); return k }
