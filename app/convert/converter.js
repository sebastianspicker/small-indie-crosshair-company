import { $ } from '../ui/dom.js';
import { ResearchWorker } from '../worker/client.js';
import { createView } from './view.js';
import { QuantController } from './controller.js';
import { loadQuantCorpus } from '../data.js';

export async function initQuant() {
  const [records, meta] = await loadQuantCorpus();
  const view = createView($('quant'), meta), worker = new ResearchWorker(records);
  try { await worker.ready; return new QuantController(view, worker, records, meta).start(); }
  catch (error) { worker.close(); throw error; }
}
