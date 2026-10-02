import { decimal } from './validation.js';
import { decodeLegacy } from './sharecode.js';
import { NEW_CVARS, NEW_CVARS_2000922, OUTLINE_COLOR_CVARS } from './cvars.js';
export const DEFAULT_SETTINGS = Object.freeze({...decodeLegacy('CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKO')});
/** Names introduced by the 2000914 update and extended on 2000922 (outline colour).
 * They are not legacy settings and must not be imported as one. */
const NEW_BUILD_NAMES = new Set([NEW_CVARS, NEW_CVARS_2000922, OUTLINE_COLOR_CVARS]
  .flatMap(group => Object.values(group)).map(cvar => cvar.name));
const NEW_BUILD_ERROR = 'New-build cvars cannot be imported as legacy settings. Paste the old cl_crosshairsize / thickness / gap block, or edit the proposed values.';
const FIELDS = {
  cl_crosshairsize:'size',cl_crosshairthickness:'thickness',cl_crosshairgap:'gap',
  cl_crosshairstyle:'style',cl_crosshairdot:'dot',cl_crosshair_t:'t_style',
  cl_crosshair_drawoutline:'outline',cl_crosshair_outlinethickness:'outline_width',
  cl_crosshair_recoil:'recoil',cl_crosshairgap_useweaponvalue:'weapon_gap',
  cl_crosshairalpha:'alpha',cl_crosshairusealpha:'alpha_enabled',cl_crosshaircolor:'color',
  cl_fixedcrosshairgap:'fixed_gap',cl_crosshair_dynamic_splitdist:'split_distance',
  cl_crosshair_dynamic_splitalpha_innermod:'inner_alpha',cl_crosshair_dynamic_splitalpha_outermod:'outer_alpha',
  cl_crosshair_dynamic_maxdist_splitratio:'split_ratio',cl_crosshaircolor_r:'r',cl_crosshaircolor_g:'g',cl_crosshaircolor_b:'b',
};
/** Legacy cvars (e.g. from a `find crosshair` dump) that never change the crosshair shape; noted and skipped. */
const IGNORED=new Set(['cl_grenadecrosshair_keepusercrosshair',
  ...['decoy','explosive','fire','flash','smoke'].flatMap(k=>['cl_grenadecrosshair_','cl_grenadecrosshairdelay_'].map(p=>p+k)),
  'cl_ironsight_usecrosshaircolor','cl_ironsight_dot_scale','cl_crosshair_friendly_warning',
  'cl_show_observer_crosshair','cl_sniper_show_inaccuracy','cl_crosshair_sniper_width',
  'cl_crosshair_sniper_show_normal_inaccuracy','cl_observed_bot_crosshair',
  'cl_teamid_overhead_fade_near_crosshair','cl_draw_only_deathnotices','crosshair']);
const NUM='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
// Only `crosshair` and `cl_*` names are statements this parser knows; anything else is rejected before any lookup.
const LITERAL=new RegExp(`^(crosshair|cl_[a-z_]+)\\s+(?:"(${NUM}|true|false)"|(${NUM}|true|false))$`);
const BOOL=new Set(['dot','t_style','outline','recoil','weapon_gap','alpha_enabled']);
/** Parse a tiny data-only allowlist. Reject binds, exec, arbitrary commands and expressions. */
export function parseLegacyCFG(input, base=DEFAULT_SETTINGS) {
  if(typeof input!=='string'||input.length>32768) throw new Error('Configuration must be at most 32 KiB of text.');
  const config={...base,rgb:[...base.rgb]},seen=new Set(),notes=[],ignored=[];
  const statements=input.split('\n').map(l=>l.split('//')[0]).join('\n').split(/[;\n]/);
  let count=0;
  for(const raw of statements) {
    const s=raw.trim(); if(!s)continue;
    const token=/^\s*(cl_[a-z_]+)/.exec(s)?.[1];
    if(token&&NEW_BUILD_NAMES.has(token)) throw new Error(NEW_BUILD_ERROR);
    const m=LITERAL.exec(s),word=m&&(m[2]??m[3]);
    if(m&&IGNORED.has(m[1])){ignored.push(m[1]);continue;}
    if(!m||!Object.hasOwn(FIELDS,m[1]))
      throw new Error('Only allowlisted legacy crosshair assignments are accepted; no executable console scripts.');
    const key=FIELDS[m[1]],v=word==='true'||word==='false'?+(word==='true'):decimal(word,key);
    if(seen.has(key)) notes.push(`Repeated ${m[1]}; last assignment used.`);
    seen.add(key);count++;
    if(word==='true'||word==='false'){if(!BOOL.has(key))throw new Error(`${m[1]} must be a number.`);}
    if(BOOL.has(key)) {if(v!==0&&v!==1)throw new Error(`${m[1]} must be 0 or 1.`);config[key]=!!v;}
    else if(['r','g','b'].includes(key)) config.rgb['rgb'.indexOf(key)]=v;
    else config[key]=v;
    if(key==='outline_width')config.outline_width_rounded=false;
  }
  if(!count)throw new Error('No crosshair assignments found.');
  if(ignored.length)notes.push(`Ignored ${ignored.length} cvar(s) that do not change the crosshair shape: ${ignored.join(', ')}.`);
  return {config,notes};
}
