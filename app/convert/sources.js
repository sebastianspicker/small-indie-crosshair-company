import { el } from '../ui/dom.js';
import { HEIGHT_IDS, PAIRS, COLOUR_PAIRS, OLD_COLOURS, hexToRgb, readChannels, writeColour, colourSourceText, syncHeight,
  syncPair, syncSwatches } from './inputs.js';

export function fillPresets(controller) {
  const select = controller.get('q-preset'), selected = select.value, query = controller.get('q-preset-search').value.toLowerCase();
  const records = controller.records.filter(record => record.player.toLowerCase().includes(query));
  select.replaceChildren(...records.map(record => el('option', { value: record.id }, `${record.player}, ${record.observed_date ?? 'date unknown'}`)));
  if (records.some(record => record.id === selected)) select.value = selected;
}

function usePreset(controller) {
  const record = controller.records.find(row => row.id === controller.get('q-preset').value);
  if (!record) return;
  controller.setSettings(record); controller.get('qs-import').value = record.code;
  controller.state.source = { type: 'preset', id: record.id, player: record.player, observedDate: record.observed_date, source: record.source };
  controller.setInputStatus('Published settings loaded.');
  const source = new URL(record.source);
  const children = source.protocol === 'https:' ? [el('a', { href: source.href, target: '_blank', rel: 'noopener noreferrer' }, `${record.player}, ${record.observed_date ?? 'observation date unknown'}`)] : [];
  controller.get('q-provenance').replaceChildren(...children); controller.schedule();
}

function manualEdit(controller) {
  controller.clearImageTarget(); controller.state.source = { type: 'manual-values' };
  controller.get('q-provenance').replaceChildren(); controller.get('qs-import').value = ''; controller.state.rejected = null;
  controller.setInputStatus('Using your edited values.');
  controller.schedule();
}

/** Editing RGB and opacity independently chooses only the corresponding export group. Without an input (the default
 * preset, or after Clear) the edit is a manual input like an edited value, so it converts and exports. */
function tickAppearance(c, group, keys) {
  c.state.assigned = [...new Set([...c.state.assigned, ...keys])];
  if (c.state.exportGroups) c.state.exportGroups[group] = true;
  c.state.source ??= { type: 'manual-values' };
}

/** Any colour edit (wheel, R/G/B, slider or swatch) arrives here with its RGB: it becomes the custom colour and its group ticks. */
function colourEdit(c, rgb) {
  c.state.rejected = null; c.state.settings.color = 5; c.state.settings.rgb = rgb; c.state.colourEdited = true;
  syncSwatches(c.view.get); tickAppearance(c, 'color', ['color', 'r', 'g', 'b']); c.schedule();
}
export function renderColourSource(c) { c.get('qs-colour-source').textContent = colourSourceText(c.state); }
/** Typed R/G/B or a channel slider (`index`): an invalid or empty channel marks `aria-invalid` and waits; a valid one updates
 * the wheel, sliders and swatches, with the last valid value (the wheel's) for any other channel that is invalid. */
function rgbTyped(c, index) {
  const channels = readChannels(c.view.get), last = hexToRgb(c.get('qs-color').value);
  if (channels[index] === null) return;
  const rgb = channels.map((value, i) => value ?? last[i]);
  writeColour(c.view.get, rgb, false); colourEdit(c, rgb);
}
function alphaEdit(c) {
  c.state.rejected = null; c.state.settings.alpha_enabled = true; c.state.settings.alpha = c.get('qs-alpha').valueAsNumber;
  tickAppearance(c, 'opacity', ['alpha', 'alpha_enabled']); c.schedule();
}

/** A height preset writes the number input; Custom… shows it, and a typed number that equals a preset selects that row on
 * commit. The focused number stays visible (Enter commits too) and is hidden on blur if it equals a preset. */
function bindHeights(c) {
  for (const id of HEIGHT_IDS) {
    const select = c.get(`${id}-preset`), number = c.get(id);
    c.on(`${id}-preset`, 'change', () => {
      number.hidden = select.value !== 'custom';
      if (select.value === 'custom') return number.focus?.();
      number.value = select.value; c.schedule();
    });
    c.on(id, 'input', () => c.schedule());
    c.on(id, 'change', () => syncHeight(c.view.get, id, globalThis.document?.activeElement === number));
    c.on(id, 'blur', () => syncHeight(c.view.get, id));
  }
}

export function bindSources(c) {
  c.on('qs-load', 'click', () => c.importText());
  c.on('qs-import', 'input', () => { clearTimeout(c.importTimer); c.invalidate(); c.importTimer = setTimeout(() => c.importText(), 250); });
  c.on('qs-import', 'keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); c.importText(); } });
  // A slider writes its number input and runs the number's own handler, so both paths edit the same way.
  const edits = { 'qs-size': manualEdit, 'qs-thickness': manualEdit, 'qs-gap': manualEdit, 'qs-alpha': alphaEdit };
  for (const pair of PAIRS) {
    const [numberId, rangeId] = pair, edit = () => edits[numberId](c);
    c.on(numberId, 'input', () => { syncPair(c.view.get, pair); edit(); });
    c.on(rangeId, 'input', () => { c.get(numberId).value = c.get(rangeId).value; edit(); });
  }
  for (const id of ['qs-dot', 'qs-t']) c.on(id, 'change', () => manualEdit(c));
  bindHeights(c);
  c.on('q-preset-search', 'input', () => fillPresets(c)); c.on('q-preset', 'change', () => usePreset(c));
  c.on('qs-color', 'input', () => { const rgb = hexToRgb(c.get('qs-color').value); writeColour(c.view.get, rgb); colourEdit(c, rgb); });
  COLOUR_PAIRS.forEach(([numberId, rangeId], index) => {
    c.on(numberId, 'input', () => rgbTyped(c, index));
    c.on(rangeId, 'input', () => { c.get(numberId).value = c.get(rangeId).value; rgbTyped(c, index); });
  });
  OLD_COLOURS.forEach(([, rgb], index) => c.on(`qs-swatch-${index}`, 'click', () => {
    writeColour(c.view.get, [...rgb]); colourEdit(c, [...rgb]);
  }));
}
