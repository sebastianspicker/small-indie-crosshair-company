import { decodeLegacy } from './sharecode.js';
import { DEFAULT_SETTINGS, parseLegacyCFG } from './cfg.js';

/**
 * Dispatch pasted legacy text to the share-code or allowlisted-CFG parser, whichever it is.
 * @param {string} text - trimmed user input: a `CSGO-` share code or a legacy `.cfg` block.
 * @param {object} [base] - settings to merge unspecified CFG fields onto; defaults to DEFAULT_SETTINGS.
 * @returns {object} decoded/parsed legacy settings.
 * @throws {Error} if the text is neither a valid share code nor an allowlisted CFG block.
 */
export function parseLegacyText(text, base = DEFAULT_SETTINGS) {
  return text.startsWith('CSGO-') ? decodeLegacy(text) : parseLegacyCFG(text, base).config;
}
