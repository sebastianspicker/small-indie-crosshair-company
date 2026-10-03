import { el } from '../ui/dom.js';
import { rgba, effectiveOutlineMode, exportFillAlpha } from '../../lib/settings/native.js';
import { shapeCheck } from '../../lib/solver/community-edge.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { crossCheck } from '../../lib/solver/ml-crosscheck.js';

const pct = (value, digits = 1) => `${(100 * value).toFixed(digits)}%`;

/** What the export draws: the report's colour, outline mode and T flag overrides, else the old settings with the
 * exported fill opacity (usealpha 0 exports the closest normal blend). */
export function exportedLook(r) {
  const o = r.exportOverrides ?? {};
  return { settings: o.t_style === undefined ? r.settings : { ...r.settings, t_style: o.t_style },
    color: o.color ?? { ...rgba(r.settings), alpha: exportFillAlpha(r.settings) },
    outlineMode: effectiveOutlineMode(r.settings, o.outlineMode ?? r.options.outlineMode) };
}

/** Old against new visible pixels by colour. Reports carry it; older historical reports without one are computed here. */
export function shapeCheckOf(r) {
  if (r.shapeCheck) return r.shapeCheck;
  if (r.targetKind === 'image-derived') return null;
  return shapeCheck({ settings: r.settings, target: r.target, converted: r.converted, overrides: {}, options: r.options });
}

function shapeValue({ status, alignedIou }) {
  if (status === 'exact') return 'Exact';
  if (status === 'shifted') return 'Exact after 1 px shift';
  if (status === 'empty') return 'Nothing visible';
  return `${Math.floor(100 * alignedIou)}% overlap`;
}

const tuple = state => `${state.length}/${state.thickness}/${state.gap}`;
/** The ML cross-check on this input: the learner's own prediction of the export against the converter's export.
 * Keys other than length/thickness/gap that differ are named after the tuple. */
function mlValue(r, m, params) {
  if (r.targetKind !== 'community-old-reconstruction' || r.blockers?.length) return 'Not checked for this input';
  let result;
  try { result = crossCheck(params, r, m); } catch { return 'Not checked'; }
  if (result.status === 'agrees') return `Agrees on this input (${tuple(result.predicted)})`;
  if (result.status === 'missing') return 'Not available';
  if (result.status === 'corrections-off') return 'Not checked: corrections off';
  if (result.status === 'stale-hash') return 'Not checked: parameter file does not match its hash';
  if (result.status !== 'differs') return 'not retrained for this version';
  const others = result.differs.filter(key => !['length', 'thickness', 'gap'].includes(key))
    .map(key => `${key} ${result.predicted[key] === true ? 1 : result.predicted[key] === false ? 0 : result.predicted[key]}`);
  return `Differs on this input: predicts ${tuple(result.predicted)}${others.length ? ` (${others.join(', ')})` : ''}`;
}

/** Why this input lies outside the scopes the ML rate was evaluated on (`scope` from the summary: equal heights in a
 * range at the pixel goal, plus the listed cross-height scopes at either goal); empty inside them or without a scope. */
export function mlScopeGaps(options, scope) {
  if (!scope || !options) return [];
  const { oldHeight: o, currentHeight: c, authoredHeight: a, goal } = options, heights = scope.sameHeights ?? [];
  if ((scope.crossScopes ?? []).some(([x, y, z]) => x === o && y === c && z === a)) return [];
  const low = Math.min(...heights), high = Math.max(...heights), gaps = [];
  if (goal === 'screen') gaps.push('screen goal');
  if (a !== c) gaps.push('screen height setting differs from the current height');
  if (o !== c) gaps.push('old and current heights differ');
  if ([o, c, a].some(h => h < low || h > high)) gaps.push(`heights outside ${low}–${high}p`);
  return gaps;
}

/** Community-model rows: captures, cross-tool agreement and the separately labelled ML cross-check. */
function communityRows(r, evidence) {
  if (!evidence) return [];
  const { captures: c, crossTool: x, mlCrossCheck: m, mlParams } = evidence;
  const mlCurrent = m?.targetVersion === COMMUNITY_MODEL.version, gaps = mlScopeGaps(r.options, m?.scope);
  // The stated rate holds for the evaluated design only; the per-input agreement still shows outside it.
  const rate = !mlCurrent ? '' : gaps.length
    ? `; this input is outside the evaluated scope (${gaps.join(', ')}), so the rate measured there ` +
      `(${pct(m.exactRate)} of fresh held-out synthetic cases) does not apply`
    : `; it agrees on ${pct(m.exactRate)} (${pct(m.lower)}–${pct(m.upper)}) of fresh held-out synthetic cases`;
  return [
    ...(c ? [['Game captures', `${c.reproduced} / ${c.total} reproduced`,
      `User captures of the current game (${c.resolution.height}p, ${c.date}); not independent holdouts`]] : []),
    ...(x ? [['Cross-tool', `${x.agree} / ${x.total}`, 'Matches crosshair.club exports; software agreement, not game captures' +
      (x.agree < x.total ? `. ${x.total - x.agree} differ${x.differSizeZeroDot === x.total - x.agree
        ? ' on purpose: size 0 with a dot, drawn here with arms because length 0 may draw nothing in the current game' : ''}` : '')]] : []),
    ...(m ? [['ML cross-check', r.options?.corrections === false ? 'Not checked: corrections off'
      : mlCurrent ? mlValue(r, m, mlParams) : 'not retrained for this version',
      'A separately implemented model, trained to imitate the converter, predicts the whole export without running it; ' +
      'it shares the converter\'s rendering models and refinement rule, so agreement is partly by construction' +
      rate +
      '. Agreement with our own method, not game accuracy']] : []),
  ];
}

/** Rows of the confidence panel. None is a probability that the export is correct. */
export function confidenceRows(r, evidence, percent) {
  const check = shapeCheckOf(r);
  // The shape check supersedes the core-only, unshifted overlap; that stays only where no shape check exists (images).
  return [
    ...(check ? [['Shape check', shapeValue(check), 'Old vs converted pixels, colours and outline, under the model']]
      : [['Core overlap (no shift)', percent(r.convertedFit.iou), 'Coloured core only, under the selected rendering model']]),
    ...(r.provenance ? communityRows(r, evidence) : [['Captures, cross-tool, ML', 'Automatic model only',
      'These evidence rows apply to the automatic model; select it to see them']]),
    ['Native confidence', 'Not identified', `${r.posterior.calibrationGroups} calibration · ${r.posterior.holdoutGroups} holdout groups`],
    ...(r.provenance && r.posterior.validation.total ? [['Holdout agreement', percent(r.posterior.validation.rate),
      `${r.posterior.validation.successes}/${r.posterior.validation.total} capture groups · ` +
      `interval ${percent(r.posterior.validation.lower)}–${percent(r.posterior.validation.upper)}; measured fields only`]] : []),
  ];
}

export const metricNode = ([label, value, note]) => el('div', {}, el('span', {}, label), el('strong', {}, value), el('small', {}, note));
