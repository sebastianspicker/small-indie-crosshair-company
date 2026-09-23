#!/usr/bin/env node
/**
 * Local, reproducible speed comparison between the learned emulator and the exact solver.
 *
 * This measures SPEED ONLY. The learned emulator distills the declared automatic solver
 * (see scripts/train-quant-emulator.mjs); it is not native evidence and is not wired into
 * the runtime inference path, because its exact-tuple fidelity is too low to replace
 * `infer` (see data/quant-emulator.json and docs/math/10-learned-emulator.md).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { infer } from '../lib/quant/inference.js';
import { parseEmulator, predictEmulator } from '../lib/quant/emulator.js';
import { quantile, mean } from '../lib/quant/statistics.js';

const records = JSON.parse(await readFile(new URL('../data/corpus.json', import.meta.url), 'utf8'));
const artifact = parseEmulator(await readFile(new URL('../data/quant-emulator.json', import.meta.url), 'utf8'));
const eligible = records.filter(s => s.style === 4 && !s.weapon_gap);
const samples = eligible.slice(0, 40).map((settings, i) => ({ settings,
  options: { oldHeight: [768, 960, 1080, 1440][i % 4], currentHeight: 1080, authoredHeight: 1080, goal: i % 2 ? 'screen' : 'pixels' } }));

for (const sample of samples) { predictEmulator(artifact, sample); infer({ settings: sample.settings, options: sample.options, records: [] }); }

const ITERATIONS = 2000, emulatorUs = [], exactMs = [];
for (const sample of samples) {
  const started = performance.now();
  for (let k = 0; k < ITERATIONS; k++) predictEmulator(artifact, sample);
  emulatorUs.push((performance.now() - started) / ITERATIONS * 1000);
}
for (const sample of samples) {
  const started = performance.now();
  infer({ settings: sample.settings, options: sample.options, records: [] });
  exactMs.push(performance.now() - started);
}

const report = { schema: 'sicc-emulator-benchmark-v1', runtime: process.version, platform: process.platform, cpu: cpus()[0]?.model,
  samples: samples.length, iterationsPerEmulatorSample: ITERATIONS,
  emulator: { meanUs: mean(emulatorUs), p50Us: quantile(emulatorUs, .5) },
  exact: { p50Ms: quantile(exactMs, .5), meanMs: mean(exactMs) },
  speedRatio: quantile(exactMs, .5) * 1000 / mean(emulatorUs),
  scope: 'Single local Node process, speed only. The learned emulator is research-only and is not on the runtime path. No accuracy or native claim; its exact-tuple fidelity is recorded in data/quant-emulator.json.',
  nativeEvidence: false };
if (process.argv.includes('--save'))
  await writeFile(new URL('../research/generated/emulator-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
