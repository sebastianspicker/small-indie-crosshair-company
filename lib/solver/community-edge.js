/** Old shapes the new renderer cannot draw literally: crossed arms (issue #15), outline-only size 0
 * (issue #11) and a dot at size 0. Plans the target the dimension search fits, and checks the result by colour. */
import { foldCrossedArms, outlineAsCore, dotAsArms } from '../geometry/edge-cases.js';
import { appearance, legacyAppearance, maskAppearance, compareAppearance, appearanceScorer } from '../geometry/appearance.js';
import { outlineOnly } from '../geometry/raster.js';
import { compileMask } from '../geometry/pixel-shape.js';
import { legacyOutlineExtent, nativeOutlineExtent, effectiveOutlineMode, rgba } from '../settings/native.js';

const warn = (code, text) => ({ code, text });

/**
 * The target the search fits and the visible old shape it is scored against, both in old pixels.
 * `reference` is the old visible mask as a core shape: the old geometry, or the outline strokes when size 0
 * drew only outlines. The rules apply to the legacy reconstruction only; measured targets and images stay literal.
 * @returns {{target: object, reference: object, cases: string[], fold: string, shift: number[]}}
 */
export function edgeCaseTarget(source, settings, legacyInput) {
  // Bare geometry inputs (research sweeps) carry no outline flag.
  const extent = settings.outline === undefined ? { low: 0, high: 0 } : legacyOutlineExtent(settings), cases = [];
  let target = source, reference = source, shift = [0, 0];
  if (!legacyInput) return { target, reference, cases, fold: 'none', shift };
  if (source.length === 0 && source.width > 0) {
    if (settings.dot) {
      ({ target, shift } = dotAsArms(source));
      cases.push(extent.low + extent.high > 0 ? 'dot-only-outlined' : 'dot-only');
    } else if (outlineOnly(source, settings, extent)) {
      target = reference = outlineAsCore(source, extent).target;
      cases.push('outline-only');
    }
  }
  const folded = foldCrossedArms(target);
  if (folded.kind !== 'none') {
    target = folded.target; shift = folded.shift;
    cases.push(`crossed-${folded.kind}`);
  }
  return { target, reference, cases, fold: folded.kind, shift };
}

/** Export overrides the plan needs: outline-only shapes are redrawn as bars in the old outline colour (black,
 * at the old crosshair opacity) with the outline off, unless the outline mode was chosen by hand. The T flag is
 * always kept, a crossed T included. */
export function edgeCaseOverrides(settings, options, cases) {
  return cases.includes('outline-only') ? { color: { rgb: [0, 0, 0], alpha: rgba(settings).alpha },
    ...(options.outlineMode === 'auto' ? { outlineMode: 0 } : {}) } : {};
}

/** Warnings for the planned edge cases (`plan` from `edgeCaseTarget`, `status` the shape-check status: a crossed
 * T that still matches needs no warning; `outlineMode` the exported outline mode, 0 unless chosen by hand for an
 * outline-only shape). */
export function edgeCaseWarnings(settings, plan, status = 'approximate', outlineMode = 0) {
  const out = [], has = code => plan.cases.includes(code);
  if (plan.fold !== 'none') out.push(warn('crossed-arms-folded', plan.fold === 'full'
    ? 'The negative gap made the old arms cross the centre, so each arm was drawn on the opposite side. ' +
      'The export draws the same pixels with a non-negative gap.'
    : 'The negative gap made the old arms cross the centre and merge into one solid bar per axis. ' +
      'The export draws that bar with gap 0.'));
  if (plan.fold !== 'none' && settings.t_style && status === 'approximate') out.push(warn('inverted-t-unrepresentable',
    'With T style the old crossed arms put the single vertical arm above the centre. The export keeps T, and the ' +
    'current game draws that arm below the centre, so it appears on the other side.'));
  if (has('outline-only')) out.push(warn('outline-only-as-core',
    'The old crosshair showed only outline strokes (size 0 with an outline). The current game draws nothing for ' +
    'length 0, outline included, so the export draws the same strokes as bars in the old outline colour ' +
    `(black, opacity ${rgba(settings).alpha}) ` + (outlineMode ? `with the hand-chosen outline mode ${outlineMode}, ` +
      'which also draws a black outline around those bars.' : 'with the outline off.')));
  if (has('dot-only') || has('dot-only-outlined')) out.push(warn('dot-only-as-arms',
    'Size 0 drew only the dot. The current game may draw nothing for length 0, so the export adds arms at gap 0 ' +
    'that cover exactly the dot square; the dot stays on.'));
  if (has('dot-only-outlined') && status === 'approximate') out.push(warn('zero-length-outline-dropped',
    'The old zero-length bars still drew outline strokes around the gap. The current game draws no outline for ' +
    'length 0 and draws its colour over its outline, so the export is the closest shape found within the search ' +
    'window: short arms whose outline draws part of those strokes. The rest of them differs.'));
  return out;
}

const key = ({ rgb, alpha }) => `${rgb.join(',')},${alpha}`;
const oldColors = settings => {
  const old = rgba(settings);
  return { core: key(old), outline: key({ rgb: [0, 0, 0], alpha: old.alpha }) };
};

/** True when the old draw order left outline pixels over an earlier bar or dot fill: the old look
 * differs from the same rectangles with every outline beneath every fill, which is all the new game can draw. */
export function outlineOverpaint(settings, target) {
  const extent = legacyOutlineExtent(settings);
  if (extent.low + extent.high <= 0) return false;
  const colors = oldColors(settings);
  return compareAppearance(legacyAppearance(target, settings, extent, colors),
    appearance(target, settings, extent, colors, true)).different > 0;
}

/** Warning when overpainted outline pixels exist and the export, after the appearance refinement, still
 * does not reproduce the old look within a whole-shape shift of 1 px. */
export const overpaintWarning = (settings, target, status) => outlineOverpaint(settings, target) && status === 'approximate'
  ? warn('outline-overpaint-lost', 'The old game drew the bars and the dot one after another, each outline before its ' +
    'colour, so a later outline darkened part of an earlier bar or the dot. The current game always draws the colour ' +
    'over the outline, so the export is the closest shape found within the search window and some of those dark ' +
    'pixels differ.') : null;
/** What the export draws: core in the exported colour, outline (black) by the exported mode, colour over outline. */
export function exportedAppearance({ settings, flags = settings, converted, overrides, options }) {
  const old = rgba(settings), mode = effectiveOutlineMode(settings, overrides.outlineMode ?? options.outlineMode);
  return appearance(converted, flags, nativeOutlineExtent(settings, mode),
    { core: key(overrides.color ?? old), outline: oldColors(settings).outline }, false);
}
/** The old visible appearance `shapeCheck` compares against: legacy outline extent, old draw order. The extent
 * stays in fixed pixels when a screen goal scales the target, as both games draw outlines in whole pixels. */
export const oldAppearance = (settings, target) =>
  legacyAppearance(target, settings, legacyOutlineExtent(settings), oldColors(settings));
/** True when the export draws at least one pixel (core or outline), same arguments as `shapeCheck`. */
export const exportDraws = args => exportedAppearance(args).some(layer => layer.boxes.length > 0);
/**
 * Old against new visible appearance by colour: old core in the crosshair colour and old outline (black, at the
 * crosshair opacity) with the legacy outline extent, painted in the old draw order; new core in the exported
 * colour and outline by the exported mode, colour over outline. Aligned = best whole-shape shift of at most one pixel.
 * @returns {{status: ('exact'|'shifted'|'approximate'|'empty'), iou: ?number, alignedIou: ?number, scope: string}}
 */
export function shapeCheck({ settings, flags = settings, target, converted, overrides, options, targetMask }) {
  const before = targetMask ? maskAppearance(compileMask(targetMask), key(rgba(settings))) : oldAppearance(settings, target);
  const after = exportedAppearance({ settings, flags, converted, overrides, options });
  const { iou, aligned: alignedIou } = appearanceScorer(before)(after);
  const status = iou === null ? 'empty' : iou === 1 ? 'exact' : alignedIou === 1 ? 'shifted' : 'approximate';
  return { status, iou, alignedIou, scope: targetMask
    ? 'Image target: the measured core against the new core and outline, by colour. Illustrative pixels, not a capture.'
    : 'Old core and outline (old draw order) against the new core and outline, by colour, under the declared models; ' +
      'zero-length bars keep their outline only in the old game. A screen goal scales the old core to the new screen ' +
      'and keeps the old outline in whole pixels, as both games draw it. Illustrative pixels, not a capture.' };
}
