/** Direct static conversion, deliberately outside the historical 27-model probability family. */
import { COMMUNITY_MODEL, communityLegacy, communityForward, communityDimension } from '../geometry/community.js';
import { drawingEdges, RAW_EDGE_CONVENTION, COMMUNITY_CONVENTION } from '../geometry/raster.js';
import { legacyGeometry } from '../geometry/legacy.js';
import { scope, targetGeometry, naiveAssignment, unsupported } from './renderer.js';
import { bestInteger } from './inverse.js';
import { visualContext } from './visual.js';
import { localSupport } from './corpus.js';
import { validateMeasurements, grouped } from './observations.js';

const warn = (code, text) => ({ code, text });
const SOURCE_SCOPE = 'Public converter observations and a community renderer reconstruction; not native-validated.';

/** Enumerate three small integer axes. Preserve bar dimensions before matching the centre radius.
 * No statistical fit, learned weights, visual hill climb or combinatorial renderer family.
 */
export function solveCommunity(settings, options = {}, measured = null) {
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
  const ratio = o.currentHeight / o.authoredHeight;
  const axis = (wanted, max, minimum = 0) => bestInteger(max, wanted / ratio, value =>
    value < minimum ? Infinity : (communityDimension(value, ratio) - wanted) ** 2);
  const length = axis(target.length, 255), thickness = axis(target.width, 31, 1);
  const width = communityDimension(thickness.value, ratio), edges = drawingEdges(target);
  const radius = (edges.near + edges.far + width % 2) / 2;
  const gap = axis(radius, 128);
  const native = { length: length.value, thickness: thickness.value, gap: gap.value, authoredHeight: o.authoredHeight };
  return { native, predicted: communityForward(native, o.currentHeight), target, legacy, options: o,
    solutions: { length, thickness, gap }, radius };
}

export function inferCommunity({ settings, options, records, targetOverride, targetMask, measurements }) {
  const started = performance.now(), solved = solveCommunity(settings, options, targetOverride);
  const evidence = validateMeasurements(measurements, COMMUNITY_MODEL.build).filter(row => row.kind === 'native-user');
  const calibrationGroups = grouped(evidence.filter(row => row.role === 'calibration')).length;
  const holdoutGroups = grouped(evidence.filter(row => row.role === 'holdout')).length;
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
  const trace = [{ pass: 0, native, iou: convertedFit.iou, loss: convertedFit.loss,
    reason: 'Finite per-axis inverse: preserve length and width, then the centre radius.' }];
  const certificate = { global: false, method: 'not-evaluated', improved: false, evaluated: 417,
    scope: 'Exhaustive per-axis size fit, not a global pixel-overlap optimum or a native match certificate.' };
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
      audit: 'docs/research/converter-audit-2026-09-28.md', scope: SOURCE_SCOPE },
    renderer: COMMUNITY_MODEL, chosen, converted, naive, naiveGeometry, convertedFit, naiveFit: visual.score(naiveGeometry),
    rendering: { convention: converted.rasterConvention, evidence: SOURCE_SCOPE,
      targetEdges: drawingEdges(target), convertedEdges: drawingEdges(converted) },
    confidence: { nativeMatchProbability: null, conditionalFamilyMass: null, expectedShapeOverlap: null },
    posterior: { calibrationGroups, holdoutGroups, weights: [], validation: { rate: null },
      warning: 'This direct reconstruction is outside the historical 27-model family. Select a historical model to inspect that study.' },
    measurementChecks: evidence.map(row => {
      const predicted = communityForward(row.native, row.currentHeight);
      const fields = row.observed.length > 0 ? ['length', 'width', 'near', 'far'] : ['length', 'width'];
      if (row.observed.axisStart !== undefined) {
        predicted.axisStart = -Math.ceil(predicted.width / 2); fields.push('axisStart');
      }
      return { id: row.id, role: row.role, build: row.build,
        residuals: Object.fromEntries(fields.map(key => [key, predicted[key] - row.observed[key]])) };
    }),
    models: [{ ...COMMUNITY_MODEL, native, weight: null, conditionalIou: convertedFit.iou }], candidates: [chosen],
    preimage, decision: { rule: 'preserve-dimensions', searchPolicy: 'finite-per-axis-v1', certificate, trace,
      scope: certificate.scope }, coverage: localSupport(settings, records), experiment: null,
    blockers: unsupported(settings), warnings,
    search: { maxCandidates: 1, proposalEvaluations: 417, uniqueShapeEvaluations: visual.size(), uniqueRasterEvaluations: 0,
      engine: visual.engine, durationMs: performance.now() - started, nativeEvidenceUpdatedBySyntheticLoop: false,
      status: 'source-labelled-static-conversion' },
  };
}
