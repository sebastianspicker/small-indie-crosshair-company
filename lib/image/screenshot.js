import { componentBounds, axisComponents, barGeometry } from './components.js';
/** Bounded color segmentation and template fitting. No OCR and no game-process access. */
import { rectangles, raster, compareMasks, RASTER_CONVENTION, RAW_EDGE_CONVENTION } from '../geometry/raster.js';
import { finite, height as validateHeight } from '../settings/validation.js';
export function pngDimensions(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 24 || [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v))
        throw new Error('Use an original PNG screenshot.');
    if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR')
        throw new Error('Invalid PNG header.');
    const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = d.getUint32(16), height = d.getUint32(20);
    if (!width || !height || width > 8192 || height > 8192 || width * height > 20000000)
        throw new Error('PNG exceeds the 20-million-pixel / 8192-side safety limit.');
    return { width, height };
}
export function automaticColor(data, side) {
    const counts = new Map(), center = (side - 1) / 2;
    for (let y = center - 18; y <= center + 18; y++)
        for (let x = center - 18; x <= center + 18; x++) {
            if (x < 0 || y < 0 || x >= side || y >= side)
                continue;
            const i = (y * side + x) * 4, rgb = [data[i], data[i + 1], data[i + 2]], max = Math.max(...rgb), min = Math.min(...rgb);
            if (max < 70 || max - min < 65 || data[i + 3] < 180)
                continue;
            const key = rgb.map(v => Math.round(v / 8) * 8).join('/'), item = counts.get(key) ?? { count: 0, rgb };
            item.count++;
            counts.set(key, item);
        }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(x => x.rgb);
}
export function segment(data, side, rgb, tolerance = 40) {
    if (!Array.isArray(rgb) || rgb.length !== 3)
        throw new Error('Select a crosshair-colored pixel.');
    rgb.forEach(v => finite(v, 'Color', 0, 255));
    finite(tolerance, 'Segmentation tolerance', 1, 120);
    const mask = new Uint8Array(side * side);
    let total = 0;
    for (let i = 0; i < mask.length; i++) {
        const j = i * 4;
        mask[i] = Number(data[j + 3] > 32 && Math.hypot(data[j] - rgb[0], data[j + 1] - rgb[1], data[j + 2] - rgb[2]) <= tolerance);
        total += mask[i];
    }
    if (total < 1 || total > side * side * .35)
        throw new Error('Segmentation is empty or mostly background. Click a colored crosshair pixel or adjust the center/tolerance.');
    return { data: mask, side, cropped: false, total };
}
function summed(mask) { const s = mask.side, n = s + 1, ii = new Int32Array(n * n); for (let y = 0; y < s; y++) {
    let sum = 0;
    for (let x = 0; x < s; x++) {
        sum += mask.data[y * s + x];
        ii[(y + 1) * n + x + 1] = ii[y * n + x + 1] + sum;
    }
} return ii; }
function rectPixels(r, side) { const half = (side - 1) / 2; return [Math.max(0, Math.ceil(r.x - .5) + half), Math.max(0, Math.ceil(r.y - .5) + half), Math.min(side, Math.ceil(r.x + r.w - .5) + half), Math.min(side, Math.ceil(r.y + r.h - .5) + half)]; }
function integralSum(ii, n, [x0, y0, x1, y1]) { return x1 <= x0 || y1 <= y0 ? 0 : ii[y1 * n + x1] - ii[y0 * n + x1] - ii[y1 * n + x0] + ii[y0 * n + x0]; }
function fitMask(mask) {
    const ii = summed(mask), n = mask.side + 1, shortlist = [];
    let tested = 0;
    // Integral-image approximate ranking, followed by exact union-mask comparison.
    // Bounds intentionally refuse very large/overlapping/odd styles rather than unbounded processing.
    for (let width = 1; width <= 16; width++)
        for (let length = 0; length <= 48; length++)
            for (let near = 0; near <= 24; near++)
                for (const dot of [false, true])
                    for (const t_style of [false, true]) {
                        if (length === 0 && (!dot || near !== 0 || t_style))
                            continue;
                        const g = { length, width, near, far: near + 1 }, flags = { dot, t_style };
                        let area = 0, intersection = 0;
                        for (const r of rectangles(g, flags)) {
                            const box = rectPixels(r, mask.side);
                            area += Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
                            intersection += integralSum(ii, n, box);
                        }
                        const overlap = Math.min(intersection, mask.total, area), score = overlap / Math.max(1, mask.total + area - overlap);
                        tested++;
                        if (shortlist.length < 48 || score > shortlist.at(-1).score) {
                            shortlist.push({ g, flags, score });
                            shortlist.sort((a, b) => b.score - a.score);
                            if (shortlist.length > 48)
                                shortlist.pop();
                        }
                    }
    const exact = shortlist.map(x => ({ ...x, metric: compareMasks(raster(x.g, x.flags, mask.side), mask) })).sort((a, b) => (b.metric.iou ?? 0) - (a.metric.iou ?? 0) || a.g.length - b.g.length || a.g.width - b.g.width);
    return { ...exact[0], alternatives: exact.slice(0, 5).map(x => ({ geometry: x.g, flags: x.flags, iou: x.metric.iou })), tested };
}
export function legacyBuckets(g, height) {
    validateHeight(height);
    const scale = height / 480, p = g.near - Math.floor(g.width / 2);
    return { size: { lower: g.length / scale, upper: (g.length + 1) / scale, lowerClosed: true, upperClosed: false },
        thickness: { lower: g.width === 1 ? 0 : g.width / scale, upper: (g.width + 1) / scale, lowerClosed: true, upperClosed: false, zeroAlsoPossible: g.width === 1 },
        gap: p === 0 ? { lower: -5, upper: -3, lowerClosed: false, upperClosed: false } : p > 0 ? { lower: p - 4, upper: p - 3, lowerClosed: true, upperClosed: false } : { lower: p - 5, upper: p - 4, lowerClosed: false, upperClosed: true },
        caveat: 'Ideal arithmetic buckets; float32 boundary effects and screenshot scaling can change endpoint behavior. These are not unique recovered cvars.' };
}
export function analyzeScreenshot({ data, side = 129, seed = null, tolerance = 40, height = 1080 }) {
    if (!(data instanceof Uint8ClampedArray) && !(data instanceof Uint8Array))
        throw new Error('RGBA bytes required.');
    if (!Number.isInteger(side) || side < 49 || side > 161 || side % 2 !== 1 || data.length !== side * side * 4)
        throw new Error('Use an odd 49–161 px center crop.');
    const colors = seed ? [seed] : automaticColor(data, side);
    if (!colors.length)
        throw new Error('No unambiguous saturated crosshair color. Click a crosshair pixel (needed for white, black or transparent crosshairs).');
    let best = null;
    for (const rgb of colors) {
        try {
            const mask = segment(data, side, rgb, tolerance), fit = fitMask(mask);
            if (!best || (fit.metric.iou ?? 0) > (best.fit.metric.iou ?? 0))
                best = { rgb, mask, fit };
        }
        catch (error) {
            if (seed)
                throw error;
        }
    }
    if (!best)
        throw new Error('Could not isolate a bounded static crosshair. Select a different color/center.');
    const g = best.fit.g, buckets = legacyBuckets(g, height), mid = b => (b.lower + b.upper) / 2;
    return { schema: 'sicc-image-inference-v1', rasterConvention: RASTER_CONVENTION, geometry: g, flags: best.fit.flags, color: best.rgb, mask: best.mask, templateIou: best.fit.metric.iou,
        alternatives: best.fit.alternatives, buckets, representative: { size: mid(buckets.size), thickness: mid(buckets.thickness), gap: mid(buckets.gap) },
        evaluatedTemplates: best.fit.tested, confidenceType: 'Segmentation/template agreement, NOT a calibrated correctness probability.',
        warnings: ['An image cannot uniquely recover old cvars, original alpha, color preset or resolution.', 'Original native-resolution captures are required; scaled/video images and anti-aliasing may bias the fit.', 'Search covers a static colored core, L 0–48, W 1–16, near 0–24. Overlapping arms, outlines and dynamics require manual review.'] };
}
/** Native capture measurement does NOT fit the legacy template or force far = near + 1.
 * It measures disconnected axis-aligned colored components. Merged/ambiguous cores are refused.
 */
export function measureNativeMask(mask) {
  const components=componentBounds(mask), axes=axisComponents(components);
  const onlyDot=axes.dot&&!axes.left&&!axes.right&&!axes.top&&!axes.bottom;
  const geometry=onlyDot?{length:0,width:axes.dot.w,near:0,far:0}:barGeometry(axes);
  const flags={dot:!!axes.dot,t_style:!onlyDot&&!axes.top};
  const metric=compareMasks(raster(geometry,flags,mask.side,RAW_EDGE_CONVENTION),mask);
  if(metric.cropped||(metric.iou??0)<.9)throw new Error('Native component reconstruction does not explain at least 90% of the mask. No native evidence was recorded.');
  return {geometry,flags,templateIou:metric.iou,components,measurementMethod:onlyDot
    ?'direct-components; pure-dot gap unidentifiable':'direct-component bounds; independently measured near and far'};
}
export function analyzeNativeScreenshot({ data, side = 129, seed = null, tolerance = 40 }) {
    if (!(data instanceof Uint8ClampedArray) && !(data instanceof Uint8Array))
        throw new Error('RGBA bytes required.');
    if (!Number.isInteger(side) || side < 49 || side > 161 || side % 2 !== 1 || data.length !== side * side * 4)
        throw new Error('Use an odd 49–161 px center crop.');
    const colors = seed ? [seed] : automaticColor(data, side);
    let best = null, lastError = null;
    for (const color of colors) {
        try {
            const mask = segment(data, side, color, tolerance), fit = measureNativeMask(mask);
            if (!best || fit.templateIou > best.templateIou)
                best = { ...fit, mask, color };
        }
        catch (e) {
            lastError = e;
        }
    }
    if (!best)
        throw lastError ?? new Error('Select a crosshair-colored pixel for native component measurement.');
    return { schema: 'sicc-native-image-measurement-v1', ...best, confidenceType: 'Component-mask agreement, not correctness confidence.', warnings: ['Original native resolution and correct cvars must be attested.', 'No constraint far = near + 1 was imposed on these measured edges.', 'Merged bars, outlines, scaling and irregular shapes are not automatically measured.'] };
}
