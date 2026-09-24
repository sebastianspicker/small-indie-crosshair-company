/**
 * Behavioural parsimony for the 27-model family.
 * Two renderer hypotheses are observationally equivalent on a declared domain
 * when they produce the same {length,width,near,far} geometry on every sampled
 * cell. This partitions a finite sample of legal settings; it is not a proof
 * over all real-valued settings, and it says nothing about which hypothesis the
 * game actually uses.
 */
import { MODELS, forward, geometryKey, getModel } from '../../lib/solver/renderer.js';

export const DEFAULT_LENGTHS = Object.freeze([...Array(256).keys()]);
export const DEFAULT_THICKNESSES = Object.freeze([0, 1, 2, 3, 5]);
export const DEFAULT_GAPS = Object.freeze([0, 1, 2, 3, 4, 7, 16, 64, 128]);
export const DEFAULT_AUTHORED_HEIGHTS = Object.freeze([720, 1080, 2160]);
export const DEFAULT_HEIGHTS = Object.freeze([720, 768, 960, 1080, 1440, 2160]);
export const DEFAULT_DESCRIPTION = 'SAMPLED domain: length 0..255 (all integers), thickness {0,1,2,3,5}, '
    + 'gap {0,1,2,3,4,7,16,64,128}, authoredHeight {720,1080,2160}, render height {720,768,960,1080,1440,2160}; '
    + 'every native tuple is rendered at every height. This is a finite sample of the legal integer settings, '
    + 'not an exhaustive proof over all real-valued settings or an observation of the native game.';

const asModel = model => typeof model === 'string' ? getModel(model) : model;

/** Rendered geometry signature of one model on one cell. */
export function geometrySignature(model, native, height) {
    return geometryKey(forward(native, height, asModel(model)));
}

/** Ordered per-model signatures on one cell; index-aligned with `models`. */
export function vectorSignature(models, native, height) {
    return models.map(model => geometrySignature(model, native, height));
}

function firstDifferingCell(a, b, natives, heights) {
    for (const native of natives)
        for (const height of heights)
            if (geometrySignature(a, native, height) !== geometrySignature(b, native, height))
                return { native, height };
    return null;
}

// Two independent 32-bit lanes. A shared hash only proposes a candidate class;
// multi-member buckets are confirmed against the exact ordered vector below.
const FNV_PRIME = 16777619;
function domainHash(model, natives, heights) {
    let h1 = 0x811c9dc5, h2 = 0x9e3779b1;
    for (const native of natives)
        for (const height of heights) {
            const key = geometrySignature(model, native, height);
            for (let i = 0; i < key.length; i++) {
                const c = key.charCodeAt(i);
                h1 = Math.imul(h1 ^ c, FNV_PRIME);
                h2 = Math.imul(h2 ^ c, 0x85ebca6b);
            }
            h1 = Math.imul(h1 ^ 0x2f, FNV_PRIME);
            h2 = Math.imul(h2 ^ 0x5f, 0x85ebca6b);
        }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Exact ordered domain vector for one model. Only called for candidate classes. */
function exactVector(model, natives, heights) {
    const parts = [];
    for (const native of natives)
        for (const height of heights)
            parts.push(geometrySignature(model, native, height));
    return parts.join('|');
}

function nearestOutside(group, models) {
    const inside = new Set(group);
    const anchor = models.findIndex(model => model.id === group[0]);
    let best = null, bestDistance = Infinity;
    models.forEach((model, index) => {
        if (inside.has(model.id)) return;
        const distance = Math.abs(index - anchor);
        if (distance < bestDistance) { bestDistance = distance; best = model; }
    });
    return best;
}

function witnessFor(group, models, natives, heights) {
    const first = { native: natives[0], height: heights[0] };
    if (group.length === 1) return first;
    // A multi-member witness should separate the class from its closest model,
    // so the coincidence is visible rather than merely asserted. Best effort.
    const outside = nearestOutside(group, models);
    if (!outside) return first;
    return firstDifferingCell(group[0], outside, natives, heights) ?? first;
}

/**
 * Partition `models` by their exact behaviour over `natives` × `heights`.
 * The hash keeps memory bounded; only candidate classes are materialised.
 */
export function equivalenceGroups({ natives, heights, models = MODELS, description } = {}) {
    if (!Array.isArray(natives) || !Array.isArray(heights))
        throw new TypeError('A domain needs native tuples and heights.');
    const byId = new Map(models.map(model => [model.id, model]));
    const buckets = new Map();
    for (const model of models) {
        const hash = domainHash(model, natives, heights);
        if (!buckets.has(hash)) buckets.set(hash, []);
        buckets.get(hash).push(model.id);
    }
    const classes = [];
    for (const bucket of buckets.values()) {
        if (bucket.length === 1) { classes.push(bucket); continue; }
        const exact = new Map();
        for (const id of bucket) {
            const key = exactVector(byId.get(id), natives, heights);
            if (!exact.has(key)) exact.set(key, []);
            exact.get(key).push(id);
        }
        classes.push(...exact.values());
    }
    const order = new Map(models.map((model, index) => [model.id, index]));
    classes.sort((a, b) => order.get(a[0]) - order.get(b[0]));
    const empty = natives.length === 0 || heights.length === 0;
    const groups = classes.map(members => ({
        id: members[0],
        members: [...members],
        witness: empty ? null : witnessFor(members, models, natives, heights),
    }));
    return {
        distinct: groups.length,
        total: models.length,
        domain: { natives: natives.length, heights: [...heights], description: description ?? DEFAULT_DESCRIPTION },
        groups,
    };
}

/** True when both models render identically on every sampled cell. */
export function areEquivalent(a, b, { natives, heights } = {}) {
    return firstDifferingCell(asModel(a), asModel(b), natives, heights) === null;
}

/** First sampled cell where the models differ, or null when equivalent here. */
export function differenceWitness(a, b, { natives, heights } = {}) {
    return firstDifferingCell(asModel(a), asModel(b), natives, heights);
}

/** Deterministic, bounded default sample of the declared legal settings. */
export function defaultDomain() {
    const natives = [];
    for (const length of DEFAULT_LENGTHS)
        for (const thickness of DEFAULT_THICKNESSES)
            for (const gap of DEFAULT_GAPS)
                for (const authoredHeight of DEFAULT_AUTHORED_HEIGHTS)
                    natives.push({ length, thickness, gap, authoredHeight });
    return { natives, heights: [...DEFAULT_HEIGHTS], description: DEFAULT_DESCRIPTION };
}
