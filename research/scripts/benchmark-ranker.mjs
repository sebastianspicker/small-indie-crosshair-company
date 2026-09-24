#!/usr/bin/env node
/**
 * Honest benchmark for the learned shortlist + exact verification ranker.
 *
 * Scope and honesty:
 * - The learned emulator only proposes candidates; `selectVerified` then scores those
 *   candidates with the SAME declared decision loss the solver minimizes. Fidelity is
 *   therefore bounded by shortlist coverage, and speed is the cost of K exact scores.
 * - Labels and losses come from the declared solver, never from CS2. No native capture
 *   pairs exist in this repository. This makes NO accuracy claim about the renderer.
 * - Deterministic sampling (fixed seeds, sorted keys). Timing is local `performance.now()`
 *   and is a hardware/load-dependent diagnostic, not a deterministic CI figure.
 *
 * Writes research/generated/ranker-benchmark.json and prints the same object.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { infer } from '../../lib/solver/inference.js';
import { parseEmulator, predictEmulator } from '../../research/lib/emulator.js';
import { visualContext } from '../../lib/solver/visual.js';
import { forward, MODELS } from '../../lib/solver/renderer.js';
import { normalizeDecision, weightedCvar } from '../../lib/solver/selection.js';
import { signature, groupedCorpus } from '../../lib/solver/corpus.js';
import { hash, mean, quantile } from '../../lib/solver/statistics.js';
import { learnedShortlist, selectVerified, coverageAtK, compareToSolver, RANKER_SCOPE } from '../../research/lib/ranker.js';
import { trainFragility, fragilityScore, analyticSensitivity, SENSITIVITY_SCOPE } from '../../research/lib/sensitivity.js';

const startedAt = performance.now();
const SCHEMA = 'sicc-ranker-benchmark-v1';
const SNAPSHOT = '2026-09-23';
const SEED = 23092030;
const TEST_CAP = 240;
const TRAIN_CAP = 700;
const TIMING_REPEATS = 3;
const K_GRID = [8, 16, 32, 64];
const PRIMARY_K = 32;
const FRAGILITY_CONFIG = { rounds: 40, learningRate: 0.2, maxDepth: 1, seed: SEED + 1 };

const HEIGHTS = [720, 768, 960, 1080, 1440, 2160];
const PAIRS = [
  ...HEIGHTS.map(height => [height, height]),
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

const artifact = parseEmulator(await readFile(new URL('../../research/generated/quant-emulator.json', import.meta.url), 'utf8'));
const records = JSON.parse(await readFile(new URL('../../data/corpus.json', import.meta.url), 'utf8'));

// Deterministic settings pool: real corpus settings plus a synthetic grid (train-script style).
const pool = [];
const seen = new Set();
for (const record of records) if (record.style === 4 && !record.weapon_gap) {
  const key = signature(record);
  if (!seen.has(key)) { seen.add(key); pool.push(settingsOf(record.size, record.thickness, record.gap, record)); }
}
for (const group of groupedCorpus(records)) if (group.representative.style === 4 && !group.representative.weapon_gap && !seen.has(group.signature)) {
  seen.add(group.signature);
  pool.push(settingsOf(group.representative.size, group.representative.thickness, group.representative.gap, group.representative));
}
SIZES.forEach((size, si) => THICKNESSES.forEach((thickness, ti) => GAPS.forEach((gap, gi) => {
  const flags = FLAG_VARIANTS[(si * 7 + ti * 5 + gi * 3) % FLAG_VARIANTS.length];
  pool.push(settingsOf(size, thickness, gap, flags));
})));

const sampleFor = settings => {
  const sig = signature(settings);
  const pair = PAIRS[hash(sig) % PAIRS.length];
  const goal = GOALS[hash(`${sig}|goal`) % GOALS.length];
  return { settings, options: { oldHeight: pair[0], currentHeight: pair[1], authoredHeight: pair[1], goal } };
};
const isTest = settings => hash(signature(settings)) % 5 === 0;
const ordered = [...pool].sort((a, b) => (signature(a) < signature(b) ? -1 : signature(a) > signature(b) ? 1 : 0));
const testSettings = ordered.filter(isTest).slice(0, TEST_CAP);
const trainSettings = ordered.filter(settings => !isTest(settings)).slice(0, TRAIN_CAP);

const pick = native => ({ length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight });
const keepZero = sample => sample.settings.thickness === 0;

function buildSamples(settingsList) {
  const samples = [];
  let excluded = 0;
  for (const settings of settingsList) {
    const sample = sampleFor(settings);
    try {
      const result = infer({ settings: sample.settings, options: sample.options, records: [] });
      samples.push({ ...sample, native: pick(result.chosen.native), result });
    } catch { excluded++; }
  }
  return { samples, excluded };
}

/** Exact declared objective, mirroring selection.evaluate / certify.objective. */
function makeEvaluate(sample, decision = 'expected') {
  const { rule, alpha } = normalizeDecision(decision);
  const state = sample.result.posterior;
  const height = sample.result.options.currentHeight;
  const visual = visualContext(sample.result.target, sample.result.settings);
  const evaluate = native => {
    const scores = MODELS.map(model => visual.score(forward(native, height, model)));
    let expectedLoss = 0, worstCaseLoss = -Infinity;
    const pairs = [];
    for (let i = 0; i < scores.length; i++) {
      const loss = scores[i].loss, weight = state.weights[i];
      expectedLoss += loss * weight;
      if (loss > worstCaseLoss) worstCaseLoss = loss;
      pairs.push([loss, weight]);
    }
    return { native, expectedLoss, worstCaseLoss, cvarLoss: weightedCvar(pairs, alpha), rule };
  };
  return evaluate;
}

const testBuilt = buildSamples(testSettings);
const trainBuilt = buildSamples(trainSettings);
const testSamples = testBuilt.samples;
const trainSamples = trainBuilt.samples;

for (const sample of testSamples) sample.evaluate = makeEvaluate(sample);

// --- shortlist coverage -----------------------------------------------------
const coverage = {};
for (const K of K_GRID) coverage[K] = coverageAtK(artifact, testSamples, K, { preserveZero: keepZero });

// --- verified-vs-solver -----------------------------------------------------
const solverComparison = {};
for (const K of [PRIMARY_K, 64]) {
  solverComparison[K] = compareToSolver(artifact, testSamples, {
    K, preserveZero: keepZero, decision: 'expected',
    evaluateFactory: sample => sample.evaluate,
  });
}

// --- timing (same inputs, local process) ------------------------------------
for (const sample of testSamples.slice(0, 8)) {
  const evaluate = sample.evaluate;
  learnedShortlist(artifact, sample, { K: PRIMARY_K });
  selectVerified(artifact, sample, evaluate, { K: PRIMARY_K });
  infer({ settings: sample.settings, options: sample.options, records: [] });
}
const shortlistUs = [], verifiedUs = [], exactMs = [];
for (const sample of testSamples) {
  const startedShortlist = performance.now();
  for (let n = 0; n < TIMING_REPEATS; n++) learnedShortlist(artifact, sample, { K: PRIMARY_K, preserveZero: keepZero(sample) });
  shortlistUs.push((performance.now() - startedShortlist) / TIMING_REPEATS * 1000);

  const startedVerified = performance.now();
  for (let n = 0; n < TIMING_REPEATS; n++) selectVerified(artifact, sample, sample.evaluate, { K: PRIMARY_K, preserveZero: keepZero(sample) });
  verifiedUs.push((performance.now() - startedVerified) / TIMING_REPEATS * 1000);

  const startedExact = performance.now();
  infer({ settings: sample.settings, options: sample.options, records: [] });
  exactMs.push(performance.now() - startedExact);
}
const timing = {
  samples: testSamples.length,
  repeatsPerSample: TIMING_REPEATS,
  learnedShortlistUs: { p50: quantile(shortlistUs, 0.5), p95: quantile(shortlistUs, 0.95) },
  verifiedShortlistUs: { p50: quantile(verifiedUs, 0.5), p95: quantile(verifiedUs, 0.95) },
  exactInferMs: { p50: quantile(exactMs, 0.5), p95: quantile(exactMs, 0.95) },
};
timing.verifiedSpeedRatioP50 = timing.exactInferMs.p50 * 1000 / timing.verifiedShortlistUs.p50;

// --- learned fragility layer ------------------------------------------------
const fragilityTrain = trainSamples.map(sample => ({
  settings: sample.settings, options: sample.options, native: sample.native,
  emulator: predictEmulator(artifact, sample).native,
}));
const fragilityTest = testSamples.map(sample => ({
  settings: sample.settings, options: sample.options, native: sample.native,
  emulator: predictEmulator(artifact, sample).native,
}));
const tupleMatch = sample => sample.native.length === sample.emulator.length
  && sample.native.thickness === sample.emulator.thickness && sample.native.gap === sample.emulator.gap;
const trainPositive = fragilityTrain.filter(sample => !tupleMatch(sample)).length / (fragilityTrain.length || 1);
const testPositive = fragilityTest.filter(sample => !tupleMatch(sample)).length / (fragilityTest.length || 1);
let fragilityLayer;
if (fragilityTrain.length && fragilityTest.length) {
  const model = trainFragility(fragilityTrain, FRAGILITY_CONFIG);
  const scored = fragilityTest.map(sample => ({ actual: tupleMatch(sample) ? 0 : 1, score: fragilityScore(model, sample) }));
  const correct = scored.filter(row => (row.score >= 0.5 ? 1 : 0) === row.actual).length;
  const mismatches = scored.filter(row => row.actual === 1).map(row => row.score);
  const matches = scored.filter(row => row.actual === 0).map(row => row.score);
  fragilityLayer = {
    mode: 'trained', schema: model.schema, kind: model.kind, config: FRAGILITY_CONFIG,
    trainSamples: fragilityTrain.length, testSamples: fragilityTest.length,
    trainMismatchRate: trainPositive, testMismatchRate: testPositive,
    accuracyAt0_5: scored.length ? correct / scored.length : null,
    majorityBaselineAccuracy: Math.max(testPositive, 1 - testPositive),
    meanPredicted: mean(scored.map(row => row.score)),
    meanPredictedWhenMismatch: mean(mismatches), meanPredictedWhenMatch: mean(matches),
    scope: SENSITIVITY_SCOPE,
  };
} else {
  fragilityLayer = { mode: 'analytic-only', reason: 'No train/test samples survived solver validation.', scope: SENSITIVITY_SCOPE };
}

const coverageSummary = Object.fromEntries(K_GRID.map(K => [K, coverage[K].coverage]));

// --- analytic advisory distribution (stands alone, no training) ------------
const analyticLevels = { low: 0, medium: 0, high: 0 };
let nearestSum = 0, nearestMin = Infinity, exactNearest = 0;
for (const sample of testSamples) {
  const advisory = analyticSensitivity({ settings: sample.settings, options: sample.options });
  analyticLevels[advisory.level]++;
  nearestSum += advisory.margins.nearest;
  if (advisory.margins.nearest < nearestMin) nearestMin = advisory.margins.nearest;
  if (advisory.margins.nearest <= 1e-9) exactNearest++;
}
const analyticAdvisory = {
  levels: analyticLevels,
  fractions: Object.fromEntries(Object.entries(analyticLevels).map(([level, n]) => [level, testSamples.length ? n / testSamples.length : null])),
  meanNearestMargin: testSamples.length ? nearestSum / testSamples.length : null,
  minNearestMargin: Number.isFinite(nearestMin) ? nearestMin : null,
  exactNearestBoundarySamples: exactNearest,
  note: 'Analytic layer only. Integer legacy values also sit on trunc/ceil integer boundaries by construction and are reported as a structural reason without raising the level, so this is a conservative-but-discriminating advisory.',
  scope: SENSITIVITY_SCOPE,
};

const primary = solverComparison[PRIMARY_K];
const speedWin = timing.verifiedSpeedRatioP50 > 1.5;
const fidelityHeld = primary.worse === 0;
let verdict;
if (speedWin && fidelityHeld && coverageSummary[PRIMARY_K] >= 0.9)
  verdict = `WIN (conditional): the verified shortlist is ${timing.verifiedSpeedRatioP50.toFixed(1)}x faster at p50 than the declared solver, never worse on the declared loss in this sample, and contains the solver tuple ${(coverageSummary[PRIMARY_K] * 100).toFixed(1)}% of the time at K=${PRIMARY_K}. Still solver fidelity only, NOT native CS2 evidence.`;
else if (!fidelityHeld)
  verdict = `NEGATIVE (fidelity): the verified shortlist lost to the declared solver on ${primary.worse}/${primary.count} samples (max gap ${primary.maxGap}); coverage at K=${PRIMARY_K} is ${(coverageSummary[PRIMARY_K] * 100).toFixed(1)}%. Faster but not interchangeable. The learned fragility layer is weak (holdout accuracy ${fragilityLayer.accuracyAt0_5?.toFixed(3) ?? 'n/a'} vs majority baseline ${fragilityLayer.majorityBaselineAccuracy?.toFixed(3) ?? 'n/a'}); the analytic advisory stands alone. Solver fidelity only; NOT native CS2 evidence.`;
else if (!speedWin)
  verdict = `NEGATIVE (speed): the verified shortlist matched the declared loss but was not faster (p50 ratio ${timing.verifiedSpeedRatioP50.toFixed(2)}x).`;
else
  verdict = `PARTIAL: faster (${timing.verifiedSpeedRatioP50.toFixed(1)}x p50) and never worse on the declared loss, but shortlist coverage at K=${PRIMARY_K} is only ${(coverageSummary[PRIMARY_K] * 100).toFixed(1)}%, so it is not a reliable solver substitute. Solver fidelity only; NOT native CS2 evidence.`;

const report = {
  schema: SCHEMA, snapshot: SNAPSHOT, seed: SEED,
  runtime: process.version, platform: process.platform, cpu: cpus()[0]?.model,
  modelKind: { artifact: artifact.model, maxDepth: artifact.maxDepth, rounds: artifact.rounds, learningRate: artifact.learningRate },
  artifactFingerprint: artifact.fingerprint,
  counts: { settingsPool: pool.length, testSettings: testSettings.length, trainSettings: trainSettings.length,
    testSamples: testSamples.length, trainSamples: trainSamples.length,
    excludedTest: testBuilt.excluded, excludedTrain: trainBuilt.excluded },
  coverage,
  coverageSummary,
  verifiedVsSolver: solverComparison,
  timing,
  analyticAdvisory,
  fragility: fragilityLayer,
  scope: RANKER_SCOPE,
  honesty: {
    labels: 'exact declared solver (infer) output; no native captures exist in this repository',
    nativeEvidence: false,
    rankerGuarantee: 'never worse than the best candidate inside the learned shortlist under the declared loss; not global optimality, not native correctness',
    speedGate: 'unchanged: closed-not-exact-equivalent for replacing the solver, because coverage is not 100%',
  },
  verdict,
  durationMs: performance.now() - startedAt,
};

const output = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(new URL('../../research/generated/ranker-benchmark.json', import.meta.url), output);
console.log(JSON.stringify(report, null, 2));
