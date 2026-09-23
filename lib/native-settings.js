import { height as validHeight, integer, bool } from './validation.js';

export function validateNative(n) {
  integer(n.length,'New length',0,255); integer(n.thickness,'New thickness',0,31);
  integer(n.gap,'New gap',0,128); validHeight(n.authoredHeight);
}

export function rgba(settings) {
  bool(settings.alpha_enabled,'Alpha enabled');
  const presets = [[250,50,50],[50,250,50],[250,250,50],[50,50,250],[50,250,250]];
  const color = settings.color === 5 ? settings.rgb : presets[settings.color];
  if (!Array.isArray(color) || color.length!==3) throw new Error('Unsupported legacy color preset.');
  color.forEach(v=>integer(v,'RGB',0,255)); integer(settings.alpha,'Alpha',0,255);
  return {rgb:[...color],alpha:settings.alpha_enabled ? settings.alpha : 200};
}

export const safeComment = value => String(value).replace(/[\r\n\u2028\u2029]/g, ' ').slice(0, 1024);
/** Single allowlisted formatting path shared by automatic and manual exports. */
export function nativeCommands(settings, native) {
  validateNative(native);
  for (const key of ['dot', 't_style', 'outline', 'recoil']) bool(settings[key], key);
  const {rgb, alpha} = rgba(settings);
  return ['cl_crosshairstyle 4', `cl_crosshair_length ${native.length}`, `cl_crosshair_thickness ${native.thickness}`, `cl_crosshair_gap ${native.gap}`,
    `cl_crosshairdot ${Number(settings.dot)}`, `cl_crosshair_t ${Number(settings.t_style)}`, `cl_crosshair_drawoutline ${Number(settings.outline)}`, `cl_crosshair_recoil ${Number(settings.recoil)}`,
    ...rgb.map((v,i)=>`cl_crosshaircolor_${'rgb'[i]} ${v}`), `cl_crosshaircolor_a ${alpha}`,
    '// Authored height last. Read it back in game; these commands do not change the game resolution.',
    `cl_crosshair_screen_height ${native.authoredHeight}`];
}
