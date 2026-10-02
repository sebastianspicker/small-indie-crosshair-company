import { nativeCommands, safeComment, exportOverrides } from '../settings/native.js';
import { integer } from '../settings/validation.js';
import { VERSION, BUILD, getModel, scope, unsupported } from './renderer.js';
import { RASTER_CONVENTION } from '../geometry/raster.js';
import { COMMUNITY_MODEL } from '../geometry/community.js';

/** The export boundary validates native values and does not trust imported comment text. */
export function exportQuantCFG(report) {
  const s = report.settings, o = scope(report.options), blockers = unsupported(s, o.styleTarget);
  if (blockers.length || report.blockers?.length) throw new Error([...blockers, ...(report.blockers ?? [])].join(' '));
  const n = report.chosen.native, model = getModel(report.renderer.id);
  const calibration = integer(report.posterior.calibrationGroups, 'Calibration groups', 0, 256);
  const holdout = integer(report.posterior.holdoutGroups, 'Holdout groups', 0, 256);
  const decision = report.decision ?? {}, certificate = decision.certificate ?? {}, preimage = report.preimage ?? {};
  const rule = safeComment(decision.rule ?? 'unknown');
  const method = safeComment(certificate.method ?? 'not-evaluated');
  const preimageCount = Number.isInteger(preimage.count) ? preimage.count : null;
  const community = model.id === COMMUNITY_MODEL.id;
  const version = community ? COMMUNITY_MODEL.version : VERSION, build = community ? COMMUNITY_MODEL.build : BUILD;
  return [
    `// Small Indie Crosshair Company ${version} — CONDITIONAL CANDIDATE, not a match certificate.`,
    `// Build ${build}; renderer scenario ${model.id}.`,
    `// Illustration ${community ? report.rendering.convention : RASTER_CONVENTION}; not native-validated.`,
    `// Native correctness probability: unidentified. Evidence: ${calibration} calibration groups, ${holdout} holdout groups.`,
    `// Old height ${o.oldHeight}; current height ${o.currentHeight}; goal ${o.goal}.`,
    `// Decision rule: ${rule}; global-optimum certificate: ${method}.`,
    ...(preimageCount === null ? [] : [`// ${preimageCount} native tuple(s) render this target exactly under the selected model.`]),
    '// Shape agreement is conditional on a model, not independent native validation.',
    ...nativeCommands(s,n,exportOverrides(s,o)),
    ...(report.warnings ?? []).map(w => '// ' + safeComment(typeof w === 'string' ? w : w.text)), '',
  ].join('\n');
}
