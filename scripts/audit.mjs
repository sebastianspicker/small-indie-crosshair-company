#!/usr/bin/env node
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { runAudit } from '../lib/audit.js';
const root=new URL('..',import.meta.url);
const presets=JSON.parse(await readFile(new URL('data/presets.json',root)));
const audit=runAudit(presets);
await mkdir(new URL('research/generated/',root),{recursive:true});
await writeFile(new URL('research/generated/audit.json',root),JSON.stringify(audit,null,2)+'\n');
const rows=['player,date,height,size,thickness,gap,length_px,width_px,near_px,far_px',...audit.rows.map(r=>[r.player,r.date,r.height,r.size,r.thickness,r.gap,r.old.length,r.old.width,r.old.near,r.old.far].join(','))];
await writeFile(new URL('research/generated/audit.csv',root),rows.join('\n')+'\n');
console.log(JSON.stringify({cases:audit.cases,counts:audit.counts,scope:audit.scope},null,2));
