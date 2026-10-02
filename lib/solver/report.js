import { VERSION, BUILD, MODELS, forward, naiveAssignment } from './renderer.js';
import { localSupport } from './corpus.js';
import { proposeExperiment } from './experiments.js';
import { exactPreimage } from './inverse.js';
import { RASTER_CONVENTION, drawingEdges, outlineOnly } from '../geometry/raster.js';
import { NATIVE_RANGES, NATIVE_RANGES_2000922, outlineMode, outlineChoice, effectiveOutlineMode, outlineRounded, legacyOutlineExtent,
  optionWarnings, colorIndexUnknown, rgba, COLOR_INDEX_NOTE, OUTLINE_ONLY_NOTE, OUTLINE_REDUCED_NOTE, OUTLINE_ALPHA_NOTE,
  OUTLINE_ROUNDED_NOTE } from '../settings/native.js';

const warning = (code, text) => ({ code, text });

const ideal6 = value => Number(value.toFixed(6));
/** Warning for old outlines that drew unevenly (width above 1) but export as a full 1 px outline.
 * `override` is the export option `outlineMode`; the warning applies only when the exported mode is 1. */
export function outlineAsymmetryWarning(settings, override = 'auto') {
  const { low, high } = legacyOutlineExtent(settings);
  return low !== high && effectiveOutlineMode(settings, override) === 1
    ? warning('outline-asymmetric-approx', `Old outline thickness ${settings.outline_width} drew ${low} px on the top/left ` +
      `and ${high} px on the bottom/right; the new full outline is 1 px all round.`) : null;
}

/** Warning for old outlines that drew the same width above 1 on every side but export as a 1 px outline.
 * Unequal sides are covered by the asymmetric warning instead. */
export function outlineReducedWarning(settings, override = 'auto') {
  const { low, high } = legacyOutlineExtent(settings);
  return low === high && low > 1 && effectiveOutlineMode(settings, override) === 1
    ? warning('outline-width-reduced', OUTLINE_REDUCED_NOTE(settings.outline_width, low)) : null;
}

/** Every outline warning for (settings, options), shared by the community and historical reports so the same input
 * gets the same set. Mode-dependent notes follow the exported mode (`effectiveOutlineMode`), not the automatic one. */
export function outlineWarnings(settings, options = {}) {
  const automatic = outlineMode(settings), mode = effectiveOutlineMode(settings, options.outlineMode);
  const byHand = outlineChoice(options.outlineMode) !== 'auto';
  const out = [];
  if (settings.outline && automatic === 0 && !byHand)
    out.push(warning('outline-zero-width', 'Old outline thickness 0 drew no visible outline; export turns the outline off.'));
  if (outlineRounded(settings)) out.push(warning('outline-sharecode-rounded', OUTLINE_ROUNDED_NOTE));
  if (mode === 2 && !byHand)
    out.push(warning('outline-half-mapping', 'Old outline thickness below 1 drew only the top-left edge; ' +
      'export uses the half outline (cl_crosshair_drawoutline 2). Not checked against game captures.'));
  if (mode && rgba(settings).alpha < 255) out.push(warning('outline-alpha-unverified', OUTLINE_ALPHA_NOTE));
  if (mode === 1) out.push(warning('outline-replacement-unverified',
    'The native outline replacement is unverified; only the colored core is compared.'));
  for (const entry of [outlineAsymmetryWarning(settings, options.outlineMode), outlineReducedWarning(settings, options.outlineMode)])
    if (entry) out.push(entry);
  return out;
}

/** Warning for share-code colour indexes 6 and 7, which convert with the stored RGB. */
export const colorIndexWarning = settings =>
  colorIndexUnknown(settings) ? warning('color-index-unknown', COLOR_INDEX_NOTE(settings.color)) : null;

/** Output dimensions clamped or approximated away from the ideal. `ideals` is `{ length, thickness, gap }`
 * in native units; `native` holds the exported values. Plain rounding to the nearest step is not listed.
 * `ranges` is the target build's native range (historical models target build 2000914, thickness 0..31);
 * `outlineMode` is the export override, so an outline entry states the mode actually exported. */
export function clampedOutputs(settings, ideals, native, { ranges = NATIVE_RANGES_2000922, outlineMode: override = 'auto' } = {}) {
  const out = [], RANGES = ranges;
  const add = (field, wanted, exported, reason) => out.push({ field, wanted: ideal6(wanted), exported, reason });
  for (const field of ['length', 'thickness', 'gap']) {
    const wanted = ideals[field], { max } = RANGES[field];
    if (!Number.isFinite(wanted)) continue;
    if (wanted > max) add(field, wanted, native[field], 'above-maximum');
    else if (field === 'gap' && wanted < 0) add(field, wanted, native[field], 'negative-gap-clamped-to-zero');
    else if (field !== 'gap' && wanted < 0) add(field, wanted, native[field], 'below-minimum');
  }
  if (settings.thickness === 0 && native.thickness !== 0) add('thickness', 0, native.thickness, 'visible-minimum');
  const exportedMode = effectiveOutlineMode(settings, override);
  if (outlineAsymmetryWarning(settings, override)) add('outline', settings.outline_width, exportedMode, 'outline-asymmetric-approx');
  if (outlineReducedWarning(settings, override)) add('outline', settings.outline_width, exportedMode, 'outline-width-reduced');
  return out;
}

/** Warnings are data (`{ code, text }`), not bare strings. `text` stays human-readable. */
function warningsFor(settings, state, visual, target, chosenNative, hasMask, options) {
  const warnings = [
    warning('conditional-renderer-simulation', 'New previews are conditional renderer simulations, not native CS2 captures.'),
    warning('direct-copy-not-migration', 'Direct copy truncates/clamps numbers; it does not reproduce Valve’s migration code.'),
    warning('shape-loss-excludes-appearance', 'Shape loss excludes color, alpha, outlines and recoil motion.'),
  ];
  const conditions = [
    [settings.recoil, warning('recoil-motion-not-modeled', 'Follow-recoil is exported, but motion is not modeled.')],
    [state.allModelConflict, warning('model-conflict', 'All hypotheses conflict with native calibration evidence. Do not interpret the normalized winner as reliable.')],
    [!state.calibrationGroups, warning('no-native-calibration', 'No independent new-renderer calibration: weights remain prior-only; native confidence is unidentified.')],
    [visual.targetMask.cropped, warning('target-cropped', 'The measured target is cropped; an exact image-match claim is disabled.')],
    [visual.previewCropped && !hasMask, warning('preview-cropped', 'The preview crops this large shape. The analytical loss still measures the complete pixel union.')],
    [hasMask, warning('image-mask-noisy', 'The image-derived mask is noisy and does not uniquely identify the old cvars.')],
    [visual.targetArea === 0, !hasMask && outlineOnly(target, settings, legacyOutlineExtent(settings))
      ? warning('outline-only-legacy', OUTLINE_ONLY_NOTE)
      : warning('empty-geometry', 'No visible colored geometry. Empty agreement is not an IoU score or rendering evidence.')],
    [colorIndexWarning(settings), colorIndexWarning(settings)],
    [settings.thickness === 0 && target.width !== 1 && !hasMask, warning('literal-zero-conflict', 'The literal-zero minimum conflicts with the requested screen-relative thickness.')],
    [settings.thickness > 0 && chosenNative.thickness === 0, warning('zero-thickness-branch', 'A positive legacy thickness resolved to new thickness 0 (the zero-thickness branch). It renders the one-pixel minimum and may behave differently at other resolutions; treat this as a conversion limitation, not an exact match.')],
  ];
  for (const [condition, entry] of conditions) if (condition) warnings.push(entry);
  warnings.push(...outlineWarnings(settings, options), ...optionWarnings(settings, options));
  // Every declared renderer id scales gap by `r` (renderer.js forward()). The build 2000914
  // dump does not say gap scales, so the chosen model is a hypothesis and its rival is not
  // ruled out. Residual modulation stays closed; see the v0.4 plan §2.7.
  warnings.push(warning('gap-scale-unresolved', 'Gap scaling is not stated in the build 2000914 cvar description. This hypothesis scales gap with length. The unscaled-gap rival is not ruled out.'));
  return warnings;
}

export function buildReport({ settings, o, legacy, target, state, visual, proposals, ranked, chosen, renderer, records, hasMask,
  targetOverride = null, blockers, started, certify = false, preserveZero = false }) {
  const converted = forward(chosen.native, o.currentHeight, renderer);
  const naive = naiveAssignment(settings, o.authoredHeight), naiveGeometry = forward(naive, o.currentHeight, renderer);
  const convertedFit = visual.score(converted);
  const exact = hasMask || targetOverride?.rasterConvention || targetOverride?.axisStart !== undefined ? {
    complete: false, count: null, sample: [], constrainedNearFar: target.length > 0,
    scope: 'Measured pixel preimage is not enumerated. The legacy arithmetic preimage does not describe this image target.',
  } : exactPreimage({ settings, options: o, model: renderer, preserveZero, targetOverride });
  const warnings = warningsFor(settings, state, visual, target, chosen.native, hasMask, o);
  const ratio = o.currentHeight / o.authoredHeight;
  const clamped = clampedOutputs(settings, { length: target.length / ratio, thickness: target.width / ratio,
    gap: (target.near - Math.floor(target.width / 2)) / ratio }, chosen.native, { ranges: NATIVE_RANGES, outlineMode: o.outlineMode });
  return {
    schema: 'sicc-quant-report-v6', version: VERSION, targetBuild: BUILD, options: o, settings, legacy, target,
    targetKind: hasMask ? 'image-derived' : targetOverride ? 'measured-geometry' : 'synthetic-old-reconstruction',
    chosen, renderer, converted, naive, naiveGeometry,
    naiveFit: visual.score(naiveGeometry), convertedFit,
    rendering: { convention: RASTER_CONVENTION, evidence: 'Illustrative placement; not native-validated.',
      targetEdges: hasMask ? null : drawingEdges(target), convertedEdges: drawingEdges(converted),
      rawOffsets: 'Geometry near/far fields retain the arithmetic model offsets. Even-width synthetic bars draw the far edge one pixel earlier. Measured masks are unchanged.' },
    confidence: { nativeMatchProbability: null, status: state.mode, conditionalFamilyMass: chosen.exactMass,
      expectedShapeOverlap: chosen.expectedIou, priorSensitivity: chosen.priorSensitivity,
      interpretation: 'Conditional agreement within an explicit hypothesis set, not calibrated native correctness.' },
    posterior: state,
    models: MODELS.map((m, i) => ({ ...m, weight: state.weights[i], native: proposals[i].native,
      conditionalIou: proposals[i].visual.iou, geometryLoss: proposals[i].visual.geometryLoss,
      inverseCertificate: proposals[i].inverseCertificate, refinement: proposals[i].trace })),
    candidates: ranked.candidates.map(({ scores, ...candidate }) => candidate),
    preimage: { model: renderer.id, complete: exact.complete, count: exact.count,
      constrainedNearFar: exact.constrainedNearFar, sample: exact.sample, scope: exact.scope },
    decision: { rule: ranked.decision, searchPolicy: ranked.searchPolicy, certificate: ranked.certificate, trace: ranked.decisionTrace,
      scope: certify
        ? 'Best among evaluated legal proposals plus the opt-in certified expansion over the declared integer domain. A global claim is made only for the states named by certificate.method; shell-monotone relies on a documented, spot-checked monotonicity assumption, and unproven/not-evaluated makes no global claim.'
        : 'Best among evaluated legal proposals and two bounded neighborhood passes, including two-cell length jumps. No global claim: pass certify: true to attempt a certified global expansion.' },
    coverage: localSupport(settings, records), experiment: proposeExperiment(state), blockers,
    warnings, clamped,
    search: { maxRefinementPasses: 2, maxNeighborsPerPass: 124, maxDecisionPasses: 2, maxCandidates: 81,
      certifiedCandidates: certify && !chosen.manual ? ranked.candidates.length : 0,
      certifiedEvaluations: ranked.certificate?.evaluated ?? 0,
      proposalEvaluations: proposals.reduce((n, p) => n + p.evaluations, 0),
      uniqueShapeEvaluations: visual.size(), uniqueRasterEvaluations: 0, engine: visual.engine,
      durationMs: performance.now() - started,
      status: visual.targetArea === 0 ? 'empty-shape' : convertedFit.iou === 1 ? 'exact-under-selected-simulation' : 'bounded-search-ended-with-residual',
      nativeEvidenceUpdatedBySyntheticLoop: false },
  };
}
