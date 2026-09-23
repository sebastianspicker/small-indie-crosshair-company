#!/usr/bin/env node
import { cp, rm, mkdir, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isSiteFile } from './site-files.mjs';
await import('./notebook.mjs');
const root=fileURLToPath(new URL('..',import.meta.url)),dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist);
for(const path of ['index.html','app','lib','data','public','docs','research','licenses','README.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md','CONTRIBUTING.md','AGENTS.md','SECURITY.md'])
  await cp(join(root,path),join(dist,path),{recursive:true,filter:s=>isSiteFile(root,s)});
await writeFile(join(dist,'.nojekyll'),'');
const entries=[];
async function walk(path){for(const f of (await readdir(path)).sort()){const full=join(path,f),s=await stat(full);if(s.isDirectory())await walk(full);else entries.push({path:full.slice(dist.length+1),bytes:s.size,sha256:createHash('sha256').update(await readFile(full)).digest('hex')});}}
await walk(dist);await writeFile(join(dist,'build-manifest.json'),JSON.stringify({version:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,researchSnapshot:'2026-09-23',files:entries},null,2)+'\n');
console.log(`Built ${entries.length} static files (${entries.reduce((n,f)=>n+f.bytes,0)} bytes) into dist/. No network or package installation required.`);
