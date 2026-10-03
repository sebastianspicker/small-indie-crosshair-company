/** Appearance refinement. After the dimension-first choice, a bounded window of native tuples around it
 * is scored by the colour-aware, shift-aligned overlap `shapeCheck` reports: old core and outline in the old draw
 * order against the new core and outline as exported. A neighbour replaces the choice only when it draws the old
 * visible pixels strictly better, so every exact or shifted export, and the shift-aware tie ranking, stays as it was. */
import { communityDimension, communityForward, pixelWindow } from '../geometry/community.js';
import { drawingEdges } from '../geometry/raster.js';
import { appearanceScorer } from '../geometry/appearance.js';
import { NATIVE_RANGES_2000922 as RANGES } from '../settings/native.js';
import { communityAxis } from './community-axis.js';
import { oldAppearance, exportedAppearance } from './community-edge.js';

/** Drawn current pixels around the dimension-first choice: bar length, bar width and the gap (inner) edge. Each is
 * mapped to native values by the authored/current ratio (`pixelWindow`), clamped to the native ranges; above ratio 1
 * the same number of native steps reaches further and is kept. */
export const REFINE_WINDOW = Object.freeze({ length: 3, thickness: 3, gap: 4, unit: 'drawn-current-pixels-or-native-steps' });
const EPSILON = 1e-9;
const SCOPE = 'Pixel goal, old outline at most 1 px a side. Native tuples that draw within ±3 px of bar length, ' +
  '±3 px of bar width and ±4 px of the gap edge of the dimension-first choice, in current pixels, or lie within as many ' +
  'native steps when that reaches further (thickness at least 1, length at least 1 when the choice draws arms), scored ' +
  'by the colour-aware overlap of shapeCheck, best over ' +
  'whole-shape shifts of at most one pixel. Applied only when that overlap improves; not a global optimum.';
const selected = (solution, value) => ({ ...solution, value, tie: Math.abs(value - solution.ideal) });

/**
 * @param {object} solved - `searchCommunity` result with its exported `flags`.
 * @param {{settings: object, target: object, canonical: object, overrides: object, options: object}} context -
 *   `target` the scaled old geometry `shapeCheck` draws, `canonical` the fitted target, `overrides` the export
 *   overrides (colour, outline mode).
 * @returns {object} `solved` with the refined native tuple, prediction and solutions, plus `refinement`.
 */
export function refineAppearance(solved, { settings, target, canonical, overrides, options }) {
  const { flags, native: initial } = solved, score = appearanceScorer(oldAppearance(settings, target));
  const cache = new Map(), evaluate = native => {
    const converted = communityForward(native, options.currentHeight), key = `${converted.length},${converted.width},${converted.near}`;
    if (!cache.has(key)) cache.set(key, score(exportedAppearance({ settings, flags, converted, overrides, options })));
    return { native, converted, ...cache.get(key) };
  };
  const start = evaluate(initial);
  const report = (applied, after, skipped = null) => ({ applied, skipped, initial,
    before: { iou: start.iou, alignedIou: start.aligned }, after: { iou: after.iou, alignedIou: after.aligned },
    evaluated: cache.size, window: REFINE_WINDOW, scope: SCOPE });
  if (start.iou === null || start.aligned === 1)
    return { ...solved, refinement: report(false, start, start.iou === null ? 'empty' : start.iou === 1 ? 'exact' : 'shifted') };
  const ratio = options.currentHeight / options.authoredHeight, edges = drawingEdges(canonical);
  const radius = thickness => (edges.near + edges.far + communityDimension(thickness, ratio) % 2) / 2;
  const { length, thickness } = solved.solutions;
  const preference = n => [Math.abs(n.length - length.ideal), n.length, Math.abs(n.thickness - thickness.ideal),
    n.thickness, Math.abs(n.gap - radius(n.thickness) / ratio), n.gap];
  // One native value per drawn size, the one the preference order would pick among equal shapes.
  const lengths = pixelWindow(initial.length, REFINE_WINDOW.length, ratio, initial.length > 0 ? 1 : 0, RANGES.length.max,
    length.ideal);
  let best = null;
  for (const t of pixelWindow(initial.thickness, REFINE_WINDOW.thickness, ratio, 1, RANGES.thickness.max, thickness.ideal)) {
    const gaps = pixelWindow(initial.gap, REFINE_WINDOW.gap, ratio, RANGES.gap.min, RANGES.gap.max, radius(t) / ratio);
    for (const l of lengths)
      for (const g of gaps) {
        const c = evaluate({ ...initial, length: l, thickness: t, gap: g });
        if (c.aligned === null || !(c.aligned > start.aligned + EPSILON)) continue;
        if (best && (c.aligned < best.aligned || (c.aligned === best.aligned && c.iou < best.iou))) continue;
        if (best && c.aligned === best.aligned && c.iou === best.iou) {
          const a = preference(c.native), b = preference(best.native), i = a.findIndex((v, k) => v !== b[k]);
          if (i < 0 || a[i] > b[i]) continue;
        }
        best = c;
      }
  }
  if (!best) return { ...solved, refinement: report(false, start) };
  const gap = communityAxis(radius(best.native.thickness), ratio, RANGES.gap.max);
  delete gap.evaluations;
  return { ...solved, native: best.native, predicted: best.converted, radius: radius(best.native.thickness),
    solutions: { length: selected(length, best.native.length), thickness: selected(thickness, best.native.thickness),
      gap: selected(gap, best.native.gap) }, refinement: report(true, best) };
}
