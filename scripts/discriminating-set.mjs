#!/usr/bin/env node
// W6: smallest synthetic capture set that separates the declared 27 forward hypotheses.
// It is a capture PLAN, not native evidence. See docs/math/03 and docs/math/06.
import { mkdir, writeFile } from 'node:fs/promises';
import { MODELS } from '../lib/quant/renderer.js';
import { posterior } from '../lib/quant/evidence.js';
import { discriminatingSet, candidateDesigns } from '../lib/quant/experiments.js';

const root = new URL('../', import.meta.url);
const scope = 'Synthetic prediction partitions of the declared 27-hypothesis family under a uniform prior. These are a capture PLAN, not measurements: perfect synthetic separation does not prove native correctness, and renderers outside the family are not considered.';
const state = posterior();
const maxSize = MODELS.length;
const allPairs = MODELS.length * (MODELS.length - 1) / 2;
const ids = partition => partition.map(group => group.map(i => MODELS[i].id));

let result = null, smallest = null;
for (let size = 1; size <= maxSize; size++) {
  result = discriminatingSet({ state, size });
  if (result.separatesAll) { smallest = size; break; }
}
// If the finite grid cannot separate every weighted pair, disclose the leftover instead of claiming success.
if (!result.separatesAll) result = discriminatingSet({ state, size: maxSize });

const designs = result.designs.map((design, k) => ({
  order: k + 1,
  native: design.native,
  currentHeight: design.currentHeight,
  separatedPairs: design.separatedPairs,
  newlyCoveredPairs: design.coveredPairs,
  newWeightedCoverage: design.newWeightedCoverage,
  outcomes: design.outcomes,
  groups: ids(design.partition),
}));

const report = {
  schema: 'sicc-discriminating-set-v1',
  prior: { mode: state.mode, entropyBits: state.entropyBits, weights: state.weights },
  modelCount: MODELS.length,
  totalPairs: allPairs,
  weightedTotal: result.weightedTotal,
  weightedCovered: result.weightedCovered,
  smallestSeparatingSize: smallest,
  sizeUsed: result.size,
  separatesAll: result.separatesAll,
  unseparatedPairs: result.unseparatedPairs,
  candidateCount: candidateDesigns().length,
  designs,
  scope,
};
await mkdir(new URL('research/generated/', root), { recursive: true });
await writeFile(new URL('research/generated/discriminating-set.json', root), JSON.stringify(report, null, 2) + '\n');

console.log(`Discriminating capture plan: ${result.size} design(s) separate ${result.separatesAll ? allPairs : report.designs.reduce((n, d) => n + d.newlyCoveredPairs, 0)}/${allPairs} weighted model pairs (smallest separating size: ${smallest ?? 'not reached on this grid'}).`);
if (!result.separatesAll) console.log(`Honest leftover: ${result.unseparatedPairs.length} pair(s) the declared grid never separates, e.g. ${result.unseparatedPairs.slice(0, 3).map(p => p.models.join(' vs ')).join('; ')}.`);
console.log('For each design capture the crosshair at the given current resolution and read the outlined-core geometry:');
for (const design of designs) {
  console.log(`\n${design.order}. length ${design.native.length}, thickness ${design.native.thickness}, gap ${design.native.gap}, authoredHeight ${design.native.authoredHeight} @ currentHeight ${design.currentHeight}`);
  console.log(`   separates ${design.separatedPairs}/${allPairs} pairs this design alone; adds ${design.newlyCoveredPairs} new; ${design.outcomes} distinct predicted outcome(s).`);
  for (const group of design.groups) console.log(`     - ${group.join(', ')}`);
}
console.log(`\nWrote research/generated/discriminating-set.json. Scope: ${scope}`);
