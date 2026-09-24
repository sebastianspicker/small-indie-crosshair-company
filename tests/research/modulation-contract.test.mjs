import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  applyDelta, deltaDecision, geometryLoss,
  DELTA_CLIP, STRUCTURE_MISSPECIFIED, WITHIN_CLIP, LOSS_INCREASED,
} from '../../research/lib/modulation-contract.js';
import { structuralForward, DEFAULT_PHI } from '../../lib/solver/structural.js';
import { modulate } from '../../research/lib/modulator.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
const target = structuralForward(stored, 2160, DEFAULT_PHI);

test('a zero delta leaves the exact preimage unchanged and is allowed', () => {
  const result = deltaDecision(stored, { length: 0, thickness: 0, gap: 0 }, 2160, DEFAULT_PHI, target);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, WITHIN_CLIP);
  assert.deepEqual(result.appliedDelta, { length: 0, thickness: 0, gap: 0 });
  assert.deepEqual(result.native, stored);
  assert.notEqual(result.native, stored, 'the returned native must be a copy');
});

test('an out-of-clip delta is rejected as structure-misspecified, not clamped', () => {
  const input = { ...stored };
  const result = deltaDecision(input, { length: DELTA_CLIP + 1, thickness: 0, gap: 0 }, 2160, DEFAULT_PHI, target);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, STRUCTURE_MISSPECIFIED);
  assert.equal(result.appliedDelta, null);
  assert.equal(result.native.length, 9, 'no smaller delta may be applied instead');
  assert.deepEqual(input, stored, 'the caller tuple must not be mutated');
});

test('an in-clip delta that increases geometry loss is rejected', () => {
  const result = deltaDecision(stored, { length: 1, thickness: 0, gap: 0 }, 2160, DEFAULT_PHI, target);
  const after = structuralForward({ ...stored, length: 10 }, 2160, DEFAULT_PHI);
  assert.ok(geometryLoss(after, target) > geometryLoss(target, target), 'the chosen delta must actually increase loss');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, LOSS_INCREASED);
  assert.equal(result.appliedDelta, null);
  assert.deepEqual(result.native, stored);
});

test('applyDelta clamps into range and copies without mutating the caller', () => {
  const input = { length: 255, thickness: 31, gap: 128, authoredHeight: 1080 };
  const result = applyDelta(input, { length: 5, thickness: 5, gap: 5 });
  assert.deepEqual(result.native, { length: 255, thickness: 31, gap: 128, authoredHeight: 1080 });
  assert.equal(result.clippedToRange, true);
  assert.deepEqual(input, { length: 255, thickness: 31, gap: 128, authoredHeight: 1080 });
  assert.throws(() => applyDelta(input, { length: 1.5, thickness: 0, gap: 0 }), TypeError);
  assert.throws(() => deltaDecision(input, { length: 0, thickness: 0, gap: 0.5 }, 2160, DEFAULT_PHI, target), TypeError);
});

test('the shipped modulate() stays a zero delta and does not call the contract', () => {
  const input = { length: 4, thickness: 0, gap: 0, authoredHeight: 1080 };
  const result = modulate(input);
  assert.deepEqual(result.delta, { length: 0, thickness: 0, gap: 0 });
  assert.equal(result.applied, false);
  assert.deepEqual(input, { length: 4, thickness: 0, gap: 0, authoredHeight: 1080 });
});

test('the feature contract keeps weights null and lists only allowed features', () => {
  const features = JSON.parse(readFileSync(join(root, 'tests/fixtures/modulator-features.json'), 'utf8'));
  assert.equal(features.schema, 'sicc-modulator-features-v1');
  assert.equal(features.weights, null);
  assert.equal(features.trainedOnSolverLabels, false);
  assert.equal(features.speedGate, 'closed-no-native-pairs');
  for (const forbidden of ['native-cvar-label', 'hash-of-native-cvar-label', 'rendered-pixels-of-the-answer'])
    assert.ok(features.forbidden.includes(forbidden));
  assert.equal(features.allowedFeatures.length, 9);
});

// Research-unreachability from app/lib (this file's own boundary scan lived here) is now the
// structural guarantee in tests/tooling/boundaries.test.mjs, not a regex scan duplicated per test file.
