import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, forward } from '../../lib/solver/renderer.js';
import { visualContext } from '../../lib/solver/visual.js';
import { objective, exhaustiveOptimum, certifyOptimum } from '../../lib/solver/certify.js';
import { rankAndCertify } from '../../lib/solver/inference.js';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';

const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const weights = values => { const total = values.reduce((a, b) => a + b, 0); return values.map(v => v / total); };
const uniform = () => weights(MODELS.map(() => 1));
const oneHot = index => MODELS.map((_, k) => Number(k === index));
const stub = fn => ({ score: geometry => { const loss = fn(geometry); return { loss, iou: loss === 0 ? 1 : 0, cropped: false, geometryLoss: loss }; } });

// Independent CVaR reference so the objective check does not merely call itself.
function referenceCvar(pairs, alpha) {
  const sorted = [...pairs].sort((a, b) => b[0] - a[0]);
  const total = sorted.reduce((sum, p) => sum + p[1], 0), target = alpha * total;
  let used = 0, sum = 0;
  for (const [value, weight] of sorted) {
    const take = Math.min(weight, target - used);
    if (take <= 0) continue;
    sum += value * take; used += take;
  }
  return sum / used;
}

test('objective equals a hand-built reference over declared weights', () => {
  const target = { length: 6, width: 3, near: 2, far: 6 };
  const visual = visualContext(target, { dot: false, t_style: false });
  const state = { weights: weights(MODELS.map((_, i) => (i % 5) + 1)) };
  const native = { length: 5, thickness: 2, gap: 1, authoredHeight: 1080 };
  const value = objective(native, { state, height: 1440, visual, decision: 'expected' });
  let expected = 0, worst = -Infinity;
  const pairs = [];
  MODELS.forEach((model, i) => {
    const score = visual.score(forward(native, 1440, model));
    expected += score.loss * state.weights[i];
    worst = Math.max(worst, score.loss);
    pairs.push([score.loss, state.weights[i]]);
  });
  close(value.expectedLoss, expected);
  close(value.worstCaseLoss, worst);
  close(value.cvarLoss, referenceCvar(pairs, .5));
  assert.equal(value.rule, 'expected');
  assert.equal(value.scores.length, MODELS.length);
});

test('exhaustiveOptimum equals brute force on a tiny declared window', () => {
  const target = { length: 4, width: 2, near: 1, far: 2 };
  const visual = visualContext(target, { dot: false, t_style: false });
  const state = { weights: uniform() };
  const window = { length: [1, 4], thickness: [0, 3], gap: [0, 3] };
  const found = exhaustiveOptimum({ state, height: 720, visual, decision: 'expected', window });
  let best = null;
  for (let length = 1; length <= 4; length++) for (let thickness = 0; thickness <= 3; thickness++) for (let gap = 0; gap <= 3; gap++) {
    const native = { length, thickness, gap, authoredHeight: 720 };
    const value = objective(native, { state, height: 720, visual, decision: 'expected' });
    if (!best || value.expectedLoss < best.loss) best = { native, loss: value.expectedLoss };
  }
  assert.deepEqual(found.native, best.native);
  close(found.loss, best.loss);
  assert.equal(found.evaluated, 4 * 4 * 4);
  assert.equal(found.boundaryHit, ['length', 'thickness', 'gap'].some(k => best.native[k] === window[k][0] || best.native[k] === window[k][1]));
});

test('certifyOptimum certifies the zero floor when an exact geometry is reachable', () => {
  const state = { weights: oneHot(0) };
  const visual = stub(g => g.model === MODELS[0].id && g.length === 7 ? 0 : 1);
  const native = { length: 7, thickness: 1, gap: 0, authoredHeight: 720 };
  const cert = certifyOptimum({ native, state, height: 720, visual, decision: 'expected', maxRadius: 2 });
  assert.equal(cert.global, true);
  assert.equal(cert.method, 'loss-zero');
  close(cert.best.loss, 0);
});

test('exhaustiveOptimum and certifyOptimum respect preserveZero', () => {
  const state = { weights: oneHot(0) };
  const visual = stub(g => Math.abs(g.length - 3) + Math.abs(g.width - 2));
  const found = exhaustiveOptimum({ state, height: 720, visual, decision: 'expected', preserveZero: true, window: { length: [0, 3], thickness: [0, 4], gap: [0, 2] } });
  assert.equal(found.native.thickness, 0);
  assert.equal(found.evaluated, 4 * 1 * 3);
  const cert = certifyOptimum({ native: { length: 0, thickness: 0, gap: 0, authoredHeight: 720 }, state, height: 720, visual, decision: 'expected', preserveZero: true, maxRadius: 3 });
  assert.equal(cert.best.native.thickness, 0);
});

test('a scoped-domain certificate agrees with brute force', () => {
  const state = { weights: oneHot(0) };
  const visual = stub(g => (g.length - 2) ** 2 + (g.width - 1) ** 2 + (g.near - 1) ** 2);
  const domain = { length: [0, 2], thickness: [0, 1], gap: [0, 1] };
  const cert = certifyOptimum({ native: { length: 0, thickness: 0, gap: 0, authoredHeight: 720 }, state, height: 720, visual, decision: 'expected', maxRadius: 2, domain });
  const brute = exhaustiveOptimum({ state, height: 720, visual, decision: 'expected', window: domain });
  assert.equal(cert.global, true);
  assert.ok(['domain-exhaustive', 'shell-monotone'].includes(cert.method));
  close(cert.best.loss, brute.loss);
});

test('a shell certificate agrees with brute force on a convex declared sub-domain', () => {
  const state = { weights: oneHot(0) };
  const visual = stub(g => (g.length - 4) ** 2 + (g.width - 2) ** 2 + .001 * g.near ** 2);
  const domain = { length: [0, 9], thickness: [0, 4], gap: [0, 9] };
  const cert = certifyOptimum({ native: { length: 0, thickness: 0, gap: 0, authoredHeight: 720 }, state, height: 720, visual, decision: 'expected', maxRadius: 6, domain });
  const brute = exhaustiveOptimum({ state, height: 720, visual, decision: 'expected', window: domain });
  assert.equal(cert.global, true);
  assert.equal(cert.method, 'shell-monotone');
  close(cert.best.loss, brute.loss);
  assert.ok(cert.shellMargin > 0);
});

test('certifyOptimum refuses a global claim for a remote optimum', () => {
  const state = { weights: oneHot(0) };
  const visual = stub(g => g.length === 15 ? 0 : 1);
  const cert = certifyOptimum({ native: { length: 0, thickness: 0, gap: 0, authoredHeight: 720 }, state, height: 720, visual, decision: 'expected', maxRadius: 3 });
  assert.equal(cert.global, false);
  assert.equal(cert.method, 'unproven');
});

test('certification is deterministic', () => {
  const target = { length: 5, width: 2, near: 1, far: 2 };
  const visual = visualContext(target, { dot: false, t_style: false });
  const state = { weights: uniform() };
  const native = { length: 3, thickness: 1, gap: 1, authoredHeight: 1080 };
  const first = certifyOptimum({ native, state, height: 1080, visual, decision: 'worst' });
  const second = certifyOptimum({ native, state, height: 1080, visual, decision: 'worst' });
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
});

test('rankAndCertify never reports a best loss above the solver choice', () => {
  const settings = { ...DEFAULT_SETTINGS, size: 2, thickness: 1, gap: 0, style: 4, weapon_gap: false, outline: false, recoil: false };
  for (const decision of ['expected', 'worst']) {
    const rc = rankAndCertify({ settings, options: { oldHeight: 1080 }, decision });
    assert.ok(['loss-zero', 'shell-monotone', 'domain-exhaustive', 'unproven'].includes(rc.certificate.method));
    assert.equal(typeof rc.inferredBetter, 'boolean');
    const chosenLoss = decision === 'worst' ? rc.chosen.worstCaseLoss : rc.chosen.expectedLoss;
    assert.ok(rc.certificate.best.loss <= chosenLoss + 1e-12);
    assert.equal(rc.chosen.native.authoredHeight, 1080);
  }
});
