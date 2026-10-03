import { $ } from '../ui/dom.js';
import { ResearchWorker } from '../worker/client.js';
import { createView } from './view.js';
import { QuantController } from './controller.js';
import { loadQuantCorpus, loadCrossCheck } from '../data.js';

export async function initQuant() {
  const [[records, meta, study], mlParams] = await Promise.all([loadQuantCorpus(), loadCrossCheck()]);
  const view = createView($('quant'), meta), worker = new ResearchWorker(records);
  const evidence = study?.evidence ? { ...study.evidence, mlParams } : null;
  try { await worker.ready; return new QuantController(view, worker, records, meta, evidence).start(); }
  catch (error) { worker.close(); throw error; }
}
