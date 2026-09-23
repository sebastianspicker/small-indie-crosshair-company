#!/usr/bin/env node
/** Paired process-level benchmark. Every trial uses the same cases and warmups. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { quantile } from '../lib/quant/statistics.js';
const baseline=process.argv[2];
if(!baseline)throw new Error('Usage: node scripts/benchmark-compare.mjs PATH_TO_V0_2_CHECKOUT [--save]');
const current=resolve(new URL('..',import.meta.url).pathname),roots={baseline:resolve(baseline),current},runs={baseline:[],current:[]};
for(let trial=0;trial<5;trial++)for(const name of (trial%2?['current','baseline']:['baseline','current'])) {
 const result=spawnSync(process.execPath,['scripts/benchmark-quant.mjs'],{cwd:roots[name],encoding:'utf8',timeout:30000});
 if(result.status!==0)throw new Error(result.stderr||'Benchmark process failed.');
 runs[name].push(JSON.parse(result.stdout));
}
const summarize=name=>({trials:5,casesPerTrial:40,warmupsPerTrial:5,
 medianOfRunP50Ms:quantile(runs[name].map(x=>x.p50Ms),.5),medianOfRunP95Ms:quantile(runs[name].map(x=>x.p95Ms),.5),
 runP50Ms:runs[name].map(x=>x.p50Ms),runP95Ms:runs[name].map(x=>x.p95Ms)});
const report={schema:'sicc-paired-core-benchmark-v1',runtime:process.version,cpu:runs.current[0].cpu,
 versions:await Promise.all(Object.values(roots).map(async root=>JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version)),
 baseline:summarize('baseline'),current:summarize('current'),runs,
 scope:'Five alternating-order paired Node process trials, identical 40-case schedule and five warmups. Core inference only, empty native evidence. No claim about browser latency, native accuracy or universal speed.'};
report.ratioOfMedianP50=report.baseline.medianOfRunP50Ms/report.current.medianOfRunP50Ms;
if(process.argv.includes('--save'))await writeFile(resolve(current,'research/generated/performance-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
