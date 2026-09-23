import { MODELS, forward, geometryKey } from './renderer.js';
import { entropy } from './statistics.js';
let designs;
function makeDesigns() {
  const result = [];
  for (const currentHeight of [768, 960, 1080, 1440]) for (const authoredHeight of [720, 960, 1080]) for (const gap of [0, 1, 3, 7]) {
    const native = { length: 5, thickness: 3, gap, authoredHeight }, groups = new Map();
    MODELS.forEach((m, i) => {
      const key = geometryKey(forward(native, currentHeight, m));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    result.push({ native, currentHeight, groups: [...groups.values()] });
  }
  return result;
}

/** Noiseless prediction partitions, not noisy expected information gain. */
export function proposeExperiment(state) {
  designs ??= makeDesigns();
  let best = null;
  for (const design of designs) {
    const weights = design.groups.map(group => group.reduce((sum, i) => sum + state.weights[i], 0));
    const candidate = { native: { ...design.native }, currentHeight: design.currentHeight, disagreementBits: entropy(weights), outcomes: weights.length };
    if (!best || candidate.disagreementBits > best.disagreementBits + 1e-12) best = candidate;
  }
  return best;
}
