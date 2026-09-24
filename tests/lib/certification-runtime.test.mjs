import test from 'node:test';
import assert from 'node:assert/strict';
import { forward, geometryError, getModel } from '../../lib/solver/renderer.js';
import { infer, rankAndCertify } from '../../lib/solver/inference.js';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';

// Small, fast case: the point is runtime wiring, not corpus coverage.
const SETTINGS = { ...DEFAULT_SETTINGS, size: 2, thickness: 1, gap: -3, style: 4, weapon_gap: false, outline: false, recoil: false };
const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const CERTIFICATE_METHODS = ['loss-zero', 'shell-monotone', 'domain-exhaustive', 'unproven'];
const DEFAULT_METHODS = ['loss-zero', 'not-evaluated'];

test('default inference keeps the bounded policy and makes no global claim', () => {
  const report = infer({ settings: SETTINGS, options: { oldHeight: 1080 } });
  assert.equal(report.decision.searchPolicy, 'bounded-neighborhood-plus-length-two-v1');
  const certificate = report.decision.certificate;
  assert.ok(DEFAULT_METHODS.includes(certificate.method));
  assert.equal(certificate.improved, false);
  assert.equal(certificate.evaluated, 0);
  assert.equal(certificate.global, report.chosen.expectedLoss <= 1e-12);
  assert.equal(certificate.best.loss, report.chosen.expectedLoss);
});

test('certify must be a boolean like the other flags', () => {
  assert.throws(() => infer({ settings: SETTINGS, certify: 'yes' }), /certify/);
});

test('opt-in certification matches or beats the default search and stays honest', () => {
  for (const decision of ['expected', 'worst']) {
    const base = infer({ settings: SETTINGS, options: { oldHeight: 1080 }, decision });
    const certified = infer({ settings: SETTINGS, options: { oldHeight: 1080 }, decision, certify: true });
    assert.equal(certified.decision.searchPolicy, 'bounded-neighborhood-plus-certified-expansion-v2');
    const certificate = certified.decision.certificate;
    assert.ok(CERTIFICATE_METHODS.includes(certificate.method));
    const key = decision === 'worst' ? 'worstCaseLoss' : 'expectedLoss';
    assert.ok(certificate.best.loss <= base.chosen[key] + 1e-12, 'certified best is never worse than the default choice');
    if (certificate.global) close(certified.chosen[key], certificate.best.loss);
    assert.equal(certified.decision.trace.at(-1).pass, 'certified');
    if (certificate.method === 'unproven') {
      assert.equal(certificate.global, false);
      assert.ok(!/global minimum/i.test(certificate.scope));
    }
  }
});

test('report exposes an exact structured-cloneable preimage', () => {
  const report = infer({ settings: SETTINGS, options: { oldHeight: 1080 } });
  const preimage = report.preimage;
  assert.ok(preimage);
  assert.equal(preimage.model, report.renderer.id);
  assert.ok(Number.isInteger(preimage.count) && preimage.count >= 0);
  assert.ok(preimage.sample.length <= 64 && preimage.sample.length <= preimage.count);
  const model = getModel(report.renderer.id);
  for (const tuple of preimage.sample)
    assert.equal(geometryError(forward(tuple, report.options.currentHeight, model), report.target), 0);
});

test('report schema is v4 and the full report survives a JSON round-trip', () => {
  const report = infer({ settings: SETTINGS, options: { oldHeight: 1080 }, certify: true });
  assert.equal(report.schema, 'sicc-quant-report-v4');
  const clone = JSON.parse(JSON.stringify(report));
  assert.equal(clone.schema, report.schema);
  assert.deepEqual(clone.preimage, report.preimage);
  assert.deepEqual(clone.decision.certificate, report.decision.certificate);
});

test('rankAndCertify keeps the moved certification contract', () => {
  for (const decision of ['expected', 'worst']) {
    const result = rankAndCertify({ settings: SETTINGS, options: { oldHeight: 1080 }, decision });
    assert.ok(CERTIFICATE_METHODS.includes(result.certificate.method));
    assert.equal(typeof result.inferredBetter, 'boolean');
    const chosenLoss = decision === 'worst' ? result.chosen.worstCaseLoss : result.chosen.expectedLoss;
    assert.ok(result.certificate.best.loss <= chosenLoss + 1e-12);
    assert.equal(result.chosen.native.authoredHeight, 1080);
  }
});
