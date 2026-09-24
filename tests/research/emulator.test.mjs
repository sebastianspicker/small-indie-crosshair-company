import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { infer } from '../../lib/solver/inference.js';
import { forward, getModel, MODELS } from '../../lib/solver/renderer.js';
import {
  EMULATOR_SCHEMA, EMULATOR_VERSION, EMULATOR_FEATURE_NAMES, FORWARD_FEATURE_NAMES,
  parseEmulator, emulatorFingerprint, predictEmulator, evaluateEmulator, trainEmulator,
  predictForwardEmulator, evaluateForwardEmulator,
} from '../../research/lib/emulator.js';

// Reads the committed artifact once; the emulator is a pure function of it.
const ARTIFACT = parseEmulator(await readFile(new URL('../../research/generated/quant-emulator.json', import.meta.url), 'utf8'));
const COLOR = { alpha_enabled: false, alpha: 200, color: 1, rgb: [0, 255, 0], outline: false, recoil: false, weapon_gap: false, style: 4 };
const settingsOf = (size, thickness, gap, dot = false, t_style = false) => ({ ...COLOR, size, thickness, gap, dot, t_style });
const labeled = (size, thickness, gap, dot, t_style, [oldHeight, currentHeight], goal) => {
  const settings = settingsOf(size, thickness, gap, dot, t_style);
  const options = { oldHeight, currentHeight, authoredHeight: currentHeight, goal };
  const native = infer({ settings, options, records: [] }).chosen.native;
  return { settings, options, native: { length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight } };
};
const forwardSample = (length, thickness, gap, authoredHeight, height, model) => {
  const native = { length, thickness, gap, authoredHeight };
  return { native, height, model, geometry: forward(native, height, model) };
};
const allFinite = object => Object.values(object).every(value => typeof value === 'number' && Number.isFinite(value));

test('committed artifact parses and the parser is fail-closed', () => {
  assert.equal(typeof parseEmulator(JSON.stringify(ARTIFACT)), 'object');
  const clone = () => structuredClone(ARTIFACT);
  assert.throws(() => parseEmulator({ ...clone(), schema: 'wrong' }), /schema/);
  assert.throws(() => parseEmulator({ ...clone(), version: 'wrong' }), /version/);
  assert.throws(() => parseEmulator({ ...clone(), featureNames: [...EMULATOR_FEATURE_NAMES, 'extra'] }), /feature/);
  assert.throws(() => parseEmulator({ ...clone(), bounds: { length: [1, 2], thickness: [0, 31], gap: [0, 128] } }), /bounds/);
  assert.throws(() => parseEmulator({ ...clone(), maxDepth: 0 }), /depth/);
  assert.throws(() => parseEmulator({ ...clone(), maxDepth: 1 }), /model/);
  assert.throws(() => parseEmulator({ ...clone(), model: 'deep-magic' }), /model/);
  assert.throws(() => parseEmulator({ ...clone(), notes: 42 }), /notes/);
  const bad = clone(); bad.outputs.length.stumps[0].left = NaN;
  assert.throws(() => parseEmulator(bad), /finite/);
  const badForward = clone(); badForward.forward.outputs.width.base = Infinity;
  assert.throws(() => parseEmulator(badForward), /finite/);
  const empty = clone(); empty.outputs.gap.stumps = [];
  assert.throws(() => parseEmulator(empty), /stumps/);
});

test('fingerprint matches the committed value and is order-stable', () => {
  assert.equal(emulatorFingerprint(ARTIFACT), ARTIFACT.fingerprint);
  assert.equal(emulatorFingerprint(parseEmulator(JSON.stringify(ARTIFACT))), ARTIFACT.fingerprint);
  // Reordering keys must not change the canonical fingerprint.
  const reordered = { fingerprint: ARTIFACT.fingerprint, ...JSON.parse(JSON.stringify(ARTIFACT)) };
  delete reordered.fingerprint;
  assert.equal(emulatorFingerprint(reordered), ARTIFACT.fingerprint);
});

test('prediction is deterministic, in bounds and provisional', () => {
  const settings = settingsOf(2, 0.5, -3);
  const options = { oldHeight: 1080, currentHeight: 1440, authoredHeight: 1080, goal: 'screen' };
  const a = predictEmulator(ARTIFACT, { settings, options });
  const b = predictEmulator(ARTIFACT, { settings, options });
  assert.deepEqual(a, b);
  assert.equal(a.provisional, true);
  assert.equal(a.schema, EMULATOR_SCHEMA);
  assert.equal(a.version, EMULATOR_VERSION);
  assert.equal(a.native.authoredHeight, 1080);
  for (const [name, [lo, hi]] of Object.entries({ length: [0, 255], thickness: [0, 31], gap: [0, 128] })) {
    assert.ok(Number.isInteger(a.native[name]));
    assert.ok(a.native[name] >= lo && a.native[name] <= hi);
  }
  const fallback = predictEmulator(ARTIFACT, { settings, options: { oldHeight: 960, currentHeight: 960, goal: 'pixels' } });
  assert.equal(fallback.native.authoredHeight, 960);
});

test('training beats the naive baseline and fingerprints detect stump edits', () => {
  const samples = [];
  for (let i = 0; i < 40; i++) {
    const size = 1 + (i % 4), thickness = [0, 1, 2, 3][Math.floor(i / 4) % 4], gap = [-2, 0, 2, 4][Math.floor(i / 16) % 4];
    const pair = [[1080, 1440], [1080, 1080], [960, 1440], [720, 1080]][i % 4];
    samples.push(labeled(size, thickness, gap, i % 3 === 0, i % 5 === 0, pair, i % 2 ? 'screen' : 'pixels'));
  }
  const model = trainEmulator(samples, { rounds: 60, learningRate: 0.2 });
  const metrics = evaluateEmulator(model, samples);
  assert.ok(allFinite(metrics));
  const aggregate = (metrics.lengthMae + metrics.thicknessMae + metrics.gapMae) / 3;
  assert.ok(aggregate < metrics.naiveMae, `training MAE ${aggregate} should beat naive ${metrics.naiveMae}`);
  const before = emulatorFingerprint(model);
  const edited = structuredClone(model);
  edited.outputs.length.stumps[0].left += 0.5;
  assert.notEqual(emulatorFingerprint(edited), before);
  assert.equal(emulatorFingerprint(model), before);
});

test('committed emulator improves on the naive baseline on fresh solver labels', () => {
  const combos = [
    [2, .5, -3, false, false], [2, 1, -3, true, false], [3, 1.5, -2, false, true], [4, 2, 0, false, false],
    [1, .5, -4, false, false], [1.5, 1, 1, true, false], [0, 0, -4, false, false], [6, 3, 4, false, true],
    [8, 4, 8, false, false], [2, 0, 0, true, false], [3, 0, -3, false, false], [4, .5, -1, false, false],
    [1, 2, 2, false, false], [2, 3, -2, true, false], [1.5, .5, 0, false, true], [3, 1, -4, false, false],
  ];
  const pairs = [[1080, 1440, 'pixels'], [960, 1440, 'screen']];
  const fresh = [];
  for (const combo of combos) for (const pair of pairs) fresh.push(labeled(...combo, [pair[0], pair[1]], pair[2]));
  const metrics = evaluateEmulator(ARTIFACT, fresh);
  assert.ok(metrics.exactTupleRate >= metrics.naiveExactTupleRate,
    `exact ${metrics.exactTupleRate} vs naive ${metrics.naiveExactTupleRate}`);
  assert.ok(metrics.gapMae <= metrics.naiveMae, `gap MAE ${metrics.gapMae} vs naive ${metrics.naiveMae}`);
});

test('provenance refuses native-accuracy claims', () => {
  assert.deepEqual(Object.keys(ARTIFACT.provenance), ['labels', 'scope', 'nativeEvidence', 'speedGate']);
  assert.equal(ARTIFACT.provenance.nativeEvidence, false);
  assert.match(ARTIFACT.provenance.scope, /NOT native CS2 renderer accuracy/);
  assert.equal(ARTIFACT.provenance.speedGate, 'closed-not-exact-equivalent');
  assert.ok(!/nativeAccuracy|nativeCorrectness|measuredAccuracy/i.test(JSON.stringify(ARTIFACT)));
});

test('forward emulator parses, predicts finite values and holds under 1 px', () => {
  assert.deepEqual(ARTIFACT.forward.featureNames, FORWARD_FEATURE_NAMES);
  assert.ok(ARTIFACT.forward.metrics.count > 0);
  for (const key of ['lengthMae', 'widthMae', 'nearMae', 'farMae']) assert.ok(ARTIFACT.forward.metrics[key] < 1, `${key} stored ${ARTIFACT.forward.metrics[key]}`);
  const fresh = [];
  let counter = 0;
  for (const length of [0, 1, 2, 3, 4, 6, 9])
    for (const thickness of [0, 1, 2, 3, 5])
      for (const gap of [0, 1, 2, 4, 8])
        for (const authoredHeight of [720, 1080, 2160])
          for (const height of [720, 1440, 2160])
            for (const model of MODELS) if (counter++ % 20 === 0) fresh.push(forwardSample(length, thickness, gap, authoredHeight, height, model));
  const prediction = predictForwardEmulator(ARTIFACT.forward, fresh[0].native, fresh[0].height, fresh[0].model);
  assert.ok(allFinite(prediction));
  const metrics = evaluateForwardEmulator(ARTIFACT.forward, fresh);
  assert.ok(metrics.count > 0);
  for (const key of ['lengthMae', 'widthMae', 'nearMae', 'farMae']) assert.ok(metrics[key] < 1, `fresh ${key} ${metrics[key]}`);
});

test('metrics are populated and finite', () => {
  assert.ok(ARTIFACT.training.testSamples > 0);
  assert.ok(ARTIFACT.metrics.testSamples > 0);
  assert.equal(ARTIFACT.metrics.count, ARTIFACT.metrics.testSamples);
  assert.ok(allFinite(ARTIFACT.metrics));
  assert.ok(allFinite(ARTIFACT.forward.metrics));
  assert.ok(ARTIFACT.metrics.naiveExactTupleRate < ARTIFACT.metrics.exactTupleRate);
});
