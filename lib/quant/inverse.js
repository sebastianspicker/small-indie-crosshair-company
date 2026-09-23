/** Certified finite-domain geometry inverse. Visual refinement is a separate objective. */
import { getModel, MODELS, Q, scaleOf, targetGeometry, forward } from './renderer.js';

export function bestInteger(max, ideal, loss) {
  let best = { value: 0, loss: Infinity, tie: Infinity };
  const equivalents = [];
  for (let value = 0; value <= max; value++) {
    const error = loss(value), tie = Math.abs(value - ideal);
    if (error < best.loss) equivalents.length = 0;
    if (error <= best.loss) equivalents.push(value);
    if (error < best.loss || (error === best.loss && tie < best.tie))
      best = { value, loss: error, tie };
  }
  return { ...best, ideal, idealInRange: ideal >= 0 && ideal <= max, equivalents };
}

function gapBranch(target, width, ratio, model) {
  const base = { thickness: Math.floor(width / 2), center: 0, opening: -.5 }[model.gap];
  const slope = model.gap === 'opening' ? .5 : 1;
  // Both edges matter. Their least-squares midpoint is NOT always target.near.
  const center = (target.near + target.far - 1) / 2;
  const ideal = target.length ? (center - base) / (slope * ratio) : 0;
  const nearAt = v => base + slope * Q(v * ratio, model.rounding);
  return bestInteger(128, ideal, v => {
    if (!target.length) return 0;
    const near = nearAt(v);
    return (near - target.near) ** 2 + (near + 1 - target.far) ** 2;
  });
}

function betterJoint(candidate, best) {
  if (!best) return true;
  if (candidate.loss !== best.loss) return candidate.loss < best.loss;
  return candidate.preference < best.preference;
}

/** Inputs come from targetGeometry. Exhaust all thickness branches, not just the closest width. */
export function solveTarget(settings, options, model, target, legacy, measured = false) {
  const m = getModel(model.id), r = scaleOf(m, options.currentHeight, options.authoredHeight);
  const length = bestInteger(255, target.length / r, v => (Q(v * r, m.rounding) - target.length) ** 2);
  const preserveZero = settings.thickness === 0 && !measured;
  const widths = preserveZero ? [0] : Array.from({ length: 32 }, (_, i) => i);
  const gapCache = new Map();
  let best = null;
  for (const value of widths) {
    const width = Math.max(1, Q(value * r, m.rounding));
    if (!gapCache.has(width)) gapCache.set(width, gapBranch(target, width, r, m));
    const gap = gapCache.get(width), ideal = preserveZero ? 0 : target.width / r;
    const thickness = { value, ideal, loss: (width - target.width) ** 2,
      tie: Math.abs(value - ideal), idealInRange: ideal >= 0 && ideal <= 31 };
    const candidate = { thickness, gap, loss: thickness.loss + gap.loss, preference: thickness.tie + gap.tie };
    if (betterJoint(candidate, best)) best = candidate;
  }
  const { thickness, gap } = best;
  const native = { length: length.value, thickness: thickness.value, gap: gap.value, authoredHeight: options.authoredHeight };
  const predicted = forward(native, options.currentHeight, m);
  return { id: m.id, native, predicted, target, legacy, options, preserveZero,
    solutions: { length, thickness, gap }, proposedBy: [m.id],
    inverseCertificate: { stage: 'initial-geometry-inverse', native: { ...native }, predicted: { ...predicted }, objective: 'Squared length + width + both-edge residuals', globalGeometryMinimum: length.loss + best.loss,
      exhaustiveThicknessBranches: widths.length, gapBranches: gapCache.size,
      scope: 'Global minimum of declared geometry objective on the integer domain; NOT global visual optimality or native correctness.' } };
}

export function solveInverse(settings, options, model, measured = null) {
  const { legacy, target, options: o } = targetGeometry(settings, options, measured);
  return solveTarget(settings, o, model, target, legacy, measured !== null);
}

/** Compress a selection into contiguous [lo,hi] runs. Values are booleans (indexed) or sorted integers. */
function runs(values) {
  const out = [];
  if (!values.length) return out;
  if (typeof values[0] === 'boolean') {
    let start = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i]) { if (start < 0) start = i; }
      else if (start >= 0) { out.push([start, i - 1]); start = -1; }
    }
    if (start >= 0) out.push([start, values.length - 1]);
    return out;
  }
  let lo = values[0], hi = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] === hi + 1) { hi = values[i]; continue; }
    out.push([lo, hi]); lo = hi = values[i];
  }
  out.push([lo, hi]);
  return out;
}

const intervalSize = intervals => intervals.reduce((n, [lo, hi]) => n + hi - lo + 1, 0);

/** Deterministic length asc, then thickness asc, then gap asc, capped at `cap` tuples. */
function preimageSample(byThickness, cap, authoredHeight) {
  const out = [];
  if (!byThickness.length) return out;
  for (const [lo, hi] of byThickness[0].lengths) for (let length = lo; length <= hi; length++)
    for (const entry of byThickness) for (const [glo, ghi] of entry.gaps) for (let gap = glo; gap <= ghi; gap++) {
      out.push({ length, thickness: entry.thickness, gap, authoredHeight });
      if (out.length === cap) return out;
    }
  return out;
}

const PREIMAGE_SCOPE = 'Complete finite preimage of the declared target: every legal integer (length, thickness, gap) whose forward geometry matches the objective terms (length and width always; near/far only when target length > 0). Exact on the declared integer domain under one renderer hypothesis; not native validation.';

/**
 * Complete set of legal integer natives that forward-render EXACTLY to the target geometry.
 * Rendering is many-to-one and quantised, so the preimage is a union of integer boxes, not one
 * tuple: solveTarget returns one minimum per model, this returns the whole equivalence class.
 * Derived directly from forward() in renderer.js (see docs/math/02 and 09).
 */
export function exactPreimage({ settings, options = {}, model, preserveZero = false }) {
  const m = getModel(model.id ?? model);
  const { target, options: o } = targetGeometry(settings, options);
  const r = scaleOf(m, o.currentHeight, o.authoredHeight);
  const constrainedNearFar = target.length !== 0;
  const lengthFlags = [];
  for (let v = 0; v <= 255; v++) lengthFlags.push(Q(v * r, m.rounding) === target.length);
  const lengths = runs(lengthFlags);
  const thicknesses = preserveZero ? [0] : Array.from({ length: 32 }, (_, i) => i);
  const byThickness = [];
  let count = 0;
  for (const thickness of thicknesses) {
    const width = Math.max(1, Q(thickness * r, m.rounding));
    if (width !== target.width) continue;
    let gaps;
    if (!constrainedNearFar) gaps = [[0, 128]];
    else if (target.far !== target.near + 1) gaps = [];
    else {
      // forward(): near = floor(width/2)+p (thickness), p (center), (p-1)/2 (opening).
      const required = m.gap === 'thickness' ? target.near - Math.floor(width / 2)
        : m.gap === 'center' ? target.near : 2 * target.near + 1;
      const flags = [];
      for (let g = 0; g <= 128; g++) flags.push(Q(g * r, m.rounding) === required);
      gaps = runs(flags);
    }
    byThickness.push({ thickness, width, lengths, gaps });
    count += intervalSize(lengths) * intervalSize(gaps);
  }
  return { complete: true, model: m.id, target, constrainedNearFar, byThickness, count,
    sample: preimageSample(byThickness, 64, o.authoredHeight), scope: PREIMAGE_SCOPE };
}

/** Convenience: exactPreimage for every declared renderer hypothesis, in MODELS order. */
export function exactPreimageForAll(settings, options = {}, preserveZero = false) {
  return MODELS.map(model => exactPreimage({ settings, options, model, preserveZero }));
}
