import { DEFAULT_SETTINGS, DEFAULTS_NOTE_PREFIX, LEGACY_SETTING_KEYS } from '../../lib/settings/cfg.js';
import { defaultedCvars, defaultsWarning } from '../../lib/settings/outcomes.js';
import { parseLegacyTextWithNotes } from '../../lib/settings/import.js';
import { rgba, defaultExportGroups, requiredExportGroups } from '../../lib/settings/native.js';
import { copy, download } from '../ui/dom.js';
import { exportQuantCFG, mergedExportOverrides } from '../../lib/solver/export.js';
import { resolveModelChoice } from '../../lib/solver/selection.js';
import { BUILD, getModel } from '../../lib/solver/renderer.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { clearResult, renderResult, renderPreviews, renderDerivation, renderScenarios, renderTrace, renderSimple, renderDiscriminating } from './presentation.js';
import { bindSources, fillPresets, renderColourSource } from './sources.js';
import { bindFeedback } from './feedback.js';
import { renderOutcomes } from './outcomes.js';
import { SAMPLES, renderSamples } from './samples.js';
import { GROUP_CHECKS, EXPERT_SECTIONS } from './view.js';
import { PLATES, SCENE_PLATES, DEFAULT_PLATE, writeColour, syncInputs, syncHeight } from './inputs.js';

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);
const MAX_IMPORT = 32768;
export class QuantController {
  constructor(view, worker, records, meta, evidence = null) {
    Object.assign(this, { view, worker, records, meta, evidence, generation: 0, closed: false, timer: null,
      importTimer: null, frame: null, dirtyDetails: new Set(), expert: new Set(), listeners: new AbortController(),
      discriminating: null, discriminatingPending: null });
    this.state = { settings: {}, result: null, measurements: [], targetOverride: null, targetMask: null, screenshotMeta: null,
      source: null, importNotes: [],
      // Setting keys the input assigned and the export groups ticked from them (null until the next result).
      assigned: [...LEGACY_SETTING_KEYS], exportGroups: null, groupsFresh: true, groupOutlineChoice: 'auto' };
  }
  get(id) { return this.view.get(id); }
  on(id, event, handler) { this.get(id).addEventListener(event, handler, { signal: this.listeners.signal }); }
  options() {
    const height = this.get('qs-new-height').valueAsNumber;
    return { oldHeight: this.get('qs-old-height').valueAsNumber, currentHeight: height, authoredHeight: height,
      goal: this.get('q-goal').value, outlineMode: this.outlineValue(), styleTarget: this.get('q-style').value,
      corrections: this.get('q-corrections').checked, tShape: this.get('qs-t-export').value || 'keep' };
  }
  /** The model chosen in the Conversion expert options; '' is the automatic community model. */
  modelRequest() { return this.get('q-model').value; }
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
    this.setPlate(DEFAULT_PLATE, false);
    this.setSettings(this.records[0]); this.schedule();
  }
  /** The preview background: the tokens on #quant change, so every plate repaints. Not remembered (ADR-0004). */
  setPlate(name, repaint = true) {
    if (!PLATES.some(([plate]) => plate === name)) return;
    const scene = SCENE_PLATES.some(([plate]) => plate === name), { dataset } = this.view.root;
    dataset.plate = name; this.get('qs-plate').value = name;
    if (scene) dataset.plateKind = 'scene'; else delete dataset.plateKind;
    this.get('qs-plate-note').hidden = !scene;
    if (repaint) this.refresh();
  }

  bindOutput() {
    for (const id of ['q-model', 'q-decision', 'q-goal', 'q-certify', 'q-outline', 'q-style', 'q-corrections'])
      this.on(id, 'change', () => { this.markExpert(); this.schedule(); });
    for (const id of ['q-zoom', 'q-grid', 'q-difference']) this.on(id, 'change', () => this.refresh());
    for (const id of ['q-scenarios', 'q-trace-panel', 'q-derivation-panel', 'q-feedback']) this.on(id, 'toggle', () => this.renderDetails());
    // Each section's Expert switch shows or hides its panel; canvases in a hidden panel have no size, so opening repaints.
    for (const key of EXPERT_SECTIONS) this.on(`q-expert-${key}`, 'click', () => this.setExpert(key, !this.expert.has(key)));
    this.on('q-download-cfg', 'click', () => this.downloadCfg());
    this.on('q-download-report', 'click', () => {
      if (!this.state.result) return;
      // The exact one-line export, so the report needs no re-derivation (null while blocked).
      const exportedCommands = this.state.result.blockers.length ? null : exportQuantCFG(this.state.result, this.include());
      download('crosshair-quant-report.json', JSON.stringify({ ...this.state.result, exportedCommands,
        exportGroups: this.effectiveGroups(), corpus: this.meta,
        source: this.state.source, screenshotProvenance: this.state.screenshotMeta, nativeMeasurements: this.state.measurements }, null, 2));
    });
  }

  /** Shows or hides one section's expert panel. Per section, not remembered (ADR-0004); the options always apply either way. */
  setExpert(key, on) {
    if (on) this.expert.add(key); else this.expert.delete(key);
    this.get(`q-expert-${key}-panel`).hidden = !on;
    this.get(`q-expert-${key}`).setAttribute('aria-expanded', String(on));
    if (on) { this.refresh(); this.renderDetails(); }
  }
  /** Marks a switch while its hidden expert content is in use: Conversion when the model, an enabled decision rule or the
   * corrections are off their default, Input while published settings are the source. The mark is a dot and a description. */
  markExpert() {
    const decision = this.get('q-decision');
    const changed = { conversion: this.get('q-model').value !== '' || (!decision.disabled && decision.value !== 'expected') ||
      !this.get('q-corrections').checked, input: this.state.source?.type === 'preset' };
    for (const [key, on] of Object.entries(changed)) {
      const switchNode = this.get(`q-expert-${key}`);
      if (on) { switchNode.dataset.modified = 'true'; switchNode.setAttribute('aria-describedby', `q-expert-${key}-modified`); }
      else { delete switchNode.dataset.modified; switchNode.removeAttribute('aria-describedby'); }
    }
  }

  bindSimple() {
    this.on('qs-copy', 'click', () => copy(this.get('q-cfg').value, this.get('qs-status')));
    for (const [group, [id]] of Object.entries(GROUP_CHECKS)) this.on(id, 'change', () => {
      if (this.state.exportGroups) { this.state.exportGroups[group] = this.get(id).checked; this.rerenderExport(); }
    });
    this.on('qs-download', 'click', () => this.downloadCfg());
    this.on('qs-t-export', 'change', () => this.schedule());
    this.on('qs-plate', 'change', () => this.setPlate(this.get('qs-plate').value));
    this.on('qs-clear', 'click', () => this.clear());
    this.on('qs-samples', 'toggle', () => { if (this.get('qs-samples').open) renderSamples(this.get.bind(this)); });
    for (const sample of SAMPLES) this.on(`${sample.id}-try`, 'click', () => {
      this.get('qs-import').value = sample.text; this.importText(); this.get('qs-import').focus?.();
    });
  }
  downloadCfg() {
    if (this.state.result) download('small-indie-crosshair.cfg', exportQuantCFG(this.state.result, this.include()) + '\n', 'text/plain');
  }

  /** The export-group selection for the export functions (null until the first result sets the defaults). */
  include() { return this.state.exportGroups && { ...this.state.exportGroups }; }
  /** The groups actually exported: a required group is on whatever its checkbox says. */
  effectiveGroups() {
    const groups = this.state.exportGroups;
    const required = requiredExportGroups(this.state.result ? mergedExportOverrides(this.state.result) : {});
    return groups && Object.fromEntries(Object.entries(groups).map(([key, on]) => [key, on || Boolean(required[key])]));
  }
  /** Ticks the group checkboxes from the state; a required group is ticked and disabled with the reason. */
  syncGroups() {
    const groups = this.state.exportGroups;
    const required = requiredExportGroups(this.state.result ? mergedExportOverrides(this.state.result) : {});
    for (const [group, [id]] of Object.entries(GROUP_CHECKS)) {
      const box = this.get(id);
      box.checked = Boolean(groups?.[group]) || Boolean(required[group]); box.disabled = !groups || Boolean(required[group]);
      if (required[group]) box.title = 'Required: the old outline strokes are redrawn as bars with these settings.';
      else box.removeAttribute('title');
    }
  }
  /** A group was ticked or unticked: redraw the commands, the exported line and the outcomes without a new inference. */
  rerenderExport() {
    const report = this.state.result, include = this.include();
    if (!report) return;
    renderSimple(this.view, report, { status: false, include });
    this.get('q-cfg').value = report.blockers.length ? '' : exportQuantCFG(report, include);
    renderOutcomes(this.view, report, this.state.importNotes, include);
  }

  setInputStatus(text) {
    const full = this.get('qs-import').value.length >= MAX_IMPORT;
    const note = full ? ` The input reached the ${MAX_IMPORT} character limit; it may be cut off.` : '';
    this.get('q-input-status').textContent = this.get('qs-input-status').textContent = text + note;
  }

  setSettings(values, assigned = LEGACY_SETTING_KEYS) {
    const next = Object.fromEntries(SETTING_KEYS.map(key => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
    // Validate before replacing state, so a rejected crosshair leaves the previous valid one in place.
    const color = rgba(next);
    this.state.importNotes = []; this.state.settings = next; this.state.exportGroups = null;
    this.clearImageTarget();
    for (const [id, key] of [['qs-size', 'size'], ['qs-thickness', 'thickness'], ['qs-gap', 'gap']]) this.get(id).value = values[key];
    this.get('qs-dot').checked = values.dot; this.get('qs-t').checked = values.t_style;
    this.get('qs-alpha').value = color.alpha; syncInputs(this.view.get); writeColour(this.view.get, [...color.rgb]);
    this.state.rejected = null; this.state.assigned = [...assigned]; this.state.groupsFresh = true; this.state.colourEdited = false;
  }
  clearImageTarget() { this.state.targetOverride = null; this.state.targetMask = null; this.state.screenshotMeta = null; }
  readSettings() {
    return { ...this.state.settings, size: this.get('qs-size').valueAsNumber, thickness: this.get('qs-thickness').valueAsNumber,
      gap: this.get('qs-gap').valueAsNumber, dot: this.get('qs-dot').checked, t_style: this.get('qs-t').checked };
  }
  invalidate() {
    clearTimeout(this.timer); this.generation++; this.state.result = null;
    clearResult(this.view);
  }
  schedule() {
    this.invalidate(); renderColourSource(this); this.markExpert();
    // Until the user loads or edits a crosshair the page shows the default preset and the open examples; a result
    // collapses them. After Clear nothing is converted until new input arrives.
    const empty = String(!this.state.source);
    if (this.view.root.dataset.empty !== empty) this.get('qs-samples').open = empty === 'true';
    this.view.root.dataset.empty = empty;
    if (this.state.cleared && !this.state.source) return clearResult(this.view, 'empty', '');
    // A rejected import keeps its error, and no export, until valid input or an edited value replaces it.
    if (this.state.rejected) return this.fail(this.state.rejected);
    this.timer = setTimeout(() => this.analyze(), 90); }
  fail(error) { this.state.result = null; clearResult(this.view, 'error', error.message); }

  async analyze() {
    const ticket = this.generation;
    try {
      const decision = this.get('q-decision').value;
      const labels = { worst: 'Historical: limit largest mismatch', cvar: 'Historical: limit weighted worst tail (CVaR)' };
      const select = this.get('q-model');
      select.options[0].textContent = 'Automatic: community static reconstruction';
      select.options[1].textContent = labels[decision] ?? 'Historical: weighted model hedge';
      this.state.settings = this.readSettings();
      const selectedModelId = resolveModelChoice({ request: this.modelRequest() });
      const build = selectedModelId ? getModel(selectedModelId).build ?? BUILD : BUILD;
      const community = selectedModelId === COMMUNITY_MODEL.id;
      for (const id of ['q-decision', 'q-certify']) this.get(id).disabled = community;
      // Historical models have no appearance corrections.
      this.get('q-corrections').disabled = !community;
      this.get('q-decision-note').textContent = community ? 'Not used by the automatic model.' : '';
      this.get('q-corrections').title = community ? '' : 'Automatic model only.';
      this.markExpert();
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
      // A new input ticks the groups its old settings set; later ticks stay until the next import, clear or sample.
      if (this.state.groupsFresh || !this.state.exportGroups) {
        this.state.exportGroups = defaultExportGroups(this.state.assigned, report.settings, mergedExportOverrides(report));
        // Retain a hand-selected mode even while a shape transformation makes its group mandatory.
        if (options.outlineMode !== 'auto') this.state.exportGroups.outline = true;
        this.state.groupsFresh = false;
      } else if (options.outlineMode !== 'auto' && options.outlineMode !== this.state.groupOutlineChoice)
        this.state.exportGroups.outline = true;
      // Back to Auto: the outline tick follows the old settings again rather than the abandoned hand choice.
      else if (options.outlineMode === 'auto' && this.state.groupOutlineChoice !== 'auto')
        this.state.exportGroups.outline = defaultExportGroups(this.state.assigned, report.settings,
          mergedExportOverrides(report)).outline;
      this.state.groupOutlineChoice = options.outlineMode;
      this.syncGroups(); const include = this.include();
      renderResult(this.view, report, this.evidence, include); renderOutcomes(this.view, report, this.state.importNotes, include);
      this.renderPreviews(); this.renderDetails();
    } catch (error) {
      if (ticket === this.generation && !this.closed) this.fail(error);
    }
  }
  /** The difference plates live in the Preview expert panel: painted only while it is shown (opening it refreshes). */
  renderPreviews() { if (this.expert.has('preview')) renderPreviews(this.view, this.state.result, this.state.targetMask); }
  refresh() {
    this.renderPreviews();
    renderSimple(this.view, this.state.result, { status: false, include: this.include() });
    if (this.get('qs-samples').open) renderSamples(this.get.bind(this));
  }

  /** The lazy details live in the What happened expert panel: rendered only while it is shown (opening it renders them). */
  renderDetails() {
    const r = this.state.result;
    if (!r || !this.expert.has('report')) return;
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

  /** A link from the screenshot page (`#quant?paste=…`, validated by parseRoute): its settings text and heights,
   * imported as if pasted. */
  applyRoute({ paste, oldHeight, newHeight, error }) {
    if (error) return this.setInputStatus(error);
    for (const [id, height] of [['qs-old-height', oldHeight], ['qs-new-height', newHeight]]) {
      if (height) { this.get(id).value = String(height); syncHeight(this.view.get, id); }
    }
    this.get('qs-import').value = paste; this.importText();
  }

  importText() {
    clearTimeout(this.importTimer); this.invalidate();
    try {
      const text = this.get('qs-import').value.trim();
      // A pasted block is complete on its own: unspecified cvars take the pre-update game defaults, not the last crosshair.
      const { config: values, notes, assigned } = parseLegacyTextWithNotes(text);
      this.setSettings(values, assigned); this.state.source = { type: 'user-input' }; this.state.importNotes = notes;
      const short = notes.map(note => note.startsWith(DEFAULTS_NOTE_PREFIX)
        ? `${defaultedCvars([note]).length} values taken from the old game's defaults.`
        : note.replace(/^Ignored (\d+) cvar\(s\).*$/, '$1 unrelated cvars ignored.'));
      this.setInputStatus(['Old settings loaded.', ...short].join(' '));
      this.get('q-provenance').replaceChildren(); this.schedule();
    } catch (error) {
      this.setInputStatus(error.message);
      // A current-format share code needs no conversion; the previous crosshair's export would be stale, so none is offered.
      this.state.rejected = error; this.fail(error);
    }
  }

  /** Back to the empty state: no paste, no result, the examples open, focus in the paste box. */
  clear() {
    clearTimeout(this.importTimer);
    Object.assign(this.state, { source: null, cleared: true, rejected: null, importNotes: [], assigned: [...LEGACY_SETTING_KEYS],
      exportGroups: null, groupsFresh: true });
    this.clearImageTarget(); this.state.colourEdited = false;
    this.get('qs-import').value = ''; this.get('q-provenance').replaceChildren(); this.setInputStatus('');
    this.schedule();
    renderSamples(this.get.bind(this));
    this.get('qs-import').focus?.();
  }

  close() {
    if (this.closed) return;
    this.closed = true; this.generation++; clearTimeout(this.timer); clearTimeout(this.importTimer);
    cancelAnimationFrame(this.frame); this.listeners.abort(); this.observer?.disconnect(); this.worker.close();
  }
}
