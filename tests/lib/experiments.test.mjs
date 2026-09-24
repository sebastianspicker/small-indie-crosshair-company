import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, forward, geometryKey } from '../../lib/solver/renderer.js';
import { posterior } from '../../lib/solver/evidence.js';
import { proposeExperiment, discriminatingSet, candidateDesigns, partitionOf, CANDIDATE_GRID } from '../../lib/solver/experiments.js';

const uniform = () => posterior();
const pairs = MODELS.length * (MODELS.length - 1) / 2;
const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const recompute = (native, currentHeight) => {
  const groups = new Map();
  MODELS.forEach((m, i) => {
    const key = geometryKey(forward(native, currentHeight, m));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  return [...groups.values()];
};

test('proposeExperiment output is unchanged for a uniform prior', () => {
  assert.deepEqual(proposeExperiment(uniform()), { native: { length: 5, thickness: 3, gap: 7, authoredHeight: 960 }, currentHeight: 768, disagreementBits: 4.134336113194452, outcomes: 19 });
});

test('candidate grid is declared and its partitions come from forward on all 27 models', () => {
  const designs = candidateDesigns();
  const expected = CANDIDATE_GRID.length.length * CANDIDATE_GRID.thickness.length * CANDIDATE_GRID.gap.length * CANDIDATE_GRID.authoredHeight.length * CANDIDATE_GRID.currentHeight.length;
  assert.equal(designs.length, expected);
  assert.deepEqual(candidateDesigns(), designs); // deterministic, cached
  for (const design of designs) {
    const flat = design.partition.flat();
    assert.equal(flat.length, MODELS.length);
    assert.deepEqual([...flat].sort((a, b) => a - b), MODELS.map((_, i) => i));
    assert.deepEqual(design.partition, recompute(design.native, design.currentHeight));
  }
});

test('every returned design partition is forward-computed and the set is deterministic', () => {
  const state = uniform();
  const a = discriminatingSet({ state, size: 4 });
  const b = discriminatingSet({ state, size: 4 });
  assert.deepEqual(a, b);
  assert.equal(a.designs.length, a.size);
  for (const design of a.designs) {
    assert.deepEqual(design.partition, recompute(design.native, design.currentHeight));
    assert.deepEqual(design.partition, partitionOf(design.native, design.currentHeight));
    assert.equal(design.outcomes, design.partition.length);
  }
  assert.match(a.scope, /not a measurement|PLAN/);
});

test('uniform weights either separate all 351 pairs or report the honest leftover', () => {
  const result = discriminatingSet({ state: uniform(), size: 8 });
  close(result.weightedTotal, pairs / MODELS.length); // 351 / 27 = 13
  const newlyCovered = result.designs.reduce((n, d) => n + d.coveredPairs, 0);
  if (result.separatesAll) {
    assert.equal(newlyCovered, pairs);
    assert.equal(result.unseparatedPairs.length, 0);
    close(result.weightedCovered, result.weightedTotal);
  } else {
    assert.equal(newlyCovered + result.unseparatedPairs.length, pairs);
    assert.ok(result.unseparatedPairs.length > 0);
    assert.ok(result.unseparatedPairs.every(pair => pair.weight > 1e-12 && pair.models.length === 2));
  }
});

test('size 1 leaves a disclosed remainder while the full grid separates the uniform task', () => {
  const one = discriminatingSet({ state: uniform(), size: 1 });
  assert.equal(one.designs.length, 1);
  assert.equal(one.unseparatedPairs.length, pairs - one.designs[0].coveredPairs);
  if (!one.separatesAll) assert.ok(one.unseparatedPairs.length > 0);
  const enough = discriminatingSet({ state: uniform(), size: MODELS.length });
  assert.equal(enough.separatesAll, true);
  assert.equal(enough.unseparatedPairs.length, 0);
});

test('weights concentrated on three hypotheses shrink the weighted task and still separate it', () => {
  const weights = new Array(MODELS.length).fill(0);
  weights[0] = weights[13] = weights[26] = 1 / 3;
  const result = discriminatingSet({ state: { weights }, size: 2 });
  close(result.weightedTotal, 1); // three ordered pairs, each min(1/3, 1/3)
  assert.equal(result.separatesAll, true);
  assert.ok(result.designs.length <= 2);
  assert.equal(result.unseparatedPairs.length, 0);
});

test('inputs are validated defensively', () => {
  assert.throws(() => discriminatingSet({ state: { weights: [1] } }), /Weights/);
  assert.throws(() => discriminatingSet({ state: uniform(), size: 0 }), /size/i);
  assert.throws(() => discriminatingSet({ state: uniform(), size: 2, candidates: [{ native: { length: -1, thickness: 1, gap: 0, authoredHeight: 720 }, currentHeight: 720 }] }), /length/i);
  assert.throws(() => discriminatingSet({ state: uniform(), size: 2, candidates: [null] }), /candidate/i);
});
