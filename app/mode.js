import { $ } from './dom.js';

export const MODES = ['simple', 'expert'];

export function currentMode() {
  const stored = document.documentElement.dataset.mode;
  return MODES.includes(stored) ? stored : 'simple';
}

function updateToggle(mode) {
  const button = $('mode-toggle');
  if (!button) return;
  const simple = mode === 'simple';
  const label = simple ? 'Show the full expert lab' : 'Switch back to the simple view';
  button.setAttribute('aria-pressed', String(!simple));
  button.textContent = simple ? 'Advanced' : 'Simple';
  button.title = label;
  button.setAttribute('aria-label', label);
}

export function setMode(mode, { focus = false } = {}) {
  if (!MODES.includes(mode)) return currentMode();
  document.documentElement.dataset.mode = mode;
  updateToggle(mode);
  window.dispatchEvent(new CustomEvent('sicc:modechange', { detail: { mode } }));
  if (focus) $('mode-toggle')?.focus();
  return mode;
}

export function toggleMode(options) {
  return setMode(currentMode() === 'simple' ? 'expert' : 'simple', options);
}

export function initMode(onChange) {
  updateToggle(currentMode());
  $('mode-toggle')?.addEventListener('click', () => toggleMode());
  if (typeof onChange === 'function') onChange(currentMode());
  window.addEventListener('sicc:modechange', event => { if (typeof onChange === 'function') onChange(event.detail.mode); });
}
