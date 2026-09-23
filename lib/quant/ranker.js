/**
 * Learned shortlist + EXACT verification over the declared decision loss.
 *
 * Scope and honesty (read before quoting a number):
 * - The learned emulator ONLY proposes a small candidate set around its prediction.
 *   The returned tuple is the exact argmin of the caller-supplied declared loss over
 *   that shortlist. Verification is exact; the shortlist is the only approximation.
 * - This DISTILS the project's declared solver. It is not native CS2 evidence and
 *   makes no accuracy claim about Valve's renderer.
 * - There is no global-optimality claim. If the shortlist misses the solver's tuple,
 *   the verified answer can be worse than the solver; `coverageAtK` measures how often
 *   the exact solver tuple is inside the shortlist at size K.
 *
 * Dependency-free and browser-import-safe. No node builtins are used here.
 */
import { predictEmulator } from './emulator.js';
import { LOSS_KEYS } from './selection.js';

export const RANKER_SCOPE =
  'Learned shortlist + exact verification over the DECLARED solver decision loss. The emulator only proposes candidates; the returned tuple is the exact argmin of the caller-supplied declared loss over the shortlist. Coverage and loss gaps are measured against the declared solver only. NOT native CS2 evidence.';

export const DEFAULT_SHORTLIST_K = 32;

const DOMAIN = Object.freeze({
  length: Object.freeze([0, 255]),
  thickness: Object.freeze([0, 31]),
  gap: Object.freeze([0, 128]),
});
const COORDS = Object.freeze(['length', 'thickness', 'gap']);
const EPS = 1e-12;

const keyOf = native => `${native.length}/${native.thickness}/${native.gap}@${native.authoredHeight}`;

function checkNative(native, label = 'native') {
  if (!native || typeof native !== 'object' || Array.isArray(native)) throw new Error(`${label} must be an object.`);
  for (const coordinate of COORDS) {
    const value = native[coordinate];
    const [lo, hi] = DOMAIN[coordinate];
    if (!Number.isInteger(value) || value < lo || value > hi)
      throw new Error(`${label} ${coordinate} must be an integer in [${lo}, ${hi}].`);
  }
  if (!Number.isInteger(native.authoredHeight) || native.authoredHeight < 240 || native.authoredHeight > 16384)
    throw new Error(`${label} authoredHeight is invalid.`);
}

function ruleOf(decision) {
  const rule = typeof decision === 'string' ? decision : decision?.rule;
  const normalized = rule ?? 'expected';
  if (!Object.prototype.hasOwnProperty.call(LOSS_KEYS, normalized)) throw new Error('Unknown decision rule.');
  return normalized;
}

function resolvePreserveZero(preserveZero, sample) {
  return typeof preserveZero === 'function' ? Boolean(preserveZero(sample)) : Boolean(preserveZero);
}

function sampleSettings(sample) {
  if (!sample || typeof sample !== 'object' || !sample.settings) throw new Error('A sample with settings is required.');
  return { settings: sample.settings, options: sample.options ?? {}, decision: sample.decision };
}

/** Cells at Chebyshev distance exactly `distance` from `center`, window-clamped to the
 * native domain, ordered by squared Euclidean distance then by signed offset. Deterministic. */
function shellCells(center, distance, preserveZero) {
  const cells = [];
  for (let length = Math.max(DOMAIN.length[0], center.length - distance); length <= Math.min(DOMAIN.length[1], center.length + distance); length++) {
    const dl = length - center.length;
    for (let thickness = Math.max(DOMAIN.thickness[0], center.thickness - distance); thickness <= Math.min(DOMAIN.thickness[1], center.thickness + distance); thickness++) {
      const dt = thickness - center.thickness;
      for (let gap = Math.max(DOMAIN.gap[0], center.gap - distance); gap <= Math.min(DOMAIN.gap[1], center.gap + distance); gap++) {
        const dg = gap - center.gap;
        if (Math.max(Math.abs(dl), Math.abs(dt), Math.abs(dg)) !== distance) continue;
        if (preserveZero && thickness !== 0) continue;
        cells.push({ length, thickness, gap, authoredHeight: center.authoredHeight, dl, dt, dg });
      }
    }
  }
  cells.sort((a, b) =>
    (a.dl * a.dl + a.dt * a.dt + a.dg * a.dg) - (b.dl * b.dl + b.dt * b.dt + b.dg * b.dg)
    || a.dl - b.dl || a.dt - b.dt || a.dg - b.dg);
  return cells.map(({ dl, dt, dg, ...cell }) => cell);
}

/**
 * Deterministic neighbours of `native` with Chebyshev radius <= `radius`, origin excluded,
 * clipped to the declared native domain. Ordered by increasing Chebyshev radius, then
 * squared Euclidean distance, then signed offset. `preserveZero` keeps only thickness 0.
 */
export function neighborhood(native, radius, preserveZero = false) {
  checkNative(native);
  if (!Number.isInteger(radius) || radius < 1 || radius > 4096)
    throw new Error('Neighbourhood radius must be an integer in [1, 4096].');
  const cells = [];
  for (let distance = 1; distance <= radius; distance++) cells.push(...shellCells(native, distance, Boolean(preserveZero)));
  return cells;
}

function shortlistScope(K, filled) {
  return `Up to ${K} integer natives around the learned emulator prediction, ordered by increasing Chebyshev radius then Euclidean distance.${filled ? '' : ' The declared domain was exhausted before K.'} Exact verification, not the shortlist, chooses the returned tuple. Distils the declared solver; NOT native CS2 evidence.`;
}

/**
 * Learned proposal: the emulator prediction (always candidate 0) plus its neighbours,
 * added in increasing Chebyshev radius until K candidates exist. Deterministic.
 */
export function learnedShortlist(artifact, sample, { K = DEFAULT_SHORTLIST_K, preserveZero = false } = {}) {
  const { settings, options } = sampleSettings(sample);
  if (!Number.isInteger(K) || K < 1 || K > 4096) throw new Error('Shortlist size K must be an integer in [1, 4096].');
  const predicted = predictEmulator(artifact, { settings, options });
  const center = {
    length: predicted.native.length, thickness: predicted.native.thickness,
    gap: predicted.native.gap, authoredHeight: predicted.native.authoredHeight,
  };
  const candidates = [center];
  if (K > 1) {
    const seen = new Set([keyOf(center)]);
    const maxDistance = Math.max(
      center.length - DOMAIN.length[0], DOMAIN.length[1] - center.length,
      center.thickness - DOMAIN.thickness[0], DOMAIN.thickness[1] - center.thickness,
      center.gap - DOMAIN.gap[0], DOMAIN.gap[1] - center.gap);
    for (let distance = 1; distance <= maxDistance && candidates.length < K; distance++) {
      for (const cell of shellCells(center, distance, Boolean(preserveZero))) {
        const key = keyOf(cell);
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(cell);
        if (candidates.length >= K) break;
      }
    }
  }
  return { center, candidates, scope: shortlistScope(K, candidates.length >= K), K };
}

function verifyScope(rule) {
  return `Exact argmin of the declared ${rule} loss over the learned shortlist. The shortlist is the only approximation; if it misses the solver tuple the answer can lose to the solver. Distils the declared solver; NOT native CS2 evidence.`;
}

/**
 * Evaluate the learned shortlist with the injected EXACT scorer and return its argmin.
 * `evaluate(native)` must return finite `{ expectedLoss, worstCaseLoss, cvarLoss }`.
 * The result is never worse (under the active rule) than any other shortlist candidate.
 */
export function selectVerified(artifact, sample, evaluate, { K = DEFAULT_SHORTLIST_K, preserveZero = false } = {}) {
  if (typeof evaluate !== 'function') throw new Error('selectVerified needs an exact evaluate(native) function.');
  const { settings, options, decision } = sampleSettings(sample);
  const rule = ruleOf(decision ?? 'expected');
  const key = LOSS_KEYS[rule];
  const shortlist = learnedShortlist(artifact, { settings, options }, { K, preserveZero });
  let best = null;
  for (const candidate of shortlist.candidates) {
    const values = evaluate(candidate);
    const loss = values?.[key];
    if (typeof loss !== 'number' || !Number.isFinite(loss)) throw new Error(`evaluate() must return a finite ${key}.`);
    if (best === null || loss < best.loss) best = { native: candidate, loss, values };
  }
  return {
    native: best.native, verified: true, evaluated: shortlist.candidates.length,
    shortlistSize: shortlist.candidates.length, loss: best.loss, decision: rule, scope: verifyScope(rule),
  };
}

/**
 * Fraction of samples whose EXACT solver tuple (sample.native) lies inside the learned
 * shortlist at size K, plus per-coordinate containment and the shortlist scope.
 * `preserveZero` may be a boolean or a predicate(sample).
 */
export function coverageAtK(artifact, samples, K = DEFAULT_SHORTLIST_K, { preserveZero = false } = {}) {
  if (!Array.isArray(samples)) throw new Error('Coverage needs an array of samples.');
  let count = 0, covered = 0, lengthHit = 0, thicknessHit = 0, gapHit = 0;
  for (const sample of samples) {
    const target = sample.native;
    checkNative(target, 'sample.native');
    const { candidates } = learnedShortlist(artifact, sample, { K, preserveZero: resolvePreserveZero(preserveZero, sample) });
    const inLength = candidates.some(candidate => candidate.length === target.length);
    const inThickness = candidates.some(candidate => candidate.thickness === target.thickness);
    const inGap = candidates.some(candidate => candidate.gap === target.gap);
    const inTuple = candidates.some(candidate =>
      candidate.length === target.length && candidate.thickness === target.thickness && candidate.gap === target.gap);
    count++;
    if (inLength) lengthHit++;
    if (inThickness) thicknessHit++;
    if (inGap) gapHit++;
    if (inTuple) covered++;
  }
  const ratio = value => (count ? value / count : null);
  return {
    K, count, covered, coverage: ratio(covered),
    perCoordinate: { length: ratio(lengthHit), thickness: ratio(thicknessHit), gap: ratio(gapHit) },
    scope: 'Containment diagnostic: fraction of samples whose exact declared-solver tuple appears in the learned shortlist at size K. Not accuracy, and NOT native CS2 evidence.',
  };
}

/**
 * Honest head-to-head against the declared solver. For each sample the verified shortlist
 * loss is compared with the solver's own chosen loss under the SAME declared objective.
 * `evaluateFactory(sample)` supplies the exact scorer; `solverNativeFactory(sample)` (or
 * sample.native) supplies the solver tuple. Counts use a 1e-12 tolerance.
 */
export function compareToSolver(artifact, samples, {
  K = DEFAULT_SHORTLIST_K, preserveZero = false, decision = 'expected',
  evaluateFactory, solverNativeFactory,
} = {}) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('compareToSolver needs samples.');
  if (typeof evaluateFactory !== 'function' && !samples.every(sample => typeof sample.evaluate === 'function'))
    throw new Error('compareToSolver needs an evaluateFactory or a per-sample evaluate.');
  let matched = 0, worse = 0, better = 0, tupleMatch = 0;
  let sumGap = 0, sumAbsGap = 0, maxGap = -Infinity, minGap = Infinity, maxAbsGap = 0;
  const regressions = [], improvements = [];
  for (const sample of samples) {
    const evaluate = evaluateFactory ? evaluateFactory(sample) : sample.evaluate;
    const solverNative = solverNativeFactory ? solverNativeFactory(sample) : sample.native;
    checkNative(solverNative, 'solverNative');
    const rule = ruleOf(sample.decision ?? decision);
    const key = LOSS_KEYS[rule];
    const verified = selectVerified(artifact, { settings: sample.settings, options: sample.options, decision: rule }, evaluate,
      { K, preserveZero: resolvePreserveZero(preserveZero, sample) });
    const solverValues = evaluate(solverNative);
    const solverLoss = solverValues?.[key];
    if (typeof solverLoss !== 'number' || !Number.isFinite(solverLoss)) throw new Error(`solver evaluate() must return a finite ${key}.`);
    const gap = verified.loss - solverLoss;
    const tuple = keyOf(verified.native) === keyOf(solverNative);
    if (tuple) tupleMatch++;
    if (Math.abs(gap) <= EPS) matched++;
    else if (gap > 0) { worse++; regressions.push({ gap, verified: verified.native, solver: { ...solverNative } }); }
    else { better++; improvements.push({ gap, verified: verified.native, solver: { ...solverNative } }); }
    sumGap += gap;
    sumAbsGap += Math.abs(gap);
    if (gap > maxGap) maxGap = gap;
    if (gap < minGap) minGap = gap;
    if (Math.abs(gap) > maxAbsGap) maxAbsGap = Math.abs(gap);
  }
  const count = samples.length;
  regressions.sort((a, b) => b.gap - a.gap);
  improvements.sort((a, b) => a.gap - b.gap);
  return {
    K, count, matched, worse, better, tupleMatch,
    meanGap: sumGap / count, meanAbsGap: sumAbsGap / count, maxGap, minGap, maxAbsGap,
    worstRegressions: regressions.slice(0, 3), bestImprovements: improvements.slice(0, 3),
    scope: 'Verified shortlist loss minus the declared solver chosen loss under the same declared objective. Negative is better. Distils the declared solver only; NOT native CS2 evidence.',
  };
}
