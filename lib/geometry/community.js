/** Source-labelled static reconstruction. See docs/research/converter-audit-2026-09-28.md.
 * Equations independently implemented from public observations; no native capture claim.
 */
import { legacyGeometry } from './legacy.js';
import { validateNative } from '../settings/native.js';
import { height as validHeight } from '../settings/validation.js';
import { COMMUNITY_CONVENTION } from './raster.js';

export const COMMUNITY_MODEL = Object.freeze({
  id: 'community-static-2026-09', scale: 'authored', rounding: 'nearest', gap: 'center',
  name: 'Community static reconstruction', build: '2000918', version: 'community-static-v1',
});

/** Ties to even, including negative half-integers. Math.round uses a different tie rule. */
export function roundEven(value) {
  const lower = Math.floor(value), fraction = value - lower;
  return fraction < .5 || (fraction === .5 && lower % 2 === 0) ? lower : lower + 1;
}

export function communityLegacy(settings, height) {
  const base = legacyGeometry(settings, height); // validates inputs; retains signed f32 gap arithmetic
  const scaled = value => Math.fround(base.scale * Math.fround(value));
  const length = roundEven(scaled(settings.size)), width = Math.max(1, roundEven(scaled(settings.thickness)));
  const near = Math.floor(width / 2) + base.gapOffset;
  return { ...base, model: 'legacy-community-f32-even-v1', length, width,
    near, far: near + 1, interval: length > 0 ? 2 * near + 1 : null };
}

/** Public community renderer: positive values survive downscaling; literal zero stays zero. */
export function communityDimension(value, ratio) {
  return value === 0 ? 0 : Math.max(1, Math.round(value * ratio));
}

export function communityForward(native, height) {
  validateNative(native); validHeight(height);
  const scale = height / native.authoredHeight;
  const length = communityDimension(native.length, scale), width = communityDimension(native.thickness, scale);
  const near = communityDimension(native.gap, scale), far = near - width % 2;
  return { length, width, near, far, interval: length > 0 ? near + far : null, scale,
    model: COMMUNITY_MODEL.id, minimumBranch: native.thickness === 0, rasterConvention: COMMUNITY_CONVENTION };
}
