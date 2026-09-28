/** Audit-only reader for four factual fields in saved v3/v4 converter responses.
 * Layout source: https://crosshair.club/static/js/crosshair.js?v=1790553505
 * No encoder, appearance decoding or runtime import support is provided.
 */
import { ALPHABET } from '../../lib/settings/sharecode.js';

export function externalNativeTuple(code) {
  if (typeof code !== 'string' || !/^CSGO(?:-[A-Za-z2-9]{5}){5}$/.test(code))
    throw new Error('Malformed external response code.');
  let value = 0n, place = 1n;
  for (const char of code.slice(5).replaceAll('-', '')) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new Error('Invalid external code alphabet.');
    value += BigInt(digit) * place; place *= BigInt(ALPHABET.length);
  }
  if (value >= 2n ** 144n) throw new Error('External code exceeds its envelope.');
  const bytes = Array.from({ length: 18 }, (_, i) => Number(value >> BigInt((17 - i) * 8) & 255n));
  const checksum = bytes.slice(1).reduce((sum, byte) => sum + byte, 0) % 256;
  if (bytes[0] !== checksum || ![3, 4].includes(bytes[1]))
    throw new Error('External code checksum or version mismatch.');
  return { length: bytes[8], thickness: (bytes[12] >> 7) + 2 * (bytes[13] & 15), gap: bytes[7],
    authoredHeight: bytes[14] + 256 * bytes[15] };
}
