/**
 * Closed residual modulator — research only.
 *
 * It is deliberately NOT imported by `lib/solver/inference.js`, and it must stay that way.
 * A zero delta must not become a second code path that later gets "just a small" non-zero
 * delta and silently moves the shipped default tuple. See
 * docs/engineering/archive/v0.4-conversion-improvement-plan.md §2.7.
 *
 * Under v1 the only legal output is delta (0, 0, 0) with reason `closed-no-native-pairs`.
 * There is no open branch in this module or in its trainer. Ordering is data only, not
 * learned, when the gate is closed.
 *
 * The bounded-delta predicate lives in `research/lib/modulation-contract.js`. It is a separate
 * pure contract, not a second reason to open this gate, and `modulate` does not call it.
 */
import { INVENTORY_BUILD } from '../../lib/settings/cvars.js';

export const MODULATOR_VERSION = 'residual-modulator-v1';
export const CLOSED_GATE = 'closed-no-native-pairs';
export const DELTA_CLIP = 2;
export const MIN_REVIEWED_PAIRS = 40;
export const MIN_SIGNATURES = 24;
export const MIN_CURRENT_HEIGHTS = 3;
/** The plan deliberately defines no reviewed-registry provenance value, so no pair passes. */
export const REVIEWED_REGISTRY_PROVENANCE = null;

/** Copy the tuple; never mutate the caller's object. */
export function modulate(native) {
  return {
    native: { length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight },
    delta: { length: 0, thickness: 0, gap: 0 },
    applied: false,
    reason: CLOSED_GATE,
    version: MODULATOR_VERSION,
  };
}

function summarize(pairs) {
  const items = pairs.filter(pair => pair && typeof pair === 'object');
  const has = predicate => items.some(predicate);
  return {
    pairs: items.length,
    signatures: new Set(items.map(pair => pair.signature).filter(value => typeof value === 'string')).size,
    currentHeights: new Set(items.map(pair => pair.currentHeight).filter(Number.isFinite)).size,
    heightDiffersFromAuthored: has(pair => Number.isFinite(pair.currentHeight) && Number.isFinite(pair.authoredHeight) && pair.currentHeight !== pair.authoredHeight),
    heightEqualsAuthored: has(pair => Number.isFinite(pair.currentHeight) && Number.isFinite(pair.authoredHeight) && pair.currentHeight === pair.authoredHeight),
    oddWidths: has(pair => Number.isInteger(pair.renderedWidth) && Math.abs(pair.renderedWidth % 2) === 1),
    evenWidths: has(pair => Number.isInteger(pair.renderedWidth) && pair.renderedWidth % 2 === 0),
    literalZeroThickness: has(pair => pair.oldThickness === 0),
    positiveThickness: has(pair => Number.isFinite(pair.oldThickness) && pair.oldThickness > 0),
    negativeOldGap: has(pair => Number.isFinite(pair.oldGap) && pair.oldGap < 0),
    nonnegativeOldGap: has(pair => Number.isFinite(pair.oldGap) && pair.oldGap >= 0),
    correctBuild: items.length > 0 && items.every(pair => pair.build === INVENTORY_BUILD),
    reviewedProvenance: items.length > 0 && items.every(pair => pair.provenance === REVIEWED_REGISTRY_PROVENANCE),
  };
}

/**
 * Evidence gate from the plan §2.7. `eligible` reports whether the declared conditions are
 * met. `gate` is ALWAYS `closed-no-native-pairs` in v1: even an eligible registry would not
 * be trained here, because the open branch is intentionally not implemented.
 */
export function gateDecision(pairs = []) {
  const items = Array.isArray(pairs) ? pairs : [];
  const counts = summarize(items);
  const reasons = [];
  if (counts.pairs < MIN_REVIEWED_PAIRS) reasons.push(`fewer than ${MIN_REVIEWED_PAIRS} reviewed native pairs`);
  if (counts.signatures < MIN_SIGNATURES) reasons.push(`fewer than ${MIN_SIGNATURES} distinct old-setting signatures`);
  if (counts.currentHeights < MIN_CURRENT_HEIGHTS) reasons.push(`fewer than ${MIN_CURRENT_HEIGHTS} distinct current heights`);
  if (!counts.heightDiffersFromAuthored) reasons.push('no pair with a current height different from its authored height');
  if (!counts.heightEqualsAuthored) reasons.push('no pair with a current height equal to its authored height');
  if (!counts.oddWidths) reasons.push('no odd rendered width');
  if (!counts.evenWidths) reasons.push('no even rendered width');
  if (!counts.literalZeroThickness) reasons.push('no literal zero thickness');
  if (!counts.positiveThickness) reasons.push('no positive thickness');
  if (!counts.negativeOldGap) reasons.push('no negative old gap');
  if (!counts.nonnegativeOldGap) reasons.push('no nonnegative old gap');
  if (!counts.correctBuild) reasons.push(`build id does not match the declared model build ${INVENTORY_BUILD}`);
  if (!counts.reviewedProvenance) reasons.push('provenance is not a reviewed-registry value (this plan defines none)');
  return { gate: CLOSED_GATE, eligible: reasons.length === 0, reasons, counts };
}
