#!/usr/bin/env node
/**
 * Trains the dependency-free learned emulators and writes research/generated/quant-emulator.json.
 *
 * Honesty contract:
 * - Labels come from the declared automatic solver (`infer`), not from CS2. The
 *   main emulator therefore distills the solver. Its metrics are solver fidelity.
 * - No native capture pairs exist in this project, so no native accuracy is
 *   reported and no speed-up is claimed until it is measured (speedGate).
 * - Fully deterministic: fixed seeds, no clock or Math.random in the artifact.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { infer } from '../../lib/solver/inference.js';
import { groupedCorpus, signature } from '../../lib/solver/corpus.js';
import { rng, hash } from '../../lib/solver/statistics.js';
import { forward, getModel, MODELS } from '../../lib/solver/renderer.js';
import {
  EMULATOR_SCHEMA, EMULATOR_VERSION, EMULATOR_FEATURE_NAMES,
  trainEmulator, evaluateEmulator, emulatorFingerprint,
  trainForwardEmulator, evaluateForwardEmulator,
} from '../../research/lib/emulator.js';

const startedAt = performance.now();
const SNAPSHOT = '2026-09-23';
const SEED = 23092026;
const LEARNING_RATE = 0.2;
const SAMPLE_BUDGET = 5000;
const BOUNDS = { length: [0, 255], thickness: [0, 31], gap: [0, 128] };
const NOTES = 'Declared-math additions (7 residue, boundary-distance and legacy-parity features appended to the 19 declared features) were neutral-to-slightly-negative at matched capacity in a held-out ablation; the held-out exact-tuple gain comes from the depth-3 boosted-tree capacity block. Capacity was selected on a group-disjoint validation fold carved from training samples; the held-out test split was not used for selection. Solver fidelity only; NOT native CS2 renderer accuracy.';

// Pre-declared capacity grid for the inverse emulator. Selection uses a group-disjoint
// validation fold carved from the TRAINING samples only; the held-out test split is
// never consulted here, so the committed test metrics stay an honest held-out estimate.
const CONFIGS = [
  { maxDepth: 1, rounds: 60, learningRate: 0.2 },
  { maxDepth: 2, rounds: 60, learningRate: 0.2 },
  { maxDepth: 2, rounds: 120, learningRate: 0.2 },
  { maxDepth: 3, rounds: 60, learningRate: 0.2 },
  { maxDepth: 3, rounds: 120, learningRate: 0.2 },
];

const HEIGHTS = [720, 768, 960, 1080, 1440, 2160];
const PAIRS = [
  ...HEIGHTS.map(h => [h, h]),
  [1080, 1440], [1080, 2160], [1440, 1080], [960, 1440], [720, 1080], [2160, 1080],
];
const GOALS = ['pixels', 'screen'];
const SIZES = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8];
const THICKNESSES = [0, 0.5, 1, 1.5, 2, 3, 4];
const GAPS = [-4, -3, -2, -1, 0, 1, 2, 4, 8];
const FLAG_VARIANTS = [
  { dot: false, t_style: false }, { dot: true, t_style: false },
  { dot: false, t_style: true }, { dot: true, t_style: true },
];

const COLOR = { alpha_enabled: false, alpha: 200, color: 1, rgb: [0, 255, 0], outline: false, recoil: false, weapon_gap: false, style: 4 };
const settingsOf = (size, thickness, gap, flags = {}) => ({ ...COLOR, size, thickness, gap, dot: Boolean(flags.dot), t_style: Boolean(flags.t_style) });
const optionsOf = ([oldHeight, currentHeight], goal) => ({ oldHeight, currentHeight, authoredHeight: currentHeight, goal });
const sampleOf = (settings, pair, goal) => ({ settings, options: optionsOf(pair, goal) });

/** Deterministic selection: sort by key, then Fisher-Yates with the seeded rng. */
function subsample(samples, limit, seed) {
  if (limit >= samples.length) return samples;
  const keyed = samples.map(sample => ({ sample, key: `${signature(sample.settings)}|${sample.options.oldHeight}->${sample.options.currentHeight}|${sample.options.goal}` }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const random = rng(seed);
  for (let i = keyed.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [keyed[i], keyed[j]] = [keyed[j], keyed[i]]; }
  return keyed.slice(0, limit).map(entry => entry.sample);
}

const records = JSON.parse(await readFile(new URL('../../data/corpus.json', import.meta.url), 'utf8'));
const corpusSettings = new Map();
for (const record of records) if (record.style === 4 && !record.weapon_gap) corpusSettings.set(signature(record), record);
for (const group of groupedCorpus(records))
  if (group.representative.style === 4 && !group.representative.weapon_gap) corpusSettings.set(group.signature, group.representative);

const corpusSamples = [];
for (const record of corpusSettings.values())
  for (const pair of PAIRS) for (const goal of GOALS)
    corpusSamples.push(sampleOf(settingsOf(record.size, record.thickness, record.gap, record), pair, goal));

const syntheticSamples = [];
SIZES.forEach((size, si) => THICKNESSES.forEach((thickness, ti) => GAPS.forEach((gap, gi) => {
  const flags = FLAG_VARIANTS[(si * 7 + ti * 5 + gi * 3) % FLAG_VARIANTS.length];
  const settings = settingsOf(size, thickness, gap, flags);
  for (const pair of PAIRS) for (const goal of GOALS) syntheticSamples.push(sampleOf(settings, pair, goal));
})));

const budgetForSynthetic = Math.max(0, SAMPLE_BUDGET - corpusSamples.length);
const grid = [...corpusSamples, ...subsample(syntheticSamples, budgetForSynthetic, SEED + 1)];

const samples = [];
let excluded = 0;
for (const candidate of grid) {
  try {
    const native = infer({ settings: candidate.settings, options: candidate.options, records: [] }).chosen.native;
    samples.push({ settings: candidate.settings, options: candidate.options,
      native: { length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight } });
  } catch { excluded++; }
}

const isTest = sample => hash(signature(sample.settings)) % 5 === 0;
const trainSamples = samples.filter(sample => !isTest(sample));
const testSamples = samples.filter(isTest);

// Validation fold for capacity selection, group-disjoint from settings and taken only
// from the training side. `% 5 === 0` remains the untouched held-out test rule.
const isValidation = sample => hash(signature(sample.settings)) % 5 === 1;
const selectSamples = trainSamples.filter(sample => !isValidation(sample));
const validationSamples = trainSamples.filter(isValidation);
const combinedMae = evaluated => (evaluated.lengthMae + evaluated.thicknessMae + evaluated.gapMae) / 3;
let chosen = null;
const trials = [];
for (const config of CONFIGS) {
  const candidate = trainEmulator(selectSamples, { ...config, seed: SEED });
  const validation = evaluateEmulator(candidate, validationSamples);
  trials.push({ ...config, exactTupleRate: validation.exactTupleRate, combinedMae: combinedMae(validation) });
  const tie = chosen && validation.exactTupleRate === chosen.validation.exactTupleRate;
  const better = !chosen
    || validation.exactTupleRate > chosen.validation.exactTupleRate
    || (tie && combinedMae(validation) < combinedMae(chosen.validation))
    || (tie && combinedMae(validation) === combinedMae(chosen.validation) && config.rounds < chosen.config.rounds);
  if (better) chosen = { config, validation };
}

const artifact = trainEmulator(trainSamples, { ...chosen.config, seed: SEED });
const metrics = { ...evaluateEmulator(artifact, testSamples), testSamples: testSamples.length };

const FL = [0, 1, 2, 3, 4, 6, 9], FT = [0, 1, 2, 3, 5], FG = [0, 1, 2, 4, 8];
const FA = [720, 1080, 2160], FH = [720, 1080, 1440, 2160];
const forwardSamples = [];
for (const length of FL) for (const thickness of FT) for (const gap of FG) for (const authoredHeight of FA)
  for (const height of FH) for (const model of MODELS) {
    const native = { length, thickness, gap, authoredHeight };
    const m = getModel(model.id);
    forwardSamples.push({ native, height, model: m, geometry: forward(native, height, m) });
  }
const forwardKey = s => `${s.native.length}/${s.native.thickness}/${s.native.gap}@${s.native.authoredHeight}/h${s.height}/${s.model.id}`;
const isForwardEval = s => s.height === 1440 && hash(forwardKey(s)) % 5 === 0;
const forwardTrain = forwardSamples.filter(s => !isForwardEval(s));
const forwardEval = forwardSamples.filter(isForwardEval);
const forwardModel = trainForwardEmulator(forwardTrain, { rounds: 60, learningRate: LEARNING_RATE, maxDepth: 3, seed: SEED + 2 });

const full = {
  schema: EMULATOR_SCHEMA, version: EMULATOR_VERSION, snapshot: SNAPSHOT, seed: SEED,
  featureNames: [...EMULATOR_FEATURE_NAMES], learningRate: artifact.learningRate, rounds: artifact.rounds,
  maxDepth: artifact.maxDepth, model: artifact.model, bounds: BOUNDS, notes: NOTES,
  outputs: artifact.outputs,
  training: { samples: samples.length, settings: new Set(samples.map(s => signature(s.settings))).size,
    trainSamples: trainSamples.length, testSamples: testSamples.length, excluded,
    splitRule: 'hash(signature(settings)) % 5 === 0 -> test' },
  metrics,
  forward: { featureNames: forwardModel.featureNames, outputs: forwardModel.outputs,
    metrics: evaluateForwardEmulator(forwardModel, forwardEval) },
  provenance: {
    labels: 'exact automatic solver output (infer) on a deterministic legacy-settings grid',
    scope: 'Distills the declared solver. Fidelity only; NOT native CS2 renderer accuracy.',
    nativeEvidence: false,
    speedGate: 'closed-not-exact-equivalent',
  },
};
full.fingerprint = emulatorFingerprint(full);

await writeFile(new URL('../../research/generated/quant-emulator.json', import.meta.url), `${JSON.stringify(full, null, 2)}\n`);
console.log(JSON.stringify({
  schema: full.schema, counts: full.training,
  model: { kind: full.model, maxDepth: full.maxDepth, rounds: full.rounds, learningRate: full.learningRate },
  selection: { method: 'group-disjoint validation fold (hash(signature)%5===1) from training samples', chosen: chosen.config, trials },
  metrics: full.metrics,
  forwardMetrics: full.forward.metrics, fingerprint: full.fingerprint,
  durationMs: performance.now() - startedAt,
}, null, 2));
