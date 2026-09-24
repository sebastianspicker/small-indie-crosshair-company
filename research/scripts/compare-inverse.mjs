#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { groupedCorpus } from '../../lib/solver/corpus.js';
import { MODELS, geometryError } from '../../lib/solver/renderer.js';
import { solveInverse } from '../../lib/solver/inverse.js';
if(!process.argv[2])throw new Error('Usage: node research/scripts/compare-inverse.mjs BASELINE_CHECKOUT [--save]');
// The baseline checkout uses the pre-reorganization layout: lib/quant/models.js.
const old=await import(pathToFileURL(resolve(process.argv[2],'lib/quant/models.js')));
const records=JSON.parse(await readFile(new URL('../../data/corpus.json',import.meta.url),'utf8'));
const meta=JSON.parse(await readFile(new URL('../../data/corpus-meta.json',import.meta.url),'utf8'));
const groups=groupedCorpus(records).filter(x=>x.representative.style===4&&!x.representative.weapon_gap);
let better=0,equal=0,worse=0;const examples=[];
for(const group of groups)for(const height of meta.heights)for(const model of MODELS){
 const s=group.representative,a=old.solveInverse(s,{oldHeight:height},old.getModel(model.id)),b=solveInverse(s,{oldHeight:height},model);
 const before=geometryError(a.predicted,a.target),after=geometryError(b.predicted,b.target);
 if(after<before-1e-10){better++;if(examples.length<10)examples.push({signature:group.signature,height,model:model.id,before,after,old:a.native,new:b.native});}
 else if(after>before+1e-10)worse++;else equal++;
}
const result={schema:'sicc-inverse-regression-v1',uniqueGeometryGroups:groups.length,resolutionHeights:meta.heights,models:MODELS.length,
 cases:better+equal+worse,strictlyLowerGeometryLoss:better,equalGeometryLoss:equal,higherGeometryLoss:worse,examples,
 scope:'Source-derived old targets under 27 hypothetical new renderers. Initialization geometry loss only, not native accuracy or final visual loss.'};
if(worse)throw new Error('Joint inverse regressed on the fixed corpus.');
if(process.argv.includes('--save'))await writeFile(new URL('../../research/generated/inverse-comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
