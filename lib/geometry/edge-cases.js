/** Old shapes the new renderer cannot draw literally, re-expressed as ordinary arms.
 * Every result is a RAW_EDGE_CONVENTION target; `shift` is the whole-shape move `[dx, dy]` from the old
 * mask to the target mask (non-zero only for the odd-width centring of a solid centre). */
import { drawingEdges, RAW_EDGE_CONVENTION, axisStartOf, cell } from './raster.js';

// Re-exported: community.js, ml-crosscheck tests and research import it from here.
export { axisStartOf };

const raw = (g, length, width, near, far, axisStart) => ({ ...g, length, width, near, far, axisStart,
  interval: length > 0 ? near + far : null, rasterConvention: RAW_EDGE_CONVENTION });
/** Solid bar through the centre over cells `[x0, x1)`: symmetric (even) or one cell past it (odd centring). Old
 * pixels are always centred so; cells snapped from a scaled shape may sit `k` whole pixels off and are moved back. */
function solidCentre(g, x0, x1, width, axisStart) {
  const k = Math.floor((x0 + x1) / 2);
  if (x0 + x1 === 2 * k) return { target: raw(g, x1 - k, width, 0, 0, axisStart - k), shift: [0 - k, 0 - k] };
  return { target: raw(g, x1 - k, width, 0, -1, axisStart - k - 1), shift: [-1 - k, -1 - k] };
}

/** Old arms start at their near edge, so a negative near edge crosses the centre (issue #15).
 * `full`: both arms lie past the centre, mirrored with identical pixels. `partial`: the two arms of an axis
 * merge into one solid bar through the centre. `none`: no crossing, or a union the arms cannot express. */
export function foldCrossedArms(g) {
  const { near: a, far: b } = drawingEdges(g), L = g.length, t = axisStartOf(g);
  const none = { kind: 'none', target: g, shift: [0, 0] };
  if (!(L > 0) || a >= 0) return none;
  if (a + L <= 0 && b + L <= 0) return { kind: 'full', target: raw(g, L, g.width, 0 - (b + L), 0 - a - L, t), shift: [0, 0] };
  if (Math.max(0 - a - L, b) > Math.min(0 - a, b + L)) return none;
  return { kind: 'partial', ...solidCentre(g, Math.min(0 - a - L, b), Math.max(0 - a, b + L), g.width, t) };
}

/** Size 0 with an outline and no dot drew only the outlines of zero-length bars (issue #11). The same pixels
 * as a coloured core: length low+high, thickness W+low+high, edges and axis moved by the outline extent. */
export function outlineAsCore(g, { low, high }) {
  const { near: a, far: b } = drawingEdges(g);
  return { target: raw(g, low + high, g.width + low + high, a - high, b - low, axisStartOf(g) - low), shift: [0, 0] };
}

/** The whole pixels a fractional raw-edge target paints (pixel centres, as the preview raster), as an integer
 * raw-edge target, so a screen goal can apply the rules above in current pixels; null when the two arms of an axis
 * cover different lengths or the bars cover no column. */
export function snapToCells(g) {
  const { near: a, far: b } = drawingEdges(g), L = g.length, t = axisStartOf(g);
  const axisStart = cell(t), width = cell(t + g.width) - axisStart, far = cell(b);
  const left = cell(0 - a) - cell(0 - a - L), right = cell(b + L) - far;
  return left !== right || width < 1 ? null : raw(g, left, width, 0 - cell(0 - a), far, axisStart);
}

/** Size 0 with a dot: arms at gap 0 whose union with the dot is exactly the dot's W x W square. */
export function dotAsArms(g) {
  const W = g.width, t = axisStartOf(g);
  return solidCentre(g, t, t + W, W, t);
}
