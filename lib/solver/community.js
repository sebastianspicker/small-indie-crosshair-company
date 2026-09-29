/** Direct static conversion, deliberately outside the historical 27-model probability family. */
import { COMMUNITY_MODEL, communityLegacy, communityForward } from '../geometry/community.js';
import { drawingEdges, RAW_EDGE_CONVENTION, COMMUNITY_CONVENTION } from '../geometry/raster.js';
import { legacyGeometry } from '../geometry/legacy.js';
import { scope, targetGeometry, naiveAssignment, unsupported } from './renderer.js';
import { searchCommunity } from './community-search.js';
import { visualContext } from './visual.js';
import { localSupport } from './corpus.js';
import { communityEvidence } from './community-evidence.js';

const warn = (code, text) => ({ code, text });
const SOURCE_SCOPE = 'Public converter observations and a community renderer reconstruction; not native-validated.';

/** Invert three monotone integer axes. Preserve bar dimensions before matching the centre radius.
 * No statistical fit, learned weights, visual hill climb or combinatorial renderer family.
 */
export function solveCommunity(settings, options = {}, measured = null, targetMask = null) {
  const o = scope(options), legacy = communityLegacy(settings, o.oldHeight);
  // Validate measured input through the existing public target contract.
  const source = measured ? targetGeometry(settings, { ...o, goal: 'pixels' }, measured).target : legacy;
  const factor = o.goal === 'screen' ? o.currentHeight / o.oldHeight : 1;
  const target = { ...source };
  for (const key of ['length', 'width', 'near', 'far']) target[key] *= factor;
  if (factor !== 1) {
    const edges = drawingEdges(source);
    target.near = edges.near * factor; target.far = edges.far * factor;
    const start = source.axisStart ?? (source.rasterConvention === COMMUNITY_CONVENTION
      ? 0 - Math.ceil(source.width / 2) : 0 - Math.floor(source.width / 2));
    target.axisStart = start * factor;
    target.rasterConvention = RAW_EDGE_CONVENTION;
  }
  return { ...searchCommunity(target, settings, o, targetMask), target, legacy, options: o };
}

export function inferCommunity({ settings, options, records, targetOverride, targetMask, measurements }) {
  const started = performance.now(), solved = solveCommunity(settings, options, targetOverride, targetMask);
  const evidence = communityEvidence(measurements);
  const { native, predicted: converted, target, legacy, options: o } = solved;
  if (targetMask && o.goal === 'screen' && o.oldHeight !== o.currentHeight)
    throw new Error('Image targets cannot silently rescale measured evidence. Match source pixels or keep the same height.');
  const visual = visualContext(target, settings, targetMask), convertedFit = visual.score(converted);
  const naive = naiveAssignment(settings, o.authoredHeight), naiveGeometry = communityForward(naive, o.currentHeight);
  const baseline = legacyGeometry(settings, o.oldHeight);
  const warnings = [
    warn('community-reconstruction', SOURCE_SCOPE),
    warn('shape-loss-excludes-appearance', 'Preview overlap measures the colored core only; outlines, alpha and recoil are excluded.'),
  ];
  if (!targetOverride && (baseline.length !== legacy.length || baseline.width !== legacy.width))
    warnings.push(warn('legacy-rounding-disagreement',
      'Old dimensions use round-to-even from external converter evidence. The historical truncation model gives different pixels.'));
  if (converted.width % 2 || target.width % 2)
    warnings.push(warn('pixel-centering-shift',
      'Odd-width bars use different old/new pixel centres. A position shift may remain; size agreement is not pixel identity.'));
  if (converted.length !== target.length || converted.width !== target.width || converted.near !== solved.radius)
    warnings.push(warn('dimension-limit',
      'Integer steps or setting limits prevent preserving every dimension. The preview shows the remaining mismatch.'));
  if (settings.thickness === 0)
    warnings.push(warn('visible-minimum', 'Old thickness 0 drew a visible minimum; export uses a positive thickness to retain it.'));
  if (settings.outline)
    warnings.push(warn('outline-replacement-unverified',
      'The native outline replacement is unverified; only the colored core is compared.'));
  if (visual.targetMask.cropped)
    warnings.push(warn('target-cropped', 'The measured target is cropped; exact image matching is unavailable.'));
  if (!visual.targetArea)
    warnings.push(warn('empty-geometry', 'No visible colored geometry; empty agreement is not rendering evidence.'));
  if (evidence.holdoutTests.some(group => !group.matches))
    warnings.unshift(warn('native-holdout-conflict', 'The reconstruction conflicts with at least one supplied native holdout group.'));
  const trace = [{ pass: 0, native, iou: convertedFit.iou, loss: convertedFit.loss,
    reason: 'Minimum dimension errors, closest radius per tied width, then exact overlap across all resulting shapes.' }];
  const certificate = { global: false, method: 'not-evaluated', improved: false, evaluated: solved.axisEvaluations,
    scope: 'Exact per-axis size fit, not a global pixel-overlap optimum or a native match certificate.' };
  const preimage = { model: COMMUNITY_MODEL.id, complete: false, count: null, sample: [],
    constrainedNearFar: target.length > 0,
    scope: 'Pixel preimage is not enumerated for the community reconstruction. No exact-match count is claimed.' };
  const chosen = { native, trace, solutions: solved.solutions, refined: false, inverseCertificate: null,
    traceModelId: COMMUNITY_MODEL.id, proposedBy: [COMMUNITY_MODEL.id],
    exactMass: null, expectedIou: null, priorSensitivity: null };
  return {
    schema: 'sicc-quant-report-v5', version: COMMUNITY_MODEL.version, targetBuild: COMMUNITY_MODEL.build,
    options: o, settings, legacy, target, targetKind: targetMask ? 'image-derived' : targetOverride
      ? 'measured-geometry' : 'community-old-reconstruction',
    provenance: { kind: 'external-community-model', nativeValidated: false,
      audit: 'docs/research/converter-audit-2026-09-29.md', scope: SOURCE_SCOPE },
    renderer: COMMUNITY_MODEL, chosen, converted, naive, naiveGeometry, convertedFit, naiveFit: visual.score(naiveGeometry),
    rendering: { convention: converted.rasterConvention, evidence: SOURCE_SCOPE,
      targetEdges: drawingEdges(target), convertedEdges: drawingEdges(converted) },
    confidence: { nativeMatchProbability: null, conditionalFamilyMass: null, expectedShapeOverlap: null,
      declaredResidualsPx: { length: converted.length - target.length, width: converted.width - target.width,
        axisStart: 0 - Math.ceil(converted.width / 2) - (target.axisStart ?? (target.rasterConvention === COMMUNITY_CONVENTION
          ? 0 - Math.ceil(target.width / 2) : 0 - Math.floor(target.width / 2))),
        ...(target.length > 0 ? { near: converted.near - drawingEdges(target).near,
          far: converted.far - drawingEdges(target).far } : {}) },
      minimumLossChoices: Object.fromEntries(Object.entries(solved.solutions).map(([key, value]) => [key, value.equivalents.length])),
      scope: 'Residuals and ambiguity are conditional on the reconstruction; no native-match probability is identified.' },
    posterior: { ...evidence, weights: [],
      warning: 'This direct reconstruction is outside the historical 27-model family. Select a historical model to inspect that study.' },
    measurementChecks: evidence.measurementChecks,
    models: [{ ...COMMUNITY_MODEL, native, weight: null, conditionalIou: convertedFit.iou }], candidates: [chosen],
    preimage, decision: { rule: 'preserve-dimensions', searchPolicy: 'finite-dimension-ties-v3', certificate, trace,
      tieBreak: solved.tieBreak,
      scope: certificate.scope }, coverage: localSupport(settings, records), experiment: null,
    blockers: unsupported(settings), warnings,
    search: { maxCandidates: solved.tieBreak.evaluated, proposalEvaluations: solved.axisEvaluations,
      tieShapeEvaluations: solved.tieBreak.evaluated, uniqueShapeEvaluations: visual.size(), uniqueRasterEvaluations: 0,
      engine: visual.engine, durationMs: performance.now() - started, nativeEvidenceUpdatedBySyntheticLoop: false,
      status: 'source-labelled-static-conversion' },
  };
}
