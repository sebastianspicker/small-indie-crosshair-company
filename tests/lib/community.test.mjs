import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMMUNITY_MODEL, communityForward, communityLegacy, roundEven } from '../../lib/geometry/community.js';
import { rectangles, raster, compareMasks, RAW_EDGE_CONVENTION } from '../../lib/geometry/raster.js';
import { DEFAULT_SETTINGS } from '../../lib/settings/cfg.js';
import { solveCommunity } from '../../lib/solver/community.js';
import { infer } from '../../lib/solver/inference.js';
import { exportQuantCFG } from '../../lib/solver/export.js';
import { solveInverse, exactPreimage } from '../../lib/solver/inverse.js';
import { getModel, forward, geometryError } from '../../lib/solver/renderer.js';
import { visualContext } from '../../lib/solver/visual.js';
import { measureNativeMask } from '../../lib/image/screenshot.js';
import { validateMeasurements } from '../../lib/solver/observations.js';

const settings = { ...DEFAULT_SETTINGS, size: 2, thickness: 1, gap: -4, outline: false, recoil: false };
const fixture = JSON.parse(await readFile(new URL('../../research/comparisons/crosshair-club-2026-09-28.json', import.meta.url)));
const holdout = JSON.parse(await readFile(new URL('../../research/comparisons/crosshair-club-holdout-2026-09-28.json', import.meta.url)));

test('direct reconstruction agrees with the frozen external software observations', () => {
  assert.equal(fixture.nativeEvidence, false);
  for (const row of [...fixture.cases, ...holdout.cases]) {
    const result = solveCommunity({ ...settings, ...row.settings }, { oldHeight: row.height });
    assert.deepEqual(result.native, row.native, row.id);
  }
});

test('legacy rounding distinguishes half-even from truncation and half-up', () => {
  assert.deepEqual([-2.5, -1.5, -.5, 0, .5, 1.5, 2.5, 3.5].map(roundEven), [-2, -2, 0, 0, 0, 2, 2, 4]);
  for (const [size, expected] of [[0, 0], [1, 2], [2, 3], [3, 4], [3.1, 5]])
    assert.equal(communityLegacy({ ...settings, size }, 720).length, expected);
  assert.equal(communityLegacy({ ...settings, thickness: 2 }, 1080).width, 4);
  for (const [gap, expected] of [[-6, -2], [-5, -1], [-4.9, 0], [-4, 0], [-3.5, 0], [-2.2, 1]])
    assert.equal(communityLegacy({ ...settings, gap }, 1080).gapOffset, expected);
});

test('static primitives preserve odd/even pixel placement and zero visibility', () => {
  const render = thickness => communityForward({ length: 2, thickness, gap: 1, authoredHeight: 1080 }, 1080);
  assert.deepEqual(rectangles(render(1)), [
    { x: -3, y: -1, w: 2, h: 1 }, { x: 0, y: -1, w: 2, h: 1 },
    { x: -1, y: 0, w: 1, h: 2 }, { x: -1, y: -3, w: 1, h: 2 },
  ]);
  assert.deepEqual(rectangles(render(2))[1], { x: 1, y: -1, w: 2, h: 2 });
  assert.deepEqual(rectangles(render(3))[1], { x: 0, y: -2, w: 2, h: 3 });
  assert.deepEqual(rectangles(render(0), { dot: true }), []);
  assert.equal(rectangles(render(1), { t_style: true }).length, 3);
});

test('positive dimensions survive downscaling while actual zero dimensions stay zero', () => {
  const n = { length: 1, thickness: 1, gap: 1, authoredHeight: 2160 };
  const tiny = communityForward(n, 240);
  assert.deepEqual([tiny.length, tiny.width, tiny.near], [1, 1, 1]);
  const half = communityForward({ ...n, length: 3, gap: 0 }, 1080);
  assert.deepEqual([half.length, half.width, half.near], [2, 1, 0]);
  const zero = communityForward({ ...n, length: 0, thickness: 0, gap: 0 }, 240);
  assert.deepEqual([zero.length, zero.width, zero.near], [0, 0, 0]);
});

test('visible old minimum stays visible, dot-only works, and limits are disclosed', () => {
  const report = infer({ settings: { ...settings, size: 0, thickness: 0, dot: true }, selectedModelId: COMMUNITY_MODEL.id });
  assert.equal(report.chosen.native.thickness, 1);
  assert.equal(report.chosen.native.length, 0);
  assert.ok(report.convertedFit.union > 0);
  assert.match(exportQuantCFG(report), /cl_crosshair_thickness 1/);
  const huge = infer({ settings: { ...settings, size: 10000, thickness: 10000, gap: 128 },
    selectedModelId: COMMUNITY_MODEL.id });
  assert.deepEqual(huge.chosen.native, { length: 255, thickness: 31, gap: 128, authoredHeight: 1080 });
  assert.ok(huge.warnings.some(w => w.code === 'dimension-limit'));
});

test('pixels and screen goals differ explicitly and inverse accounts for authored height', () => {
  const input = { ...settings, size: 2, thickness: 1, gap: -4 };
  const options = { oldHeight: 1080, currentHeight: 2160, authoredHeight: 2160 };
  assert.equal(solveCommunity(input, options).native.length, 4);
  assert.equal(solveCommunity(input, { ...options, goal: 'screen' }).native.length, 8);
  const scaled = infer({ settings: input, options: { ...options, goal: 'screen' }, selectedModelId: COMMUNITY_MODEL.id });
  assert.deepEqual(scaled.rendering.targetEdges, { near: 2, far: 2 });
  assert.equal(scaled.convertedFit.iou, 1);
  const odd = solveCommunity({ ...input, thickness: .5 }, { ...options, goal: 'screen' });
  assert.equal(rectangles(odd.target)[0].y, 0); // scaled old odd-width bar retains its position
  const other = solveCommunity(input, { ...options, authoredHeight: 1080 });
  assert.equal(other.native.length, 2);
  assert.equal(other.predicted.length, 4);
});

test('reports keep external provenance separate from calibration and do not claim a preimage', () => {
  const r = infer({ settings, selectedModelId: COMMUNITY_MODEL.id });
  assert.equal(r.schema, 'sicc-quant-report-v5');
  assert.equal(r.targetBuild, '2000918');
  assert.equal(r.provenance.nativeValidated, false);
  assert.equal(r.confidence.nativeMatchProbability, null);
  assert.deepEqual(r.posterior.weights, []);
  assert.equal(r.preimage.count, null);
  assert.equal(r.preimage.complete, false);
  assert.equal(r.decision.certificate.global, false);
  assert.match(exportQuantCFG(r), /Build 2000918/);
  assert.doesNotMatch(exportQuantCFG(r), /native tuple\(s\)/);
  assert.deepEqual(JSON.parse(JSON.stringify(r)).chosen.native, r.chosen.native);
});

test('new raster convention cannot alias the historical shape score cache', () => {
  const g = communityForward({ length: 2, thickness: 1, gap: 1, authoredHeight: 1080 }, 1080);
  const historicalPlacement = { ...g, rasterConvention: RAW_EDGE_CONVENTION };
  const visual = visualContext(g, settings);
  assert.equal(visual.score(g).iou, 1);
  assert.ok(visual.score(historicalPlacement).iou < 1);
});

test('measured target report never silently describes the legacy preimage', () => {
  const targetOverride = { length: 4, width: 2, near: 1, far: 2 };
  const r = infer({ settings: { ...settings, size: 1 }, targetOverride, selectedModelId: 'authored:trunc:thickness' });
  assert.ok(r.preimage.sample.length);
  assert.equal(r.targetKind, 'measured-geometry');
  for (const native of r.preimage.sample)
    assert.equal(geometryError(forward(native, 1080, r.renderer), r.target), 0);
  const mask = raster(targetOverride);
  const measured = infer({ settings, targetOverride, targetMask: mask, selectedModelId: 'authored:trunc:thickness' });
  assert.equal(measured.preimage.complete, false);
  assert.equal(measured.preimage.count, null);
  assert.deepEqual(measured.preimage.sample, []);
  const current = infer({ settings, targetOverride, targetMask: mask, selectedModelId: COMMUNITY_MODEL.id });
  assert.equal(current.target.length, 4);
  assert.equal(current.targetKind, 'image-derived');
});

test('historical visual refinement escapes a two-cell thickness trap', () => {
  const r = infer({ settings: { ...settings, size: 1, thickness: 2, gap: -5 },
    options: { oldHeight: 2160 }, selectedModelId: 'authored:trunc:thickness' });
  assert.ok(r.convertedFit.iou >= .8);
  assert.equal(compareMasks(raster(r.target, r.settings), raster(r.converted, r.settings)).iou, r.convertedFit.iou);
});

test('historical zero-preservation certificate explicitly restricts its thickness domain', () => {
  const result = solveInverse({ ...settings, thickness: 0 },
    { oldHeight: 1080, currentHeight: 2160, goal: 'screen' }, getModel('authored:trunc:thickness'));
  assert.deepEqual(result.inverseCertificate.domain.thickness, [0, 0]);
  assert.match(result.inverseCertificate.scope, /thickness=0 restricted/);
});

test('historical inverse APIs cannot certify a different renderer family', () => {
  assert.throws(() => solveInverse(settings, {}, COMMUNITY_MODEL), /solveCommunity/);
  assert.throws(() => exactPreimage({ settings, model: COMMUNITY_MODEL }), /not implemented/);
});

test('odd-width direct conversion preserves size and honestly reports its unfixable centre shift', () => {
  const r = infer({ settings: { ...settings, thickness: .5, gap: -3 }, selectedModelId: COMMUNITY_MODEL.id });
  assert.equal(r.chosen.native.thickness, 1);
  assert.equal(r.convertedFit.iou, 0);
  assert.ok(r.warnings.some(w => w.code === 'pixel-centering-shift'));
  assert.equal(r.decision.certificate.global, false);
});

test('independent native measurements retain either odd-width transverse origin', () => {
  for (const thickness of [1, 2, 3, 4, 5]) {
    const native = { length: 4, thickness, gap: 5, authoredHeight: 1080 };
    const shape = communityForward(native, 1080);
    const measured = measureNativeMask(raster(shape));
    assert.equal(measured.templateIou, 1);
    assert.equal(measured.geometry.width, thickness);
    assert.equal(measured.geometry.near, shape.near);
    assert.equal(measured.geometry.far, shape.far);
    if (thickness % 2) assert.equal(measured.geometry.axisStart, -Math.ceil(thickness / 2));
  }
});

test('session evidence retains different builds while each inference uses its own subset', () => {
  const native = { length: 4, thickness: 1, gap: 3, authoredHeight: 1080 };
  const row = { id: 'new', kind: 'native-user', role: 'holdout', build: '2000918',
    captureGroup: 'new-group', captureSha256: 'a'.repeat(64), attested: true, native, currentHeight: 1080,
    observed: { length: 4, width: 1, near: 3, far: 2, axisStart: -1 }, sigma: .5 };
  const old = { ...row, id: 'old', build: '2000914', captureGroup: 'old-group', captureSha256: 'b'.repeat(64) };
  const session = validateMeasurements([row, old], null);
  assert.equal(session.length, 2);
  const r = infer({ settings, selectedModelId: COMMUNITY_MODEL.id,
    measurements: session.filter(record => record.build === '2000918') });
  assert.equal(r.posterior.holdoutGroups, 1);
  assert.equal(r.measurementChecks[0].residuals.axisStart, 0);
  assert.deepEqual(r.posterior.weights, []);
  assert.doesNotThrow(() => infer({ settings, measurements: session.filter(record => record.build === '2000914') }));
  assert.throws(() => validateMeasurements([row]), /outside target build/);
});

test('measured transverse origins survive screen scaling and prevent false exact preimages', () => {
  const targetOverride = { length: 4, width: 2, near: 1, far: 1, axisStart: -1,
    rasterConvention: RAW_EDGE_CONVENTION };
  const solved = solveCommunity(settings, { oldHeight: 1080, currentHeight: 2160, goal: 'screen' }, targetOverride);
  assert.equal(solved.target.axisStart, -2);
  assert.deepEqual(rectangles(solved.target)[0], { x: -10, y: -2, w: 8, h: 4 });
  const shifted = { length: 4, width: 2, near: 1, far: 2, axisStart: 0 };
  const r = infer({ settings, targetOverride: shifted, selectedModelId: 'authored:trunc:thickness' });
  assert.equal(r.preimage.complete, false);
  assert.equal(r.preimage.count, null);
  assert.throws(() => exactPreimage({ settings, model: r.renderer, targetOverride: shifted }), /not implemented/);
});

test('a measured historical odd-width origin cannot silently pass the community checks', () => {
  const mask = raster({ length: 4, width: 3, near: 3, far: 2 }, {}, 129, RAW_EDGE_CONVENTION);
  const measured = measureNativeMask(mask);
  assert.equal(measured.geometry.axisStart, -1);
  const row = { id: 'position-check', kind: 'native-user', role: 'holdout', build: '2000918',
    captureGroup: 'synthetic-fixture', captureSha256: 'c'.repeat(64), attested: true,
    native: { length: 4, thickness: 3, gap: 3, authoredHeight: 1080 }, currentHeight: 1080,
    observed: measured.geometry, sigma: .5 };
  const r = infer({ settings, selectedModelId: COMMUNITY_MODEL.id, measurements: [row] });
  assert.equal(r.measurementChecks[0].residuals.axisStart, -1);
});
