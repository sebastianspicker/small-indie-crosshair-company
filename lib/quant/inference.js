/** Orchestration only. Formula definitions, search, evidence and output have separate ownership. */
import { MODELS, targetGeometry, unsupported } from './renderer.js';
import { solveTarget } from './inverse.js';
import { posterior } from './evidence.js';
import { visualContext, refineVisual } from './visual.js';
import { rankCandidates, selectRenderer, chosenCandidate } from './selection.js';
import { buildReport } from './report.js';
import { rgba } from '../conversion.js';
import { bool } from '../validation.js';
export { refineVisual } from './visual.js';
export { exportQuantCFG } from './export.js';

export function infer({ settings, options = {}, records = [], measurements = [], targetOverride = null,
  targetMask = null, selectedModelId = null, decision = 'expected' }) {
  const started = performance.now();
  rgba(settings);
  for (const key of ['dot', 't_style', 'outline', 'recoil', 'weapon_gap']) bool(settings[key], key);
  if (!Array.isArray(records) || records.length > 10000) throw new Error('Invalid bounded corpus.');
  const { legacy, target, options: o } = targetGeometry(settings, options, targetOverride);
  if (targetMask && o.goal === 'screen' && o.oldHeight !== o.currentHeight)
    throw new Error('Image targets cannot silently rescale measured evidence. Match source pixels or keep the same height.');
  const state = posterior(measurements), renderer = selectRenderer(selectedModelId, state);
  const visual = visualContext(target, settings, targetMask), blockers = unsupported(settings);
  const proposals = MODELS.map(model => refineVisual(
    solveTarget(settings, o, model, target, legacy, targetOverride !== null), model, o.currentHeight, visual));
  const ranked = rankCandidates(proposals, state, o.currentHeight, visual, decision, !selectedModelId);
  const chosen = chosenCandidate(ranked, proposals, renderer, Boolean(selectedModelId));
  return buildReport({ settings, o, legacy, target, state, visual, proposals, ranked, chosen, renderer,
    records, hasMask: Boolean(targetMask), blockers, started });
}
