#!/usr/bin/env node
/** Behavioural partition of the 27-model family over the declared default sample. */
import { writeFile, mkdir } from 'node:fs/promises';
import { equivalenceGroups, defaultDomain } from '../lib/quant/partition.js';

const domain = defaultDomain();
const result = equivalenceGroups(domain);
const cells = result.domain.natives * result.domain.heights.length;
const merged = result.groups.filter(group => group.members.length > 1);
const payload = {
    schema: 'sicc-model-partition-v1',
    domain: result.domain,
    distinct: result.distinct,
    total: result.total,
    groups: result.groups,
    pairsChecked: result.total * (result.total - 1) / 2,
    scope: 'Behavioural equivalence over a declared finite sample of the legal settings. Two models are '
        + 'called indistinguishable here when they render the same geometry on every sampled cell. Equal '
        + 'geometry on the sample is not a proof over all real-valued settings, and the partition makes no '
        + 'claim about which hypothesis the native game uses.',
};
const root = new URL('../', import.meta.url);
await mkdir(new URL('research/generated/', root), { recursive: true });
await writeFile(new URL('research/generated/model-partition.json', root), JSON.stringify(payload, null, 2) + '\n');
console.log(`domain: ${result.domain.natives} native tuples x ${result.domain.heights.length} heights = ${cells} cells per model`);
console.log(`distinct behavioural classes: ${result.distinct} / ${result.total}`);
console.log(`ordered pairs resolved: ${payload.pairsChecked}`);
if (merged.length) {
    for (const group of merged) {
        const w = group.witness;
        const at = w ? ` witness length=${w.native.length} thickness=${w.native.thickness} gap=${w.native.gap} authored=${w.native.authoredHeight} height=${w.height}` : ' no witness';
        console.log(`  group [${group.members.join(', ')}]${at}`);
    }
} else {
    console.log('  no multi-member groups: every model is behaviourally distinct on this sample');
}
console.log('scope: finite sampled domain only; not an exhaustive proof over all real-valued settings and not native game evidence.');
