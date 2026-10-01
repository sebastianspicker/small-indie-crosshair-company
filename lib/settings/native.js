import { height as validHeight, integer, bool, finite } from './validation.js';

/** Single source of the new-cvar integer ranges. Build 2000914. Do not change the numbers. */
export const NATIVE_RANGES = Object.freeze({
  length: Object.freeze({ min: 0, max: 255 }),
  thickness: Object.freeze({ min: 0, max: 31 }),
  gap: Object.freeze({ min: 0, max: 128 }),
  authoredHeightMin: 240,
});

/** Build 2000922: thickness 0..32. `gap` is the static-cross range used by export and search. */
export const NATIVE_RANGES_2000922 = Object.freeze({
  length: Object.freeze({ min: 0, max: 255 }),
  thickness: Object.freeze({ min: 0, max: 32 }),
  gap: Object.freeze({ min: 0, max: 128 }),
  authoredHeightMin: 240,
});
/** The cvar itself accepts this range on 2000922; negative gaps are officially Classic Dynamic only. */
export const GAP_CVAR_RANGE_2000922 = Object.freeze({ min: -3840, max: 3840 });

export function validateNative(n, ranges = NATIVE_RANGES) {
  integer(n.length,'New length',ranges.length.min,ranges.length.max);
  integer(n.thickness,'New thickness',ranges.thickness.min,ranges.thickness.max);
  integer(n.gap,'New gap',ranges.gap.min,ranges.gap.max);
  validHeight(n.authoredHeight);
}

export function rgba(settings) {
  bool(settings.alpha_enabled,'Alpha enabled');
  const presets = [[250,50,50],[50,250,50],[250,250,50],[50,50,250],[50,250,250]];
  const color = settings.color === 5 ? settings.rgb : presets[settings.color];
  if (!Array.isArray(color) || color.length!==3) throw new Error('Unsupported legacy color preset.');
  color.forEach(v=>integer(v,'RGB',0,255)); integer(settings.alpha,'Alpha',0,255);
  return {rgb:[...color],alpha:settings.alpha_enabled ? settings.alpha : 200};
}

/** Legacy outline to `cl_crosshair_drawoutline` (0 none, 1 full, 2 half). Old widths below 1 drew
 * only the top-left edge; Valve's September 24 2026 half outline replaces them (issue #11). A zero
 * width drew no visible outline. Both mappings are source-labelled, not native-validated. */
export function outlineMode(settings) {
  if (!bool(settings.outline, 'outline')) return 0;
  const width = finite(settings.outline_width ?? 1, 'Outline width', 0);
  return width === 0 ? 0 : width < 1 ? 2 : 1;
}

/** Old outlines were painted with the bars' opacity; 2000922 exposes a separate outline opacity. */
export const OUTLINE_ALPHA_NOTE = 'Old outlines used the crosshair opacity; the export keeps cl_crosshairoutline_a 255 ' +
  'because whether build 2000922 also scales the outline by crosshair opacity is unverified.';

export const safeComment = value => String(value).replace(/[\r\n\u2028\u2029]/g, ' ').slice(0, 1024);
/** Single allowlisted formatting path shared by automatic and manual exports. */
export function nativeCommands(settings, native) {
  validateNative(native, NATIVE_RANGES_2000922);
  for (const key of ['dot', 't_style', 'outline', 'recoil']) bool(settings[key], key);
  const {rgb, alpha} = rgba(settings);
  return ['cl_crosshairstyle 4', `cl_crosshair_length ${native.length}`, `cl_crosshair_thickness ${native.thickness}`, `cl_crosshair_gap ${native.gap}`,
    `cl_crosshairdot ${Number(settings.dot)}`, `cl_crosshair_t ${Number(settings.t_style)}`, `cl_crosshair_drawoutline ${outlineMode(settings)}`,
    'cl_crosshairoutline_r 0', 'cl_crosshairoutline_g 0', 'cl_crosshairoutline_b 0', 'cl_crosshairoutline_a 255',
    `cl_crosshair_recoil ${Number(settings.recoil)}`,
    ...rgb.map((v,i)=>`cl_crosshaircolor_${'rgb'[i]} ${v}`), `cl_crosshaircolor_a ${alpha}`,
    '// Authored height last. Read it back in game; these commands do not change the game resolution.',
    `cl_crosshair_screen_height ${native.authoredHeight}`];
}
