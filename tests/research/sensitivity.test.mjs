import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { infer } from '../../lib/solver/inference.js';
import { parseEmulator, predictEmulator, trainEmulator } from '../../research/lib/emulator.js';
import {
  FRAGILITY_SCHEMA, SENSITIVITY_SCOPE, boundaryMargin, analyticSensitivity,
  trainFragility, fragilityScore, parseFragility, sensitivityReport,
} from '../../research/lib/sensitivity.js';

const ARTIFACT = parseEmulator(await readFile(new URL('../../research/generated/quant-emulator.json', import.meta.url), 'utf8'));
const COLOR = { alpha_enabled: false, alpha: 200, color: 1, rgb: [0, 255, 0], outline: false, recoil: false, weapon_gap: false, style: 4 };
const settingsOf = (size, thickness, gap, dot = false, t_style = false) => ({ ...COLOR, size, thickness, gap, dot, t_style });
const options = (authoredHeight = 1080, currentHeight = authoredHeight, goal = 'pixels') => ({ oldHeight: currentHeight, currentHeight, authoredHeight, goal });

test('boundaryMargin matches the declared 0.5 and integer boundaries', () => {
  assert.equal(boundaryMargin(2.5, 'nearest'), 0);
  assert.equal(boundaryMargin(2, 'nearest'), 0.5);
  assert.ok(Math.abs(boundaryMargin(2.4, 'nearest') - 0.1) < 1e-12);
  assert.equal(boundaryMargin(3, 'trunc'), 0);
  assert.equal(boundaryMargin(3, 'ceil'), 0);
  assert.equal(boundaryMargin(3.25, 'trunc'), 0.25);
  assert.ok(Math.abs(boundaryMargin(3.25, 'ceil') - 0.25) < 1e-12);
  assert.throws(() => boundaryMargin(2, 'nope'), /Unknown rounding/);
});

test('analyticSensitivity flags an exact nearest boundary as high', () => {
  const sensitivity = analyticSensitivity({ settings: settingsOf(2.5, 1, 1), options: options(1080, 1080) });
  assert.equal(sensitivity.margins.size, 0);
  assert.equal(sensitivity.level, 'high');
  assert.ok(sensitivity.score >= 2);
  assert.ok(sensitivity.reasons.some(reason => /quantiser boundary/.test(reason)));
  assert.match(sensitivity.margins.scale, /:/);
  const again = analyticSensitivity({ settings: settingsOf(2.5, 1, 1), options: options(1080, 1080) });
  assert.deepEqual(sensitivity, again);
});

test('analyticSensitivity reports the documented structural reasons', () => {
  const zeroThickness = analyticSensitivity({ settings: settingsOf(2, 0, 1), options: options(1440, 1440) });
  assert.ok(zeroThickness.reasons.some(reason => /literal-zero thickness branch/.test(reason)));

  const negativeGap = analyticSensitivity({ settings: settingsOf(2, 1, -3), options: options(1440, 1440) });
  assert.ok(negativeGap.reasons.some(reason => /negative/.test(reason)));

  const ambiguous = analyticSensitivity({ settings: settingsOf(2, 1, 1), options: options(1080, 1080) });
  assert.ok(ambiguous.reasons.some(reason => /coincides with a reference scale/.test(reason)));
  const ambiguous720 = analyticSensitivity({ settings: settingsOf(2, 1, 1), options: options(720, 720) });
  assert.ok(ambiguous720.reasons.some(reason => /coincides with a reference scale/.test(reason)));

  const fractional = analyticSensitivity({ settings: settingsOf(1.5, 0.5, 0), options: options(1440, 1440) });
  assert.ok(fractional.reasons.some(reason => /fractional/.test(reason)));

  const integer = analyticSensitivity({ settings: settingsOf(2, 1, 0), options: options(1440, 1440) });
  assert.ok(integer.reasons.some(reason => /trunc\/ceil integer boundary/.test(reason)));
});

test('analytic level is deterministic and bounded to the declared labels', () => {
  const cases = [
    [settingsOf(2, 1, 0), options(1440, 1440)],
    [settingsOf(1.5, 0.5, -3), options(1080, 1080)],
    [settingsOf(2.5, 0, -1), options(720, 720)],
    [settingsOf(0.7, 0.1, -4.5), options(2160, 1440)],
  ];
  for (const [settings, opts] of cases) {
    const a = analyticSensitivity({ settings, options: opts });
    const b = analyticSensitivity({ settings, options: opts });
    assert.deepEqual(a, b);
    assert.ok(['low', 'medium', 'high'].includes(a.level));
    assert.ok(Number.isFinite(a.score) && a.score >= 0);
    assert.ok(Array.isArray(a.reasons));
    assert.ok(a.reasons.length > 0);
    assert.match(a.reasons.join(' '), /\S/);
  }
});

function learnedSamples() {
  const samples = [];
  for (let i = 0; i < 16; i++) {
    const size = 1 + (i % 4), thickness = [0, 1, 2, 3][Math.floor(i / 4) % 4], gap = [-2, 0, 2, 4][Math.floor(i / 8) % 4];
    const pair = [[1080, 1440], [1080, 1080], [960, 1440], [720, 1080]][i % 4];
    const settings = settingsOf(size, thickness, gap, i % 3 === 0, i % 5 === 0);
    const opts = { oldHeight: pair[0], currentHeight: pair[1], authoredHeight: pair[1], goal: i % 2 ? 'screen' : 'pixels' };
    const native = infer({ settings, options: opts, records: [] }).chosen.native;
    samples.push({
      settings, options: opts,
      native: { length: native.length, thickness: native.thickness, gap: native.gap, authoredHeight: native.authoredHeight },
      emulator: predictEmulator(ARTIFACT, { settings, options: opts }).native,
    });
  }
  return samples;
}

test('trainFragility is deterministic and fragilityScore stays in [0, 1]', () => {
  const samples = learnedSamples();
  const a = trainFragility(samples, { rounds: 20, learningRate: 0.2, seed: 99 });
  const b = trainFragility(samples, { rounds: 20, learningRate: 0.2, seed: 99 });
  assert.deepEqual(a, b);
  assert.equal(a.schema, FRAGILITY_SCHEMA);
  assert.equal(a.kind, 'boosted-logistic-stumps');
  assert.equal(a.featureNames.length, 26);
  assert.ok(a.stumps.length > 0 && a.stumps.length <= 20);
  assert.ok(Number.isFinite(a.positiveRate) && a.positiveRate >= 0 && a.positiveRate <= 1);
  for (const sample of samples) {
    const score = fragilityScore(a, sample);
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 1, `score ${score}`);
  }
  const report = sensitivityReport({ settings: samples[0].settings, options: samples[0].options, artifact: ARTIFACT, fragility: a });
  assert.ok(report.learned && report.learned.available);
  assert.ok(report.learned.score >= 0 && report.learned.score <= 1);
  assert.equal(report.learned.artifactFingerprint, ARTIFACT.fingerprint);
  assert.ok(['low', 'medium', 'high'].includes(report.level));
  assert.match(report.scope, /NOT measure native renderer fragility/i);
  assert.match(SENSITIVITY_SCOPE, /NOT measure native renderer fragility/i);
});

test('sensitivityReport stands alone analytically when no learned model is supplied', () => {
  const report = sensitivityReport({ settings: settingsOf(2, 1, -3), options: options(1080, 1440) });
  assert.equal(report.learned, null);
  assert.ok(report.reasons.length > 0);
  assert.match(report.scope, /declared/i);
});

test('parseFragility is fail-closed', () => {
  const model = trainFragility(learnedSamples(), { rounds: 12, learningRate: 0.2, seed: 3 });
  assert.equal(parseFragility(JSON.stringify(model)).schema, FRAGILITY_SCHEMA);
  const clone = () => structuredClone(model);
  assert.throws(() => parseFragility({ ...clone(), schema: 'wrong' }), /schema/);
  assert.throws(() => parseFragility({ ...clone(), version: 'wrong' }), /version/);
  assert.throws(() => parseFragility({ ...clone(), kind: 'magic' }), /kind/);
  assert.throws(() => parseFragility({ ...clone(), featureNames: [...model.featureNames, 'extra'] }), /feature/);
  assert.throws(() => parseFragility({ ...clone(), base: NaN }), /finite|metadata/);
  assert.throws(() => parseFragility({ ...clone(), learningRate: 0 }), /finite|positive/);
  assert.throws(() => parseFragility({ ...clone(), maxDepth: 0 }), /depth/);
  assert.throws(() => parseFragility({ ...clone(), stumps: [] }), /stumps/);
  assert.throws(() => parseFragility({ ...clone(), notes: '' }), /notes/);
  const bad = clone();
  bad.stumps[0] = { feature: 999, threshold: 0, left: 1, right: 1 };
  assert.throws(() => parseFragility(bad), /feature/);
  const nonFinite = clone();
  nonFinite.stumps[0] = { feature: 0, threshold: 0, left: NaN, right: 1 };
  assert.throws(() => parseFragility(nonFinite), /finite/);
});
