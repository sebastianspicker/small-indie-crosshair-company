import { decimal } from './validation.js';
import { decodeLegacy } from './sharecode.js';
export const DEFAULT_SETTINGS = Object.freeze({...decodeLegacy('CSGO-aNQn2-upV5w-M8dOd-OOwcf-2pFKO')});
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
const BOOL=new Set(['dot','t_style','outline','recoil','weapon_gap','alpha_enabled']);
/** Parse a tiny data-only allowlist. Reject binds, exec, arbitrary commands and expressions. */
export function parseLegacyCFG(input, base=DEFAULT_SETTINGS) {
  if(typeof input!=='string'||input.length>32768) throw new Error('Configuration must be at most 32 KiB of text.');
  const config={...base,rgb:[...base.rgb]},seen=new Set(),notes=[];
  const statements=input.split('\n').map(l=>l.split('//')[0]).join('\n').split(/[;\n]/);
  let count=0;
  for(const raw of statements) {
    const s=raw.trim(); if(!s)continue;
    const m=/^(cl_[a-z_]+)\s+(?:"([+-]?(?:\d+(?:\.\d*)?|\.\d+))"|([+-]?(?:\d+(?:\.\d*)?|\.\d+)))$/.exec(s);
    if(!m||!FIELDS[m[1]]) throw new Error('Only allowlisted legacy crosshair assignments are accepted; no executable console scripts.');
    const key=FIELDS[m[1]],v=decimal(m[2]??m[3],key);
    if(seen.has(key)) notes.push(`Repeated ${m[1]}; last assignment used.`);
    seen.add(key);count++;
    if(BOOL.has(key)) {if(v!==0&&v!==1)throw new Error(`${m[1]} must be 0 or 1.`);config[key]=!!v;}
    else if(['r','g','b'].includes(key)) config.rgb['rgb'.indexOf(key)]=v;
    else config[key]=v;
  }
  if(!count)throw new Error('No crosshair assignments found.');
  return {config,notes};
}
