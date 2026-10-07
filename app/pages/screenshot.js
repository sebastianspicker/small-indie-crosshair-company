// Screenshot (#screenshot): an old-game screenshot in, new settings out, with the checks that say how far to trust them.
// The image is decoded and read in this tab; the solver runs in a worker. Nothing is stored or uploaded (ADR-0004).
import { el, fmt, copy, download, sheetHead, docLink } from '../ui/dom.js';
import { ResearchWorker } from '../worker/client.js';
import { loadQuantCorpus } from '../data.js';
import { converterLink } from '../ui/route.js';
import { PLATES, SCENE_PLATES, DEFAULT_PLATE, syncHeight } from '../convert/inputs.js';
import { expertParts, heightField, plateChoice, plate, readout } from '../convert/view.js';
import { paintQuant, fitZoom } from '../convert/preview.js';
import { exportedLook } from '../convert/evidence.js';
import { shownWarnings, warningItem } from '../convert/outcomes.js';
import { pngDimensions, sourceBoundaryClipped } from '../../lib/image/screenshot.js';
import { parseLegacyText } from '../../lib/settings/import.js';
import { LEGACY_SETTING_KEYS } from '../../lib/settings/cfg.js';
import { defaultExportGroups, nativeOutlineExtent } from '../../lib/settings/native.js';
import { exportQuantCFG, mergedExportOverrides } from '../../lib/solver/export.js';
import { resolveModelChoice } from '../../lib/solver/selection.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';

export const SIDE = 129;
export const MAX_BYTES = 16 * 1024 * 1024;
const MIN_HEIGHT = 240, MAX_HEIGHT = 16384, DEFAULT_TOLERANCE = 40;
/** The confidence rule, as shown on the page. The three numbers are the thresholds the checks use. */
export const RULE = Object.freeze({ mask: .9, stability: .98, shape: .8 });
const RULE_ROWS = Object.freeze([['High', 'Image checks pass; shape exact, or exact after a 1 px shift.'],
  ['Medium', `Image checks pass; shape ${100 * RULE.shape}% or more.`],
  ['Low', `An image check fails, or shape below ${100 * RULE.shape}%, empty or missing.`]]);
/** The converter's defaults, with the one choice a screenshot cannot make (T shape) kept as in the old image. */
const defaultOptions = (oldHeight, newHeight) => ({ oldHeight, currentHeight: newHeight, authoredHeight: newHeight, goal: 'pixels',
  outlineMode: 'auto', styleTarget: 'static', corrections: true, tShape: 'keep' });

/** Old cvar names in the order the converter's paste box reads them, with the setting each one carries. */
const OLD_CVARS = Object.freeze([['cl_crosshairsize', 'size'], ['cl_crosshairthickness', 'thickness'], ['cl_crosshairgap', 'gap'],
  ['cl_crosshairstyle', 'style'], ['cl_crosshairdot', 'dot'], ['cl_crosshair_t', 't_style'], ['cl_crosshair_drawoutline', 'outline'],
  ['cl_crosshair_outlinethickness', 'outline_width'], ['cl_crosshair_recoil', 'recoil'], ['cl_crosshairgap_useweaponvalue', 'weapon_gap'],
  ['cl_crosshairalpha', 'alpha'], ['cl_crosshairusealpha', 'alpha_enabled'], ['cl_crosshaircolor', 'color'],
  ['cl_crosshaircolor_r', 'r'], ['cl_crosshaircolor_g', 'g'], ['cl_crosshaircolor_b', 'b'], ['cl_fixedcrosshairgap', 'fixed_gap'],
  ['cl_crosshair_dynamic_splitdist', 'split_distance'], ['cl_crosshair_dynamic_splitalpha_innermod', 'inner_alpha'],
  ['cl_crosshair_dynamic_splitalpha_outermod', 'outer_alpha'], ['cl_crosshair_dynamic_maxdist_splitratio', 'split_ratio']]);

/** The representative old settings of a fit as complete old cvar lines (a static classic crosshair in the measured colour, no
 * outline, no recoil). Sizes are rounded to 4 decimals, far inside the width of the pixel bucket they came from. */
export function oldSettingsText(fit) {
  const { representative: r, flags, color } = fit, round = value => Number(value.toFixed(4));
  const values = { size: round(r.size), thickness: round(r.thickness), gap: round(r.gap), style: 4, dot: flags.dot, t_style: flags.t_style,
    outline: false, outline_width: 1, recoil: false, weapon_gap: false, alpha: 255, alpha_enabled: true, color: 5,
    r: color[0], g: color[1], b: color[2], fixed_gap: 3, split_distance: 3, inner_alpha: 0, outer_alpha: 1, split_ratio: 1 };
  return OLD_CVARS.map(([name, key]) => `${name} ${typeof values[key] === 'boolean' ? Number(values[key]) : values[key]}`).join('; ');
}

const NO_COMMANDS = 'No commands until the image checks pass.';
const CHECK_CHIP = { pass: ['converted', 'Pass'], warn: ['approximated', 'Check'], fail: ['dropped', 'Fail'], note: ['ignored', 'Note'] };
const pct = value => `${(100 * value).toFixed(1)}%`;
const span = ({ lower, upper }) => `${lower.toFixed(2)} to ${upper.toFixed(2)}`;

/** How far to trust a conversion, as plain checks and one level. `clipped`: the foreground reaches the original image edge.
 * `report` is null when the conversion failed. No check is a probability. */
export function assess(fit, report, clipped = false) {
  const q = fit.quality, stability = q.stability.minimumIou;
  const edge = Boolean(q.cropped || fit.mask.cropped || clipped);
  const maskOk = fit.templateIou >= RULE.mask, stableOk = stability >= RULE.stability;
  const imageOk = Boolean(q.acceptable) && !edge && maskOk && stableOk;
  const check = report?.shapeCheck ?? null, aligned = check?.alignedIou ?? 0;
  const shape = !report || report.blockers?.length || !check ? 'missing' : check.status === 'empty' ? 'empty'
    : check.status === 'exact' || check.status === 'shifted' ? check.status : aligned >= RULE.shape ? 'close' : 'poor';
  const level = !imageOk || ['missing', 'empty', 'poor'].includes(shape) ? 'low' : shape === 'close' ? 'medium' : 'high';
  const ties = q.tiedTemplates > 1 ? ` ${q.tiedTemplates} equally good templates were found; the first was used.` : '';
  const b = fit.buckets, percent = Math.floor(100 * aligned);
  const shapeText = { exact: 'Exact: the new crosshair draws the measured pixels.',
    shifted: 'Exact after a 1 px shift: odd-width bars sit half a pixel to the other side of the screen centre in the new game.',
    close: `${percent}% overlap after alignment.`, poor: `Only ${percent}% overlap after alignment.`,
    empty: 'The new crosshair would draw nothing visible.', missing: 'No shape check is available for this conversion.' }[shape];
  const imageText = `Mask agreement ${pct(fit.templateIou)} (needs ${pct(RULE.mask)}). ` +
    `Colour-threshold stability ${pct(stability)} (needs ${pct(RULE.stability)}). ` +
    (edge ? 'The crosshair reaches the image edge: use a complete, uncropped screenshot.' : 'Not cropped.');
  const ambiguity = 'Several old settings can draw these pixels: ' +
    `size ${span(b.size)}, thickness ${span(b.thickness)}, gap ${span(b.gap)} at the old height. ` +
    `The new values follow the pixels.${ties}`;
  const shapeStatus = shape === 'exact' || shape === 'shifted' ? 'pass' : shape === 'close' ? 'warn' : 'fail';
  return { level, rule: RULE_ROWS, imageOk, shape, checks: [
    { id: 'image', title: 'Image measurement', status: imageOk ? 'pass' : 'fail', text: imageText },
    { id: 'identifiability', title: 'Old settings', status: 'note', text: ambiguity },
    { id: 'shape', title: 'Shape check', status: shapeStatus, text: shapeText }] };
}

/** The inferred settings the worker converts: exactly what the converter reads from `oldSettingsText`. */
export const inferredSettings = fit => parseLegacyText(oldSettingsText(fit));

// ── The view: the converter's builders and classes (app/convert/view.js, app/convert.css) ─────────────────────────────
/** The one statement of what the result rests on, as on the Convert page. */
const LIMITS_LINE = 'Measured from the image and modelled from the old renderer; not yet checked against the current game ' +
  `(build ${COMMUNITY_MODEL.build}).`;
const { sectionHead, expertPanel } = expertParts('ss');
/** The sections with an Expert switch: centre, tolerance and colour under Screenshot; the inferred old settings under New settings. */
export const EXPERT_SECTIONS = Object.freeze(['input', 'settings']);
const status = id => el('p', { id, class: 'small', role: 'status' });
const field = (id, label, attrs) => el('div', { class: 'opt-field' }, el('label', { for: id }, label), el('input', { id, ...attrs }));

function screenshotBlock() {
  return el('section', { class: 'qs-screenshot', 'aria-labelledby': 'ss-input-title' },
    sectionHead('input', 'h2', 'Screenshot'),
    el('label', { id: 'ss-drop', class: 'drop-zone', for: 'ss-file' }, el('span', {}, 'Drop a PNG here or choose a file'),
      el('input', { id: 'ss-file', type: 'file', accept: 'image/png' })),
    el('p', { class: 'small' }, 'Full-screen and unscaled, crosshair at the centre, up to 16 MB.'),
    status('ss-status'),
    expertPanel('input',
      el('div', { class: 'opt-fields' }, field('ss-cx', 'Centre X', { type: 'number', min: 0, step: 1, value: 0 }),
        field('ss-cy', 'Centre Y', { type: 'number', min: 0, step: 1, value: 0 }),
        field('ss-tolerance', 'Tolerance', { type: 'number', min: 1, max: 120, step: 1, value: DEFAULT_TOLERANCE })),
      el('p', { id: 'ss-colour', class: 'small' }, 'Colour: automatic.'),
      el('p', { class: 'small' }, 'Click a crosshair pixel in the screenshot plate to pick its colour.'),
      el('div', { class: 'export-actions' }, el('button', { id: 'ss-auto', type: 'button', class: 'button secondary' }, 'Auto colour'),
        el('button', { id: 'ss-reanalyse', type: 'button', class: 'button secondary' }, 'Measure again'))));
}

function controls() {
  return el('form', { id: 'ss-inputs', class: 'qs-inputs qs-controls', 'aria-label': 'Screenshot',
    onsubmit: event => event.preventDefault() },
    screenshotBlock(),
    el('div', { class: 'qs-heights' },
      el('div', { class: 'heights' }, heightField('ss-old-height', 'Old height'), heightField('ss-new-height', 'New height')),
      el('p', { class: 'small' }, 'Vertical resolution in the old and in the new game; old starts at the image height.')));
}

function previewSection() {
  return el('section', { class: 'qs-reading qs-preview', 'aria-labelledby': 'ss-preview-title' },
    el('div', { class: 'section-head' }, el('h2', { id: 'ss-preview-title' }, 'Preview'), plateChoice('ss-plate')),
    el('div', { class: 'specimen simple-previews' },
      plate('ss-crop-canvas', 'Screenshot', 'Measured crop of the screenshot, measured pixels outlined'),
      plate('ss-new-canvas', 'New game', 'Converted crosshair simulation'),
      el('p', { id: 'ss-scale', class: 'plate-scale', 'aria-hidden': 'true' }),
      el('p', { id: 'ss-plate-note', class: 'plate-scale plate-note', hidden: true }, 'Generated scene, not a game image.')));
}

function settingsSection() {
  return el('section', { class: 'qs-reading qs-settings', 'aria-labelledby': 'ss-settings-title' },
    sectionHead('settings', 'h2', 'New settings'),
    status('ss-copy-status'),
    el('div', { class: 'hud' },
      el('dl', { class: 'readout simple-values' }, readout('ss-length', 'Length', 'cl_crosshair_length'),
        readout('ss-thickness', 'Thickness', 'cl_crosshair_thickness'), readout('ss-gap', 'Gap', 'cl_crosshair_gap')),
      el('div', { class: 'hud-actions' },
        el('button', { id: 'ss-copy', type: 'button', class: 'button primary', disabled: true }, 'Copy commands'),
        el('button', { id: 'ss-download', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'))),
    el('p', { id: 'ss-flags', class: 'flag-chips' }),
    el('div', { class: 'console-block' },
      el('div', { class: 'console-head' }, el('h3', { id: 'ss-commands-title' }, 'Console commands')),
      el('div', { id: 'ss-commands', class: 'command-list', tabindex: 0, role: 'region', 'aria-labelledby': 'ss-commands-title' })),
    expertPanel('settings', el('div', { class: 'expert-cell' }, el('h4', {}, 'Old settings read from the pixels'),
      el('pre', { id: 'ss-old-settings', class: 'formula' }))));
}

/** Confidence (level, the three checks, the rule, the converter link) beside the limits, laid out like What happened. */
function reportRow() {
  return el('section', { class: 'qs-what', 'aria-label': 'Confidence and limits' },
    el('div', { class: 'qs-report' },
      el('div', { class: 'qs-changes' },
        el('div', { class: 'section-head' }, el('h2', { id: 'ss-confidence-title' }, 'Confidence'),
          el('span', { id: 'ss-level', class: 'status-chip' })),
        el('p', { id: 'ss-level-text', class: 'small' }),
        el('dl', { id: 'ss-checks', class: 'check-list', 'aria-labelledby': 'ss-confidence-title' }),
        el('h3', { id: 'ss-rule-title' }, 'Rule'),
        el('table', { id: 'ss-rule', class: 'rule-table', 'aria-labelledby': 'ss-rule-title' }),
        el('p', { class: 'small' }, el('a', { id: 'ss-crosscheck', href: '#quant' }, 'Open in the converter'))),
      el('div', { class: 'qs-limits-col' },
        el('h2', { id: 'ss-warnings-title' }, 'Limits'),
        el('ul', { id: 'ss-warnings', class: 'warn-list', role: 'status', 'aria-labelledby': 'ss-warnings-title' }),
        el('p', { id: 'ss-limits', class: 'qs-limits' }, LIMITS_LINE))));
}

export function createScreenshotView(root) {
  root.replaceChildren(
    sheetHead({ title: 'Screenshot conversion',
      lede: 'Convert an old-game screenshot into new crosshair settings. The image stays in this tab.',
      fields: [['Model', COMMUNITY_MODEL.version], ['Build', COMMUNITY_MODEL.build],
        ['Checked in game', ['Not yet', docLink('math/06-statistical-inference.md', 'Why')], 'tb-flag']] }),
    el('div', { class: 'quant-simple' },
      el('div', { class: 'qs-workbench' }, controls(),
        el('div', { id: 'ss-results', class: 'qs-results', hidden: true },
          el('div', { class: 'qs-answer' }, previewSection(), settingsSection()), reportRow()))));
  root.dataset.plate = DEFAULT_PLATE; root.dataset.state = 'empty';
  const refs = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
  return { root, refs, get: id => refs[id] };
}

// ── Reading the image in the browser ──────────────────────────────────────────────────────────────────────────────
/** The browser's image access, replaceable in tests: load a PNG, crop the 129 px square around a centre, paint it magnified. */
export const browserImages = {
  async load(file) {
    if (!file || file.size > MAX_BYTES) throw new Error('Use a PNG no larger than 16 MB.');
    if (!crypto.subtle) throw new Error('Screenshot hashing requires HTTPS or a secure localhost origin.');
    const bytes = new Uint8Array(await file.arrayBuffer()), dimensions = pngDimensions(bytes);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) {
      bitmap.close(); throw new Error('Decoded image dimensions disagree with the PNG header.');
    }
    return { dimensions, sha256, name: file.name, close: () => bitmap.close(), crop([x, y]) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIDE;
      const context = canvas.getContext('2d', { willReadFrequently: true }), half = (SIDE - 1) / 2;
      context.drawImage(bitmap, x - half, y - half, SIDE, SIDE, 0, 0, SIDE, SIDE);
      return context.getImageData(0, 0, SIDE, SIDE).data;
    } };
  },
  /** Draws the crop magnified, one source pixel per `cell` CSS pixels, with the mask's outline. Returns the layout for picking. */
  paint(canvas, rgba, mask, cell) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), css = getComputedStyle(canvas);
    const width = Math.max(80, rect.width), height = Math.max(100, rect.height || 150);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const n = Math.max(1, Math.min(SIDE, 2 * Math.floor((Math.min(width, height) / cell - 1) / 2) + 1)), x0 = (SIDE - n) / 2;
    const offX = Math.floor((width - n * cell) / 2), offY = Math.floor((height - n * cell) / 2);
    const context = canvas.getContext('2d'), source = document.createElement('canvas');
    source.width = source.height = SIDE; source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), SIDE, SIDE), 0, 0);
    context.scale(dpr, dpr); context.imageSmoothingEnabled = false;
    context.fillStyle = css.getPropertyValue('--plate').trim() || '#656b74'; context.fillRect(0, 0, width, height);
    context.drawImage(source, x0, x0, n, n, offX, offY, n * cell, n * cell);
    context.fillStyle = css.getPropertyValue('--plate-annot').trim() || '#f08a24';
    const on = (x, y) => x >= 0 && y >= 0 && x < SIDE && y < SIDE && mask.data[y * SIDE + x] === 1;
    for (let y = x0; y < x0 + n; y++) for (let x = x0; x < x0 + n; x++) {
      if (!on(x, y)) continue;
      const px = offX + (x - x0) * cell, py = offY + (y - x0) * cell;
      if (!on(x, y - 1)) context.fillRect(px, py, cell, 1);
      if (!on(x, y + 1)) context.fillRect(px, py + cell - 1, cell, 1);
      if (!on(x - 1, y)) context.fillRect(px, py, 1, cell);
      if (!on(x + 1, y)) context.fillRect(px + cell - 1, py, 1, cell);
    }
    return { x0, n, cell, offX, offY };
  },
};

// ── The page ──────────────────────────────────────────────────────────────────────────────────────────────────────
export class ScreenshotPage {
  constructor(view, worker, images = browserImages) {
    // `measure` and `converting` number the newest image analysis and conversion; an older reply is dropped.
    Object.assign(this, { view, worker, images, image: null, seed: null, fit: null, rgba: null, clipped: false, report: null,
      problem: '', assessment: null, used: null, layout: null, measure: 0, converting: 0, expert: new Set(),
      listeners: new AbortController() });
  }
  get(id) { return this.view.get(id); }
  on(id, event, handler) { this.get(id).addEventListener(event, handler, { signal: this.listeners.signal }); }
  say(text) { this.get('ss-status').textContent = text; }

  start() {
    this.on('ss-file', 'change', () => this.open(this.get('ss-file').files?.[0]));
    const drop = this.get('ss-drop');
    this.on('ss-drop', 'dragover', event => { event.preventDefault(); drop.dataset.over = 'true'; });
    this.on('ss-drop', 'dragleave', () => { delete drop.dataset.over; });
    this.on('ss-drop', 'drop', event => {
      event.preventDefault(); delete drop.dataset.over;
      this.open(event.dataTransfer?.files?.[0]);
    });
    // The old height measures again; the new height only converts again.
    this.bindHeight('ss-old-height', () => this.analyse());
    this.bindHeight('ss-new-height', () => this.convert());
    this.on('ss-plate', 'change', () => this.setPlate(this.get('ss-plate').value));
    for (const key of EXPERT_SECTIONS) this.on(`ss-expert-${key}`, 'click', () => this.setExpert(key, !this.expert.has(key)));
    this.on('ss-reanalyse', 'click', () => this.analyse());
    this.on('ss-auto', 'click', () => { this.seed = null; this.analyse(); });
    this.on('ss-crop-canvas', 'click', event => this.pick(event));
    this.on('ss-copy', 'click', () => this.report && copy(this.commands(), this.get('ss-copy-status')));
    this.on('ss-download', 'click', () => this.report && download('small-indie-crosshair.cfg', this.commands() + '\n', 'text/plain'));
    return this;
  }

  /** A height as on the Convert page: the presets, and the number for Custom…. The focused number stays visible after Enter;
   * it is hidden on blur if it equals a preset. */
  bindHeight(id, run) {
    this.on(`${id}-preset`, 'change', () => {
      const select = this.get(`${id}-preset`), number = this.get(id);
      number.hidden = select.value !== 'custom';
      if (select.value === 'custom') return number.focus?.();
      number.value = select.value; return run();
    });
    this.on(id, 'change', () => { syncHeight(this.view.get, id, globalThis.document?.activeElement === this.get(id)); return run(); });
    this.on(id, 'blur', () => syncHeight(this.view.get, id));
  }
  /** Shows or hides one section's expert panel. Not remembered (ADR-0004); the options always apply either way. */
  setExpert(key, on) {
    if (on) this.expert.add(key); else this.expert.delete(key);
    this.get(`ss-expert-${key}-panel`).hidden = !on; this.get(`ss-expert-${key}`).setAttribute('aria-expanded', String(on));
  }
  /** Marks the Screenshot switch while its hidden options are off their default: a moved centre, another tolerance, a picked colour. */
  markExpert() {
    const { width, height } = this.image?.dimensions ?? {}, value = id => this.get(id).valueAsNumber;
    const on = Boolean(this.image) && (value('ss-cx') !== Math.floor(width / 2) || value('ss-cy') !== Math.floor(height / 2) ||
      value('ss-tolerance') !== DEFAULT_TOLERANCE || this.seed !== null);
    const switchNode = this.get('ss-expert-input');
    if (on) { switchNode.dataset.modified = 'true'; switchNode.setAttribute('aria-describedby', 'ss-expert-input-modified'); }
    else { delete switchNode.dataset.modified; switchNode.removeAttribute('aria-describedby'); }
  }
  setPlate(name) {
    if (!PLATES.some(([plate]) => plate === name)) return;
    const scene = SCENE_PLATES.some(([plate]) => plate === name), { dataset } = this.view.root;
    dataset.plate = name; this.get('ss-plate').value = name;
    if (scene) dataset.plateKind = 'scene'; else delete dataset.plateKind;
    this.get('ss-plate-note').hidden = !scene; this.refresh();
  }

  /** Reads and checks the two heights. */
  heights() {
    const old = this.get('ss-old-height').valueAsNumber, next = this.get('ss-new-height').valueAsNumber;
    for (const [name, value] of [['Old', old], ['New', next]])
      if (!Number.isInteger(value) || value < MIN_HEIGHT || value > MAX_HEIGHT)
        throw new Error(`${name} height must be a whole number from ${MIN_HEIGHT} to ${MAX_HEIGHT}.`);
    return { oldHeight: old, newHeight: next };
  }
  selection() {
    const x = this.get('ss-cx').valueAsNumber, y = this.get('ss-cy').valueAsNumber, t = this.get('ss-tolerance').valueAsNumber;
    const { width, height } = this.image.dimensions;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height)
      throw new Error('The centre must be a pixel inside the image.');
    if (!Number.isFinite(t) || t < 1 || t > 120) throw new Error('Colour tolerance must be between 1 and 120.');
    return { center: [x, y], tolerance: t };
  }

  /** A new file: replaces the image, resets the old height and the centre to the image, and measures it. */
  async open(file) {
    const ticket = ++this.measure;
    try {
      this.say('Reading the image…');
      const image = await this.images.load(file);
      if (ticket !== this.measure) return image.close?.();
      this.image?.close?.(); this.image = image; this.seed = null;
      const { width, height } = image.dimensions;
      this.get('ss-old-height').value = String(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)));
      syncHeight(this.view.get, 'ss-old-height');
      this.get('ss-cx').value = String(Math.floor(width / 2)); this.get('ss-cy').value = String(Math.floor(height / 2));
      this.get('ss-colour').textContent = 'Colour: automatic.';
      await this.analyse();
    } catch (error) { if (ticket === this.measure) this.fail(error); }
    finally { if (this.get('ss-file')) this.get('ss-file').value = ''; }
  }

  fail(error) {
    this.fit = null; this.report = null; this.layout = null;
    this.get('ss-results').hidden = true; this.view.root.dataset.state = 'error'; this.say(error.message);
  }

  /** Measures the crop (worker `screenshot`), then converts it. */
  async analyse() {
    if (!this.image) return;
    const ticket = ++this.measure;
    try {
      const { oldHeight } = this.heights(), { center, tolerance } = this.selection();
      this.markExpert();
      this.say('Measuring the crosshair…'); this.view.root.dataset.state = 'measuring';
      const rgba = this.image.crop(center);
      const fit = await this.worker.call('screenshot', { data: rgba, side: SIDE, seed: this.seed ? [...this.seed] : null, tolerance,
        height: oldHeight });
      if (ticket !== this.measure) return;
      const clipped = sourceBoundaryClipped(fit.mask, this.image.dimensions, center);
      this.fit = fit; this.rgba = rgba; this.clipped = clipped; this.report = null;
      this.get('ss-colour').textContent = `Colour: ${this.seed ? 'picked' : 'automatic'}, rgb(${fit.color.join(', ')}).`;
      await this.convert();
    } catch (error) { if (ticket === this.measure) this.fail(error); }
  }

  /** The worker `infer` with the inferred old settings and the fit's pixels as the target, at the converter's defaults. */
  async convert() {
    const fit = this.fit, ticket = ++this.converting;
    if (!fit) return;
    this.get('ss-results').hidden = false; this.view.root.dataset.state = 'ready';
    let report = null, problem = '', used = null;
    try {
      used = this.heights();
      report = await this.worker.call('infer', { settings: inferredSettings(fit), options: defaultOptions(used.oldHeight, used.newHeight),
        measurements: [], targetOverride: fit.geometry, targetMask: fit.mask, selectedModelId: resolveModelChoice({ request: '' }),
        decision: 'expected', certify: false });
    } catch (error) { if (error.name === 'AbortError') return; problem = error.message; }
    if (ticket !== this.converting || fit !== this.fit) return;
    Object.assign(this, { report, problem, used });
    this.render();
  }

  /** Commands of the current report: the converter's default groups for an input that set every old cvar. */
  commands() {
    const r = this.report, include = defaultExportGroups([...LEGACY_SETTING_KEYS], r.settings, mergedExportOverrides(r));
    return exportQuantCFG(r, include);
  }
  /** Commands are offered only when the image checks passed and the export is not blocked. */
  offered() { return Boolean(this.report && !this.report.blockers.length && this.assessment.imageOk); }

  render() {
    const { fit, report, view } = this, { get } = view;
    const text = oldSettingsText(fit);
    this.assessment = assess(fit, report, this.clipped);
    const a = this.assessment, offered = this.offered(), n = report?.chosen.native;
    this.say(this.problem || (report ? '' : 'The conversion did not run.'));
    for (const [id, key] of [['ss-length', 'length'], ['ss-thickness', 'thickness'], ['ss-gap', 'gap']])
      get(id).textContent = n ? fmt(n[key]) : '-';
    get('ss-copy').disabled = get('ss-download').disabled = !offered; get('ss-copy-status').textContent = '';
    get('ss-old-settings').textContent = text.split('; ').join('\n');
    get('ss-crosscheck').setAttribute('href', converterLink(text, this.used?.oldHeight, this.used?.newHeight));
    if (report) {
      const look = exportedLook(report);
      // Chips as on the Convert page; visually hidden separators keep the text content one line ("a · b") when copied.
      const flags = [look.settings.t_style ? 'T' : 'cross', ['no outline', 'full outline', 'half outline'][look.outlineMode]];
      get('ss-flags').replaceChildren(...flags.flatMap((flag, index) => [
        ...(index ? [el('span', { class: 'flag-sep', 'aria-hidden': 'true' }, ' · ')] : []), el('span', { class: 'flag' }, flag)]));
      get('ss-commands').replaceChildren(...(offered ? this.commands().split(';').filter(Boolean).map(line => {
        const [name, ...value] = line.split(' ');
        return el('div', { class: 'cmd' }, el('span', { class: 'cvar-name' }, name), ' ',
          el('span', { class: 'cvar-value' }, value.join(' ')));
      }) : [el('p', { class: 'small' }, report.blockers[0] ?? NO_COMMANDS)]));
    } else {
      get('ss-flags').replaceChildren(); get('ss-commands').replaceChildren(el('p', { class: 'small' }, 'No commands.'));
    }
    get('ss-level').textContent = a.level[0].toUpperCase() + a.level.slice(1);
    get('ss-level').dataset.status = { high: 'converted', medium: 'approximated', low: 'dropped' }[a.level];
    get('ss-level-text').textContent = { high: 'The image reads cleanly and the new settings draw the same pixels.',
      medium: 'The image reads cleanly; the new settings draw a close match.',
      low: 'Check in the converter and in game before using these values.' }[a.level];
    get('ss-checks').replaceChildren(...a.checks.map(c => el('div', { 'data-status': c.status },
      el('dt', {}, el('span', { class: 'status-chip', 'data-status': CHECK_CHIP[c.status][0] }, CHECK_CHIP[c.status][1]), ' ', c.title),
      el('dd', {}, c.text))));
    get('ss-rule').replaceChildren(el('tbody', {}, ...a.rule.map(([level, text]) =>
      el('tr', {}, el('th', { scope: 'row' }, level), el('td', {}, text)))));
    // The image edge is already in the image check, so it is not repeated here.
    const notes = [...(report ? shownWarnings(report) : []), ...(a.imageOk ? [] : fit.warnings.slice(-1))];
    const shown = notes.length ? notes : ['No other limits for this screenshot.'];
    get('ss-warnings').replaceChildren(...shown.map(w => warningItem(w)));
    this.refresh();
  }

  /** Repaints both plates (a resize, a background change, a new result). */
  refresh() {
    const { fit, report } = this;
    if (!fit || !report || !this.assessment) return;
    const { get } = this.view, look = exportedLook(report), s = report.settings;
    const outline = nativeOutlineExtent(look.settings, look.outlineMode);
    const canvas = get('ss-new-canvas');
    const zoom = fitZoom(canvas, [fit.mask, report.converted], [s, look.settings], [null, outline]);
    paintQuant(canvas, report.converted, look.settings, look.color, zoom, null, { grid: zoom >= 6, annotate: true, outline });
    this.layout = this.images.paint(get('ss-crop-canvas'), this.rgba, fit.mask, zoom);
    get('ss-scale').textContent = `×${zoom}, 1 cell = 1 game pixel, outline = measured pixels, ring = screen centre.`;
  }

  /** Picks the crosshair colour from the crop under a click, then measures again. */
  pick(event) {
    const { rgba, layout } = this;
    if (!rgba || !layout) return;
    const rect = this.get('ss-crop-canvas').getBoundingClientRect();
    const x = layout.x0 + Math.floor((event.clientX - rect.left - layout.offX) / layout.cell);
    const y = layout.x0 + Math.floor((event.clientY - rect.top - layout.offY) / layout.cell);
    if (x < layout.x0 || y < layout.x0 || x >= layout.x0 + layout.n || y >= layout.x0 + layout.n) return;
    const i = (y * SIDE + x) * 4; this.seed = [...rgba.slice(i, i + 3)]; this.analyse();
  }

  close() { this.measure++; this.converting++; this.listeners.abort(); this.image?.close?.(); this.worker?.close(); }
}

/** The page: its own worker (no solver on the main thread), created when the first image arrives. */
export async function initScreenshot() {
  const root = document.getElementById('screenshot'), view = createScreenshotView(root);
  let worker = null;
  const lazy = { call: async (type, payload) => {
    if (!worker) { const [records] = await loadQuantCorpus(); worker = new ResearchWorker(records); await worker.ready; }
    return worker.call(type, payload);
  }, close: () => worker?.close() };
  const page = new ScreenshotPage(view, lazy).start();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => requestAnimationFrame(() => page.refresh())).observe(root);
  return page;
}
