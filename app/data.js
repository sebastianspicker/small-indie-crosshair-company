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

/** Corpus records and metadata, as used by the automatic converter (#quant). */
export function loadQuantCorpus() {
  return Promise.all(['corpus.json', 'corpus-meta.json'].map(name => fetchJSON(name, 'Bundled research data could not load.')));
}

/** Corpus records, metadata and the quant study summary, as used by the corpus page (#corpus). */
export function loadCorpusPage() {
  return Promise.all(['corpus.json', 'corpus-meta.json', 'quant-summary.json'].map(name => fetchJSON(name, 'Research data unavailable.')));
}
