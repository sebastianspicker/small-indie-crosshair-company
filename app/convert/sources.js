import { el } from '../ui/dom.js';

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
  controller.setInputStatus('Published settings loaded. Their current use is unknown.');
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

export function bindSources(c) {
  c.on('qs-load', 'click', () => c.importText());
  c.on('qs-import', 'input', () => { clearTimeout(c.importTimer); c.invalidate(); c.importTimer = setTimeout(() => c.importText(), 250); });
  c.on('qs-import', 'keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); c.importText(); } });
  for (const id of ['qs-size', 'qs-thickness', 'qs-gap']) c.on(id, 'input', () => manualEdit(c));
  for (const id of ['qs-dot', 'qs-t']) c.on(id, 'change', () => manualEdit(c));
  for (const id of ['qs-old-height', 'qs-new-height']) c.on(id, 'input', () => c.schedule());
  c.on('q-preset-search', 'input', () => fillPresets(c)); c.on('q-preset', 'change', () => usePreset(c));
  c.on('qs-color', 'input', () => { c.state.rejected = null; c.state.settings.color = 5; c.state.settings.rgb = [1, 3, 5].map(i => parseInt(c.get('qs-color').value.slice(i, i + 2), 16)); c.schedule(); });
  c.on('qs-alpha', 'input', () => { c.state.rejected = null; c.state.settings.alpha_enabled = true; c.state.settings.alpha = c.get('qs-alpha').valueAsNumber; c.schedule(); });
}
