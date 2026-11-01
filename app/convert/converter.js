import { $ } from '../ui/dom.js';
import { ResearchWorker } from '../worker/client.js';
import { createView } from './view.js';
import { QuantController } from './controller.js';
import { loadCorpusMeta, loadCorpusRecords, loadQuantSummary, loadCrossCheck } from '../data.js';
import { clearResult } from './presentation.js';

export async function initQuant() {
  // The page is drawn from the small files; the 1.4 MB corpus (default crosshair, presets, worker coverage) follows.
  const [meta, study, mlParams] = await Promise.all([loadCorpusMeta(), loadQuantSummary(), loadCrossCheck()]);
  const evidence = study?.evidence ? { ...study.evidence, mlParams } : null;
  const view = createView($('quant'), meta, evidence);
  clearResult(view, 'pending', 'Loading the crosshair corpus…');
  const records = await loadCorpusRecords(), worker = new ResearchWorker(records);
  try {
    await worker.ready;
    const controller = new QuantController(view, worker, records, meta, evidence).start();
    // Text pasted while the corpus loaded had no listener yet: import it now.
    if (view.get('qs-import').value.trim()) controller.importText();
    return controller;
  } catch (error) { worker.close(); throw error; }
}
