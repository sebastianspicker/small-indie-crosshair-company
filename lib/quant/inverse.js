/** Certified finite-domain geometry inverse. Visual refinement is a separate objective. */
import { getModel, Q, scaleOf, targetGeometry, forward } from './renderer.js';

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
