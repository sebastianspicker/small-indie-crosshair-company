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

/** Share codes store the colour index in three bits, so 6 and 7 decode but are not game presets. */
export const colorIndexUnknown = settings => settings.color === 6 || settings.color === 7;
export const COLOR_INDEX_NOTE = index => `Old colour index ${index} is not a game preset; the stored RGB is used.`;

export function rgba(settings) {
  bool(settings.alpha_enabled,'Alpha enabled');
  const presets = [[250,50,50],[50,250,50],[250,250,50],[50,50,250],[50,250,250]];
  const color = settings.color >= 5 && settings.color <= 7 && Number.isInteger(settings.color) ? settings.rgb : presets[settings.color];
  if (!Array.isArray(color) || color.length!==3) throw new Error('Unsupported legacy color preset.');
  color.forEach(v=>integer(v,'RGB',0,255)); integer(settings.alpha,'Alpha',0,255);
  return {rgb:[...color],alpha:settings.alpha_enabled ? settings.alpha : 200};
}

/** Legacy outline to `cl_crosshair_drawoutline` (0 none, 1 full, 2 half). Old widths below 1 drew
 * only the top-left edge; Valve's September 24 2026 half outline replaces them (issue #11). A zero
 * width typed in a CFG drew no visible outline; a share-code zero is only a rounded small width.
 * The half mapping matches one user capture of the current game (issue #11); the full one has none. */
export function outlineMode(settings) {
  if (!bool(settings.outline, 'outline')) return 0;
  const width = finite(settings.outline_width ?? 1, 'Outline width', 0);
  return width === 0 && !settings.outline_width_rounded ? 0 : width < 1 ? 2 : 1;
}

/** True when an enabled outline has width 0 only because the share code rounds to 0.5 steps. */
export const outlineRounded = settings => !!settings.outline && settings.outline_width === 0 && settings.outline_width_rounded === true;
export const OUTLINE_ROUNDED_NOTE = 'Old share codes store outline thickness in 0.5 steps, so a stored 0 with the outline on ' +
  'means a thin outline below 0.5.';

/** Old maximum of cl_crosshair_outlinethickness; larger typed values drew as 3. */
export const OLD_OUTLINE_MAX = 3;
/** Outline pixels added beyond a bar edge, `{ low, high }` = left/top and right/bottom.
 * Old source: `DrawFilledRect(x0-t, y0-t, x1+t, y1+t)` with float t truncated to int, so at
 * screen-positive coordinates the low edges grow by ceil(t) and the high edges by floor(t).
 * Widths above the old maximum 3 draw as 3 here too, so direct callers match the import clamp. */
export function legacyOutlineExtent(settings) {
  if (!bool(settings.outline, 'outline')) return { low: 0, high: 0 };
  let t = Math.min(OLD_OUTLINE_MAX, finite(settings.outline_width ?? 1, 'Outline width', 0));
  if (t === 0 && settings.outline_width_rounded) t = .25;
  return { low: Math.ceil(t), high: Math.floor(t) };
}
/** Old outlines wider than 1 px on both sides (integer widths 2 and 3); the assumed full outline is 1 px. */
export const OUTLINE_REDUCED_NOTE = (width, px) => `Old outline thickness ${width} drew ${px} px; the new outline is 1 px.`;
/** 2000922 modes: 1 is one pixel all round (no capture), 2 is top and left only (one user capture, issue #11). */
export const nativeOutlineExtent = (settings, override) =>
  [{ low: 0, high: 0 }, { low: 1, high: 1 }, { low: 1, high: 0 }][effectiveOutlineMode(settings, override)];

/** Opt-in export choices; `'auto'` derives the mode from the old settings. Only the half outline has a capture. */
export const OUTLINE_CHOICES = Object.freeze(['auto', 0, 1, 2]);
/** Old styles 2 to 5 convert directly (old weapon_csbase.cpp L2002-2050): styles 2, 3 and 4 drew the style-4 gap at
 * rest (2 and 3 followed the weapon's spread, which the export assumes is none), style 5 its own (ADR-0018). */
export const STATIC_AT_REST_STYLES = Object.freeze([2, 3, 4, 5]);
/** Blocker for old styles 0 and 1: the default styles drew a different reticle, not the cvar bars. */
export const DEFAULT_STYLE_BLOCKER = 'Old styles 0 and 1 (the default styles) drew a different reticle, not the bars ' +
  'set by size, thickness and gap (the pre-update game listed them as disabled and drew its default reticle), so they ' +
  'cannot be converted. Set the old style to 4 (cl_crosshairstyle 4) to ' +
  'convert the shape of your size, thickness and gap. Old styles 2, 3, 4 and 5 convert directly.';
/** Blocker for any other old style (6, 7, 9, -1, 4.5…): the old game had only styles 0 to 5. */
export const UNKNOWN_STYLE_BLOCKER = style => `Old style ${style} is unknown to the old game, which had only styles 0 to 5 ` +
  '(a current-game style or a damaged value), so it cannot be converted. Set the old style to 4 (cl_crosshairstyle 4) to ' +
  'convert the shape of your size, thickness and gap. Old styles 2, 3, 4 and 5 convert directly.';
/** The blocker for an old style outside 2..5, or null. */
export const styleBlocker = style => STATIC_AT_REST_STYLES.includes(style) ? null
  : style === 0 || style === 1 ? DEFAULT_STYLE_BLOCKER : UNKNOWN_STYLE_BLOCKER(style);
export const STYLE_TARGETS = Object.freeze(['static', 'family']);
/** Normalize the outline option: `'auto'` (also null/undefined and numeric strings) or 0, 1, 2. */
export function outlineChoice(value) {
  if (value === undefined || value === null || value === 'auto') return 'auto';
  const n = typeof value === 'string' && /^[012]$/.test(value) ? Number(value) : value;
  if (n !== 0 && n !== 1 && n !== 2) throw new Error('Outline mode must be auto, 0, 1 or 2.');
  return n;
}
export function styleTargetChoice(value) {
  if (value === undefined || value === null) return 'static';
  if (!STYLE_TARGETS.includes(value)) throw new Error('Style target must be static or family.');
  return value;
}
/** Outline mode actually exported: the user's choice, else the one derived from the old settings. */
export const effectiveOutlineMode = (settings, override) => {
  const choice = outlineChoice(override);
  return choice === 'auto' ? outlineMode(settings) : choice;
};
/** New style to export. `'static'` (default) is always Static Cross 4. `'family'` keeps the old family:
 * old 2 and 3 become 2 (Dynamic Cross, Classic), old 5 becomes 5 (Dynamic Cross, Legacy/Shot Feedback),
 * everything else 4. Experimental: the old source drew styles 2/3 like style 4 at rest (style 5 with its own gap, ADR-0018),
 * but the new styles 2 and 5 move with inaccuracy and shots. */
export function styleTarget(settings, mode = 'static') {
  if (styleTargetChoice(mode) === 'static') return 4;
  return settings.style === 2 || settings.style === 3 ? 2 : settings.style === 5 ? 5 : 4;
}
/** `nativeCommands` overrides for a resolved scope (`outlineMode`, `styleTarget`); defaults change nothing. */
export const exportOverrides = (settings, options = {}) => ({
  ...(outlineChoice(options.outlineMode) === 'auto' ? {} : { outlineMode: outlineChoice(options.outlineMode) }),
  style: styleTarget(settings, options.styleTarget) });
export const STYLE_FAMILY_NOTE = style => `Exported style ${style} keeps the old style family. Its at-rest shape is assumed to match ` +
  'Static Cross (old source: styles 2/3 drew like style 4 at rest, style 5 with its own gap), but the new style moves ' +
  'with inaccuracy or shots, ' +
  'which is not modelled. Unverified in game.';
export const STYLE_DYNAMIC_NOTE = style => `Old style ${style} moved with movement or shots; the export is Static Cross, ` +
  "which does not move. At rest the gap of styles 2 and 3 followed the held weapon's standing inaccuracy (old renderer " +
  'source); the export uses the reading with no spread, which equals Static Cross, so the in-game gap may have been ' +
  'about one pixel smaller with a rifle; style 5 rested at its own gap (see its note). ' +
  "Choose 'Keep old style family (experimental)' for a dynamic new style.";
/** Old style 5 (Legacy) placed its bars at `round(4 × height / 1200 + gap)` at rest (ADR-0018); `now` and `plain`
 * are the gap in old pixels under that rule and under Static Cross's `trunc(4 + gap)`. */
export const LEGACY_STYLE_5_NOTE = (height, now, plain) => 'Old style 5 (Legacy) placed its bars at round(4 × height / ' +
  `1200 + gap) at rest, not at Static Cross's trunc(4 + gap) (old renderer source); at ${height} that is ${now} instead ` +
  `of ${plain} pixels. The export uses that reading; it is unverified in the pre-update game.`;
/** Warnings (`{ code, text }`) for the non-default export options; empty for the defaults. */
export function optionWarnings(settings, options = {}) {
  const out = [], mode = outlineChoice(options.outlineMode), style = styleTarget(settings, options.styleTarget);
  if (mode !== 'auto') out.push({ code: 'outline-user-override', text: `Outline mode chosen by hand: ${mode}.` });
  if (style !== 4) out.push({ code: 'style-family-experimental', text: STYLE_FAMILY_NOTE(style) });
  else if ([2, 3, 5].includes(settings.style)) out.push({ code: 'style-dynamic-at-rest', text: STYLE_DYNAMIC_NOTE(settings.style) });
  return out;
}

/** Fill alpha to export: the old opacity; for `cl_crosshairusealpha 0` 255. The old fill was additive, never
 * dimmed the background and looked near full colour; a normal blend at 200 looks dimmer than it ever did. */
export function exportFillAlpha(settings) {
  const { alpha } = rgba(settings);
  return settings.alpha_enabled ? alpha : 255;
}
export const ADDITIVE_NOTE = alpha => 'With cl_crosshairusealpha 0 the old colour was added to the scene at opacity 200 ' +
  '(additive blending), which never darkened the background and showed near full colour; the current game only blends ' +
  `normally, where 200 looks dimmer than before. The export keeps the colour at opacity ${alpha}, as other converters do; ` +
  'the outline keeps 200.';
export const OUTLINE_ONLY_NOTE = 'The old crosshair showed only outline strokes (a small #): size 0 draws zero-length bars ' +
  'whose outlines remain. This export keeps length 0 with the same width, gap and outline, but the current game draws ' +
  'nothing for length 0, outline included (user capture, issue #11). The automatic converter redraws the strokes as black bars.';

/** Colour override `{ rgb: [r, g, b], alpha }`, validated like the old colour. */
function exportColor(color) {
  if (!Array.isArray(color?.rgb) || color.rgb.length !== 3) throw new Error('Export colour must be three RGB values.');
  color.rgb.forEach(v => integer(v, 'RGB', 0, 255)); integer(color.alpha, 'Alpha', 0, 255);
  return { rgb: [...color.rgb], alpha: color.alpha };
}
/** Single allowlisted formatting path shared by automatic and manual exports. `overrides.color` and
 * `overrides.t_style` replace the old colour and T flag (a report's `exportOverrides`). */
export function nativeCommands(settings, native, overrides = {}) {
  validateNative(native, NATIVE_RANGES_2000922);
  const mode = effectiveOutlineMode(settings, overrides.outlineMode);
  const style = overrides.style ?? 4;
  if (![2, 4, 5].includes(style)) throw new Error('Exported style must be 2, 4 or 5.');
  for (const key of ['dot', 't_style', 'outline', 'recoil']) bool(settings[key], key);
  const base = rgba(settings), {rgb, alpha} = overrides.color === undefined ? base : exportColor(overrides.color);
  const fill = overrides.color === undefined ? exportFillAlpha(settings) : alpha;
  const tStyle = bool(overrides.t_style ?? settings.t_style, 't_style');
  return [`cl_crosshairstyle ${style}`, `cl_crosshair_length ${native.length}`, `cl_crosshair_thickness ${native.thickness}`,
    `cl_crosshair_gap ${native.gap}`,
    `cl_crosshairdot ${Number(settings.dot)}`, `cl_crosshair_t ${Number(tStyle)}`, `cl_crosshair_drawoutline ${mode}`,
    'cl_crosshairoutline_r 0', 'cl_crosshairoutline_g 0', 'cl_crosshairoutline_b 0',
    `cl_crosshairoutline_a ${mode ? alpha : 255}`,
    `cl_crosshair_recoil ${Number(settings.recoil)}`,
    ...rgb.map((v,i)=>`cl_crosshaircolor_${'rgb'[i]} ${v}`), `cl_crosshaircolor_a ${fill}`,
    '// Authored height last. Read it back in game; these commands do not change the game resolution.',
    `cl_crosshair_screen_height ${native.authoredHeight}`];
}
