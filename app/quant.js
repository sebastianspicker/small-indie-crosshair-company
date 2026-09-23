import { $ } from './dom.js';
import { ResearchWorker } from './worker-client.js';
import { createView } from './quant/view.js';
import { QuantController } from './quant/controller.js';

async function loadJSON(name) {
  const response = await fetch(new URL('../data/' + name, import.meta.url));
  if (!response.ok) throw new Error('Bundled research data could not load.');
  return response.json();
}

export async function initQuant() {
  const [records, meta] = await Promise.all(['corpus.json', 'corpus-meta.json'].map(loadJSON));
  const view = createView($('quant'), meta), worker = new ResearchWorker(records);
  try { await worker.ready; return new QuantController(view, worker, records, meta).start(); }
  catch (error) { worker.close(); throw error; }
}
