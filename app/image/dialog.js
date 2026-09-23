const SIDE = 129;
export class ImageDialog {
  constructor(view, bitmap, worker, context) {
    Object.assign(this, { view, bitmap, worker, context, seed: null, fit: null, rgba: null, token: 0, closed: false });
    this.listeners = new AbortController();
  }
  on(name, event, listener) { this.view[name].addEventListener(event, listener, { signal: this.listeners.signal }); }
  invalidate(message = 'Crop changed. Reanalyze before accepting.') {
    this.token++; this.fit = null; this.view.accept.disabled = true; this.view.status.textContent = message;
  }
  selection() {
    const { cx, cy, tolerance } = this.view, x = Number(cx.value), y = Number(cy.value), t = Number(tolerance.value);
    const { width, height } = this.context.dimensions;
    if (!cx.value || !cy.value || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height)
      throw new Error('Center must be inside the original image.');
    if (!tolerance.value || !Number.isFinite(t) || t < 1 || t > 120) throw new Error('RGB tolerance must be between 1 and 120.');
    return { center: [x, y], tolerance: t, seed: this.seed ? [...this.seed] : null };
  }
  draw(selection) {
    const crop = document.createElement('canvas'); crop.width = crop.height = SIDE;
    const ctx = crop.getContext('2d', { willReadFrequently: true });
    const [x, y] = selection.center;
    ctx.drawImage(this.bitmap, x - 64, y - 64, SIDE, SIDE, 0, 0, SIDE, SIDE);
    this.rgba = ctx.getImageData(0, 0, SIDE, SIDE).data;
    const enlarged = this.view.canvas.getContext('2d'); enlarged.imageSmoothingEnabled = false;
    enlarged.clearRect(0, 0, 387, 387); enlarged.drawImage(crop, 0, 0, 387, 387);
  }
  changed() {
    this.invalidate(); this.seed = null;
    try { this.draw(this.selection()); } catch (error) { this.rgba = null; this.view.status.textContent = error.message; }
  }
  async analyze() {
    this.invalidate('Analyzing the selected source pixels…'); const ticket = this.token;
    try {
      const selection = this.selection(); this.draw(selection);
      const operation = this.context.kind === 'new' ? 'native-screenshot' : 'screenshot';
      const result = await this.worker.call(operation, { data: this.rgba, side: SIDE,
        seed: selection.seed, tolerance: selection.tolerance, height: this.context.options?.oldHeight ?? 1080 });
      if (this.closed || ticket !== this.token) return;
      this.fit = result; this.measuredSelection = selection;
      const g = result.geometry;
      this.view.status.textContent = `Colored-mask agreement ${(result.templateIou * 100).toFixed(1)}% · length ${g.length} px · width ${g.width} px · near ${g.near} px. This is image-fit agreement, not native correctness confidence.`;
      this.updateAccept();
    } catch (error) { if (!this.closed && ticket === this.token) this.view.status.textContent = error.message; }
  }
  updateAccept() {
    this.view.accept.disabled = !this.fit || this.fit.templateIou < .75 || (this.context.kind === 'new' && !this.view.attested.checked);
  }
  pick(event) {
    if (!this.rgba) return;
    const r = this.view.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - r.left) * SIDE / r.width), y = Math.floor((event.clientY - r.top) * SIDE / r.height);
    if (x < 0 || y < 0 || x >= SIDE || y >= SIDE) return;
    const offset = (y * SIDE + x) * 4; this.seed = [...this.rgba.slice(offset, offset + 3)]; this.analyze();
  }
  accept() {
    if (this.closed || this.view.accept.disabled || !this.fit) return;
    try {
      this.context.onAccept({ fit: this.fit, meta: {
        captureSha256: this.context.captureSha256, dimensions: this.context.dimensions,
        ...this.measuredSelection, seed: this.measuredSelection.seed ?? this.fit.color, originalFileName: this.context.fileName },
        role: this.view.role.value, attested: this.view.attested.checked, captureGroup: this.view.session.value });
      this.view.dialog.close();
    } catch (error) { this.view.status.textContent = error.message; }
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.token++; this.listeners.abort(); this.bitmap.close(); this.view.dialog.remove();
    this.context.signal?.removeEventListener('abort', this.abortListener); this.resolveClose();
  }
  open() {
    const lifetime = new Promise(resolve => { this.resolveClose = resolve; });
    this.on('canvas', 'click', event => this.pick(event));
    for (const input of ['cx', 'cy', 'tolerance']) this.on(input, 'input', () => this.changed());
    this.on('auto', 'click', () => { this.seed = null; this.analyze(); });
    this.on('run', 'click', () => this.analyze()); this.on('attested', 'change', () => this.updateAccept());
    this.on('accept', 'click', () => this.accept()); this.on('cancel', 'click', () => this.view.dialog.close());
    this.on('dialog', 'close', () => this.close());
    this.abortListener = () => this.close(); this.context.signal?.addEventListener('abort', this.abortListener, { once: true });
    if (this.context.signal?.aborted) { this.close(); return lifetime; }
    document.body.append(this.view.dialog);
    try { this.view.dialog.showModal(); this.analyze(); }
    catch (error) { this.close(); throw error; }
    return lifetime;
  }
}
