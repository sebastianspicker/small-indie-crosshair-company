import { el } from '../ui/dom.js';

export function fillPresets(controller) {
  const select = controller.get('q-preset'), selected = select.value, query = controller.get('q-preset-search').value.toLowerCase();
  const records = controller.records.filter(record => record.player.toLowerCase().includes(query));
  select.replaceChildren(...records.map(record => el('option', { value: record.id }, `${record.player} · ${record.observed_date ?? 'date unknown'}`)));
  if (records.some(record => record.id === selected)) select.value = selected;
}

function usePreset(controller) {
  const record = controller.records.find(row => row.id === controller.get('q-preset').value);
  if (!record) return;
  controller.setSettings(record); controller.get('q-import').value = record.code;
  controller.state.source = { type: 'preset', id: record.id, player: record.player, observedDate: record.observed_date, source: record.source };
  controller.get('q-input-status').textContent = 'Published settings loaded. Their current use is unknown.';
  const source = new URL(record.source);
  const children = source.protocol === 'https:' ? [el('a', { href: source.href, target: '_blank', rel: 'noopener noreferrer' }, `${record.player} · ${record.observed_date ?? 'observation date unknown'}`)] : [];
  controller.get('q-provenance').replaceChildren(...children); controller.schedule();
}

function manualEdit(controller) {
  controller.clearImageTarget(); controller.state.source = { type: 'manual-values' };
  controller.get('q-provenance').replaceChildren(); controller.get('q-import').value = ''; controller.get('q-input-status').textContent = 'Using your edited values.';
  controller.schedule();
}

export function bindSources(c) {
  c.on('q-load', 'click', () => c.importText());
  c.on('q-import', 'input', () => { clearTimeout(c.importTimer); c.invalidate(); c.importTimer = setTimeout(() => c.importText(), 250); });
  c.on('q-import', 'keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); c.importText(); } });
  for (const id of ['q-size', 'q-thickness', 'q-gap']) c.on(id, 'input', () => manualEdit(c));
  for (const id of ['q-dot', 'q-t']) c.on(id, 'change', () => manualEdit(c));
  for (const id of ['q-old-height', 'q-new-height']) c.on(id, 'input', () => c.schedule());
  c.on('q-preset-search', 'input', () => fillPresets(c)); c.on('q-preset', 'change', () => usePreset(c));
  c.on('q-color', 'input', () => { c.state.settings.color = 5; c.state.settings.rgb = [1, 3, 5].map(i => parseInt(c.get('q-color').value.slice(i, i + 2), 16)); c.schedule(); });
  c.on('q-alpha', 'input', () => { c.state.settings.alpha_enabled = true; c.state.settings.alpha = c.get('q-alpha').valueAsNumber; c.schedule(); });
}
