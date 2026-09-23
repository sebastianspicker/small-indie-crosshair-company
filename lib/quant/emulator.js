/**
 * Dependency-free learned emulators for the declared quant solver.
 *
 * Scope and limits (read before quoting a number):
 * - The main emulator is trained on labels produced by the declared automatic
 *   solver (`infer`). It DISTILLS that solver. Its metrics measure fidelity to
 *   solver output only. It makes NO claim about native CS2 rendering.
 * - The forward block is a research surrogate for `forward`, evaluated offline.
 *   It is not wired into inference and is not evidence about Valve's renderer.
 * The project ships zero native old/new capture pairs; everything here is
 * synthesized from the declared models, never measured from the game.
 */
import { scope, getModel, naiveAssignment } from './renderer.js';
import { legacyGeometry } from '../legacy.js';
import { validateNative } from '../native-settings.js';
import { height as validHeight, bool } from '../validation.js';
import { hash } from './statistics.js';

export const EMULATOR_SCHEMA = 'sicc-quant-emulator-v1';
export const EMULATOR_VERSION = 'quant-emulator-v1';

export const EMULATOR_FEATURE_NAMES = Object.freeze([
  'bias', 'size', 'thickness', 'gap', 'dot', 't_style', 'oldHeight', 'currentHeight', 'goalScreen',
  'ratio', 'oldLength', 'oldWidth', 'oldNear', 'oldFar', 'thicknessZero', 'gapNegative',
  'sizeTimesRatio', 'thicknessTimesRatio', 'gapTimesRatio',
  // Declared-math additions: quantiser residues and integer-boundary distances on the
  // ratio-scaled values, plus the legacy width parity. These are derived from settings
  // and options only; no label or outcome is consulted.
  'sizeFracTimesRatio', 'thicknessFracTimesRatio', 'gapFracTimesRatio',
  'lengthBoundaryDistance', 'thicknessBoundaryDistance', 'gapBoundaryDistance', 'oldWidthOdd',
]);

/** Model kinds recorded in the artifact. Depth 1 is the additive stump block; deeper
 * blocks are depth-limited boosted trees for the nonlinear solver compromise. */
export const EMULATOR_MODELS = Object.freeze(['boosted-stumps', 'boosted-trees']);

export const FORWARD_FEATURE_NAMES = Object.freeze([
  'bias', 'length', 'thickness', 'gap', 'authoredHeight', 'height', 'ratio', 'isAuthored', 'isRef1080',
  'isRef720', 'isTrunc', 'isNearest', 'isCeil', 'isThickness', 'isCenter', 'isOpening',
]);

const OUTPUT_ORDER = Object.freeze(['length', 'thickness', 'gap']);
const FORWARD_OUTPUT_ORDER = Object.freeze(['length', 'width', 'near', 'far']);
const DEFAULT_BOUNDS = Object.freeze({
  length: Object.freeze([0, 255]), thickness: Object.freeze([0, 31]), gap: Object.freeze([0, 128]),
});

/** The declared solver features, in fixed order. Validates through scope and legacyGeometry.
 * The final seven features are declared math on the ratio-scaled values: the fractional
 * part, the distance to the nearest integer, and the legacy width parity. */
export function emulatorFeatures({ settings, options = {} } = {}) {
  const o = scope(options);
  for (const key of ['dot', 't_style']) bool(settings[key], key);
  const legacy = legacyGeometry(settings, o.oldHeight);
  const ratio = o.currentHeight / o.oldHeight;
  const sizeScaled = settings.size * ratio;
  const thicknessScaled = settings.thickness * ratio;
  const gapScaled = settings.gap * ratio;
  const frac = value => value - Math.floor(value);
  const boundary = value => Math.abs(value - Math.round(value));
  return [
    1, settings.size, settings.thickness, settings.gap, Number(settings.dot), Number(settings.t_style),
    o.oldHeight, o.currentHeight, Number(o.goal === 'screen'), ratio,
    legacy.length, legacy.width, legacy.near, legacy.far,
    Number(settings.thickness === 0), Number(settings.gap < 0),
    sizeScaled, thicknessScaled, gapScaled,
    frac(sizeScaled), frac(thicknessScaled), frac(gapScaled),
    boundary(sizeScaled), boundary(thicknessScaled), boundary(gapScaled), legacy.width % 2,
  ];
}

/**
 * Gradient-boosted regression stumps, one independent ensemble per output.
 * Deterministic: full feature scans with prefix sums, ties keep the lowest feature
 * index and the first split. No randomness is consumed, so `seed` is recorded only.
 */
function trainStumps(X, y, featureCount, rounds, learningRate) {
  const n = X.length;
  const orders = [];
  for (let f = 0; f < featureCount; f++) {
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => X[a][f] - X[b][f] || a - b);
    orders.push(idx);
  }
  const base = n ? y.reduce((a, b) => a + b, 0) / n : 0;
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = base;
  const stumps = [];
  for (let r = 0; r < rounds; r++) {
    const resid = new Float64Array(n);
    let S = 0, Q = 0;
    for (let i = 0; i < n; i++) { const d = y[i] - pred[i]; resid[i] = d; S += d; Q += d * d; }
    let best = null;
    for (let f = 0; f < featureCount; f++) {
      const order = orders[f];
      let s = 0, q = 0;
      for (let i = 0; i < n - 1; i++) {
        const value = resid[order[i]];
        s += value; q += value * value;
        const vi = X[order[i]][f], vn = X[order[i + 1]][f];
        if (vi === vn) continue;
        const c = i + 1, rc = n - c;
        const sse = (q - s * s / c) + ((Q - q) - (S - s) * (S - s) / rc);
        if (!best || sse < best.sse) best = { sse, feature: f, threshold: (vi + vn) / 2, left: s / c, right: (S - s) / rc };
      }
    }
    if (!best) break;
    stumps.push({ feature: best.feature, threshold: best.threshold, left: best.left, right: best.right });
    for (let i = 0; i < n; i++) pred[i] += learningRate * (X[i][best.feature] <= best.threshold ? best.left : best.right);
  }
  return { base, stumps };
}

export function trainEmulator(samples, { rounds = 60, learningRate = 0.2, seed = 23092026,
  maxDepth = 1, featureNames = EMULATOR_FEATURE_NAMES, bounds = DEFAULT_BOUNDS } = {}) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('Emulator training needs samples.');
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error('Emulator rounds must be a positive integer.');
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error('Emulator max depth must be a positive integer.');
  if (typeof learningRate !== 'number' || !Number.isFinite(learningRate) || learningRate <= 0)
    throw new Error('Emulator learning rate must be a positive finite number.');
  const names = [...featureNames];
  const built = {
    length: [...bounds.length], thickness: [...bounds.thickness], gap: [...bounds.gap],
  };
  const X = samples.map(s => emulatorFeatures(s));
  const outputs = {};
  for (const name of OUTPUT_ORDER) {
    const y = samples.map(s => {
      const value = s.native?.[name];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Emulator label ${name} must be finite.`);
      return value;
    });
    // Depth 1 keeps the additive stump trainer for the committed baseline path; deeper
    // blocks use the same depth-limited tree grower as the forward research block.
    if (maxDepth === 1) outputs[name] = trainStumps(X, y, names.length, rounds, learningRate);
    else { const { base, trees } = trainTrees(X, y, names.length, rounds, maxDepth, learningRate); outputs[name] = { base, stumps: trees }; }
  }
  return { schema: EMULATOR_SCHEMA, version: EMULATOR_VERSION, seed, featureNames: names, learningRate, rounds,
    maxDepth, model: maxDepth === 1 ? 'boosted-stumps' : 'boosted-trees', bounds: built, outputs };
}

function scoreOutput(output, features, learningRate) {
  let value = output.base;
  for (const tree of output.stumps) value += learningRate * evaluateTree(tree, features);
  return value;
}

/** Depth-limited boosted regression trees. Forward is multiplicative (size x ratio), so its block
 * uses depth > 1; a sum of depth-1 stumps is additive and cannot represent that interaction. */
function findSplit(members, X, resid, orders, featureCount) {
  const mask = new Uint8Array(X.length);
  let S = 0, Q = 0;
  for (const i of members) { mask[i] = 1; const v = resid[i]; S += v; Q += v * v; }
  const m = members.length;
  let best = null;
  for (let f = 0; f < featureCount; f++) {
    const order = orders[f];
    const inOrder = [];
    for (let k = 0; k < order.length; k++) { const i = order[k]; if (mask[i]) inOrder.push(i); }
    let s = 0, q = 0;
    for (let k = 0; k < m - 1; k++) {
      const i = inOrder[k], v = resid[i];
      s += v; q += v * v;
      const next = inOrder[k + 1], vi = X[i][f], vn = X[next][f];
      if (vi === vn) continue;
      const c = k + 1, rc = m - c;
      const sse = (q - s * s / c) + ((Q - q) - (S - s) * (S - s) / rc);
      if (!best || sse < best.sse) best = { sse, feature: f, threshold: (vi + vn) / 2, left: inOrder.slice(0, c), right: inOrder.slice(c) };
    }
  }
  return best;
}

function treeMean(members, resid) {
  if (!members.length) return 0;
  let sum = 0;
  for (const i of members) sum += resid[i];
  return sum / members.length;
}

function growTree(members, X, resid, orders, featureCount, depth) {
  if (members.length < 2 || depth <= 0) return treeMean(members, resid);
  const split = findSplit(members, X, resid, orders, featureCount);
  if (!split) return treeMean(members, resid);
  return { feature: split.feature, threshold: split.threshold,
    left: growTree(split.left, X, resid, orders, featureCount, depth - 1),
    right: growTree(split.right, X, resid, orders, featureCount, depth - 1) };
}

function trainTrees(X, y, featureCount, rounds, maxDepth, learningRate) {
  const n = X.length;
  const orders = [];
  for (let f = 0; f < featureCount; f++) {
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => X[a][f] - X[b][f] || a - b);
    orders.push(idx);
  }
  const base = n ? y.reduce((a, b) => a + b, 0) / n : 0;
  const pred = new Float64Array(n);
  for (let i = 0; i < n; i++) pred[i] = base;
  const all = Array.from({ length: n }, (_, i) => i);
  const trees = [];
  for (let r = 0; r < rounds; r++) {
    const resid = new Float64Array(n);
    for (let i = 0; i < n; i++) resid[i] = y[i] - pred[i];
    const tree = growTree(all, X, resid, orders, featureCount, maxDepth);
    if (typeof tree === 'number') break;
    trees.push(tree);
    for (let i = 0; i < n; i++) pred[i] += learningRate * evaluateTree(tree, X[i]);
  }
  return { base, trees };
}

function evaluateTree(node, features) {
  return typeof node === 'number' ? node : features[node.feature] <= node.threshold ? evaluateTree(node.left, features) : evaluateTree(node.right, features);
}

function scaleLeaves(node, factor) {
  return typeof node === 'number' ? node * factor
    : { feature: node.feature, threshold: node.threshold, left: scaleLeaves(node.left, factor), right: scaleLeaves(node.right, factor) };
}

function scoreTrees(output, features) {
  let value = output.base;
  for (const tree of output.stumps) value += evaluateTree(tree, features);
  return value;
}

const clampRound = (value, lo, hi) => Math.max(lo, Math.min(hi, Math.round(value)));

export function predictEmulator(artifact, { settings, options = {} } = {}) {
  const features = emulatorFeatures({ settings, options });
  const o = scope(options);
  const native = { authoredHeight: o.authoredHeight };
  for (const name of OUTPUT_ORDER) {
    const bounds = artifact.bounds[name];
    native[name] = clampRound(scoreOutput(artifact.outputs[name], features, artifact.learningRate), bounds[0], bounds[1]);
  }
  return { schema: artifact.schema, version: artifact.version, provisional: true, native };
}

export function evaluateEmulator(artifact, samples) {
  if (!Array.isArray(samples)) throw new Error('Emulator evaluation needs samples.');
  let count = 0, exact = 0, le = 0, te = 0, ge = 0, naiveExact = 0;
  let lsum = 0, tsum = 0, gsum = 0, nsum = 0;
  for (const sample of samples) {
    const predicted = predictEmulator(artifact, sample).native;
    const label = sample.native;
    count++;
    const dl = Math.abs(predicted.length - label.length), dt = Math.abs(predicted.thickness - label.thickness),
      dg = Math.abs(predicted.gap - label.gap);
    lsum += dl; tsum += dt; gsum += dg;
    if (dl === 0) le++;
    if (dt === 0) te++;
    if (dg === 0) ge++;
    if (dl === 0 && dt === 0 && dg === 0) exact++;
    const naive = naiveAssignment(sample.settings, sample.options.authoredHeight ?? sample.options.currentHeight);
    if (naive.length === label.length && naive.thickness === label.thickness && naive.gap === label.gap) naiveExact++;
    nsum += (Math.abs(naive.length - label.length) + Math.abs(naive.thickness - label.thickness) + Math.abs(naive.gap - label.gap)) / 3;
  }
  const d = count || 1;
  return { count, exactTupleRate: exact / d, lengthExactRate: le / d, thicknessExactRate: te / d, gapExactRate: ge / d,
    lengthMae: lsum / d, thicknessMae: tsum / d, gapMae: gsum / d, naiveExactTupleRate: naiveExact / d, naiveMae: nsum / d };
}

function sameNumbers(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}
function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function checkStumps(block, names, featureCount, label) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) throw new Error(`${label} outputs must be an object.`);
  for (const name of names) {
    const output = block[name];
    if (!output || typeof output !== 'object') throw new Error(`${label} is missing the ${name} output.`);
    if (!isFiniteNumber(output.base)) throw new Error(`${label} ${name} base must be finite.`);
    if (!Array.isArray(output.stumps) || !output.stumps.length) throw new Error(`${label} ${name} stumps must be a non-empty array.`);
    for (const tree of output.stumps) {
      if (!tree || typeof tree !== 'object') throw new Error(`${label} ${name} stump must be an object.`);
      checkTreeNode(tree, featureCount, label, 0);
    }
  }
}

function checkForwardStumps(block, names, featureCount, label) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) throw new Error(`${label} outputs must be an object.`);
  for (const name of names) {
    const output = block[name];
    if (!output || typeof output !== 'object') throw new Error(`${label} is missing the ${name} output.`);
    if (!isFiniteNumber(output.base)) throw new Error(`${label} ${name} base must be finite.`);
    if (!Array.isArray(output.stumps) || !output.stumps.length) throw new Error(`${label} ${name} stumps must be a non-empty array.`);
    for (const tree of output.stumps) checkTreeNode(tree, featureCount, label, 0);
  }
}

function checkTreeNode(node, featureCount, label, depth) {
  if (depth > 32) throw new Error(`${label} tree is too deep.`);
  if (typeof node === 'number') {
    if (!Number.isFinite(node)) throw new Error(`${label} tree leaf must be finite.`);
    return;
  }
  if (!node || typeof node !== 'object') throw new Error(`${label} tree node must be an object.`);
  if (!Number.isInteger(node.feature) || node.feature < 0 || node.feature >= featureCount)
    throw new Error(`${label} tree feature is out of range.`);
  if (!isFiniteNumber(node.threshold)) throw new Error(`${label} tree threshold must be finite.`);
  checkTreeNode(node.left, featureCount, label, depth + 1);
  checkTreeNode(node.right, featureCount, label, depth + 1);
}

/** Fail-closed parser. Accepts a JSON string or a parsed object; never trusts shape or finiteness. */
export function parseEmulator(json) {
  const artifact = typeof json === 'string' ? JSON.parse(json) : json;
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new Error('Emulator artifact must be an object.');
  if (artifact.schema !== EMULATOR_SCHEMA) throw new Error('Unknown emulator schema.');
  if (artifact.version !== EMULATOR_VERSION) throw new Error('Unknown emulator version.');
  if (!sameNumbers(artifact.featureNames, EMULATOR_FEATURE_NAMES)) throw new Error('Emulator feature names do not match the declared order.');
  if (!sameNumbers(artifact.bounds?.length, DEFAULT_BOUNDS.length) || !sameNumbers(artifact.bounds?.thickness, DEFAULT_BOUNDS.thickness) ||
    !sameNumbers(artifact.bounds?.gap, DEFAULT_BOUNDS.gap)) throw new Error('Emulator bounds do not match the declared native domain.');
  if (!isFiniteNumber(artifact.learningRate) || !isFiniteNumber(artifact.rounds) || !isFiniteNumber(artifact.seed))
    throw new Error('Emulator scalar metadata must be finite.');
  if (!Number.isInteger(artifact.maxDepth) || artifact.maxDepth < 1 || artifact.maxDepth > 16)
    throw new Error('Emulator max depth must be a small positive integer.');
  if (!EMULATOR_MODELS.includes(artifact.model)) throw new Error('Unknown emulator model kind.');
  if (artifact.model !== (artifact.maxDepth === 1 ? 'boosted-stumps' : 'boosted-trees'))
    throw new Error('Emulator model kind does not match its max depth.');
  if (typeof artifact.notes !== 'string' || !artifact.notes.length) throw new Error('Emulator notes must be a non-empty string.');
  checkStumps(artifact.outputs, OUTPUT_ORDER, EMULATOR_FEATURE_NAMES.length, 'Emulator');
  if (!artifact.forward || typeof artifact.forward !== 'object') throw new Error('Emulator artifact is missing the forward research block.');
  if (!sameNumbers(artifact.forward.featureNames, FORWARD_FEATURE_NAMES)) throw new Error('Forward feature names do not match the declared order.');
  checkForwardStumps(artifact.forward.outputs, FORWARD_OUTPUT_ORDER, FORWARD_FEATURE_NAMES.length, 'Forward');
  return artifact;
}

function canonNode(node) {
  return typeof node === 'number' ? node
    : { feature: node.feature, threshold: node.threshold, left: canonNode(node.left), right: canonNode(node.right) };
}

function canonTreeOutputs(outputs, names) {
  const out = {};
  for (const name of names) {
    const output = outputs?.[name];
    out[name] = output ? { base: output.base, stumps: (output.stumps || []).map(canonNode) } : undefined;
  }
  return out;
}

/** Explicit key order, so the fingerprint never depends on object insertion luck. */
function canonicalArtifact(artifact) {
  const out = {
    schema: artifact.schema, version: artifact.version, snapshot: artifact.snapshot, seed: artifact.seed,
    featureNames: artifact.featureNames, learningRate: artifact.learningRate, rounds: artifact.rounds,
    maxDepth: artifact.maxDepth, model: artifact.model, notes: artifact.notes,
    bounds: artifact.bounds ? { length: artifact.bounds.length, thickness: artifact.bounds.thickness, gap: artifact.bounds.gap } : undefined,
    outputs: canonTreeOutputs(artifact.outputs, OUTPUT_ORDER),
  };
  if (artifact.training) out.training = { samples: artifact.training.samples, settings: artifact.training.settings,
    trainSamples: artifact.training.trainSamples, testSamples: artifact.training.testSamples,
    excluded: artifact.training.excluded, splitRule: artifact.training.splitRule };
  if (artifact.metrics) out.metrics = { count: artifact.metrics.count, exactTupleRate: artifact.metrics.exactTupleRate,
    lengthExactRate: artifact.metrics.lengthExactRate, thicknessExactRate: artifact.metrics.thicknessExactRate,
    gapExactRate: artifact.metrics.gapExactRate, lengthMae: artifact.metrics.lengthMae, thicknessMae: artifact.metrics.thicknessMae,
    gapMae: artifact.metrics.gapMae, naiveExactTupleRate: artifact.metrics.naiveExactTupleRate, naiveMae: artifact.metrics.naiveMae,
    testSamples: artifact.metrics.testSamples };
  if (artifact.forward) out.forward = { featureNames: artifact.forward.featureNames,
    outputs: canonTreeOutputs(artifact.forward.outputs, FORWARD_OUTPUT_ORDER),
    metrics: artifact.forward.metrics ? { count: artifact.forward.metrics.count, lengthMae: artifact.forward.metrics.lengthMae,
      widthMae: artifact.forward.metrics.widthMae, nearMae: artifact.forward.metrics.nearMae, farMae: artifact.forward.metrics.farMae } : undefined };
  if (artifact.provenance) out.provenance = { labels: artifact.provenance.labels, scope: artifact.provenance.scope,
    nativeEvidence: artifact.provenance.nativeEvidence, speedGate: artifact.provenance.speedGate };
  return JSON.stringify(out);
}

/** Unsigned 32-bit fingerprint over canonical JSON with `fingerprint` excluded. Does not mutate. */
export function emulatorFingerprint(artifact) { return hash(canonicalArtifact(artifact)); }

export function forwardFeatures(native, height, model) {
  validateNative(native);
  validHeight(height);
  const m = getModel(model?.id);
  const ratio = height / native.authoredHeight;
  return [
    1, native.length, native.thickness, native.gap, native.authoredHeight, height, ratio,
    Number(m.scale === 'authored'), Number(m.scale === 'reference1080'), Number(m.scale === 'reference720'),
    Number(m.rounding === 'trunc'), Number(m.rounding === 'nearest'), Number(m.rounding === 'ceil'),
    Number(m.gap === 'thickness'), Number(m.gap === 'center'), Number(m.gap === 'opening'),
  ];
}

export function trainForwardEmulator(samples, { rounds = 60, learningRate = 0.2, maxDepth = 3, seed = 23092027,
  featureNames = FORWARD_FEATURE_NAMES } = {}) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('Forward training needs samples.');
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error('Forward rounds must be a positive integer.');
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error('Forward depth must be a positive integer.');
  if (typeof learningRate !== 'number' || !Number.isFinite(learningRate) || learningRate <= 0)
    throw new Error('Forward learning rate must be a positive finite number.');
  const names = [...featureNames];
  const X = samples.map(s => forwardFeatures(s.native, s.height, s.model));
  const outputs = {};
  for (const name of FORWARD_OUTPUT_ORDER) {
    const y = samples.map(s => {
      const value = s.geometry?.[name];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Forward label ${name} must be finite.`);
      return value;
    });
    const { base, trees } = trainTrees(X, y, names.length, rounds, maxDepth, learningRate);
    // Learning rate is baked into the leaves: the forward block carries no scalar metadata.
    // Depth > 1 is required here because forward is multiplicative in ratio and native size;
    // a sum of depth-1 stumps is additive and cannot represent that interaction.
    outputs[name] = { base, stumps: trees.map(tree => scaleLeaves(tree, learningRate)) };
  }
  const artifact = { featureNames: names, outputs };
  return { ...artifact, metrics: evaluateForwardEmulator(artifact, samples) };
}

export function predictForwardEmulator(artifact, native, height, model) {
  const features = forwardFeatures(native, height, model);
  const out = {};
  for (const name of FORWARD_OUTPUT_ORDER) out[name] = scoreTrees(artifact.outputs[name], features);
  return out;
}

export function evaluateForwardEmulator(artifact, samples) {
  if (!Array.isArray(samples)) throw new Error('Forward evaluation needs samples.');
  let count = 0, ls = 0, ws = 0, ns = 0, fs = 0;
  for (const sample of samples) {
    const predicted = predictForwardEmulator(artifact, sample.native, sample.height, sample.model);
    const label = sample.geometry;
    count++;
    ls += Math.abs(predicted.length - label.length);
    ws += Math.abs(predicted.width - label.width);
    ns += Math.abs(predicted.near - label.near);
    fs += Math.abs(predicted.far - label.far);
  }
  const d = count || 1;
  return { count, lengthMae: ls / d, widthMae: ws / d, nearMae: ns / d, farMae: fs / d };
}

/** Declared ordering used by report/artifact tooling; kept in sync with the canonical writer. */
export const EMULATOR_OUTPUT_NAMES = OUTPUT_ORDER;
export const FORWARD_OUTPUT_NAMES = FORWARD_OUTPUT_ORDER;
