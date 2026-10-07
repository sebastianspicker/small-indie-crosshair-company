// Hash routes: `#name` or `#name?key=value`. The query carries a hand-off between pages (never stored, ADR-0004).

export const ROUTES = Object.freeze(['quant', 'screenshot', 'corpus', 'evidence']);
/** Pages that were removed; their old links open the page that replaced them. */
export const REDIRECTS = Object.freeze({ workbench: 'screenshot', calibration: 'screenshot' });
/** Hash names that now live outside the app: the Mathematics page is the static notebook. */
export const EXTERNAL = Object.freeze({ research: './docs/notebook.html' });
/** Longest pasted settings text accepted from a link, in characters. */
export const MAX_PASTE = 4096;
const MAX_HASH = 16384;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const heightParam = value => {
  const height = /^\d{3,5}$/.test(value ?? '') ? Number(value) : NaN;
  return height >= 240 && height <= 16384 ? height : null;
};

/** `{ name, redirected, paste, oldHeight, newHeight, error, external }` for a location hash; an unknown name is the converter.
 * `external` is the address that replaces an old in-app page (`#research` → the notebook).
 * `paste` is plain text of at most MAX_PASTE characters without control characters; heights are whole 240 to 16384. */
export function parseRoute(hash) {
  const raw = String(hash ?? '').replace(/^#/, ''), cut = raw.indexOf('?'), requested = cut < 0 ? raw : raw.slice(0, cut);
  const name = REDIRECTS[requested] ?? (ROUTES.includes(requested) ? requested : 'quant');
  const route = { name, redirected: requested in REDIRECTS, paste: null, oldHeight: null, newHeight: null, error: null,
    external: Object.hasOwn(EXTERNAL, requested) ? EXTERNAL[requested] : null };
  if (cut < 0 || name !== 'quant') return route;
  if (raw.length > MAX_HASH) return { ...route, error: 'The link is too long to open.' };
  const query = new URLSearchParams(raw.slice(cut + 1)), paste = query.get('paste');
  if (paste === null) return route;
  if (paste.length > MAX_PASTE)
    return { ...route, error: `The link carries more than ${MAX_PASTE} characters of settings; nothing was loaded.` };
  if (CONTROL.test(paste)) return { ...route, error: 'The link carries characters that are not text; nothing was loaded.' };
  return { ...route, paste, oldHeight: heightParam(query.get('oh')), newHeight: heightParam(query.get('nh')) };
}

/** The link from the screenshot page to the converter: the old settings as commands, plus both heights when known. */
export function converterLink(text, oldHeight, newHeight) {
  return `#quant?paste=${encodeURIComponent(text)}${oldHeight ? `&oh=${oldHeight}` : ''}${newHeight ? `&nh=${newHeight}` : ''}`;
}
