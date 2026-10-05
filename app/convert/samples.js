import { el } from '../ui/dom.js';
import { parseLegacyTextWithNotes } from '../../lib/settings/import.js';
import { rgba, legacyOutlineExtent } from '../../lib/settings/native.js';
import { communityLegacy } from '../../lib/geometry/community.js';
import { paintQuant, fitZoom } from './preview.js';

/** Old crosshairs the converter redraws on purpose (ADR-0014, ADR-0017, ADR-0019). Each loads as a paste. */
export const SAMPLES = Object.freeze([
  ['cl_crosshairstyle 4\ncl_crosshairdot 1\ncl_crosshairgap -11.5\ncl_crosshairsize 2', 'Crossed arms with a dot, gap -11.5'],
  ['cl_crosshairstyle 4\ncl_crosshairsize 0\ncl_crosshairthickness 3.4\ncl_crosshairgap -5\ncl_crosshair_drawoutline 1',
    'Size 0 with an outline: the # shape', true],
  ['cl_crosshairstyle 4\ncl_crosshairsize 0\ncl_crosshairdot 1\ncl_crosshairthickness 2\ncl_crosshairgap 0\ncl_crosshair_drawoutline 1',
    'Size 0, dot and outline: a boxed dot', true],
  ['cl_crosshairstyle 4\ncl_crosshair_t 1\ncl_crosshairsize 3\ncl_crosshairthickness 1\ncl_crosshairgap -8', 'T shape with crossed arms'],
  ['cl_crosshairstyle 4\ncl_crosshairsize 3\ncl_crosshairthickness 1\ncl_crosshairgap 0\ncl_crosshair_drawoutline 1\n' +
    'cl_crosshair_outlinethickness 2', '2 px outline on thin arms'],
  ['cl_crosshairstyle 4\ncl_crosshairsize 1\ncl_crosshairthickness 2.5\ncl_crosshairgap -3\ncl_crosshair_drawoutline 0',
    'Short thick arms: a square ring'],
  // `light`: drawn on a lighter plate, since these old shapes are mostly black outline strokes.
].map(([text, caption, light = false], index) => Object.freeze({ id: `qs-sample-${index + 1}`, text, caption, light })));

/** Open in the empty state, collapsed (still there) once a result is shown; the controller sets `open`. */
export function samplesStrip() {
  return el('details', { id: 'qs-samples', class: 'qs-samples', open: 'open' },
    el('summary', {}, 'Examples'),
    el('p', { class: 'small' }, 'What this handles: old shapes the new game cannot store directly. Each is redrawn from its old pixels.'),
    el('ul', { class: 'sample-grid' }, ...SAMPLES.map(sample => el('li', { class: 'sample' },
      el('canvas', { id: `${sample.id}-canvas`, role: 'img', 'aria-label': `Old crosshair: ${sample.caption}`,
        ...(sample.light ? { 'data-plate': 'light' } : {}) }),
      el('p', {}, sample.caption),
      el('button', { id: `${sample.id}-try`, type: 'button', class: 'button secondary', 'data-sample': sample.id,
        'aria-label': `Try it: ${sample.caption}` }, 'Try it')))));
}

/** Draws each sample as the old game did, at 1080p, with one magnification per plate. */
export function renderSamples(get) {
  for (const sample of SAMPLES) {
    const canvas = get(`${sample.id}-canvas`);
    if (!canvas) continue;
    const settings = parseLegacyTextWithNotes(sample.text).config, geometry = communityLegacy(settings, 1080);
    const outline = legacyOutlineExtent(settings);
    const zoom = fitZoom(canvas, [geometry], [settings], [outline]);
    paintQuant(canvas, geometry, settings, rgba(settings), zoom, null,
      { grid: zoom >= 6, outline, legacy: true, lightPlate: sample.light });
  }
}
