import { el, fmt, table } from '../ui/dom.js';
import { paintQuant, fitZoom } from './preview.js';
import { rgba } from '../../lib/settings/native.js';
import { scaleOf, EXPERT_MODELS } from '../../lib/solver/renderer.js';
import { exportQuantCFG } from '../../lib/solver/export.js';
import { rivalSummary } from '../../lib/solver/migration.js';
import { modelName } from './view.js';
import { drawingEdges } from '../../lib/geometry/raster.js';
export const percent = value => value == null ? 'Undefined' : `${(100 * value).toFixed(1)}%`;

export function clearResult(view, state = 'pending', message = 'Calculating…') {
  const { root, get } = view;
  root.dataset.result = state; root.dataset.busy = String(state === 'pending'); root.dataset.blocked = 'false';
  root.setAttribute('aria-busy', String(state === 'pending'));
  get('q-status').textContent = message;
  get('q-cfg').value = '';
  for (const id of ['q-copy', 'q-download-cfg', 'q-download-report']) get(id).disabled = true;
  root.querySelectorAll('#q-values-table td').forEach(node => { node.textContent = '—'; });
  for (const id of ['q-confidence', 'q-target-line', 'q-warnings', 'q-derivation', 'q-model-table', 'q-trace', 'q-certify-note']) get(id).replaceChildren();
  get('q-discriminating').textContent = '';
  for (const id of ['old', 'naive', 'converted']) {
    get(`q-${id}-values`).textContent = '';
    get(`q-${id}-note`).textContent = state === 'error' ? 'Input not accepted.' : 'Waiting for valid input.';
    const canvas = get(`q-${id}-canvas`);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  for (const id of ['qs-length', 'qs-out-thickness', 'qs-out-gap']) get(id).textContent = '—';
  get('qs-flags').textContent = ''; get('qs-commands').textContent = ''; get('qs-scale').textContent = '';
  get('qs-live').textContent = '';
  if (state === 'error') get('qs-note').textContent = '';
  get('qs-status').textContent = state === 'error' ? message : '';
  get('qs-copy').disabled = get('qs-download').disabled = true;
  for (const id of ['qs-old-canvas', 'qs-new-canvas']) {
    const canvas = get(id);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

function renderValues(view, report) {
  const { get } = view, s = report.settings, n = report.chosen.native, a = report.naive;
  for (const [key, oldKey] of [['length', 'size'], ['thickness', 'thickness'], ['gap', 'gap']]) {
    get(`q-value-${key}-legacy`).textContent = fmt(s[oldKey]);
    get(`q-value-${key}-direct`).textContent = fmt(a[key]);
    get(`q-value-${key}-new`).textContent = fmt(n[key]);
  }
  const t = report.target;
  const edges = drawingEdges(t);
  get('q-target-line').textContent = `Target in game pixels: length ${fmt(t.length)}, thickness ${fmt(t.width)}${report.targetKind === 'image-derived' ? ', measured image pixels' : `, preview inner edges ${fmt(edges.near)} / ${fmt(edges.far)}`}. New authored height: ${n.authoredHeight}.`;
}

function renderMetrics(view, r) {
  view.get('q-confidence').replaceChildren(...[
    ['Preview overlap', percent(r.convertedFit.iou), 'Under the selected rendering model'],
    r.provenance ? ['Evidence basis', 'Community', 'External software comparison; not game captures']
      : ['Model agreement', percent(r.confidence.conditionalFamilyMass), 'Share of weighted models that match'],
    ['Native confidence', 'Not identified', `${r.posterior.calibrationGroups} calibration · ${r.posterior.holdoutGroups} holdout groups`],
  ].map(([label, value, note]) => el('div', {}, el('span', {}, label), el('strong', {}, value), el('small', {}, note))));
}

export function renderPreviews(view, r, measuredMask = null) {
  if (!r) return;
  const { get } = view, c = rgba(r.settings), zoom = Number(get('q-zoom').value), grid = get('q-grid').checked;
  paintQuant(get('q-old-canvas'), r.target, r.settings, c, zoom, null, { grid, mask: measuredMask });
  paintQuant(get('q-naive-canvas'), r.naiveGeometry, r.settings, c, zoom, null, { grid });
  const reference = get('q-difference').checked ? measuredMask ?? r.target : null;
  paintQuant(get('q-converted-canvas'), r.converted, r.settings, c, zoom, reference, { grid });
}

function previewLabels(view, r) {
  const { get } = view, s = r.settings;
  get('q-old-values').textContent = r.targetKind === 'image-derived' ? `Measured L ${fmt(r.target.length)} · W ${fmt(r.target.width)}`
    : `size ${fmt(s.size)} / thickness ${fmt(s.thickness)} / gap ${fmt(s.gap)}`;
  for (const [id, n] of [['naive', r.naive], ['converted', r.chosen.native]])
    get(`q-${id}-values`).textContent = `length ${n.length} / thickness ${n.thickness} / gap ${n.gap}`;
  get('q-old-note').textContent = r.targetKind === 'image-derived' ? 'Measured from the image; the old settings may have more than one answer.' : 'Reconstructed from the old settings.';
  get('q-naive-note').textContent = `${percent(r.naiveFit.iou)} overlap in the preview. Copied with new integer limits.`;
  get('q-converted-note').textContent = `${percent(r.convertedFit.iou)} overlap in the selected model.`;
  get('q-renderer-note').textContent = `New preview: ${modelName(r.renderer)}. ` +
    'Difference colors: light = shared, amber = extra, blue = missing. Outlines are excluded. ' +
    (r.provenance ? r.provenance.scope : 'Gap scaling remains a hypothesis in the historical build 2000914 study.');
}

export function renderSimple(view, report) {
  if (!report) return;
  const { get } = view, s = report.settings, n = report.chosen.native, c = rgba(s);
  get('qs-length').textContent = fmt(n.length);
  get('qs-out-thickness').textContent = fmt(n.thickness);
  get('qs-out-gap').textContent = fmt(n.gap);
  const flags = [s.dot ? 'center dot' : 'no center dot', s.t_style ? 'T shape' : 'cross', s.outline ? 'outline' : 'no outline',
    s.recoil ? 'follow recoil (not simulated)' : 'static'];
  get('qs-flags').textContent = `${flags.join(' · ')} · rgba(${c.rgb.join(', ')}, ${c.alpha})`;
  const warningText = report.warnings.map(w => typeof w === 'string' ? w : w.text);
  const gapScale = warningText.find(w => /Gap scaling is not stated in the build 2000914/.test(w));
  const relevant = warningText.filter(w => /conflict|cropped|large shape|No visible|outline replacement|zero-thickness|shift|limits/.test(w));
  get('qs-note').textContent = [gapScale ?? (report.provenance && 'Community reconstruction; not checked against game captures.'),
    relevant[0]].filter(Boolean).join(' ')
    || 'Conditional preview under the selected model.';
  const oldCanvas = get('qs-old-canvas'), zoom = fitZoom(oldCanvas, [report.target, report.converted], s);
  paintQuant(oldCanvas, report.target, s, c, zoom, null, { grid: zoom >= 6, annotate: true });
  paintQuant(get('qs-new-canvas'), report.converted, s, c, zoom, null, { grid: zoom >= 6, annotate: true });
  get('qs-scale').textContent = `×${zoom} · one cell = one game pixel`;
  const blocked = Boolean(report.blockers.length);
  view.root.dataset.blocked = String(blocked);
  const lines = blocked ? [] : exportQuantCFG(report).split('\n').filter(line => line && !line.startsWith('//'));
  get('qs-commands').replaceChildren(...(blocked ? ['No commands until the issue is resolved in the expert lab.'] : lines.flatMap(line => {
    const [name, ...value] = line.split(' ');
    return [el('span', { class: 'cvar-name' }, name), ' ', el('span', { class: 'cvar-value' }, value.join(' ')), '\n'];
  })));
  get('qs-status').textContent = blocked ? `${report.blockers[0]} Nothing can be exported until this is resolved.` : '';
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

export function renderResult(view, r) {
  const { get, root } = view;
  renderValues(view, r); renderSimple(view, r); renderMetrics(view, r); previewLabels(view, r); renderCertificate(view, r);
  get('q-cfg').value = r.blockers.length ? '' : exportQuantCFG(r);
  get('q-copy').disabled = get('q-download-cfg').disabled = Boolean(r.blockers.length);
  get('q-download-report').disabled = false;
  get('q-status').textContent = r.blockers.length ? 'No export until the issues below are resolved.' : 'Settings ready to copy or download.';
  const warningText = r.warnings.map(w => typeof w === 'string' ? w : w.text);
  const relevant = warningText.filter(w =>
    /conflict|cropped|large shape|No visible|outline replacement|zero-thickness|shift|limits/.test(w));
  if (root.dataset.strategy === 'hedge' && r.convertedFit.iou !== 1) relevant.unshift('The automatic choice balances several models. Open the pixel measurements to see where this preview differs.');
  get('q-warnings').replaceChildren(...[...r.blockers, ...relevant].map(w => el('p', {}, w)));
  const e = r.experiment;
  get('q-experiment').textContent = e
    ? `Game height ${e.currentHeight} · disagreement ${e.disagreementBits.toFixed(3)} bits\ncl_crosshair_length ${e.native.length}\ncl_crosshair_thickness ${e.native.thickness}\ncl_crosshair_gap ${e.native.gap}\ncl_crosshair_screen_height ${e.native.authoredHeight}`
    : 'Compare old and new lossless captures at the same resolution, including odd widths and fractional sizes.';
  root.dataset.busy = 'false'; root.dataset.result = 'ready'; root.setAttribute('aria-busy', 'false');
}

export function renderDerivation(view, r) {
  const t = r.target, g = r.converted, n = r.chosen.native, ratio = scaleOf(r.renderer, r.options.currentHeight, n.authoredHeight);
  const rows = [
    ['Length', t.length, g.length, n.length], ['Thickness', t.width, g.width, n.thickness],
    ['Near inner edge · formula', t.near, g.near, n.gap], ['Far inner edge · formula', t.far, g.far, n.gap],
  ].map(([label, target, predicted, value]) => [label, fmt(target), fmt(predicted), fmt(predicted - target), fmt(value)]);
  const rivals = r.provenance ? [] : rivalSummary(r.settings, r.options, n).map(row => {
    const native = row.native ?? row;
    return el('p', { class: 'small' }, `Rival · ${row.kind}: length ${native.length} / thickness ${native.thickness} / gap ${native.gap} · ${row.status}. Display only; it does not change the exported values.`);
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
  view.get('q-model-table').replaceChildren(el('p', { class: 'small' }, r.posterior.warning),
    el('div', { class: 'table-scroll' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Model', 'Weight', 'Length / thickness / gap', 'Preview overlap', ''].map(x => el('th', { scope: 'col' }, x)))),
      el('tbody', {}, ...models.map(m => el('tr', {}, el('td', {}, modelName(m)), el('td', {}, percent(m.weight)),
        el('td', {}, `${m.native.length} / ${m.native.thickness} / ${m.native.gap}`), el('td', {}, percent(m.conditionalIou)),
        el('td', {}, el('button', { class: 'text-button', 'aria-label': 'Inspect ' + m.id,
          onclick: () => onSelect(r.provenance ? '' : m.id) }, 'Inspect'))))))));
}

export function renderDiscriminating(view, set) {
  const lines = [
    `Weighted hypothesis pairs separated: ${set.weightedCovered.toFixed(4)} of ${set.weightedTotal.toFixed(4)}` +
      (set.separatesAll ? ' — all weighted pairs.' : ` — ${set.unseparatedPairs.length} pair(s) remain.`),
  ];
  set.designs.forEach((design, index) => {
    const n = design.native;
    const groups = design.partition.map(group => group.map(i => i + 1).join(',')).join(' | ');
    lines.push(`${index + 1}. length ${n.length} / thickness ${n.thickness} / gap ${n.gap} · authored ${n.authoredHeight} · screen ${design.currentHeight}` +
      `\n   separates ${design.coveredPairs} new weighted pair(s) · ${design.outcomes} outcome(s), model numbers: ${groups}`);
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
    measurementChecks: r.measurementChecks ?? r.posterior.holdoutTests,
  }, null, 2)));
}
