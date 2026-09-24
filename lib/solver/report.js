import { VERSION, BUILD, MODELS, forward, naiveAssignment } from './renderer.js';
import { localSupport } from './corpus.js';
import { proposeExperiment } from './experiments.js';
import { exactPreimage } from './inverse.js';
import { RASTER_CONVENTION, drawingEdges } from '../geometry/raster.js';

const warning = (code, text) => ({ code, text });

/** Warnings are data (`{ code, text }`), not bare strings. `text` stays human-readable. */
function warningsFor(settings, state, visual, target, chosenNative, hasMask) {
  const warnings = [
    warning('conditional-renderer-simulation', 'New previews are conditional renderer simulations, not native CS2 captures.'),
    warning('direct-copy-not-migration', 'Direct copy truncates/clamps numbers; it does not reproduce Valve’s migration code.'),
    warning('shape-loss-excludes-appearance', 'Shape loss excludes color, alpha, outlines and recoil motion.'),
  ];
  const conditions = [
    [settings.outline, warning('outline-replacement-unverified', 'The native outline replacement is unverified; only the colored core is optimized.')],
    [settings.recoil, warning('recoil-motion-not-modeled', 'Follow-recoil is exported, but motion is not modeled.')],
    [state.allModelConflict, warning('model-conflict', 'All hypotheses conflict with native calibration evidence. Do not interpret the normalized winner as reliable.')],
    [!state.calibrationGroups, warning('no-native-calibration', 'No independent new-renderer calibration: weights remain prior-only; native confidence is unidentified.')],
    [visual.targetMask.cropped, warning('target-cropped', 'The measured target is cropped; an exact image-match claim is disabled.')],
    [visual.previewCropped && !hasMask, warning('preview-cropped', 'The preview crops this large shape. The analytical loss still measures the complete pixel union.')],
    [hasMask, warning('image-mask-noisy', 'The image-derived mask is noisy and does not uniquely identify the old cvars.')],
    [visual.targetArea === 0, warning('empty-geometry', 'No visible colored geometry. Empty agreement is not an IoU score or rendering evidence.')],
    [settings.thickness === 0 && target.width !== 1 && !hasMask, warning('literal-zero-conflict', 'The literal-zero minimum conflicts with the requested screen-relative thickness.')],
    [settings.thickness > 0 && chosenNative.thickness === 0, warning('zero-thickness-branch', 'A positive legacy thickness resolved to new thickness 0 (the zero-thickness branch). It renders the one-pixel minimum and may behave differently at other resolutions; treat this as a conversion limitation, not an exact match.')],
  ];
  for (const [condition, entry] of conditions) if (condition) warnings.push(entry);
  // Every declared renderer id scales gap by `r` (renderer.js forward()). The build 2000914
  // dump does not say gap scales, so the chosen model is a hypothesis and its rival is not
  // ruled out. Residual modulation stays closed; see the v0.4 plan §2.7.
  warnings.push(warning('gap-scale-unresolved', 'Gap scaling is not stated in the build 2000914 cvar description. This hypothesis scales gap with length. The unscaled-gap rival is not ruled out.'));
  return warnings;
}

export function buildReport({ settings, o, legacy, target, state, visual, proposals, ranked, chosen, renderer, records, hasMask, blockers, started, certify = false, preserveZero = false }) {
  const converted = forward(chosen.native, o.currentHeight, renderer);
  const naive = naiveAssignment(settings, o.authoredHeight), naiveGeometry = forward(naive, o.currentHeight, renderer);
  const convertedFit = visual.score(converted);
  const exact = exactPreimage({ settings, options: o, model: renderer, preserveZero });
  const warnings = warningsFor(settings, state, visual, target, chosen.native, hasMask);
  return {
    schema: 'sicc-quant-report-v4', version: VERSION, targetBuild: BUILD, options: o, settings, legacy, target,
    targetKind: hasMask ? 'image-derived' : 'synthetic-old-reconstruction', chosen, renderer, converted, naive, naiveGeometry,
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
    warnings,
    search: { maxRefinementPasses: 2, maxNeighborsPerPass: 28, maxDecisionPasses: 2, maxCandidates: 81,
      certifiedCandidates: certify && !chosen.manual ? ranked.candidates.length : 0,
      certifiedEvaluations: ranked.certificate?.evaluated ?? 0,
      proposalEvaluations: proposals.reduce((n, p) => n + p.evaluations, 0),
      uniqueShapeEvaluations: visual.size(), uniqueRasterEvaluations: 0, engine: visual.engine,
      durationMs: performance.now() - started,
      status: visual.targetArea === 0 ? 'empty-shape' : convertedFit.iou === 1 ? 'exact-under-selected-simulation' : 'bounded-search-ended-with-residual',
      nativeEvidenceUpdatedBySyntheticLoop: false },
  };
}
