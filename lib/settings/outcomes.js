import { outlineMode, effectiveOutlineMode, styleTarget } from './native.js';

/**
 * What happened to each legacy setting, for display next to the converted values. Pure: it reads the
 * settings, the solver report and the importer notes and never recomputes a conversion.
 *
 * status: `converted` exact under the model; `approximated` rounded, clamped or shifted by the model;
 * `assumed` mapping not checked in game; `user-choice` set by hand in the export options;
 * `dropped` no new equivalent; `ignored` does not shape the crosshair.
 */
export const STATUSES = Object.freeze(['converted', 'approximated', 'assumed', 'user-choice', 'dropped', 'ignored']);

const num = value => Number.isInteger(value) ? String(value) : Number(Number(value).toFixed(4)).toString();
const codesOf = report => new Set((report?.warnings ?? []).map(w => w?.code).filter(Boolean));

/** Cvar names listed by the importer's "Ignored N cvar(s) ...: a, b." note. */
export function ignoredCvars(importNotes = []) {
  return importNotes.flatMap(note => {
    const match = /^Ignored \d+ cvar\(s\)[^:]*: (.*)\.$/.exec(String(note));
    return match ? match[1].split(', ') : [];
  });
}

/** Which of length, thickness and gap the model could not keep, with a plain reason each. */
function dimensionOutcomes(report) {
  const codes = codesOf(report), t = report?.target, c = report?.converted, n = report?.chosen?.native ?? {};
  const edges = report?.rendering;
  const limit = codes.has('dimension-limit');
  // Clamped values are recorded by every path; the warning codes alone only cover the community path.
  const clamp = {};
  for (const entry of report?.clamped ?? []) clamp[entry.field] ??= entry;
  const off = {
    length: limit && t && c && c.length !== t.length,
    thickness: limit && t && c && c.width !== t.width,
    gap: limit && edges && edges.convertedEdges?.near !== edges.targetEdges?.near,
  };
  if (limit && !off.length && !off.thickness && !off.gap) off.gap = true;
  const row = (key, value, wanted, got) => {
    if (key === 'thickness' && codes.has('visible-minimum'))
      return { status: 'approximated', reason: 'Old thickness 0 still drew a thin line, so a positive value is used.' };
    if (key === 'gap' && codes.has('negative-gap-static-unverified'))
      return { status: 'approximated', reason: 'Negative gap clamped to 0; Static Cross with a negative gap is not verified.' };
    if (clamp[key]) return { status: 'approximated',
      reason: `Old drew ${wanted} px; the ideal ${clamp[key].wanted} is outside the limits, so ${clamp[key].exported} is used.` };
    if (off[key]) return { status: 'approximated', reason: `Old drew ${wanted} px; integer steps and limits give ${got} px.` };
    if (key === 'thickness' && codes.has('pixel-centering-shift'))
      return { status: 'approximated', reason: 'Odd width: old and new pixel centres differ, so the bar may shift by one pixel.' };
    return { status: 'converted', reason: 'Matches the old pixel size under the model.' };
  };
  return {
    length: row('length', n.length, t?.length, c?.length),
    thickness: row('thickness', n.thickness, t?.width, c?.width),
    gap: row('gap', n.gap, edges?.targetEdges?.near, edges?.convertedEdges?.near),
  };
}

export function settingOutcomes(settings, report, importNotes = []) {
  const s = settings, n = report?.chosen?.native ?? {}, codes = codesOf(report), dims = dimensionOutcomes(report);
  const rows = [];
  const add = (cvar, old, result, status, reason) => rows.push({ cvar, old, result, status, reason });
  add('cl_crosshairsize', num(s.size), `length ${n.length}`, dims.length.status, dims.length.reason);
  add('cl_crosshairthickness', num(s.thickness), `thickness ${n.thickness}`, dims.thickness.status, dims.thickness.reason);
  add('cl_crosshairgap', num(s.gap), `gap ${n.gap}`, dims.gap.status, dims.gap.reason);
  const family = report?.options?.styleTarget ?? 'static', style = styleTarget(s, family);
  if (style !== 4) add('cl_crosshairstyle', String(s.style), `style ${style}`, 'assumed',
    'Experimental: kept in the old style family. Old styles drew like Static Cross at rest, ' +
    'but the new style moves with inaccuracy or shots; unverified.');
  else if ([2, 3, 5].includes(s.style)) add('cl_crosshairstyle', String(s.style), 'style 4', 'approximated',
    `Old style ${s.style} moved with movement or shots; Static Cross matches its at-rest shape (old source) but does not move.`);
  else add('cl_crosshairstyle', String(s.style), s.style === 4 ? 'style 4' : 'none', s.style === 4 ? 'converted' : 'dropped',
    s.style === 4 ? 'Static style is converted.' : 'Old styles 0 and 1 have no static equivalent.');
  add('cl_crosshairdot', s.dot ? 'on' : 'off', s.dot ? 'on' : 'off', 'converted', 'Copied as is.');
  add('cl_crosshair_t', s.t_style ? 'on' : 'off', s.t_style ? 'on' : 'off', 'converted', 'Copied as is.');
  const auto = outlineMode(s), choice = report?.options?.outlineMode ?? 'auto';
  const mode = effectiveOutlineMode(s, choice), byHand = choice !== 'auto';
  if (byHand) add('cl_crosshair_drawoutline', s.outline ? 'on' : 'off', `drawoutline ${mode}`, 'user-choice',
    `Chosen by hand; the old settings alone would give ${auto}. The new outline modes are not checked in game.`);
  else if (!s.outline) add('cl_crosshair_drawoutline', 'off', 'drawoutline 0', 'converted', 'No outline before, none now.');
  else if (mode === 0) add('cl_crosshair_drawoutline', 'on', 'drawoutline 0', 'approximated', 'Old width 0 drew no outline; turned off.');
  else add('cl_crosshair_drawoutline', 'on', `drawoutline ${mode}`, 'assumed',
    'The new outline modes (1 full, 2 half) are not checked in game.');
  if (s.outline || (byHand && mode)) {
    const width = num(s.outline_width ?? 1) + (codes.has('outline-sharecode-rounded') ? ' (rounded)' : '');
    const exact = mode === 1 && s.outline_width === 1;
    add('cl_crosshair_outlinethickness', s.outline ? width : 'off', mode ? `mode ${mode}` : 'none',
      byHand ? 'user-choice' : exact ? 'assumed' : 'approximated',
      byHand ? 'The outline mode was chosen by hand; the old width is not used.'
        : mode === 2 ? 'Widths below 1 become the half outline (top and left).'
        : mode === 1 && codes.has('outline-width-reduced')
          ? `Old width ${width} drew ${width} px on every side; the new outline is 1 px.`
        : mode === 1 ? 'The new outline is 1 px all round; the old width is not kept.' : 'No outline is drawn.');
    if (mode && codes.has('outline-alpha-unverified'))
      add('outline opacity', 'crosshair opacity', `outline_a ${s.alpha_enabled ? s.alpha : 200}`, 'assumed',
        'Old outline used the crosshair opacity; the new game may also multiply it.');
  }
  if (codes.has('color-index-unknown'))
    add('cl_crosshaircolor', `index ${s.color}, rgb ${s.rgb.join(' ')}`, 'colour r, g, b', 'approximated',
      `Index ${s.color} is not a game preset; the stored RGB is used.`);
  else add('cl_crosshaircolor', s.color === 5 ? `rgb ${s.rgb.join(' ')}` : `preset ${s.color}`, 'colour r, g, b', 'converted',
    'Copied as RGB.');
  const alpha = s.alpha_enabled ? s.alpha : 200;
  add('cl_crosshairalpha', s.alpha_enabled ? String(s.alpha) : 'off (200)', `a ${alpha}`, 'converted', 'Copied as is.');
  add('cl_crosshair_recoil', s.recoil ? 'on' : 'off', s.recoil ? 'on' : 'off', s.recoil ? 'assumed' : 'converted',
    s.recoil ? 'Copied, but recoil movement is not simulated.' : 'Static crosshair.');
  if (s.weapon_gap) add('cl_crosshairgap_useweaponvalue', 'on', 'none', 'dropped',
    'Weapon-dependent gap has no static equivalent; export is blocked.');
  add('cl_fixedcrosshairgap, split values', `gap ${num(s.fixed_gap)}`, 'none', 'dropped',
    'Only dynamic styles use them; the static crosshair does not.');
  const ignored = ignoredCvars(importNotes);
  if (ignored.length) add(`${ignored.length} other cvars`, 'listed', 'none', 'ignored', `Do not change the shape: ${ignored.join(', ')}.`);
  return rows;
}

/** Wording per label: exact-under-model matches the model's own target; modelled was rounded, clamped or
 * shifted by the model; assumed rests on a mapping nobody has checked in game. */
export const CONFIDENCE_LABELS = Object.freeze({ 'exact-under-model': 'exact under model', modelled: 'modelled', assumed: 'assumed' });

/** Per output value: assumed when the mapping itself is unverified (negative gap, any outline), modelled when
 * the model had to approximate it, exact-under-model otherwise. */
export function confidenceLabel(report) {
  const codes = codesOf(report), dims = dimensionOutcomes(report);
  const label = (key, assumedWhen) => assumedWhen ? 'assumed' : dims[key].status === 'converted' ? 'exact-under-model' : 'modelled';
  const outlined = effectiveOutlineMode(report.settings, report.options?.outlineMode) > 0 || codes.has('outline-zero-width');
  return { length: label('length', false), thickness: label('thickness', false),
    gap: label('gap', codes.has('negative-gap-static-unverified')), outline: outlined ? 'assumed' : 'exact-under-model' };
}
