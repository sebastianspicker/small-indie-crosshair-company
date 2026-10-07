/** Single place that fetches bundled runtime data (data/*.json), relative to this module. */

const url = name => new URL('../data/' + name, import.meta.url);

async function fetchJSON(name, errorMessage) {
  const response = await fetch(url(name));
  if (!response.ok) throw new Error(errorMessage);
  return response.json();
}

let presetsPromise;
/** Bundled crosshair presets. Memoized so every route sharing them issues one fetch. */
export function loadPresets() {
  if (!presetsPromise) presetsPromise = fetchJSON('presets.json', 'Bundled presets could not load.');
  return presetsPromise;
}

/** Corpus records, metadata and study summary (its `evidence` feeds the confidence panel), for the converter (#quant). */
export function loadQuantCorpus() {
  const load = name => fetchJSON(name, 'Bundled research data could not load.');
  // The summary only feeds the confidence panel; the converter still works without it.
  return Promise.all([load('corpus.json'), load('corpus-meta.json'), load('quant-summary.json').catch(() => null)]);
}

let summaryPromise;
/** The quant study summary (its `learners` feed the research page), or null when it cannot load. */
export function loadQuantSummary() {
  if (!summaryPromise) summaryPromise = fetchJSON('quant-summary.json', 'Research summary could not load.').catch(() => null);
  return summaryPromise;
}

let crossCheckPromise;
/** Parameters of the per-input ML cross-check, or null when they cannot load: the converter works without them. */
export function loadCrossCheck() {
  if (!crossCheckPromise) crossCheckPromise = fetchJSON('ml-crosscheck.json', 'ML cross-check parameters could not load.')
    .catch(() => null);
  return crossCheckPromise;
}

/** Corpus records, metadata and the quant study summary, as used by the corpus page (#corpus). */
export function loadCorpusPage() {
  return Promise.all(['corpus.json', 'corpus-meta.json', 'quant-summary.json'].map(name => fetchJSON(name, 'Research data unavailable.')));
}
