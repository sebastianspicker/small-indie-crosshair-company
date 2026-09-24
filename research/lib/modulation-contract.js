/**
 * Residual modulation contract — a predicate, not a second emulator.
 *
 * A future modulator may add a small integer delta on top of an exact structural preimage.
 * It may not predict the new cvars directly, and it may not train on this repo's own solver
 * labels. There are no weights here and there is no training path. See
 * docs/engineering/archive/v0.4-conversion-improvement-plan.md §2.7 and
 * docs/math/10-learned-emulator.md.
 *
 * This module is deliberately NOT imported by `lib/solver/inference.js` or by `research/lib/modulator.js`.
 * The shipped `modulate()` still returns a zero delta with reason `closed-no-native-pairs`.
 */
import { NATIVE_RANGES } from '../../lib/settings/native.js';
import { structuralForward } from '../../lib/solver/structural.js';

export const MODULATION_CONTRACT_VERSION = 'modulation-contract-v1';
export const DELTA_CLIP = 2;
export const STRUCTURE_MISSPECIFIED = 'closed-structure-misspecified';
export const WITHIN_CLIP = 'within-clip-loss-not-increased';
export const LOSS_INCREASED = 'loss-increased';

const FIELDS = ['length', 'thickness', 'gap'];

const copy = native => ({ length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight });

function assertIntegerComponents(delta) {
  if (!delta || typeof delta !== 'object') throw new TypeError('Delta must be an object.');
  for (const key of FIELDS)
    if (!Number.isInteger(delta[key])) throw new TypeError(`Delta ${key} must be an integer.`);
}

/**
 * Add an integer delta to each component and clamp into the declared new-cvar ranges.
 * Copies the tuple; never mutates the caller. Throws only for a non-integer component:
 * a component outside DELTA_CLIP is a rejection handled by `deltaDecision`, not a clamp.
 */
export function applyDelta(native, delta) {
  assertIntegerComponents(delta);
  const next = {};
  for (const key of FIELDS) {
    const range = NATIVE_RANGES[key];
    next[key] = Math.max(range.min, Math.min(range.max, native[key] + delta[key]));
  }
  next.authoredHeight = native.authoredHeight;
  const clippedToRange = FIELDS.some(key => next[key] !== native[key] + delta[key]);
  return { native: next, clippedToRange };
}

/** Existing geometry-loss idea: squared length and width, plus both edges only when the target has arms. */
export function geometryLoss(predicted, target) {
  let loss = (predicted.length - target.length) ** 2 + (predicted.width - target.width) ** 2;
  if (target.length > 0) loss += (predicted.near - target.near) ** 2 + (predicted.far - target.far) ** 2;
  return loss;
}

/**
 * Decide whether a bounded delta is allowed to move an exact structural preimage.
 * `target` is a rendered geometry `{ length, width, near, far }`, not a cvar tuple.
 * There is no open branch: an out-of-clip delta is rejected as `closed-structure-misspecified`.
 */
export function deltaDecision(native, delta, currentHeight, phi, target) {
  assertIntegerComponents(delta);
  if (FIELDS.some(key => Math.abs(delta[key]) > DELTA_CLIP))
    return { allowed: false, reason: STRUCTURE_MISSPECIFIED, appliedDelta: null, native: copy(native) };
  const vHat = applyDelta(native, delta).native;
  const before = geometryLoss(structuralForward(native, currentHeight, phi), target);
  const after = geometryLoss(structuralForward(vHat, currentHeight, phi), target);
  if (after <= before + 1e-9)
    return { allowed: true, reason: WITHIN_CLIP, appliedDelta: { length: delta.length, thickness: delta.thickness, gap: delta.gap }, native: vHat };
  return { allowed: false, reason: LOSS_INCREASED, appliedDelta: null, native: copy(native) };
}
