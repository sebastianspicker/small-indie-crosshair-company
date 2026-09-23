import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, forward } from '../lib/quant/renderer.js';
import { rankCandidates, weightedQuantile, weightedCvar, normalizeDecision, resolveModelChoice, HEDGE_MODEL } from '../lib/quant/selection.js';
import { DEFAULT_SETTINGS } from '../lib/cfg.js';
import { infer } from '../lib/quant/inference.js';

const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const weights = values => { const total = values.reduce((a, b) => a + b, 0); return values.map(v => v / total); };
const uniform = () => weights(MODELS.map(() => 1));
const indexOf = id => MODELS.findIndex(model => model.id === id);

// Independent evaluation of the declared losses, used to check ranking without
// trusting selection.js's private comparator.
function reference(native, state, height, visual, alpha = .5) {
  const scores = MODELS.map(model => visual.score(forward(native, height, model)));
  let expectedLoss = 0, worstCaseLoss = -Infinity;
  const pairs = [];
  scores.forEach((score, i) => {
    expectedLoss += score.loss * state.weights[i];
    worstCaseLoss = Math.max(worstCaseLoss, score.loss);
    pairs.push([score.loss, state.weights[i]]);
  });
  const exactMass = scores.reduce((sum, s, i) => sum + Number(s.iou === 1 && !s.cropped) * state.weights[i], 0);
  return { native, expectedLoss, worstCaseLoss, cvarLoss: weightedCvar(pairs, alpha), exactMass };
}

test("'expected' and 'worst' rankings match a recomputed reference", () => {
  const state = { weights: weights(MODELS.map((_, i) => ((i * 3) % 7) + 1)) };
  const visual = { score: g => { const loss = ((indexOf(g.model) * 7 + g.length * 3 + g.width * 2) % 13) / 13; return { loss, iou: loss === 0 ? 1 : 1 - loss, cropped: false, geometryLoss: loss }; } };
  const native = (length, thickness, gap) => ({ length, thickness, gap, authoredHeight: 720 });
  const proposals = [native(2, 1, 1), native(3, 1, 0), native(1, 2, 2)].map((n, i) => ({ id: MODELS[i].id, native: n, preserveZero: false }));
  for (const [decision, key] of [['expected', 'expectedLoss'], ['worst', 'worstCaseLoss']]) {
    const ranked = rankCandidates(proposals, state, 720, visual, decision, false);
    assert.equal(ranked.decision, decision);
    const expected = proposals.map(p => reference(p.native, state, 720, visual))
      .sort((a, b) => a[key] - b[key] || a.expectedLoss - b.expectedLoss || b.exactMass - a.exactMass ||
        a.native.length - b.native.length || a.native.thickness - b.native.thickness || a.native.gap - b.native.gap);
    assert.deepEqual(ranked.candidates.map(c => c.native), expected.map(e => e.native));
    ranked.candidates.forEach((candidate, i) => { close(candidate[key], expected[i][key]); close(candidate.cvarLoss, expected[i].cvarLoss); });
  }
});

test("'cvar' differs from 'expected' on a constructed weighted case", () => {
  const state = { weights: weights(MODELS.map((_, i) => i === 0 ? 9 : i === 1 ? 1 : 0)) };
  const visual = { score: g => { const i = indexOf(g.model); const loss = g.minimumBranch ? [.2, .9][i] ?? 1 : [.3, .3][i] ?? 1; return { loss, iou: 1 - loss, cropped: false, geometryLoss: loss }; } };
  const proposals = [{ id: MODELS[0].id, native: { length: 5, thickness: 0, gap: 0, authoredHeight: 720 }, preserveZero: true },
    { id: MODELS[0].id, native: { length: 5, thickness: 1, gap: 0, authoredHeight: 720 }, preserveZero: false }];
  const expected = rankCandidates(proposals, state, 720, visual, 'expected', false);
  const cvar = rankCandidates(proposals, state, 720, visual, { rule: 'cvar', alpha: .5 }, false);
  assert.equal(expected.candidates[0].native.thickness, 0);
  assert.equal(cvar.candidates[0].native.thickness, 1);
  close(expected.candidates[0].expectedLoss, .27);
  close(cvar.candidates[0].cvarLoss, .3);
  assert.equal(cvar.decision, 'cvar');
});

test('string and object decision forms agree and unknown rules throw', () => {
  const state = { weights: uniform() };
  const visual = { score: g => { const loss = ((indexOf(g.model) + g.length) % 5) / 5; return { loss, iou: 1 - loss, cropped: false, geometryLoss: loss }; } };
  const proposals = [1, 2, 3].map((length, i) => ({ id: MODELS[i].id, native: { length, thickness: 1, gap: 0, authoredHeight: 720 }, preserveZero: false }));
  const asString = rankCandidates(proposals, state, 720, visual, 'cvar', false);
  const asObject = rankCandidates(proposals, state, 720, visual, { rule: 'cvar', alpha: .5 }, false);
  assert.equal(asString.decision, 'cvar');
  assert.equal(asObject.decision, 'cvar');
  assert.deepEqual(asString.candidates.map(c => c.native), asObject.candidates.map(c => c.native));
  asString.candidates.forEach((candidate, i) => close(candidate.cvarLoss, asObject.candidates[i].cvarLoss));
  for (const bad of ['bogus', 'CVAR', { rule: 'bogus' }, { rule: 'cvar', alpha: 0 }, { rule: 'cvar', alpha: 2 }, { rule: 'cvar', alpha: 'x' }, null, 7])
    assert.throws(() => rankCandidates(proposals, state, 720, visual, bad, false), /Unknown decision rule/);
  assert.deepEqual(normalizeDecision({ rule: 'cvar', alpha: .25 }), { rule: 'cvar', alpha: .25 });
  assert.deepEqual(normalizeDecision('expected'), { rule: 'expected', alpha: .5 });
});

test('weighted quantile and CVaR are deterministic, prior-free and validated', () => {
  const pairs = [[.9, .1], [.2, .4], [.5, .5]];
  close(weightedCvar(pairs, .5), .58);
  close(weightedCvar(pairs.map(([v, w]) => [v, w * 4]), .5), .58); // scale-invariant: prior-free
  close(weightedCvar([[.7, 0], [.3, 1], [.9, 0]], .5), .3); // zero-weight models are skipped, not a stop
  close(weightedQuantile(pairs, .5), .5); // cumulative ascending: .4 at 0.2, then .9 at 0.5
  close(weightedQuantile(pairs, .1), .2);
  close(weightedQuantile(pairs, 1), .9);
  for (const call of [() => weightedCvar([], .5), () => weightedCvar([[.5, 1]], 0), () => weightedCvar([[.5, 0]], .5),
    () => weightedQuantile([], .5), () => weightedQuantile([[.5, 1]], 2), () => weightedQuantile([[.5, 0]], .5)])
    assert.throws(call);
});

test('infer accepts an object cvar rule and keeps the report decision a string', () => {
  const report = infer({ settings: { ...DEFAULT_SETTINGS, style: 4, weapon_gap: false, outline: false }, decision: { rule: 'cvar', alpha: .25 } });
  assert.equal(report.decision.rule, 'cvar');
  assert.ok(report.chosen.cvarLoss !== undefined);
  assert.equal(report.chosen.alpha, .25);
});

test('the shipped automatic model choice is the authored inverse until evidence exists', () => {
  assert.equal(resolveModelChoice(), 'authored:trunc:thickness');
  assert.equal(resolveModelChoice({ request: '', hasEvidence: false }), 'authored:trunc:thickness');
  assert.equal(resolveModelChoice({ request: '', hasEvidence: true }), null);
  assert.equal(resolveModelChoice({ request: HEDGE_MODEL, hasEvidence: false }), null);
  assert.equal(resolveModelChoice({ request: HEDGE_MODEL, hasEvidence: true }), null);
  assert.equal(resolveModelChoice({ request: 'reference720:nearest:center', hasEvidence: false }), 'reference720:nearest:center');
});

test('the authored default reproduces the published post-update donk-style crosshair', () => {
  const settings = { ...DEFAULT_SETTINGS, style: 4, weapon_gap: false, outline: false, size: 1, thickness: 1, gap: -4 };
  const options = { oldHeight: 1080, currentHeight: 1080, authoredHeight: 1080, goal: 'pixels' };
  const authored = infer({ settings, options, selectedModelId: resolveModelChoice({ request: '', hasEvidence: false }) });
  assert.deepEqual({ ...authored.chosen.native }, { length: 2, thickness: 2, gap: 0, authoredHeight: 1080 });
  // The weighted hedge, kept as an explicit option, still shifts one pixel longer here.
  const hedge = infer({ settings, options, selectedModelId: resolveModelChoice({ request: HEDGE_MODEL, hasEvidence: false }) });
  assert.equal(hedge.chosen.native.length, 3);
});
