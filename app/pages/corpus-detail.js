import { el, table } from '../ui/dom.js';
import { converterLink } from '../ui/route.js';
import { inferCommunity } from '../../lib/solver/community.js';
import { rgba, legacyOutlineExtent, nativeOutlineExtent } from '../../lib/settings/native.js';
import { exportedLook } from '../convert/evidence.js';
import { paintQuant, fitZoom } from '../convert/preview.js';
import { plateChoice } from '../convert/view.js';
import { DEFAULT_PLATE, SCENE_PLATES } from '../convert/inputs.js';
import { percent, resultLabel } from './corpus-data.js';

export function showRecord(root, entry, height) {
  root.replaceChildren();
  root.dataset.plate ??= DEFAULT_PLATE;
  if (!entry) { root.append(el('p', {}, 'No records match these filters.')); return; }
  const { record: r, score, exclusion } = entry;
  root.append(el('h3', { id: 'corpus-selected-name' }, r.player),
    el('p', { class: 'small' }, [r.team, r.country].filter(Boolean).join(' · ') || 'Team and country not supplied'),
    el('p', { class: 'small' }, `Observed ${r.observed_date ?? 'date unknown'} · retrieved ${r.retrieved_date}`),
    el('a', { href: r.source, target: '_blank', rel: 'noopener noreferrer' }, 'View published source ↗'),
    el('code', { class: 'corpus-code' }, r.code),
    el('p', { class: 'small' }, `Old size ${r.size} · thickness ${r.thickness} · gap ${r.gap} · style ${r.style}` +
      `${r.dot ? ' · dot' : ''}${r.t_style ? ' · T' : ''}${r.outline ? ' · outline' : ''}${r.weapon_gap ? ' · weapon gap' : ''}`));
  if (!score) { root.append(el('p', { class: 'corpus-notice' }, exclusion ?? 'No conversion result.')); return; }
  const report = inferCommunity({ settings: r, options: { oldHeight: height, currentHeight: height, authoredHeight: height,
    goal: 'pixels', tShape: 'keep' }, records: [], measurements: [] });
  const oldCanvas = el('canvas', { 'aria-label': `${r.player}: reconstructed old crosshair` });
  const newCanvas = el('canvas', { 'aria-label': `${r.player}: v11 converted crosshair` });
  const background = plateChoice('corpus-plate'), choice = background.querySelector('select');
  choice.value = root.dataset.plate;
  const previewNote = el('p', { class: 'small' });
  root.append(background, el('div', { class: 'corpus-previews' },
    el('figure', {}, oldCanvas, el('figcaption', {}, `Old · ${height}p`)),
    el('figure', {}, newCanvas, el('figcaption', {}, `v11 · ${height}p`))),
  previewNote,
  table(['Conversion', 'Length / thickness / gap', 'Result'], [
    ['v11 default', score.current.tuple.join(' / '), resultLabel(score.current.status)],
    ['Corrections off', score.plain.tuple.join(' / '), resultLabel(score.plain.status)]]),
  table(['Appearance overlap', 'v11 default', 'Corrections off'], [
    ['Same position', percent(score.current.iou), percent(score.plain.iou)],
    ['Best within 1 px', percent(score.current.alignedIou), percent(score.plain.alignedIou)]]),
  el('a', { class: 'button', href: converterLink(r.code, height, height), id: 'corpus-open-converter' }, 'Open in converter'));
  const relevant = report.warnings.filter(w => !['community-reconstruction', 'shape-loss-excludes-appearance'].includes(w.code));
  if (relevant.length) root.append(el('details', {}, el('summary', {}, `Conversion notes (${relevant.length})`),
    el('ul', {}, relevant.map(w => el('li', {}, w.text)))));
  const look = exportedLook(report), oldOutline = legacyOutlineExtent(r);
  const newOutline = nativeOutlineExtent(look.settings, look.outlineMode);
  const zoom = fitZoom(oldCanvas, [report.target, report.converted], [r, look.settings], [oldOutline, newOutline]);
  function paint() {
    previewNote.textContent = 'Model previews at equal magnification. ' +
      (root.dataset.plateKind === 'scene' ? 'Generated background, not a game capture.' : 'No game capture.');
    paintQuant(oldCanvas, report.target, r, rgba(r), zoom, null, { legacy: true, outline: oldOutline });
    paintQuant(newCanvas, report.converted, look.settings, look.color, zoom, null, { outline: newOutline });
  }
  choice.onchange = () => {
    root.dataset.plate = choice.value;
    if (SCENE_PLATES.some(([id]) => id === choice.value)) root.dataset.plateKind = 'scene';
    else delete root.dataset.plateKind;
    paint();
  };
  paint();
}
