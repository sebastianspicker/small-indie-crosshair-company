import { infer } from '../lib/quant/inference.js';
import { posterior } from '../lib/quant/evidence.js';
import { discriminatingSet } from '../lib/quant/experiments.js';
import { analyzeScreenshot, analyzeNativeScreenshot } from '../lib/quant/screenshot.js';
let records = null;
const operations = {
  init(payload) {
    if (records !== null) throw new Error('Research corpus already initialized.');
    if (!Array.isArray(payload) || payload.length > 10000) throw new Error('Corpus too large.');
    records = payload;
    return { ready: true };
  },
  infer(payload) { return infer({ ...payload, records }); },
  discriminating(payload) {
    const state = posterior(payload?.measurements ?? []);
    return discriminatingSet({ state, size: 4 });
  },
  screenshot: analyzeScreenshot,
  'native-screenshot': analyzeNativeScreenshot,
};
self.onmessage = ({ data }) => {
  const id = data?.id;
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid worker request identifier.');
    if (!Object.hasOwn(operations, data.type)) throw new Error('Unknown worker operation.');
    if (data.type !== 'init' && records === null) throw new Error('Research worker not initialized.');
    const result = operations[data.type](data.payload);
    self.postMessage({ id, result }, result.mask ? [result.mask.data.buffer] : []);
  } catch (error) { self.postMessage({ id, error: String(error.message).slice(0, 500) }); }
};
