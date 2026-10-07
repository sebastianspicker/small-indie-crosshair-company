import { $, el } from './ui/dom.js';
import { loadPresets } from './data.js';
import { parseRoute, ROUTES } from './ui/route.js';

const pending = new Map();
let quant, active = 'quant', sequence = 0;

async function initialize(name) {
  if (pending.has(name)) return pending.get(name);
  const task = (async () => {
    if (name === 'quant') quant = await (await import('./convert/converter.js')).initQuant();
    if (name === 'screenshot') await (await import('./pages/screenshot.js')).initScreenshot();
    if (name === 'corpus') await (await import('./pages/corpus.js')).initCorpus();
    if (name === 'evidence') (await import('./pages/evidence.js')).initEvidence(await loadPresets());
  })();
  pending.set(name, task);
  return task;
}

async function route() {
  const ticket = ++sequence;
  const target = parseRoute(location.hash);
  // The old Mathematics page is the static notebook now; replace, so Back does not return to the dead hash.
  if (target.external) { location.replace(target.external); return; }
  active = target.name;
  // A removed page's link, or a hand-off query, is shown once and then dropped from the address (nothing is stored).
  if (target.redirected || location.hash.includes('?')) history.replaceState(null, '', `#${active}`);
  for (const id of ROUTES) $(id).hidden = id !== active;
  document.querySelectorAll('[data-route]').forEach(a => {
    if (a.dataset.route === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    await initialize(active);
    if (ticket !== sequence) return;
    if (active === 'quant' && (target.paste !== null || target.error)) quant.applyRoute(target);
    $('boot-error').hidden = true;
    document.documentElement.dataset.ready = 'true';
    requestAnimationFrame(() => {
      if (active === 'quant') quant?.refresh();
    });
  } catch (error) {
    $('boot-error').hidden = false;
    $('boot-error').replaceChildren(
      el('h2', {}, 'The converter could not start.'),
      el('p', {}, error.message),
      el('p', {}, 'Serve the files over HTTP(S). The converter uses a web worker; allow worker-src self. ' +
        'Other navigation links remain available.'),
    );
  }
}

window.addEventListener('hashchange', route);
route();
