import { DEFAULT_SETTINGS, DEFAULTS_NOTE_PREFIX } from '../../lib/settings/cfg.js';
import { defaultedCvars, defaultsWarning } from '../../lib/settings/outcomes.js';
import { parseLegacyTextWithNotes } from '../../lib/settings/import.js';
import { rgba } from '../../lib/settings/native.js';
import { copy, download } from '../ui/dom.js';
import { exportQuantCFG } from '../../lib/solver/export.js';
import { resolveModelChoice } from '../../lib/solver/selection.js';
import { BUILD, getModel } from '../../lib/solver/renderer.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { clearResult, renderResult, renderPreviews, renderDerivation, renderScenarios, renderTrace, renderSimple, renderDiscriminating } from './presentation.js';
import { bindSources, fillPresets } from './sources.js';
import { bindFeedback } from './feedback.js';
import { renderOutcomes } from './outcomes.js';
import { toggleMode, currentMode } from '../ui/mode.js';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
const MAX_IMPORT = 32768;
// Simple control, expert control, event, property: the expert view is the source of truth for what is exported.
const SIMPLE_PAIRS = [
  ['qs-size', 'q-size', 'input', 'value'], ['qs-thickness', 'q-thickness', 'input', 'value'], ['qs-gap', 'q-gap', 'input', 'value'],
  ['qs-old-height', 'q-old-height', 'input', 'value'], ['qs-new-height', 'q-new-height', 'input', 'value'],
  ['qs-goal', 'q-goal', 'change', 'value'],
  ['qs-outline', 'q-outline', 'change', 'value'], ['qs-style', 'q-style', 'change', 'value'],
  ['qs-color', 'q-color', 'input', 'value'], ['qs-alpha', 'q-alpha', 'input', 'value'],
  ['qs-dot', 'q-dot', 'change', 'checked'], ['qs-t', 'q-t', 'change', 'checked'],
];
export class QuantController {
  constructor(view, worker, records, meta, evidence = null) {
    Object.assign(this, { view, worker, records, meta, evidence, generation: 0, closed: false, timer: null,
      importTimer: null, frame: null, dirtyDetails: new Set(), listeners: new AbortController(),
      discriminating: null, discriminatingPending: null });
    this.state = { settings: {}, result: null, measurements: [], targetOverride: null, targetMask: null, screenshotMeta: null, source: null, importNotes: [] };
  }
  get(id) { return this.view.get(id); }
  on(id, event, handler) { this.get(id).addEventListener(event, handler, { signal: this.listeners.signal }); }
  options() { return { oldHeight: this.get('q-old-height').valueAsNumber, currentHeight: this.get('q-new-height').valueAsNumber,
    authoredHeight: this.get('q-new-height').valueAsNumber, goal: this.get('q-goal').value,
    outlineMode: this.outlineValue(), styleTarget: this.get('q-style').value, corrections: this.corrections() }; }
  /** The Simple view always runs the automatic model; a historical model chosen in the expert lab applies there only. */
  modelRequest() { return currentMode() === 'expert' ? this.get('q-model').value : ''; }
  /** Automatic appearance corrections: the expert switch; the Simple view always keeps them on. */
  corrections() { return currentMode() !== 'expert' || this.get('q-corrections').checked; }
  outlineValue() { const value = this.get('q-outline').value; return value === 'auto' ? 'auto' : Number(value); }

  start() {
    try { this.init(); } catch (error) { this.close(); throw error; }
    return this;
  }
  init() {
    fillPresets(this); bindSources(this); bindFeedback(this); this.bindOutput(); this.bindSimple();
    this.observer = new ResizeObserver(() => { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.refresh()); });
    this.observer.observe(this.view.root.querySelector('.quant-previews'));
    this.observer.observe(this.view.root.querySelector('.specimen'));
    document.fonts?.ready.then(() => { if (!this.closed) this.refresh(); });
    // The corrections switch applies in the expert view only, so a mode change can change the export.
    window.addEventListener('sicc:modechange', () => { if (!this.get('q-corrections').checked || this.get('q-model').value) this.schedule(); },
      { signal: this.listeners.signal });
    this.setSettings(this.records[0]); this.schedule();
  }

  bindOutput() {
    for (const id of ['q-model', 'q-decision', 'q-goal', 'q-certify', 'q-outline', 'q-style', 'q-corrections'])
      this.on(id, 'change', () => this.schedule());
    for (const id of ['q-zoom', 'q-grid', 'q-difference']) this.on(id, 'change', () => this.refresh());
    for (const id of ['q-scenarios', 'q-trace-panel', 'q-derivation-panel', 'q-feedback']) this.on(id, 'toggle', () => this.renderDetails());
    this.on('q-copy', 'click', () => copy(this.get('q-cfg').value, this.get('q-status')));
    this.on('q-download-cfg', 'click', () => this.downloadCfg());
    this.on('q-download-report', 'click', () => {
      if (!this.state.result) return;
      // The exact one-line export, so the report needs no re-derivation (null while blocked).
      const exportedCommands = this.state.result.blockers.length ? null : exportQuantCFG(this.state.result);
      download('crosshair-quant-report.json', JSON.stringify({ ...this.state.result, exportedCommands, corpus: this.meta,
        source: this.state.source, screenshotProvenance: this.state.screenshotMeta, nativeMeasurements: this.state.measurements }, null, 2));
    });
  }

  bindSimple() {
    for (const [from, to, event, prop] of SIMPLE_PAIRS) this.on(from, event, () => {
      this.get(to)[prop] = this.get(from)[prop];
      this.get(to).dispatchEvent(new Event(event));
    });
    this.on('qs-load', 'click', () => { this.get('q-import').value = this.get('qs-import').value; this.importText(); });
    this.on('qs-copy', 'click', () => copy(this.get('q-cfg').value, this.get('qs-status')));
    this.on('qs-download', 'click', () => this.downloadCfg());
    this.on('qs-advanced', 'click', () => toggleMode({ focus: true }));
  }
  downloadCfg() { if (this.state.result) download('small-indie-crosshair.cfg', exportQuantCFG(this.state.result) + '\n', 'text/plain'); }

  /** Shows the expert values in the Simple controls (outline, style, heights, ...), so both views show what is exported. */
  syncSimple() {
    for (const [simple, expert, , prop] of SIMPLE_PAIRS) {
      const to = this.get(simple), value = this.get(expert)[prop];
      if (to[prop] !== value) to[prop] = value;
    }
  }
  setInputStatus(text) {
    const full = this.get('q-import').value.length >= MAX_IMPORT;
    const note = full ? ` The input reached the ${MAX_IMPORT} character limit; it may be cut off.` : '';
    this.get('q-input-status').textContent = this.get('qs-input-status').textContent = text + note;
  }

  setSettings(values) {
    const next = Object.fromEntries(SETTING_KEYS.map(key => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
    // Validate before replacing state, so a rejected crosshair leaves the previous valid one in place.
    const color = rgba(next);
    this.state.importNotes = []; this.state.settings = next;
    this.clearImageTarget();
    for (const [id, key] of [['q-size', 'size'], ['q-thickness', 'thickness'], ['q-gap', 'gap']]) this.get(id).value = values[key];
    this.get('q-dot').checked = values.dot; this.get('q-t').checked = values.t_style;
    this.get('q-color').value = '#' + color.rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    this.get('q-alpha').value = color.alpha;
    this.state.rejected = null;
    this.syncSimple();
  }
  clearImageTarget() { this.state.targetOverride = null; this.state.targetMask = null; this.state.screenshotMeta = null; }
  readSettings() {
    return { ...this.state.settings, size: this.get('q-size').valueAsNumber, thickness: this.get('q-thickness').valueAsNumber,
      gap: this.get('q-gap').valueAsNumber, dot: this.get('q-dot').checked, t_style: this.get('q-t').checked };
  }
  invalidate() {
    clearTimeout(this.timer); this.generation++; this.state.result = null;
    clearResult(this.view);
  }
  schedule() {
    this.invalidate(); this.syncSimple();
    // A rejected import keeps its error, and no export, until valid input or an edited value replaces it.
    if (this.state.rejected) return this.fail(this.state.rejected);
    this.timer = setTimeout(() => this.analyze(), 90); }
  fail(error) { this.state.result = null; clearResult(this.view, 'error', error.message); }

  async analyze() {
    const ticket = this.generation;
    try {
      const decision = this.get('q-decision').value;
      const labels = { worst: 'Historical · limit largest mismatch', cvar: 'Historical · limit weighted worst tail (CVaR)' };
      const select = this.get('q-model');
      select.options[0].textContent = 'Automatic · community static reconstruction';
      select.options[1].textContent = labels[decision] ?? 'Historical · weighted model hedge';
      this.state.settings = this.readSettings();
      const selectedModelId = resolveModelChoice({ request: this.modelRequest() });
      const build = selectedModelId ? getModel(selectedModelId).build ?? BUILD : BUILD;
      const community = selectedModelId === COMMUNITY_MODEL.id;
      for (const id of ['q-decision', 'q-certify']) this.get(id).disabled = community;
      // Historical models have no appearance corrections.
      this.get('q-corrections').disabled = !community;
      this.view.root.dataset.strategy = selectedModelId ? 'model' : 'hedge';
      const options = { ...this.options(), ...(community ? {} : { corrections: true }) };
      const result = await this.worker.call('infer', { settings: this.state.settings, options,
        measurements: this.state.measurements.filter(row => row.build === build),
        targetOverride: this.state.targetOverride, targetMask: this.state.targetMask,
        selectedModelId, decision, certify: this.get('q-certify').checked });
      if (ticket !== this.generation || this.closed) return;
      // A partial paste took game defaults: say so in the report and both warning lists.
      const filled = defaultsWarning(this.state.importNotes);
      const report = filled ? { ...result, warnings: [filled, ...result.warnings] } : result;
      this.state.result = report; this.dirtyDetails.clear();
      renderResult(this.view, report, this.evidence); renderOutcomes(this.view, report, this.state.importNotes);
      renderPreviews(this.view, report, this.state.targetMask); this.renderDetails();
    } catch (error) {
      if (ticket === this.generation && !this.closed) this.fail(error);
    }
  }
  refresh() {
    renderPreviews(this.view, this.state.result, this.state.targetMask); renderSimple(this.view, this.state.result, { status: false });
  }

  renderDetails() {
    const r = this.state.result;
    if (!r) return;
    const renders = {
      'q-scenarios': () => renderScenarios(this.view, r, id => { this.get('q-model').value = id; this.schedule(); }),
      'q-trace-panel': () => renderTrace(this.view, r, this.state.screenshotMeta),
      'q-derivation-panel': () => renderDerivation(this.view, r),
      'q-feedback': () => { this.loadDiscriminating(); },
    };
    for (const [id, render] of Object.entries(renders)) {
      if (!this.get(id).open || this.dirtyDetails.has(id)) continue;
      render(); this.dirtyDetails.add(id);
    }
  }

  /** Bounded and lazy: only runs while the feedback panel is open, and only once per posterior-weight signature.
   * A reply that arrives after a newer analysis is kept and drawn for it, or re-requested if the weights changed. */
  async loadDiscriminating() {
    const r = this.state.result;
    if (!r || !this.get('q-feedback').open) return;
    if (!r.posterior.weights.length) {
      this.get('q-discriminating').textContent = 'Select a historical hypothesis or the weighted hedge to explore its capture plan.';
      return;
    }
    const signature = r.posterior.weights.map(w => w.toPrecision(10)).join(',');
    // The panel is emptied on every invalidate, so a cached set is drawn again rather than skipped.
    if (this.discriminating?.signature === signature) { renderDiscriminating(this.view, this.discriminating.set); return; }
    const ticket = this.generation, output = this.get('q-discriminating');
    output.textContent = 'Computing a discriminating capture plan…';
    if (this.discriminatingPending === signature) return;
    this.discriminatingPending = signature;
    let retry = false;
    try {
      const set = await this.worker.call('discriminating', { measurements: this.state.measurements.filter(row => row.build === BUILD) });
      if (this.closed) return;
      // The plan depends on the weights, not on the generation: keep it, and draw it once the current result matches.
      // An out-of-order reply for weights that are no longer current must not replace a newer cached plan.
      const current = this.state.result?.posterior.weights.map(w => w.toPrecision(10)).join(',');
      if (ticket === this.generation || current === signature || !this.discriminating) this.discriminating = { signature, set };
      if (ticket === this.generation) renderDiscriminating(this.view, set); else retry = true;
    } catch (error) {
      if (ticket === this.generation && !this.closed) output.textContent = `No discriminating set: ${error.message}`;
      else retry = !this.closed;
    } finally {
      if (this.discriminatingPending === signature) this.discriminatingPending = null;
    }
    if (retry) await this.loadDiscriminating();
  }

  importText() {
    clearTimeout(this.importTimer); this.invalidate();
    try {
      const text = this.get('q-import').value.trim();
      // A pasted block is complete on its own: unspecified cvars take the pre-update game defaults, not the last crosshair.
      const { config: values, notes } = parseLegacyTextWithNotes(text);
      this.setSettings(values); this.state.source = { type: 'user-input' }; this.state.importNotes = notes;
      const short = notes.map(note => note.startsWith(DEFAULTS_NOTE_PREFIX)
        ? `${defaultedCvars([note]).length} values were added from the old game's defaults (see the warnings).`
        : note.replace(/^Ignored (\d+) cvar\(s\).*$/, '$1 unrelated cvars ignored (see the table).'));
      this.setInputStatus(['Old settings loaded.', ...short].join(' '));
      this.get('q-provenance').replaceChildren(); this.schedule();
    } catch (error) {
      this.setInputStatus(error.message);
      // A current-format share code needs no conversion; the previous crosshair's export would be stale, so none is offered.
      this.state.rejected = error; this.fail(error);
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true; this.generation++; clearTimeout(this.timer); clearTimeout(this.importTimer);
    cancelAnimationFrame(this.frame); this.listeners.abort(); this.observer?.disconnect(); this.worker.close();
  }
}
