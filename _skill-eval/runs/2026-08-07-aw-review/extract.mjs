import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
for (const arm of ['base','fixed']) {
  for (const r of readdirSync(arm).filter(f=>/^run-\d+$/.test(f)).sort()) {
    const p = join(arm,r,'stream.jsonl'); if(!existsSync(p)) continue;
    let txt='', tools=[];
    for (const l of readFileSync(p,'utf8').split('\n')) {
      const s=l.trim(); if(!s.startsWith('{')) continue;
      let e; try{e=JSON.parse(s)}catch{continue}
      if (e.type==='result' && e.result) txt=String(e.result);
      const c=e?.message?.content;
      if (Array.isArray(c)) for(const b of c) if(b?.type==='tool_use')
        tools.push(b.name==='Skill'?`Skill:${b.input?.skill}`:b.name);
    }
    writeFileSync(join(arm,r,'answer.md'), txt, 'utf8');
    writeFileSync(join(arm,r,'_tools.txt'), tools.join(' '), 'utf8');
  }
}
console.log('извлечено');
