import { $, el } from './ui/dom.js';
import { loadPresets } from './data.js';
import { parseRoute, ROUTES } from './ui/route.js';

const pending = new Map();
const FAILED = { quant: 'The converter could not start.', screenshot: 'The screenshot page could not start.',
  corpus: 'The Settings data page could not start.', evidence: 'The evidence page could not start.' };
let quant, active = 'quant', sequence = 0, handoff = null;

async function initialize(name) {
  if (pending.has(name)) return pending.get(name);
  const task = (async () => {
    if (name === 'quant') quant = await (await import('./convert/converter.js')).initQuant();
    if (name === 'screenshot') await (await import('./pages/screenshot.js')).initScreenshot();
    if (name === 'corpus') await (await import('./pages/corpus.js')).initCorpus();
    if (name === 'evidence') (await import('./pages/evidence.js')).initEvidence(await loadPresets());
  })();
  // A failed start is not remembered: the next navigation to the page tries again.
  task.catch(() => pending.delete(name));
  pending.set(name, task);
  return task;
}

async function route() {
  const ticket = ++sequence;
  const target = parseRoute(location.hash);
  // The old Mathematics page is the static notebook now; replace, so Back does not return to the dead hash.
  if (target.external) { location.replace(target.external); return; }
  active = target.name;
  // A converter hand-off (#quant?paste=…) waits until the converter has started, even if another page is opened meanwhile:
  // the query is dropped from the address below, so this is its only copy.
  if (target.name === 'quant' && (target.paste !== null || target.error)) handoff = target;
  // A removed page's link, or a hand-off query, is shown once and then dropped from the address (nothing is stored).
  if (target.redirected || location.hash.includes('?')) history.replaceState(null, '', `#${active}`);
  for (const id of ROUTES) $(id).hidden = id !== active;
  document.querySelectorAll('[data-route]').forEach(a => {
    if (a.dataset.route === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    await initialize(target.name);
    if (target.name === 'quant' && handoff && quant) { const pendingHandoff = handoff; handoff = null; quant.applyRoute(pendingHandoff); }
    if (ticket !== sequence) return;
    $('boot-error').hidden = true;
    document.documentElement.dataset.ready = 'true';
    requestAnimationFrame(() => {
      if (active === 'quant') quant?.refresh();
    });
  } catch (error) {
    // A page that failed part-way is already rendered but has no listeners: show the error in its place.
    if (ticket === sequence) $(target.name).hidden = true;
    $('boot-error').hidden = false;
    $('boot-error').replaceChildren(
      el('h2', {}, FAILED[target.name]),
      el('p', {}, error.message),
      el('p', {}, 'Serve the files over HTTP(S). The converter uses a web worker; allow worker-src self. ' +
        'Other navigation links remain available.'),
    );
  }
}

window.addEventListener('hashchange', route);
route();
