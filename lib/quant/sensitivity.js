/**
 * Boundary / fragility advisory for the DECLARED quant solver.
 *
 * Two independent layers, both honest:
 * 1. ANALYTIC (always available, no training): how close the ratio-scaled legacy
 *    values sit to the declared quantiser boundaries. A small margin means a tiny
 *    settings change flips a native integer.
 * 2. LEARNED (advisory, optional): a small logistic boosted-tree model that predicts
 *    whether the learned emulator's tuple disagrees with the exact solver's tuple,
 *    from the same 26 declared emulator features. It is trained here, never mutates
 *    the committed emulator artifact, and is deterministic.
 *
 * Scope: this flags fragility of the DECLARED solver, not native renderer fragility.
 * It is not evidence about Valve's renderer. Dependency-free and browser-import-safe.
 */
import { emulatorFeatures, EMULATOR_FEATURE_NAMES } from './emulator.js';
import { scope as declaredScope } from './renderer.js';
import { finite } from '../validation.js';

export const FRAGILITY_SCHEMA = 'sicc-fragility-v1';
export const FRAGILITY_VERSION = 'fragility-boosted-logistic-v1';
export const FRAGILITY_KINDS = Object.freeze(['boosted-logistic-stumps', 'boosted-logistic-trees']);

export const SENSITIVITY_SCOPE =
  'Advisory only: flags boundary fragility of the DECLARED quant solver and (optionally) learned emulator/solver disagreement. It does NOT measure native renderer fragility or CS2 rendering risk. The analytic layer is a declared-math diagnostic; the learned layer distils the declared solver.';

const BOUNDARY_TIGHT = 0.02;
const BOUNDARY_NEAR = 0.05;
const SCALES = Object.freeze([
  Object.freeze({ name: 'authored', base: null }),
  Object.freeze({ name: 'reference1080', base: 1080 }),
  Object.freeze({ name: 'reference720', base: 720 }),
]);
const ROUNDINGS = Object.freeze(['trunc', 'nearest', 'ceil']);
const COORDINATES = Object.freeze(['size', 'thickness', 'gap']);
const DOMAIN_BOUNDS = Object.freeze({ length: [0, 255], thickness: [0, 31], gap: [0, 128] });

/** Distance from `x` to the nearest boundary where the declared quantiser changes output.
 * `nearest` flips at half-integers; `trunc`/`ceil` flip at integers (see docs/math/10). */
export function boundaryMargin(x, rounding) {
  if (!Number.isFinite(x)) throw new Error('Quantiser input must be finite.');
  if (rounding === 'nearest') return Math.abs(x - (Math.round(x - 0.5) + 0.5));
  if (rounding === 'trunc' || rounding === 'ceil') return Math.abs(x - Math.round(x));
  throw new Error('Unknown rounding rule.');
}

const fmt = value => Number(value.toFixed(6)).toString();

/**
 * Analytic boundary sensitivity. Returns a deterministic level/score, human reasons and
 * the per-coordinate margins to the nearest declared quantiser boundary.
 */
export function analyticSensitivity({ settings, options = {} } = {}) {
  if (!settings || typeof settings !== 'object') throw new Error('analyticSensitivity needs settings.');
  const o = declaredScope(options);
  finite(settings.size, 'Legacy size', 0, 10000);
  finite(settings.thickness, 'Legacy thickness', 0, 10000);
  finite(settings.gap, 'Legacy gap', -10000, 10000);

  const margins = {};
  let nearestOverall = Infinity, integerOverall = Infinity;
  let tightestCoordinate = COORDINATES[0];
  const coordinateTightest = {};
  for (const coordinate of COORDINATES) {
    const raw = settings[coordinate];
    let minimum = Infinity, nearest = Infinity, integer = Infinity, at = null;
    for (const scale of SCALES) {
      const base = scale.base ?? o.authoredHeight;
      const ratio = o.currentHeight / base;
      const scaled = raw * ratio;
      for (const rounding of ROUNDINGS) {
        const margin = boundaryMargin(scaled, rounding);
        if (rounding === 'nearest') nearest = Math.min(nearest, margin);
        else integer = Math.min(integer, margin);
        if (margin < minimum) { minimum = margin; at = { scale: scale.name, rounding, scaled, ratio }; }
      }
    }
    margins[coordinate] = minimum;
    coordinateTightest[coordinate] = at;
    if (minimum < (margins[tightestCoordinate] ?? Infinity)) tightestCoordinate = coordinate;
    nearestOverall = Math.min(nearestOverall, nearest);
    integerOverall = Math.min(integerOverall, integer);
  }
  margins.overall = margins[tightestCoordinate];
  margins.nearest = nearestOverall;
  margins.integer = integerOverall;
  margins.scale = `${coordinateTightest[tightestCoordinate].scale}:${coordinateTightest[tightestCoordinate].rounding}`;

  const reasons = [];
  for (const coordinate of COORDINATES) {
    const margin = margins[coordinate], at = coordinateTightest[coordinate];
    if (margin < BOUNDARY_TIGHT)
      reasons.push(`Ratio-scaled ${coordinate} sits ${fmt(margin)} from the nearest ${at.rounding} quantiser boundary (${at.scale} scale, scaled value ${fmt(at.scaled)}); a tiny settings change flips the native integer.`);
    else if (margin < BOUNDARY_NEAR)
      reasons.push(`Ratio-scaled ${coordinate} is ${fmt(margin)} from the nearest ${at.rounding} quantiser boundary (${at.scale} scale); moderately fragile.`);
  }
  if (integerOverall <= 1e-9)
    reasons.push('An integer legacy value lies exactly on a trunc/ceil integer boundary by construction; the trunc and ceil hypotheses change output under any tiny increase or decrease. This structural hit is reported but not scored, because it is universal for integer settings.');
  if (settings.thickness === 0)
    reasons.push('Legacy thickness is exactly 0: the declared solver takes the literal-zero thickness branch (minimum one-pixel width).');
  if (settings.gap < 0)
    reasons.push(`Legacy gap ${settings.gap} is negative: the scaled gap crosses zero, so the gap offset and the quantiser interact discontinuously.`);
  if (o.authoredHeight === 720 || o.authoredHeight === 1080)
    reasons.push(`authoredHeight ${o.authoredHeight} coincides with a reference scale; the authored and reference hypotheses are structurally ambiguous at this ratio.`);
  for (const coordinate of COORDINATES) {
    const raw = settings[coordinate];
    if (!Number.isInteger(raw)) reasons.push(`Legacy ${coordinate} ${raw} is fractional: it lands off the integer grid before ratio scaling.`);
  }

  let score = 0;
  if (nearestOverall < BOUNDARY_TIGHT) score += 2; else if (nearestOverall < BOUNDARY_NEAR) score += 1;
  if (settings.thickness === 0) score += 1;
  if (settings.gap < 0) score += 1;
  if (o.authoredHeight === 720 || o.authoredHeight === 1080) score += 1;
  for (const coordinate of COORDINATES) if (!Number.isInteger(settings[coordinate])) score += 1;

  const level = (nearestOverall < BOUNDARY_TIGHT || score >= 3) ? 'high'
    : (nearestOverall < BOUNDARY_NEAR || score >= 1) ? 'medium' : 'low';
  return { level, score, reasons, margins };
}

// ---------------------------------------------------------------------------
// Learned fragility layer (advisory). Predicts P(emulator tuple != solver tuple).
// ---------------------------------------------------------------------------

const sigmoid = z => 1 / (1 + Math.exp(-z));
const logit = p => Math.log(p / (1 - p));
const clampProbability = p => Math.min(1 - 1e-6, Math.max(1e-6, p));

function makeOrders(X, featureCount) {
  const orders = [];
  for (let f = 0; f < featureCount; f++) {
    const index = new Array(X.length);
    for (let i = 0; i < X.length; i++) index[i] = i;
    index.sort((a, b) => X[a][f] - X[b][f] || a - b);
    orders.push(index);
  }
  return orders;
}

function treeMean(members, residual) {
  if (!members.length) return 0;
  let sum = 0;
  for (const i of members) sum += residual[i];
  return sum / members.length;
}

function findSplit(members, X, residual, orders, featureCount) {
  const mask = new Uint8Array(X.length);
  let total = 0, totalSq = 0;
  for (const i of members) { mask[i] = 1; const v = residual[i]; total += v; totalSq += v * v; }
  const count = members.length;
  let best = null;
  for (let f = 0; f < featureCount; f++) {
    const order = orders[f];
    const inOrder = [];
    for (let k = 0; k < order.length; k++) if (mask[order[k]]) inOrder.push(order[k]);
    let s = 0, q = 0;
    for (let k = 0; k < count - 1; k++) {
      const i = inOrder[k], v = residual[i];
      s += v;
      q += v * v;
      const next = inOrder[k + 1];
      const vi = X[i][f], vn = X[next][f];
      if (vi === vn) continue;
      const c = k + 1, rc = count - c;
      const sse = (q - s * s / c) + ((totalSq - q) - (total - s) * (total - s) / rc);
      if (!best || sse < best.sse) best = { sse, feature: f, threshold: (vi + vn) / 2, left: inOrder.slice(0, c), right: inOrder.slice(c) };
    }
  }
  return best;
}

function growTree(members, X, residual, orders, featureCount, depth) {
  if (members.length < 2 || depth <= 0) return treeMean(members, residual);
  const split = findSplit(members, X, residual, orders, featureCount);
  if (!split) return treeMean(members, residual);
  return {
    feature: split.feature, threshold: split.threshold,
    left: growTree(split.left, X, residual, orders, featureCount, depth - 1),
    right: growTree(split.right, X, residual, orders, featureCount, depth - 1),
  };
}

function evaluateTree(node, features) {
  return typeof node === 'number' ? node
    : features[node.feature] <= node.threshold ? evaluateTree(node.left, features) : evaluateTree(node.right, features);
}

const tupleKey = native => `${native.length}/${native.thickness}/${native.gap}`;

function checkTuple(tuple, label) {
  if (!tuple || typeof tuple !== 'object') throw new Error(`${label} must be an object.`);
  for (const [name, [lo, hi]] of Object.entries(DOMAIN_BOUNDS)) {
    if (!Number.isInteger(tuple[name]) || tuple[name] < lo || tuple[name] > hi)
      throw new Error(`${label} ${name} must be an integer in [${lo}, ${hi}].`);
  }
}

/**
 * Train a small deterministic logistic gradient-boosted model on the mismatch indicator
 * Number(emulatorTuple !== exactSolverTuple). Samples must carry `settings`, `options`,
 * `native` (exact solver tuple) and `emulator` (learned tuple). Features come from the
 * 26 declared `emulatorFeatures`. This never touches the committed emulator artifact.
 */
export function trainFragility(samples, { rounds = 60, learningRate = 0.2, maxDepth = 1, seed = 23092028 } = {}) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('Fragility training needs samples.');
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error('Fragility rounds must be a positive integer.');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 16) throw new Error('Fragility max depth must be a small positive integer.');
  if (typeof learningRate !== 'number' || !Number.isFinite(learningRate) || learningRate <= 0)
    throw new Error('Fragility learning rate must be a positive finite number.');
  const featureCount = EMULATOR_FEATURE_NAMES.length;
  const X = samples.map(sample => {
    if (!sample.native || !sample.emulator) throw new Error('Fragility samples need both native and emulator tuples.');
    checkTuple(sample.native, 'native');
    checkTuple(sample.emulator, 'emulator');
    return emulatorFeatures(sample);
  });
  const y = samples.map(sample => (tupleKey(sample.native) === tupleKey(sample.emulator) ? 0 : 1));
  const positiveRate = y.reduce((a, b) => a + b, 0) / y.length;
  const base = logit(clampProbability(positiveRate));
  const orders = makeOrders(X, featureCount);
  const fitted = new Float64Array(X.length).fill(base);
  const all = Array.from({ length: X.length }, (_, i) => i);
  const trees = [];
  for (let round = 0; round < rounds; round++) {
    const residual = new Float64Array(X.length);
    for (let i = 0; i < X.length; i++) residual[i] = y[i] - sigmoid(fitted[i]);
    const tree = growTree(all, X, residual, orders, featureCount, maxDepth);
    if (typeof tree === 'number') break;
    trees.push(tree);
    for (let i = 0; i < X.length; i++) fitted[i] += learningRate * evaluateTree(tree, X[i]);
  }
  return {
    schema: FRAGILITY_SCHEMA, version: FRAGILITY_VERSION,
    kind: maxDepth === 1 ? 'boosted-logistic-stumps' : 'boosted-logistic-trees',
    seed, learningRate, rounds, maxDepth, featureNames: [...EMULATOR_FEATURE_NAMES], base, stumps: trees,
    positiveRate, samples: samples.length,
    notes: 'Predicts P(learned emulator tuple != exact solver tuple) from the 26 declared emulator features. Distils the declared solver only; NOT native CS2 evidence.',
    scope: SENSITIVITY_SCOPE,
  };
}

/** Probability in [0, 1] that the learned emulator disagrees with the exact solver tuple. */
export function fragilityScore(model, { settings, options = {} } = {}) {
  if (!model || model.schema !== FRAGILITY_SCHEMA) throw new Error('Unknown fragility model.');
  const features = emulatorFeatures({ settings, options });
  let z = model.base;
  for (const tree of model.stumps) z += model.learningRate * evaluateTree(tree, features);
  const score = sigmoid(Math.max(-40, Math.min(40, z)));
  if (!Number.isFinite(score)) throw new Error('Fragility score is not finite.');
  return Math.min(1, Math.max(0, score));
}

function sameNumbers(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
}

function checkTree(node, featureCount, depth = 0) {
  if (depth > 32) throw new Error('Fragility tree is too deep.');
  if (typeof node === 'number') {
    if (!Number.isFinite(node)) throw new Error('Fragility tree leaf must be finite.');
    return;
  }
  if (!node || typeof node !== 'object') throw new Error('Fragility tree node must be an object.');
  if (!Number.isInteger(node.feature) || node.feature < 0 || node.feature >= featureCount)
    throw new Error('Fragility tree feature is out of range.');
  if (!Number.isFinite(node.threshold)) throw new Error('Fragility tree threshold must be finite.');
  checkTree(node.left, featureCount, depth + 1);
  checkTree(node.right, featureCount, depth + 1);
}

/** Fail-closed parser. Accepts a JSON string or a parsed object; trusts neither shape nor finiteness. */
export function parseFragility(json) {
  const model = typeof json === 'string' ? JSON.parse(json) : json;
  if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('Fragility model must be an object.');
  if (model.schema !== FRAGILITY_SCHEMA) throw new Error('Unknown fragility schema.');
  if (model.version !== FRAGILITY_VERSION) throw new Error('Unknown fragility version.');
  if (!FRAGILITY_KINDS.includes(model.kind)) throw new Error('Unknown fragility model kind.');
  if (!sameNumbers(model.featureNames, EMULATOR_FEATURE_NAMES)) throw new Error('Fragility feature names do not match the declared order.');
  if (!Number.isFinite(model.base) || !Number.isFinite(model.learningRate) || model.learningRate <= 0)
    throw new Error('Fragility scalar metadata must be finite and positive.');
  if (!Number.isInteger(model.rounds) || model.rounds < 1) throw new Error('Fragility rounds must be a positive integer.');
  if (!Number.isInteger(model.maxDepth) || model.maxDepth < 1 || model.maxDepth > 16) throw new Error('Fragility max depth must be a small positive integer.');
  if (!Number.isFinite(model.seed)) throw new Error('Fragility seed must be finite.');
  if (!Number.isFinite(model.positiveRate)) throw new Error('Fragility positive rate must be finite.');
  if (model.kind !== (model.maxDepth === 1 ? 'boosted-logistic-stumps' : 'boosted-logistic-trees'))
    throw new Error('Fragility model kind does not match its max depth.');
  if (!Array.isArray(model.stumps) || !model.stumps.length) throw new Error('Fragility stumps must be a non-empty array.');
  for (const tree of model.stumps) checkTree(tree, EMULATOR_FEATURE_NAMES.length);
  if (typeof model.notes !== 'string' || !model.notes.length) throw new Error('Fragility notes must be a non-empty string.');
  return model;
}

/**
 * Combined advisory report. `fragility` may be a trained model or serialized model; when
 * absent, `learned` is null and the analytic layer stands alone. `artifact` is optional
 * context only (its fingerprint is echoed when present).
 */
export function sensitivityReport({ settings, options = {}, artifact = null, fragility = null } = {}) {
  const analytic = analyticSensitivity({ settings, options });
  let learned = null;
  if (fragility) {
    const model = parseFragility(fragility);
    learned = {
      available: true,
      score: fragilityScore(model, { settings, options }),
      kind: model.kind,
      rounds: model.rounds,
      artifactFingerprint: artifact && Number.isFinite(artifact.fingerprint) ? artifact.fingerprint : null,
    };
  }
  return { level: analytic.level, score: analytic.score, reasons: analytic.reasons, margins: analytic.margins, learned, scope: SENSITIVITY_SCOPE };
}
