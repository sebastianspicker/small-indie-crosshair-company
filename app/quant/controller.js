import { decodeLegacy } from '../../lib/sharecode.js';
import { DEFAULT_SETTINGS, parseLegacyCFG } from '../../lib/cfg.js';
import { rgba } from '../../lib/conversion.js';
import { copy, download } from '../dom.js';
import { exportQuantCFG } from '../../lib/quant/export.js';
import { clearResult, renderResult, renderPreviews, renderDerivation, renderScenarios, renderTrace, renderSimple } from './presentation.js';
import { bindSources, fillPresets } from './sources.js';
import { bindFeedback } from './feedback.js';
import { toggleMode } from '../mode.js';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
export class QuantController {
  constructor(view, worker, records, meta) {
    Object.assign(this, { view, worker, records, meta, generation: 0, closed: false, timer: null,
      importTimer: null, frame: null, dirtyDetails: new Set(), listeners: new AbortController() });
    this.state = { settings: {}, result: null, measurements: [], targetOverride: null, targetMask: null, screenshotMeta: null, source: null };
  }
  get(id) { return this.view.get(id); }
  on(id, event, handler) { this.get(id).addEventListener(event, handler, { signal: this.listeners.signal }); }
  options() { return { oldHeight: this.get('q-old-height').valueAsNumber, currentHeight: this.get('q-new-height').valueAsNumber,
    authoredHeight: this.get('q-new-height').valueAsNumber, goal: this.get('q-goal').value }; }

  start() {
    fillPresets(this); bindSources(this); bindFeedback(this); this.bindOutput(); this.bindSimple();
    this.observer = new ResizeObserver(() => { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.refresh()); });
    this.observer.observe(this.view.root.querySelector('.quant-previews'));
    this.setSettings(this.records[0]); this.schedule();
    return this;
  }

  bindOutput() {
    for (const id of ['q-model', 'q-decision', 'q-goal']) this.on(id, 'change', () => this.schedule());
    for (const id of ['q-zoom', 'q-grid', 'q-difference']) this.on(id, 'change', () => this.refresh());
    for (const id of ['q-scenarios', 'q-trace-panel', 'q-derivation-panel']) this.on(id, 'toggle', () => this.renderDetails());
    this.on('q-copy', 'click', () => copy(this.get('q-cfg').value, this.get('q-status')));
    this.on('q-download-cfg', 'click', () => { if (this.state.result) download('small-indie-crosshair.cfg', exportQuantCFG(this.state.result), 'text/plain'); });
    this.on('q-download-report', 'click', () => {
      if (!this.state.result) return;
      download('crosshair-quant-report.json', JSON.stringify({ ...this.state.result, corpus: this.meta,
        source: this.state.source, screenshotProvenance: this.state.screenshotMeta, nativeMeasurements: this.state.measurements }, null, 2));
    });
  }

  bindSimple() {
    const pairs = [
      ['qs-size', 'q-size', 'input', 'value'], ['qs-thickness', 'q-thickness', 'input', 'value'], ['qs-gap', 'q-gap', 'input', 'value'],
      ['qs-old-height', 'q-old-height', 'input', 'value'], ['qs-new-height', 'q-new-height', 'input', 'value'],
      ['qs-goal', 'q-goal', 'change', 'value'], ['qs-color', 'q-color', 'input', 'value'], ['qs-alpha', 'q-alpha', 'input', 'value'],
      ['qs-dot', 'q-dot', 'change', 'checked'], ['qs-t', 'q-t', 'change', 'checked'],
    ];
    for (const [from, to, event, prop] of pairs) this.on(from, event, () => {
      this.get(to)[prop] = this.get(from)[prop];
      this.get(to).dispatchEvent(new Event(event));
    });
    this.on('qs-load', 'click', () => { this.get('q-import').value = this.get('qs-import').value; this.importText(); });
    this.on('qs-copy', 'click', () => copy(this.get('q-cfg').value, this.get('qs-status')));
    this.on('qs-download', 'click', () => { if (this.state.result) download('small-indie-crosshair.cfg', exportQuantCFG(this.state.result), 'text/plain'); });
    this.on('qs-advanced', 'click', () => toggleMode());
  }

  setSettings(values) {
    this.state.settings = Object.fromEntries(SETTING_KEYS.map(key => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
    this.clearImageTarget();
    for (const [id, key] of [['q-size', 'size'], ['q-thickness', 'thickness'], ['q-gap', 'gap']]) this.get(id).value = values[key];
    this.get('q-dot').checked = values.dot; this.get('q-t').checked = values.t_style;
    const color = rgba(this.state.settings);
    this.get('q-color').value = '#' + color.rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    this.get('q-alpha').value = color.alpha;
    for (const id of ['size', 'thickness', 'gap', 'old-height', 'new-height', 'goal', 'color', 'alpha'])
      this.get(`qs-${id}`).value = this.get(`q-${id}`).value;
    this.get('qs-dot').checked = this.get('q-dot').checked;
    this.get('qs-t').checked = this.get('q-t').checked;
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
  schedule() { this.invalidate(); this.timer = setTimeout(() => this.analyze(), 90); }
  fail(error) { this.state.result = null; clearResult(this.view, 'error', error.message); }

  async analyze() {
    const ticket = this.generation;
    try {
      this.get('q-model').options[0].textContent = this.get('q-decision').value === 'worst'
        ? 'Automatic · limit largest mismatch' : 'Automatic · lowest weighted mismatch';
      this.state.settings = this.readSettings();
      const report = await this.worker.call('infer', { settings: this.state.settings, options: this.options(),
        measurements: this.state.measurements, targetOverride: this.state.targetOverride, targetMask: this.state.targetMask,
        selectedModelId: this.get('q-model').value || null, decision: this.get('q-decision').value });
      if (ticket !== this.generation || this.closed) return;
      this.state.result = report; this.dirtyDetails.clear();
      renderResult(this.view, report); this.refresh(); this.renderDetails();
    } catch (error) {
      if (ticket === this.generation && !this.closed) this.fail(error);
    }
  }
  refresh() { renderPreviews(this.view, this.state.result, this.state.targetMask); renderSimple(this.view, this.state.result); }

  renderDetails() {
    const r = this.state.result;
    if (!r) return;
    const renders = {
      'q-scenarios': () => renderScenarios(this.view, r, id => { this.get('q-model').value = id; this.schedule(); }),
      'q-trace-panel': () => renderTrace(this.view, r, this.state.screenshotMeta),
      'q-derivation-panel': () => renderDerivation(this.view, r),
    };
    for (const [id, render] of Object.entries(renders)) {
      if (!this.get(id).open || this.dirtyDetails.has(id)) continue;
      render(); this.dirtyDetails.add(id);
    }
  }

  importText() {
    clearTimeout(this.importTimer); this.invalidate();
    try {
      const text = this.get('q-import').value.trim();
      const values = text.startsWith('CSGO-') ? decodeLegacy(text) : parseLegacyCFG(text, this.state.settings).config;
      this.setSettings(values); this.state.source = { type: 'user-input' };
      this.get('q-input-status').textContent = this.get('qs-input-status').textContent = 'Old settings loaded.';
      this.get('q-provenance').replaceChildren(); this.schedule();
    } catch (error) { this.get('q-input-status').textContent = this.get('qs-input-status').textContent = error.message; this.fail(error); }
  }

  close() {
    if (this.closed) return;
    this.closed = true; this.generation++; clearTimeout(this.timer); clearTimeout(this.importTimer);
    cancelAnimationFrame(this.frame); this.listeners.abort(); this.observer?.disconnect(); this.worker.close();
  }
}
