import { compileShape, compileMask, compareShapes, outsideFrame } from '../geometry/pixel-shape.js';
import { forward, geometryError, geometryKey, nativeKey } from './renderer.js';
import { RASTER_CONVENTION } from '../geometry/raster.js';

/** Freeze the target once. No dense per-candidate raster allocation. */
export function visualContext(target, settings, externalMask = null) {
  const reference = externalMask ? compileMask(externalMask) : compileShape(target, settings);
  const cache = new Map();
  function score(geometry) {
    const key = geometryKey(geometry);
    if (cache.has(key)) return cache.get(key);
    const shape = compileShape(geometry, settings), metric = compareShapes(shape, reference);
    const cropped = Boolean(externalMask && (externalMask.cropped || outsideFrame(shape, externalMask.side)));
    const geometryLoss = geometryError(geometry, target);
    const loss = cropped ? 1 + Math.min(10, geometryLoss / 100) : metric.emptyAgreement ? 0 : 1 - metric.iou;
    const value = { ...metric, iou: cropped ? null : metric.iou, cropped, geometryLoss, loss };
    cache.set(key, value);
    return value;
  }
  return { score, size: () => cache.size, targetArea: reference.area,
    targetMask: { cropped: Boolean(externalMask?.cropped) }, previewCropped: outsideFrame(reference, 161),
    engine: `exact-integer-cell-union-v1/${RASTER_CONVENTION}` };
}

export function neighbors(native, preserveZero = false) {
  const result = [];
  for (const dl of [-1, 0, 1]) for (const dt of [-1, 0, 1]) for (const dg of [-1, 0, 1]) {
    const n = { ...native, length: native.length + dl, thickness: native.thickness + dt, gap: native.gap + dg };
    if (!(dl || dt || dg) || (preserveZero && n.thickness !== 0)) continue;
    if (n.length < 0 || n.length > 255 || n.thickness < 0 || n.thickness > 31 || n.gap < 0 || n.gap > 128) continue;
    result.push(n);
  }
  return result;
}

function improves(a, b) {
  return a.loss < b.loss - 1e-12 || (Math.abs(a.loss - b.loss) <= 1e-12 && a.geometryLoss < b.geometryLoss);
}

function point(pass, native, score, reason) { return { pass, native: { ...native }, iou: score.iou, loss: score.loss, reason }; }

/** Certified geometry initialization, followed by bounded visual (not statistical) refinement. */
export function refineVisual(candidate, model, height, visual, maxPasses = 2) {
  let native = candidate.native, predicted = forward(native, height, model), score = visual.score(predicted);
  const trace = [point(0, native, score, 'global finite-domain geometry inverse')];
  let evaluations = 1;
  for (let pass = 1; pass <= Math.min(3, maxPasses) && score.loss > 0; pass++) {
    let best = { native, predicted, score };
    for (const n of neighbors(native, candidate.preserveZero)) {
      const g = forward(n, height, model), s = visual.score(g);
      evaluations++;
      if (improves(s, best.score)) best = { native: n, predicted: g, score: s };
    }
    const stopped = nativeKey(native) === nativeKey(best.native);
    ({ native, predicted, score } = best);
    trace.push(point(pass, native, score, stopped ? 'stagnation; target unchanged' : 'improved frozen-target visual fit'));
    if (stopped) break;
  }
  return { ...candidate, native, predicted, visual: score, trace, evaluations,
    refined: nativeKey(native) !== nativeKey(candidate.native) };
}
