#!/usr/bin/env node
/** Reproducible, research-only distillation of community-static-v1. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { hash } from '../../lib/solver/statistics.js';
import { DATA_SEED, makeDataset, groupKey, splitGroups, train, evaluate, SCHEMA } from '../lib/community-emulator.js';

const CONFIGS = Object.freeze([
  { rounds: 24, maxDepth: 2, learningRate: 0.2 },
  { rounds: 24, maxDepth: 3, learningRate: 0.2 },
]);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const { selected, samples } = makeDataset();

const { parts, groupCounts, groups } = splitGroups(samples, hash);
if (Object.values(parts).some(rows => !rows.length)) throw new Error('Empty split.');
for (const a of Object.keys(groups)) for (const b of Object.keys(groups))
  if (a !== b && [...groups[a]].some(key => groups[b].has(key))) throw new Error('Group leakage.');

const trials = {}, selectedModels = {};
for (const variant of ['raw', 'geometry']) {
  trials[variant] = [];
  for (const config of CONFIGS) {
    const model = train(parts.train, variant, config);
    const validation = evaluate(model, parts.validation);
    trials[variant].push({ config, validation });
  }
  const ranked = [...trials[variant]].sort((a, b) =>
    b.validation.exactTupleRate - a.validation.exactTupleRate ||
    a.validation.nativeMae.reduce((x, y) => x + y, 0) -
      b.validation.nativeMae.reduce((x, y) => x + y, 0));
  const selectedConfig = ranked[0].config;
  selectedModels[variant] = train([...parts.train, ...parts.validation], variant, selectedConfig);
}

const artifact = {
  schema: SCHEMA, version: 'community-emulator-v1', targetModel: COMMUNITY_MODEL.id,
  targetVersion: COMMUNITY_MODEL.version, targetBuild: COMMUNITY_MODEL.build,
  seed: DATA_SEED, capacityGrid: CONFIGS, trials,
  training: { samples: samples.length, groups: selected.length,
    partitions: Object.fromEntries(Object.entries(parts).map(([key, rows]) =>
      [key, { samples: rows.length, groups: groupCounts[key] }])),
    splitRule: 'hash(size/thickness/gap)%5: 0=test, 1=validation, 2-4=train; all heights/goals/flags stay together',
    sampledGroupsSha256: digest(selected.map(([size, thickness, gap]) => `${size}/${thickness}/${gap}`)),
    labelsSha256: digest(samples.map(sample => [groupKey(sample), sample.options, sample.settings.dot,
      sample.settings.t_style, sample.native])),
  },
  models: selectedModels,
  test: { naive: evaluate(null, parts.test), raw: evaluate(selectedModels.raw, parts.test),
    geometry: evaluate(selectedModels.geometry, parts.test) },
  provenance: {
    labels: 'Exact deterministic solveCommunity(settings, options) output from a fixed synthetic input grid.',
    sourceArithmetic: 'communityLegacy and communityForward from public converter observations; source-labelled reconstruction.',
    historicalArtifact: 'research/generated/quant-emulator.json distills the previous 27-model infer target and is not comparable as a new-default score.',
    nativeEvidence: false, speedGate: 'closed-not-exact-equivalent',
    scope: 'Held-out fidelity to community-static-v1 only; no native CS2 accuracy claim.',
  },
};
artifact.fingerprintSha256 = digest(artifact);
const destination = new URL('../generated/community-emulator.json', import.meta.url);
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== serialized)
    throw new Error('Community emulator drift: regenerate with npm run emulator:community.');
} else await writeFile(destination, serialized);
console.log(JSON.stringify({ training: artifact.training, selected: Object.fromEntries(
  Object.entries(selectedModels).map(([key, model]) => [key, { rounds: model.rounds, maxDepth: model.maxDepth }])),
  test: artifact.test, fingerprintSha256: artifact.fingerprintSha256 }, null, 2));
