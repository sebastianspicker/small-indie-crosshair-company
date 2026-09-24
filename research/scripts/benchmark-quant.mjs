#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { infer } from '../../lib/solver/inference.js';
import { quantile, mean } from '../../lib/solver/statistics.js';
const records = JSON.parse(await readFile(new URL('../../data/corpus.json', import.meta.url), 'utf8')), eligible = records.filter(s => s.style === 4 && !s.weapon_gap), durations = [], rasters = [];
for (let i = 0; i < 5; i++)
    infer({ settings: eligible[i], records });
for (let i = 0; i < 40; i++) {
    const started = performance.now(), r = infer({ settings: eligible[i % eligible.length], options: { oldHeight: [768, 960, 1080, 1440][i % 4] }, records });
    durations.push(performance.now() - started);
    rasters.push(r.search.uniqueRasterEvaluations);
}
const report = { schema: 'sicc-local-benchmark-v1', runtime: process.version, platform: process.platform, cpu: cpus()[0]?.model, caseCount: 40, warmups: 5, measurementsMs: durations, p50Ms: quantile(durations, .5), p95Ms: quantile(durations, .95), meanMs: mean(durations), meanUniqueRasters: mean(rasters), scope: 'Single local Node process, inference core only. NOT browser response latency, game FPS or universal performance. Native evidence empty.' };
if (process.argv.includes('--save'))
    await writeFile(new URL('../../research/generated/performance-local.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
