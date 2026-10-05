import { el, fmt, table } from '../ui/dom.js';
import { paintQuant, fitZoom } from './preview.js';
import { rgba, legacyOutlineExtent, nativeOutlineExtent, styleTarget } from '../../lib/settings/native.js';
import { STYLE_ON_BUILD_2000922 } from '../../lib/settings/cvars.js';
import { scaleOf, EXPERT_MODELS } from '../../lib/solver/renderer.js';
import { exportQuantCFG } from '../../lib/solver/export.js';
import { rivalSummary } from '../../lib/solver/migration.js';
import { modelName } from './view.js';
import { drawingEdges } from '../../lib/geometry/raster.js';
import { clearOutcomes, shownWarnings, warningItem } from './outcomes.js';
import { exportedLook, confidenceRows, metricNode } from './evidence.js';
/** Exported style with its current-game name, e.g. "Static Cross (style 4)". */
export function exportedStyleName(report) {
  const style = styleTarget(report.settings, report.options?.styleTarget ?? 'static');
  return `${STYLE_ON_BUILD_2000922.find(entry => entry.id === style)?.uiLabel ?? 'Style'} (style ${style})`;
}
export const percent = value => value == null ? 'Undefined' : `${(100 * value).toFixed(1)}%`;

export function clearResult(view, state = 'pending', message = 'Calculating…') {
  const { root, get } = view;
  root.dataset.result = state; root.dataset.busy = String(state === 'pending'); root.dataset.blocked = 'false';
  root.setAttribute('aria-busy', String(state === 'pending'));
  get('q-status').textContent = message;
  get('q-cfg').value = '';
  for (const id of ['q-download-cfg', 'q-download-report']) get(id).disabled = true;
  root.querySelectorAll('#q-values-table td').forEach(node => { node.textContent = '-'; });
  for (const id of ['q-confidence', 'q-target-line', 'q-warnings', 'q-derivation', 'q-model-table', 'q-trace', 'q-certify-note']) get(id).replaceChildren();
  get('q-discriminating').textContent = ''; get('q-renderer-note').textContent = ''; get('q-experiment').textContent = '';
  for (const id of ['old', 'naive', 'converted']) {
    get(`q-${id}-values`).textContent = '';
    get(`q-${id}-note`).textContent = state === 'error' ? 'Input not accepted.' : 'Waiting for valid input.';
    const canvas = get(`q-${id}-canvas`);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  for (const id of ['qs-length', 'qs-out-thickness', 'qs-out-gap']) get(id).textContent = '-';
  clearOutcomes(view);
  get('qs-flags').replaceChildren(); get('qs-commands').replaceChildren(); get('qs-scale').textContent = '';
  get('qs-live').textContent = '';
  get('qs-note').textContent = '';
  get('qs-status').textContent = state === 'error' ? message : '';
  get('qs-copy').disabled = get('qs-download').disabled = true;
  for (const id of ['qs-old-canvas', 'qs-new-canvas']) {
    const canvas = get(id);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

function renderValues(view, report) {
  const { get } = view, s = report.settings, n = report.chosen.native, a = report.naive, blocked = Boolean(report.blockers.length);
  for (const [key, oldKey] of [['length', 'size'], ['thickness', 'thickness'], ['gap', 'gap']]) {
    get(`q-value-${key}-legacy`).textContent = fmt(s[oldKey]);
    // Blocked: nothing is proposed, so the proposed values stay empty as in the Simple view.
    get(`q-value-${key}-direct`).textContent = blocked ? '-' : fmt(a[key]);
    get(`q-value-${key}-new`).textContent = blocked ? '-' : fmt(n[key]);
  }
  const t = report.target;
  const edges = drawingEdges(t);
  get('q-target-line').textContent = `Target in game pixels: length ${fmt(t.length)}, thickness ${fmt(t.width)}${report.targetKind === 'image-derived' ? ', measured image pixels' : `, preview inner edges ${fmt(edges.near)} / ${fmt(edges.far)}`}. New authored height: ${n.authoredHeight}.`;
}

function renderMetrics(view, r, evidence) {
  view.get('q-confidence').replaceChildren(...confidenceRows(r, evidence, percent).map(metricNode));
}

export function renderPreviews(view, r, measuredMask = null) {
  if (!r) return;
  const { get } = view, c = rgba(r.settings), zoom = Number(get('q-zoom').value), grid = get('q-grid').checked;
  const old = legacyOutlineExtent(r.settings), assumed = nativeOutlineExtent(r.settings, r.options.outlineMode);
  const exported = exportedLook(r), exportedOutline = nativeOutlineExtent(exported.settings, exported.outlineMode);
  paintQuant(get('q-old-canvas'), r.target, r.settings, c, zoom, null, { grid, mask: measuredMask, outline: old, legacy: true });
  paintQuant(get('q-naive-canvas'), r.naiveGeometry, r.settings, c, zoom, null, { grid, outline: assumed });
  const reference = get('q-difference').checked ? measuredMask ?? r.target : null;
  // The converted plate shows what the export draws: its colour, outline mode and T flag, not the old ones.
  const converted = get('q-converted-canvas');
  if (r.blockers?.length) converted.getContext('2d').clearRect(0, 0, converted.width, converted.height);
  else paintQuant(converted, r.converted, exported.settings, exported.color, zoom, reference, { grid, outline: exportedOutline });
}

function previewLabels(view, r) {
  const { get } = view, s = r.settings;
  get('q-old-values').textContent = r.targetKind === 'image-derived' ? `Measured L ${fmt(r.target.length)}, W ${fmt(r.target.width)}`
    : `size ${fmt(s.size)} / thickness ${fmt(s.thickness)} / gap ${fmt(s.gap)}`;
  for (const [id, n] of [['naive', r.naive], ['converted', r.chosen.native]])
    get(`q-${id}-values`).textContent = r.blockers.length ? '-' : `length ${n.length} / thickness ${n.thickness} / gap ${n.gap}`;
  get('q-old-note').textContent = r.targetKind === 'image-derived' ? 'Measured from the image; the old settings may have more than one answer.' : 'Reconstructed from the old settings.';
  get('q-naive-note').textContent = `${percent(r.naiveFit.iou)} core overlap (no shift). Copied with new integer limits.`;
  // Odd widths sit half a pixel to opposite sides of the screen centre in the two games: say when that is all it is.
  const shifted = r.shapeCheck?.status === 'shifted' ? ` Same shape ${percent(r.shapeCheck.alignedIou)} once aligned: ` +
    'odd-width bars sit half a pixel to the other side of the screen centre.' : '';
  get('q-converted-note').textContent = `${percent(r.convertedFit.iou)} core overlap (no shift) in the selected model.${shifted}`;
  get('q-renderer-note').textContent = `New preview: ${modelName(r.renderer)}. ` +
    'Difference colors: light = shared, amber = extra, blue = missing. Core overlap compares the coloured core only, ' +
    'without a shift; the Shape check also compares outlines and allows a 1 px shift. New outline: full = 1 px all round ' +
    '(unverified in game), half = top and left (matches one user capture, issue #11). ' +
    (r.provenance ? r.provenance.scope : 'Gap scaling remains a hypothesis in the historical build 2000914 study.');
}

/** `status: false` (a resize or font refresh) leaves the status line alone, e.g. "Copied to clipboard.". */
export function renderSimple(view, report, { status = true } = {}) {
  if (!report) return;
  const { get } = view, s = report.settings, n = report.chosen.native, c = rgba(s), exported = exportedLook(report);
  const exportedOutline = nativeOutlineExtent(exported.settings, exported.outlineMode);
  const blocked = Boolean(report.blockers.length);
  // Blocked: nothing is exported, so no values or flags are shown either.
  get('qs-length').textContent = blocked ? '-' : fmt(n.length);
  get('qs-out-thickness').textContent = blocked ? '-' : fmt(n.thickness);
  get('qs-out-gap').textContent = blocked ? '-' : fmt(n.gap);
  const flags = [s.dot ? 'center dot' : 'no center dot', exported.settings.t_style ? 'T shape' : 'cross',
    ['no outline', 'outline', 'half outline'][exported.outlineMode], exportedStyleName(report),
    s.recoil ? 'follows recoil (not simulated)' : 'no recoil', `rgba(${exported.color.rgb.join(', ')}, ${exported.color.alpha})`];
  // Chips; visually hidden separators keep the text content one line ("a · b · c") when copied.
  get('qs-flags').replaceChildren(...(blocked ? [] : flags.flatMap((flag, index) => [
    ...(index ? [el('span', { class: 'flag-sep', 'aria-hidden': 'true' }, ' · ')] : []), el('span', { class: 'flag' }, flag)])));
  const warningText = report.warnings.map(w => typeof w === 'string' ? w : w.text);
  const gapScale = warningText.find(w => /Gap scaling is not stated in the build 2000914/.test(w));
  get('qs-note').textContent = (gapScale ?? (report.provenance && 'Community reconstruction; not checked against game captures.'))
    || 'Conditional preview under the selected model.';
  const oldCanvas = get('qs-old-canvas'), zoom = fitZoom(oldCanvas, [report.target, report.converted], [s, exported.settings],
    [legacyOutlineExtent(s), exportedOutline]);
  paintQuant(oldCanvas, report.target, s, c, zoom, null,
    { grid: zoom >= 6, annotate: true, outline: legacyOutlineExtent(s), legacy: true });
  paintQuant(get('qs-new-canvas'), report.converted, exported.settings, exported.color, zoom, null,
    { grid: zoom >= 6, annotate: true, outline: exportedOutline });
  get('qs-scale').textContent = `×${zoom}, one cell = one game pixel, ring = screen centre.` +
    (exported.outlineMode ? ' Outline black at crosshair ' +
    `opacity; ${exported.outlineMode === 2 ? 'half outline matches one user capture.' : 'full outline unverified in game.'}` : '');
  view.root.dataset.blocked = String(blocked);
  const lines = blocked ? [] : exportQuantCFG(report).split(';').filter(Boolean);
  get('qs-commands').replaceChildren(...(blocked ? [el('p', { class: 'small' }, 'No commands until the issue above is resolved.')]
    : lines.map(line => {
      const [name, ...value] = line.split(' ');
      return el('div', { class: 'cmd' }, el('span', { class: 'cvar-name' }, name), ' ',
        el('span', { class: 'cvar-value' }, value.join(' ')));
    })));
  if (status) get('qs-status').textContent = blocked ? `${report.blockers[0]} Nothing can be exported until this is resolved.` : '';
  get('qs-copy').disabled = blocked; get('qs-download').disabled = blocked;
  const announcement = blocked ? '' : `New settings: length ${fmt(n.length)}, thickness ${fmt(n.thickness)}, gap ${fmt(n.gap)}.`;
  if (get('qs-live').textContent !== announcement) get('qs-live').textContent = announcement;
}

const CERTIFICATE_METHOD_NOTES = {
  'loss-zero': 'The chosen native already attains the zero floor of the declared loss',
  'shell-monotone': 'shell-monotone is a conditional, assumption-scoped global claim: the loss is assumed not to decrease once every rendered geometric distance strictly grows from the best cell (spot-checked offline, not proved)',
  'domain-exhaustive': 'domain-exhaustive enumerates a scoped sub-domain rather than the full declared domain',
  unproven: 'unproven means no global claim: a remote or non-monotone optimum could not be excluded',
  'not-evaluated': 'not-evaluated means no global claim: the default bounded search does not enumerate the declared domain',
};

function renderCertificate(view, r) {
  const c = r.decision.certificate;
  const method = CERTIFICATE_METHOD_NOTES[c.method] ?? String(c.method);
  view.get('q-certify-note').textContent =
    `Certificate for the declared loss: method ${c.method}; global ${c.global ? 'yes' : 'no'}; improved on the bounded best ${c.improved ? 'yes' : 'no'}. ${method}. Scope: ${c.scope}`;
}

export function renderResult(view, r, evidence = null) {
  const { get, root } = view;
  renderValues(view, r); renderSimple(view, r); renderMetrics(view, r, evidence); previewLabels(view, r); renderCertificate(view, r);
  get('q-cfg').value = r.blockers.length ? '' : exportQuantCFG(r);
  get('q-download-cfg').disabled = Boolean(r.blockers.length);
  get('q-download-report').disabled = false;
  get('q-status').textContent = r.blockers.length ? 'No export until the issues below are resolved.' : 'Settings ready to copy or download.';
  // The same list as the Simple view, so neither hides a warning the other shows.
  const relevant = shownWarnings(r);
  if (root.dataset.strategy === 'hedge' && r.convertedFit.iou !== 1) relevant.unshift('The automatic choice balances several models. Open the pixel measurements to see where this preview differs.');
  get('q-warnings').replaceChildren(...r.blockers.map(w => warningItem(w, 'blocked')), ...relevant.map(w => warningItem(w)));
  const e = r.experiment;
  get('q-experiment').textContent = e
    ? `Game height ${e.currentHeight}, disagreement ${e.disagreementBits.toFixed(3)} bits\ncl_crosshair_length ${e.native.length}\ncl_crosshair_thickness ${e.native.thickness}\ncl_crosshair_gap ${e.native.gap}\ncl_crosshair_screen_height ${e.native.authoredHeight}`
    : 'Compare old and new lossless captures at the same resolution, including odd widths and fractional sizes.';
  root.dataset.busy = 'false'; root.dataset.result = 'ready'; root.setAttribute('aria-busy', 'false');
}

export function renderDerivation(view, r) {
  const t = r.target, g = r.converted, n = r.chosen.native, ratio = scaleOf(r.renderer, r.options.currentHeight, n.authoredHeight);
  const rows = [
    ['Length', t.length, g.length, n.length], ['Thickness', t.width, g.width, n.thickness],
    ['Near inner edge (formula)', t.near, g.near, n.gap], ['Far inner edge (formula)', t.far, g.far, n.gap],
  ].map(([label, target, predicted, value]) => [label, fmt(target), fmt(predicted), fmt(predicted - target), fmt(value)]);
  const rivals = r.provenance ? [] : rivalSummary(r.settings, r.options, n).map(row => {
    const native = row.native ?? row;
    return el('p', { class: 'small' }, `Rival ${row.kind}: length ${native.length} / thickness ${native.thickness} / gap ${native.gap}, ${row.status}. Display only; it does not change the exported values.`);
  });
  view.get('q-derivation').replaceChildren(
    el('p', { class: 'formula equation-line' }, `r = ${r.options.currentHeight} / ${r.renderer.scale === 'authored' ? n.authoredHeight : r.renderer.scale === 'reference1080' ? 1080 : 720} = ${fmt(ratio)}; Q = ${r.renderer.rounding}`),
    table(['Dimension', 'Target px', 'Model px', 'Residual px', 'New value'], rows),
    el('p', { class: 'small' }, `Preview far edge: ${fmt(drawingEdges(g).far)} px. Placement convention: ${r.rendering.convention}.`),
    el('p', { class: 'small' }, r.preimage.complete
      ? `Exact arithmetic preimage: ${r.preimage.count} native tuples under ${modelName(r.renderer)}. ${r.preimage.scope}`
      : r.preimage.scope),
    el('p', { class: 'small' }, r.decision.scope),
    ...rivals);
}

export function renderScenarios(view, r, onSelect) {
  const models = r.models.filter(m => r.provenance || EXPERT_MODELS.some(visible => visible.id === m.id));
  const mass = r.confidence.conditionalFamilyMass;
  view.get('q-model-table').replaceChildren(el('p', { class: 'small' }, r.posterior.warning),
    ...(mass == null ? [] : [el('p', { class: 'small' }, `Hypothesis agreement: ${percent(mass)} of the weighted renderer hypotheses reproduce this choice. ` +
      'It is a share of hypotheses, not a probability that the export is correct.')]),
    el('div', { class: 'table-scroll' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Model', 'Weight', 'Length / thickness / gap', 'Core overlap (no shift)', ''].map(x => el('th', { scope: 'col' }, x)))),
      el('tbody', {}, ...models.map(m => el('tr', {}, el('td', {}, modelName(m)), el('td', {}, percent(m.weight)),
        el('td', {}, `${m.native.length} / ${m.native.thickness} / ${m.native.gap}`), el('td', {}, percent(m.conditionalIou)),
        el('td', {}, el('button', { class: 'text-button', 'aria-label': 'Inspect ' + m.id,
          onclick: () => onSelect(r.provenance ? '' : m.id) }, 'Inspect'))))))));
}

export function renderDiscriminating(view, set) {
  const lines = [
    `Weighted hypothesis pairs separated: ${set.weightedCovered.toFixed(4)} of ${set.weightedTotal.toFixed(4)}` +
      (set.separatesAll ? '. All weighted pairs.' : `. ${set.unseparatedPairs.length} pair(s) remain.`),
  ];
  set.designs.forEach((design, index) => {
    const n = design.native;
    const groups = design.partition.map(group => group.map(i => i + 1).join(',')).join(' | ');
    lines.push(`${index + 1}. length ${n.length} / thickness ${n.thickness} / gap ${n.gap}, authored ${n.authoredHeight}, screen ${design.currentHeight}` +
      `\n   separates ${design.coveredPairs} new weighted pair(s), ${design.outcomes} outcome(s), model numbers: ${groups}`);
  });
  if (!set.designs.length) lines.push('No candidate design separates any weighted pair: the current weights concentrate on indistinguishable models.');
  lines.push(`Scope: ${set.scope}`);
  view.get('q-discriminating').textContent = lines.join('\n');
}

export function renderTrace(view, r, screenshotMeta) {
  view.get('q-trace').replaceChildren(el('pre', { class: 'formula' }, JSON.stringify({
    decision: r.decision, search: r.search, preimage: r.preimage, traceModel: r.chosen.traceModelId, iterations: r.chosen.trace,
    inverseCertificate: r.chosen.inverseCertificate, rendering: r.rendering, nativeValidation: r.posterior.validation,
    noiseAssumptions: r.posterior.noiseModel, originalBuckets: screenshotMeta?.buckets ?? null,
    imageQuality: screenshotMeta?.quality ?? null, declaredConfidence: r.confidence,
    measurementChecks: r.measurementChecks ?? r.posterior.holdoutTests,
  }, null, 2)));
}
