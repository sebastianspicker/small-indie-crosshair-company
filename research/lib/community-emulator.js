/** Research-only distillation of the public community reconstruction. No game observations. */
import { communityLegacy, communityForward } from '../../lib/geometry/community.js';
import { drawingEdges } from '../../lib/geometry/raster.js';
import { scope, naiveAssignment } from '../../lib/solver/renderer.js';
import { solveCommunity } from '../../lib/solver/community.js';
import { rng } from '../../lib/solver/statistics.js';
import { emulatorFeatures, EMULATOR_FEATURE_NAMES, trainBoostedOutputs,
  predictBoostedOutputs } from './emulator.js';

export const SCHEMA = 'sicc-community-emulator-v1';
export const BOUNDS = Object.freeze({ length: [0, 255], thickness: [0, 31], gap: [0, 128] });
export const OUTPUTS = Object.freeze(['length', 'thickness', 'gap']);
export const DATA_SEED = 28092026;
export const FEATURE_NAMES = Object.freeze([...EMULATOR_FEATURE_NAMES,
  'authoredHeight', 'authoredRatio', 'targetLength', 'targetWidth', 'targetRadius',
  'idealLength', 'idealWidth', 'idealRadius', 'lengthResidue', 'widthResidue', 'radiusResidue']);

/** The initial slots are the frozen historical feature map for a fair ablation. */
export function features(sample, variant = 'geometry') {
  const base = emulatorFeatures(sample);
  if (variant === 'raw') return base;
  if (variant !== 'geometry') throw new Error('Unknown community feature variant.');
  const o = scope(sample.options), old = communityLegacy(sample.settings, o.oldHeight);
  const factor = o.goal === 'screen' ? o.currentHeight / o.oldHeight : 1;
  const edges = drawingEdges(old), width = old.width * factor;
  const near = edges.near * factor, far = edges.far * factor;
  // The target radius is source arithmetic only; no inverse search or solver label enters features.
  const radius = (near + far + width % 2) / 2;
  const ratio = o.currentHeight / o.authoredHeight;
  const ideal = [old.length * factor / ratio, width / ratio, radius / ratio];
  return [...base, o.authoredHeight, ratio, old.length * factor, width, radius,
    ...ideal, ...ideal.map(value => value - Math.floor(value))];
}

export function groupKey(sample) {
  const { size, thickness, gap } = sample.settings;
  return `${size}/${thickness}/${gap}`;
}

/** Fixed 3,200-label synthetic design; a setting triple is the independent unit. */
export function makeDataset() {
  const sizes = [0, .5, 1, 1.5, 2, 3, 4, 6, 8];
  const thicknesses = [0, .5, 1, 1.5, 2, 3, 4];
  const gaps = [-4, -3, -2, -1, 0, 1, 2, 4, 8];
  const scopes = [[720, 1080, 1080], [1080, 1080, 720],
    [1080, 1080, 1080], [1080, 1440, 1080]];
  const flags = [[false, false], [true, false], [false, true], [true, true]];
  const base = { alpha_enabled: false, alpha: 200, color: 1, rgb: [0, 255, 0],
    outline: false, recoil: false, weapon_gap: false, style: 4 };
  const keys = sizes.flatMap(size => thicknesses.flatMap(thickness =>
    gaps.map(gap => [size, thickness, gap])));
  const random = rng(DATA_SEED);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const selected = keys.slice(0, 100).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const samples = [];
  for (const [size, thickness, gap] of selected)
    for (const [oldHeight, currentHeight, authoredHeight] of scopes)
      for (const goal of ['pixels', 'screen'])
        for (const [dot, t_style] of flags) {
          const settings = { ...base, size, thickness, gap, dot, t_style };
          const options = { oldHeight, currentHeight, authoredHeight, goal };
          samples.push({ settings, options, native: solveCommunity(settings, options).native });
        }
  return { selected, samples };
}

/** Entire setting triples stay in one partition across heights, goals and flags. */
export function splitGroups(samples, hash) {
  const parts = { train: [], validation: [], test: [] }, groups = { train: new Set(), validation: new Set(), test: new Set() };
  for (const sample of samples) {
    const key = groupKey(sample), bucket = hash(key) % 5;
    const partition = bucket === 0 ? 'test' : bucket === 1 ? 'validation' : 'train';
    parts[partition].push(sample); groups[partition].add(key);
  }
  return { parts, groupCounts: Object.fromEntries(Object.entries(groups).map(([key, set]) => [key, set.size])),
    groups };
}

export function train(samples, variant, config) {
  return { schema: SCHEMA, variant, featureNames: variant === 'raw'
    ? [...EMULATOR_FEATURE_NAMES] : [...FEATURE_NAMES],
    bounds: BOUNDS, ...trainBoostedOutputs(samples.map(sample => ({ ...sample, features: features(sample, variant) })),
      OUTPUTS, config) };
}

export function predict(model, sample) {
  const o = scope(sample.options);
  return { ...predictBoostedOutputs(model, features(sample, model.variant), BOUNDS), authoredHeight: o.authoredHeight };
}

/** Native tuple fidelity and rendered dimensions against the exact deterministic oracle. */
export function evaluate(model, samples) {
  const totals = { exact: 0, nativeMae: [0, 0, 0], dimensionMae: [0, 0, 0, 0] };
  for (const sample of samples) {
    const native = model ? predict(model, sample) : naiveAssignment(sample.settings, scope(sample.options).authoredHeight);
    const expected = sample.native;
    const diffs = OUTPUTS.map(key => Math.abs(native[key] - expected[key]));
    if (diffs.every(value => value === 0)) totals.exact++;
    diffs.forEach((value, i) => { totals.nativeMae[i] += value; });
    const actual = communityForward(native, sample.options.currentHeight);
    const oracle = communityForward(expected, sample.options.currentHeight);
    ['length', 'width', 'near', 'far'].forEach((key, i) => {
      totals.dimensionMae[i] += Math.abs(actual[key] - oracle[key]);
    });
  }
  const n = samples.length;
  return { count: n, exactTupleRate: n ? totals.exact / n : null,
    nativeMae: totals.nativeMae.map(value => n ? value / n : null),
    dimensionMaePx: totals.dimensionMae.map(value => n ? value / n : null) };
}
