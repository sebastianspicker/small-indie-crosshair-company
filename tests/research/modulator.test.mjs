import test from 'node:test';
import assert from 'node:assert/strict';
import { modulate, gateDecision, CLOSED_GATE, MODULATOR_VERSION, DELTA_CLIP } from '../../research/lib/modulator.js';
import { DELTA_CLIP as CONTRACT_DELTA_CLIP } from '../../research/lib/modulation-contract.js';

const sample = Object.freeze({ length: 4, thickness: 0, gap: 0, authoredHeight: 1080 });

test('modulate returns a zero delta and copies the tuple without mutation', () => {
  const input = { ...sample };
  const result = modulate(input);
  assert.deepEqual(result.delta, { length: 0, thickness: 0, gap: 0 });
  assert.equal(result.applied, false);
  assert.equal(result.reason, CLOSED_GATE);
  assert.equal(result.version, MODULATOR_VERSION);
  assert.deepEqual(result.native, sample);
  assert.notEqual(result.native, input, 'modulate must not return the caller object');
  assert.deepEqual(input, sample, 'modulate must not mutate the caller object');
});

test('the evidence gate stays closed for an empty registry', () => {
  const decision = gateDecision([]);
  assert.equal(decision.gate, CLOSED_GATE);
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.some(reason => /reviewed native pairs/.test(reason)));
});

test('the evidence gate stays closed below 40 reviewed pairs', () => {
  const pairs = Array.from({ length: 39 }, (_, i) => ({ signature: `s${i % 24}`, currentHeight: 1080, authoredHeight: 1080,
    renderedWidth: 2, oldThickness: 1, oldGap: 0, build: '2000914', provenance: 'reviewed' }));
  const decision = gateDecision(pairs);
  assert.equal(decision.gate, CLOSED_GATE);
  assert.equal(decision.eligible, false);
});

test('the evidence gate stays closed for 40 synthetic-provenance pairs', () => {
  const pairs = Array.from({ length: 40 }, (_, i) => ({ signature: `s${i % 24}`, currentHeight: [1080, 1440, 720][i % 3],
    authoredHeight: [1080, 1080, 720][i % 3], renderedWidth: i % 2 ? 2 : 3, oldThickness: i % 2, oldGap: i % 2 ? -4 : 0,
    build: '2000914', provenance: 'synthetic-example' }));
  const decision = gateDecision(pairs);
  assert.equal(decision.gate, CLOSED_GATE);
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.some(reason => /provenance/.test(reason)));
});

// modulator.js and modulation-contract.js each declare their own DELTA_CLIP: they are
// separate facts (a research module and the contract it is bound by), not one shared source
// of truth, and must be changed deliberately together if the clip is ever revised.
test('modulator DELTA_CLIP matches the modulation-contract DELTA_CLIP it is bound by', () => {
  assert.equal(DELTA_CLIP, CONTRACT_DELTA_CLIP);
});

test('the gate is never open in v1 even when counts look sufficient', () => {
  // Paired provenance is not a value this plan defines, so a "complete-looking" registry
  // still fails the provenance condition and the gate stays closed.
  const pairs = Array.from({ length: 48 }, (_, i) => ({ signature: `s${i % 24}`, currentHeight: [1080, 1440, 720, 960][i % 4],
    authoredHeight: [1080, 1080, 720, 960][i % 4], renderedWidth: i % 2 ? 2 : 3, oldThickness: i % 2, oldGap: i % 2 ? -4 : 0,
    build: '2000914', provenance: 'reviewed' }));
  const decision = gateDecision(pairs);
  assert.equal(decision.gate, CLOSED_GATE);
  assert.ok(decision.reasons.some(reason => /provenance/.test(reason)));
});
