/** Single place that fetches bundled runtime data and published Markdown, relative to this module. */
import { documentPath } from './ui/document-links.js';

const url = name => new URL('../data/' + name, import.meta.url);

export async function loadDocument(path) {
  if (!documentPath(path)) throw new Error('That document path is not public Markdown.');
  const response = await fetch(new URL('../' + path, import.meta.url));
  if (!response.ok) throw new Error(`The document could not load (${response.status}).`);
  return response.text();
}

/** One failure message for a network error, a bad status and unparseable JSON alike, naming the file. */
async function fetchJSON(name, errorMessage) {
  const failure = cause => new Error(`${errorMessage.replace(/\.$/, '')} (${name}).`, { cause });
  let response;
  try { response = await fetch(url(name)); } catch (error) { throw failure(error); }
  if (!response.ok) throw failure(new Error(`HTTP ${response.status}`));
  try { return await response.json(); } catch (error) { throw failure(error); }
}

let presetsPromise;
/** Bundled crosshair presets. Memoized so every route sharing them issues one fetch. */
export function loadPresets() {
  if (!presetsPromise) presetsPromise = fetchJSON('presets.json', 'Bundled presets could not load.')
    .catch(error => { presetsPromise = undefined; throw error; });
  return presetsPromise;
}

/** Corpus metadata only (about 10 KB): enough for the converter page to be drawn before the records arrive. */
export const loadCorpusMeta = () => fetchJSON('corpus-meta.json', 'Bundled research data could not load.');

let recordsPromise;
/** Corpus records only: all the Screenshot page's worker needs for geometry coverage. Memoized: the file is 1.4 MB. */
export function loadCorpusRecords() {
  if (!recordsPromise) recordsPromise = fetchJSON('corpus.json', 'Bundled research data could not load.')
    .catch(error => { recordsPromise = undefined; throw error; });
  return recordsPromise;
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
  return Promise.all([loadCorpusRecords(), ...['corpus-meta.json', 'quant-summary.json', 'pro-conversions.json']
    .map(name => fetchJSON(name, 'Research data unavailable.'))]);
}
