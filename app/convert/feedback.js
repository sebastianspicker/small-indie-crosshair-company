import { imageInput } from '../image/input.js';
import { download } from '../ui/dom.js';
import { validateMeasurements } from '../../lib/solver/observations.js';
import { BUILD } from '../../lib/solver/renderer.js';
import { mergedExportOverrides } from '../../lib/solver/export.js';

/** Capture the proposed flags from this report, including T flips applied to reproduce crossed old shapes. */
export function nativeCaptureFlags(report) {
  const overrides = mergedExportOverrides(report);
  return { dot: report.settings.dot, t_style: overrides.t_style ?? report.settings.t_style,
    bars: report.converted.length > 0 && report.converted.width > 0 };
}

function acceptNative(c, n, o, { fit, meta, role, attested, captureGroup }) {
  if (!fit.quality?.acceptable) throw new Error('Stable uncropped image measurements are required.');
  const build = o.targetBuild ?? BUILD;
  const observation = { id: meta.captureSha256.slice(0, 24), kind: 'native-user', role, attested, build,
    captureGroup, captureSha256: meta.captureSha256, native: n, currentHeight: o.currentHeight, observed: fit.geometry, sigma: .5 };
  c.state.measurements = validateMeasurements([...c.state.measurements, observation], null);
  c.get('q-evidence-status').textContent = `Recorded your ${role} capture for this session.`;
  c.schedule();
}

async function openImage(c) {
  const status = c.get('q-evidence-status');
  if (c.imageOpen) { status.textContent = 'Finish the open image dialog first.'; return; }
  c.imageOpen = true;
  try {
    const r = c.state.result;
    if (!r) throw new Error('Wait for a valid current candidate before recording native evidence.');
    const options = { ...r.options, targetBuild: r.targetBuild }, native = { ...r.chosen.native };
    await imageInput(c.get('q-new-image').files[0], c.worker, { kind: 'new', options, native, signal: c.listeners.signal,
      expectedFlags: nativeCaptureFlags(r), onAccept: data => acceptNative(c, native, options, data) });
  } catch (error) { status.textContent = error.message; }
  finally { c.get('q-new-image').value = ''; c.imageOpen = false; }
}

async function loadEvidence(c) {
  try {
    const file = c.get('q-measurements').files[0];
    if (!file) throw new Error('Choose an evidence JSON file.');
    if (file.size > 1024 * 1024) throw new Error('Evidence JSON must be below 1 MB.');
    const parsed = JSON.parse(await file.text());
    c.state.measurements = validateMeasurements(parsed, null);
    c.get('q-evidence-status').textContent = `Loaded ${parsed.length} measurements. Generated examples do not change the model weights.`;
    c.schedule();
  } catch (error) { c.get('q-evidence-status').textContent = error.message; }
  finally { c.get('q-measurements').value = ''; }
}

export function bindFeedback(c) {
  c.on('q-new-image', 'change', () => openImage(c));
  c.on('q-measurements', 'change', () => loadEvidence(c));
  c.on('q-export-measurements', 'click', () => download('native-measurements.json', JSON.stringify(c.state.measurements, null, 2)));
  c.on('q-clear-measurements', 'click', () => { c.state.measurements = []; c.get('q-evidence-status').textContent = 'Session measurements cleared. Original model weights restored.'; c.schedule(); });
}
