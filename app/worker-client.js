/** Bounded serial transport. Only the newest queued conversion is worth computing. */
export class ResearchWorker {
  constructor(records, { factory = () => new Worker(new URL('./quant-worker.js', import.meta.url), { type: 'module' }), deadline = 30000 } = {}) {
    this.seq = 0; this.queue = []; this.active = null; this.closed = false; this.deadline = deadline;
    this.worker = factory();
    this.worker.onmessage = event => this.receive(event.data);
    this.worker.onerror = () => this.abort('Research worker failed. Reload to restart.');
    this.worker.onmessageerror = () => this.abort('Worker response could not be decoded. Reload to restart.');
    this.ready = this.call('init', records);
  }

  call(type, payload, transfer = []) {
    if (this.closed) return Promise.reject(new Error('Research worker is closed. Reload to restart.'));
    if (!['init', 'infer', 'screenshot', 'native-screenshot'].includes(type)) return Promise.reject(new Error('Unknown worker operation.'));
    if (type === 'infer') this.discardQueuedInference();
    if (this.queue.length >= 8) return Promise.reject(new Error('Worker queue is full; finish the current image analysis first.'));
    return new Promise((resolve, reject) => {
      const task = { id: ++this.seq, type, payload, transfer, resolve, reject };
      task.timer = setTimeout(() => this.abort('Bounded worker deadline reached; no result accepted. Reload to restart.'), this.deadline);
      this.queue.push(task); this.pump();
    });
  }

  discardQueuedInference() {
    const next = [];
    for (const task of this.queue) {
      if (task.type !== 'infer') { next.push(task); continue; }
      clearTimeout(task.timer); task.reject(new DOMException('Superseded by newer conversion input.', 'AbortError'));
    }
    this.queue = next;
  }

  pump() {
    if (this.active || this.closed || !this.queue.length) return;
    this.active = this.queue.shift();
    const { id, type, payload, transfer } = this.active;
    try { this.worker.postMessage({ id, type, payload }, transfer); }
    catch (error) { this.settle(error); }
  }

  receive(message) {
    if (this.closed) return;
    if (!message || message.id !== this.active?.id || typeof message.id !== 'number') {
      this.abort('Unexpected worker response; no result accepted.'); return;
    }
    this.settle(message.error ? new Error(String(message.error).slice(0, 500)) : null, message.result);
  }

  settle(error, result) {
    const task = this.active; this.active = null;
    if (!task) return;
    clearTimeout(task.timer); error ? task.reject(error) : task.resolve(result);
    this.pump();
  }

  abort(message) {
    if (this.closed) return;
    this.closed = true; this.worker.terminate();
    const tasks = this.active ? [this.active, ...this.queue] : this.queue;
    this.active = null; this.queue = [];
    for (const task of tasks) { clearTimeout(task.timer); task.reject(new Error(message)); }
  }
  close() { this.abort('Research worker closed.'); }
}
