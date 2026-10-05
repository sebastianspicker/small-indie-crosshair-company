/** Direct static conversion, deliberately outside the historical 27-model probability family. */
import { COMMUNITY_MODEL, communityLegacy, communityForward } from '../geometry/community.js';
import { drawingEdges, RAW_EDGE_CONVENTION } from '../geometry/raster.js';
import { axisStartOf, snapToCells } from '../geometry/edge-cases.js';
import { legacyGeometry } from '../geometry/legacy.js';
import { scope, targetGeometry, naiveAssignment, unsupported } from './renderer.js';
import { searchCommunity } from './community-search.js';
import { refineAppearance } from './community-refine.js';
import { clampedOutputs, outlineWarnings, colorIndexWarning, legacySettingWarnings, outlineChoiceMootWarning } from './report.js';
import { visualContext } from './visual.js';
import { localSupport } from './corpus.js';
import { communityEvidence } from './community-evidence.js';
import { optionWarnings, effectiveOutlineMode, legacyOutlineExtent, LEGACY_STYLE_5_NOTE } from '../settings/native.js';
import { edgeCaseTarget, edgeCaseOverrides, edgeCaseWarnings, shapeCheck, overpaintWarning, exportDraws } from './community-edge.js';

const warn = (code, text) => ({ code, text });
const FALLBACK_EPSILON = 1e-9;
const percent = value => `${Math.floor(100 * value)}%`;
/** Warning codes that explain why a shape check is approximate; `shape-approximate` is added when none applies. */
export const LOSS_WARNINGS = Object.freeze(['dimension-limit', 'appearance-refined', 'pixel-centering-shift',
  'corrections-fallback', 'corrections-off', 'export-draws-nothing', 'zero-length-outline-dropped', 'outline-overpaint-lost',
  'inverted-t-unrepresentable', 't-flipped-for-shape', 'outline-width-reduced', 'outline-asymmetric-approx', 'outline-user-override',
  'shape-approximate']);
const SOURCE_SCOPE = 'Public converter observations and a community renderer reconstruction; not native-validated. ' +
  'Build 2000922 moved crosshair layout to a new native renderer; the equations are carried over from 2000918 unverified.';

/** Invert three monotone integer axes. Preserve bar dimensions before matching the centre radius, then (unless
 * `options.corrections` is false) run the visible-appearance refinement `refineAppearance`, which may
 * move the integers to draw the old visible pixels better. No statistical fit or learned weights.
 */
export function solveCommunity(settings, options = {}, measured = null, targetMask = null) {
  const o = scope(options), legacy = communityLegacy(settings, o.oldHeight);
  // Validate measured input through the existing public target contract.
  const source = measured ? targetGeometry(settings, { ...o, goal: 'pixels' }, measured).target : legacy;
  const factor = o.goal === 'screen' ? o.currentHeight / o.oldHeight : 1;
  const scaled = geometry => {
    const target = { ...geometry };
    for (const key of ['length', 'width', 'near', 'far']) target[key] *= factor;
    if (factor !== 1) {
      const edges = drawingEdges(geometry);
      target.near = edges.near * factor; target.far = edges.far * factor;
      target.axisStart = axisStartOf(geometry) * factor;
      target.rasterConvention = RAW_EDGE_CONVENTION;
    }
    return target;
  };
  const target = scaled(source), legacyInput = !measured && !targetMask && o.corrections;
  // Edge-case rules: fit a target with non-negative inner edges, score ties against the visible old shape. With the
  // automatic appearance corrections off the legacy target stays literal (plain dimension-first conversion).
  // A screen goal applies the rules to the whole pixels the scaled old shape covers, so the redrawn arms are sized in
  // current pixels; scaling an old-pixel redraw rounds its length and width apart (arms past the dot, folds that miss).
  const plan = edgeCaseTarget(source, settings, legacyInput), cells = factor !== 1 && plan.cases.length ? snapToCells(target) : null;
  const snapped = cells && edgeCaseTarget(cells, settings, true);
  const path = snapped?.cases.length
    ? { plan: snapped, canonical: snapped.target, reference: snapped.reference === cells ? target : snapped.reference }
    : { plan, canonical: plan.target === source ? target : scaled(plan.target),
      reference: plan.reference === source ? target : scaled(plan.reference) };
  const solvePath = ({ canonical, reference }, corrected) => {
    // The T flag is always kept: a crossed T draws its single vertical arm below the centre.
    const solved = { ...searchCommunity(canonical, settings, o, targetMask, reference, settings), flags: settings };
    // Appearance window: a nearby tuple may draw the old visible pixels (colour and outline) better than the closest dimensions.
    // Scored with the automatic outline mode, so export options never change the numbers; bare geometry has no look.
    // Pixel goal only (a screen goal's scaled target is a model artefact), for every old outline width (ADR-0019):
    // the score is colour-aware, so a coloured core widens only when that matches more old pixels, and the new outline
    // stays 1 px (`outline-width-reduced`, `outline-asymmetric-approx`).
    if (!corrected || settings.outline === undefined || o.goal !== 'pixels') return solved;
    const auto = { ...o, outlineMode: 'auto' };
    return refineAppearance(solved, { settings, target, canonical, plan: path.plan,
      overrides: edgeCaseOverrides(settings, auto, path.plan.cases), options: auto });
  };
  const corrected = { ...path, solved: solvePath(path, legacyInput) };
  if (!path.plan.cases.length && !corrected.solved.refinement?.applied)
    return { ...corrected.solved, target, canonical: path.canonical, reference: path.reference, plan: path.plan,
      fallback: null, legacy, options: o };
  // The corrections never export a worse shape check than the plain conversion (corrections off) of the same input:
  // the plain one is exported only when it is strictly better.
  const plainPlan = edgeCaseTarget(source, settings, false), plain = { plan: plainPlan, canonical: target, reference: target };
  plain.solved = solvePath(plain, false);
  const look = ({ solved }, cases) => settings.outline === undefined ? visualContext(target, settings).aligned(solved.predicted)
    : shapeCheck({ settings, flags: solved.flags, target, converted: solved.predicted, overrides: edgeCaseOverrides(settings, o, cases),
      options: o }).alignedIou;
  const before = look(corrected, path.plan.cases), after = look(plain, []);
  const applied = before !== null && after !== null && after > before + FALLBACK_EPSILON, chosen = applied ? plain : corrected;
  return { ...chosen.solved, target, canonical: chosen.canonical, reference: chosen.reference, plan: chosen.plan,
    fallback: { applied, cases: path.plan.cases, refined: Boolean(corrected.solved.refinement?.applied),
      corrected: { native: corrected.solved.native, alignedIou: before }, plain: { native: plain.solved.native, alignedIou: after } },
    legacy, options: o };
}

export function inferCommunity({ settings, options, records, targetOverride, targetMask, measurements }) {
  const started = performance.now(), solved = solveCommunity(settings, options, targetOverride, targetMask);
  const evidence = communityEvidence(measurements);
  const { native, predicted: converted, target, canonical, reference, plan, flags, legacy, options: o } = solved;
  if (targetMask && o.goal === 'screen' && o.oldHeight !== o.currentHeight)
    throw new Error('Image targets cannot silently rescale measured evidence. Match source pixels or keep the same height.');
  const visual = visualContext(reference, flags, targetMask, settings), convertedFit = visual.score(converted);
  // ADR-0019: the window may export an old crossed T as a full cross; the override carries the flag the export uses.
  const tFlipped = Boolean(settings.t_style) !== Boolean(flags.t_style);
  const exportOverrides = { ...edgeCaseOverrides(settings, o, plan.cases), ...(tFlipped ? { t_style: flags.t_style } : {}) };
  const outlineScope = exportOverrides.outlineMode === undefined ? o : { ...o, outlineMode: exportOverrides.outlineMode };
  const naive = naiveAssignment(settings, o.authoredHeight), naiveGeometry = communityForward(naive, o.currentHeight);
  const baseline = legacyGeometry(settings, o.oldHeight);
  const warnings = [
    warn('community-reconstruction', SOURCE_SCOPE),
    warn('shape-loss-excludes-appearance',
      'Core overlap (no shift) measures the colored core only; outlines, alpha and recoil are excluded.'),
  ];
  if (settings.style === 5)
    warnings.push(warn('legacy-style-5-gap', LEGACY_STYLE_5_NOTE(o.oldHeight, legacy.gapOffset, baseline.gapOffset)));
  if (!targetOverride && (baseline.length !== legacy.length || baseline.width !== legacy.width))
    warnings.push(warn('legacy-rounding-disagreement',
      'Two readings of the old game give your size or thickness different whole pixels: rounding, or dropping the ' +
      'fraction. The converter rounds, as other converters and community measurements do; the old game may have ' +
      'drawn it one pixel smaller.'));
  const check = shapeCheck({ settings, flags, target, converted, overrides: exportOverrides, options: o, targetMask });
  const oddWidth = Boolean(converted.width % 2 || canonical.width % 2);
  // Every shifted export names the shift: odd widths centre on other pixels, and scaling rounds the edges apart.
  if ((oddWidth && check.status !== 'exact') || check.status === 'shifted')
    warnings.push(warn('pixel-centering-shift', oddWidth
      ? 'Bars an odd number of pixels wide sit on a different centre pixel in the new game, so the crosshair may ' +
        'appear one pixel off. The sizes still match.'
      : 'Rounding the old shape to whole pixels on your screen moves it by up to one pixel. The sizes still match.'));
  if (solved.fallback?.applied)
    warnings.push(warn('corrections-fallback', 'The plain conversion matched the old crosshair better here, so it is ' +
      `exported without the automatic appearance corrections (shape check ${percent(solved.fallback.plain.alignedIou)} ` +
      `against ${percent(solved.fallback.corrected.alignedIou)} with them, best over 1 px shifts).`));
  if (solved.refinement?.applied)
    warnings.push(warn('appearance-refined',
      'A nearby length, thickness or gap draws the old visible pixels (colour and outline) better than the closest ' +
      'sizes, so it is exported. The preview shows the remaining difference.'));
  else if (check.status !== 'exact' &&
    (converted.length !== canonical.length || converted.width !== canonical.width || converted.near !== solved.radius))
    warnings.push(warn('dimension-limit',
      'Integer steps or setting limits prevent preserving every dimension. The preview shows the remaining mismatch.'));
  if (solved.solutions.gap.ideal < 0)
    warnings.push(warn('negative-gap-static-unverified',
      'Build 2000922 accepts negative cl_crosshair_gap values, but Valve only enables negative gaps for Classic Dynamic; ' +
      'Static Cross with a negative gap is unverified, so the overlap is clamped to gap 0.'));
  if (settings.thickness === 0)
    warnings.push(warn('visible-minimum', 'Old thickness 0 drew a visible minimum; export uses a positive thickness to retain it.'));
  // Its text calls the export the closest shape the window found, which holds only for the corrected export.
  const overpaint = targetMask || targetOverride || !o.corrections || solved.fallback?.applied ? null
    : overpaintWarning(settings, target, check.status);
  const exportedMode = effectiveOutlineMode(settings, outlineScope.outlineMode);
  const draws = exportDraws({ settings, flags, converted, overrides: exportOverrides, options: o });
  if (!o.corrections && !targetMask && !targetOverride)
    warnings.push(warn('corrections-off', 'Automatic appearance corrections are off, so the export is the plain ' +
      'dimension-first conversion: crossed arms clamp to gap 0, size 0 keeps length 0 and no nearby length, thickness ' +
      'or gap is tried. The shape check shows what this loses' + (draws ? '.' : '; this export draws nothing in the ' +
      'current game, outline included.')));
  if (tFlipped)
    warnings.push(warn('t-flipped-for-shape', 'The old T crossed the centre, so its single vertical arm was above the ' +
      "centre. The current game draws a T's arm below the centre, so the export draws a full cross, whose top arm " +
      'reproduces the old arm; the extra bottom arm is the difference.'));
  warnings.push(...edgeCaseWarnings({ ...settings, t_style: flags.t_style }, plan, check.status, exportedMode),
    ...(overpaint ? [overpaint] : []),
    ...outlineWarnings(settings, outlineScope),
    ...optionWarnings(settings, o), ...legacySettingWarnings(settings, exportOverrides));
  const color = colorIndexWarning(settings), moot = outlineChoiceMootWarning(flags, o, native.length);
  if (color) warnings.push(color);
  if (moot) warnings.push(moot);
  if (visual.targetMask.cropped)
    warnings.push(warn('target-cropped', 'The measured target is cropped; exact image matching is unavailable.'));
  // Only when the export draws nothing: a sub-pixel old shape can still convert to visible bars. An old shape that drew
  // pixels (outline strokes, an image) is not empty; the export then loses all of it.
  if (!draws) warnings.push(check.status === 'empty'
    ? warn('empty-geometry', 'No visible colored geometry; empty agreement is not rendering evidence.')
    : warn('export-draws-nothing', `The export has length ${native.length} and no dot, so the current game draws ` +
      'nothing for it, outline included (user capture, issue #11), although the old crosshair drew visible pixels.' +
      (o.corrections ? '' : ' With the automatic appearance corrections on, such shapes are redrawn as visible bars.')));
  // Every approximate export names at least one cause of the loss.
  if (check.status === 'approximate' && !warnings.some(entry => LOSS_WARNINGS.includes(entry.code)))
    warnings.push(warn('shape-approximate', `The export draws ${percent(check.alignedIou)} of the old visible pixels ` +
      '(best over 1 px shifts): integer steps and rounding to whole pixels change the shape. The preview shows the difference.'));
  if (evidence.gapCapturesUnmodeled)
    warnings.push(warn('native-capture-outside-model',
      `${evidence.gapCapturesUnmodeled} native capture(s) use a gap outside 0–128; they are listed but not evaluated.`));
  if (evidence.holdoutTests.some(group => !group.matches))
    warnings.unshift(warn('native-holdout-conflict', 'The reconstruction conflicts with at least one supplied native holdout group.'));
  const trace = [{ pass: 0, native, iou: convertedFit.iou, loss: convertedFit.loss,
    reason: 'Minimum dimension errors, closest radius per tied width, then shift-aligned and exact overlap across all resulting shapes.' }];
  const certificate = { global: false, method: 'not-evaluated', improved: false, evaluated: solved.axisEvaluations,
    scope: 'Exact per-axis size fit, not a global pixel-overlap optimum or a native match certificate.' };
  const preimage = { model: COMMUNITY_MODEL.id, complete: false, count: null, sample: [],
    constrainedNearFar: canonical.length > 0,
    scope: 'Pixel preimage is not enumerated for the community reconstruction. No exact-match count is claimed.' };
  const chosen = { native, trace, solutions: solved.solutions, refined: false, inverseCertificate: null,
    traceModelId: COMMUNITY_MODEL.id, proposedBy: [COMMUNITY_MODEL.id],
    exactMass: null, expectedIou: null, priorSensitivity: null };
  return {
    schema: 'sicc-quant-report-v6', version: COMMUNITY_MODEL.version, targetBuild: COMMUNITY_MODEL.build,
    exportBuild: COMMUNITY_MODEL.build,
    options: o, settings, legacy, target, canonicalTarget: canonical, exportOverrides,
    edgeCase: { cases: plan.cases, fold: plan.fold, shift: plan.shift, exportedFlags: { dot: flags.dot, t_style: flags.t_style } },
    targetKind: targetMask ? 'image-derived' : targetOverride ? 'measured-geometry' : 'community-old-reconstruction',
    provenance: { kind: 'external-community-model', nativeValidated: false,
      audit: 'docs/research/build-2000922-update-2026-10-01.md', scope: SOURCE_SCOPE },
    renderer: COMMUNITY_MODEL, chosen, converted, naive, naiveGeometry, convertedFit, naiveFit: visual.score(naiveGeometry),
    rendering: { convention: converted.rasterConvention, evidence: SOURCE_SCOPE,
      targetEdges: drawingEdges(canonical), convertedEdges: drawingEdges(converted) },
    confidence: { nativeMatchProbability: null, conditionalFamilyMass: null, expectedShapeOverlap: null,
      declaredResidualsPx: { length: converted.length - canonical.length, width: converted.width - canonical.width,
        axisStart: 0 - Math.ceil(converted.width / 2) - axisStartOf(canonical),
        ...(canonical.length > 0 ? { near: converted.near - drawingEdges(canonical).near,
          far: converted.far - drawingEdges(canonical).far } : {}) },
      minimumLossChoices: Object.fromEntries(Object.entries(solved.solutions).map(([key, value]) => [key, value.equivalents.length])),
      scope: 'Residuals and ambiguity are conditional on the reconstruction; no native-match probability is identified.' },
    posterior: { ...evidence, weights: [],
      warning: 'This direct reconstruction is outside the historical 27-model family. Select a historical model to inspect that study.' },
    measurementChecks: evidence.measurementChecks,
    models: [{ ...COMMUNITY_MODEL, native, weight: null, conditionalIou: convertedFit.iou }], candidates: [chosen],
    preimage, decision: { rule: 'preserve-dimensions', searchPolicy: 'finite-dimension-ties-v4', certificate, trace,
      tieBreak: solved.tieBreak, refinement: solved.refinement ?? null, correctionsFallback: solved.fallback ?? null,
      scope: certificate.scope }, coverage: localSupport(settings, records), experiment: null,
    blockers: unsupported(settings), warnings,
    clamped: clampedOutputs(settings, Object.fromEntries(Object.entries(solved.solutions)
      .map(([key, value]) => [key, value.ideal])), native, { outlineMode: outlineScope.outlineMode }),
    shapeCheck: check,
    search: { maxCandidates: solved.tieBreak.evaluated, proposalEvaluations: solved.axisEvaluations,
      tieShapeEvaluations: solved.tieBreak.evaluated, uniqueShapeEvaluations: visual.size(), uniqueRasterEvaluations: 0,
      engine: visual.engine, durationMs: performance.now() - started, nativeEvidenceUpdatedBySyntheticLoop: false,
      status: 'source-labelled-static-conversion' },
  };
}
