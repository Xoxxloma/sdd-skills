# Candidates for explicit references in a complete card; never an ownership verdict.
# The card format, rather than a programming-language naming convention, defines references.
BEGIN { OFS="\t" }
function trim(s) { sub(/^[ \t]+/,"",s);sub(/[ \t]+$/,"",s);return s }
function name(s) { gsub(/`|\r/,"",s);sub(/ — .*/,"",s);return trim(s) }
function report(c,k,line,description) {
  gsub(/[\t\r\n]/," ",k);gsub(/[\t\r\n]/," ",description)
  print "проверить-форму",c,k,cardfile,cardfile,line,description
}
function remember(kind,value,line,   n,a,i,v,id) {
  n=split(value,a,",")
  for(i=1;i<=n;i++) {
    v=name(a[i]);gsub(/\[\]/,"",v);sub(/\?$/,"",v)
    # Plain names and qualified names are compared exactly. Types with generic syntax,
    # prose and input parameter lists need source review, not guessed suffixes.
    if(v=="" || v~/[ <>;:|()\[\]]/) continue
    id=kind SUBSEP currentClass SUBSEP currentKey SUBSEP v
    if(id in seen) continue
    seen[id]=1;refKind[++nr]=kind;refName[nr]=v;refClass[nr]=currentClass;refKey[nr]=currentKey;refLine[nr]=line
  }
}
{
  sub(/\r$/,"")
  if($0~/^[ \t]*(```|~~~)/) {
    rest=$0;sub(/^[ \t]*/,"",rest);mark=substr(rest,1,1);width=0
    while(substr(rest,width+1,1)==mark) width++
    if(fence=="") {fence=mark;fenceWidth=width}
    else if(mark==fence && width>=fenceWidth && substr(rest,width+1)~/^[ \t]*$/) fence=""
    next
  }
  if(fence) next
  if(/^## /) {
    section=substr($0,4);currentKey="";table=0
    currentClass=section=="Публичный контракт" || section=="Публичный API" ? "контракт" : section=="Бизнес-правила" ? "бизнес" : section=="События" ? "топики" : section=="Экраны" ? "экраны" : section=="Что умеет для пользователя" ? "возможности" : ""
    next
  }
  if(/^### /) {
    currentKey=name(substr($0,5))
    if(section=="Владеет данными") entities[currentKey]=1
    next
  }
  if(/^\|/) {
    if($0~/^\|[ \t:|\-]*$/) {table=1;next}
    if(!table) next
    split($0,cell,"|")
    if(section=="Роли и доступ") {roles[name(cell[2])]=1;next}
    if(currentClass=="возможности" && cell[3]~/`/) {
      currentKey=name(cell[2]);rest=cell[3]
      while(match(rest,/`[^`]+`/)) {
        remember("роль",substr(rest,RSTART+1,RLENGTH-2),FNR)
        rest=substr(rest,RSTART+RLENGTH)
      }
    }
    next
  }
  if(currentKey=="" || currentClass=="") next
  if(/^сущности:/ && index($0,"→")) {
    target=substr($0,index($0,"→")+length("→"));target=trim(target)
    if(target~/^не определено/ || target~/^не сущность, ответ /) next
    if(target~/^не сущность, агрегат по /) sub(/^не сущность, агрегат по /,"",target)
    else if(target~/^не сущность/) next
    sub(/[,;] (без|только) .*/,"",target);sub(/ или (null|не определено).*/,"",target)
    gsub(/ и /,",",target);remember("сущность",target,FNR)
  }
  if($0~/^(- )?(роли|роль):/) {
    target=$0;sub(/^(- )?(роли|роль):[ \t]*/,"",target);remember("роль",target,FNR)
  }
}
END {
  for(i=1;i<=nr;i++) {
    v=refName[i]
    if(refKind[i]=="сущность" && !(v in entities)) report(refClass[i],refKey[i],refLine[i],"Ссылка на сущность «" v "» без одноимённого блока владения; сверить собственную сущность, проекцию или ответ другого сервиса по источнику")
    if(refKind[i]=="роль" && !(v in roles)) report(refClass[i],refKey[i],refLine[i],"Явная ссылка на роль «" v "» без одноимённой строки в «Роли и доступ»; сверить имя и область роли по источнику")
  }
}
