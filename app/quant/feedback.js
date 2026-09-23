import { imageInput } from '../image-input.js';
import { download } from '../dom.js';
import { validateMeasurements } from '../../lib/quant/observations.js';
import { BUILD } from '../../lib/quant/renderer.js';

function acceptOld(c, { fit, meta }) {
  c.setSettings({ ...c.state.settings, ...fit.representative, dot: fit.flags.dot, t_style: fit.flags.t_style,
    style: 4, weapon_gap: false, outline: false, color: 5, rgb: fit.color, alpha: 255, alpha_enabled: true });
  Object.assign(c.state, { targetOverride: fit.geometry, targetMask: fit.mask,
    screenshotMeta: { ...meta, buckets: fit.buckets, templateIou: fit.templateIou, declaredOldHeight: c.options().oldHeight }, source: { type: 'image' } });
  c.get('q-import').value = '';
  c.get('q-input-status').textContent = 'Image measured. Several old settings may produce the same pixels.';
  c.schedule();
}

function acceptNative(c, n, o, { fit, meta, role, attested, captureGroup }) {
  const observation = { id: meta.captureSha256.slice(0, 24), kind: 'native-user', role, attested, build: BUILD,
    captureGroup, captureSha256: meta.captureSha256, native: n, currentHeight: o.currentHeight, observed: fit.geometry, sigma: .5 };
  c.state.measurements = validateMeasurements([...c.state.measurements, observation]);
  c.get('q-evidence-status').textContent = `Recorded your ${role} capture for this session.`;
  c.schedule();
}

async function openImage(c, kind) {
  const id = kind === 'old' ? 'q-old-image' : 'q-new-image', status = c.get(kind === 'old' ? 'q-input-status' : 'q-evidence-status');
  if (c.imageOpen) { status.textContent = 'Finish the open image dialog first.'; return; }
  c.imageOpen = true;
  try {
    const r = c.state.result;
    if (kind === 'new' && !r) throw new Error('Wait for a valid current candidate before recording native evidence.');
    const options = kind === 'old' ? c.options() : { ...r.options }, native = r ? { ...r.chosen.native } : null;
    await imageInput(c.get(id).files[0], c.worker, { kind, options, native, signal: c.listeners.signal,
      onAccept: kind === 'old' ? data => acceptOld(c, data) : data => acceptNative(c, native, options, data) });
  } catch (error) { status.textContent = error.message; }
  finally { c.get(id).value = ''; c.imageOpen = false; }
}

async function loadEvidence(c) {
  try {
    const file = c.get('q-measurements').files[0];
    if (!file || file.size > 1024 * 1024) throw new Error('Evidence JSON must be below 1 MB.');
    const parsed = JSON.parse(await file.text());
    c.state.measurements = validateMeasurements(parsed);
    c.get('q-evidence-status').textContent = `Loaded ${parsed.length} measurements. Generated examples do not change the model weights.`;
    c.schedule();
  } catch (error) { c.get('q-evidence-status').textContent = error.message; }
  finally { c.get('q-measurements').value = ''; }
}

export function bindFeedback(c) {
  c.on('q-old-image', 'change', () => openImage(c, 'old')); c.on('q-new-image', 'change', () => openImage(c, 'new'));
  c.on('q-measurements', 'change', () => loadEvidence(c));
  c.on('q-export-measurements', 'click', () => download('native-measurements.json', JSON.stringify(c.state.measurements, null, 2)));
  c.on('q-clear-measurements', 'click', () => { c.state.measurements = []; c.get('q-evidence-status').textContent = 'Session measurements cleared. Original model weights restored.'; c.schedule(); });
}
