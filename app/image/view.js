import { el } from '../ui/dom.js';
const field = (name, node) => el('div', {}, el('label', {}, name, node));
export function imageView(kind, dimensions, native, options) {
  const dialog = el('dialog', { class: 'image-dialog', 'aria-labelledby': 'image-dialog-title' });
  const canvas = el('canvas', { class: 'image-inspect', width: 387, height: 387, 'aria-label': 'Enlarged source crop; click a line to select its color', tabindex: 0 });
  const cx = el('input', { type: 'number', value: Math.floor(dimensions.width / 2), min: 0, max: dimensions.width - 1 });
  const cy = el('input', { type: 'number', value: Math.floor(dimensions.height / 2), min: 0, max: dimensions.height - 1 });
  const tolerance = el('input', { type: 'number', value: 40, min: 1, max: 120 });
  const auto = el('button', { class: 'button secondary' }, 'Auto color');
  const run = el('button', { class: 'button secondary' }, 'Reanalyze crop');
  const accept = el('button', { class: 'button primary', disabled: true }, kind === 'old' ? 'Use measured old target' : 'Record native measurement');
  const cancel = el('button', { class: 'button ghost' }, 'Cancel');
  const role = el('select', {}, el('option', { value: 'calibration' }, 'Calibration — updates models'), el('option', { value: 'holdout' }, 'Holdout — evaluation only'));
  const attested = el('input', { type: 'checkbox' });
  const session = el('input', { type: 'text', value: 'user-session', maxlength: 128 });
  const status = el('p', { role: 'status', class: 'small' });
  dialog.append(el('div', { class: 'section-heading' }, el('h2', { id: 'image-dialog-title' }, kind === 'old' ? 'Read the old pixels' : 'Test the new renderer'), cancel),
    el('p', {}, 'Original PNG only. Inspect source pixels, select a line color, then analyze. Editing the crop invalidates its previous result.'),
    el('p', { class: 'small' }, `${dimensions.width} × ${dimensions.height} image · original cvars and alpha are not uniquely recoverable.`), canvas,
    el('div', { class: 'input-grid triple' }, field('Center X', cx), field('Center Y', cy), field('RGB tolerance', tolerance)),
    el('div', { class: 'export-actions' }, auto, run), status);
  if (kind === 'new') dialog.append(
    el('p', { class: 'small' }, `Declare that this capture used length ${native.length}, thickness ${native.thickness}, gap ${native.gap}, authored height ${native.authoredHeight}, current height ${options.currentHeight}. Import measurement JSON for other settings.`),
    field('Independent capture/session group', session), field('Evidence role', role),
    el('label', { class: 'check' }, attested, 'I confirm this is a native CS2 build 2000914 capture using the displayed settings, not a generated preview.'));
  dialog.append(accept, el('p', { class: 'small' }, 'Files stay in this tab. Images are not uploaded.'));
  return { dialog, canvas, cx, cy, tolerance, auto, run, accept, cancel, role, attested, session, status };
}
