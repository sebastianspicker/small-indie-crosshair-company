#!/usr/bin/env node
/**
 * Offline structural study for the v0.4 gap-scale rival.
 *
 * Scores the 24-hypothesis reduced family on the existing historical input corpus and
 * records how often `same-as-length` and `unscaled` gap disagree on the predicted near
 * edge. Comparisons are bucketed so the non-identifying case is exact:
 *
 *   sameHeightAuthored   lengthRef "authored", currentHeight === authoredHeight  (length ratio 1)
 *   crossHeightAuthored  lengthRef "authored", currentHeight !== authoredHeight  (length ratio != 1)
 *   sameHeightFixedRef   lengthRef "1080"|"720", currentHeight === authoredHeight
 *   crossHeightFixedRef  lengthRef "1080"|"720", currentHeight !== authoredHeight
 *
 * A fixed reference still scales when currentHeight === authoredHeight, so only the
 * `authored` same-height bucket is guaranteed zero. `zeroWhenRatioIsOne` checks the
 * general invariant across every comparison.
 *
 * This is a disagreement census, not a vote for either family and not native evidence.
 * It never runs CS2. See docs/engineering/v0.4-conversion-improvement-plan.md §3.3.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { invertStructural, structuralForward, enumerateReducedFamily, DEFAULT_PHI } from '../lib/quant/structural.js';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const records = await read('data/corpus.json');
const meta = await read('data/corpus-meta.json');
const family = enumerateReducedFamily();
const referenceOf = lengthRef => lengthRef === 'authored' ? null : Number(lengthRef);

const buckets = {
  sameHeightAuthored: { cells: 0, comparisons: 0, disagreements: 0, examples: [] },
  crossHeightAuthored: { cells: 0, comparisons: 0, disagreements: 0, examples: [] },
  sameHeightFixedRef: { cells: 0, comparisons: 0, disagreements: 0, examples: [] },
  crossHeightFixedRef: { cells: 0, comparisons: 0, disagreements: 0, examples: [] },
};
let comparisonsAtRatioOne = 0, disagreementsAtRatioOne = 0, eligible = 0;

for (const record of records) {
  if (record.style !== 4 || record.weapon_gap) continue;
  eligible++;
  for (const height of meta.heights) {
    // A = current height is the non-identifying case; A = 1080 with H != 1080 is the
    // discriminating case. Do not double-count A = H.
    const authoredHeights = height === 1080 ? [1080] : [height, 1080];
    for (const authoredHeight of authoredHeights) {
      const same = authoredHeight === height;
      const options = { oldHeight: height, currentHeight: height, authoredHeight, goal: 'pixels' };
      const byLengthRef = new Map();
      // Count this cell once in each lengthRef bucket it contributes comparisons to.
      for (const lengthRef of ['authored', '1080', '720'])
        buckets[lengthRef === 'authored' ? (same ? 'sameHeightAuthored' : 'crossHeightAuthored') : (same ? 'sameHeightFixedRef' : 'crossHeightFixedRef')].cells++;
      for (const phi of family) {
        const result = invertStructural(record, options, phi);
        const key = [phi.lengthRef, phi.quantLength, phi.gapBase].join('|');
        const store = (byLengthRef.get(`near:${key}`) ?? {});
        store[phi.gapScale] = result.predicted.near;
        byLengthRef.set(`near:${key}`, store);
      }
      for (const [key, entry] of byLengthRef) {
        if (!key.startsWith('near:')) continue;
        const [lengthRef] = key.slice(5).split('|');
        const bucket = buckets[lengthRef === 'authored' ? (same ? 'sameHeightAuthored' : 'crossHeightAuthored') : (same ? 'sameHeightFixedRef' : 'crossHeightFixedRef')];
        bucket.comparisons++;
        const reference = referenceOf(lengthRef);
        const ratio = height / (reference ?? authoredHeight);
        const equal = entry['same-as-length'] === entry.unscaled;
        if (ratio === 1) { comparisonsAtRatioOne++; if (!equal) disagreementsAtRatioOne++; }
        if (equal) continue;
        bucket.disagreements++;
        bucket.examples.push({ pair: key.slice(5), record: record.id, player: record.player, height, authoredHeight, ratio,
          scaledNear: entry['same-as-length'], unscaledNear: entry.unscaled });
      }
    }
  }
}

const stored = { length: 9, thickness: 2, gap: 1, authoredHeight: 1080 };
const edge = geometry => ({ length: geometry.length, width: geometry.width, near: geometry.near, far: geometry.far });
const discriminatingExample = {
  role: 'synthetic-disagreement',
  stored, currentHeight: 2160,
  sameAsLength: edge(structuralForward(stored, 2160, { ...DEFAULT_PHI, gapScale: 'same-as-length' })),
  unscaled: edge(structuralForward(stored, 2160, { ...DEFAULT_PHI, gapScale: 'unscaled' })),
  note: 'Synthetic fixture from the v0.4 plan §2.6. Not a game capture and not a native observation.',
};

const trimmed = Object.fromEntries(Object.entries(buckets).map(([name, b]) => [name, { ...b, examples: b.examples.slice(0, 5) }]));
// Literal grouping the plan names, then the exact invariant that a wrong r_G would break.
const aggregate = names => ({ cells: names.reduce((n, name) => n + buckets[name].cells, 0),
  comparisons: names.reduce((n, name) => n + buckets[name].comparisons, 0),
  disagreements: names.reduce((n, name) => n + buckets[name].disagreements, 0) });
// The top-level sameHeight/crossHeight MUST be the authored-reference buckets only. A
// fixed reference (1080/720) still scales when currentHeight === authoredHeight, so those
// comparisons are not the guaranteed-zero case and live under the *IncludingFixedReference
// names instead. Do not "fix" r_G because a combined group is non-zero.
const sameHeight = { ...trimmed.sameHeightAuthored };
const crossHeight = { ...trimmed.crossHeightAuthored };
const sameHeightIncludingFixedReference = { ...aggregate(['sameHeightAuthored', 'sameHeightFixedRef']),
  note: 'Includes fixed-reference hypotheses (1080/720) that keep scaling even when currentHeight === authoredHeight, so this grouped count is not the guaranteed-zero case; see sameHeight.' };
const crossHeightIncludingFixedReference = aggregate(['crossHeightAuthored', 'crossHeightFixedRef']);
const artifact = {
  version: 'structural-study-v1',
  nativeEvidence: false,
  build: '2000914',
  reducedHypotheses: family.length,
  eligibleRecords: eligible,
  heights: meta.heights,
  authoredHeightsProbed: [1080, ...meta.heights],
  // Grouped by whether currentHeight === authoredHeight, as the plan asks.
  sameHeight,
  crossHeight,
  sameHeightIncludingFixedReference,
  crossHeightIncludingFixedReference,
  buckets: trimmed,
  // The one exact invariant: at length ratio 1 the two gap scales cannot differ. A bug in
  // r_G would break this. The *IncludingFixedReference groups also contain fixed-reference
  // hypotheses (1080/720), which keep scaling at H === A, so they are not the zero group.
  zeroWhenRatioIsOne: comparisonsAtRatioOne > 0 && disagreementsAtRatioOne === 0,
  comparisonsAtRatioOne,
  disagreementsAtRatioOne,
  discriminatingExample,
  interpretation: 'A disagreement census under the declared structural family. It neither selects a gap scale nor measures CS2. Agreement at length ratio 1 is non-identifying; the cross-height varied-reference buckets are where a native capture could separate the families.',
};

await mkdir(new URL('research/generated/', root), { recursive: true });
await writeFile(new URL('research/generated/structural-disagreement.json', root), JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify({ eligibleRecords: eligible, hypotheses: family.length,
  zeroWhenRatioIsOne: artifact.zeroWhenRatioIsOne, comparisonsAtRatioOne, disagreementsAtRatioOne,
  sameHeight, crossHeight, sameHeightAuthored: { comparisons: buckets.sameHeightAuthored.comparisons, disagreements: buckets.sameHeightAuthored.disagreements } }, null, 2));
