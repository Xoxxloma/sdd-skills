import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Lexical strings/comments are never interpreted as declarations.
export function lex(text,source,proto=false) {
 const tokens=[];let i=0,line=1;
 while(i<text.length) {
  const rest=text.slice(i),start=line;let m;
  if((m=rest.match(/^[\s,\uFEFF]+/u)) || (m=rest.match(proto?/^\/\/[^\n]*/:/^#[^\n]*/))) {}
  else if(proto && rest.startsWith('/*')) {const e=rest.indexOf('*/',2);if(e<0)throw Error('Unterminated comment');m=[rest.slice(0,e+2)];}
  else if(!proto && rest.startsWith('"""')) {let e=3;while((e=rest.indexOf('"""',e))>=0 && rest[e-1]==='\\')e+=3;if(e<0)throw Error('Unterminated block string');m=[rest.slice(0,e+3)];tokens.push({value:m[0],string:true,line:start,source});}
  else if(rest[0]==='"' || (proto && rest[0]==="'")) {const q=rest[0];let e=1;for(;e<rest.length;e++){if(rest[e]==='\\'){e++;continue;}if(rest[e]===q)break;}if(e>=rest.length)throw Error('Unterminated string');m=[rest.slice(0,e+1)];tokens.push({value:m[0],string:true,line:start,source});}
  else if((m=rest.match(/^[A-Za-z_][A-Za-z_0-9]*/)) || (m=rest.match(/^-?(?:\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?/))) tokens.push({value:m[0],line:start,source});
  else if((proto?'{}()[]:;=.<>,+-/':'{}()[]:!@=|&$').includes(rest[0])) {m=[rest[0]];tokens.push({value:m[0],line:start,source});}
  else throw Error('Unsupported token at line '+line);
  line+=(m[0].match(/\n/g)||[]).length;i+=m[0].length;
 }
 return tokens;
}
class Cursor {
 constructor(tokens){this.t=tokens;this.i=0;}
 get value(){return this.t[this.i]?.value;}
 take(){if(this.i>=this.t.length)throw Error('Unexpected end');return this.t[this.i++];}
 expect(v){const t=this.take();if(t.value!==v)throw Error('Expected '+v+' at '+t.source+':'+t.line);return t;}
 name(){const t=this.take();if(t.string || !/^[A-Za-z_]\w*$/.test(t.value))throw Error('Expected name');return t;}
 group(open){this.expect(open);const close={'{':'}','(':')','[':']'}[open];while(this.value!==close){if(['{','(','['].includes(this.value))this.group(this.value);else this.take();}this.expect(close);}
 directives(){while(this.value==='@'){this.take();this.name();if(this.value==='(')this.group('(');}}
 type(){if(this.value==='['){this.take();this.type();this.expect(']');}else this.name();if(this.value==='!')this.take();}
}
export function graphql(documents) {
 const c=new Cursor(documents.flatMap(d=>lex(d.text,d.source))),types=new Map(),roots=new Map();let explicit=false;
 while(c.value!==undefined){
  if(c.t[c.i].string){c.take();continue;}
  if(c.value==='extend')c.take();
  const kind=c.name().value;
  if(kind==='schema'){
   explicit=true;c.directives();c.expect('{');
   while(c.value!=='}'){const op=c.name().value;if(!['query','mutation','subscription'].includes(op))throw Error('Unknown root operation');c.expect(':');const root=c.name().value;if(roots.has(op)&&roots.get(op)!==root)throw Error('Conflicting schema roots');roots.set(op,root);}c.take();continue;
  }
  if(['type','interface','input','enum'].includes(kind)){
   const name=c.name().value;
   if(c.value==='implements'){c.take();if(c.value==='&')c.take();c.name();while(c.value==='&'){c.take();c.name();}}
   c.directives();
   if(kind!=='type'){c.group('{');continue;}
   c.expect('{');const fields=types.get(name)||[];
   while(c.value!=='}'){
    if(c.t[c.i]?.string){c.take();continue;}
    const field=c.name();if(c.value==='(')c.group('(');c.expect(':');c.type();c.directives();fields.push(field);
   }
   c.take();types.set(name,fields);continue;
  }
  if(kind==='scalar'){c.name();c.directives();continue;}
  if(kind==='union'){c.name();c.directives();c.expect('=');if(c.value==='|')c.take();c.name();while(c.value==='|'){c.take();c.name();}continue;}
  if(kind==='directive'){c.expect('@');c.name();if(c.value==='(')c.group('(');if(c.value==='repeatable')c.take();c.expect('on');if(c.value==='|')c.take();c.name();while(c.value==='|'){c.take();c.name();}continue;}
  throw Error('Unsupported SDL definition: '+kind);
 }
 if(!explicit)for(const [op,name] of [['query','Query'],['mutation','Mutation'],['subscription','Subscription']])if(types.has(name))roots.set(op,name);
 const declarations=[];
 for(const [op,name] of roots){if(!types.has(name))throw Error('Missing root type '+name);for(const field of types.get(name))declarations.push({protocol:'GraphQL',key:op+' '+field.value,source:field.source,line:field.line,state:'declared'});}
 return declarations;
}
export function protobuf(text,source) {
 const c=new Cursor(lex(text,source,true)),out=[];
 while(c.value!==undefined){
  if(c.value==='service'){
   c.take();const service=c.name().value;c.expect('{');
   while(c.value!=='}'){
    if(c.value==='option'){while(c.value!==';'){if(['{','(','['].includes(c.value))c.group(c.value);else c.take();}c.take();continue;}
    c.expect('rpc');const method=c.name();c.group('(');c.expect('returns');c.group('(');
    if(c.value==='{')c.group('{');else c.expect(';');
    out.push({protocol:'RPC',key:service+'.'+method.value,source,line:method.line,state:'declared'});
   }
   c.take();continue;
  }
  if(c.value==='{')c.group('{');else c.take();
 }
 return out;
}
const methods=new Set(['get','post','put','patch','delete','head','options','trace']);
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
// Deliberately bounded YAML profile: indentation maps/sequences and scalars.
// Unsupported flow containers/aliases are never interpreted as an empty contract.
export function yaml(text) {
 function decomment(s){let q='';for(let i=0;i<s.length;i++){const ch=s[i];if(q){if(q==='"'&&ch==='\\'){i++;continue;}if(ch===q){if(q==="'"&&s[i+1]==="'"){i++;continue;}q='';}}else if(ch==='"'||ch==="'")q=ch;else if(ch==='#'&&(i===0||/\s/.test(s[i-1])))return s.slice(0,i).trimEnd();}return s.trimEnd();}
 function scalar(s){
  if(s[0]==='"'){try{return JSON.parse(s);}catch{throw Error('Unsupported YAML double-quoted scalar');}}
  if(s[0]==="'"){if(!s.endsWith("'"))throw Error('Unterminated YAML scalar');return s.slice(1,-1).replaceAll("''","'");}
  if(/^(null|~)$/i.test(s))return null;if(/^(true|false)$/i.test(s))return /^true$/i.test(s);
  if(/^-?\d+(\.\d+)?$/.test(s))return Number(s);
  if(s.startsWith('{')||s.startsWith('[')){try{return JSON.parse(s);}catch{return s;}}
  if(/(?:^|\s)[*&][A-Za-z_]/.test(s))throw Error('YAML aliases/anchors are unsupported');
  return s;
 }
 function entry(s){let q='';for(let i=0;i<s.length;i++){const ch=s[i];if(q){if(q==='"'&&ch==='\\'){i++;continue;}if(ch===q){if(q==="'"&&s[i+1]==="'"){i++;continue;}q='';}}else if(ch==='"'||ch==="'")q=ch;else if(ch===':'&&(i===s.length-1||/\s/.test(s[i+1]))){const key=scalar(s.slice(0,i).trim());if(typeof key!=='string'&&typeof key!=='number')throw Error('Unsupported YAML key');if(key==='<<')throw Error('YAML merge keys unsupported');return [String(key),s.slice(i+1).trim()];}}throw Error('Unsupported YAML mapping entry');}
 const rows=[];let documentStarted=false;
 text.replaceAll('\r','').split('\n').forEach((line,i)=>{
  if(/^ *\t/.test(line))throw Error('Tabs in YAML indentation');
  const s=decomment(line);if(!s.trim())return;
  if(s.trim()==='---'){if(documentStarted)throw Error('Multiple YAML documents unsupported');return;}
  if(s.trim()==='...')throw Error('YAML document terminator unsupported');
  documentStarted=true;const indent=s.match(/^ */)[0].length;rows.push({indent,text:s.slice(indent),line:i+1});
 });
 let at=0;
 const sequence=row=>/^-(?: |$)/.test(row.text);
 function readValue(s,indent){
  if(/^[|>][+-]?\d?$/.test(s)){const lines=[];while(at<rows.length&&rows[at].indent>indent)lines.push(rows[at++].text);return lines.join('\n');}
  if(s!=='')return scalar(s);
  if(at<rows.length&&(rows[at].indent>indent || (rows[at].indent===indent&&sequence(rows[at]))))return node(rows[at].indent);
  return null;
 }
 function node(indent){
  if(at>=rows.length)return null;
  const seq=sequence(rows[at]),out=seq?[]:Object.create(null);
  while(at<rows.length&&rows[at].indent===indent&&sequence(rows[at])===seq){
   const row=rows[at++];
   if(seq){
    const rest=row.text.slice(1).trim();
    if(rest && !/^[\[{'"]/.test(rest) && /:\s|:$/.test(rest)){
     rows.splice(at,0,{indent:indent+2,text:rest,line:row.line});out.push(node(indent+2));
    }else out.push(readValue(rest,indent));
   }else{
    const [key,value]=entry(row.text);if(Object.hasOwn(out,key))throw Error('Duplicate YAML key '+key);out[key]=readValue(value,indent);
   }
  }
  return out;
 }
 if(!rows.length)throw Error('Empty YAML');const result=node(rows[0].indent);if(at!==rows.length)throw Error('Unsupported YAML indentation at line '+rows[at].line);return result;
}
function inside(root,file){const r=path.relative(root,fs.realpathSync(file));if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Schema outside repository');return fs.realpathSync(file);}
export function openapi(doc,source,load,issues) {
 if(!object(doc)||(!/^3\./.test(doc.openapi||'')&&doc.swagger!=='2.0'))throw Error('Not a supported OpenAPI document');
 if(!object(doc.paths))throw Error('Missing paths mapping');
 function deref(value,file,document,seen=new Set()){
  if(!object(value))throw Error('Path/operation must be an object');
  if(!value.$ref)return {value,file,document};
  const ref=value.$ref;if(typeof ref!=='string')throw Error('Invalid reference');
  const id=file+'#'+ref;if(seen.has(id))throw Error('Reference cycle');seen.add(id);
  const [target,fragment='']=ref.split('#');if(/^[a-z][a-z0-9+.-]*:/i.test(target))throw Error('Remote reference not read');
  if(target){file=path.resolve(path.dirname(file),target);document=load(file);}
  let resolved=document;
  if(fragment){if(!fragment.startsWith('/'))throw Error('Unsupported reference fragment');for(const k of fragment.slice(1).split('/')){const decoded=decodeURIComponent(k).replaceAll('~1','/').replaceAll('~0','~');if(!object(resolved)||!Object.hasOwn(resolved,decoded))throw Error('Reference not found');resolved=resolved[decoded];}}
  return deref(resolved,file,document,seen);
 }
 const out=[];
 function bases(servers){
  if(doc.swagger==='2.0')return [doc.basePath||''];
  if(servers===undefined || (Array.isArray(servers)&&servers.length===0))return [''];
  if(!Array.isArray(servers))throw Error('Invalid servers');
  return [...new Set(servers.map(server=>{
   if(!object(server)||typeof server.url!=='string')throw Error('Invalid server URL');
   let u=server.url.replace(/\{([^}]+)\}/g,(_,k)=>{const v=server.variables?.[k]?.default;if(v===undefined)throw Error('Unresolved server variable');return String(v);});
   if(!u.startsWith('/')&&!/^https?:\/\//.test(u))throw Error('Relative server URL needs deployment context');
   return new URL(u,'http://schema.invalid').pathname.replace(/\/$/,'');
  }))];
 }
 for(const [route,pathItem] of Object.entries(doc.paths)){
  if(route.startsWith('x-'))continue;if(!route.startsWith('/'))throw Error('Invalid path key');
  try{
   const resolved=deref(pathItem,source,doc);
   for(const [verb,operation] of Object.entries(resolved.value)){
    if(!methods.has(verb))continue;
    const op=deref(operation,resolved.file,resolved.document);
    for(const base of bases(op.value.servers??resolved.value.servers??doc.servers))
     out.push({protocol:'REST',key:verb.toUpperCase()+' '+base+route.replace(/\{([^}]+)\}/g,':$1'),source:op.file,line:0,state:'declared',operationId:op.value.operationId||null});
   }
  }catch(e){issues.push({source,key:route,reason:e.message});}
 }
 return out;
}
export function canonical(key){key=key.replaceAll('`','').trim().replace(/\{([^}]+)\}/g,':$1');const gql=key.match(/^(query|mutation|subscription)(?:\s+|\.)(\w+)/i);if(gql)return gql[1].toLowerCase()+' '+gql[2];return key.replace(/^(get|post|put|patch|delete|head|options|trace) /i,v=>v.toUpperCase());}
export function compare(manifest,card,cardfile){
 const keys=new Set();let contract=false;card.replaceAll('\r','').split('\n').forEach(l=>{if(l.startsWith('## '))contract=l==='## Публичный контракт';if(contract&&l.startsWith('### '))keys.add(canonical(l.slice(4).split(' — ')[0]));});
 const clean=s=>String(s??'').replace(/[\t\r\n]/g,' '),rows=[];
 for(const issue of manifest.issues||[])rows.push(['не-проверено','контракт',issue.key||'объявления',issue.source,cardfile,0,'Объявление не проверено: '+issue.reason]);
 const seen=new Set();
 for(const d of manifest.declarations){const key=canonical(d.key);if(seen.has(key))continue;seen.add(key);
  if(d.state==='inactive')rows.push(['не-проверено','контракт',key,d.source,cardfile,0,'Объявлено без реализации; статус должен быть подтверждён читающим']);
  else if(!keys.has(key))rows.push(['добор-ключ','контракт',key,d.source,cardfile,0,'Объявленный ключ отсутствует; проверить действующий обработчик или подключённый механизм, либо явно отметить непроверенное объявление']);
 }
 return 'категория\tкласс\tключ\tисточник\tфайл карточки\tстрока\tописание\n'+rows.map(r=>r.map(clean).join('\t')).join('\n')+(rows.length?'\n':'');
}
function atomic(file,text){if(fs.existsSync(file))throw Error('Output already exists: '+file);const tmp=file+'.tmp-'+process.pid;try{fs.writeFileSync(tmp,text,{flag:'wx'});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{
  const [mode,...args]=process.argv.slice(2);
  if(mode==='collect'){
   const [rootArg,out,...inputs]=args;if(!rootArg||!out||!inputs.length)throw Error('collect <repo> <new-output.json> <schema-files...>');
   const root=fs.realpathSync(rootArg),manifest={version:1,declarations:[],issues:[]},sdl=[];
   const load=file=>{const text=fs.readFileSync(inside(root,file),'utf8');return /\.ya?ml$/i.test(file)?yaml(text):JSON.parse(text);};
   for(const input of inputs){let file;try{
    file=inside(root,path.resolve(root,input));const text=fs.readFileSync(file,'utf8');
    if(/\.(graphql|graphqls|gql)$/i.test(file)){
     if(/^\s*#\s*import\b/m.test(text))manifest.issues.push({source:file,reason:'SDL imports must be supplied explicitly as schema files'});
     sdl.push({text,source:file});
    }else if(/\.proto$/i.test(file))manifest.declarations.push(...protobuf(text,file));
    else if(/\.(json|ya?ml)$/i.test(file))manifest.declarations.push(...openapi(load(file),file,load,manifest.issues));
    else manifest.issues.push({source:file,reason:'Unsupported schema encoding; declarations not measured'});
   }catch(e){manifest.issues.push({source:file||input,reason:e.message});}}
   if(sdl.length)try{manifest.declarations.push(...graphql(sdl));}catch(e){manifest.issues.push({source:sdl.map(d=>d.source).join(', '),reason:e.message});}
   atomic(out,JSON.stringify(manifest,null,2)+'\n');console.log('объявления: '+manifest.declarations.length+'; не проверено: '+manifest.issues.length);if(manifest.issues.length)process.exitCode=3;
  }else if(mode==='compare'){
   const [decl,card,out,...additional]=args;if(!out)throw Error('compare <declarations.json> <card> <new-output.tsv> [additional cards...]');
   const manifest=JSON.parse(fs.readFileSync(decl,'utf8'));if(manifest.version!==1||!Array.isArray(manifest.declarations)||!Array.isArray(manifest.issues))throw Error('Invalid declaration manifest');
   const files=[card,...additional];atomic(out,compare(manifest,files.map(f=>fs.readFileSync(f,'utf8')).join('\n\n'),files.join(', ')));console.log('сверка объявлений: '+out);
  }else throw Error('Expected collect or compare');
 }catch(e){console.error('ОТКАЗ: '+e.message);process.exitCode=2;}
}
