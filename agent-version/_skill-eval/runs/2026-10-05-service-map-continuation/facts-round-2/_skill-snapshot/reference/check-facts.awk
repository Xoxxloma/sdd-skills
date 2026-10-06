# Candidate checks for partial loss of explicit HTTP codes from inventory facts.
# Reads the raw card and inventory; never copies facts or claims semantic completeness.
# stdout follows the same seven-column report contract as check-report.awk.
BEGIN { OFS="\t" }
function norm(s,   v) {
  gsub(/`|\r/,"",s);sub(/^[ \t]+/,"",s);sub(/[ \t]+$/,"",s);gsub(/[ \t]+/," ",s)
  v=s;sub(/ .*/,"",v)
  if(toupper(v)~/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/) s=toupper(v) substr(s,length(v)+1)
  if(s~/^(query|mutation|subscription) /) sub(/\(.*\)$/, "",s)
  return s
}
function cls(s) {
  if(s~/^## Публичный контракт/) return "контракт"
  if(s~/^## Владеет данными/) return "сущности"
  if(s~/^## Фоновые задачи/) return "задачи"
  if(s~/^## События/) return "топики"
  return ""
}
function codes(s,   rest,v,before,after,n) {
  n=0;rest=s
  while(match(rest,/[1-5][0-9][0-9]/)) {
    v=substr(rest,RSTART,RLENGTH);before=RSTART==1 ? "" : substr(rest,RSTART-1,1)
    after=substr(rest,RSTART+RLENGTH,1)
    if(before!~/[0-9]/ && after!~/[0-9]/ && !(v in codeSeen)) {codeSeen[v]=1;code[++n]=v}
    rest=substr(rest,RSTART+RLENGTH)
  }
  return n
}
function clean(s) { gsub(/[\t\r\n]/," ",s);return s }
function hascode(s,want,   v,before,after) {
  while(match(s,/[1-5][0-9][0-9]/)) {
    v=substr(s,RSTART,RLENGTH);before=RSTART==1 ? "" : substr(s,RSTART-1,1);after=substr(s,RSTART+RLENGTH,1)
    if(v==want && before!~/[0-9]/ && after!~/[0-9]/) return 1
    s=substr(s,RSTART+RLENGTH)
  }
  return 0
}
FILENAME==ARGV[1] {
  if(/^## /) {c=cls($0);key="";next}
  if(/^### /) {
    key=substr($0,5);sub(/ — .*/,"",key);key=norm(key)
    if(c=="") {key="";next}
    id=c SUBSEP key
    if(!(id in body)) {keyOrder[++nk]=id;body[id]="";cardLine[id]=FNR;cardKey[id]=key;cardClass[id]=c}
    repeats[id]++;next
  }
  if(key!="" && $0!~/^>/) body[id]=body[id] " " $0
  next
}
{
  if($0~/^[ \t]+/) {
    if(opKey=="") next
    t=$0;sub(/^[ \t]+/,"",t)
    if(t!~/^(·|•|-) / || t!~/(HTTP|ответ|код|ошиб|иначе|даёт|дает)/) next
    source="";parts=split(t,p," — ")
    if(parts>1 && p[parts]~/([.][A-Za-z0-9]+|\/)/) {source=p[parts];t=substr(t,1,length(t)-length(source)-length(" — "))}
    if(source=="") next
    # Code presence is only a candidate; numbers alone do not establish their meaning.
    for(v in codeSeen) delete codeSeen[v]
    n=codes(t);if(!n) next
    hit="";hits=0
    for(j=1;j<=nk;j++) {k=keyOrder[j];if(cardKey[k]==opKey && (opClass=="" || cardClass[k]==opClass)) {hits++;hit=k}}
    if(hits!=1 || repeats[hit]>1) next
    for(j=1;j<=n;j++) {
      v=code[j];if(hascode(body[hit],v)) continue
      dedup=hit SUBSEP v;if(dedup in emitted) continue;emitted[dedup]=1
      print "проверить-форму",cardClass[hit],clean(cardKey[hit]),clean(source),clean(cardfile),cardLine[hit],
        "Кандидат потери факта: в описи явно указан HTTP " v ", в блоке его нет; читающий должен сверить условие и ответ по источнику"
    }
    next
  }
  opKey="";opClass=""
  if($0~/^(#|⟹|\(|>|-|```|<!--)/ || $0~/^[ \t]*$/) next
  head=$0;sub(/ — .*/,"",head);head=norm(head)
  if(head~/^(состояние|справочник|сообщение|ограничение|роль|зависит):/) next
  if(head~/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|query|mutation|subscription|rpc) /) opClass="контракт"
  if(head~/^(потребляет|публикует) /) opClass="топики"
  if(head~/^(задача|сущность):/) {opClass=head~/^задача:/ ? "задачи" : "сущности";sub(/^[^:]+:[ ]*/,"",head)}
  opKey=head
}
