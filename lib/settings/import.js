import { decodeLegacy } from './sharecode.js';
import { decodeCS, CurrentShareCodeError } from './sharecode-cs.js';
import { DEFAULT_SETTINGS, parseLegacyCFG } from './cfg.js';

/**
 * Dispatch pasted legacy text to the share-code or allowlisted-CFG parser, whichever it is.
 * @param {string} text - trimmed user input: a `CSGO-` share code or a legacy `.cfg` block.
 * @param {object} [base] - settings to merge unspecified CFG fields onto; defaults to DEFAULT_SETTINGS.
 * @returns {object} decoded/parsed legacy settings.
 * @throws {Error} if the text is neither a valid share code nor an allowlisted CFG block;
 *   a `CurrentShareCodeError` (`code: 'current-share-code'`, decoded `settings`) for a valid `CS…` code.
 */
export function parseLegacyText(text, base = DEFAULT_SETTINGS) {
  return parseLegacyTextWithNotes(text, base).config;
}

/** Like parseLegacyText, but also returns the parser notes (ignored or repeated cvars). */
export function parseLegacyTextWithNotes(text, base = DEFAULT_SETTINGS) {
  // A current `CS…` code already holds new settings; say so instead of converting.
  // Legacy codes are `CSGO-` plus dashes; a `CS` code's 44 characters may begin with "GO".
  if (text.startsWith('CSGO-')) return {config: decodeLegacy(text), notes: []};
  if (/^CS[A-Za-z0-9]+$/.test(text)) throw new CurrentShareCodeError(decodeCS(text));
  return parseLegacyCFG(text, base);
}
