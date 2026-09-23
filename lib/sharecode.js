// Legacy v1 layout adapted from akiver/csgo-sharecode, MIT.
// Attribution and license: THIRD_PARTY_NOTICES.md, licenses/akiver-MIT.txt.
import { integer, finite, bool } from './validation.js';
export const ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';
const signed = b => b >= 128 ? b - 256 : b;
export function decodeLegacy(code) {
  if (typeof code !== 'string') throw new TypeError('Share code must be text.');
  code = code.trim();
  if (!/^CSGO(?:-[A-Za-z2-9]{5}){5}$/.test(code)) throw new Error('Expected CSGO- followed by five groups of five characters.');
  let n = 0n;
  for (const ch of [...code.slice(5).replaceAll('-', '')].reverse()) {
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) throw new Error(`Invalid share-code character: ${ch}.`);
    n = n * BigInt(ALPHABET.length) + BigInt(digit);
  }
  if (n >= 1n << 144n) throw new Error('Share code exceeds 18 bytes.');
  const bytes = new Array(18);
  for (let i = 17; i >= 0; i--) { bytes[i] = Number(n & 255n); n >>= 8n; }
  if (bytes[0] !== bytes.slice(1).reduce((a,b) => a+b, 0) % 256) throw new Error('Crosshair checksum mismatch.');
  if (bytes[1] !== 1) throw new Error(`Version ${bytes[1]} is not legacy v1. New-format share codes are intentionally unsupported.`);
  return {
    version: 1, size: bytes[14] / 10, thickness: bytes[12] / 10,
    gap: signed(bytes[2]) / 10, dot: !!(bytes[13] & 16), style: (bytes[13] & 15) >> 1,
    outline: !!(bytes[10] & 8), outline_width: bytes[3] / 2,
    alpha_enabled: !!(bytes[13] & 64), alpha: bytes[7], color: bytes[10] & 7,
    rgb: bytes.slice(4,7), weapon_gap: !!(bytes[13] & 32), recoil: !!(bytes[8] & 128),
    t_style: !!(bytes[13] & 128), fixed_gap: signed(bytes[9]) / 10,
    split_distance: bytes[8] & 7, inner_alpha: (bytes[10] >> 4) / 10,
    outer_alpha: (bytes[11] & 15) / 10, split_ratio: (bytes[11] >> 4) / 10,
    // Preserve undecoded/reserved bits for a lossless same-code re-encode.
    _bytes: bytes,
  };
}
function tick(v, mul, name, min, max) {
  finite(v, name, min, max);
  const scaled = v * mul;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-7) throw new Error(`${name} is not representable in a legacy share code.`);
  return Math.round(scaled);
}
export function encodeLegacy(c) {
  for (const key of ['dot','outline','recoil','weapon_gap','alpha_enabled','t_style']) bool(c[key],key);
  const bytes = c._bytes?.length === 18 ? [...c._bytes] : new Array(18).fill(0);
  bytes.forEach((v,i) => integer(v, `Byte ${i}`, 0,255));
  bytes[1] = 1;
  bytes[2] = tick(c.gap,10,'Gap',-12.8,12.7) & 255;
  bytes[3] = tick(c.outline_width,2,'Outline width',0,3);
  if (!Array.isArray(c.rgb) || c.rgb.length !== 3) throw new Error('RGB must contain three integers.');
  c.rgb.forEach((v,i) => bytes[4+i] = integer(v,'RGB',0,255));
  bytes[7] = integer(c.alpha,'Alpha',0,255);
  bytes[8] = (bytes[8] & 120) | integer(c.split_distance ?? 3,'Split distance',0,7) | (Number(c.recoil) << 7);
  bytes[9] = tick(c.fixed_gap ?? 3,10,'Fixed gap',-12.8,12.7) & 255;
  bytes[10] = integer(c.color,'Color',0,5) | (Number(c.outline) << 3) | (tick(c.inner_alpha ?? 0,10,'Inner alpha',0,1) << 4);
  bytes[11] = tick(c.outer_alpha ?? 1,10,'Outer alpha',0,1) | (tick(c.split_ratio ?? 1,10,'Split ratio',0,1) << 4);
  bytes[12] = tick(c.thickness,10,'Thickness',0,25.5);
  bytes[13] = (bytes[13] & 1) | (integer(c.style,'Style',0,7) << 1) | (Number(c.dot) << 4) |
    (Number(c.weapon_gap) << 5) | (Number(c.alpha_enabled) << 6) | (Number(c.t_style) << 7);
  bytes[14] = tick(c.size,10,'Size',0,25.5);
  bytes[0] = bytes.slice(1).reduce((a,b)=>a+b,0) % 256;
  let n = bytes.reduce((v,b) => (v << 8n) | BigInt(b),0n), out = '';
  for (let i=0;i<25;i++) { out += ALPHABET[Number(n % BigInt(ALPHABET.length))]; n /= BigInt(ALPHABET.length); }
  if (n !== 0n) throw new Error('Code exceeds the share-code envelope.');
  return 'CSGO-' + out.match(/.{5}/g).join('-');
}
