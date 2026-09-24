import { $, el } from './ui/dom.js';
import { setMode, initMode } from './ui/mode.js';
import { loadPresets } from './data.js';

const routes = ['quant', 'corpus', 'research', 'workbench', 'calibration', 'evidence'];
const expertRoutes = routes.filter(id => id !== 'quant');
const pending = new Map();
let editor, quant, active = 'quant', sequence = 0;

async function editorReady() {
  if (!pending.has('editor')) {
    pending.set('editor', (async () => {
      const presets = await loadPresets();
      const { initEditor } = await import('./manual/editor.js');
      editor = initEditor(presets);
      return { editor, presets };
    })());
  }
  return pending.get('editor');
}

async function initialize(name) {
  if (pending.has(name)) return pending.get(name);
  const task = (async () => {
    if (name === 'quant') quant = await (await import('./convert/converter.js')).initQuant();
    if (name === 'corpus') await (await import('./pages/corpus.js')).initCorpus();
    if (name === 'research') (await import('./pages/research.js')).initResearch();
    if (name === 'workbench') await editorReady();
    if (name === 'calibration') (await import('./manual/calibration.js')).initCalibration((await editorReady()).editor);
    if (name === 'evidence') (await import('./pages/evidence.js')).initEvidence(await loadPresets());
  })();
  pending.set(name, task);
  return task;
}

function onModeChange(mode) {
  if (mode === 'simple' && expertRoutes.includes(active)) {
    location.hash = '#quant';
    return;
  }
  if (active === 'quant') quant?.refresh();
}

initMode(onModeChange);

async function route() {
  const ticket = ++sequence;
  const requested = location.hash.slice(1);
  active = routes.includes(requested) ? requested : 'quant';
  if (expertRoutes.includes(active)) setMode('expert');
  for (const id of routes) $(id).hidden = id !== active;
  document.querySelectorAll('[data-route]').forEach(a => {
    if (a.dataset.route === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    await initialize(active);
    if (ticket !== sequence) return;
    $('boot-error').hidden = true;
    document.documentElement.dataset.ready = 'true';
    requestAnimationFrame(() => {
      if (active === 'workbench') editor?.refresh();
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
