import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { infer } from '../lib/quant/inference.js';
import { parseEmulator, predictEmulator, trainEmulator } from '../lib/quant/emulator.js';
import {
  RANKER_SCOPE, DEFAULT_SHORTLIST_K, neighborhood, learnedShortlist, selectVerified, coverageAtK, compareToSolver,
} from '../lib/quant/ranker.js';

const ARTIFACT = parseEmulator(await readFile(new URL('../data/quant-emulator.json', import.meta.url), 'utf8'));
const COLOR = { alpha_enabled: false, alpha: 200, color: 1, rgb: [0, 255, 0], outline: false, recoil: false, weapon_gap: false, style: 4 };
const settingsOf = (size, thickness, gap, dot = false, t_style = false) => ({ ...COLOR, size, thickness, gap, dot, t_style });
const labeled = (size, thickness, gap, dot, t_style, [oldHeight, currentHeight], goal) => {
  const settings = settingsOf(size, thickness, gap, dot, t_style);
  const options = { oldHeight, currentHeight, authoredHeight: currentHeight, goal };
  const native = infer({ settings, options, records: [] }).chosen.native;
  return { settings, options, native: { length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight } };
};

// A tiny deterministic artifact, enough to exercise the ranker without the committed one.
function tinyArtifact() {
  const samples = [];
  for (let i = 0; i < 24; i++) {
    const size = 1 + (i % 4), thickness = [0, 1, 2, 3][Math.floor(i / 4) % 4], gap = [-2, 0, 2, 4][Math.floor(i / 8) % 4];
    const pair = [[1080, 1440], [1080, 1080], [960, 1440], [720, 1080]][i % 4];
    samples.push(labeled(size, thickness, gap, i % 3 === 0, i % 5 === 0, pair, i % 2 ? 'screen' : 'pixels'));
  }
  return trainEmulator(samples, { rounds: 20, learningRate: 0.2, maxDepth: 1, seed: 7 });
}

const SAMPLE = { settings: settingsOf(2, 0.5, -3, true), options: { oldHeight: 1080, currentHeight: 1440, authoredHeight: 1080, goal: 'screen' } };
const native = (length, thickness, gap, authoredHeight = 1080) => ({ length, thickness, gap, authoredHeight });
const key = n => `${n.length}/${n.thickness}/${n.gap}@${n.authoredHeight}`;

test('neighborhood is bounded, origin-free and deterministic', () => {
  const center = native(10, 10, 10);
  const cells = neighborhood(center, 1);
  assert.equal(cells.length, 26);
  assert.ok(!cells.some(cell => key(cell) === key(center)));
  assert.deepEqual(cells, neighborhood(center, 1));
  // Radius grows monotonically in Chebyshev distance; ordering is stable.
  const wide = neighborhood(center, 2);
  assert.ok(wide.length > cells.length);
  assert.deepEqual(wide, neighborhood(center, 2));
});

test('neighborhood clips to the native domain and honors preserveZero', () => {
  const corner = neighborhood(native(0, 0, 0), 1);
  assert.ok(corner.every(cell => cell.length >= 0 && cell.thickness >= 0 && cell.gap >= 0));
  assert.equal(corner.length, 7); // one octant at the origin
  assert.ok(!corner.some(cell => key(cell) === key(native(0, 0, 0))));
  const edge = neighborhood(native(255, 31, 128), 1);
  assert.ok(edge.every(cell => cell.length <= 255 && cell.thickness <= 31 && cell.gap <= 128));

  const zero = neighborhood(native(10, 0, 10), 1, true);
  assert.ok(zero.every(cell => cell.thickness === 0));
  const frozen = neighborhood(native(10, 5, 10), 6, true);
  assert.ok(frozen.length > 0);
  assert.ok(frozen.every(cell => cell.thickness === 0));
  assert.ok(frozen.some(cell => cell.thickness === 0 && cell.length === 10 && cell.gap === 10));
});

test('learnedShortlist is the emulator center plus a deterministic radius-ordered prefix', () => {
  const artifact = tinyArtifact();
  const first = learnedShortlist(artifact, SAMPLE, { K: 8 });
  const second = learnedShortlist(artifact, SAMPLE, { K: 8 });
  assert.deepEqual(first, second);
  assert.equal(first.candidates.length, 8);
  const predicted = predictEmulator(artifact, SAMPLE).native;
  assert.deepEqual(first.center, { length: predicted.length, thickness: predicted.thickness, gap: predicted.gap, authoredHeight: predicted.authoredHeight });
  assert.deepEqual(first.candidates[0], first.center);
  assert.equal(new Set(first.candidates.map(key)).size, first.candidates.length);
  const small = learnedShortlist(artifact, SAMPLE, { K: 4 });
  assert.deepEqual(small.candidates, first.candidates.slice(0, 4));
  assert.match(first.scope, /NOT native CS2 evidence/);
  assert.ok(RANKER_SCOPE.includes('NOT native CS2 evidence'));
  assert.equal(DEFAULT_SHORTLIST_K, 32);
});

test('selectVerified returns the exact argmin over the shortlist', () => {
  const artifact = tinyArtifact();
  const shortlist = learnedShortlist(artifact, SAMPLE, { K: 16 });
  const target = shortlist.candidates[Math.min(5, shortlist.candidates.length - 1)];
  const distance = n => Math.abs(n.length - target.length) + Math.abs(n.thickness - target.thickness) + Math.abs(n.gap - target.gap);
  const evaluate = n => ({ expectedLoss: distance(n), worstCaseLoss: distance(n) + 10, cvarLoss: distance(n) + 5 });
  const result = selectVerified(artifact, SAMPLE, evaluate, { K: 16 });
  assert.equal(result.verified, true);
  assert.equal(result.evaluated, 16);
  assert.equal(result.shortlistSize, 16);
  assert.equal(result.decision, 'expected');
  assert.equal(key(result.native), key(target));
  assert.equal(result.loss, 0);
  // The guarantee: no shortlist candidate has a smaller active loss.
  const active = shortlist.candidates.map(evaluate).map(values => values.expectedLoss);
  assert.equal(result.loss, Math.min(...active));
});

test('selectVerified fails closed on non-finite scores and unknown rules', () => {
  const artifact = tinyArtifact();
  assert.throws(() => selectVerified(artifact, SAMPLE, () => ({ expectedLoss: NaN }), { K: 4 }), /finite expectedLoss/);
  assert.throws(() => selectVerified(artifact, SAMPLE, () => ({}), { K: 4 }), /finite expectedLoss/);
  assert.throws(() => selectVerified(artifact, { ...SAMPLE, decision: 'made-up' }, () => ({ expectedLoss: 0 }), { K: 4 }), /decision/);
});

test('coverageAtK counts exact-tuple containment deterministically', () => {
  const artifact = tinyArtifact();
  const predicted = predictEmulator(artifact, SAMPLE).native;
  const hit = { ...SAMPLE, native: { ...predicted } };
  const far = { ...SAMPLE, native: { length: Math.min(255, predicted.length + 20), thickness: predicted.thickness === 0 ? 1 : 0, gap: Math.min(128, predicted.gap + 20), authoredHeight: predicted.authoredHeight } };
  const single = coverageAtK(artifact, [hit], 1);
  assert.equal(single.count, 1);
  assert.equal(single.covered, 1);
  assert.equal(single.coverage, 1);
  assert.deepEqual(single.perCoordinate, { length: 1, thickness: 1, gap: 1 });
  const miss = coverageAtK(artifact, [far], 1);
  assert.equal(miss.coverage, 0);
  const mixed = coverageAtK(artifact, [hit, far], 1);
  assert.equal(mixed.coverage, 0.5);
  assert.deepEqual(mixed, coverageAtK(artifact, [hit, far], 1));
  assert.match(mixed.scope, /NOT native CS2 evidence/);
});

test('compareToSolver counts matched/worse/better against a supplied solver', () => {
  const artifact = tinyArtifact();
  const shortlist = learnedShortlist(artifact, SAMPLE, { K: 16 });
  const center = shortlist.center;
  const zero = n => ({ expectedLoss: Math.abs(n.length - center.length), worstCaseLoss: Math.abs(n.length - center.length), cvarLoss: 0 });
  const samples = [
    { ...SAMPLE, native: { ...center } },
    { ...SAMPLE, native: { ...center, length: Math.min(255, center.length + 1) } },
  ];
  const report = compareToSolver(artifact, samples, { K: 16, evaluateFactory: () => zero, solverNativeFactory: sample => sample.native });
  assert.equal(report.count, 2);
  assert.equal(report.matched + report.worse + report.better, 2);
  assert.equal(report.tupleMatch, 1);
  // The verified loss is the min over the shortlist, so it can never exceed the center's own loss.
  assert.ok(report.maxGap >= report.minGap);
  assert.ok(Number.isFinite(report.meanGap));
  assert.match(report.scope, /NOT native CS2 evidence/);
  assert.deepEqual(report, compareToSolver(artifact, samples, { K: 16, evaluateFactory: () => zero, solverNativeFactory: sample => sample.native }));
});

test('committed artifact ranker path is deterministic and in-domain', () => {
  const a = learnedShortlist(ARTIFACT, SAMPLE, { K: 32 });
  const b = learnedShortlist(ARTIFACT, SAMPLE, { K: 32 });
  assert.deepEqual(a, b);
  for (const candidate of a.candidates) {
    assert.ok(candidate.length >= 0 && candidate.length <= 255);
    assert.ok(candidate.thickness >= 0 && candidate.thickness <= 31);
    assert.ok(candidate.gap >= 0 && candidate.gap <= 128);
    assert.equal(candidate.authoredHeight, 1080);
  }
});
