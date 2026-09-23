#!/usr/bin/env node
import { readdir,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
let count=0;
async function walk(path){for(const e of await readdir(path,{withFileTypes:true})){const f=join(path,e.name);if(e.isDirectory())await walk(f);else if(/\.m?js$/.test(e.name)){
  const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);
  const text=await readFile(f,'utf8');if(f.includes('/app/')&&/(?:\.innerHTML\s*=|\beval\s*\(|new Function\s*\()/m.test(text))throw new Error('Unsafe dynamic execution/rendering in '+f);count++;
}}}
for(const path of ['app','lib','scripts','tests'])await walk(resolve(root,path));
console.log(`Syntax checked ${count} JavaScript modules. App contains no eval/new Function/innerHTML assignment.`);
