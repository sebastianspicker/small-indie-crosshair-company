import { el, docLink, sheetHead, SNAPSHOT } from '../ui/dom.js';
import { EXPERT_MODELS } from '../../lib/solver/renderer.js';
import { HEDGE_MODEL } from '../../lib/solver/selection.js';
import { COMMUNITY_MODEL } from '../../lib/geometry/community.js';
import { samplesStrip } from './samples.js';
import { HEIGHT_PRESETS, PAIRS, COLOUR_PAIRS, OLD_COLOURS, FLAT_PLATES, SCENE_PLATES, DEFAULT_PLATE, toHex } from './inputs.js';

/** The one statement of what the result rests on, in the report column; the sheet head carries the same as data. */
const LIMITS_LINE = 'Modelled from the old renderer and community measurements; not yet checked against the current game ' +
  `(build ${COMMUNITY_MODEL.build}). Save your current crosshair's share code in game before you paste the commands.`;
const PASTE_HINT = 'Share code, console lines, cs2_user_convars.vcfg or "find crosshair" output.\n' +
  'e.g. CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX or cl_crosshairsize 2; cl_crosshairgap -3';

export const labels = { authored: 'Authored height', reference1080: '1080 reference', reference720: '720 reference',
  thickness: 'Thickness-relative', center: 'Center-relative', opening: 'Full opening' };
export const modelName = m => m.name ?? `${labels[m.scale]}, ${m.rounding}, ${labels[m.gap]}`;
const detail = (id, title, ...children) => el('details', { id }, el('summary', {}, title), ...children);
const field = (id, label, type, attrs = {}) => el('div', {}, el('label', { for: id }, label), el('input', { id, type, ...attrs }));
const check = (id, label, attrs = {}) => el('label', { class: 'check', for: id }, el('input', { id, type: 'checkbox', ...attrs }), label);
/** Export groups (lib/settings/native.js EXPORT_GROUPS) and the ids of their checkboxes in the Simple output. */
export const GROUP_CHECKS = Object.freeze({ color: ['qs-inc-color', 'Colour'],
  opacity: ['qs-inc-opacity', 'Opacity'], outline: ['qs-inc-outline', 'Outline'],
  outlineColor: ['qs-inc-outline-color', 'Outline colour'], recoil: ['qs-inc-recoil', 'Recoil'],
  screenHeight: ['qs-inc-height', 'Screen height'] });
const exportGroups = () => el('fieldset', { id: 'qs-groups', class: 'export-groups' },
  el('legend', {}, 'Include'),
  ...Object.values(GROUP_CHECKS).map(([id, label]) => check(id, label, { checked: true, disabled: true })),
  el('p', { class: 'small' }, 'Unticked lines are left out and the game keeps its current value; the previews still show this one.'));
const option = (value, name, attrs = {}) => el('option', { value, ...attrs }, name);
const OUTLINE_OPTIONS = [['auto', 'From old settings'], ['0', 'None'], ['1', 'Full'], ['2', 'Half']];
const STYLE_OPTIONS = [['static', 'Static Cross'], ['family', 'Old style family (experimental)']];
const status = id => el('p', { id, class: 'small', role: 'status' });
const decimal = { type: 'number', step: 'any', inputmode: 'decimal' };
/** One readout: label, value, cvar name and (if `chip` names one) a confidence chip. Shared with the Screenshot page. */
export const readout = (id, label, cvar, chip) => el('div', { class: 'readout-item' },
  el('dt', {}, label), el('dd', { id, class: 'simple-value' }, '-'),
  el('dd', { class: 'readout-cvar' }, cvar), chip ? el('dd', { id: chip, class: 'confidence-chip' }) : null);
export const plate = (id, title, label) => el('figure', { class: 'quant-preview plate' },
  el('figcaption', {}, el('span', {}, title)), el('canvas', { id, role: 'img', 'aria-label': label }));
/** A height: the presets, and the number input (shown for "Custom…" only) that the controller reads. */
export const heightField = (id, label) => el('div', { class: 'height-field' }, el('label', { for: `${id}-preset` }, label),
  el('select', { id: `${id}-preset` }, ...HEIGHT_PRESETS.map(([height, modes]) =>
    option(height, `${height} (${modes})`, height === 1080 ? { selected: 'selected' } : {})), option('custom', 'Custom…')),
  el('input', { id, type: 'number', min: 240, max: 16384, value: 1080, hidden: true, 'aria-label': `${label}, custom value` }));
/** A number input with a slider; the controller reads the number, the slider only writes it. */
const pairField = (id, label, attrs) => {
  const [, rangeId, min, max] = PAIRS.find(([numberId]) => numberId === id);
  return el('div', { class: 'pair' }, el('label', { for: id }, label), el('input', { id, type: 'number', ...attrs }),
    el('input', { id: rangeId, type: 'range', min, max, step: attrs.step === 1 ? 1 : .1, value: min, 'aria-label': `${label} slider` }));
};
/** One channel: its letter, a 0 to 255 number and a slider, on one row. */
const channelRow = ([id, rangeId, min, max, letter]) => el('div', { class: 'channel' }, el('label', { for: id }, letter),
  el('input', { id, type: 'number', min, max, step: 1, value: 0, inputmode: 'numeric', 'aria-label': `${letter} (0 to 255)` }),
  el('input', { id: rangeId, type: 'range', min, max, step: 1, value: 0, 'aria-label': `${letter} slider` }));
const colourBlock = () => el('div', { class: 'qs-colour', role: 'group', 'aria-labelledby': 'qs-colour-title' },
  el('h3', { id: 'qs-colour-title' }, 'Colour'),
  el('div', { class: 'colour-row' },
    el('div', { class: 'wheel' }, el('input', { id: 'qs-color', type: 'color', value: '#00ff00', 'aria-label': 'Crosshair colour wheel' }),
      el('output', { id: 'qs-hex', class: 'hex', 'aria-label': 'Hex colour', 'aria-live': 'off' }, '#00ff00')),
    el('div', { class: 'channels' }, ...COLOUR_PAIRS.map(channelRow))),
  el('div', { class: 'swatches', role: 'group', 'aria-label': 'Old preset colours' }, ...OLD_COLOURS.map(([name, rgb], index) => {
    const swatch = el('button', { id: `qs-swatch-${index}`, type: 'button', class: 'swatch', 'aria-pressed': 'false',
      title: `${name} (old preset ${index})`, 'aria-label': `${name}, old preset ${index}` });
    swatch.style.setProperty('--swatch', toHex(rgb));
    return swatch;
  })),
  el('p', { id: 'qs-colour-source', class: 'small colour-source', role: 'status' }),
  pairField('qs-alpha', 'Opacity', { min: 0, max: 255, step: 1, value: 255 }));
export const plateChoice = (id = 'qs-plate') => el('div', { class: 'toolbar-group plate-choice' },
  el('label', { for: id }, 'Preview background'),
  el('select', { id },
    el('optgroup', { label: 'Flat' }, ...FLAT_PLATES.map(([name, title]) =>
      option(name, title, name === DEFAULT_PLATE ? { selected: 'selected' } : {}))),
    el('optgroup', { label: 'Generated scenes' }, ...SCENE_PLATES.map(([name, title]) => option(name, title)))));

/** The sections that have an Expert switch, in page order. Each hides its expert content in `q-expert-<key>-panel`. */
export const EXPERT_SECTIONS = Object.freeze(['input', 'conversion', 'preview', 'settings', 'report']);
/** Section heads and expert panels for one page's id prefix (`q` here, `ss` on the Screenshot page).
 * `sectionHead`: the title, any extras, and that section's Expert switch (collapsed; the controller flips it). The
 * hidden note is the switch's description while an expert option is off its default (`markExpert`).
 * `expertPanel`: the section's expert content, hidden until its switch is on. Nothing in it is needed for the default result. */
export const expertParts = p => ({
  sectionHead: (key, tag, title, ...extra) => el('div', { class: 'section-head' }, el(tag, { id: `${p}-${key}-title` }, title), ...extra,
    el('button', { id: `${p}-expert-${key}`, type: 'button', class: 'expert-switch', 'aria-expanded': 'false',
      'aria-controls': `${p}-expert-${key}-panel`, 'aria-label': `Expert options: ${title}` }, 'Expert'),
    el('span', { id: `${p}-expert-${key}-modified`, hidden: true }, 'Changed from the default')),
  expertPanel: (key, ...children) => el('div', { id: `${p}-expert-${key}-panel`, class: 'expert-panel', hidden: true,
    role: 'group', 'aria-labelledby': `${p}-${key}-title` }, ...children),
});
const { sectionHead, expertPanel } = expertParts('q');
const cell = (id, title, ...children) => el('div', { id, class: 'expert-cell' }, el('h4', {}, title), ...children);
const labelled = (label, id, control, ...rest) => el('div', { class: 'opt-field' }, el('label', { for: id }, label), control, ...rest);

/** Input: the paste box always; other sources (published settings, a link to the screenshot page) behind its Expert switch. */
function pasteBlock(meta) {
  return el('section', { class: 'qs-paste', 'aria-labelledby': 'q-input-title' },
    sectionHead('input', 'h2', 'Input'),
    el('label', { for: 'qs-import' }, 'Old crosshair'),
    el('textarea', { id: 'qs-import', rows: 4, maxlength: 32768, spellcheck: false, autocomplete: 'off',
      placeholder: PASTE_HINT, 'aria-describedby': 'qs-input-status' }),
    el('div', { class: 'qs-load-row' }, el('button', { id: 'qs-load', type: 'button', class: 'button secondary' }, 'Load crosshair'),
      el('button', { id: 'qs-clear', type: 'button', class: 'button secondary' }, 'Clear')),
    status('qs-input-status'),
    expertPanel('input',
      cell('q-presets-panel', 'Published player settings',
        el('p', { class: 'small' }, `${meta.records} entries from ${meta.players} players`),
        el('input', { id: 'q-preset-search', type: 'search', placeholder: 'Find a player', 'aria-label': 'Search pro presets',
          maxlength: 128 }),
        el('select', { id: 'q-preset', 'aria-label': 'Pro crosshair snapshot' }), el('p', { id: 'q-provenance', class: 'small' })),
      // The same text as qs-input-status, which announces it; this copy is not a live region.
      cell('q-image-panel', 'Old screenshot',
        el('a', { id: 'q-screenshot-link', href: '#screenshot' }, 'Convert from a screenshot →'),
        el('p', { id: 'q-input-status', class: 'small' }))));
}

/** Conversion: the options most people touch, in the most prominent spot; the model, decision rule and corrections behind Expert. */
function conversionBlock() {
  return el('section', { id: 'qs-conversion', class: 'qs-conversion', 'aria-labelledby': 'q-conversion-title' },
    sectionHead('conversion', 'h2', 'Conversion'),
    el('div', { class: 'opt-fields' },
      labelled('When heights differ', 'q-goal', el('select', { id: 'q-goal' },
        option('pixels', 'Same game pixels'), option('screen', 'Same share of the screen'))),
      labelled('Outline', 'q-outline', el('select', { id: 'q-outline' }, ...OUTLINE_OPTIONS.map(([value, name]) => option(value, name)))),
      labelled('T', 'qs-t-export', el('select', { id: 'qs-t-export' }, option('keep', 'Same as old'),
        option('auto', 'Best pixel match'), option('on', 'T'), option('off', 'Cross'))),
      labelled('Style', 'q-style', el('select', { id: 'q-style' }, ...STYLE_OPTIONS.map(([value, name]) => option(value, name))))),
    el('p', { class: 'small' }, 'Best pixel match may export a cross for an upside-down or crossed old T. ' +
      'Old style family exports style 2 or 5, which move with inaccuracy and shots.'),
    expertPanel('conversion',
      el('div', { class: 'opt-fields' },
        labelled('Model', 'q-model', el('select', { id: 'q-model' }, option('', 'Automatic: community static reconstruction'),
          option(HEDGE_MODEL, 'Historical: weighted model hedge'), ...EXPERT_MODELS.map(m => option(m.id, modelName(m))))),
        labelled('When models disagree', 'q-decision', el('select', { id: 'q-decision' },
          option('expected', 'Lowest weighted mismatch'), option('worst', 'Limit the largest mismatch'),
          option('cvar', 'Limit weighted worst tail (CVaR)')), el('span', { id: 'q-decision-note', class: 'small' })),
        el('div', { class: 'opt-field opt-check' }, check('q-corrections', 'Automatic appearance corrections', { checked: true }))),
      el('p', { class: 'small' }, 'Corrections redraw crossed, outline-only and dot-only old shapes and may change a value by ' +
        'one step to match the old pixels. ', docLink('research/converter-audit-2026-09-29.md', 'Sources and comparison'))));
}

/** Controls: the paste box, the heights, the conversion options, the colour, and the direct values under a disclosure. */
function inputs(meta) {
  return el('form', { id: 'qs-inputs', class: 'qs-inputs qs-controls', 'aria-label': 'Old crosshair',
    onsubmit: event => event.preventDefault() },
    pasteBlock(meta),
    el('div', { class: 'qs-heights' },
      el('div', { class: 'heights' }, heightField('qs-old-height', 'Old height'), heightField('qs-new-height', 'New height')),
      el('p', { class: 'small' }, 'Vertical resolution in the old and in the new game.')),
    conversionBlock(),
    colourBlock(),
    el('details', { id: 'qs-values', open: 'open' }, el('summary', {}, 'Edit values'),
      el('div', { class: 'pairs' }, pairField('qs-size', 'Size', { min: 0, max: 10000, ...decimal }),
        pairField('qs-thickness', 'Thickness', { min: 0, max: 10000, ...decimal }),
        pairField('qs-gap', 'Gap', { min: -128, max: 128, ...decimal })),
      el('div', { class: 'simple-checks' }, check('qs-dot', 'Dot'), check('qs-t', 'T shape'))));
}

/** The three plates with their toolbar, behind the Preview section's Expert switch. */
function differenceView() {
  const titles = ['Old target', 'Copied values', 'Proposed values'];
  const aria = ['Historical reconstructed or measured crosshair', 'New values without numeric conversion',
    'Converted values under selected model'];
  return el('div', { class: 'preview-panel' },
    el('div', { class: 'quant-toolbar' },
      el('div', { class: 'toolbar-group' }, check('q-grid', 'Grid'), check('q-difference', 'Difference'),
        el('select', { id: 'q-zoom', 'aria-label': 'Preview magnification' },
          ...[1, 2, 4, 6, 10, 16].map(z => el('option', { value: z, ...(z === 6 ? { selected: 'selected' } : {}) }, `${z}×`))))),
    el('div', { class: 'quant-previews' }, ...['old', 'naive', 'converted'].map((id, i) =>
      el('figure', { class: 'quant-preview' }, el('figcaption', {}, titles[i]),
        el('canvas', { id: `q-${id}-canvas`, role: 'img', 'aria-label': aria[i] }),
        el('p', { id: `q-${id}-values`, class: 'quant-values' }), el('p', { id: `q-${id}-note`, class: 'small' })))),
    el('p', { id: 'q-renderer-note', class: 'small' }));
}

/** Preview: the old and new plates and the background choice; the difference view behind Expert. */
function previewSection() {
  return el('section', { class: 'qs-reading qs-preview', 'aria-labelledby': 'q-preview-title' },
    sectionHead('preview', 'h2', 'Preview', plateChoice()),
    el('div', { class: 'specimen simple-previews' },
      plate('qs-old-canvas', 'Old game', 'Historical reconstructed crosshair'),
      plate('qs-new-canvas', 'New game', 'Proposed crosshair candidate simulation'),
      el('p', { id: 'qs-scale', class: 'plate-scale', 'aria-hidden': 'true' }),
      el('p', { id: 'qs-plate-note', class: 'plate-scale plate-note', hidden: true }, 'Generated scene, not a game image.')),
    expertPanel('preview', differenceView()));
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

/** New settings: the readouts, the actions, the flags and the commands; the value table and research output behind Expert. */
function settingsSection() {
  return el('section', { class: 'qs-reading qs-settings', 'aria-labelledby': 'q-settings-title' },
    sectionHead('settings', 'h2', 'New settings'),
    status('qs-status'), el('p', { id: 'qs-live', class: 'sr-only', role: 'status' }),
    el('div', { class: 'hud' },
      el('dl', { class: 'readout simple-values' }, readout('qs-length', 'Length', 'cl_crosshair_length', 'qs-conf-length'),
        readout('qs-out-thickness', 'Thickness', 'cl_crosshair_thickness', 'qs-conf-thickness'),
        readout('qs-out-gap', 'Gap', 'cl_crosshair_gap', 'qs-conf-gap')),
      el('div', { class: 'hud-actions' },
        el('button', { id: 'qs-copy', type: 'button', class: 'button primary', disabled: true }, 'Copy commands'),
        el('button', { id: 'qs-download', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'))),
    el('p', { id: 'qs-flags', class: 'flag-chips' }),
    el('div', { class: 'console-block' },
      el('div', { class: 'console-head' }, el('h3', { id: 'qs-commands-title' }, 'Console commands')),
      exportGroups(),
      el('div', { id: 'qs-commands', class: 'command-list', tabindex: 0, role: 'region', 'aria-labelledby': 'qs-commands-title' })),
    expertPanel('settings', status('q-status'),
      el('div', { class: 'expert-values' }, valueTable(), el('p', { id: 'q-target-line', class: 'target-line' }),
        el('ul', { id: 'q-warnings', class: 'warn-list', role: 'status', 'aria-label': 'Expert warnings' })),
      el('div', { class: 'expert-confidence' }, el('h4', {}, 'Confidence'), el('div', { id: 'q-confidence', class: 'quant-metrics' })),
      cell('q-export-panel', 'Exported line', el('label', { for: 'q-cfg' }, 'Exported line'),
        el('textarea', { id: 'q-cfg', rows: 3, readonly: 'readonly', spellcheck: false }),
        el('div', { class: 'export-actions' },
          el('button', { id: 'q-download-cfg', type: 'button', class: 'button secondary', disabled: true }, 'Download .cfg'),
          el('button', { id: 'q-download-report', type: 'button', class: 'button secondary', disabled: true },
            'Download research JSON')))));
}

function feedbackPanel() {
  return detail('q-feedback', 'Compare with a game screenshot',
    el('p', { class: 'small' }, 'Add a lossless capture of the current game showing the converted values. ' +
      'Do not check a model with captures used to tune it.'),
    el('div', { class: 'input-grid' }, field('q-new-image', 'Native PNG with the current output', 'file', { accept: 'image/png' }),
      field('q-measurements', 'Scoped measurement JSON', 'file', { accept: '.json,application/json' })),
    el('div', { class: 'export-actions' }, el('button', { id: 'q-export-measurements', class: 'button secondary' }, 'Export evidence'),
      el('button', { id: 'q-clear-measurements', class: 'button ghost' }, 'Reset session evidence')),
    status('q-evidence-status'), el('h4', {}, 'A useful next screenshot'),
    el('p', { class: 'small' }, 'The settings on which the models disagree most.'),
    el('pre', { id: 'q-experiment', class: 'formula' }),
    el('h4', {}, 'Discriminating capture set'),
    el('p', { class: 'small' }, 'Captures that would separate the models: a plan, not a measurement.'),
    el('pre', { id: 'q-discriminating', class: 'formula' }));
}

/** What happened: the per-setting table and the limits; the deep dive as closed rows, and the source footnote, behind Expert. */
function reportRow(meta) {
  return el('section', { class: 'qs-what', 'aria-label': 'What happened' },
    el('div', { class: 'qs-report' },
      el('div', { class: 'qs-changes' }, sectionHead('report', 'h2', 'What happened to each setting'), el('div', { id: 'qs-outcomes' })),
      el('div', { class: 'qs-limits-col' },
        el('h2', { id: 'qs-warnings-title' }, 'Limits'),
        el('ul', { id: 'qs-warnings', class: 'warn-list', role: 'status', 'aria-labelledby': 'qs-warnings-title' }),
        el('p', { id: 'qs-limits', class: 'qs-limits' }, LIMITS_LINE))),
    expertPanel('report',
      el('div', { class: 'expert-dive' },
        detail('q-derivation-panel', 'Pixel measurements', el('div', { id: 'q-derivation' }),
          docLink('math/12-community-conversion.md', 'How the current values are calculated')),
        detail('q-scenarios', 'Compare models', el('div', { id: 'q-model-table' })),
        detail('q-trace-panel', 'Search details',
          check('q-certify', 'Certify global optimum (slower)'),
          el('p', { id: 'q-certify-note', class: 'small' }),
          el('div', { id: 'q-trace' })),
        feedbackPanel()),
      el('p', { class: 'source-footnote' },
        `${meta.uniqueCodes} distinct codes in the archive. ${meta.nativeCapturePairs} original old/new capture pairs. `,
        el('a', { href: '#corpus' }, 'Browse the records'))));
}

function simpleLayer(meta) {
  return el('div', { id: 'quant-simple', class: 'quant-simple' }, samplesStrip(),
    el('div', { class: 'qs-workbench' }, inputs(meta),
      el('div', { class: 'qs-results' }, el('div', { class: 'qs-answer' }, previewSection(), settingsSection()), reportRow(meta))));
}

export function createView(root, meta) {
  root.replaceChildren(
    sheetHead({ title: 'Crosshair conversion',
      lede: 'Old crosshair settings in; new length, thickness and gap out, both drawn pixel for pixel.',
      fields: [['Model', COMMUNITY_MODEL.version], ['Build', COMMUNITY_MODEL.build], ['Corpus', SNAPSHOT.date],
        ['Checked in game', ['Not yet', docLink('math/06-statistical-inference.md', 'Why')], 'tb-flag']] }),
    simpleLayer(meta));
  root.dataset.plate = DEFAULT_PLATE;
  const refs = Object.fromEntries([...root.querySelectorAll('[id]')].map(node => [node.id, node]));
  return { root, refs, get: id => refs[id] };
}
