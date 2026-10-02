import { el } from '../ui/dom.js';
import { settingOutcomes, confidenceLabel, CONFIDENCE_LABELS } from '../../lib/settings/outcomes.js';

const INTERNAL = new Set(['community-reconstruction', 'shape-loss-excludes-appearance']);
const CHIP_IDS = { length: 'qs-conf-length', thickness: 'qs-conf-thickness', gap: 'qs-conf-gap' };
const warningText = w => typeof w === 'string' ? w : w.text;

/** A cvar name that may only break after an underscore (a `<wbr>` after each one; DOM nodes, no innerHTML). */
export function breakableName(name) {
  const parts = String(name).split('_'), nodes = [];
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    nodes.push(document.createTextNode(last ? part : `${part}_`));
    if (!last) nodes.push(document.createElement('wbr'));
  });
  return nodes;
}

function outcomeTable(rows) {
  return el('div', { class: 'table-scroll outcome-scroll' }, el('table', { class: 'outcome-table' },
    el('thead', {}, el('tr', {}, ...['Old setting', 'Old', 'New', 'Result'].map(label => el('th', { scope: 'col' }, label)))),
    el('tbody', {}, ...rows.map(row => el('tr', { 'data-status': row.status },
      el('th', { scope: 'row' }, el('code', {}, ...breakableName(row.cvar)), el('small', {}, row.reason)),
      el('td', {}, row.old), el('td', {}, row.result),
      el('td', {}, el('span', { class: 'status-chip', 'data-status': row.status }, row.status)))))));
}

export function clearOutcomes(view) {
  for (const id of ['qs-outcomes', 'q-outcomes', 'qs-warnings']) view.get(id).replaceChildren();
  for (const id of Object.values(CHIP_IDS)) { const chip = view.get(id); chip.textContent = ''; chip.removeAttribute('data-confidence'); }
}

/** Fills the Simple view's "What changed" table, warnings and per-value chips, and the expert details copy. */
export function renderOutcomes(view, report, importNotes = []) {
  if (!report) return;
  const rows = settingOutcomes(report.settings, report, importNotes), confidence = confidenceLabel(report);
  view.get('qs-outcomes').replaceChildren(outcomeTable(rows));
  view.get('q-outcomes').replaceChildren(outcomeTable(rows));
  for (const [key, id] of Object.entries(CHIP_IDS)) {
    const chip = view.get(id);
    chip.textContent = CONFIDENCE_LABELS[confidence[key]]; chip.dataset.confidence = confidence[key];
  }
  const shown = report.warnings.filter(w => !INTERNAL.has(w.code)).map(warningText);
  view.get('qs-warnings').replaceChildren(...(shown.length ? shown : ['No extra limits were found for this crosshair.'])
    .map(text => el('li', {}, text)));
}
