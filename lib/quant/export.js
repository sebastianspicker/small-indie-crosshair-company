import { nativeCommands, safeComment } from '../native-settings.js';
import { integer } from '../validation.js';
import { VERSION, BUILD, getModel, scope, unsupported } from './renderer.js';
import { RASTER_CONVENTION } from '../raster.js';

/** The export boundary validates native values and does not trust imported comment text. */
export function exportQuantCFG(report) {
  const s = report.settings, blockers = unsupported(s);
  if (blockers.length || report.blockers?.length) throw new Error([...blockers, ...(report.blockers ?? [])].join(' '));
  const n = report.chosen.native, model = getModel(report.renderer.id), o = scope(report.options);
  const calibration = integer(report.posterior.calibrationGroups, 'Calibration groups', 0, 256);
  const holdout = integer(report.posterior.holdoutGroups, 'Holdout groups', 0, 256);
  const decision = report.decision ?? {}, certificate = decision.certificate ?? {}, preimage = report.preimage ?? {};
  const rule = safeComment(decision.rule ?? 'unknown');
  const method = safeComment(certificate.method ?? 'not-evaluated');
  const preimageCount = Number.isInteger(preimage.count) ? preimage.count : null;
  return [
    `// Small Indie Crosshair Company ${VERSION} — CONDITIONAL CANDIDATE, not a match certificate.`,
    `// Build ${BUILD}; renderer scenario ${model.id}.`,
    `// Illustration ${RASTER_CONVENTION}; not native-validated.`,
    `// Native correctness probability: unidentified. Evidence: ${calibration} calibration groups, ${holdout} holdout groups.`,
    `// Old height ${o.oldHeight}; current height ${o.currentHeight}; goal ${o.goal}.`,
    `// Decision rule: ${rule}; global-optimum certificate: ${method}.`,
    ...(preimageCount === null ? [] : [`// ${preimageCount} native tuple(s) render this target exactly under the selected model.`]),
    '// Shape agreement is conditional on a model, not independent native validation.',
    ...nativeCommands(s,n),
    ...(report.warnings ?? []).map(w => '// ' + safeComment(w)), '',
  ].join('\n');
}
