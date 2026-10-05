/** Per-input ML cross-check. Evaluates the exported parameters of a research learner that imitates the
 * automatic converter's export. Independent of the solver: it never calls solveCommunity, searchCommunity,
 * communityAxis or the edge-case planner. Its own source arithmetic builds the old shape, the regime transforms and
 * a bracketing candidate set; learned trees pick among the candidates and predict the appearance keys, and the
 * appearance window, re-derived from geometry helpers, moves the pick as the converter does.
 * Pure: the parameter object is passed in, nothing is fetched. Agreement with our own method, not game accuracy. */
import { COMMUNITY_MODEL, communityLegacy, communityDimension, communityForward, pixelWindow } from '../geometry/community.js';
import { appearance, legacyAppearance, appearanceScorer } from '../geometry/appearance.js';
import { RAW_EDGE_CONVENTION } from '../geometry/raster.js';
import { legacyOutlineExtent, nativeOutlineExtent, outlineMode, outlineChoice, rgba, exportFillAlpha,
  effectiveOutlineMode, NATIVE_RANGES_2000922 as RANGES } from '../settings/native.js';
import { hash } from './statistics.js';

export const CROSSCHECK_SCHEMA = 'sicc-ml-crosscheck-v1';
export const INPUT_FEATURES = Object.freeze(['ratio', 'screenGoal', 'factor', 'dot', 'tStyle', 'weaponGap',
  'oldLength', 'oldWidth', 'oldNear', 'oldFar', 'crossing', 'size0Kind', 'zeroLength',
  'targetLength', 'targetWidth', 'targetNear', 'targetFar', 'targetAxisStart',
  'outlineOn', 'outlineWidth', 'outlineRounded', 'outlineLow', 'outlineHigh', 'outlineModeRule',
  'useAlpha', 'crosshairAlpha', 'oldWidthParity', 'targetWidthParity',
  'idealLength', 'idealWidth', 'lengthFraction', 'widthFraction', 'lengthChoices', 'widthChoices', 'candidateCount',
  'stemAbove', 'stemBelow', 'tAlignedApprox', 'plusAlignedApprox', 'plusOverT']);
export const CANDIDATE_FEATURES = Object.freeze(['lengthError', 'widthError', 'nearError', 'farError',
  'drawnWidthParity', 'axisShift', 'axisCellLow', 'axisCellHigh', 'nearCellInner', 'nearCellOuter',
  'farCellInner', 'farCellOuter', 'lengthPreference', 'widthPreference', 'gapPreference', 'order', 'approxIou',
  'approxAlignedIou', 'referenceAlignedIou', 'plusReferenceAlignedIou']);
/** Binary and one-vs-rest heads over the input features. The T flag is not predicted: the converter always keeps it. */
export const HEADS = Object.freeze(['drawoutline0', 'drawoutline1', 'drawoutline2', 'outlineAlphaOld', 'colorBlack',
  'fillAlphaOld']);
export const EXPORT_STATE_KEYS = Object.freeze(['length', 'thickness', 'gap', 'authoredHeight', 'drawoutline',
  'outlineAlpha', 'color', 'fillAlpha', 't_style']);
const CROSSING = { none: 0, full: 1, partial: 2, unrepresentable: 3 };
const SIZE0 = { none: 0, dot: 1, outline: 2, empty: 3 };

/** Solid bar through the centre over cells [x0, x1): symmetric (even) or one cell past it (odd centring), moved back
 * by whole pixels when snapped cells sit off the centre. */
function solid(x0, x1, width, axisStart) {
  const k = Math.floor((x0 + x1) / 2);
  return x0 + x1 === 2 * k ? { length: x1 - k, width, near: 0, far: 0, axisStart: axisStart - k }
    : { length: x1 - k, width, near: 0, far: -1, axisStart: axisStart - k - 1 };
}

/**
 * Old shape and the regime transforms, re-derived from source arithmetic (old pixels, drawing edges).
 * Size 0 with a dot becomes arms inside the dot square; size 0 with an outline becomes the outline strokes as a core;
 * arms whose near edge is negative cross the centre and are folded (full) or merged into one bar (partial).
 * @returns {{old: object, shape: object, crossing: string, size0: string, extent: {low: number, high: number}}}
 */
export function regimeShape(settings, height) {
  const g = communityLegacy(settings, height), W = g.width;
  // Old renderer: even widths draw the far arm one pixel nearer (illustrative-parity-v2 edges).
  const old = { length: g.length, width: W, near: g.near, far: g.far - (W % 2 === 0 ? 1 : 0), axisStart: 0 - Math.floor(W / 2) };
  const extent = settings.outline === undefined ? { low: 0, high: 0 } : legacyOutlineExtent(settings);
  return { old, extent, ...regimeTransform(old, settings, extent) };
}

/** The regime transforms of one shape (drawing edges, axisStart), in whatever pixels it is given. */
function regimeTransform(old, settings, extent) {
  const W = old.width;
  let shape = old, size0 = 'none', crossing = 'none';
  if (old.length === 0) {
    if (settings.dot) { shape = solid(old.axisStart, old.axisStart + W, W, old.axisStart); size0 = 'dot'; }
    else if (extent.low + extent.high > 0) {
      const { low, high } = extent;
      shape = { length: low + high, width: W + low + high, near: old.near - high, far: old.far - low, axisStart: old.axisStart - low };
      size0 = 'outline';
    } else size0 = 'empty';
  }
  const unfolded = shape, { length: L, near: a, far: b, width, axisStart: t } = shape;
  // The old T stem (bottom arm) spans [b, b + L); a negative near edge puts part of it above the centre.
  const stem = { above: Math.max(0, Math.min(b + L, 0) - b), below: Math.max(0, b + L - Math.max(b, 0)) };
  if (L > 0 && a < 0) {
    crossing = 'unrepresentable';
    if (a + L <= 0 && b + L <= 0) {
      shape = { length: L, width, near: 0 - (b + L), far: 0 - a - L, axisStart: t }; crossing = 'full';
    } else if (!(Math.max(0 - a - L, b) > Math.min(0 - a, b + L))) {
      const merged = solid(Math.min(0 - a - L, b), Math.max(0 - a, b + L), width, t);
      if (merged) { shape = merged; crossing = 'partial'; }
    }
  }
  return { shape, unfolded, crossing, size0, stem };
}

const transformed = regime => ['full', 'partial'].includes(regime.crossing) || ['dot', 'outline'].includes(regime.size0);
/** Whole cells a fractional shape paints at pixel centres; null when the two arms of an axis differ in length. */
function snapCells({ length: L, width: W, near: a, far: b, axisStart: t }) {
  const x0 = cell(t), width = cell(t + W) - x0, far = cell(b), left = cell(0 - a) - cell(0 - a - L), right = cell(b + L) - far;
  return left !== right || width < 1 ? null : { length: left, width, near: 0 - cell(0 - a), far, axisStart: x0 };
}

/** Minimum-error integer values of one monotone axis, one per drawn pixel (closest to the ideal, then smaller),
 * found by scanning a bracket around the ideal. Independent of lib/solver/community-axis.js. */
export function bracketAxis(wanted, ratio, max, min = 0) {
  const ideal = wanted / ratio, reach = Math.ceil(1 / ratio) + 1;
  const low = Math.max(min, Math.min(max, Math.floor(ideal)) - reach), high = Math.min(max, Math.max(min, Math.ceil(ideal)) + reach);
  let best = Infinity;
  const scanned = [];
  for (let value = low; value <= high; value++) {
    const drawn = communityDimension(value, ratio), loss = (drawn - wanted) ** 2;
    scanned.push({ value, drawn, loss }); if (loss < best) best = loss;
  }
  const chosen = new Map();
  for (const { value, drawn, loss } of scanned) {
    if (loss !== best) continue;
    const current = chosen.get(drawn), distance = Math.abs(value - ideal);
    if (current === undefined || distance < Math.abs(current - ideal)) chosen.set(drawn, value);
  }
  return { ideal, values: [...chosen.values()].sort((p, q) => Math.abs(p - ideal) - Math.abs(q - ideal) || p - q) };
}

const order = (a, b) => {
  const i = a.preference.findIndex((value, k) => value !== b.preference[k]);
  return i < 0 ? 0 : a.preference[i] - b.preference[i];
};
const cell = value => Math.ceil(value - .5);

/** Cell boxes `[x0, x1, y0, y1]` of the arms and the dot, painted at pixel centres like the preview raster. */
function boxes({ length: L, width: W, near: a, far: b, axisStart: t }, flags) {
  const across = [cell(t), cell(t + W)], out = [];
  if (L > 0) {
    out.push([cell(-a - L), cell(-a), ...across], [cell(b), cell(b + L), ...across], [...across, cell(b), cell(b + L)]);
    if (!flags.t_style) out.push([...across, cell(-a - L), cell(-a)]);
  }
  if (flags.dot) out.push([...across, ...across]);
  return out.filter(([x0, x1, y0, y1]) => x1 > x0 && y1 > y0);
}
const edges = (list, i) => [...new Set(list.flatMap(box => [box[i], box[i + 1]]))].sort((u, v) => u - v);
const inside = (list, x, y) => list.some(([x0, x1, y0, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
/** Exact overlap of the two painted unions (coordinate-compressed cells), with `p` moved by dx, dy. */
function boxIou(p, q, dx = 0, dy = 0) {
  const moved = p.map(([x0, x1, y0, y1]) => [x0 + dx, x1 + dx, y0 + dy, y1 + dy]), all = [...moved, ...q];
  const xs = edges(all, 0), ys = edges(all, 2);
  let shared = 0, union = 0;
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) {
    const a = inside(moved, xs[i - 1], ys[j - 1]), b = inside(q, xs[i - 1], ys[j - 1]);
    if (!a && !b) continue;
    const cells = (xs[i] - xs[i - 1]) * (ys[j] - ys[j - 1]);
    union += cells; if (a && b) shared += cells;
  }
  return union > 0 ? shared / union : 1;
}
function alignedBoxIou(p, q) {
  let best = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) best = Math.max(best, boxIou(p, q, dx, dy));
  return best;
}
/** New pixels of a native tuple (community renderer, odd widths centred on -ceil(W/2)). */
function drawnShape(n, ratio) {
  const width = communityDimension(n.thickness, ratio), near = communityDimension(n.gap, ratio);
  return { length: communityDimension(n.length, ratio), width, near, far: near - width % 2, axisStart: 0 - Math.ceil(width / 2) };
}

/** Input features and the bracketing candidates for one input. `options` is a resolved scope (all heights and goal). */
export function crossCheckInput(settings, options) {
  const { oldHeight, currentHeight, authoredHeight, goal } = options;
  const regime = regimeShape(settings, oldHeight), { old, shape, extent } = regime;
  const factor = goal === 'screen' ? currentHeight / oldHeight : 1, ratio = currentHeight / authoredHeight;
  const scaled = g => ({ length: g.length * factor, width: g.width * factor, near: g.near * factor, far: g.far * factor,
    axisStart: g.axisStart * factor });
  // A screen goal applies the transforms to the whole current pixels the scaled old shape covers, as the converter does.
  const cells = factor !== 1 && transformed(regime) ? snapCells(scaled(old)) : null;
  const snapped = cells && regimeTransform(cells, settings, extent);
  const target = snapped && transformed(snapped) ? snapped.shape : scaled(shape);
  const length = bracketAxis(target.length, ratio, RANGES.length.max), width = bracketAxis(target.width, ratio, RANGES.thickness.max, 1);
  const candidates = [];
  for (const thickness of width.values) {
    const drawnWidth = communityDimension(thickness, ratio), gap = bracketAxis((target.near + target.far + drawnWidth % 2) / 2,
      ratio, RANGES.gap.max);
    for (const l of length.values) for (const g of gap.values) candidates.push({
      native: { length: l, thickness, gap: g, authoredHeight },
      preference: [Math.abs(l - length.ideal), l, Math.abs(thickness - width.ideal), thickness, Math.abs(g - gap.ideal), g] });
  }
  candidates.sort(order);
  // Plus against T for the first candidate, both against the unfolded old shape drawn with the old flags.
  const flags = { dot: !!settings.dot, t_style: !!settings.t_style }, reference = boxes(scaled(regime.unfolded), flags);
  const first = drawnShape(candidates[0].native, ratio), versus = t_style => alignedBoxIou(boxes(first, { ...flags, t_style }), reference);
  const keepT = versus(true), plus = versus(false);
  const outlineOn = Number(!!settings.outline), alpha = rgba(settings).alpha;
  const features = [ratio, Number(goal === 'screen'), factor, Number(!!settings.dot), Number(!!settings.t_style),
    Number(!!settings.weapon_gap), old.length, old.width, old.near, old.far, CROSSING[regime.crossing], SIZE0[regime.size0],
    Number(settings.size > 0 && old.length === 0), target.length, target.width, target.near, target.far, target.axisStart,
    outlineOn, outlineOn ? settings.outline_width ?? 1 : 0, Number(!!settings.outline_width_rounded), extent.low, extent.high,
    settings.outline === undefined ? 0 : outlineMode(settings), Number(!!settings.alpha_enabled), alpha, old.width % 2,
    shape.width % 2, length.ideal, width.ideal, length.ideal - Math.floor(length.ideal), width.ideal - Math.floor(width.ideal),
    length.values.length, width.values.length, candidates.length, regime.stem.above * factor, regime.stem.below * factor,
    keepT, plus, plus - keepT];
  return { features, candidates, target, ratio, regime, flags, reference, length, width };
}

/** Candidate features: drawn new shape against the target, pixel-cell edges and the closest-ideal preference. */
export function candidateFeatures(input, candidate, index) {
  const { target: t, ratio, flags, reference } = input, { native: n, preference } = candidate, shape = drawnShape(n, ratio);
  const { length, width, near, far, axisStart: axis } = shape, drawn = boxes(shape, flags), old = boxes(t, flags);
  return [length - t.length, width - t.width, near - t.near, far - t.far, width % 2, axis - t.axisStart,
    cell(axis) - cell(t.axisStart), cell(axis + width) - cell(t.axisStart + t.width),
    cell(-near) - cell(-t.near), cell(-near - length) - cell(-t.near - t.length),
    cell(far) - cell(t.far), cell(far + length) - cell(t.far + t.length),
    preference[0], preference[2], preference[4], index, boxIou(drawn, old), alignedBoxIou(drawn, old),
    alignedBoxIou(drawn, reference), alignedBoxIou(boxes(shape, { ...flags, t_style: false }), reference)];
}

/**
 * The appearance window, re-derived from geometry helpers (no solver code): at the pixel goal, with an old
 * outline of any width, a core whose colour-aware look is neither exact nor exact after a 1 px shift moves
 * to the best tuple drawing within ±3 px of bar length, ±3 px of bar width and ±4 px of the gap edge (current pixels,
 * mapped to native values by the authored/current ratio, or as many native steps where that reaches further) that
 * draws the old look strictly better. The gap window reaches as far as the old shape's own inner edges plus 2 px (with
 * a dot, the dot's outline edge, ceil(width / 2) + 2 px), at most 32 px and never below 4; for every gap a second
 * length window (±3) keeps the outer edge of the bars where the pick put it; the bar width window reaches as far,
 * capped at 8, when that is more than 3 (ADR-0019). An old T whose crossed arms were folded (regime crossing full or partial) also tries
 * every tuple as a full cross, which must beat the best T outright. `tStyle` is the old T flag. Returns `core`
 * unchanged out of scope, else the pick with `tStyle`, the exported T flag.
 */
export function appearanceWindow(settings, options, input, core, tStyle, cache = new Map()) {
  const { extent, size0 } = input.regime;
  if (settings.outline === undefined || options.goal !== 'pixels') return core;
  const { rgb, alpha } = rgba(settings), key = c => `${c.join(',')},${alpha}`, black = key([0, 0, 0]);
  const score = appearanceScorer(legacyAppearance(communityLegacy(settings, options.oldHeight), settings, extent,
    { core: key(rgb), outline: black }));
  // Size 0 drawing only outline strokes exports black bars with the outline off.
  const look = { core: size0 === 'outline' ? black : key(rgb), outline: black };
  const drawn = nativeOutlineExtent(settings, size0 === 'outline' ? 0 : outlineMode(settings));
  const dot = !!settings.dot;
  const evaluate = (n, t = tStyle) => {
    const g = communityForward({ ...n, authoredHeight: options.authoredHeight }, options.currentHeight);
    const id = `${g.length},${g.width},${g.near},${t}`;
    if (!cache.has(id)) cache.set(id, score(appearance(g, { dot, t_style: t }, drawn, look, false)));
    return cache.get(id);
  };
  const start = evaluate(core);
  if (start.iou === null || start.aligned === 1) return core;
  const { target: t, ratio, length, width } = input;
  const gapIdeal = thickness => (t.near + t.far + communityDimension(thickness, ratio) % 2) / 2 / ratio;
  const preference = n => [Math.abs(n.length - length.ideal), n.length, Math.abs(n.thickness - width.ideal), n.thickness,
    Math.abs(n.gap - gapIdeal(n.thickness)), n.gap];
  const minLength = core.length > 0 ? 1 : 0, lengthWindow = centre => pixelWindow(
    Math.max(minLength, Math.min(RANGES.length.max, centre)), 3, ratio, minLength, RANGES.length.max, length.ideal);
  const lengths = lengthWindow(core.length), old = input.regime.old;
  const reach = Math.min(32, Math.max(4, Math.ceil(Math.max(Math.abs(old.near), Math.abs(old.far))) + 2,
    settings.dot ? Math.ceil(old.width / 2) + 2 : 0));
  let best = null;
  const thicknesses = pixelWindow(core.thickness, Math.max(3, Math.min(8, reach)), ratio, 1, RANGES.thickness.max, width.ideal);
  const folded = ['full', 'partial'].includes(input.regime.crossing);
  for (const flip of tStyle && folded ? [true, false] : [tStyle]) {
    const floor = flip === tStyle || !best ? start.aligned : best.s.aligned;
    for (const th of thicknesses) {
      const gaps = pixelWindow(core.gap, reach, ratio, RANGES.gap.min, RANGES.gap.max, gapIdeal(th));
      for (const g of gaps)
        for (const l of new Set([...lengths, ...lengthWindow(core.length + core.gap - g)])) {
          const n = { length: l, thickness: th, gap: g }, s = evaluate(n, flip);
          if (s.aligned === null || !(s.aligned > floor + 1e-9)) continue;
          if (best && (s.aligned < best.s.aligned || (s.aligned === best.s.aligned && s.iou < best.s.iou))) continue;
          if (best && s.aligned === best.s.aligned && s.iou === best.s.iou) {
            const a = preference(n), b = preference(best.n), i = a.findIndex((v, k) => v !== b[k]);
            if (i < 0 || a[i] > b[i]) continue;
          }
          best = { n, s, t: flip };
        }
    }
  }
  return best ? { ...core, ...best.n, tStyle: best.t } : core;
}

/**
 * The plain-conversion fallback, re-derived from geometry helpers: when a regime transform or
 * the window shaped the pick, the plain conversion of the untransformed old shape (closest candidates, ties by
 * shift-aligned core overlap, then raw overlap, then the preference order) replaces it if it draws the old look,
 * by colour and with the exported outline mode, strictly better. `picked` is the windowed core, `core` the ranker's.
 */
export function plainFallback(settings, options, input, core, picked, tStyle) {
  const { regime, ratio } = input, pickedT = picked.tStyle ?? tStyle;
  const moved = ['length', 'thickness', 'gap'].some(key => picked[key] !== core[key]) || pickedT !== tStyle;
  if (settings.outline === undefined || (!transformed(regime) && !moved)) return picked;
  const { oldHeight, currentHeight, authoredHeight, goal } = options, factor = goal === 'screen' ? currentHeight / oldHeight : 1;
  const old = regime.old, target = { length: old.length * factor, width: old.width * factor, near: old.near * factor,
    far: old.far * factor, axisStart: old.axisStart * factor };
  const flags = { dot: !!settings.dot, t_style: tStyle }, reference = boxes(target, flags);
  const length = bracketAxis(target.length, ratio, RANGES.length.max), width = bracketAxis(target.width, ratio, RANGES.thickness.max, 1);
  let plain = null;
  for (const thickness of width.values) {
    const gap = bracketAxis((target.near + target.far + communityDimension(thickness, ratio) % 2) / 2, ratio, RANGES.gap.max);
    for (const l of length.values) for (const g of gap.values) {
      const drawn = boxes(drawnShape({ length: l, thickness, gap: g }, ratio), flags), union = drawn.length + reference.length;
      const c = { native: { length: l, thickness, gap: g }, aligned: union ? alignedBoxIou(drawn, reference) : 0,
        iou: union ? boxIou(drawn, reference) : 0,
        preference: [Math.abs(l - length.ideal), l, Math.abs(thickness - width.ideal), thickness, Math.abs(g - gap.ideal), g] };
      if (!plain || c.aligned > plain.aligned || (c.aligned === plain.aligned && (c.iou > plain.iou ||
        (c.iou === plain.iou && order(c, plain) < 0)))) plain = c;
    }
  }
  const { rgb, alpha } = rgba(settings), key = c => `${c.join(',')},${alpha}`, black = key([0, 0, 0]);
  const score = appearanceScorer(legacyAppearance({ ...target, rasterConvention: RAW_EDGE_CONVENTION }, settings,
    regime.extent, { core: key(rgb), outline: black }));
  const choice = outlineChoice(options.outlineMode), automatic = effectiveOutlineMode(settings, options.outlineMode);
  // Size 0 drawing only outline strokes exports black bars, outline off unless chosen by hand.
  const strokes = transformed(regime) && regime.size0 === 'outline';
  const look = (n, black0, mode, t = tStyle) => score(appearance(communityForward({ ...n, authoredHeight }, currentHeight),
    { ...flags, t_style: t },
    nativeOutlineExtent(settings, mode), { core: black0 ? black : key(rgb), outline: black }, false)).aligned;
  const before = look(picked, strokes, strokes && choice === 'auto' ? 0 : automatic, pickedT);
  const after = look(plain.native, false, automatic);
  return before !== null && after !== null && after > before + 1e-9 ? { ...picked, ...plain.native, tStyle } : picked;
}

const evaluateNode = (node, x) => typeof node === 'number' ? node : x[node[0]] <= node[1] ? evaluateNode(node[2], x)
  : evaluateNode(node[3], x);
/** Same summation order as the research trainer's boosted-tree scorer, so scores agree bit for bit. */
export function scoreTrees(block, learningRate, x) {
  let value = block.base;
  for (const tree of block.trees) value += learningRate * evaluateNode(tree, x);
  return value;
}

/** The learner's predicted export state for one input. A hand-chosen outline mode is copied, not predicted. */
export function predictCrossCheck(params, settings, options) {
  const input = crossCheckInput(settings, options), x = input.features;
  let best = input.candidates[0];
  if (input.candidates.length > 1) {
    let top = -Infinity;
    input.candidates.forEach((candidate, i) => {
      const score = scoreTrees(params.ranker, params.ranker.learningRate, [...x, ...candidateFeatures(input, candidate, i)]);
      if (score > top) { top = score; best = candidate; }
    });
  }
  const head = name => scoreTrees(params.heads.outputs[name], params.heads.learningRate, x);
  const modes = [0, 1, 2].map(mode => head(`drawoutline${mode}`));
  const learnedMode = modes.indexOf(Math.max(...modes)), choice = outlineChoice(options.outlineMode);
  const old = rgba(settings), black = head('colorBlack') > .5, mode = choice === 'auto' ? learnedMode : choice;
  const outlineAlpha = choice === 'auto' ? (head('outlineAlphaOld') > .5 ? old.alpha : 255) : mode ? old.alpha : 255;
  const tStyle = !!settings.t_style;
  const picked = appearanceWindow(settings, options, input, best.native, tStyle);
  const { tStyle: exportedT = tStyle, ...tuple } = plainFallback(settings, options, input, best.native, picked, tStyle);
  return { ...tuple, drawoutline: mode, outlineAlpha, color: (black ? [0, 0, 0] : old.rgb).join(' '),
    fillAlpha: head('fillAlphaOld') > .5 ? old.alpha : 255, t_style: exportedT };
}

/** The converter's export state, read from a community report the same way nativeCommands formats it. */
export function converterExportState(report) {
  const o = report.exportOverrides ?? {}, settings = report.settings, base = rgba(settings);
  const mode = effectiveOutlineMode(settings, o.outlineMode ?? report.options.outlineMode);
  const alpha = o.color === undefined ? base.alpha : o.color.alpha;
  return { ...report.chosen.native, drawoutline: mode, outlineAlpha: mode ? alpha : 255,
    color: (o.color?.rgb ?? base.rgb).join(' '), fillAlpha: o.color === undefined ? exportFillAlpha(settings) : alpha,
    t_style: !!(o.t_style ?? settings.t_style) };
}

const fingerprints = new WeakMap();
/** FNV-1a of the canonical parameter JSON; detects a parameter file edited or mixed with another release. */
export function parametersHash(params) {
  if (!fingerprints.has(params)) fingerprints.set(params, hash(JSON.stringify({ schema: params.schema,
    targetVersion: params.targetVersion, featureNames: params.featureNames, ranker: params.ranker, heads: params.heads })));
  return fingerprints.get(params);
}

/** `current` when the parameters were trained for the shipped converter and are intact, else the stale reason. */
export function parameterStatus(params, summary = null) {
  if (!params || params.schema !== CROSSCHECK_SCHEMA) return 'missing';
  if (params.targetVersion !== COMMUNITY_MODEL.version || params.targetBuild !== COMMUNITY_MODEL.build) return 'stale-version';
  if (JSON.stringify(params.featureNames) !== JSON.stringify({ input: INPUT_FEATURES, candidate: CANDIDATE_FEATURES, heads: HEADS }))
    return 'stale-features';
  if (parametersHash(params) !== params.parametersHash) return 'stale-hash';
  if (summary && (summary.targetVersion !== params.targetVersion || summary.parametersHash !== params.parametersHash))
    return 'stale-summary';
  return 'current';
}

/** Compare the learner with the converter on one community report. The learner imitates the corrected converter, so
 * a report with the automatic appearance corrections off is not checked (`corrections-off`). */
export function crossCheck(params, report, summary = null) {
  if (report.options?.corrections === false) return { status: 'corrections-off' };
  const status = parameterStatus(params, summary);
  if (status !== 'current') return { status };
  const predicted = predictCrossCheck(params, report.settings, report.options), converter = converterExportState(report);
  const differs = EXPORT_STATE_KEYS.filter(key => predicted[key] !== converter[key]);
  return { status: differs.length ? 'differs' : 'agrees', predicted, converter, differs };
}
