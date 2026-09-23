import { VERSION, BUILD, MODELS, forward, naiveAssignment } from './renderer.js';
import { localSupport } from './corpus.js';
import { proposeExperiment } from './evidence.js';
import { exactPreimage } from './inverse.js';
import { RASTER_CONVENTION, drawingEdges } from '../raster.js';

function warningsFor(settings, state, visual, target, chosenNative, hasMask) {
  const warnings = ['New previews are conditional renderer simulations, not native CS2 captures.',
    'Direct copy truncates/clamps numbers; it does not reproduce Valve’s migration code.',
    'Shape loss excludes color, alpha, outlines and recoil motion.'];
  const conditions = [
    [settings.outline, 'The native outline replacement is unverified; only the colored core is optimized.'],
    [settings.recoil, 'Follow-recoil is exported, but motion is not modeled.'],
    [state.allModelConflict, 'All hypotheses conflict with native calibration evidence. Do not interpret the normalized winner as reliable.'],
    [!state.calibrationGroups, 'No independent new-renderer calibration: weights remain prior-only; native confidence is unidentified.'],
    [visual.targetMask.cropped, 'The measured target is cropped; an exact image-match claim is disabled.'],
    [visual.previewCropped && !hasMask, 'The preview crops this large shape. The analytical loss still measures the complete pixel union.'],
    [hasMask, 'The image-derived mask is noisy and does not uniquely identify the old cvars.'],
    [visual.targetArea === 0, 'No visible colored geometry. Empty agreement is not an IoU score or rendering evidence.'],
    [settings.thickness === 0 && target.width !== 1 && !hasMask, 'The literal-zero minimum conflicts with the requested screen-relative thickness.'],
    [settings.thickness > 0 && chosenNative.thickness === 0, 'A positive legacy thickness resolved to new thickness 0 (the zero-thickness branch). It renders the one-pixel minimum and may behave differently at other resolutions; treat this as a conversion limitation, not an exact match.'],
  ];
  for (const [condition, message] of conditions) if (condition) warnings.push(message);
  return warnings;
}

export function buildReport({ settings, o, legacy, target, state, visual, proposals, ranked, chosen, renderer, records, hasMask, blockers, started, certify = false, preserveZero = false }) {
  const converted = forward(chosen.native, o.currentHeight, renderer);
  const naive = naiveAssignment(settings, o.authoredHeight), naiveGeometry = forward(naive, o.currentHeight, renderer);
  const convertedFit = visual.score(converted);
  const exact = exactPreimage({ settings, options: o, model: renderer, preserveZero });
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
    warnings: warningsFor(settings, state, visual, target, chosen.native, hasMask),
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
