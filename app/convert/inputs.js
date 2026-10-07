// Small input helpers of the Simple view: height presets, number/slider pairs, the old colour presets, the plate background.

import { SCENES } from './scenes.js';

/** Common vertical resolutions with the modes that use them. Anything else is "Custom…" (240 to 16384). */
export const HEIGHT_PRESETS = Object.freeze([[720, '1280×720'], [768, '1024×768, 1366×768'], [800, '1280×800'], [864, '1152×864'],
  [900, '1600×900'], [960, '1280×960 stretched'], [1024, '1280×1024'], [1050, '1680×1050'], [1080, '1920×1080, 1440×1080 stretched'],
  [1200, '1920×1200'], [1440, '2560×1440'], [1600, '2560×1600'], [2160, '3840×2160']]);
export const HEIGHT_IDS = Object.freeze(['qs-old-height', 'qs-new-height']);

/** Number inputs with a slider: [number id, slider id, slider min, slider max]. The number may go beyond the slider. */
export const PAIRS = Object.freeze([['qs-size', 'qs-size-range', 0, 10], ['qs-thickness', 'qs-thickness-range', 0, 6],
  ['qs-gap', 'qs-gap-range', -12, 12], ['qs-alpha', 'qs-alpha-range', 0, 255]]);

/** The five old cl_crosshaircolor presets 0 to 4 (lib/settings/native.js `rgba`). */
export const OLD_COLOURS = Object.freeze([['Red', [250, 50, 50]], ['Green', [50, 250, 50]], ['Yellow', [250, 250, 50]],
  ['Blue', [50, 50, 250]], ['Cyan', [50, 250, 250]]]);
/** The R, G and B number inputs with their sliders (0 to 255, whole numbers). */
export const COLOUR_PAIRS = Object.freeze([['qs-r', 'qs-r-range', 0, 255, 'R'], ['qs-g', 'qs-g-range', 0, 255, 'G'],
  ['qs-b', 'qs-b-range', 0, 255, 'B']]);
export const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

/** Preview backgrounds; the tokens for each live in styles.css under `#quant[data-plate]`. The flat plates are plain
 * colours; the scenes are generated blurred compositions (scenes.js) and also carry `data-plate-kind="scene"`. */
export const FLAT_PLATES = Object.freeze([['dark', 'Dark'], ['grey', 'Grey'], ['light', 'Light']]);
export const SCENE_PLATES = Object.freeze(SCENES.map(scene => [scene.id, scene.label]));
export const PLATES = Object.freeze([...FLAT_PLATES, ...SCENE_PLATES]);
export const DEFAULT_PLATE = 'grey';
/** The select follows the number: a preset value shows its row, anything else shows Custom with the number visible.
 * `keep` leaves the number visible (it has focus), so it is hidden on blur instead. */
export function syncHeight(get, id, keep = false) {
  const select = get(`${id}-preset`), number = get(id), value = number.valueAsNumber;
  select.value = HEIGHT_PRESETS.some(([height]) => height === value) ? String(value) : 'custom';
  number.hidden = select.value !== 'custom' && !keep;
}
/** The slider follows the number, clamped to its own range. */
export function syncPair(get, [numberId, rangeId, min, max]) {
  const value = get(numberId).valueAsNumber;
  get(rangeId).value = String(Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min);
}
/** The swatch of the old preset that equals the colour input is pressed. */
export function syncSwatches(get) {
  const hex = get('qs-color').value.toLowerCase();
  OLD_COLOURS.forEach(([, rgb], index) => get(`qs-swatch-${index}`).setAttribute('aria-pressed', String(toHex(rgb) === hex)));
}
export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** Each typed R, G, B channel as a number, or null (and `aria-invalid`) unless it is a whole 0 to 255. */
export function readChannels(get) {
  const values = COLOUR_PAIRS.map(([id]) => get(id).value.trim()), valid = values.map(v => /^\d{1,3}$/.test(v) && Number(v) <= 255);
  COLOUR_PAIRS.forEach(([id], index) => {
    if (valid[index]) get(id).removeAttribute('aria-invalid'); else get(id).setAttribute('aria-invalid', 'true');
  });
  return values.map((v, index) => valid[index] ? Number(v) : null);
}
/** One colour to every control: wheel, hex readout, sliders, swatches and (unless the user is typing in them) the numbers. */
export function writeColour(get, rgb, numbers = true) {
  get('qs-color').value = toHex(rgb); get('qs-hex').textContent = toHex(rgb);
  COLOUR_PAIRS.forEach(([id, rangeId], index) => {
    if (numbers) { get(id).value = String(rgb[index]); get(id).removeAttribute('aria-invalid'); }
    get(rangeId).value = String(rgb[index]);
  });
  syncSwatches(get);
}
/** Where the colour came from: an edit here, no input yet, published settings, the input, or the old game default
 * (which is not exported). */
export function colourSourceText(state) {
  if (state.colourEdited) return 'Set here, exported';
  if (!state.source) return 'No input yet';
  if (state.source.type === 'preset') return 'From the published settings';
  if (!['color', 'r', 'g', 'b'].some(key => state.assigned.includes(key))) return 'Old game default, exported only if changed';
  return state.source.type === 'manual-values' ? 'Shown colour, exported' : 'From your input';
}
export function syncInputs(get) {
  for (const id of HEIGHT_IDS) syncHeight(get, id);
  for (const pair of PAIRS) syncPair(get, pair);
  syncSwatches(get);
}
