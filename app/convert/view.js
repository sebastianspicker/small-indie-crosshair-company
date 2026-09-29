import { el, docLink, sheetHead, SNAPSHOT } from '../ui/dom.js';
import { EXPERT_MODELS } from '../../lib/solver/renderer.js';
import { HEDGE_MODEL } from '../../lib/solver/selection.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';

export const labels = { authored: 'Authored height', reference1080: '1080 reference', reference720: '720 reference',
  thickness: 'Thickness-relative', center: 'Center-relative', opening: 'Full opening' };
export const modelName = m => m.name ?? `${labels[m.scale]} · ${m.rounding} · ${labels[m.gap]}`;
const detail = (id, title, ...children) => el('details', { id }, el('summary', {}, title), ...children);
const field = (id, label, type, attrs = {}) => el('div', {}, el('label', { for: id }, label), el('input', { id, type, ...attrs }));
const check = (id, label) => el('label', { class: 'check' }, el('input', { id, type: 'checkbox' }), label);
const option = (value, name) => el('option', { value }, name);
const status = id => el('p', { id, class: 'small', role: 'status' });
const simpleField = (id, label, attrs) => el('div', {}, el('label', { for: id }, label), el('input', { id, ...attrs }));
const step = (index, title, ...children) => el('fieldset', { class: 'qs-step' },
  el('legend', {}, el('span', { class: 'step-no' }, index), title), ...children);
const readout = (id, label, cvar) => el('div', { class: 'readout-item' },
  el('dt', {}, label), el('dd', { id, class: 'simple-value' }, '—'), el('dd', { class: 'readout-cvar' }, cvar));
const plate = (id, title, index, label) => el('figure', { class: 'quant-preview plate' },
  el('figcaption', {}, el('span', {}, title), el('span', { class: 'preview-index' }, index)),
  el('canvas', { id, role: 'img', 'aria-label': label }));

function simplePanel() {
  return el('form', { id: 'quant-simple', class: 'quant-simple', 'aria-label': 'Simple crosshair conversion',
    onsubmit: event => event.preventDefault() },
    step('A', 'Paste the old crosshair',
      el('label', { for: 'qs-import' }, 'Share code or console lines'),
      el('textarea', { id: 'qs-import', rows: 3, maxlength: 32768, spellcheck: false, autocomplete: 'off',
        placeholder: 'e.g. CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\nor   cl_crosshairsize 2; cl_crosshairgap -3', 'aria-describedby': 'qs-input-status' }),
      el('div', { class: 'qs-load-row' }, el('button', { id: 'qs-load', type: 'button', class: 'button secondary' }, 'Load crosshair'),
        status('qs-input-status'))),
    el('section', { class: 'qs-reading simple-output', 'aria-labelledby': 'qs-reading-title' },
      el('div', { class: 'reading-head' }, el('h2', { id: 'qs-reading-title' }, 'New settings'),
        el('span', { class: 'tag signal' }, 'Modelled, not captured')),
      status('qs-status'), el('p', { id: 'qs-live', class: 'sr-only', role: 'status' }),
      el('div', { class: 'specimen simple-previews' },
        plate('qs-old-canvas', 'Old', 'before', 'Historical reconstructed crosshair'),
        plate('qs-new-canvas', 'New', 'after', 'Proposed crosshair candidate simulation'),
        el('p', { id: 'qs-scale', class: 'plate-scale', 'aria-hidden': 'true' })),
      el('dl', { class: 'readout simple-values' }, readout('qs-length', 'Length', 'cl_crosshair_length'),
        readout('qs-out-thickness', 'Thickness', 'cl_crosshair_thickness'), readout('qs-out-gap', 'Gap', 'cl_crosshair_gap')),
      el('p', { id: 'qs-flags', class: 'simple-flags' }),
      el('div', { class: 'export-actions simple-actions' },
        el('button', { id: 'qs-copy', type: 'button', class: 'button primary', disabled: true }, 'Copy commands'),
        el('button', { id: 'qs-download', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'),
        el('button', { id: 'qs-advanced', type: 'button', class: 'button ghost' }, 'Open the expert lab →')),
      el('div', { class: 'console-block' },
        el('div', { class: 'console-head' }, el('h3', { id: 'qs-commands-title' }, 'Console lines'),
          el('span', { class: 'small' }, 'Paste or type them in order')),
        el('pre', { id: 'qs-commands', class: 'command-list', tabindex: 0, 'aria-labelledby': 'qs-commands-title' })),
      el('p', { id: 'qs-note', class: 'qs-note' })),
    step('B', 'Old values',
      el('div', { class: 'input-grid triple' },
        simpleField('qs-size', 'Size', { type: 'number', min: 0, max: 10000, step: 'any', inputmode: 'decimal' }),
        simpleField('qs-thickness', 'Thickness', { type: 'number', min: 0, max: 10000, step: 'any', inputmode: 'decimal' }),
        simpleField('qs-gap', 'Gap', { type: 'number', min: -128, max: 128, step: 'any', inputmode: 'decimal' })),
      el('div', { class: 'simple-checks' }, el('label', { class: 'check', for: 'qs-dot' }, el('input', { id: 'qs-dot', type: 'checkbox' }), 'Center dot'),
        el('label', { class: 'check', for: 'qs-t' }, el('input', { id: 'qs-t', type: 'checkbox' }), 'T shape'))),
    step('C', 'Game resolution',
      el('div', { class: 'input-grid' }, simpleField('qs-old-height', 'Old height · px', { type: 'number', min: 240, max: 16384, value: 1080 }),
        simpleField('qs-new-height', 'New height · px', { type: 'number', min: 240, max: 16384, value: 1080 })),
      el('label', { for: 'qs-goal' }, 'When the heights differ, keep'),
      el('select', { id: 'qs-goal' }, option('pixels', 'the same size in game pixels'), option('screen', 'the same share of the screen'))),
    step('D', 'Color',
      el('div', { class: 'input-grid' }, simpleField('qs-color', 'Color', { type: 'color', value: '#00ff00' }),
        simpleField('qs-alpha', 'Opacity · 0–255', { type: 'number', min: 0, max: 255, step: 1, value: 255 }))));
}

function sourcePanel(meta) {
  return el('aside', { class: 'quant-input', 'aria-label': 'Legacy crosshair inputs' },
    el('h2', {}, 'Old crosshair'),
    el('label', { for: 'q-import' }, 'Share code or console values'),
    el('textarea', { id: 'q-import', rows: 2, maxlength: 32768, spellcheck: false,
      placeholder: 'CSGO-… or cl_crosshairsize 2', 'aria-describedby': 'q-input-status' }),
    el('button', { id: 'q-load', class: 'button secondary' }, 'Load crosshair'), status('q-input-status'),
    detail('q-presets-panel', `Published player settings · ${meta.players} players`,
      el('input', { id: 'q-preset-search', type: 'search', placeholder: 'Find a player', 'aria-label': 'Search pro presets', maxlength: 128 }),
      el('select', { id: 'q-preset', 'aria-label': 'Pro crosshair snapshot' }), el('p', { id: 'q-provenance', class: 'small' })),
    el('div', { class: 'input-grid triple' },
      field('q-size', 'Size', 'number', { min: 0, max: 10000, step: 'any' }),
      field('q-thickness', 'Thickness', 'number', { min: 0, max: 10000, step: 'any' }),
      field('q-gap', 'Gap', 'number', { min: -128, max: 128, step: 'any' })),
    el('div', { class: 'quant-checks' }, check('q-dot', 'Center dot'), check('q-t', 'T shape')),
    el('div', { class: 'input-grid' }, field('q-old-height', 'Old height · px', 'number', { min: 240, max: 16384, value: 1080 }),
      field('q-new-height', 'New height · px', 'number', { min: 240, max: 16384, value: 1080 })),
    el('p', { class: 'small input-hint' }, 'Enter the height used in game for each version.'),
    detail('q-image-panel', 'Use an old screenshot', field('q-old-image', 'Original PNG · up to 16 MB', 'file', { accept: 'image/png' }),
      el('p', { class: 'small' }, 'Enter the old game height above. The image stays in this tab.')),
    appearanceControls(),
    el('p', { class: 'source-footnote' }, `${meta.uniqueCodes} distinct codes in the archive. ${meta.nativeCapturePairs} original old/new capture pairs.`,
      el('a', { href: '#corpus' }, ' Browse the records')));
}

function appearanceControls() {
  return detail('q-options-panel', 'Appearance and matching',
    el('label', { for: 'q-goal' }, 'Keep the same'), el('select', { id: 'q-goal' },
      option('pixels', 'Crosshair size in game pixels'), option('screen', 'Proportion of the screen')),
    el('div', { class: 'input-grid' }, field('q-color', 'Color', 'color', { value: '#00ff00' }), field('q-alpha', 'Opacity', 'number', { min: 0, max: 255, value: 255 })),
    el('label', { for: 'q-decision' }, 'When models disagree'), el('select', { id: 'q-decision' },
      option('expected', 'Lowest weighted mismatch'), option('worst', 'Limit the largest mismatch'),
      option('cvar', 'Limit weighted worst tail (CVaR)')),
    el('p', { class: 'small' }, 'Historical models only. The community default preserves dimensions, then fits the centre radius.'));
}

function valueTable() {
  return el('div', { class: 'value-table-wrap' }, el('table', { id: 'q-values-table', class: 'value-table', 'aria-label': 'Conversion values' },
    el('thead', {}, el('tr', {}, ...['Setting', 'Old value', 'Copied value', 'Proposed value'].map(label => el('th', { scope: 'col' }, label)))),
    el('tbody', {}, ...[['length', 'Length', 'cl_crosshair_length'], ['thickness', 'Thickness', 'cl_crosshair_thickness'], ['gap', 'Gap', 'cl_crosshair_gap']].map(([key, title, cvar]) =>
      el('tr', {}, el('th', { scope: 'row' }, title, el('code', {}, cvar)),
        ...['legacy', 'direct', 'new'].map(kind => el('td', { id: `q-value-${key}-${kind}`, class: kind === 'new' ? 'converted-value' : '' }, '—')))))));
}

function previewPanel() {
  return el('div', { class: 'preview-panel' },
    el('div', { class: 'quant-toolbar' }, el('h2', {}, 'Visual comparison'),
      el('div', { class: 'toolbar-group' }, check('q-grid', 'Grid'), check('q-difference', 'Difference'),
        el('select', { id: 'q-zoom', 'aria-label': 'Preview magnification' }, ...[1, 2, 4, 6, 10, 16].map(z => el('option', { value: z, ...(z === 6 ? { selected: 'selected' } : {}) }, `${z}×`))))),
    el('div', { class: 'quant-previews' }, ...['old', 'naive', 'converted'].map((id, i) =>
      el('figure', { class: 'quant-preview' }, el('figcaption', {}, el('span', {}, ['Old target', 'Copied values', 'Proposed values'][i]), el('span', { class: 'preview-index' }, `0${i + 1}`)),
        el('canvas', { id: `q-${id}-canvas`, role: 'img', 'aria-label': ['Historical reconstructed or measured crosshair', 'New values without numeric conversion', 'Converted values under selected model'][i] }),
        el('p', { id: `q-${id}-values`, class: 'quant-values' }), el('p', { id: `q-${id}-note`, class: 'small' })))),
    el('p', { id: 'q-renderer-note', class: 'small' }),
    el('div', { id: 'q-confidence', class: 'quant-metrics' }));
}

function feedbackPanel() {
  return detail('q-feedback', 'Compare with a game screenshot',
    el('p', { class: 'small' }, 'Add an original CS2 capture to test the proposed rendering. Keep captures used to tune a model separate from captures used to check it.'),
    el('div', { class: 'input-grid' }, field('q-new-image', 'Native PNG with the current output', 'file', { accept: 'image/png' }),
      field('q-measurements', 'Scoped measurement JSON', 'file', { accept: '.json,application/json' })),
    el('div', { class: 'export-actions' }, el('button', { id: 'q-export-measurements', class: 'button secondary' }, 'Export evidence'),
      el('button', { id: 'q-clear-measurements', class: 'button ghost' }, 'Reset session evidence')),
    status('q-evidence-status'), el('h3', {}, 'A useful next screenshot'),
    el('p', { class: 'small' }, 'These settings make our models disagree most in the preview. A real capture could help tell them apart.'),
    el('pre', { id: 'q-experiment', class: 'formula' }),
    el('h3', {}, 'Discriminating capture set'),
    el('p', { class: 'small' }, 'Loaded when this panel is first opened. Each design separates declared model predictions; the whole set is a capture plan, not a measurement.'),
    el('pre', { id: 'q-discriminating', class: 'formula' }));
}

function resultsPanel() {
  return el('div', { class: 'quant-output' },
    el('div', { class: 'result-heading' }, el('h2', {}, 'New settings'),
      el('div', { class: 'export-actions' }, el('button', { id: 'q-copy', class: 'button secondary', disabled: true }, 'Copy commands'),
        el('button', { id: 'q-download-cfg', class: 'button primary', disabled: true }, 'Download .cfg'))),
    el('div', { class: 'quant-model-select' }, el('label', { for: 'q-model' }, 'Rendering model'),
      el('select', { id: 'q-model' }, option('', 'Automatic · community static reconstruction'),
        option(HEDGE_MODEL, 'Historical · weighted model hedge'), ...EXPERT_MODELS.map(m => option(m.id, modelName(m))))),
    el('p', { class: 'small' }, 'Six choices: the community default, a historical hedge, and four authored-height alternatives. ',
      docLink('research/converter-audit-2026-09-29.md', 'Sources and comparison')),
    valueTable(), el('p', { id: 'q-target-line', class: 'target-line' }),
    detail('q-derivation-panel', 'Pixel measurements and differences', el('div', { id: 'q-derivation' }),
      docLink('math/12-community-conversion.md', 'How the current values are calculated')),
    status('q-status'), el('div', { id: 'q-warnings', class: 'warnings', role: 'alert' }), previewPanel(),
    detail('q-scenarios', 'Compare selected models', el('div', { id: 'q-model-table' })),
    detail('q-trace-panel', 'Search details and uncertainty',
      el('label', { class: 'check' }, el('input', { id: 'q-certify', type: 'checkbox' }), 'Certify global optimum (slower)'),
      el('p', { id: 'q-certify-note', class: 'small' }),
      el('div', { id: 'q-trace' }),
      el('button', { id: 'q-download-report', class: 'button secondary', disabled: true }, 'Download research JSON')),
    detail('q-commands-panel', 'Console commands', el('textarea', { id: 'q-cfg', rows: 8, readonly: 'readonly', spellcheck: false, 'aria-label': 'New cvar commands' })),
    feedbackPanel());
}

export function createView(root, meta) {
  root.replaceChildren(
    sheetHead({ sheet: '01', label: 'Convert', title: 'Crosshair conversion',
      lede: 'Paste an old share code or console lines. You get the new length, thickness and gap, drawn next to the old crosshair pixel for pixel.',
      fields: [['Default build', COMMUNITY_MODEL.build], ['Model', COMMUNITY_MODEL.version], ['Corpus snapshot', SNAPSHOT.date],
        ['Checked in game', ['Not yet', docLink('math/06-statistical-inference.md', 'Why')], 'tb-flag']] }),
    simplePanel(),
    el('div', { class: 'quant-layout' }, sourcePanel(meta), resultsPanel()));
  const refs = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
  return { root, refs, get: id => refs[id] };
}
