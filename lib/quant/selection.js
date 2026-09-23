import { MODELS, DEFAULT_ID, getModel, forward, nativeKey } from './renderer.js';
import { neighbors } from './visual.js';

function agreementByScale(scores, weights) {
  return ['authored', 'reference1080', 'reference720'].map(scale => {
    let total = 0, exact = 0;
    MODELS.forEach((model, i) => {
      if (model.scale !== scale) return;
      total += weights[i];
      if (scores[i].iou === 1 && !scores[i].cropped) exact += weights[i];
    });
    return total ? exact / total : 0;
  });
}

function evaluate(native, state, height, visual) {
  const scores = MODELS.map(m => visual.score(forward(native, height, m)));
  const weighted = fn => scores.reduce((sum, score, i) => sum + fn(score) * state.weights[i], 0);
  const scaleAgreement = agreementByScale(scores, state.weights);
  return { native, scores, proposedBy: [],
    exactMass: weighted(s => Number(s.iou === 1 && !s.cropped)),
    expectedIou: weighted(s => s.iou ?? 0), expectedLoss: weighted(s => s.loss),
    worstCaseLoss: Math.max(...scores.map(s => s.loss)),
    priorSensitivity: [Math.min(...scaleAgreement), Math.max(...scaleAgreement)] };
}

function comparator(decision) {
  const key = decision === 'worst' ? 'worstCaseLoss' : 'expectedLoss';
  return (a, b) => a[key] - b[key] || a.expectedLoss - b.expectedLoss || b.exactMass - a.exactMass ||
    a.native.length - b.native.length || a.native.thickness - b.native.thickness || a.native.gap - b.native.gap;
}

export function selectRenderer(id, state) {
  if (id) return getModel(id);
  const maximum = Math.max(...state.weights), reference = getModel(DEFAULT_ID);
  if (Math.abs(state.weights[MODELS.indexOf(reference)] - maximum) < 1e-12) return reference;
  return MODELS[state.weights.indexOf(maximum)];
}

/** Decision search uses the declared loss. It does not update the hypothesis likelihood. */
export function rankCandidates(proposals, state, height, visual, decision = 'expected', refine = true) {
  if (!['expected', 'worst'].includes(decision)) throw new Error('Unknown decision rule.');
  const pool = new Map(), compare = comparator(decision), trace = [];
  function score(native) {
    const key = nativeKey(native);
    if (!pool.has(key)) pool.set(key, evaluate(native, state, height, visual));
    return pool.get(key);
  }
  for (const proposal of proposals) score(proposal.native).proposedBy.push(proposal.id);
  let best = [...pool.values()].sort(compare)[0];
  trace.push({ pass: 0, native: { ...best.native }, expectedLoss: best.expectedLoss, worstCaseLoss: best.worstCaseLoss });
  let probed = false;
  for (let pass = 1; refine && pass <= 2; pass++) {
    const before = best;
    for (const n of neighbors(best.native, proposals[0].preserveZero)) {
      const candidate = score(n);
      if (compare(candidate, best) < 0) best = candidate;
    }
    const localStagnation = nativeKey(before.native) === nativeKey(best.native);
    // Probe beyond a one-cell quantization plateau only after the ordinary local
    // pass would stop. The old trajectory stays in the pool and cannot regress.
    if (!probed && (localStagnation || pass === 2)) {
      probed = true;
      const probeOrigin = best.native;
      for (const delta of [-2, 2]) {
        const length = probeOrigin.length + delta;
        if (length < 0 || length > 255) continue;
        const candidate = score({ ...probeOrigin, length });
        if (compare(candidate, best) < 0) best = candidate;
      }
    }
    trace.push({ pass, native: { ...best.native }, expectedLoss: best.expectedLoss, worstCaseLoss: best.worstCaseLoss });
    if (nativeKey(before.native) === nativeKey(best.native)) break;
  }
  const candidates = [...pool.values()].sort(compare);
  return { candidates, decisionTrace: trace, byKey: pool, decision };
}

/** Keep the selected model's own trace: deduplication must not overwrite provenance. */
export function chosenCandidate(ranked, proposals, renderer, manual) {
  const proposal = proposals.find(p => p.id === renderer.id);
  const rankedChoice = manual ? ranked.byKey.get(nativeKey(proposal.native)) : ranked.candidates[0];
  const ownPath = nativeKey(proposal.native) === nativeKey(rankedChoice.native) ? proposal : null;
  return { ...rankedChoice, scores: undefined,
    trace: ownPath?.trace ?? ranked.decisionTrace.map(p => ({ ...p, reason: 'cross-scenario decision refinement' })),
    inverseCertificate: ownPath?.inverseCertificate ?? null,
    traceModelId: ownPath?.id ?? 'cross-scenario-decision', refined: Boolean(ownPath?.refined),
    solutions: ownPath?.solutions ?? null };
}
