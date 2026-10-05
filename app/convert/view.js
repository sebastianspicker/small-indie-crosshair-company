import { el, docLink, sheetHead, SNAPSHOT } from '../ui/dom.js';
import { EXPERT_MODELS } from '../../lib/solver/renderer.js';
import { HEDGE_MODEL } from '../../lib/solver/selection.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { CURRENT_INVENTORY_BUILD, CURRENT_INVENTORY_RETRIEVED } from '../../lib/settings/cvars.js';
import { samplesStrip } from './samples.js';

const LIMITS_LINE = 'Modelled from the old renderer source and community measurements; not yet checked against in-game captures. ' +
  'Compare in game before relying on it.';
const BUILD_LINE = `Checked against CS2 build ${CURRENT_INVENTORY_BUILD} (convar dump, ${CURRENT_INVENTORY_RETRIEVED}).`;
const PASTE_HINT = 'Share code, console lines, cs2_user_convars.vcfg or "find crosshair" output.\n' +
  'e.g. CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX or cl_crosshairsize 2; cl_crosshairgap -3';

export const labels = { authored: 'Authored height', reference1080: '1080 reference', reference720: '720 reference',
  thickness: 'Thickness-relative', center: 'Center-relative', opening: 'Full opening' };
export const modelName = m => m.name ?? `${labels[m.scale]}, ${m.rounding}, ${labels[m.gap]}`;
const detail = (id, title, ...children) => el('details', { id }, el('summary', {}, title), ...children);
const field = (id, label, type, attrs = {}) => el('div', {}, el('label', { for: id }, label), el('input', { id, type, ...attrs }));
const check = (id, label, attrs = {}) => el('label', { class: 'check', for: id }, el('input', { id, type: 'checkbox', ...attrs }), label);
const option = (value, name) => el('option', { value }, name);
const OUTLINE_OPTIONS = [['auto', 'Auto from old settings'], ['0', 'None'], ['1', 'Full'], ['2', 'Half']];
const STYLE_OPTIONS = [['static', 'Static Cross'], ['family', 'Keep old style family (experimental)']];
const status = id => el('p', { id, class: 'small', role: 'status' });
const decimal = { type: 'number', step: 'any', inputmode: 'decimal' };
const readout = (id, label, cvar, chip) => el('div', { class: 'readout-item' },
  el('dt', {}, label), el('dd', { id, class: 'simple-value' }, '-'),
  el('dd', { class: 'readout-cvar' }, cvar), el('dd', { id: chip, class: 'confidence-chip' }));
const plate = (id, title, label) => el('figure', { class: 'quant-preview plate' },
  el('figcaption', {}, el('span', {}, title)), el('canvas', { id, role: 'img', 'aria-label': label }));

/** Row 1: one paste box, the heights, and the direct values under a disclosure. */
function inputs() {
  return el('form', { id: 'qs-inputs', class: 'qs-inputs', 'aria-label': 'Old crosshair', onsubmit: event => event.preventDefault() },
    el('div', { class: 'qs-paste' },
      el('label', { for: 'qs-import' }, 'Old crosshair'),
      el('textarea', { id: 'qs-import', rows: 4, maxlength: 32768, spellcheck: false, autocomplete: 'off',
        placeholder: PASTE_HINT, 'aria-describedby': 'qs-input-status qs-paste-note' }),
      el('div', { class: 'qs-load-row' }, el('button', { id: 'qs-load', type: 'button', class: 'button secondary' }, 'Load crosshair'),
        el('button', { id: 'qs-clear', type: 'button', class: 'button secondary' }, 'Clear'),
        el('p', { id: 'qs-paste-note', class: 'small' }, 'Binds and other lines are skipped.')),
      status('qs-input-status')),
    el('div', { class: 'qs-side' },
      el('div', { class: 'input-grid' },
        field('qs-old-height', 'Old height (px)', 'number', { min: 240, max: 16384, value: 1080 }),
        field('qs-new-height', 'New height (px)', 'number', { min: 240, max: 16384, value: 1080 })),
      el('p', { class: 'small' }, 'The vertical resolution you play at in each version.'),
      detail('qs-values', 'Edit values',
        el('div', { class: 'input-grid triple' },
          field('qs-size', 'Size', 'number', { min: 0, max: 10000, ...decimal }),
          field('qs-thickness', 'Thickness', 'number', { min: 0, max: 10000, ...decimal }),
          field('qs-gap', 'Gap', 'number', { min: -128, max: 128, ...decimal })),
        el('div', { class: 'simple-checks' }, check('qs-dot', 'Center dot'), check('qs-t', 'T shape')),
        el('div', { class: 'input-grid' }, field('qs-color', 'Color', 'color', { value: '#00ff00' }),
          field('qs-alpha', 'Opacity (0 to 255)', 'number', { min: 0, max: 255, step: 1, value: 255 })))));
}

/** Row 2: the old and new plates, the readouts, the actions and the commands. */
function plateRow() {
  return el('section', { class: 'qs-reading', 'aria-labelledby': 'qs-reading-title' },
    el('div', { class: 'section-head' }, el('h2', { id: 'qs-reading-title' }, 'New settings'),
      el('span', { class: 'status-chip', 'data-status': 'assumed' }, 'Modelled, not captured')),
    status('qs-status'), el('p', { id: 'qs-live', class: 'sr-only', role: 'status' }),
    el('div', { class: 'specimen simple-previews' },
      plate('qs-old-canvas', 'Old game', 'Historical reconstructed crosshair'),
      plate('qs-new-canvas', 'New game', 'Proposed crosshair candidate simulation'),
      el('p', { id: 'qs-scale', class: 'plate-scale', 'aria-hidden': 'true' })),
    el('div', { class: 'hud' },
      el('dl', { class: 'readout simple-values' }, readout('qs-length', 'Length', 'cl_crosshair_length', 'qs-conf-length'),
        readout('qs-out-thickness', 'Thickness', 'cl_crosshair_thickness', 'qs-conf-thickness'),
        readout('qs-out-gap', 'Gap', 'cl_crosshair_gap', 'qs-conf-gap')),
      el('div', { class: 'hud-actions' },
        el('button', { id: 'qs-copy', type: 'button', class: 'button primary', disabled: true }, 'Copy commands'),
        el('button', { id: 'qs-download', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'))),
    el('p', { id: 'qs-flags', class: 'flag-chips' }),
    el('div', { class: 'console-block' },
      el('div', { class: 'console-head' }, el('h3', { id: 'qs-commands-title' }, 'Console commands'),
        el('span', { class: 'small' }, 'Copy puts them on one line.')),
      el('div', { id: 'qs-commands', class: 'command-list', tabindex: 0, role: 'region', 'aria-labelledby': 'qs-commands-title' })));
}

/** Row 3: what happened to each old setting, and the limits. */
function reportRow() {
  return el('section', { class: 'qs-report', 'aria-label': 'What happened' },
    el('div', { class: 'qs-changes' }, el('h2', { id: 'qs-changes-title' }, 'What happened to each setting'),
      el('div', { id: 'qs-outcomes' })),
    el('div', { class: 'qs-limits-col' },
      el('h2', { id: 'qs-warnings-title' }, 'Limits of this result'),
      el('ul', { id: 'qs-warnings', class: 'warn-list', role: 'status', 'aria-labelledby': 'qs-warnings-title' }),
      el('p', { id: 'qs-note', class: 'qs-note' }),
      el('p', { id: 'qs-limits', class: 'qs-limits' }, LIMITS_LINE),
      el('p', { id: 'qs-build', class: 'small qs-build' }, BUILD_LINE),
      el('p', { id: 'qs-backup', class: 'qs-backup' }, 'Save your current crosshair first: copy its share code in game.')));
}

function simpleLayer() {
  return el('div', { id: 'quant-simple', class: 'quant-simple' }, inputs(), samplesStrip(), plateRow(), reportRow());
}

function valueTable() {
  return el('div', { class: 'value-table-wrap' }, el('table', { id: 'q-values-table', class: 'value-table', 'aria-label': 'Conversion values' },
    el('thead', {}, el('tr', {}, ...['Setting', 'Old value', 'Copied value', 'Proposed value'].map(label => el('th', { scope: 'col' }, label)))),
    el('tbody', {}, ...[['length', 'Length', 'cl_crosshair_length'], ['thickness', 'Thickness', 'cl_crosshair_thickness'],
      ['gap', 'Gap', 'cl_crosshair_gap']].map(([key, title, cvar]) =>
      // Break the cvar name after its prefix on narrow screens instead of inside a word.
      el('tr', {}, el('th', { scope: 'row' }, title, el('code', {}, 'cl_crosshair_', el('wbr'), cvar.slice(13))),
        ...['legacy', 'direct', 'new'].map(kind =>
          el('td', { id: `q-value-${key}-${kind}`, class: kind === 'new' ? 'converted-value' : '' }, '-')))))));
}

function previewPanel() {
  const titles = ['Old target', 'Copied values', 'Proposed values'];
  const aria = ['Historical reconstructed or measured crosshair', 'New values without numeric conversion',
    'Converted values under selected model'];
  return el('div', { class: 'preview-panel' },
    el('div', { class: 'quant-toolbar' }, el('h3', {}, 'Difference plates'),
      el('div', { class: 'toolbar-group' }, check('q-grid', 'Grid'), check('q-difference', 'Difference'),
        el('select', { id: 'q-zoom', 'aria-label': 'Preview magnification' },
          ...[1, 2, 4, 6, 10, 16].map(z => el('option', { value: z, ...(z === 6 ? { selected: 'selected' } : {}) }, `${z}×`))))),
    el('div', { class: 'quant-previews' }, ...['old', 'naive', 'converted'].map((id, i) =>
      el('figure', { class: 'quant-preview' }, el('figcaption', {}, titles[i]),
        el('canvas', { id: `q-${id}-canvas`, role: 'img', 'aria-label': aria[i] }),
        el('p', { id: `q-${id}-values`, class: 'quant-values' }), el('p', { id: `q-${id}-note`, class: 'small' })))),
    el('p', { id: 'q-renderer-note', class: 'small' }));
}

function optionsPanel() {
  return detail('q-options-panel', 'Matching and export options',
    el('label', { for: 'q-goal' }, 'When the heights differ, keep'), el('select', { id: 'q-goal' },
      option('pixels', 'The same size in game pixels'), option('screen', 'The same share of the screen')),
    el('label', { for: 'q-outline' }, 'Outline'),
    el('select', { id: 'q-outline' }, ...OUTLINE_OPTIONS.map(([value, name]) => option(value, name))),
    el('label', { for: 'q-style' }, 'Style'),
    el('select', { id: 'q-style' }, ...STYLE_OPTIONS.map(([value, name]) => option(value, name))),
    el('p', { class: 'small' }, 'Auto derives the outline mode from the old settings. The half outline matches one user capture ' +
      'of the current game (issue #11); the full outline is unverified in game. The experimental style keeps old styles 2, 3 ' +
      'and 5 as new 2 or 5, which move with inaccuracy and shots.'),
    check('q-corrections', 'Automatic appearance corrections', { checked: true }),
    el('p', { class: 'small' }, 'Automatic model only. On: crossed arms, outline-only and dot-only shapes are redrawn and a ' +
      'nearby length, thickness or gap may draw the old pixels better. Off: the plain dimension-first conversion.'),
    el('label', { for: 'q-decision' }, 'When models disagree'), el('select', { id: 'q-decision' },
      option('expected', 'Lowest weighted mismatch'), option('worst', 'Limit the largest mismatch'),
      option('cvar', 'Limit weighted worst tail (CVaR)')),
    el('p', { class: 'small' }, 'Historical models only. The automatic model preserves dimensions, then fits the centre radius.'),
    el('p', { class: 'small' }, 'These options apply in Expert mode. Simple mode uses the automatic model, auto outline, ' +
      'Static Cross, the pixel goal and the corrections.'));
}

function feedbackPanel() {
  return detail('q-feedback', 'Compare with a game screenshot',
    el('p', { class: 'small' }, 'Add an original CS2 capture to test the proposed rendering. ' +
      'Keep captures used to tune a model separate from captures used to check it.'),
    el('div', { class: 'input-grid' }, field('q-new-image', 'Native PNG with the current output', 'file', { accept: 'image/png' }),
      field('q-measurements', 'Scoped measurement JSON', 'file', { accept: '.json,application/json' })),
    el('div', { class: 'export-actions' }, el('button', { id: 'q-export-measurements', class: 'button secondary' }, 'Export evidence'),
      el('button', { id: 'q-clear-measurements', class: 'button ghost' }, 'Reset session evidence')),
    status('q-evidence-status'), el('h3', {}, 'A useful next screenshot'),
    el('p', { class: 'small' }, 'These settings make our models disagree most in the preview. A real capture could help tell them apart.'),
    el('pre', { id: 'q-experiment', class: 'formula' }),
    el('h3', {}, 'Discriminating capture set'),
    el('p', { class: 'small' }, 'Loaded when this panel is first opened. Each design separates declared model predictions; ' +
      'the whole set is a capture plan, not a measurement.'),
    el('pre', { id: 'q-discriminating', class: 'formula' }));
}

/** The expert layer, revealed in place below the simple rows. */
function expertLayer(meta) {
  const main = el('div', { class: 'quant-output' },
    el('div', { class: 'quant-model-select' }, el('label', { for: 'q-model' }, 'Rendering model'),
      el('select', { id: 'q-model' }, option('', 'Automatic: community static reconstruction'),
        option(HEDGE_MODEL, 'Historical: weighted model hedge'), ...EXPERT_MODELS.map(m => option(m.id, modelName(m))))),
    el('p', { class: 'small' }, 'Six choices: the community default, a historical hedge, and four authored-height alternatives. ',
      docLink('research/converter-audit-2026-09-29.md', 'Sources and comparison')),
    status('q-status'), valueTable(), el('p', { id: 'q-target-line', class: 'target-line' }),
    el('ul', { id: 'q-warnings', class: 'warn-list', role: 'status', 'aria-label': 'Expert warnings' }),
    previewPanel(),
    el('h3', { class: 'confidence-title' }, 'Confidence'), el('div', { id: 'q-confidence', class: 'quant-metrics' }),
    el('div', { class: 'expert-export' },
      el('label', { for: 'q-cfg' }, 'Exported line'),
      el('textarea', { id: 'q-cfg', rows: 3, readonly: 'readonly', spellcheck: false }),
      el('div', { class: 'export-actions' },
        el('button', { id: 'q-download-cfg', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'))));
  const side = el('div', { class: 'quant-input' },
    detail('q-presets-panel', `Published player settings: ${meta.records} entries from ${meta.players} players`,
      el('input', { id: 'q-preset-search', type: 'search', placeholder: 'Find a player', 'aria-label': 'Search pro presets', maxlength: 128 }),
      el('select', { id: 'q-preset', 'aria-label': 'Pro crosshair snapshot' }), el('p', { id: 'q-provenance', class: 'small' })),
    detail('q-image-panel', 'Use an old screenshot', field('q-old-image', 'Original PNG, up to 16 MB', 'file', { accept: 'image/png' }),
      el('p', { class: 'small' }, 'Enter the old game height above. The image stays in this tab.'), status('q-input-status')),
    optionsPanel(),
    detail('q-outcomes-panel', 'What happened to each old setting', el('div', { id: 'q-outcomes' })),
    detail('q-derivation-panel', 'Pixel measurements and differences', el('div', { id: 'q-derivation' }),
      docLink('math/12-community-conversion.md', 'How the current values are calculated')),
    detail('q-scenarios', 'Compare selected models', el('div', { id: 'q-model-table' })),
    detail('q-trace-panel', 'Search details and uncertainty',
      check('q-certify', 'Certify global optimum (slower)'),
      el('p', { id: 'q-certify-note', class: 'small' }),
      el('div', { id: 'q-trace' }),
      el('button', { id: 'q-download-report', type: 'button', class: 'button secondary', disabled: true }, 'Download research JSON')),
    feedbackPanel(),
    el('p', { class: 'source-footnote' },
      `${meta.uniqueCodes} distinct codes in the archive. ${meta.nativeCapturePairs} original old/new capture pairs. `,
      el('a', { href: '#corpus' }, 'Browse the records')));
  return el('section', { id: 'quant-expert', class: 'quant-layout', 'aria-labelledby': 'quant-expert-title' },
    el('div', { class: 'section-head' }, el('h2', { id: 'quant-expert-title' }, 'Expert detail'),
      el('p', { class: 'small' }, 'Models, difference plates, confidence and the raw search. Inputs stay above.')),
    el('div', { class: 'expert-grid' }, main, side));
}

export function createView(root, meta) {
  root.replaceChildren(
    sheetHead({ title: 'Crosshair conversion',
      lede: 'Paste your old crosshair. You get the new length, thickness and gap, drawn next to the old one pixel for pixel.',
      fields: [['Model', COMMUNITY_MODEL.version], ['Build', COMMUNITY_MODEL.build], ['Corpus', SNAPSHOT.date],
        ['Checked in game', ['Not yet', docLink('math/06-statistical-inference.md', 'Why')], 'tb-flag']] }),
    simpleLayer(), expertLayer(meta));
  const refs = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
  return { root, refs, get: id => refs[id] };
}
