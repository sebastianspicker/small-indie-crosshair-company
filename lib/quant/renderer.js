/** Competing forward renderers, not recovered Valve code. See docs/math/05-model-families.md. */
import { legacyGeometry } from '../legacy.js';
import { validateNative } from '../native-settings.js';
import { height as validateHeight, finite } from '../validation.js';
export const VERSION = 'quant-static-v5';
export const BUILD = '2000914';
export const SCALES = ['authored', 'reference1080', 'reference720'];
export const ROUNDING = ['trunc', 'nearest', 'ceil'];
export const GAPS = ['thickness', 'center', 'opening'];
export const MODELS = Object.freeze(SCALES.flatMap(scale => ROUNDING.flatMap(rounding => GAPS.map(gap => Object.freeze({ id: `${scale}:${rounding}:${gap}`, scale, rounding, gap })))));
const MODEL_BY_ID = new Map(MODELS.map(model => [model.id, model]));
export const DEFAULT_ID = 'authored:trunc:thickness';
export const Q = (x, rule) => rule === 'nearest' ? Math.floor(x + .5) : rule === 'ceil' ? Math.ceil(x) : Math.trunc(x);
export function getModel(id) { const m = MODEL_BY_ID.get(id); if (!m)
    throw new Error('Unknown renderer hypothesis.'); return m; }
function scaleForKnownModel(model, height, authoredHeight) {
    return height / ({ authored: authoredHeight, reference1080: 1080, reference720: 720 }[model.scale]);
}
export function scaleOf(m, height, authoredHeight) { return scaleForKnownModel(getModel(m.id), height, authoredHeight); }
export function forward(native, height, m) {
    validateNative(native);
    validateHeight(height);
    m = getModel(m.id);
    const r = scaleForKnownModel(m, height, native.authoredHeight);
    const length = Q(native.length * r, m.rounding), width = Math.max(1, Q(native.thickness * r, m.rounding));
    const p = Q(native.gap * r, m.rounding);
    const near = m.gap === 'thickness' ? Math.floor(width / 2) + p : m.gap === 'center' ? p : (p - 1) / 2;
    return { length, width, near, far: near + 1, interval: length ? 2 * near + 1 : null, scale: r, model: m.id, minimumBranch: native.thickness === 0 };
}
export function scope(options = {}) {
    const oldHeight = options.oldHeight ?? 1080, currentHeight = options.currentHeight ?? oldHeight, authoredHeight = options.authoredHeight ?? currentHeight;
    [oldHeight, currentHeight, authoredHeight].forEach(validateHeight);
    const goal = options.goal ?? 'pixels';
    if (!['pixels', 'screen'].includes(goal))
        throw new Error('Unknown comparison goal.');
    return { oldHeight, currentHeight, authoredHeight, goal };
}
export function targetGeometry(settings, options = {}, measured = null) {
    const o = scope(options), legacy = legacyGeometry(settings, o.oldHeight), source = measured ?? legacy;
    for (const k of ['length', 'width', 'near', 'far'])
        finite(source[k], `Target ${k}`, -1024, 100000);
    if (source.length < 0 || source.width < 1)
        throw new Error('Target length/width is invalid.');
    const r = o.goal === 'screen' ? o.currentHeight / o.oldHeight : 1;
    return { legacy, target: { ...source, ...Object.fromEntries(['length', 'width', 'near', 'far'].map(k => [k, source[k] * r])) }, options: o };
}
/** Counterfactual direct assignment. It is NOT a reproduction of Valve's migration code. */
export function naiveAssignment(settings, authoredHeight) {
    validateHeight(authoredHeight);
    return { length: Math.max(0, Math.min(255, Math.trunc(settings.size))), thickness: Math.max(0, Math.min(31, Math.trunc(settings.thickness))), gap: Math.max(0, Math.min(128, Math.trunc(settings.gap))), authoredHeight };
}
export function geometryError(a, b) { return (a.length - b.length) ** 2 + (a.width - b.width) ** 2 + (b.length > 0 ? ((a.near - b.near) ** 2 + (a.far - b.far) ** 2) : 0); }
export function nativeKey(n) { return `${n.length}/${n.thickness}/${n.gap}@${n.authoredHeight}`; }
export function geometryKey(g) { return [g.length, g.width, g.near, g.far].join('/'); }
export function unsupported(settings) {
    const out = [];
    if (settings.style !== 4)
        out.push('Only stationary style 4 is modeled. Dynamic and circle styles are not converted.');
    if (settings.weapon_gap)
        out.push('Weapon-dependent gap is outside the measured static scope.');
    return out;
}
